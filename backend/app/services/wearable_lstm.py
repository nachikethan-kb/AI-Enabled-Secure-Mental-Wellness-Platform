"""Bidirectional LSTM wearable/sensor analysis service (Mode 3).

Loads the trained SensorBiLSTM model from artifacts and runs inference
on real-time biometric inputs. Falls back to statistical scoring if
the model file is not available.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import torch
from torch import nn


@dataclass
class PhysiologicalAssessment:
    stress_index: float
    anomaly_flags: list[str]
    stress_pattern: str
    physiological_risk: str
    model_source: str


class SensorBiLSTM(nn.Module):
    """Bidirectional LSTM for temporal wearable telemetry classification."""

    def __init__(self, input_dim: int = 4, hidden_dim: int = 16, num_classes: int = 1):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=1,
            batch_first=True,
            bidirectional=True,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, num_classes),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        lstm_out, _ = self.lstm(x)
        final_state = lstm_out[:, -1, :]
        return self.head(final_state)


MODEL_PATH = Path(__file__).resolve().parents[1] / "ml" / "artifacts" / "sensor_bilstm.pt"

# Z-score baselines for statistical anomaly detection
_HRV_MEAN, _HRV_STD = 55.0, 12.0
_SLEEP_MEAN, _SLEEP_STD = 7.2, 1.0


class WearableLSTMAnalyzer:
    """Service that loads trained SensorBiLSTM and runs biometric inference."""

    def __init__(self) -> None:
        self._model: SensorBiLSTM | None = None
        self._load_model()

    def _load_model(self) -> None:
        if MODEL_PATH.exists():
            try:
                checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
                self._model = SensorBiLSTM()
                self._model.load_state_dict(checkpoint["state_dict"])
                self._model.eval()
            except Exception as e:
                print(f"SensorBiLSTM load failed: {e}")
                self._model = None

    def _statistical_anomalies(self, hr: float, hrv: float, sleep: float, steps: float) -> list[str]:
        flags = []
        hrv_z = (hrv - _HRV_MEAN) / _HRV_STD
        sleep_z = (sleep - _SLEEP_MEAN) / _SLEEP_STD

        if hrv_z < -1.5:
            flags.append(f"Suppressed HRV (Z={hrv_z:.2f})")
        if sleep_z < -1.5:
            flags.append(f"Sleep deprivation ({sleep:.1f}h)")
        if hr > 90.0 and steps < 1000.0:
            flags.append("Elevated HR during inactivity")
        if hrv < 30.0:
            flags.append("Critical parasympathetic withdrawal")
        return flags

    def _fallback_stress(self, hr: float, hrv: float, sleep: float) -> float:
        hrv_f = max(0.0, min(1.0, (65.0 - hrv) / 45.0))
        sleep_f = max(0.0, min(1.0, (7.5 - sleep) / 4.0))
        hr_f = max(0.0, min(1.0, (hr - 60.0) / 40.0))
        return (hrv_f * 0.45 + hr_f * 0.30 + sleep_f * 0.25)

    def analyze(self, heart_rate: float, hrv: float, sleep_hours: float, steps: float) -> PhysiologicalAssessment:
        anomalies = self._statistical_anomalies(heart_rate, hrv, sleep_hours, steps)

        if self._model is not None:
            features = torch.tensor([[[
                heart_rate / 120.0,
                hrv / 100.0,
                sleep_hours / 10.0,
                steps / 10000.0,
            ]]], dtype=torch.float32)
            with torch.no_grad():
                stress = float(self._model(features).item())
            source = "trained_bilstm"
        else:
            stress = self._fallback_stress(heart_rate, hrv, sleep_hours)
            source = "statistical_fallback"

        if stress >= 0.70 or len(anomalies) >= 2:
            risk = "High"
            pattern = "Sympathetic overdrive with cardiovascular and sleep depletion."
        elif stress >= 0.40 or len(anomalies) == 1:
            risk = "Medium"
            pattern = "Elevated autonomic arousal with fluctuating recovery."
        else:
            risk = "Low"
            pattern = "Stable homeostatic balance and optimal vagal recovery."

        return PhysiologicalAssessment(
            stress_index=round(stress, 4),
            anomaly_flags=anomalies,
            stress_pattern=pattern,
            physiological_risk=risk,
            model_source=source,
        )


# Singleton
wearable_lstm_analyzer = WearableLSTMAnalyzer()

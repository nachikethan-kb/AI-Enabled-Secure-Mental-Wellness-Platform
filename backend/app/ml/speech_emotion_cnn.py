"""Wav2Vec2-style speech emotion model (Mode 4B).

Architecture: A 1D convolutional encoder that processes raw audio waveform
features and classifies vocal emotional states. Inspired by Wav2Vec2's
approach of learning directly from raw audio representations.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import torch
from torch import nn
from torch.nn import functional as F


SPEECH_EMOTIONS = ["neutral", "calm", "happy", "sad", "angry", "fearful", "surprised"]


@dataclass
class SpeechPrediction:
    voice_emotion: str
    confidence: float
    voice_stress_score: float  # 0.0 to 1.0
    all_scores: dict[str, float]


class Wav2Vec2SpeechCNN(nn.Module):
    """1D-CNN speech encoder inspired by Wav2Vec2 feature extraction.

    Processes raw audio feature vectors (16kHz waveform segments) through
    temporal convolution blocks to classify speech emotion.
    """

    def __init__(self, input_features: int = 40, num_classes: int = 7):
        super().__init__()
        # Temporal convolution encoder (inspired by Wav2Vec2 feature extractor)
        self.encoder = nn.Sequential(
            # Block 1
            nn.Conv1d(input_features, 64, kernel_size=5, padding=2),
            nn.BatchNorm1d(64),
            nn.GELU(),
            nn.MaxPool1d(2),
            nn.Dropout(0.2),

            # Block 2
            nn.Conv1d(64, 128, kernel_size=5, padding=2),
            nn.BatchNorm1d(128),
            nn.GELU(),
            nn.MaxPool1d(2),
            nn.Dropout(0.2),

            # Block 3
            nn.Conv1d(128, 128, kernel_size=3, padding=1),
            nn.BatchNorm1d(128),
            nn.GELU(),
            nn.AdaptiveAvgPool1d(1),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, 64),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: [batch, features, time_steps]
        x = self.encoder(x)
        x = self.classifier(x)
        return x


# Stress contribution per emotion class
_STRESS_MAP = {"neutral": 0.05, "calm": 0.02, "happy": 0.10, "sad": 0.60, "angry": 0.75, "fearful": 0.85, "surprised": 0.40}


def save_speech_model(model: Wav2Vec2SpeechCNN, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "labels": SPEECH_EMOTIONS}, path)


def load_speech_model(path: Path) -> Wav2Vec2SpeechCNN:
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    model = Wav2Vec2SpeechCNN(num_classes=len(SPEECH_EMOTIONS))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model


def predict_speech_emotion(model: Wav2Vec2SpeechCNN, audio_features: torch.Tensor) -> SpeechPrediction:
    """Run inference on audio features tensor [1, 40, T]."""
    model.eval()
    with torch.no_grad():
        logits = model(audio_features)
        probs = F.softmax(logits, dim=-1).squeeze(0)

    scores = {label: float(probs[i]) for i, label in enumerate(SPEECH_EMOTIONS)}
    best_idx = int(torch.argmax(probs))
    dominant = SPEECH_EMOTIONS[best_idx]

    # Calculate stress from probability-weighted emotion contributions
    stress = sum(scores[e] * _STRESS_MAP[e] for e in SPEECH_EMOTIONS)

    return SpeechPrediction(
        voice_emotion=dominant,
        confidence=float(probs[best_idx]),
        voice_stress_score=round(min(1.0, stress), 4),
        all_scores=scores,
    )

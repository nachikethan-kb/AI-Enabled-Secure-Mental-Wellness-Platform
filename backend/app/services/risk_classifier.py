import os
from pathlib import Path
from dataclasses import dataclass
from math import exp
import xgboost as xgb
import numpy as np


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + exp(-value))


@dataclass
class RiskPrediction:
    probability: float
    high_risk: bool
    tier: str
    model_source: str = "fallback"


class PHQ9RiskClassifier:
    """XGBoost-based classifier for PHQ-9 answers that falls back to a calibrated sigmoid score if the model is not trained yet."""

    def __init__(self):
        self.model_path = Path(__file__).resolve().parents[1] / "ml" / "artifacts" / "xgboost_risk_model.json"
        self._model = None
        self._load_model()

    def _load_model(self):
        if self.model_path.exists():
            try:
                self._model = xgb.XGBClassifier()
                self._model.load_model(str(self.model_path))
            except Exception as e:
                print(f"Error loading XGBoost model: {e}. Using fallback.")
                self._model = None

    def predict(self, answers: list[int], total_score: int) -> RiskPrediction:
        # Proactively attempt to load the model if it wasn't loaded before
        if self._model is None and self.model_path.exists():
            self._load_model()

        if self._model is not None:
            try:
                features = np.array([answers], dtype=np.float32)
                prob = float(self._model.predict_proba(features)[0][1])
                probability = round(prob, 4)

                if probability >= 0.75 or total_score >= 20:
                    tier = "high"
                elif probability >= 0.45 or total_score >= 15:
                    tier = "medium"
                else:
                    tier = "low"

                high_risk = tier == "high" or total_score >= 15
                return RiskPrediction(probability=probability, high_risk=high_risk, tier=tier, model_source="xgboost")
            except Exception as e:
                print(f"XGBoost prediction failed: {e}. Using fallback.")

        # Fallback calibrated linear score + sigmoid
        self_harm_item = float(answers[8])
        sleep_and_energy = float(answers[2] + answers[3])
        cognition = float(answers[6])

        linear_score = (
            -4.0
            + 0.20 * float(total_score)
            + 0.85 * self_harm_item
            + 0.20 * sleep_and_energy
            + 0.18 * cognition
        )
        probability = round(_sigmoid(linear_score), 4)

        if probability >= 0.75 or total_score >= 20:
            tier = "high"
        elif probability >= 0.45 or total_score >= 15:
            tier = "medium"
        else:
            tier = "low"

        high_risk = tier == "high" or total_score >= 15
        return RiskPrediction(probability=probability, high_risk=high_risk, tier=tier, model_source="fallback")


_risk_classifier = PHQ9RiskClassifier()


def classify_assessment_risk(answers: list[int], total_score: int) -> RiskPrediction:
    return _risk_classifier.predict(answers, total_score)

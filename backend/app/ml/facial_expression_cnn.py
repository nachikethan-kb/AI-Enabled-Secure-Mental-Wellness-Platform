"""DeepFace-style CNN for facial expression recognition (Mode 4B).

Architecture: A compact convolutional neural network inspired by DeepFace,
designed for 48x48 grayscale facial expression images. Supports 7 standard
emotion classes: angry, disgust, fear, happy, sad, surprise, neutral.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import torch
from torch import nn
from torch.nn import functional as F


EXPRESSION_LABELS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]


@dataclass
class FacialPrediction:
    dominant_expression: str
    confidence: float
    all_scores: dict[str, float]
    arousal: float   # derived from expression intensity
    valence: float   # derived from expression polarity


class DeepFaceCNN(nn.Module):
    """Compact CNN inspired by DeepFace for 48x48 grayscale facial images."""

    def __init__(self, num_classes: int = 7):
        super().__init__()
        self.features = nn.Sequential(
            # Block 1: 48x48 -> 24x24
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Dropout2d(0.25),

            # Block 2: 24x24 -> 12x12
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Dropout2d(0.25),

            # Block 3: 12x12 -> 6x6
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Dropout2d(0.25),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 6 * 6, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.classifier(x)
        return x


# Valence-arousal mappings per expression (psychological dimensional model)
_VALENCE_MAP = {"angry": -0.80, "disgust": -0.60, "fear": -0.70, "happy": 0.85, "sad": -0.65, "surprise": 0.20, "neutral": 0.05}
_AROUSAL_MAP = {"angry": 0.85, "disgust": 0.45, "fear": 0.80, "happy": 0.75, "sad": 0.35, "surprise": 0.70, "neutral": 0.10}


def save_facial_model(model: DeepFaceCNN, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "labels": EXPRESSION_LABELS}, path)


def load_facial_model(path: Path) -> DeepFaceCNN:
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    model = DeepFaceCNN(num_classes=len(EXPRESSION_LABELS))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model


def predict_expression(model: DeepFaceCNN, image_tensor: torch.Tensor) -> FacialPrediction:
    """Run inference on a 48x48 grayscale image tensor [1, 1, 48, 48]."""
    model.eval()
    with torch.no_grad():
        logits = model(image_tensor)
        probs = F.softmax(logits, dim=-1).squeeze(0)

    scores = {label: float(probs[i]) for i, label in enumerate(EXPRESSION_LABELS)}
    best_idx = int(torch.argmax(probs))
    dominant = EXPRESSION_LABELS[best_idx]

    return FacialPrediction(
        dominant_expression=dominant,
        confidence=float(probs[best_idx]),
        all_scores=scores,
        arousal=_AROUSAL_MAP[dominant],
        valence=_VALENCE_MAP[dominant],
    )

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import torch
from torch import nn


@dataclass
class MentalStatePrediction:
    label: str
    confidence: float
    probabilities: dict[str, float]


class MentalStateLSTM(nn.Module):
    def __init__(self, num_labels: int, embedding_dim: int = 8, hidden_dim: int = 32):
        super().__init__()
        self.embedding = nn.Embedding(4, embedding_dim)
        self.lstm = nn.LSTM(embedding_dim, hidden_dim, batch_first=True)
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, num_labels),
        )

    def forward(self, answers: torch.Tensor) -> torch.Tensor:
        embedded = self.embedding(answers.long())
        outputs, _ = self.lstm(embedded)
        pooled = outputs[:, -1, :]
        return self.head(pooled)


def save_mental_state_model(model: MentalStateLSTM, path: Path, metadata: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "metadata": metadata}, path)


def load_mental_state_model(path: Path, device: torch.device | None = None) -> tuple[MentalStateLSTM, dict[str, object]]:
    checkpoint = torch.load(path, map_location=device or "cpu")
    metadata = checkpoint["metadata"]
    label2id = metadata["label2id"]
    model = MentalStateLSTM(num_labels=len(label2id))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model, metadata

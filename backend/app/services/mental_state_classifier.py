from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import torch
from torch.nn import functional as F

from app.ml.dataset_utils import infer_mental_state_label
from app.ml.mental_state_model import MentalStatePrediction, load_mental_state_model


ARTIFACT_PATH = Path(__file__).resolve().parents[1] / "ml" / "artifacts" / "lstm_mental_state.pt"


@lru_cache(maxsize=1)
def _load_artifact() -> tuple[object, dict[str, object]] | None:
    if not ARTIFACT_PATH.exists():
        return None
    return load_mental_state_model(ARTIFACT_PATH)


def analyze_mental_state(answers: list[int]) -> MentalStatePrediction:
    artifact = _load_artifact()
    if artifact is None:
        label = infer_mental_state_label(answers)
        fallback_confidence = 0.55 if label == "stable" else 0.72
        return MentalStatePrediction(label=label, confidence=fallback_confidence, probabilities={label: fallback_confidence})

    model, metadata = artifact
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    with torch.no_grad():
        logits = model(torch.tensor([answers], dtype=torch.long, device=device))
        probs = F.softmax(logits, dim=-1).squeeze(0).cpu().tolist()

    id2label = {int(key): value for key, value in metadata["id2label"].items()}
    best_index = max(range(len(probs)), key=lambda index: probs[index])
    probabilities = {id2label[index]: float(probability) for index, probability in enumerate(probs)}
    return MentalStatePrediction(label=id2label[best_index], confidence=float(probs[best_index]), probabilities=probabilities)
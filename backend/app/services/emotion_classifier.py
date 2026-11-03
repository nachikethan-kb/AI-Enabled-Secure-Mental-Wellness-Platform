from functools import lru_cache
from pathlib import Path

import torch
from torch.nn import functional as F
from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"
LOCAL_MODEL_DIR = Path(__file__).resolve().parents[1] / "ml" / "artifacts" / "bert_emotion_model"


@lru_cache(maxsize=1)
def get_emotion_pipeline():
    if LOCAL_MODEL_DIR.exists():
        tokenizer = AutoTokenizer.from_pretrained(LOCAL_MODEL_DIR)
        model = AutoModelForSequenceClassification.from_pretrained(LOCAL_MODEL_DIR)
        model.eval()
        return {"tokenizer": tokenizer, "model": model, "source": "local"}
    return pipeline("text-classification", model=MODEL_NAME, return_all_scores=False)


def analyze_emotion(text: str) -> tuple[str, float]:
    try:
        classifier = get_emotion_pipeline()
        if isinstance(classifier, dict):
            encoded = classifier["tokenizer"](text, truncation=True, padding=True, return_tensors="pt")
            with torch.no_grad():
                outputs = classifier["model"](**encoded)
                probabilities = F.softmax(outputs.logits, dim=-1).squeeze(0)
            best_index = int(torch.argmax(probabilities).item())
            label = str(classifier["model"].config.id2label.get(best_index, "stable")).lower()
            score = float(probabilities[best_index].item())
            return label, round(score, 4)

        result = classifier(text)[0]
        label = str(result.get("label", "neutral")).lower()
        score = float(result.get("score", 0.0))
        return label, round(score, 4)
    except Exception:
        return "neutral", 0.0
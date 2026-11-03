from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from app.ml.dataset_utils import label_lookup, load_survey_samples, split_samples
from app.ml.mental_state_model import MentalStateLSTM, save_mental_state_model


class TextEmotionDataset(Dataset):
    def __init__(self, encodings: dict[str, list[list[int]]], labels: list[int]):
        self.encodings = encodings
        self.labels = labels

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        item = {key: torch.tensor(value[index]) for key, value in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[index])
        return item


class SurveySequenceDataset(Dataset):
    def __init__(self, answers: list[list[int]], labels: list[int]):
        self.answers = answers
        self.labels = labels

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        return torch.tensor(self.answers[index], dtype=torch.long), torch.tensor(self.labels[index], dtype=torch.long)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train BERT emotion and LSTM mental-state models from the wellness dataset.")
    parser.add_argument("--dataset", type=str, default=None, help="Path to mental_wellness_dataset_u.xlsx")
    parser.add_argument("--output-dir", type=str, default=str(Path(__file__).resolve().parent / "artifacts"), help="Directory for saved models")
    parser.add_argument("--epochs", type=int, default=1, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Mini-batch size")
    parser.add_argument("--max-length", type=int, default=160, help="Tokenizer max length")
    return parser.parse_args()


def train_bert_emotion_model(samples, output_dir: Path, epochs: int, batch_size: int, max_length: int) -> dict[str, object]:
    print("  Loading tokenizer...", flush=True)
    emotion_labels, id2emotion = label_lookup(sample.emotion_label for sample in samples)
    train_samples, val_samples = split_samples(samples)

    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    print("  Tokenizing train texts...", flush=True)
    train_texts = [sample.text for sample in train_samples]
    val_texts = [sample.text for sample in val_samples]
    train_labels = [emotion_labels[sample.emotion_label] for sample in train_samples]
    val_labels = [emotion_labels[sample.emotion_label] for sample in val_samples]

    train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=max_length)
    val_encodings = tokenizer(val_texts, truncation=True, padding=True, max_length=max_length)
    print("  Creating datasets...", flush=True)

    train_dataset = TextEmotionDataset(train_encodings, train_labels)
    val_dataset = TextEmotionDataset(val_encodings, val_labels)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    print("  Loading DistilBERT model...", flush=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        "distilbert-base-uncased",
        num_labels=len(emotion_labels),
        id2label=id2emotion,
        label2id=emotion_labels,
    )
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Using device: {device}", flush=True)
    model.to(device)

    for epoch in range(epochs):
        print(f"  Epoch {epoch+1}/{epochs}...", flush=True)
        model.train()
        for batch_idx, batch in enumerate(train_loader):
            batch = {key: value.to(device) for key, value in batch.items()}
            optimizer.zero_grad()
            loss = model(**batch).loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            if (batch_idx + 1) % 10 == 0:
                print(f"    Batch {batch_idx+1}/{len(train_loader)}", flush=True)

        model.eval()
        with torch.no_grad():
            for batch in val_loader:
                batch = {key: value.to(device) for key, value in batch.items()}
                _ = model(**batch)

    print("  Saving BERT model...", flush=True)
    emotion_dir = output_dir / "bert_emotion_model"
    emotion_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(emotion_dir)
    tokenizer.save_pretrained(emotion_dir)
    metadata = {
        "task": "emotion_detection",
        "model": "distilbert-base-uncased",
        "dataset": "mental_wellness_dataset_u.xlsx",
        "labels": emotion_labels,
        "max_length": max_length,
        "samples": len(samples),
    }
    (emotion_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"  BERT model saved to {emotion_dir}", flush=True)
    return metadata


def train_lstm_mental_state_model(samples, output_dir: Path, epochs: int, batch_size: int) -> dict[str, object]:
    print("  Creating label mappings...", flush=True)
    mental_labels, id2mental = label_lookup(sample.mental_state_label for sample in samples)
    train_samples, val_samples = split_samples(samples)

    print("  Creating datasets...", flush=True)
    train_dataset = SurveySequenceDataset([sample.answers for sample in train_samples], [mental_labels[sample.mental_state_label] for sample in train_samples])
    val_dataset = SurveySequenceDataset([sample.answers for sample in val_samples], [mental_labels[sample.mental_state_label] for sample in val_samples])
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Creating LSTM model with {len(mental_labels)} classes...", flush=True)
    model = MentalStateLSTM(num_labels=len(mental_labels)).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        print(f"  Epoch {epoch+1}/{epochs}...", flush=True)
        model.train()
        for batch_idx, (answers, labels) in enumerate(train_loader):
            answers = answers.to(device)
            labels = labels.to(device)
            optimizer.zero_grad()
            logits = model(answers)
            loss = criterion(logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            if (batch_idx + 1) % 10 == 0:
                print(f"    Batch {batch_idx+1}/{len(train_loader)}", flush=True)

        model.eval()
        with torch.no_grad():
            for answers, labels in val_loader:
                _ = model(answers.to(device))

    print("  Saving LSTM model...", flush=True)
    state_path = output_dir / "lstm_mental_state.pt"
    metadata = {
        "task": "mental_state_analysis",
        "dataset": "mental_wellness_dataset_u.xlsx",
        "label2id": mental_labels,
        "id2label": id2mental,
        "sequence_length": 9,
        "samples": len(samples),
    }
    save_mental_state_model(model.cpu(), state_path, metadata)
    (output_dir / "lstm_mental_state_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"  LSTM model saved to {state_path}", flush=True)
    return metadata


def train_xgboost_risk_model(samples, output_dir: Path) -> dict[str, object]:
    import xgboost as xgb
    import numpy as np
    from sklearn.model_selection import train_test_split

    print("  Preparing dataset for XGBoost...", flush=True)
    X = np.array([sample.answers for sample in samples], dtype=np.float32)
    # Target label: 1 if high risk, 0 otherwise
    # Clinical standard for high risk: total score >= 15 or self-harm thoughts >= 1
    y = np.array([1 if (sum(sample.answers) >= 15 or sample.answers[8] >= 1) else 0 for sample in samples], dtype=np.int32)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"  Training XGBoost Classifier on {len(X_train)} samples...", flush=True)
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.08,
        eval_metric="logloss",
        random_state=42
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

    print("  Saving XGBoost model...", flush=True)
    model_path = output_dir / "xgboost_risk_model.json"
    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(model_path))

    # Evaluate on validation split
    val_preds = model.predict(X_val)
    accuracy = float(np.mean(val_preds == y_val))
    print(f"  XGBoost Validation Accuracy: {accuracy:.4f}", flush=True)

    metadata = {
        "task": "risk_classification",
        "model": "xgboost_classifier",
        "dataset": "mental_wellness_dataset_u.xlsx",
        "validation_accuracy": accuracy,
        "samples": len(samples),
    }
    (output_dir / "xgboost_risk_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    print("Starting training pipeline...", flush=True)
    args = parse_args()
    print(f"Dataset: {args.dataset}", flush=True)
    print(f"Output dir: {args.output_dir}", flush=True)
    
    output_dir = Path(args.output_dir)
    print("Loading survey samples...", flush=True)
    samples = load_survey_samples(args.dataset)
    print(f"Loaded {len(samples)} samples", flush=True)

    print("Training BERT emotion model...", flush=True)
    emotion_metadata = train_bert_emotion_model(samples, output_dir, args.epochs, args.batch_size, args.max_length)
    print("BERT training complete!", flush=True)
    
    print("Training LSTM mental-state model...", flush=True)
    mental_metadata = train_lstm_mental_state_model(samples, output_dir, args.epochs, args.batch_size)
    print("LSTM training complete!", flush=True)

    print("Training XGBoost risk classification model...", flush=True)
    xgboost_metadata = train_xgboost_risk_model(samples, output_dir)
    print("XGBoost training complete!", flush=True)

    summary = {
        "emotion": emotion_metadata,
        "mental_state": mental_metadata,
        "risk_classification": xgboost_metadata
    }
    (output_dir / "training_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

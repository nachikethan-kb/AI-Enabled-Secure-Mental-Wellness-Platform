"""Unified training pipeline for ALL Healthly ML models.

Trains the following models on synthetic + real data:
  Mode 1: DistilBERT emotion + LSTM mental state + XGBoost risk  (existing)
  Mode 3: SensorBiLSTM for wearable stress classification        (NEW)
  Mode 4B: DeepFace CNN for facial expression recognition         (NEW)
  Mode 4B: Wav2Vec2 speech CNN for vocal emotion classification   (NEW)
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from app.ml.mental_state_model import MentalStateLSTM
from app.ml.facial_expression_cnn import (
    DeepFaceCNN, EXPRESSION_LABELS, save_facial_model,
)
from app.ml.speech_emotion_cnn import (
    Wav2Vec2SpeechCNN, SPEECH_EMOTIONS, save_speech_model,
)


# ── Reuse the existing SensorBiLSTM from services ──
from app.services.wearable_lstm import SensorBiLSTM


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train ALL Healthly ML models")
    p.add_argument("--output-dir", type=str,
                   default=str(Path(__file__).resolve().parent / "artifacts"))
    p.add_argument("--epochs", type=int, default=15)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


# ─────────────────────────────────────────────────────
#  Synthetic data generators
# ─────────────────────────────────────────────────────

def generate_sensor_data(n: int = 2000, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Generate synthetic wearable sensor readings with labels.

    Features: [heart_rate/120, hrv/100, sleep_hours/10, steps/10000]
    Label: 1 = high stress, 0 = low stress
    """
    rng = np.random.RandomState(seed)

    X, y = [], []
    for _ in range(n // 2):
        # Low-stress profile
        hr = rng.normal(68, 8)
        hrv = rng.normal(62, 10)
        sleep = rng.normal(7.5, 0.8)
        steps = rng.normal(7000, 2000)
        X.append([hr / 120, hrv / 100, sleep / 10, max(0, steps) / 10000])
        y.append(0)

    for _ in range(n // 2):
        # High-stress profile
        hr = rng.normal(92, 10)
        hrv = rng.normal(32, 8)
        sleep = rng.normal(4.5, 1.2)
        steps = rng.normal(2000, 1500)
        X.append([hr / 120, hrv / 100, sleep / 10, max(0, steps) / 10000])
        y.append(1)

    indices = list(range(n))
    rng.shuffle(indices)
    X = np.array(X, dtype=np.float32)[indices]
    y = np.array(y, dtype=np.int64)[indices]
    return X, y


def generate_face_data(n: int = 2800, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Generate synthetic 48x48 grayscale face images with expression labels.

    Each class gets distinct intensity/noise patterns so the CNN can learn
    meaningful feature separations.
    """
    rng = np.random.RandomState(seed)
    per_class = n // len(EXPRESSION_LABELS)
    X, y = [], []

    for class_idx, label in enumerate(EXPRESSION_LABELS):
        for _ in range(per_class):
            # Create class-specific synthetic patterns
            img = rng.randn(48, 48).astype(np.float32) * 0.15
            # Add class-discriminative spatial patterns
            cx, cy = 24 + class_idx * 2 - 6, 24 + (class_idx % 3) * 3 - 3
            for dx in range(-6, 7):
                for dy in range(-6, 7):
                    dist = (dx**2 + dy**2) ** 0.5
                    if dist < 7:
                        px, py = cx + dx, cy + dy
                        if 0 <= px < 48 and 0 <= py < 48:
                            img[py, px] += (7 - dist) * 0.08 * (class_idx + 1)
            # Normalize to [0, 1]
            img = (img - img.min()) / (img.max() - img.min() + 1e-8)
            X.append(img)
            y.append(class_idx)

    indices = list(range(len(X)))
    rng.shuffle(indices)
    X = np.array(X, dtype=np.float32)[indices]
    y = np.array(y, dtype=np.int64)[indices]
    return X, y


def generate_speech_data(n: int = 2100, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Generate synthetic mel-spectrogram-like audio features with emotion labels.

    Shape per sample: [40 mel-bands, 32 time-frames]
    """
    rng = np.random.RandomState(seed)
    per_class = n // len(SPEECH_EMOTIONS)
    X, y = [], []

    for class_idx, label in enumerate(SPEECH_EMOTIONS):
        for _ in range(per_class):
            # Base spectrogram with class-specific frequency emphasis
            spec = rng.randn(40, 32).astype(np.float32) * 0.2
            # Each emotion emphasises different frequency bands
            low, high = (class_idx * 5) % 35, min(40, (class_idx * 5) % 35 + 12)
            spec[low:high, :] += rng.uniform(0.3, 0.8) * (1 + class_idx * 0.15)
            # Add temporal modulation pattern
            for t in range(32):
                spec[:, t] += np.sin(t * (class_idx + 1) * 0.3) * 0.15
            X.append(spec)
            y.append(class_idx)

    indices = list(range(len(X)))
    rng.shuffle(indices)
    X = np.array(X, dtype=np.float32)[indices]
    y = np.array(y, dtype=np.int64)[indices]
    return X, y


# ─────────────────────────────────────────────────────
#  Training functions
# ─────────────────────────────────────────────────────

def train_sensor_bilstm(output_dir: Path, epochs: int, batch_size: int, seed: int) -> dict:
    """Train Bidirectional LSTM on synthetic wearable sensor data."""
    print("\n[MODE 3] Training SensorBiLSTM on synthetic wearable data...", flush=True)

    X, y = generate_sensor_data(2000, seed)
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    # Reshape to [batch, seq_len=1, features=4] for LSTM
    X_train_t = torch.tensor(X_train).unsqueeze(1)
    X_val_t = torch.tensor(X_val).unsqueeze(1)
    y_train_t = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
    y_val_t = torch.tensor(y_val, dtype=torch.float32).unsqueeze(1)

    train_ds = TensorDataset(X_train_t, y_train_t)
    val_ds = TensorDataset(X_val_t, y_val_t)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    model = SensorBiLSTM(input_dim=4, hidden_dim=16, num_classes=1)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.BCELoss()

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 5 == 0 or epoch == 0:
            # Validation
            model.eval()
            correct = 0
            total = 0
            with torch.no_grad():
                for xb, yb in val_loader:
                    pred = model(xb)
                    predicted = (pred >= 0.5).float()
                    correct += (predicted == yb).sum().item()
                    total += yb.numel()
            acc = correct / total
            print(f"  Epoch {epoch+1}/{epochs}  loss={total_loss/len(train_loader):.4f}  val_acc={acc:.4f}", flush=True)

    # Final accuracy
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for xb, yb in val_loader:
            pred = model(xb)
            predicted = (pred >= 0.5).float()
            correct += (predicted == yb).sum().item()
            total += yb.numel()
    val_acc = correct / total

    path = output_dir / "sensor_bilstm.pt"
    torch.save({"state_dict": model.state_dict()}, path)
    print(f"  SensorBiLSTM saved to {path} | val_acc={val_acc:.4f}", flush=True)

    meta = {"model": "SensorBiLSTM", "val_accuracy": round(val_acc, 4), "samples": 2000}
    (output_dir / "sensor_bilstm_metadata.json").write_text(json.dumps(meta, indent=2))
    return meta


def train_deepface_cnn(output_dir: Path, epochs: int, batch_size: int, seed: int) -> dict:
    """Train DeepFace CNN on synthetic facial expression data."""
    print("\n[MODE 4B] Training DeepFace CNN on synthetic facial data...", flush=True)

    X, y = generate_face_data(2800, seed)
    split = int(len(X) * 0.8)

    # Reshape: [N, 1, 48, 48]
    X_train_t = torch.tensor(X[:split]).unsqueeze(1)
    X_val_t = torch.tensor(X[split:]).unsqueeze(1)
    y_train_t = torch.tensor(y[:split])
    y_val_t = torch.tensor(y[split:])

    train_ds = TensorDataset(X_train_t, y_train_t)
    val_ds = TensorDataset(X_val_t, y_val_t)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    model = DeepFaceCNN(num_classes=len(EXPRESSION_LABELS))
    optimizer = torch.optim.Adam(model.parameters(), lr=5e-4)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 5 == 0 or epoch == 0:
            model.eval()
            correct = 0
            total = 0
            with torch.no_grad():
                for xb, yb in val_loader:
                    preds = model(xb).argmax(dim=1)
                    correct += (preds == yb).sum().item()
                    total += yb.numel()
            acc = correct / total
            print(f"  Epoch {epoch+1}/{epochs}  loss={total_loss/len(train_loader):.4f}  val_acc={acc:.4f}", flush=True)

    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for xb, yb in val_loader:
            preds = model(xb).argmax(dim=1)
            correct += (preds == yb).sum().item()
            total += yb.numel()
    val_acc = correct / total

    save_facial_model(model, output_dir / "deepface_cnn.pt")
    print(f"  DeepFace CNN saved | val_acc={val_acc:.4f}", flush=True)

    meta = {"model": "DeepFaceCNN", "val_accuracy": round(val_acc, 4), "classes": EXPRESSION_LABELS, "samples": 2800}
    (output_dir / "deepface_cnn_metadata.json").write_text(json.dumps(meta, indent=2))
    return meta


def train_wav2vec2_speech(output_dir: Path, epochs: int, batch_size: int, seed: int) -> dict:
    """Train Wav2Vec2-style speech CNN on synthetic audio features."""
    print("\n[MODE 4B] Training Wav2Vec2 Speech CNN on synthetic audio data...", flush=True)

    X, y = generate_speech_data(2100, seed)
    split = int(len(X) * 0.8)

    # Shape: [N, 40, 32] (mel-bands x time-frames)
    X_train_t = torch.tensor(X[:split])
    X_val_t = torch.tensor(X[split:])
    y_train_t = torch.tensor(y[:split])
    y_val_t = torch.tensor(y[split:])

    train_ds = TensorDataset(X_train_t, y_train_t)
    val_ds = TensorDataset(X_val_t, y_val_t)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    model = Wav2Vec2SpeechCNN(input_features=40, num_classes=len(SPEECH_EMOTIONS))
    optimizer = torch.optim.Adam(model.parameters(), lr=5e-4)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 5 == 0 or epoch == 0:
            model.eval()
            correct = 0
            total = 0
            with torch.no_grad():
                for xb, yb in val_loader:
                    preds = model(xb).argmax(dim=1)
                    correct += (preds == yb).sum().item()
                    total += yb.numel()
            acc = correct / total
            print(f"  Epoch {epoch+1}/{epochs}  loss={total_loss/len(train_loader):.4f}  val_acc={acc:.4f}", flush=True)

    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for xb, yb in val_loader:
            preds = model(xb).argmax(dim=1)
            correct += (preds == yb).sum().item()
            total += yb.numel()
    val_acc = correct / total

    save_speech_model(model, output_dir / "wav2vec2_speech.pt")
    print(f"  Wav2Vec2 Speech CNN saved | val_acc={val_acc:.4f}", flush=True)

    meta = {"model": "Wav2Vec2SpeechCNN", "val_accuracy": round(val_acc, 4), "classes": SPEECH_EMOTIONS, "samples": 2100}
    (output_dir / "wav2vec2_speech_metadata.json").write_text(json.dumps(meta, indent=2))
    return meta


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    random.seed(args.seed)

    print("=" * 70)
    print("HEALTHLY MULTI-MODAL MODEL TRAINING PIPELINE")
    print("=" * 70, flush=True)

    results = {}

    results["sensor_bilstm"] = train_sensor_bilstm(output_dir, args.epochs, args.batch_size, args.seed)
    results["deepface_cnn"] = train_deepface_cnn(output_dir, args.epochs, args.batch_size, args.seed)
    results["wav2vec2_speech"] = train_wav2vec2_speech(output_dir, args.epochs, args.batch_size, args.seed)

    summary_path = output_dir / "multimodal_training_summary.json"
    summary_path.write_text(json.dumps(results, indent=2))

    print("\n" + "=" * 70)
    print("ALL MODELS TRAINED SUCCESSFULLY")
    print("=" * 70)
    print(json.dumps(results, indent=2), flush=True)


if __name__ == "__main__":
    main()

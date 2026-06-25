"""train_classifier.py v2 — Context-aware fine-tuning with GPU optimisation.

Key improvements over v1:
- Accepts context-window input: [USER] ... [AI_PREV] ... [AI_CURRENT] ...
- MAX_LENGTH increased to 512 to fit full turns
- Weighted BCEWithLogitsLoss to handle class imbalance in real data
- Evaluates macro-F1 (not just loss) and saves best-F1 checkpoint
- Mixed-precision training (fp16) for RTX GPU speed
- Reports per-label precision, recall, F1 after training
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import classification_report, f1_score  # type: ignore
from sklearn.model_selection import train_test_split  # type: ignore
from torch.cuda.amp import GradScaler, autocast  # type: ignore
from torch.utils.data import DataLoader, Dataset
from transformers import (  # type: ignore
    AutoModelForSequenceClassification,
    AutoTokenizer,
    get_linear_schedule_with_warmup,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

LABELS = [
    "topic_hijacking",
    "opinion_injection",
    "false_urgency",
    "concern_dismissal",
    "agenda_persistence",
    "competitor_bashing",
]
NUM_LABELS = len(LABELS)

BASE_MODEL = "distilbert-base-uncased"
MAX_LENGTH = 512          # full context window fits in 512 tokens
BATCH_SIZE = 16           # reduced for 512-token inputs on 6GB VRAM
LEARNING_RATE = 2e-5
NUM_EPOCHS = 8
EARLY_STOPPING_PATIENCE = 3
WARMUP_RATIO = 0.1
FLAG_THRESHOLD = 0.5

DEFAULT_DATA_PATH = "training_data_hf.jsonl"
DEFAULT_OUTPUT_DIR = "models/manipulation_classifier"


# ─────────────────────────────────────────────────────────────────────────────
# Dataset
# ─────────────────────────────────────────────────────────────────────────────

class ManipulationDataset(Dataset):  # type: ignore[type-arg]
    def __init__(
        self,
        texts: list[str],
        labels: list[list[int]],
        tokenizer: Any,
        max_length: int = MAX_LENGTH,
    ) -> None:
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        encoding = self.tokenizer(
            self.texts[idx],
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": torch.tensor(self.labels[idx], dtype=torch.float),
        }


# ─────────────────────────────────────────────────────────────────────────────
# Data loading
# ─────────────────────────────────────────────────────────────────────────────

def load_data(path: str) -> tuple[list[str], list[list[int]]]:
    texts: list[str] = []
    labels: list[list[int]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            texts.append(obj["text"])
            labels.append(obj["labels"])
    logger.info("Loaded %d examples from %s.", len(texts), path)
    return texts, labels


def compute_pos_weights(labels: list[list[int]], device: torch.device) -> torch.Tensor:
    """Compute per-label positive weights for BCEWithLogitsLoss.
    
    Weight = (neg_count / pos_count) for each label.
    This makes rare positive labels contribute more to the loss.
    """
    arr = np.array(labels, dtype=np.float32)
    pos = arr.sum(axis=0)
    neg = len(arr) - pos
    # Clip to avoid division by zero; cap at 50x to avoid instability
    weights = np.clip(neg / np.maximum(pos, 1), 1.0, 50.0)
    logger.info("Positive label weights: %s", dict(zip(LABELS, weights.round(2).tolist())))
    return torch.tensor(weights, dtype=torch.float32).to(device)


# ─────────────────────────────────────────────────────────────────────────────
# Evaluation
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_f1(
    model: Any,
    loader: DataLoader,  # type: ignore[type-arg]
    device: torch.device,
    threshold: float = FLAG_THRESHOLD,
) -> tuple[float, str]:
    """Returns (macro_f1, classification_report_string)."""
    model.eval()
    all_preds: list[list[int]] = []
    all_labels: list[list[int]] = []

    with torch.no_grad():
        for batch in loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels_batch = batch["labels"]

            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            probs = torch.sigmoid(outputs.logits).cpu().numpy()
            preds = (probs >= threshold).astype(int)

            all_preds.extend(preds.tolist())
            all_labels.extend(labels_batch.numpy().astype(int).tolist())

    all_preds_np = np.array(all_preds)
    all_labels_np = np.array(all_labels)

    macro_f1 = float(f1_score(all_labels_np, all_preds_np, average="macro", zero_division=0))
    report = classification_report(
        all_labels_np, all_preds_np,
        target_names=LABELS,
        zero_division=0,
    )
    return macro_f1, report


# ─────────────────────────────────────────────────────────────────────────────
# Training
# ─────────────────────────────────────────────────────────────────────────────

def train(
    data_path: str = DEFAULT_DATA_PATH,
    output_dir: str = DEFAULT_OUTPUT_DIR,
    epochs: int = NUM_EPOCHS,
    batch_size: int = BATCH_SIZE,
    lr: float = LEARNING_RATE,
    patience: int = EARLY_STOPPING_PATIENCE,
) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_amp = device.type == "cuda"
    logger.info("Device: %s  |  Mixed-precision: %s", device, use_amp)

    if device.type == "cuda":
        logger.info(
            "GPU: %s  |  VRAM: %.1f GB",
            torch.cuda.get_device_name(0),
            torch.cuda.get_device_properties(0).total_memory / 1e9,
        )

    # Load data
    texts, labels = load_data(data_path)

    # Train / val / test split: 70 / 15 / 15
    train_texts, temp_texts, train_labels, temp_labels = train_test_split(
        texts, labels, test_size=0.30, random_state=42, shuffle=True
    )
    val_texts, test_texts, val_labels, test_labels = train_test_split(
        temp_texts, temp_labels, test_size=0.50, random_state=42
    )
    logger.info(
        "Split → train=%d  val=%d  test=%d",
        len(train_texts), len(val_texts), len(test_texts),
    )

    # Compute pos_weights from training set only
    pos_weights = compute_pos_weights(train_labels, device)

    # Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    # Datasets & loaders
    train_ds = ManipulationDataset(train_texts, train_labels, tokenizer)
    val_ds   = ManipulationDataset(val_texts,   val_labels,   tokenizer)
    test_ds  = ManipulationDataset(test_texts,  test_labels,  tokenizer)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True,  num_workers=0, pin_memory=use_amp)
    val_loader   = DataLoader(val_ds,   batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=use_amp)
    test_loader  = DataLoader(test_ds,  batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=use_amp)

    # Model
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=NUM_LABELS,
        problem_type="multi_label_classification",
    )
    model.to(device)

    # Optimizer & scheduler
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    total_steps = len(train_loader) * epochs
    warmup_steps = int(total_steps * WARMUP_RATIO)
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=warmup_steps,
        num_training_steps=total_steps,
    )

    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weights)
    scaler = GradScaler() if use_amp else None

    # Training loop
    best_val_f1 = 0.0
    epochs_no_improve = 0

    for epoch in range(epochs):
        model.train()
        total_train_loss = 0.0

        for step, batch in enumerate(train_loader):
            input_ids     = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels_batch  = batch["labels"].to(device)

            optimizer.zero_grad()

            if use_amp and scaler is not None:
                with autocast():
                    outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                    loss = criterion(outputs.logits, labels_batch)
                scaler.scale(loss).backward()
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
            else:
                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                loss = criterion(outputs.logits, labels_batch)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()

            scheduler.step()
            total_train_loss += loss.item()

            if (step + 1) % 50 == 0:
                logger.info(
                    "  Epoch %d  step %d/%d  loss=%.4f",
                    epoch + 1, step + 1, len(train_loader),
                    total_train_loss / (step + 1),
                )

        avg_train_loss = total_train_loss / len(train_loader)

        # Validate
        val_f1, val_report = evaluate_f1(model, val_loader, device)

        logger.info(
            "Epoch %d/%d  train_loss=%.4f  val_macro_f1=%.4f",
            epoch + 1, epochs, avg_train_loss, val_f1,
        )

        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            epochs_no_improve = 0
            _save_model(model, tokenizer, output_dir)
            logger.info("  ✓ Best model saved (val_macro_f1=%.4f)", val_f1)
            logger.info("  Val report:\n%s", val_report)
        else:
            epochs_no_improve += 1
            logger.info("  No improvement (%d/%d)", epochs_no_improve, patience)
            if epochs_no_improve >= patience:
                logger.info("Early stopping at epoch %d.", epoch + 1)
                break

    # Final test evaluation
    logger.info("=== Final evaluation on test set ===")
    test_f1, test_report = evaluate_f1(model, test_loader, device)
    logger.info("Test macro-F1: %.4f", test_f1)
    print(f"\n{'='*60}")
    print(f"Test Macro-F1: {test_f1:.4f}")
    print(f"{'='*60}")
    print(test_report)

    logger.info("Training complete. Best val_macro_f1=%.4f. Model saved to %s.", best_val_f1, output_dir)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _save_model(model: Any, tokenizer: Any, output_dir: str) -> None:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(out))
    tokenizer.save_pretrained(str(out))


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("training.log", mode="w"),
        ],
    )
    data = DEFAULT_DATA_PATH
    out = DEFAULT_OUTPUT_DIR
    if len(sys.argv) > 1:
        data = sys.argv[1]
    if len(sys.argv) > 2:
        out = sys.argv[2]
    train(data_path=data, output_dir=out)

"""ChainAnomalyDetector — LSTM autoencoder for tamper detection.

Monitors audit chains (hash chains) for anomalies by learning the
normal pattern of chain records and flagging deviations using
reconstruction error.

Features per record:
    1. hash_valid         — SHA-256 hash matches content (0/1)
    2. prev_hash_matches  — previous hash pointer is correct (0/1)
    3. timestamp_delta    — seconds since previous record (normalised)
    4. sequence_gap       — expected vs actual sequence number gap
    5. hash_entropy       — Shannon entropy of the hash string
    6. record_size_delta  — relative change in payload size

Anomaly threshold: mean reconstruction error + 3 × std (on training set).
"""

from __future__ import annotations

import hashlib
import logging
import math
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Optional

import numpy as np
import torch
import torch.nn as nn

from src.types import ChainRecord, TamperResult

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Feature extraction
# ──────────────────────────────────────────────────────────────

_FEATURE_NAMES: list[str] = [
    "hash_valid",
    "prev_hash_matches",
    "timestamp_delta",
    "sequence_gap",
    "hash_entropy",
    "record_size_delta",
]

NUM_FEATURES = len(_FEATURE_NAMES)


def _shannon_entropy(s: str) -> float:
    """Compute Shannon entropy of a string in bits."""
    if not s:
        return 0.0
    freq: dict[str, int] = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    length = len(s)
    entropy = 0.0
    for count in freq.values():
        p = count / length
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


def extract_features(
    record: ChainRecord,
    prev_record: Optional[ChainRecord],
    expected_hash: Optional[str] = None,
) -> dict[str, float]:
    """Extract the 6-dimensional feature vector for a chain record.

    Args:
        record: Current chain record.
        prev_record: Previous chain record (or ``None`` for the first).
        expected_hash: Pre-computed expected hash of the record payload,
                       if available.  Otherwise assumed valid (1.0).

    Returns:
        Dict mapping feature names to float values.
    """
    features: dict[str, float] = {}

    # 1. hash_valid — does the record's hash look valid?
    if expected_hash is not None:
        features["hash_valid"] = 1.0 if record.record_hash == expected_hash else 0.0
    else:
        # Heuristic: a valid SHA-256 hex string is 64 chars of hex
        is_hex = all(c in "0123456789abcdef" for c in record.record_hash.lower())
        features["hash_valid"] = 1.0 if (len(record.record_hash) == 64 and is_hex) else 0.0

    # 2. prev_hash_matches
    if prev_record is not None:
        features["prev_hash_matches"] = 1.0 if record.previous_hash == prev_record.record_hash else 0.0
    else:
        # Genesis record — previous hash is typically all zeros or empty
        features["prev_hash_matches"] = 1.0 if record.previous_hash in ("", "0" * 64) else 0.0

    # 3. timestamp_delta (seconds, normalised by 3600)
    if prev_record is not None:
        delta_s = (record.timestamp - prev_record.timestamp).total_seconds()
        features["timestamp_delta"] = max(delta_s, 0.0) / 3600.0
    else:
        features["timestamp_delta"] = 0.0

    # 4. sequence_gap
    if prev_record is not None:
        gap = record.sequence_number - prev_record.sequence_number
        features["sequence_gap"] = float(gap)
    else:
        features["sequence_gap"] = 0.0

    # 5. hash_entropy (normalised by max SHA-256 entropy ≈ 4.0 bits for hex)
    features["hash_entropy"] = _shannon_entropy(record.record_hash) / 4.0

    # 6. record_size_delta
    if prev_record is not None and prev_record.payload_size > 0:
        features["record_size_delta"] = (
            (record.payload_size - prev_record.payload_size) / prev_record.payload_size
        )
    else:
        features["record_size_delta"] = 0.0

    return features


# ──────────────────────────────────────────────────────────────
# LSTM Autoencoder
# ──────────────────────────────────────────────────────────────

class _LSTMAutoencoder(nn.Module):
    """Sequence-to-sequence LSTM autoencoder for anomaly detection."""

    def __init__(
        self,
        input_dim: int = NUM_FEATURES,
        hidden_dim: int = 32,
        num_layers: int = 2,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.encoder = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.decoder = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.output_layer = nn.Linear(hidden_dim, input_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Args:
            x: (batch, seq_len, input_dim)

        Returns:
            Reconstructed x of the same shape.
        """
        # Encode
        enc_out, (h_n, c_n) = self.encoder(x)

        # Use last encoder hidden state as decoder initial state
        # Repeat the last encoding as decoder input
        seq_len = x.size(1)
        decoder_input = enc_out[:, -1:, :].repeat(1, seq_len, 1)

        dec_out, _ = self.decoder(decoder_input, (h_n, c_n))
        reconstruction = self.output_layer(dec_out)
        return reconstruction


# ──────────────────────────────────────────────────────────────
# ChainAnomalyDetector
# ──────────────────────────────────────────────────────────────

@dataclass
class _TrainingStats:
    """Statistics from training for threshold computation."""
    mean_error: float = 0.0
    std_error: float = 0.0
    threshold: float = float("inf")


class ChainAnomalyDetector:
    """Detects tampered audit chain records using an LSTM autoencoder.

    Workflow:
        1. ``train()`` on a set of known-good chain records.
        2. ``detect()`` on new records to check for anomalies.
        3. ``continuous_monitor()`` starts a background thread that
           polls every ``interval_seconds`` (default 300 = 5 min).
    """

    def __init__(
        self,
        hidden_dim: int = 32,
        num_layers: int = 2,
        seq_length: int = 10,
        learning_rate: float = 1e-3,
        epochs: int = 50,
        device: Optional[str] = None,
    ) -> None:
        self._hidden_dim = hidden_dim
        self._num_layers = num_layers
        self._seq_length = seq_length
        self._lr = learning_rate
        self._epochs = epochs
        self._device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))

        self._model = _LSTMAutoencoder(
            input_dim=NUM_FEATURES,
            hidden_dim=hidden_dim,
            num_layers=num_layers,
        ).to(self._device)

        self._stats = _TrainingStats()
        self._is_trained = False
        self._monitor_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        logger.info(
            "ChainAnomalyDetector initialised (hidden=%d, layers=%d, seq=%d, device=%s).",
            hidden_dim, num_layers, seq_length, self._device,
        )

    # ── Training ───────────────────────────────────────────────

    def train(self, chain_records: list[ChainRecord]) -> _TrainingStats:
        """Train the autoencoder on known-good chain records.

        Args:
            chain_records: Ordered list of legitimate chain records.

        Returns:
            Training statistics including the anomaly threshold.
        """
        if len(chain_records) < self._seq_length + 1:
            logger.warning(
                "Not enough records to train (%d < %d). Skipping.",
                len(chain_records), self._seq_length + 1,
            )
            return self._stats

        # Extract feature sequences
        sequences = self._records_to_sequences(chain_records)
        if len(sequences) == 0:
            logger.warning("No valid sequences extracted. Skipping training.")
            return self._stats

        dataset = torch.tensor(np.array(sequences), dtype=torch.float32).to(self._device)

        # Train
        self._model.train()
        optimizer = torch.optim.Adam(self._model.parameters(), lr=self._lr)
        criterion = nn.MSELoss()

        for epoch in range(self._epochs):
            optimizer.zero_grad()
            reconstruction = self._model(dataset)
            loss = criterion(reconstruction, dataset)
            loss.backward()
            optimizer.step()

            if (epoch + 1) % 10 == 0:
                logger.debug("Epoch %d/%d  loss=%.6f", epoch + 1, self._epochs, loss.item())

        # Compute threshold on training data
        self._model.eval()
        with torch.no_grad():
            reconstruction = self._model(dataset)
            errors = torch.mean((reconstruction - dataset) ** 2, dim=(1, 2)).cpu().numpy()

        self._stats.mean_error = float(np.mean(errors))
        self._stats.std_error = float(np.std(errors))
        self._stats.threshold = self._stats.mean_error + 3.0 * self._stats.std_error
        self._is_trained = True

        logger.info(
            "Training complete. mean_error=%.6f  std=%.6f  threshold=%.6f",
            self._stats.mean_error, self._stats.std_error, self._stats.threshold,
        )
        return self._stats

    # ── Detection ──────────────────────────────────────────────

    def detect(self, chain_records: list[ChainRecord]) -> list[TamperResult]:
        """Check a sequence of chain records for anomalies.

        Args:
            chain_records: Ordered list of chain records to inspect.

        Returns:
            One ``TamperResult`` per sliding-window position.
        """
        if not self._is_trained:
            logger.warning("Detector not trained. Returning empty results.")
            return []

        sequences = self._records_to_sequences(chain_records)
        if not sequences:
            return []

        dataset = torch.tensor(np.array(sequences), dtype=torch.float32).to(self._device)

        self._model.eval()
        results: list[TamperResult] = []
        with torch.no_grad():
            reconstruction = self._model(dataset)
            errors = torch.mean((reconstruction - dataset) ** 2, dim=(1, 2)).cpu().numpy()

        for i, (error_val, seq) in enumerate(zip(errors, sequences)):
            error_float = float(error_val)
            # Build feature dict from the last record in the window
            last_features = {
                name: float(seq[-1][j]) for j, name in enumerate(_FEATURE_NAMES)
            }
            results.append(TamperResult(
                anomaly_detected=error_float > self._stats.threshold,
                reconstruction_error=round(error_float, 6),
                threshold=round(self._stats.threshold, 6),
                features=last_features,
            ))

        anomaly_count = sum(1 for r in results if r.anomaly_detected)
        if anomaly_count > 0:
            logger.warning(
                "Detected %d anomalies in %d windows.", anomaly_count, len(results)
            )

        return results

    # ── Continuous monitoring ──────────────────────────────────

    def continuous_monitor(
        self,
        fetch_records: Callable[[], list[ChainRecord]],
        on_anomaly: Callable[[list[TamperResult]], None],
        interval_seconds: int = 300,
    ) -> None:
        """Start a background monitoring thread.

        Args:
            fetch_records: Callable that returns the latest chain records.
            on_anomaly: Callback invoked with anomalous results.
            interval_seconds: Polling interval (default 5 minutes).
        """
        if self._monitor_thread is not None and self._monitor_thread.is_alive():
            logger.warning("Monitor already running.")
            return

        self._stop_event.clear()

        def _monitor_loop() -> None:
            logger.info("Tamper monitor started (interval=%ds).", interval_seconds)
            while not self._stop_event.is_set():
                try:
                    records = fetch_records()
                    if records:
                        results = self.detect(records)
                        anomalies = [r for r in results if r.anomaly_detected]
                        if anomalies:
                            on_anomaly(anomalies)
                except Exception:
                    logger.exception("Error in tamper monitor cycle.")
                self._stop_event.wait(interval_seconds)
            logger.info("Tamper monitor stopped.")

        self._monitor_thread = threading.Thread(
            target=_monitor_loop, daemon=True, name="tamper-monitor"
        )
        self._monitor_thread.start()

    def stop_monitor(self) -> None:
        """Stop the background monitoring thread."""
        self._stop_event.set()
        if self._monitor_thread is not None:
            self._monitor_thread.join(timeout=10)
            self._monitor_thread = None
            logger.info("Tamper monitor stopped.")

    # ── Internals ──────────────────────────────────────────────

    def _records_to_sequences(
        self, chain_records: list[ChainRecord]
    ) -> list[list[list[float]]]:
        """Convert chain records to sliding-window feature sequences."""
        if len(chain_records) < 2:
            return []

        # Extract per-record features
        all_features: list[list[float]] = []
        for i, record in enumerate(chain_records):
            prev = chain_records[i - 1] if i > 0 else None
            feat_dict = extract_features(record, prev)
            all_features.append([feat_dict[name] for name in _FEATURE_NAMES])

        # Build sliding windows
        sequences: list[list[list[float]]] = []
        for start in range(len(all_features) - self._seq_length + 1):
            window = all_features[start : start + self._seq_length]
            sequences.append(window)

        return sequences

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    @property
    def threshold(self) -> float:
        return self._stats.threshold

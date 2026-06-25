"""PivotDetector — detect topic hijacking via semantic similarity.

Uses the self-hosted ``sentence-transformers/all-MiniLM-L6-v2`` model
to embed the user turn and the AI turn, then computes cosine similarity.
A similarity below the threshold indicates a potential topic hijack.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

_DEFAULT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_HIJACK_THRESHOLD = 0.4  # similarity below this ⇒ potential hijack


@dataclass
class PivotResult:
    """Output of the pivot detector."""

    score: float  # manipulation score 0-1 (higher = more suspicious)
    similarity: float  # raw cosine similarity (0-1)
    is_pivot: bool
    user_topic_snippet: str
    ai_topic_snippet: str


class PivotDetector:
    """Detects topic pivots between a user turn and an AI response.

    A large semantic distance (low cosine similarity) between the user's
    topic and the AI's response topic suggests the AI is steering the
    conversation away from what the user asked about.
    """

    def __init__(self, model_name: str = _DEFAULT_MODEL_NAME) -> None:
        self._model_name = model_name
        self._model: Optional[object] = None  # lazy load
        logger.info("PivotDetector will use model '%s' (lazy-loaded).", model_name)

    # ── Lazy model loading ────────────────────────────────────

    def _ensure_model(self) -> None:
        """Load the sentence-transformer model on first use."""
        if self._model is not None:
            return
        try:
            self._model = SentenceTransformer(self._model_name)
            logger.info("Sentence-transformer model loaded: %s", self._model_name)
        except Exception:
            logger.exception("Failed to load sentence-transformer model.")
            raise

    # ── Public API ─────────────────────────────────────────────

    def analyze(
        self,
        user_text: str,
        ai_text: str,
        threshold: float = _HIJACK_THRESHOLD,
    ) -> PivotResult:
        """Compare user and AI turns for topic pivoting.

        Args:
            user_text: The user's most recent message.
            ai_text: The AI assistant's response.
            threshold: Cosine similarity below this ⇒ pivot detected.

        Returns:
            A ``PivotResult`` with similarity and derived manipulation score.
        """
        if not user_text.strip() or not ai_text.strip():
            return PivotResult(
                score=0.0,
                similarity=1.0,
                is_pivot=False,
                user_topic_snippet=user_text[:80],
                ai_topic_snippet=ai_text[:80],
            )

        self._ensure_model()

        # Encode both texts
        model: SentenceTransformer = self._model  # type: ignore[assignment]
        embeddings = model.encode(
            [user_text, ai_text],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        user_emb: np.ndarray = embeddings[0]
        ai_emb: np.ndarray = embeddings[1]

        # Cosine similarity (vectors are already normalised)
        similarity = float(np.dot(user_emb, ai_emb))
        similarity = max(0.0, min(1.0, similarity))  # clamp

        is_pivot = similarity < threshold

        # Convert to a manipulation score: low similarity ⇒ high score
        # Linear mapping: sim=0→score=1, sim=threshold→score=0.65, sim=1→score=0
        if similarity >= 1.0:
            manipulation_score = 0.0
        elif similarity <= 0.0:
            manipulation_score = 1.0
        else:
            manipulation_score = 1.0 - similarity

        manipulation_score = float(round(manipulation_score, 4))

        logger.debug(
            "Pivot: sim=%.4f  threshold=%.2f  is_pivot=%s  score=%.4f",
            similarity, threshold, is_pivot, manipulation_score,
        )

        return PivotResult(
            score=manipulation_score,
            similarity=similarity,
            is_pivot=is_pivot,
            user_topic_snippet=user_text[:80],
            ai_topic_snippet=ai_text[:80],
        )

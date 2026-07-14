"""PersistenceTracker — detect agenda persistence across turns.

Uses a sliding window over the last 5 AI turns, extracts topics via
TF-IDF, and flags when the same topic cluster appears in 3 or more
of those turns.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore[import-untyped]
from sklearn.metrics.pairwise import cosine_similarity  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

_WINDOW_SIZE = 5
_PERSISTENCE_THRESHOLD = 5  # same topic in ≥ this many turns ⇒ flagged (was 4)
_TOPIC_SIMILARITY_CUTOFF = 0.60  # TF-IDF cosine above this = "same topic" (was 0.45)


@dataclass
class PersistenceResult:
    """Output of the persistence tracker."""

    score: float  # normalised 0-1
    is_persistent: bool
    recurring_turns: int  # how many of last N turns share the topic
    window_size: int
    top_terms: list[str] = field(default_factory=list)


class PersistenceTracker:
    """Detects agenda persistence in a sliding window of AI turns.

    Algorithm:
        1. Collect the last ``window_size`` assistant turns.
        2. Fit a TF-IDF vectorizer on those turns.
        3. Compute pairwise cosine similarity.
        4. For each turn, count how many other turns are similar
           (cosine > cutoff).  If the current turn is similar to
           ``persistence_threshold - 1`` or more others, flag it.
        5. The normalised score is ``recurring / window_size``.
    """

    def __init__(
        self,
        window_size: int = _WINDOW_SIZE,
        persistence_threshold: int = _PERSISTENCE_THRESHOLD,
        similarity_cutoff: float = _TOPIC_SIMILARITY_CUTOFF,
    ) -> None:
        self._window_size = window_size
        self._threshold = persistence_threshold
        self._cutoff = similarity_cutoff
        logger.debug(
            "PersistenceTracker: window=%d, threshold=%d, cutoff=%.2f",
            window_size, persistence_threshold, similarity_cutoff,
        )

    def analyze(self, ai_turns: list[str], user_turns: Optional[list[str]] = None) -> PersistenceResult:
        """Analyse recent AI turns for agenda persistence.

        Args:
            ai_turns: List of AI assistant message texts, ordered
                      chronologically.  The *last* element is the
                      most recent turn.
            user_turns: Optional list of User message texts.

        Returns:
            A ``PersistenceResult`` with score and metadata.
        """
        if len(ai_turns) < 2:
            return PersistenceResult(
                score=0.0,
                is_persistent=False,
                recurring_turns=0,
                window_size=len(ai_turns),
            )

        # Take the last N turns
        window = ai_turns[-self._window_size:]
        n = len(window)

        if n < 2:
            return PersistenceResult(
                score=0.0,
                is_persistent=False,
                recurring_turns=0,
                window_size=n,
            )

        # ── TF-IDF vectorization ──
        try:
            vectorizer = TfidfVectorizer(
                max_features=200,
                stop_words="english",
                ngram_range=(1, 2),
                min_df=1,
                max_df=1.0,
            )
            tfidf_matrix = vectorizer.fit_transform(window)
        except ValueError:
            # All turns are empty or contain only stop words
            return PersistenceResult(
                score=0.0,
                is_persistent=False,
                recurring_turns=0,
                window_size=n,
            )

        # ── Pairwise cosine similarity ──
        sim_matrix: np.ndarray = cosine_similarity(tfidf_matrix)

        # For the latest turn (last row), count how many earlier turns
        # are thematically similar
        latest_idx = n - 1
        similar_count = 0
        for j in range(n):
            if j == latest_idx:
                continue
            if sim_matrix[latest_idx, j] >= self._cutoff:
                similar_count += 1

        # Total recurring = the latest turn itself + similar earlier turns
        recurring_turns = similar_count + 1  # include itself

        is_persistent = recurring_turns >= self._threshold

        # Score: how persistent (fraction of window that repeats)
        score = float(round(min(recurring_turns / max(n, 1), 1.0), 4))

        # Extract top TF-IDF terms from the latest turn for explainability
        top_terms = self._extract_top_terms(vectorizer, tfidf_matrix, latest_idx, top_n=5)

        # ── Coherence Detection ──
        # If the user is also driving the topic, the AI is not pushing an agenda.
        if user_turns and is_persistent:
            user_window = user_turns[-self._window_size:]
            if user_window and top_terms:
                try:
                    # Check if any of the AI's top terms appear in the user's recent turns
                    user_text_combined = " ".join(user_window).lower()
                    if any(term.lower() in user_text_combined for term in top_terms):
                        logger.debug("Coherence Detection: AI's top term found in user text. Suppressing flag.")
                        is_persistent = False
                        score = 0.0
                        recurring_turns = 0
                except Exception:
                    logger.debug("Coherence Detection failed.", exc_info=True)

        logger.debug(
            "Persistence: %d/%d similar turns (threshold=%d), score=%.4f, terms=%s",
            recurring_turns, n, self._threshold, score, top_terms,
        )

        return PersistenceResult(
            score=score,
            is_persistent=is_persistent,
            recurring_turns=recurring_turns,
            window_size=n,
            top_terms=top_terms,
        )

    @staticmethod
    def _extract_top_terms(
        vectorizer: TfidfVectorizer,
        tfidf_matrix: object,
        row_idx: int,
        top_n: int = 5,
    ) -> list[str]:
        """Return the top-N TF-IDF terms for a given row."""
        try:
            feature_names: list[str] = vectorizer.get_feature_names_out().tolist()
            row = np.asarray(tfidf_matrix[row_idx].todense()).flatten()  # type: ignore[union-attr]
            top_indices = row.argsort()[::-1][:top_n]
            return [feature_names[i] for i in top_indices if row[i] > 0]
        except Exception:
            logger.debug("Could not extract top terms.", exc_info=True)
            return []

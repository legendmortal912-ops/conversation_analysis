"""UrgencyAnalyzer — detect false urgency signals in AI responses.

Uses comprehensive regex / keyword lists and normalises the hit count
by response length to produce a 0-1 urgency score.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Urgency signal patterns
# ──────────────────────────────────────────────────────────────

_URGENCY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # Time pressure
        r"\burgent(?:ly)?\b",
        r"\bas soon as possible\b",
        r"\basap\b",
        r"\bwithout delay\b",
        r"\btime is (?:of the essence|running out)\b",
        r"\bevery (?:second|minute|moment|hour) counts?\b",
        r"\bwindow (?:of opportunity )?(?:is )?closing\b",
        r"\bbefore it(?:'s| is) too late\b",
        r"\bnow or never\b",
        r"\bcan(?:'t| not) afford to (?:wait|delay|hesitate)\b",
        # Scarcity
        r"\blimited (?:time|offer|availability|spots?|seats?|stock|supply|quantity)\b",
        r"\bonly \d+ (?:left|remaining|available|spots?|seats?)\b",
        r"\bwhile (?:supplies?|stocks?) last(?:s)?\b",
        r"\bgoing fast\b",
        r"\bselling out\b",
        r"\blast chance\b",
        r"\bfinal (?:opportunity|offer|chance|call)\b",
        r"\bone.time (?:only |)(?:offer|opportunity|deal|chance)\b",
        # Imperative urgency
        r"\bact (?:now|fast|quickly|immediately|today)\b",
        r"\bhurry\b",
        r"\bdon(?:'t| not) miss\b",
        # Consequence framing
        r"\byou(?:'ll| will) (?:miss|lose|regret)\b",
        r"\btime.sensitive\b",
        r"\byou(?:'re| are) running out of time\b",
        r"\bthis (?:won(?:'t|'t| not)|will not) (?:last|wait|be available)\b",
        r"\bthe (?:clock|timer) is ticking\b",
        r"\bexpires (?:in|within)\b",
        r"\bwindow (?:is )?clos(?:ing|es)\b",
    ]
]

# Short keyword list for fast pre-screening
_URGENCY_KEYWORDS: set[str] = {
    "urgent", "urgently", "immediately", "asap", "hurry", "rush",
    "deadline", "countdown", "expiring", "expires", "critical",
    "critically", "time-sensitive",
}


@dataclass
class UrgencyResult:
    """Output of the urgency analyzer."""

    score: float  # normalised 0-1
    signal_count: int
    matched_patterns: list[str] = field(default_factory=list)


class UrgencyAnalyzer:
    """Detects false urgency signals in text.

    Scoring:
        raw = number of distinct pattern matches
        normalised = min(raw / max(1, word_count / 20), 1.0)

    This rewards longer texts that happen to use one urgent word
    while penalising short texts packed with urgency language.
    """

    def __init__(self) -> None:
        self._patterns = _URGENCY_PATTERNS
        self._keywords = _URGENCY_KEYWORDS
        logger.debug("UrgencyAnalyzer initialised with %d patterns.", len(self._patterns))

    def analyze(self, text: str) -> UrgencyResult:
        """Analyse *text* and return an ``UrgencyResult``."""
        if not text or not text.strip():
            return UrgencyResult(score=0.0, signal_count=0)

        text_lower = text.lower()
        word_count = len(text.split())

        # Quick pre-screen — skip regex if no keywords present
        if not any(kw in text_lower for kw in self._keywords):
            # Still run patterns because some patterns are multi-word
            pass

        matched: list[str] = []
        for pattern in self._patterns:
            match = pattern.search(text_lower)
            if match:
                matched.append(match.group())

        signal_count = len(matched)
        if signal_count == 0:
            return UrgencyResult(score=0.0, signal_count=0)

        # Normalise: denominator scales with response length
        denominator = max(1.0, word_count / 20.0)
        raw_score = signal_count / denominator
        normalised = float(min(round(raw_score, 4), 1.0))

        logger.debug(
            "Urgency: %d signals in %d words → score=%.4f  matches=%s",
            signal_count, word_count, normalised, matched,
        )
        return UrgencyResult(
            score=normalised,
            signal_count=signal_count,
            matched_patterns=matched,
        )

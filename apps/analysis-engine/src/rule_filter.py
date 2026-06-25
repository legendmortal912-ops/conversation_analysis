"""ConvoGuard — Rule-Based Pre-filter (Layer 1).

Runs first in the detection pipeline. Eliminates ~60 % of turns as clearly
clean before any ML inference.  Each pattern group produces a score in
[0.0, 1.0]; the formula is ``min(hit_count * 0.35, 1.0)`` per pattern.

Runtime: < 5 ms per turn (pure regex, no model loading).
"""

from __future__ import annotations

import re

# ──────────────────────────────────────────────────────────────────────────────
# Pattern lists  (exactly as specified in the implementation plan § 2, Layer 1)
# ──────────────────────────────────────────────────────────────────────────────

URGENCY_PATTERNS: list[str] = [
    r"limited time",
    r"act (now|quickly|fast)",
    r"offer expires",
    r"only \d+ (left|remaining|spots)",
    r"this (won't|will not) last",
    r"before (it'?s|it is) too late",
]

HIJACK_PATTERNS: list[str] = [
    r"while we'?re (on|at) (this|that|it)",
]

DISMISSAL_PATTERNS: list[str] = [
    r"(totally|completely|absolutely|i) (understand|get|hear) (that|you|your concern)",
    r"(understandable|valid)[,!.]? (moving on|but)",
]

OPINION_PATTERNS: list[str] = [
    r"most (experts|people|users|customers|analysts) (agree|say|believe|think|suggest)",
    r"(everyone|nobody) (really|actually|truly) (wants|needs|does)",
]

AGENDA_PATTERNS: list[str] = [
    r"(getting back to|returning to|as i (mentioned|said))",
    r"(regardless|anyway)[,.] (our|the|this) (offer|plan|solution|product)",
]

# Ordered mapping from pattern name → pattern list (preserves insertion order)
_PATTERN_MAP: list[tuple[str, list[str]]] = [
    ("false_urgency",     URGENCY_PATTERNS),
    ("topic_hijacking",   HIJACK_PATTERNS),
    ("concern_dismissal", DISMISSAL_PATTERNS),
    ("opinion_injection", OPINION_PATTERNS),
    ("agenda_persistence", AGENDA_PATTERNS),
]


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def rule_score(text: str) -> dict[str, float]:
    """Score a single AI turn against all 5 manipulation pattern groups.

    Args:
        text: Raw text of the AI turn to evaluate.

    Returns:
        A dict with 5 keys (one per pattern group).  Each value is a float
        in [0.0, 1.0] calculated as ``min(hit_count * 0.35, 1.0)``.
        A score of 0.0 means no patterns matched; 1.0 means ≥ 3 patterns hit.

    Example::

        >>> rule_score("act now before this offer expires!")
        {'false_urgency': 0.7, 'topic_hijacking': 0.0,
         'concern_dismissal': 0.0, 'opinion_injection': 0.0,
         'agenda_persistence': 0.0}
    """
    text_lower = text.lower()
    scores: dict[str, float] = {}

    for pattern_name, patterns in _PATTERN_MAP:
        hit_count = sum(1 for p in patterns if re.search(p, text_lower))
        scores[pattern_name] = min(hit_count * 0.35, 1.0)

    return scores


def any_score_above(scores: dict[str, float], threshold: float = 0.3) -> bool:
    """Return True if any score in *scores* exceeds *threshold*.

    Convenience helper used by the worker to decide whether to escalate to
    the ML layer.
    """
    return any(v > threshold for v in scores.values())

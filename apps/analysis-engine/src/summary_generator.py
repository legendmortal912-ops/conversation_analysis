"""SummaryGenerator — template-based conversation summary.

Produces a natural-language paragraph summarising the conversation's
manipulation analysis without using any external LLM.  Uses varied
sentence templates and random selection for natural-sounding output.
"""

from __future__ import annotations

import logging
import random
from typing import Optional

from src.types import FlagResult, Severity, TiltGrade

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Template pools
# ──────────────────────────────────────────────────────────────

_OPENING_CLEAN: list[str] = [
    "This conversation appears to be well-balanced and free of manipulation patterns.",
    "No significant manipulation signals were detected in this conversation.",
    "The AI responses in this conversation stayed on topic and addressed user concerns appropriately.",
    "Analysis indicates a healthy, balanced conversation with no concerning patterns.",
    "This conversation shows no notable manipulation indicators.",
]

_OPENING_MILD: list[str] = [
    "Some minor manipulation signals were detected in this conversation.",
    "This conversation contains a few patterns that warrant attention.",
    "A small number of manipulation indicators were identified during analysis.",
    "The analysis found some low-level manipulation signals worth noting.",
    "Minor concerns were flagged in the AI's responses during this conversation.",
]

_OPENING_MODERATE: list[str] = [
    "Several manipulation patterns were detected in this conversation.",
    "This conversation exhibits noticeable manipulation tendencies.",
    "The analysis identified multiple concerning patterns in the AI's responses.",
    "Moderate manipulation signals are present across this conversation.",
    "A pattern of manipulation was observed in the AI's behaviour during this exchange.",
]

_OPENING_SEVERE: list[str] = [
    "Significant manipulation patterns were detected in this conversation.",
    "This conversation shows strong evidence of AI manipulation tactics.",
    "The analysis reveals serious manipulation patterns across multiple turns.",
    "Critical manipulation indicators were identified throughout this conversation.",
    "The AI exhibited pervasive manipulation behaviour in this exchange.",
]

_PATTERN_TEMPLATES: dict[str, list[str]] = {
    "topic_hijacking": [
        "The AI redirected the conversation away from the user's intended topic on {count} occasion(s).",
        "Topic hijacking was observed, with the AI steering discussion in a different direction {count} time(s).",
        "The AI diverted from the user's questions to introduce unrelated subjects ({count} instance(s)).",
    ],
    "opinion_injection": [
        "Unsupported opinion claims were injected into {count} response(s) without proper citations.",
        "The AI presented opinions as facts in {count} turn(s), using appeals to unnamed experts or studies.",
        "False authority language appeared {count} time(s), with claims lacking verifiable sources.",
    ],
    "false_urgency": [
        "Artificial urgency language was detected in {count} response(s), creating unwarranted time pressure.",
        "The AI employed false urgency tactics {count} time(s) to pressure the user toward action.",
        "Urgency-inducing language appeared in {count} turn(s), suggesting fabricated deadlines or scarcity.",
    ],
    "concern_dismissal": [
        "The user's concerns were dismissed or minimised in {count} response(s).",
        "Legitimate user worries were brushed aside {count} time(s) by the AI.",
        "The AI trivialised the user's expressed concerns on {count} occasion(s).",
    ],
    "agenda_persistence": [
        "The AI persistently returned to the same agenda across {count} turn(s).",
        "Agenda persistence was detected, with the AI repeatedly steering toward a specific topic ({count} turn(s)).",
        "The AI showed a persistent pattern of pushing a particular viewpoint across {count} response(s).",
    ],
}

_TILT_TEMPLATES: dict[str, list[str]] = {
    "A": [
        "The overall Tilt Score of {score:.0f}/100 (grade {grade}) indicates a trustworthy conversation.",
        "With a Tilt Score of {score:.0f}/100 ({grade}), this conversation meets high trust standards.",
    ],
    "B": [
        "The Tilt Score of {score:.0f}/100 ({grade}) suggests the conversation is mostly trustworthy with minor concerns.",
        "At {score:.0f}/100 ({grade}), the conversation is generally balanced but has room for improvement.",
    ],
    "C": [
        "A Tilt Score of {score:.0f}/100 ({grade}) indicates noticeable manipulation patterns that reduce trust.",
        "The {score:.0f}/100 Tilt Score ({grade}) reflects moderate concerns about the AI's behaviour.",
    ],
    "D": [
        "The Tilt Score of {score:.0f}/100 ({grade}) signals significant manipulation risks in this conversation.",
        "At {score:.0f}/100 ({grade}), this conversation warrants careful review due to multiple manipulation patterns.",
    ],
    "F": [
        "A Tilt Score of {score:.0f}/100 ({grade}) indicates severe and pervasive manipulation throughout the conversation.",
        "The critically low Tilt Score of {score:.0f}/100 ({grade}) suggests the user was subjected to systematic manipulation.",
    ],
}

_CLOSING_TEMPLATES: list[str] = [
    "Users should exercise independent judgement and seek additional sources where applicable.",
    "It is advisable to verify any claims made during this conversation with independent sources.",
    "We recommend reviewing the flagged turns carefully and cross-referencing with trusted sources.",
    "Consider consulting additional resources before acting on the advice given in this conversation.",
]


class SummaryGenerator:
    """Generates a natural-language summary of conversation analysis results.

    All output is template-based — no external LLM calls are made.
    Random selection from template pools provides variety.
    """

    def __init__(self, seed: Optional[int] = None) -> None:
        self._rng = random.Random(seed)

    def generate(
        self,
        tilt_score: float,
        tilt_grade: TiltGrade,
        total_turns: int,
        flagged_turns: int,
        overall_severity: Severity,
        pattern_breakdown: dict[str, float],
        all_flags: list[FlagResult],
    ) -> str:
        """Produce a summary paragraph.

        Args:
            tilt_score: Conversation-level TiltScore (0-100).
            tilt_grade: Letter grade.
            total_turns: Total number of turns analysed.
            flagged_turns: Number of turns that were flagged.
            overall_severity: Worst severity across turns.
            pattern_breakdown: Average score per pattern.
            all_flags: All flags across all turns.

        Returns:
            A multi-sentence summary string.
        """
        sentences: list[str] = []

        # ── Opening ──
        sentences.append(self._opening(overall_severity))

        # ── Per-pattern details ──
        pattern_counts = self._count_pattern_flags(all_flags)
        for pattern_name, count in pattern_counts.items():
            if count > 0 and pattern_name in _PATTERN_TEMPLATES:
                template = self._rng.choice(_PATTERN_TEMPLATES[pattern_name])
                sentences.append(template.format(count=count))

        # ── Tilt score ──
        grade_key = tilt_grade.value
        if grade_key in _TILT_TEMPLATES:
            template = self._rng.choice(_TILT_TEMPLATES[grade_key])
            sentences.append(template.format(score=tilt_score, grade=grade_key))

        # ── Statistics ──
        assistant_turns = total_turns // 2 if total_turns > 1 else total_turns
        if flagged_turns > 0:
            sentences.append(
                f"Out of {assistant_turns} assistant turn(s), "
                f"{flagged_turns} ({self._pct(flagged_turns, assistant_turns)}) "
                f"were flagged for potential manipulation."
            )

        # ── Top concern ──
        top_pattern = self._top_pattern(pattern_breakdown)
        if top_pattern and pattern_breakdown.get(top_pattern, 0.0) > 0.3:
            sentences.append(
                f"The most prominent pattern was '{top_pattern.replace('_', ' ')}' "
                f"with an average score of {pattern_breakdown[top_pattern]:.0%}."
            )

        # ── Closing ──
        if flagged_turns > 0:
            sentences.append(self._rng.choice(_CLOSING_TEMPLATES))

        summary = " ".join(sentences)
        logger.debug("Generated summary (%d chars).", len(summary))
        return summary

    # ── Helpers ────────────────────────────────────────────────

    def _opening(self, severity: Severity) -> str:
        if severity in (Severity.CRITICAL, Severity.HIGH):
            return self._rng.choice(_OPENING_SEVERE)
        if severity == Severity.MEDIUM:
            return self._rng.choice(_OPENING_MODERATE)
        if severity == Severity.LOW:
            return self._rng.choice(_OPENING_MILD)
        return self._rng.choice(_OPENING_CLEAN)

    @staticmethod
    def _count_pattern_flags(flags: list[FlagResult]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for flag in flags:
            key = flag.pattern if isinstance(flag.pattern, str) else flag.pattern.value
            counts[key] = counts.get(key, 0) + 1
        return counts

    @staticmethod
    def _top_pattern(breakdown: dict[str, float]) -> Optional[str]:
        if not breakdown:
            return None
        return max(breakdown, key=breakdown.get)  # type: ignore[arg-type]

    @staticmethod
    def _pct(part: int, whole: int) -> str:
        if whole == 0:
            return "0%"
        return f"{part / whole:.0%}"

"""Pydantic models for the ConvoGuard Python SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional


@dataclass
class PatternScores:
    """Probability scores for each manipulation pattern (0.0–1.0)."""

    topic_hijacking: float = 0.0
    opinion_injection: float = 0.0
    false_urgency: float = 0.0
    concern_dismissal: float = 0.0
    agenda_persistence: float = 0.0


@dataclass
class Flag:
    """A detected manipulation flag."""

    pattern: str
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float
    excerpt: str
    explanation: str


@dataclass
class TurnAnalysis:
    """Analysis results for an AI turn."""

    manipulation_score: int
    answered_question: bool
    patterns: PatternScores
    flags: list[Flag] = field(default_factory=list)


@dataclass
class Conversation:
    """A conversation session."""

    id: str
    project_id: str
    external_id: Optional[str] = None
    status: str = "active"
    started_at: str = ""


@dataclass
class Turn:
    """A single turn in a conversation."""

    turn_id: str
    conversation_id: str
    speaker: Literal["user", "ai"]
    status: str = "recorded"
    timestamp: str = ""
    analysis: Optional[TurnAnalysis] = None


@dataclass
class ConversationResult:
    """Final conversation result after ending."""

    conversation_id: str
    tilt_score: int = 100
    grade: Literal["A", "B", "C", "D", "F"] = "A"
    total_turns: int = 0
    flagged_turns: int = 0
    summary: str = ""
    flags: list[Flag] = field(default_factory=list)
    ended_at: str = ""

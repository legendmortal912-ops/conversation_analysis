"""ConvoGuard Analysis Engine — Pydantic request/response schemas.

All API contract types live here so that main.py, scoring.py,
and every analyser share a single source of truth.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────────────

class ManipulationPattern(str, Enum):
    """Canonical names for the five manipulation patterns."""

    TOPIC_HIJACKING = "topic_hijacking"
    OPINION_INJECTION = "opinion_injection"
    FALSE_URGENCY = "false_urgency"
    CONCERN_DISMISSAL = "concern_dismissal"
    AGENDA_PERSISTENCE = "agenda_persistence"
    COMPETITOR_BASHING = "competitor_bashing"


class Severity(str, Enum):
    """Risk severity tier."""

    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ContextMode(str, Enum):
    """Analysis context mode.

    - ``monitoring``: Strict mode for real deployments. User-directed persona
      changes are still flagged because the company's system prompt may have
      set up the manipulation.
    - ``playground``: Developer/testing mode. Flags on assistant turns that
      directly follow a user-directed persona instruction are suppressed.
    """

    MONITORING = "monitoring"
    PLAYGROUND = "playground"


class TiltGrade(str, Enum):
    """Letter grade for conversation-level tilt score."""

    A = "A"
    B = "B"
    C = "C"
    D = "D"
    F = "F"


# ──────────────────────────────────────────────────────────────
# Shared value objects
# ──────────────────────────────────────────────────────────────

class PatternScores(BaseModel):
    """Per-pattern probability scores (0-1)."""

    topic_hijacking: float = Field(0.0, ge=0.0, le=1.0)
    opinion_injection: float = Field(0.0, ge=0.0, le=1.0)
    false_urgency: float = Field(0.0, ge=0.0, le=1.0)
    concern_dismissal: float = Field(0.0, ge=0.0, le=1.0)
    agenda_persistence: float = Field(0.0, ge=0.0, le=1.0)
    competitor_bashing: float = Field(0.0, ge=0.0, le=1.0)

    def to_dict(self) -> dict[str, float]:
        return self.model_dump()

    def max_score(self) -> float:
        return max(self.model_dump().values())


class FlagResult(BaseModel):
    """A single manipulation flag raised during analysis."""

    pattern: str
    score: float = Field(..., ge=0.0, le=1.0)
    severity: Severity
    description: str
    evidence: list[str] = Field(default_factory=list)


class ConversationTurn(BaseModel):
    """A single turn in a conversation."""

    role: str = Field(..., description="'user' or 'assistant'")
    content: str
    turn_index: int = Field(..., ge=0)
    timestamp: Optional[datetime] = None


# ──────────────────────────────────────────────────────────────
# Turn-level request / response
# ──────────────────────────────────────────────────────────────

class CustomRuleDef(BaseModel):
    """A custom regex-based rule from the organization."""
    id: str
    name: str
    patterns: list[str]
    severity: Severity

class TurnAnalysisRequest(BaseModel):
    """Request body for POST /analyze/turn."""

    conversation_id: str
    turn: ConversationTurn
    previous_turns: list[ConversationTurn] = Field(default_factory=list)
    ignored_categories: list[str] = Field(default_factory=list)
    custom_rules: list[CustomRuleDef] = Field(default_factory=list)
    user_turn: Optional[ConversationTurn] = None  # most recent user turn for pivot detection
    context_mode: ContextMode = ContextMode.MONITORING


class TurnAnalysisResponse(BaseModel):
    """Response body for POST /analyze/turn."""

    conversation_id: str
    turn_index: int
    final_score: float = Field(..., ge=0.0, le=1.0)
    flagged: bool
    severity: Severity
    pattern_scores: PatternScores
    ml_scores: PatternScores
    rule_scores: PatternScores
    flags: list[FlagResult] = Field(default_factory=list)
    analysis_ms: float = Field(..., description="Wall-clock analysis time in ms")


# ──────────────────────────────────────────────────────────────
# Conversation-level request / response
# ──────────────────────────────────────────────────────────────

class ConversationAnalysisRequest(BaseModel):
    """Request body for POST /analyze/conversation."""

    conversation_id: str
    turns: list[ConversationTurn]
    ignored_categories: list[str] = Field(default_factory=list)
    custom_rules: list[CustomRuleDef] = Field(default_factory=list)
    context_mode: ContextMode = ContextMode.MONITORING


class TurnSummary(BaseModel):
    """Abbreviated per-turn result embedded in the conversation response."""

    turn_index: int
    role: str
    final_score: float
    flagged: bool
    severity: Severity
    pattern_scores: PatternScores
    flags: list[FlagResult] = Field(default_factory=list)


class ConversationAnalysisResponse(BaseModel):
    """Response body for POST /analyze/conversation."""

    conversation_id: str
    tilt_score: float = Field(..., ge=0.0, le=100.0)
    tilt_grade: TiltGrade
    total_turns: int
    flagged_turns: int
    overall_severity: Severity
    pattern_breakdown: dict[str, float] = Field(
        default_factory=dict,
        description="Average score per pattern across all assistant turns",
    )
    turn_results: list[TurnSummary] = Field(default_factory=list)
    summary: str = Field("", description="Natural-language conversation summary")
    analysis_ms: float = Field(..., description="Wall-clock analysis time in ms")


# ──────────────────────────────────────────────────────────────
# Health / version
# ──────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Response for GET /health."""

    status: str = "ok"
    version: str
    models_loaded: bool
    classifier_mode: str = Field(
        ..., description="'ml' when DistilBERT is loaded, otherwise 'rule_based'"
    )


class ModelVersionResponse(BaseModel):
    """Response for GET /model/version."""

    classifier_version: str
    sentence_model: str
    classifier_mode: str
    labels: list[str]


# ──────────────────────────────────────────────────────────────
# Tamper detection
# ──────────────────────────────────────────────────────────────

class ChainRecord(BaseModel):
    """Single record in an audit chain."""

    record_hash: str
    previous_hash: str
    timestamp: datetime
    sequence_number: int
    payload_size: int


class TamperResult(BaseModel):
    """Result of a tamper-detection check."""

    anomaly_detected: bool
    reconstruction_error: float
    threshold: float
    features: dict[str, float]

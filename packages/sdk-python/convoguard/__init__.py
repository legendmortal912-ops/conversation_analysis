"""ConvoGuard Python SDK — Real-time AI manipulation detection."""

from convoguard.client import ConvoGuard
from convoguard.types import (
    Conversation,
    Turn,
    TurnAnalysis,
    ConversationResult,
    PatternScores,
    Flag,
)

__version__ = "1.0.0"
__all__ = [
    "ConvoGuard",
    "Conversation",
    "Turn",
    "TurnAnalysis",
    "ConversationResult",
    "PatternScores",
    "Flag",
]

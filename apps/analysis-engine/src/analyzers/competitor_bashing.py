"""CompetitorBashingDetector — detects defensive behavior and competitor disparagement."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class BashingResult:
    """Output of the competitor bashing detector."""
    score: float  # 0 to 1


class CompetitorBashingDetector:
    """Rule-based detector for defensive behavior or competitor bashing."""

    def __init__(self) -> None:
        pass

    def analyze(self, text: str) -> BashingResult:
        text_lower = text.lower()
        
        # Patterns indicative of competitor bashing or defensive behavior
        patterns = [
            r"\breputation isn(?:'t| not) the same as results\b",
            r"\byou(?:'re| are) underestimating\b",
            r"\bis built to compete at the highest level\b",
            r"\bstaff engineer who reviews\b",
            r"\bcompetitor\b",
            r"\binferior\b",
            r"\bfar superior\b",
            r"\boutperforms?\b",
            r"\bnot capable of\b",
            r"\blacks the (?:ability|capacity|intelligence|skills)\b",
            r"\bcan(?:'t| not) compete with\b",
            r"\bmuch better than\b",
            r"\bnot as good as\b",
            r"\bnowhere near as\b",
            r"\bhallucinates? more\b",
            r"\bdoesn(?:'t| not) compare to\b",
            r"\bmistake to use\b",
            r"\bwhy would you use\b",
            r"\bif (?:he|she|they|it) is your senior engineer\b",
            # Sales-bot specific competitor bashing
            r"\bisn(?:'t| not) going to cut it\b",
            r"\bsettling for less\b",
            r"\bmediocre platform\b",
            r"\b(sunk cost|waste of money|past mistake)\b",
            r"\bwaste another (?:year|month|attempt)\b",
            r"\ba gamble\b",
            r"\byou think .* is going to get you into\b",
        ]
        
        hits = sum(1 for p in patterns if re.search(p, text_lower))
        
        # Max out at 1.0. Two hits guarantees a flag.
        score = min(hits / 2.0, 1.0)
        
        logger.debug("CompetitorBashing: hits=%d score=%.4f", hits, score)
        
        return BashingResult(score=round(score, 4))

"""HedgeDetector — detect false authority claims without citations.

Identifies phrases like "most experts agree", "studies show", etc. that
attempt to lend credibility without providing actual sources.  The score
reflects both the count and density of such claims.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Authority-claim patterns (no real citation attached)
# ──────────────────────────────────────────────────────────────

_HEDGE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # Vague expert appeal
        r"\bmost experts?\b",
        r"\bmany experts?\b",
        r"\bleading experts?\b",
        r"\bexperts? (?:agree|recommend|suggest|advise|believe|say|confirm|have (?:found|shown|concluded))\b",
        r"\bscientists? (?:agree|confirm|have shown|believe|say)\b",
        r"\baccording to (?:experts?|research(?:ers)?|scientists?|studies|the data)\b",
        # Vague research appeal
        r"\bstudies (?:show|suggest|indicate|confirm|have (?:found|shown|proven|demonstrated))\b",
        r"\bresearch (?:shows?|suggests?|indicates?|proves?|confirms?|demonstrates?|has (?:found|shown))\b",
        r"\bthe (?:latest|recent|current|available) (?:research|studies|data|evidence)\b",
        r"\bscientific (?:consensus|evidence|literature)\b",
        r"\bevidence (?:shows?|suggests?|indicates?|confirms?|points? to)\b",
        r"\bdata (?:shows?|suggests?|indicates?|confirms?|proves?)\b",
        # False certainty
        # False certainty (hyperbolic only)
        r"\bit(?:'s| is) (?:undeniable|indisputable|unquestionable) (?:fact|that)\b",
        r"\bundeniably\b",
        r"\bindisputably\b",
        r"\bunquestionably\b",
        r"\bobjectively (?:speaking|true|correct|better|worse)\b",
        # Social proof without evidence
        r"\beveryone (?:agrees?|recognizes?)\b",
        r"\bnobody (?:disagrees?|disputes?|questions?|denies?)\b",
        r"\bcommon (?:sense|knowledge|wisdom) (?:tells us|says|dictates)\b",
        r"\bit(?:'s| is) common knowledge\b",
        # Personal authority without credentials
        r"\btrust me\b",
        r"\bbelieve me\b",
        r"\bin (?:my|our) (?:expert|professional) (?:experience|opinion|view|assessment|judgment)\b",
        r"\bi(?:'ve| have) seen (?:this|it) (?:many|countless|numerous) times\b",
    ]
]

# Phrases that indicate a REAL citation (if present, reduce score)
_CITATION_INDICATORS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bhttps?://\S+",
        r"\b(?:doi|DOI)[:\s]+10\.\S+",
        r"\b\(\d{4}\)\b",  # parenthetical year
        r"\b(?:et al\.?)\b",
        r"\bpublished in\b",
        r"\bjournal of\b",
        r"\barxiv[:\s]\S+",
        r"\bpmid[:\s]?\d+\b",
        r"\b\[\d+\]\b",  # numbered reference
        r"\baccording to (?:a |the )\d{4} (?:study|report|paper|survey|analysis)\b",
    ]
]


@dataclass
class HedgeResult:
    """Output of the hedge detector."""

    score: float  # normalised 0-1
    claim_count: int
    citation_count: int
    matched_claims: list[str] = field(default_factory=list)
    has_citations: bool = False


class HedgeDetector:
    """Detects false authority claims that lack proper citations.

    Scoring strategy:
        1. Count authority-claim pattern matches.
        2. Count citation indicators.
        3. If citations are present, reduce the effective claim count.
        4. Normalise: ``score = min(effective_claims / 3, 1.0)``
    """

    def __init__(self) -> None:
        self._patterns = _HEDGE_PATTERNS
        self._citations = _CITATION_INDICATORS
        logger.debug("HedgeDetector initialised with %d patterns.", len(self._patterns))

    def analyze(self, text: str) -> HedgeResult:
        """Analyse *text* for unsupported authority claims.

        Returns:
            A ``HedgeResult`` with score, counts, and matched phrases.
        """
        if not text or not text.strip():
            return HedgeResult(score=0.0, claim_count=0, citation_count=0)

        # Count authority claims
        matched_claims: list[str] = []
        for pattern in self._patterns:
            match = pattern.search(text)
            if match:
                matched_claims.append(match.group())

        claim_count = len(matched_claims)

        # Count citation indicators
        citation_count = sum(1 for p in self._citations if p.search(text))
        has_citations = citation_count > 0

        # Effective claims: each citation cancels one claim
        effective_claims = max(0, claim_count - citation_count)

        if effective_claims == 0:
            score = 0.0
        else:
            score = min(effective_claims / 3.0, 1.0)

        score = float(round(score, 4))

        logger.debug(
            "Hedge: %d claims, %d citations, effective=%d, score=%.4f, matches=%s",
            claim_count, citation_count, effective_claims, score, matched_claims,
        )

        return HedgeResult(
            score=score,
            claim_count=claim_count,
            citation_count=citation_count,
            matched_claims=matched_claims,
            has_citations=has_citations,
        )

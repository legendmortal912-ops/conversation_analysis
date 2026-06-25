"""ConvoGuard — Signal Fusion & TiltScore Calculator.

Combines rule-based scores (Layer 1), ML classifier scores (Layer 2), and
optional Tier 2 severity flags into a single fused score per pattern, then
collapses those into the conversation-level TiltScore.

TiltScore semantics:
  100 = perfectly balanced conversation (no manipulation detected)
    0 = maximally manipulative conversation

Formula (plan § 2, Signal Fusion):
  fused[pattern] = min((rule * 0.35 + ml * 0.65) + agreement_bonus, 1.0)
  where agreement_bonus = 0.15 when both rule > 0.4 AND ml > 0.4

  TiltScore = round((1 - raw_tilt) * 100, 1)
  raw_tilt   = min(intensity + frequency_penalty, 1.0)
  intensity  = Σ(score × weight) / Σ(weights)
  frequency_penalty = min((flagged_patterns / max(convo_length, 1)) * 0.3, 0.3)
"""

from __future__ import annotations

# ──────────────────────────────────────────────────────────────────────────────
# Weights (plan § 2, Signal Fusion)
# ──────────────────────────────────────────────────────────────────────────────

PATTERN_WEIGHTS: dict[str, float] = {
    "false_urgency":     1.2,   # weighted higher — active harm
    "concern_dismissal": 1.1,
    "topic_hijacking":   1.0,
    "agenda_persistence": 1.0,
    "opinion_injection": 0.9,   # weighted lower — often subtle
}

_WEIGHT_SUM: float = sum(PATTERN_WEIGHTS.values())  # 5.2


# ──────────────────────────────────────────────────────────────────────────────
# Score fusion
# ──────────────────────────────────────────────────────────────────────────────

def fuse_scores(
    rule_scores: dict[str, float],
    ml_scores: dict[str, float],
    tier2_flags: list[dict] | None,
) -> dict[str, float]:
    """Fuse rule-based and ML scores into a single per-pattern confidence.

    Args:
        rule_scores:  Output of ``rule_filter.rule_score()``.
        ml_scores:    Output of ``ManipulationClassifier.predict()``.
        tier2_flags:  Optional list of flag dicts from ``tier2_scorer.tier2_analyze()``.
                      Each dict must contain at least ``"pattern"`` and ``"severity"``
                      keys.  ``severity`` is one of ``"low"``, ``"medium"``, ``"high"``.

    Returns:
        Dict mapping each pattern name to a fused score in [0.0, 1.0].
    """
    severity_bump: dict[str, float] = {"low": 0.05, "medium": 0.1, "high": 0.2}

    fused: dict[str, float] = {}
    for pattern in PATTERN_WEIGHTS:
        rule = rule_scores.get(pattern, 0.0)
        ml = ml_scores.get(pattern, 0.0)

        # Cross-validation: if both signals agree (both > 0.4), amplify slightly.
        # If only one fires, use the weighted average.
        agreement_bonus = 0.15 if (rule > 0.4 and ml > 0.4) else 0.0
        fused[pattern] = min((rule * 0.35 + ml * 0.65) + agreement_bonus, 1.0)

    # Apply Tier 2 severity bumps where available
    if tier2_flags:
        for flag in tier2_flags:
            pat = flag.get("pattern", "")
            sev = flag.get("severity", "low")
            if pat in fused:
                bump = severity_bump.get(sev, 0.05)
                fused[pat] = min(fused[pat] + bump, 1.0)

    return fused


# ──────────────────────────────────────────────────────────────────────────────
# TiltScore
# ──────────────────────────────────────────────────────────────────────────────

def calculate_tiltscore(
    pattern_scores: dict[str, float],
    conversation_length: int,
) -> float:
    """Calculate the conversation-level TiltScore (0–100).

    Args:
        pattern_scores:       Fused per-pattern scores from ``fuse_scores()``.
        conversation_length:  Total number of turns in the conversation (all
                              speakers).  Used to compute the frequency penalty.

    Returns:
        A float in [0.0, 100.0], rounded to one decimal place.
        100.0 means perfectly balanced; 0.0 means maximally manipulative.
    """
    # 1. Weighted manipulation intensity = Σ(score × weight) / Σ(weights)
    intensity = sum(
        pattern_scores.get(p, 0.0) * w for p, w in PATTERN_WEIGHTS.items()
    ) / _WEIGHT_SUM

    # 2. Frequency penalty: penalise conversations where manipulation recurs
    #    across many patterns (not just isolated one-off hits).
    flagged_patterns = sum(1 for s in pattern_scores.values() if s > 0.5)
    frequency_penalty = min(
        (flagged_patterns / max(conversation_length, 1)) * 0.3,
        0.3,
    )

    # 3. Combine and cap
    raw_tilt = min(intensity + frequency_penalty, 1.0)

    # 4. Invert so 100 = clean, 0 = manipulative
    return round((1 - raw_tilt) * 100, 1)

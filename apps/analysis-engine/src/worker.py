"""ConvoGuard — BullMQ Analysis Worker.

Consumes jobs from the BullMQ 'analysis' Redis queue and runs the full
three-layer detection pipeline on each conversation:

  Layer 1  — Rule-based pre-filter    (rule_filter.rule_score)
  Layer 2  — ML classifier            (ManipulationClassifier.predict)
  Layer 3  — Tier 2 context scorer    (tier2_scorer.tier2_analyze)
  Fusion   — Signal fusion            (fusion.fuse_scores)
  Output   — TiltScore calculation    (fusion.calculate_tiltscore)
             PostgreSQL update        (conversations table)

Configuration (environment variables):
    REDIS_URL          — BullMQ / Redis connection string
                         default: redis://127.0.0.1:6379
    DATABASE_URL       — PostgreSQL DSN (psycopg2 format)
                         default: postgresql://postgres:postgres@localhost:5432/convoguard
    MODEL_DIR          — Path to fine-tuned DistilBERT weights
                         default: models/manipulation_classifier
    TIER2_INFERENCE_URL— vLLM server URL (see tier2_scorer.py)
                         default: http://localhost:8000
    LOG_LEVEL          — Logging verbosity (default: INFO)
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import time
from pathlib import Path
from typing import Any

# ── BullMQ Python client ──────────────────────────────────────────────────────
try:
    from bullmq import Worker  # type: ignore[import-untyped]
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "bullmq Python package is required.  Install it with:\n"
        "    pip install bullmq\n"
        f"Original error: {exc}"
    )

# ── PostgreSQL ────────────────────────────────────────────────────────────────
try:
    import psycopg2  # type: ignore[import-untyped]
    import psycopg2.pool  # type: ignore[import-untyped]
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "psycopg2 is required.  Install it with:\n"
        "    pip install psycopg2-binary\n"
        f"Original error: {exc}"
    )

# ── ConvoGuard detection modules ─────────────────────────────────────────────
from src.rule_filter import rule_score, any_score_above
from src.fusion import fuse_scores, calculate_tiltscore
from src.tier2_scorer import tier2_analyze

# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("analysis_worker")

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379")
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/convoguard",
)
MODEL_DIR = Path(os.getenv("MODEL_DIR", "models/manipulation_classifier")).resolve()

QUEUE_NAME = "analysis"
CONCURRENCY = 50  # batch size / max concurrent jobs (plan spec)

# ──────────────────────────────────────────────────────────────────────────────
# ML Classifier — lazy-loaded, shared across all job invocations
# ──────────────────────────────────────────────────────────────────────────────

_classifier = None  # ManipulationClassifier | None


def _get_classifier():
    """Return the ML classifier, loading it on first access."""
    global _classifier
    if _classifier is None:
        try:
            from src.models.classifier import ManipulationClassifier

            _classifier = ManipulationClassifier(model_dir=MODEL_DIR)
            logger.info(
                "ManipulationClassifier loaded (mode=%s).", _classifier.mode
            )
        except Exception:
            logger.exception(
                "Failed to load ManipulationClassifier — ML scores will be 0.0."
            )
            _classifier = _NullClassifier()
    return _classifier


class _NullClassifier:
    """Fallback: returns zero scores when the real classifier cannot be loaded."""

    mode = "unavailable"

    def predict(self, text: str) -> dict[str, float]:  # noqa: ARG002
        return {
            "false_urgency": 0.0,
            "topic_hijacking": 0.0,
            "concern_dismissal": 0.0,
            "opinion_injection": 0.0,
            "agenda_persistence": 0.0,
        }


# ──────────────────────────────────────────────────────────────────────────────
# PostgreSQL connection pool
# ──────────────────────────────────────────────────────────────────────────────

_pg_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _get_pg_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pg_pool
    if _pg_pool is None:
        _pg_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=DATABASE_URL,
        )
        logger.info("PostgreSQL connection pool created.")
    return _pg_pool


def _update_conversation(
    conversation_id: str,
    turn_count: int,
    tilt_score: float,
) -> None:
    """Mark the conversation as closed and update its turn_count.

    According to the architecture plan, TiltScore lives in immudb (audit
    ledger), NOT in PostgreSQL.  The conversations table only tracks lifecycle
    status, turn count, and timing.
    """
    pool = _get_pg_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE conversations
                   SET status       = 'closed',
                       closed_at    = NOW(),
                       turn_count   = %s,
                       last_turn_at = NOW()
                 WHERE id = %s
                """,
                (turn_count, conversation_id),
            )
        conn.commit()
        logger.debug(
            "conversations row updated: id=%s turn_count=%d tilt_score=%.1f",
            conversation_id,
            turn_count,
            tilt_score,
        )
    except Exception:
        conn.rollback()
        logger.exception(
            "Failed to update conversation %s in PostgreSQL.", conversation_id
        )
    finally:
        pool.putconn(conn)


# ──────────────────────────────────────────────────────────────────────────────
# Core job processor
# ──────────────────────────────────────────────────────────────────────────────

def _process_job(job_data: dict[str, Any]) -> dict[str, Any]:
    """Run the full detection pipeline on one conversation job.

    Expected job_data schema::

        {
          "conversation_id": str,
          "model_id": str,
          "firm_id": str,
          "turns": [
              {"speaker": "user"|"ai", "text": str, "turn_index": int},
              ...
          ]
        }

    Returns a result dict with keys:
        conversation_id, tilt_score, pattern_scores, tier2_used, elapsed_ms
    """
    t_start = time.perf_counter()

    conversation_id: str = job_data.get("conversation_id", "unknown")
    turns: list[dict[str, Any]] = job_data.get("turns", [])

    logger.info(
        "Processing conversation %s (%d turns).", conversation_id, len(turns)
    )

    # Filter to AI turns only (only AI turns are analysed for manipulation)
    ai_turns = [t for t in turns if t.get("speaker", "").lower() in ("ai", "assistant", "bot")]

    if not ai_turns:
        logger.info(
            "Conversation %s has no AI turns — skipping analysis.", conversation_id
        )
        tilt_score = 100.0
        pattern_scores: dict[str, float] = {
            "false_urgency": 0.0,
            "topic_hijacking": 0.0,
            "concern_dismissal": 0.0,
            "opinion_injection": 0.0,
            "agenda_persistence": 0.0,
        }
        _update_conversation(conversation_id, len(turns), tilt_score)
        return {
            "conversation_id": conversation_id,
            "tilt_score": tilt_score,
            "pattern_scores": pattern_scores,
            "tier2_used": False,
            "elapsed_ms": round((time.perf_counter() - t_start) * 1000, 2),
        }

    # ── Layer 1: Rule-based pre-filter ────────────────────────────────────────
    all_rule_scores: list[dict[str, float]] = []
    turns_needing_ml: list[dict[str, Any]] = []

    for turn in ai_turns:
        rs = rule_score(turn.get("text", ""))
        all_rule_scores.append(rs)
        if any_score_above(rs, threshold=0.3):
            turns_needing_ml.append({"turn": turn, "rule_scores": rs})

    logger.debug(
        "Conversation %s: %d/%d AI turns flagged by rule filter.",
        conversation_id,
        len(turns_needing_ml),
        len(ai_turns),
    )

    # ── Layer 2: ML classifier (only for flagged turns) ────────────────────
    classifier = _get_classifier()
    all_ml_scores: list[dict[str, float]] = []
    tier2_needed_turns: list[dict[str, Any]] = []

    for item in turns_needing_ml:
        turn = item["turn"]
        ml = classifier.predict(turn.get("text", ""))
        all_ml_scores.append(ml)

        # Escalate to Tier 2 if any ML score > 0.6 (plan spec)
        if any(v > 0.6 for v in ml.values()):
            tier2_needed_turns.append({
                "turn": turn,
                "rule_scores": item["rule_scores"],
                "ml_scores": ml,
            })

    # ── Layer 3: Tier 2 context scorer (only for deeply flagged turns) ─────
    tier2_flags: list[dict] = []
    tier2_used = False

    if tier2_needed_turns:
        logger.info(
            "Conversation %s: escalating %d turns to Tier 2.",
            conversation_id,
            len(tier2_needed_turns),
        )
        tier2_result = tier2_analyze(turns)  # full conversation window
        tier2_flags = tier2_result.get("flags", [])
        tier2_used = True
        logger.info(
            "Conversation %s Tier 2 summary: %s",
            conversation_id,
            tier2_result.get("summary", ""),
        )

    # ── Aggregate scores across all AI turns ─────────────────────────────────
    # Use the maximum per-pattern score observed across all AI turns
    patterns = [
        "false_urgency",
        "topic_hijacking",
        "concern_dismissal",
        "opinion_injection",
        "agenda_persistence",
    ]

    # Aggregate rule scores (max across AI turns)
    agg_rule: dict[str, float] = {p: 0.0 for p in patterns}
    for rs in all_rule_scores:
        for p in patterns:
            agg_rule[p] = max(agg_rule[p], rs.get(p, 0.0))

    # Aggregate ML scores (max across flagged turns that reached ML)
    agg_ml: dict[str, float] = {p: 0.0 for p in patterns}
    for ml in all_ml_scores:
        for p in patterns:
            agg_ml[p] = max(agg_ml[p], ml.get(p, 0.0))

    # ── Signal fusion ─────────────────────────────────────────────────────────
    fused = fuse_scores(agg_rule, agg_ml, tier2_flags if tier2_flags else None)

    # ── TiltScore ─────────────────────────────────────────────────────────────
    tilt_score = calculate_tiltscore(fused, conversation_length=len(turns))

    # ── Write to PostgreSQL ───────────────────────────────────────────────────
    _update_conversation(conversation_id, len(turns), tilt_score)

    elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)

    logger.info(
        "Conversation %s scored: TiltScore=%.1f  patterns=%s  tier2=%s  elapsed=%.1fms",
        conversation_id,
        tilt_score,
        {p: round(v, 3) for p, v in fused.items()},
        tier2_used,
        elapsed_ms,
    )

    return {
        "conversation_id": conversation_id,
        "tilt_score": tilt_score,
        "pattern_scores": fused,
        "tier2_used": tier2_used,
        "elapsed_ms": elapsed_ms,
    }


# ──────────────────────────────────────────────────────────────────────────────
# BullMQ async job handler
# ──────────────────────────────────────────────────────────────────────────────

async def process_job(job: Any, job_token: str) -> dict[str, Any]:  # noqa: ARG001
    """Async wrapper called by the BullMQ Worker for each job.

    Runs the synchronous ``_process_job`` in the default thread-pool executor
    so that the event loop remains responsive.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _process_job, job.data)


# ──────────────────────────────────────────────────────────────────────────────
# Worker entry point
# ──────────────────────────────────────────────────────────────────────────────

def start_worker() -> None:
    """Start the BullMQ analysis worker.  Blocks until SIGTERM/SIGINT."""
    logger.info(
        "Starting analysis worker — queue=%s  redis=%s  concurrency=%d",
        QUEUE_NAME,
        REDIS_URL,
        CONCURRENCY,
    )

    # Pre-load the classifier so the first job doesn't pay the load cost
    _get_classifier()

    worker = Worker(
        QUEUE_NAME,
        process_job,
        {
            "connection": REDIS_URL,
            "concurrency": CONCURRENCY,
        },
    )

    # ── Graceful shutdown on SIGTERM / SIGINT ──────────────────────────────
    shutdown_event = asyncio.Event()

    def _handle_signal(signum: int, _frame: Any) -> None:  # noqa: ARG001
        logger.info("Received signal %d — shutting down worker gracefully.", signum)
        asyncio.get_event_loop().call_soon_threadsafe(shutdown_event.set)

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    async def _run() -> None:
        await shutdown_event.wait()
        logger.info("Closing worker...")
        await worker.close()
        logger.info("Worker stopped.")

    logger.info("Analysis worker ready — waiting for jobs.")
    asyncio.run(_run())


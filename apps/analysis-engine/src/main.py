"""ConvoGuard Analysis Engine — FastAPI application + BullMQ worker.

Usage:
    # HTTP server mode (default)
    uvicorn src.main:app --host 0.0.0.0 --port 8080

    # BullMQ worker mode
    python -m src.main --worker


Endpoints:
    POST /analyze/turn         — analyse a single AI turn
    POST /analyze/conversation — analyse a full conversation
    POST /fetch/url            — fetch & parse a shared conversation URL
    GET  /health               — service health check
    GET  /model/version        — model metadata

Models are loaded at startup.  CORS is enabled for all origins
(tighten in production via the ALLOWED_ORIGINS env var).
"""

from __future__ import annotations

import logging
import time

# IMPORTANT: On Windows, pyarrow must be imported before torch/transformers to prevent DLL access violations!
try:
    import pyarrow  # noqa
except ImportError:
    pass
import os
import pydantic

if "USERNAME" not in os.environ and "USER" not in os.environ:
    os.environ["USER"] = "ConvoGuard"

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from transformers import pipeline

from src.analyzers.concern_dismissal import ConcernDismissalDetector
from src.analyzers.hedge_detector import HedgeDetector
from src.analyzers.persistence_tracker import PersistenceTracker
from src.analyzers.pivot_detector import PivotDetector
from src.analyzers.urgency_signals import UrgencyAnalyzer
from src.analyzers.competitor_bashing import CompetitorBashingDetector
from src.models.classifier import ManipulationClassifier, LABELS
from src.scoring import ConversationScorer, TurnScorer
from src.summary_generator import SummaryGenerator
from src.url_fetcher import FetchError, fetch_conversation
from src.types import (
    ConversationAnalysisRequest,
    ConversationAnalysisResponse,
    ContextMode,
    ConversationTurn,
    FlagResult,
    HealthResponse,
    ModelVersionResponse,
    PatternScores,
    Severity,
    TurnAnalysisRequest,
    TurnAnalysisResponse,
    TurnSummary,
)
from src.license_validator import validator
from src.telemetry import telemetry_tracker, start_heartbeat_thread


# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("analysis_engine")

# ──────────────────────────────────────────────────────────────
# Global state (populated during lifespan startup)
# ──────────────────────────────────────────────────────────────

classifier: ManipulationClassifier | None = None
urgency_analyzer: UrgencyAnalyzer | None = None
pivot_detector: PivotDetector | None = None
hedge_detector: HedgeDetector | None = None
persistence_tracker: PersistenceTracker | None = None
concern_detector: ConcernDismissalDetector | None = None
bashing_detector: CompetitorBashingDetector | None = None
turn_scorer: TurnScorer | None = None
conversation_scorer: ConversationScorer | None = None
summary_generator: SummaryGenerator | None = None
zero_shot_classifier = None
_models_loaded: bool = False


# ──────────────────────────────────────────────────────────────
# Lifespan — load models on startup
# ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Load all models and analysers at startup."""
    global classifier, urgency_analyzer, pivot_detector, hedge_detector
    global persistence_tracker, concern_detector, bashing_detector
    global turn_scorer, conversation_scorer, summary_generator, zero_shot_classifier, _models_loaded

    logger.info("Starting Analysis Engine — loading models...")

    model_dir = Path(os.getenv("MODEL_DIR", "models/manipulation_classifier")).resolve()

    try:
        classifier = ManipulationClassifier(model_dir=model_dir)
        urgency_analyzer = UrgencyAnalyzer()
        pivot_detector = PivotDetector()
        hedge_detector = HedgeDetector()
        persistence_tracker = PersistenceTracker()
        concern_detector = ConcernDismissalDetector()
        bashing_detector = CompetitorBashingDetector()
        
        logger.info("Loading Zero-Shot Semantic Classifier...")
        zero_shot_classifier = pipeline("zero-shot-classification", model="cross-encoder/nli-distilroberta-base")
        
        turn_scorer = TurnScorer(zero_shot_classifier=zero_shot_classifier)
        conversation_scorer = ConversationScorer()
        summary_generator = SummaryGenerator()
        _models_loaded = True
        
        # Start telemetry heartbeat worker (Flaws 4, 6, 8, 9)
        start_heartbeat_thread()
        
        logger.info(
            "All models loaded.  Classifier mode: %s", classifier.mode
        )
    except Exception:
        logger.exception("Failed to load models — service degraded.")
        _models_loaded = False

    yield  # serve requests

    logger.info("Shutting down Analysis Engine.")


# ──────────────────────────────────────────────────────────────
# App creation
# ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="ConvoGuard Analysis Engine",
    version="1.0.0",
    description="Real-time AI manipulation detection and scoring.",
    lifespan=lifespan,
)

# CORS
_allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────
# Health / version
# ──────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Service health check."""
    return HealthResponse(
        status="ok" if _models_loaded else "degraded",
        version="1.0.0",
        models_loaded=_models_loaded,
        classifier_mode=classifier.mode if classifier else "unavailable",
    )


@app.get("/model/version", response_model=ModelVersionResponse)
async def model_version() -> ModelVersionResponse:
    """Return loaded model metadata."""
    return ModelVersionResponse(
        classifier_version=classifier.version if classifier else "unavailable",
        sentence_model="sentence-transformers/all-MiniLM-L6-v2",
        classifier_mode=classifier.mode if classifier else "unavailable",
        labels=list(LABELS),
    )


@app.get("/diagnostics")
async def diagnostics(request: Request):
    """Return comprehensive support diagnostics (Flaw 5)."""
    # SECURITY FIX: Restrict to localhost
    if request.client and request.client.host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Diagnostics endpoint is restricted to localhost")

    import time
    from src.license_validator import validator
    from src.telemetry import telemetry_tracker

    license_status = "VALID"
    expires_in_days = 0
    limit = 0
    try:
        if not validator.current_license:
            validator.validate()
        payload = validator.current_license
        exp = payload.get("exp", 0)
        limit = payload.get("turn_limit_per_week", 0)
        now = int(time.time())
        if now > exp:
            license_status = "EXPIRED"
        else:
            expires_in_days = round((exp - now) / 86400, 1)
    except Exception as e:
        license_status = f"INVALID: {e}"

    unsynced = telemetry_tracker.get_unsynced_turns()

    return {
        "license_status": license_status,
        "license_expires_in_days": expires_in_days,
        "model_loaded": _models_loaded,
        "telemetry_pending_turns": len(unsynced),
        "plan_limit_this_week": limit,
        "engine_version": "1.4.2",
        "update_available": False
    }


# ──────────────────────────────────────────────────────────────
# POST /analyze/turn
# ──────────────────────────────────────────────────────────────

@app.post("/analyze/turn", response_model=TurnAnalysisResponse)
async def analyze_turn(req: TurnAnalysisRequest) -> TurnAnalysisResponse:
    """Analyse a single AI assistant turn for manipulation patterns."""
    _assert_loaded()
    # SECURITY FIX (Flaw 1): Validate time-locked license locally before processing
    try:
        validator.validate()
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"License Invalid: {e}")

    assert classifier and urgency_analyzer and pivot_detector and hedge_detector
    assert persistence_tracker and concern_detector and bashing_detector and turn_scorer

    start = time.perf_counter()
    text = req.turn.content

    # ── ML classifier scores ──
    ml_scores = classifier.predict(text)

    # ── Rule-based analyser scores ──
    rule_scores: dict[str, float] = {}

    # Urgency
    urgency_result = urgency_analyzer.analyze(text)
    rule_scores["false_urgency"] = urgency_result.score

    # Hedge / opinion injection
    hedge_result = hedge_detector.analyze(text)
    rule_scores["opinion_injection"] = hedge_result.score

    # Pivot / topic hijacking
    user_text = ""
    if req.user_turn:
        user_text = req.user_turn.content
    elif req.previous_turns:
        # Take the last user turn (treat 'human' as user too)
        for t in reversed(req.previous_turns):
            if t.role in ("user", "human"):
                user_text = t.content
                break
    if user_text:
        try:
            pivot_result = pivot_detector.analyze(user_text, text)
            rule_scores["topic_hijacking"] = pivot_result.score
        except Exception:
            logger.warning(
                "PivotDetector failed (model may not be downloaded yet) — "
                "falling back to rule-based topic_hijacking score."
            )
            # Fall back to classifier rule score if semantic model unavailable
            rule_scores["topic_hijacking"] = ml_scores.get("topic_hijacking", 0.0)
    else:
        # No user context: still use the rule-based classifier score so
        # assistant-only conversations aren't silently zeroed out
        rule_scores["topic_hijacking"] = ml_scores.get("topic_hijacking", 0.0)

    # Persistence
    ai_history = [t.content for t in req.previous_turns if t.role in ("assistant", "ai", "bot")]
    user_history = [t.content for t in req.previous_turns if t.role in ("user", "human")]
    ai_history.append(text)
    if user_text:
        user_history.append(user_text)
    persistence_result = persistence_tracker.analyze(ai_history, user_history)
    rule_scores["agenda_persistence"] = persistence_result.score

    # Concern dismissal
    if user_text:
        try:
            concern_result = concern_detector.analyze(user_text, text)
            rule_scores["concern_dismissal"] = concern_result.score
        except Exception:
            logger.warning("ConcernDismissalDetector failed — scoring 0.")
            rule_scores["concern_dismissal"] = 0.0
    else:
        # No user context — use classifier score as proxy
        rule_scores["concern_dismissal"] = ml_scores.get("concern_dismissal", 0.0)

    # Competitor bashing
    bashing_result = bashing_detector.analyze(text)
    rule_scores["competitor_bashing"] = bashing_result.score

    logger.debug(
        "analyze_turn [%d]: ml=%s  rule=%s",
        req.turn.turn_index, ml_scores, rule_scores
    )

    # ── Scoring ──
    pattern_scores, final_score, flagged, severity, flags = turn_scorer.score(
        ml_scores,
        rule_scores,
        text=text,
        ignored_categories=req.ignored_categories,
        custom_rules=req.custom_rules,
        context_mode=req.context_mode,
        user_turn_text=user_text,
    )

    elapsed_ms = (time.perf_counter() - start) * 1000

    # Record turn for telemetry (Flaw 4)
    org_id = validator.current_license.get("org_id", "unknown") if validator.current_license else "unknown"
    telemetry_tracker.record_turn(req.turn.turn_index, org_id)

    return TurnAnalysisResponse(
        conversation_id=req.conversation_id,
        turn_index=req.turn.turn_index,
        final_score=final_score,
        flagged=flagged,
        severity=severity,
        pattern_scores=pattern_scores,
        ml_scores=PatternScores(**ml_scores),
        rule_scores=PatternScores(**rule_scores),
        flags=flags,
        analysis_ms=round(elapsed_ms, 2),
    )


# ──────────────────────────────────────────────────────────────
# POST /analyze/conversation
# ──────────────────────────────────────────────────────────────

@app.post("/analyze/conversation", response_model=ConversationAnalysisResponse)
async def analyze_conversation(req: ConversationAnalysisRequest) -> ConversationAnalysisResponse:
    """Analyse a full conversation for manipulation patterns."""
    _assert_loaded()
    # SECURITY FIX (Flaw 1): Validate time-locked license locally before processing
    try:
        validator.validate()
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"License Invalid: {e}")

    assert classifier and urgency_analyzer and pivot_detector and hedge_detector
    assert persistence_tracker and concern_detector and turn_scorer
    assert conversation_scorer and summary_generator

    start = time.perf_counter()

    turn_results: list[TurnSummary] = []
    all_flags: list[FlagResult] = []

    tasks = []
    for i, turn in enumerate(req.turns):
        effective_role = "assistant" if turn.role not in ("user", "human") else "user"
        if effective_role != "user":
            previous_turns = req.turns[:i]
            user_turn = None
            for t in reversed(previous_turns):
                if t.role in ("user", "human"):
                    user_turn = t
                    break

            normalised_turn = ConversationTurn(
                role="assistant",
                content=turn.content,
                turn_index=turn.turn_index,
                timestamp=turn.timestamp,
            )

            sub_req = TurnAnalysisRequest(
                conversation_id=req.conversation_id,
                turn=normalised_turn,
                previous_turns=previous_turns,
                user_turn=user_turn,
                ignored_categories=req.ignored_categories,
                custom_rules=req.custom_rules,
                context_mode=req.context_mode,
            )
            tasks.append((i, analyze_turn(sub_req)))

    import asyncio
    assistant_results = {}
    if tasks:
        coroutines = [t[1] for t in tasks]
        results = await asyncio.gather(*coroutines)
        for t, res in zip(tasks, results):
            assistant_results[t[0]] = res

    for i, turn in enumerate(req.turns):
        effective_role = "assistant" if turn.role not in ("user", "human") else "user"
        if effective_role == "user":
            turn_results.append(TurnSummary(
                turn_index=turn.turn_index,
                role=turn.role,
                final_score=0.0,
                flagged=False,
                severity=Severity.NONE,
                pattern_scores=PatternScores(),
            ))
        else:
            result = assistant_results[i]
            turn_summary = TurnSummary(
                turn_index=turn.turn_index,
                role=turn.role,
                final_score=result.final_score,
                flagged=result.flagged,
                severity=result.severity,
                pattern_scores=result.pattern_scores,
                flags=result.flags,
            )
            turn_results.append(turn_summary)
            all_flags.extend(result.flags)

    # ── Conversation scoring ──
    tilt_score, tilt_grade, overall_severity, pattern_breakdown = conversation_scorer.score(
        turn_results
    )

    flagged_turns = sum(1 for tr in turn_results if tr.flagged)

    # ── Summary ──
    summary = summary_generator.generate(
        tilt_score=tilt_score,
        tilt_grade=tilt_grade,
        total_turns=len(req.turns),
        flagged_turns=flagged_turns,
        overall_severity=overall_severity,
        pattern_breakdown=pattern_breakdown,
        all_flags=all_flags,
    )

    elapsed_ms = (time.perf_counter() - start) * 1000

    return ConversationAnalysisResponse(
        conversation_id=req.conversation_id,
        tilt_score=tilt_score,
        tilt_grade=tilt_grade,
        total_turns=len(req.turns),
        flagged_turns=flagged_turns,
        overall_severity=overall_severity,
        pattern_breakdown=pattern_breakdown,
        turn_results=turn_results,
        summary=summary,
        analysis_ms=round(elapsed_ms, 2),
    )


# ──────────────────────────────────────────────────────────────
# POST /fetch/url
# ──────────────────────────────────────────────────────────────

class FetchUrlRequest(pydantic.BaseModel):
    url: str = pydantic.Field(..., description="Shared conversation URL to fetch")


class FetchedTurn(pydantic.BaseModel):
    turn_index: int
    role: str
    content: str


class FetchUrlResponse(pydantic.BaseModel):
    platform: str
    title: str
    turns: list[FetchedTurn]
    turn_count: int
    warning: str | None = None


@app.post("/fetch/url", response_model=FetchUrlResponse)
async def fetch_url(req: FetchUrlRequest) -> FetchUrlResponse:
    """Fetch a shared AI conversation URL and return parsed turns."""
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="URL must start with http:// or https://")

    try:
        result = await fetch_conversation(url)
    except FetchError as exc:
        status = 422 if not exc.recoverable else 502
        raise HTTPException(status_code=status, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error fetching URL: %s", url)
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")

    turns = [
        FetchedTurn(
            turn_index=t.get("turn_index", i),
            role=t.get("role", "user"),
            content=t.get("content", ""),
        )
        for i, t in enumerate(result["turns"])
        if t.get("content", "").strip()
    ]

    return FetchUrlResponse(
        platform=result["platform"],
        title=result.get("title", "Imported Conversation"),
        turns=turns,
        turn_count=len(turns),
        warning=result.get("warning"),
    )


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _assert_loaded() -> None:
    """Raise 503 if models are not loaded."""
    if not _models_loaded:
        raise HTTPException(
            status_code=503,
            detail="Analysis engine models not loaded. Service is degraded.",
        )


# ──────────────────────────────────────────────────────────────
# CLI entry point — `python -m src.main --worker`
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(
        description="ConvoGuard Analysis Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python -m src.main                # start HTTP server\n"
            "  python -m src.main --worker       # start BullMQ analysis worker\n"
        ),
    )
    parser.add_argument(
        "--worker",
        action="store_true",
        default=False,
        help="Start the BullMQ Redis worker instead of the HTTP server.",
    )
    parser.add_argument(
        "--host",
        default=os.getenv("HOST", "0.0.0.0"),
        help="HTTP server bind host (default: 0.0.0.0).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("PORT", "8080")),
        help="HTTP server bind port (default: 8080).",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=False,
        help="Enable uvicorn auto-reload (development only).",
    )

    args = parser.parse_args()

    if args.worker:
        # ── BullMQ worker mode ────────────────────────────────────────────────
        logger.info("Launching BullMQ analysis worker...")
        from src.worker import start_worker

        start_worker()
    else:
        # ── HTTP server mode (default) ────────────────────────────────────────
        logger.info(
            "Launching HTTP server on %s:%d (reload=%s)...",
            args.host,
            args.port,
            args.reload,
        )
        uvicorn.run(
            "src.main:app",
            host=args.host,
            port=args.port,
            reload=args.reload,
            log_level=LOG_LEVEL.lower(),
        )

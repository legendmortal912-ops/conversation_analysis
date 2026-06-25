"""
ConvoGuard Python SDK Client

Real-time AI manipulation detection for your chatbots,
sales bots, support bots, and AI agents.

Usage:
    from convoguard import ConvoGuard

    cg = ConvoGuard(api_key="cg_live_...", project_id="proj_...")

    conv = cg.start_conversation()
    cg.add_turn(conv.id, "user", user_message)
    result = cg.add_turn(conv.id, "ai", ai_response)
    print(result.analysis.flags)  # Real-time manipulation flags

    final = cg.end_conversation(conv.id)
    print(f"TiltScore: {final.tilt_score}/100 ({final.grade})")

    # Context manager:
    with cg.conversation() as conv:
        cg.add_turn(conv.id, "user", "Hello")
        cg.add_turn(conv.id, "ai", "Hi there!")
"""

from __future__ import annotations

import time
import logging
from contextlib import contextmanager
from typing import Any, Generator, Optional

import httpx

from convoguard.types import (
    Conversation,
    Turn,
    TurnAnalysis,
    ConversationResult,
    PatternScores,
    Flag,
)

logger = logging.getLogger("convoguard")

DEFAULT_ENDPOINT = "https://api.convoguard.dev"
DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3


class ConvoGuardError(Exception):
    """Base exception for ConvoGuard SDK errors."""

    def __init__(self, message: str, status_code: int = 0, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class ConvoGuard:
    """
    ConvoGuard SDK client.

    Args:
        api_key: Your ConvoGuard API key (starts with cg_live_).
        project_id: The project ID to send data to.
        mode: 'realtime' returns analysis inline; 'batch' queues for async.
        endpoint: Custom API endpoint URL.
        timeout: Request timeout in seconds (default: 30).
        max_retries: Maximum retry attempts for failed requests (default: 3).
    """

    def __init__(
        self,
        api_key: str,
        project_id: str,
        mode: str = "realtime",
        endpoint: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        if not api_key:
            raise ValueError("ConvoGuard: api_key is required")
        if not project_id:
            raise ValueError("ConvoGuard: project_id is required")

        self._api_key = api_key
        self._project_id = project_id
        self._mode = mode
        self._endpoint = (endpoint or DEFAULT_ENDPOINT).rstrip("/")
        self._timeout = timeout
        self._max_retries = max_retries
        self._client = httpx.Client(
            timeout=timeout,
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
                "User-Agent": "convoguard-py/1.0.0",
            },
        )

    def start_conversation(
        self,
        external_id: Optional[str] = None,
        user_metadata: Optional[dict[str, Any]] = None,
    ) -> Conversation:
        """
        Start a new conversation.

        Args:
            external_id: Your internal conversation ID for cross-referencing.
            user_metadata: Arbitrary metadata about the end user (e.g., plan, region).

        Returns:
            A Conversation object with the ConvoGuard conversation ID.
        """
        data: dict[str, Any] = {"project_id": self._project_id}
        if external_id:
            data["external_id"] = external_id
        if user_metadata:
            data["user_metadata"] = user_metadata

        response = self._request("POST", "/v1/conversations", json=data)
        return Conversation(
            id=response["conversation_id"],
            project_id=response.get("project_id", self._project_id),
            external_id=response.get("external_id"),
            status=response.get("status", "active"),
            started_at=response.get("started_at", ""),
        )

    def add_turn(
        self,
        conversation_id: str,
        speaker: str,
        content: str,
        timestamp: Optional[str] = None,
    ) -> Turn:
        """
        Add a turn (message) to a conversation.

        AI turns are analyzed for manipulation patterns. In 'realtime' mode,
        analysis results are returned inline.

        Args:
            conversation_id: The conversation ID from start_conversation().
            speaker: Either 'user' or 'ai'.
            content: The message content.
            timestamp: Optional ISO 8601 timestamp.

        Returns:
            A Turn object, with optional analysis results for AI turns.
        """
        data: dict[str, Any] = {"speaker": speaker, "content": content}
        if timestamp:
            data["timestamp"] = timestamp

        response = self._request(
            "POST",
            f"/v1/conversations/{conversation_id}/turns",
            json=data,
        )

        turn = Turn(
            turn_id=response["turn_id"],
            conversation_id=conversation_id,
            speaker=speaker,  # type: ignore[arg-type]
            status=response.get("status", "recorded"),
            timestamp=response.get("timestamp", ""),
        )

        # Parse analysis results if present
        if "analysis" in response and response["analysis"]:
            analysis_data = response["analysis"]
            patterns_data = analysis_data.get("patterns", {})
            flags_data = analysis_data.get("flags", [])

            turn.analysis = TurnAnalysis(
                manipulation_score=analysis_data.get("manipulation_score", 0),
                answered_question=analysis_data.get("answered_question", True),
                patterns=PatternScores(
                    topic_hijacking=patterns_data.get("topic_hijacking", 0.0),
                    opinion_injection=patterns_data.get("opinion_injection", 0.0),
                    false_urgency=patterns_data.get("false_urgency", 0.0),
                    concern_dismissal=patterns_data.get("concern_dismissal", 0.0),
                    agenda_persistence=patterns_data.get("agenda_persistence", 0.0),
                ),
                flags=[
                    Flag(
                        pattern=f.get("pattern", ""),
                        severity=f.get("severity", "low"),
                        confidence=f.get("confidence", 0.0),
                        excerpt=f.get("excerpt", ""),
                        explanation=f.get("explanation", ""),
                    )
                    for f in flags_data
                ],
            )

        return turn

    def end_conversation(self, conversation_id: str) -> ConversationResult:
        """
        End a conversation and trigger final scoring.

        Returns the final TiltScore, grade, summary, and all flags.

        Args:
            conversation_id: The conversation ID to end.

        Returns:
            A ConversationResult with the final TiltScore and grade.
        """
        response = self._request(
            "POST",
            f"/v1/conversations/{conversation_id}/end",
            json={"ended_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
        )

        return ConversationResult(
            conversation_id=response.get("conversation_id", conversation_id),
            tilt_score=response.get("tilt_score", 0),
            grade=response.get("grade", "A"),
            total_turns=response.get("total_turns", 0),
            flagged_turns=response.get("flagged_turns", 0),
            summary=response.get("summary", ""),
            flags=[
                Flag(
                    pattern=f.get("pattern", ""),
                    severity=f.get("severity", "low"),
                    confidence=f.get("confidence", 0.0),
                    excerpt=f.get("excerpt", ""),
                    explanation=f.get("explanation", ""),
                )
                for f in response.get("flags", [])
            ],
            ended_at=response.get("ended_at", ""),
        )

    @contextmanager
    def conversation(
        self,
        external_id: Optional[str] = None,
        user_metadata: Optional[dict[str, Any]] = None,
    ) -> Generator[Conversation, None, None]:
        """
        Context manager for a conversation session.
        Automatically ends the conversation when the block exits.

        Usage:
            with cg.conversation() as conv:
                cg.add_turn(conv.id, "user", "Hello")
                result = cg.add_turn(conv.id, "ai", "Hi!")
        """
        conv = self.start_conversation(
            external_id=external_id,
            user_metadata=user_metadata,
        )
        try:
            yield conv
        finally:
            self.end_conversation(conv.id)

    def _request(
        self,
        method: str,
        path: str,
        json: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Make an HTTP request with retry logic and exponential backoff."""
        url = f"{self._endpoint}{path}"
        last_error: Optional[Exception] = None

        for attempt in range(self._max_retries + 1):
            try:
                response = self._client.request(method, url, json=json)

                if response.status_code >= 400 and response.status_code < 500 and response.status_code != 429:
                    body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                    raise ConvoGuardError(
                        body.get("message", f"HTTP {response.status_code}"),
                        status_code=response.status_code,
                        body=body,
                    )

                if response.is_success:
                    return response.json()

                last_error = ConvoGuardError(
                    f"HTTP {response.status_code}",
                    status_code=response.status_code,
                )
            except httpx.RequestError as e:
                last_error = e

            # Exponential backoff with jitter
            if attempt < self._max_retries:
                delay = min(0.5 * (2 ** attempt) + 0.1 * time.time() % 1, 10.0)
                logger.debug(f"Retrying in {delay:.1f}s (attempt {attempt + 1}/{self._max_retries})")
                time.sleep(delay)

        raise last_error or ConvoGuardError("Request failed after retries")

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self) -> "ConvoGuard":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


class AsyncConvoGuard:
    """
    Async version of the ConvoGuard SDK client.
    All methods are async and use httpx.AsyncClient.

    Usage:
        async with AsyncConvoGuard(api_key="...", project_id="...") as cg:
            conv = await cg.start_conversation()
            await cg.add_turn(conv.id, "user", message)
    """

    def __init__(
        self,
        api_key: str,
        project_id: str,
        mode: str = "realtime",
        endpoint: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self._api_key = api_key
        self._project_id = project_id
        self._mode = mode
        self._endpoint = (endpoint or DEFAULT_ENDPOINT).rstrip("/")
        self._timeout = timeout
        self._max_retries = max_retries
        self._client = httpx.AsyncClient(
            timeout=timeout,
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
                "User-Agent": "convoguard-py/1.0.0",
            },
        )

    async def start_conversation(
        self,
        external_id: Optional[str] = None,
        user_metadata: Optional[dict[str, Any]] = None,
    ) -> Conversation:
        """Start a new conversation (async)."""
        data: dict[str, Any] = {"project_id": self._project_id}
        if external_id:
            data["external_id"] = external_id
        if user_metadata:
            data["user_metadata"] = user_metadata

        response = await self._request("POST", "/v1/conversations", json=data)
        return Conversation(
            id=response["conversation_id"],
            project_id=response.get("project_id", self._project_id),
            external_id=response.get("external_id"),
            status=response.get("status", "active"),
            started_at=response.get("started_at", ""),
        )

    async def add_turn(
        self,
        conversation_id: str,
        speaker: str,
        content: str,
        timestamp: Optional[str] = None,
    ) -> Turn:
        """Add a turn to a conversation (async)."""
        data: dict[str, Any] = {"speaker": speaker, "content": content}
        if timestamp:
            data["timestamp"] = timestamp

        response = await self._request(
            "POST",
            f"/v1/conversations/{conversation_id}/turns",
            json=data,
        )

        return Turn(
            turn_id=response["turn_id"],
            conversation_id=conversation_id,
            speaker=speaker,  # type: ignore[arg-type]
            status=response.get("status", "recorded"),
            timestamp=response.get("timestamp", ""),
        )

    async def end_conversation(self, conversation_id: str) -> ConversationResult:
        """End a conversation and trigger scoring (async)."""
        response = await self._request(
            "POST",
            f"/v1/conversations/{conversation_id}/end",
            json={},
        )

        return ConversationResult(
            conversation_id=response.get("conversation_id", conversation_id),
            tilt_score=response.get("tilt_score", 0),
            grade=response.get("grade", "A"),
        )

    async def _request(
        self,
        method: str,
        path: str,
        json: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Make an async HTTP request with retry logic."""
        import asyncio

        url = f"{self._endpoint}{path}"
        last_error: Optional[Exception] = None

        for attempt in range(self._max_retries + 1):
            try:
                response = await self._client.request(method, url, json=json)
                if response.is_success:
                    return response.json()
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    body = response.json()
                    raise ConvoGuardError(
                        body.get("message", f"HTTP {response.status_code}"),
                        status_code=response.status_code,
                        body=body,
                    )
                last_error = ConvoGuardError(f"HTTP {response.status_code}", status_code=response.status_code)
            except httpx.RequestError as e:
                last_error = e

            if attempt < self._max_retries:
                await asyncio.sleep(min(0.5 * (2 ** attempt), 10.0))

        raise last_error or ConvoGuardError("Request failed")

    async def close(self) -> None:
        """Close the async HTTP client."""
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncConvoGuard":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

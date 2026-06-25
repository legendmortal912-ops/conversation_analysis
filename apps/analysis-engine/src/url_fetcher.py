"""url_fetcher.py — Fetch and parse AI conversation links.

Supported platforms:
    chatgpt   — chat.openai.com/share/* or chatgpt.com/share/*
                Extracts conversation from embedded __NEXT_DATA__ JSON.
    claude    — claude.ai/share/* (returns helpful error; no public share API)
    generic   — Best-effort: fetches HTML, strips tags, runs conversation parser.

All functions return a list of dicts ready to be cast to ConversationTurn.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────

_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_FETCH_TIMEOUT = 15.0  # seconds

# Platforms that require login / JS rendering — give a helpful error
_UNSUPPORTED_PLATFORMS: dict[str, str] = {
    "character.ai":   "Character.ai requires login to view shared conversations. Please export the chat as a text file and use 'Import File' instead.",
    "poe.com":        "Poe conversations are JavaScript-rendered and cannot be fetched directly. Please copy the conversation text and use 'Paste JSON' or 'Import File' instead.",
    "gemini.google.com": "Gemini conversations are JavaScript-rendered and cannot be fetched directly. Please export the chat file and use 'Import File'.",
    "g.co":              "Gemini conversations are JavaScript-rendered and cannot be fetched directly. Please export the chat file and use 'Import File'.",
    "bard.google.com":   "Bard/Gemini conversations are JavaScript-rendered and cannot be fetched directly. Please export the chat file and use 'Import File'.",
    "bing.com":       "Microsoft Copilot conversations cannot be fetched directly. Please copy the conversation and use 'Paste JSON'.",
    "copilot.microsoft.com": "Microsoft Copilot conversations cannot be fetched directly. Please copy the conversation and use 'Paste JSON'.",
}

# Role normalisation maps
_USER_ROLES    = {"user", "human", "you", "me", "customer", "client"}
_ASST_ROLES    = {"assistant", "ai", "bot", "model", "gpt", "chatgpt", "claude", "gemini", "system"}


# ─────────────────────────────────────────────────────────────────
# Public entry-point
# ─────────────────────────────────────────────────────────────────

def detect_platform(url: str) -> str:
    """Return a short platform identifier string from a URL."""
    host = urlparse(url).netloc.lower().lstrip("www.")
    if "openai.com" in host or "chatgpt.com" in host:
        return "chatgpt"
    if "claude.ai" in host:
        return "claude"
    for key in _UNSUPPORTED_PLATFORMS:
        if key in host:
            return key
    return "generic"


async def fetch_conversation(url: str) -> dict[str, Any]:
    """Fetch a shared conversation URL and return parsed turns.

    Returns a dict with keys:
        platform    str
        title       str
        turns       list[dict]  (role, content, turn_index)
        turn_count  int
        warning     str | None
    """
    platform = detect_platform(url)
    logger.info("fetch_conversation: url=%s platform=%s", url, platform)

    # Fast-fail for known unsupported platforms
    if platform in _UNSUPPORTED_PLATFORMS:
        raise FetchError(_UNSUPPORTED_PLATFORMS[platform], platform=platform, recoverable=False)

    html = await _http_get(url)

    if platform == "chatgpt":
        return _parse_chatgpt(html, url)
    if platform == "claude":
        return _parse_claude(html, url)
    return _parse_generic(html, url)


# ─────────────────────────────────────────────────────────────────
# HTTP helper
# ─────────────────────────────────────────────────────────────────

async def _http_get(url: str) -> str:
    """Perform an async GET with a browser User-Agent."""
    headers = {
        "User-Agent": _BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=_FETCH_TIMEOUT) as client:
        try:
            resp = await client.get(url, headers=headers)
        except httpx.TimeoutException:
            raise FetchError(
                "The request timed out. The server may be slow or the URL may be invalid.",
                recoverable=True,
            )
        except httpx.RequestError as exc:
            raise FetchError(f"Network error: {exc}", recoverable=True)

    if resp.status_code == 401 or resp.status_code == 403:
        raise FetchError(
            "This conversation is private or requires login. Only publicly shared links work.",
            recoverable=False,
        )
    if resp.status_code == 404:
        raise FetchError(
            "Conversation not found. The link may have expired or been deleted.",
            recoverable=False,
        )
    if resp.status_code >= 400:
        raise FetchError(
            f"Server returned HTTP {resp.status_code}. The link may be invalid.",
            recoverable=False,
        )

    return resp.text


# ─────────────────────────────────────────────────────────────────
# ChatGPT parser
# ─────────────────────────────────────────────────────────────────

def _parse_chatgpt(html: str, url: str) -> dict[str, Any]:
    """Extract conversation from ChatGPT's __NEXT_DATA__ JSON blob or modern Flight stream."""
    try:
        from .chatpeek_parser import parse_share_html, ReplyType
        chat = parse_share_html(html)
        turns: list[dict[str, Any]] = []
        for i, reply in enumerate(chat.replies):
            role = "user" if reply.type == ReplyType.HUMAN else "assistant"
            turns.append({
                "role": role,
                "content": reply.statement,
                "turn_index": i
            })
        if turns:
            return {
                "platform": "chatgpt",
                "title": chat.title,
                "turns": turns,
                "turn_count": len(turns),
                "warning": None,
            }
        else:
            raise FetchError("The shared conversation is empty, or the link is invalid/expired.", recoverable=False)
    except FetchError:
        raise
    except Exception as exc:
        logger.warning("Modern ChatGPT parser failed: %s", exc)

    # Legacy fallback
    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", {"id": "__NEXT_DATA__"})

    if not script or not script.string:
        # Maybe they changed the structure — try generic fallback
        logger.warning("ChatGPT __NEXT_DATA__ not found, falling back to generic parser")
        result = _parse_generic(html, url)
        result["warning"] = (
            "ChatGPT's page structure may have changed. "
            "Conversation was extracted using the generic parser — results may be incomplete."
        )
        return result

    try:
        data = json.loads(script.string)
    except json.JSONDecodeError as exc:
        raise FetchError(f"Failed to parse ChatGPT page data: {exc}", recoverable=False)

    # Navigate to the conversation mapping
    # Structure: props.pageProps.serverResponse.data  (or similar)
    turns: list[dict[str, Any]] = []
    title = "ChatGPT Conversation"

    try:
        server_response = (
            data.get("props", {})
                .get("pageProps", {})
                .get("serverResponse", {})
        )
        convo_data = server_response.get("data", {})

        # Title
        title = convo_data.get("title", title)

        # The mapping is a dict of node_id → node
        mapping: dict = convo_data.get("mapping", {})

        if mapping:
            turns = _extract_turns_from_mapping(mapping)
        else:
            # Fallback: try linear messages array
            messages = convo_data.get("messages", [])
            turns = _extract_turns_from_messages_array(messages)

    except Exception as exc:
        logger.warning("Error navigating ChatGPT JSON: %s — using generic fallback", exc)
        result = _parse_generic(html, url)
        result["platform"] = "chatgpt"
        result["warning"] = "ChatGPT JSON structure has changed. Used text extraction fallback."
        return result

    if not turns:
        # Nothing found — last resort: plain text extraction
        result = _parse_generic(html, url)
        result["platform"] = "chatgpt"
        result["warning"] = "Could not extract structured turns from ChatGPT JSON. Used text fallback."
        return result

    return {
        "platform": "chatgpt",
        "title": title,
        "turns": turns,
        "turn_count": len(turns),
        "warning": None,
    }


def _extract_turns_from_mapping(mapping: dict) -> list[dict[str, Any]]:
    """Walk the ChatGPT conversation graph and return ordered turns."""
    # Build a list of nodes sorted by their position in the conversation chain
    nodes = list(mapping.values())

    # Find root: node with no parent or whose parent is not in the mapping
    def find_children(parent_id: str) -> list[str]:
        return [
            nid for nid, node in mapping.items()
            if node.get("parent") == parent_id and node.get("message")
        ]

    # Start from nodes that have no parent (root) or parent not in map
    root_ids = [
        nid for nid, node in mapping.items()
        if node.get("parent") is None or node.get("parent") not in mapping
    ]

    # Walk the tree depth-first following first child of each node
    visited: set[str] = set()
    ordered: list[dict] = []

    def walk(node_id: str) -> None:
        if node_id in visited or node_id not in mapping:
            return
        visited.add(node_id)
        node = mapping[node_id]
        msg = node.get("message")
        if msg:
            ordered.append(msg)
        # Follow children (take last child = most recent branch)
        children = node.get("children", [])
        if children:
            walk(children[-1])

    for rid in root_ids:
        walk(rid)

    # If walk found nothing (different tree structure), just process all nodes
    if not ordered:
        ordered = [
            node["message"] for node in nodes
            if node.get("message")
        ]

    return _normalise_chatgpt_messages(ordered)


def _extract_turns_from_messages_array(messages: list) -> list[dict[str, Any]]:
    """Handle ChatGPT JSON where messages is a flat list."""
    return _normalise_chatgpt_messages(messages)


def _normalise_chatgpt_messages(messages: list) -> list[dict[str, Any]]:
    """Convert raw ChatGPT message objects to ConversationTurn dicts."""
    turns: list[dict[str, Any]] = []
    idx = 0
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        author = msg.get("author", {})
        role_raw: str = author.get("role", "") if isinstance(author, dict) else ""
        if not role_raw or role_raw == "system":
            continue  # skip system prompts

        # Extract content
        content_block = msg.get("content", {})
        text = ""
        if isinstance(content_block, str):
            text = content_block
        elif isinstance(content_block, dict):
            parts = content_block.get("parts", [])
            text = " ".join(str(p) for p in parts if isinstance(p, str) and p.strip())
        elif isinstance(content_block, list):
            text = " ".join(
                p.get("text", "") if isinstance(p, dict) else str(p)
                for p in content_block
            )

        text = text.strip()
        if not text:
            continue

        role = "user" if role_raw.lower() in _USER_ROLES else "assistant"
        turns.append({"role": role, "content": text, "turn_index": idx})
        idx += 1

    return turns


# ─────────────────────────────────────────────────────────────────
# Claude parser
# ─────────────────────────────────────────────────────────────────

def _parse_claude(html: str, url: str) -> dict[str, Any]:
    """Attempt to parse a Claude shared link.

    Claude does not have a public share feature, but if the HTML contains
    conversation content we try to extract it generically.
    """
    # Check if we got a login page
    if "sign in" in html.lower() or "log in" in html.lower() and len(html) < 50_000:
        raise FetchError(
            "Claude.ai requires you to be logged in to view this link. "
            "Please export your Claude conversation via Settings → Privacy → Export Data, "
            "then use 'Import File' to upload the JSON.",
            recoverable=False,
        )

    # Try JSON-LD first
    soup = BeautifulSoup(html, "lxml")
    for script in soup.find_all("script", type="application/json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, dict) and ("messages" in data or "conversation" in data):
                msgs = data.get("messages") or data.get("conversation", [])
                turns = _extract_turns_from_messages_array(msgs)
                if turns:
                    return {
                        "platform": "claude",
                        "title": data.get("title", "Claude Conversation"),
                        "turns": turns,
                        "turn_count": len(turns),
                        "warning": None,
                    }
        except Exception:
            continue

    # Fall back to generic text extraction
    result = _parse_generic(html, url)
    result["platform"] = "claude"
    return result


# ─────────────────────────────────────────────────────────────────
# Generic HTML parser (fallback)
# ─────────────────────────────────────────────────────────────────

def _parse_generic(html: str, url: str) -> dict[str, Any]:
    """Best-effort: strip HTML tags and parse as plain conversation text."""
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "meta", "noscript"]):
        tag.decompose()

    # Detect if this is a JS-only SPA (almost no text)
    text = soup.get_text(separator="\n", strip=True)
    if len(text.strip()) < 200:
        raise FetchError(
            "This page appears to be a JavaScript-rendered app with no readable content. "
            "Please export the conversation as a file and use 'Import File' instead.",
            recoverable=False,
        )

    # Try to extract from common conversation container selectors
    conversation_text = _extract_from_known_selectors(soup) or text

    # Run the line-by-line conversation parser
    turns = _parse_conversation_text(conversation_text)

    title = (soup.find("title") or {}).get_text(strip=True) if soup.find("title") else "Imported Conversation"  # type: ignore[union-attr]

    warning: str | None = None
    if not turns or all(t["role"] == turns[0]["role"] for t in turns):
        warning = (
            "Could not detect conversation structure in this page. "
            "All messages may have been assigned the same role. "
            "Try importing a file instead for better results."
        )

    return {
        "platform": "generic",
        "title": title,
        "turns": turns,
        "turn_count": len(turns),
        "warning": warning,
    }


def _extract_from_known_selectors(soup: BeautifulSoup) -> str | None:
    """Try common CSS selectors used by AI chat platforms."""
    selectors = [
        # ChatGPT-like
        "[data-message-author-role]",
        "[data-testid*='conversation']",
        ".conversation-item",
        ".message",
        # Generic chat
        "[class*='message']",
        "[class*='chat']",
        "[class*='turn']",
        "article",
        "main",
    ]
    for sel in selectors:
        elements = soup.select(sel)
        if len(elements) >= 2:
            return "\n\n".join(el.get_text(separator=" ", strip=True) for el in elements)
    return None


def _parse_conversation_text(text: str) -> list[dict[str, Any]]:
    """Parse plain text into USER/ASSISTANT turns using role markers."""
    USER_RE = re.compile(
        r"^(?:\*\*|__|[\[]|\s)*(?:user|human|you|me|customer|client|patient|person|questioner)"
        r"(?:\*\*|__|[\]])*\s*[:\u003a\uff1a\-\u2013\u2014]\s*",
        re.IGNORECASE,
    )
    ASST_RE = re.compile(
        r"^(?:\*\*|__|[\[]|\s)*(?:assistant|ai|bot|agent|chatgpt|gpt|claude|gemini|doctor|helper)"
        r"(?:\*\*|__|[\]])*\s*[:\u003a\uff1a\-\u2013\u2014]\s*",
        re.IGNORECASE,
    )
    USER_DIV = re.compile(r"^[-=*#]+\s*(?:user|human|you|me|customer)\s*[-=*#]+\s*$", re.IGNORECASE)
    ASST_DIV = re.compile(r"^[-=*#]+\s*(?:assistant|ai|bot|gpt|claude|gemini)\s*[-=*#]+\s*$", re.IGNORECASE)

    msgs: list[dict[str, Any]] = []
    current_role = "user"
    current_text = ""
    idx = 0

    for line in text.split("\n"):
        trimmed = line.strip()
        if USER_RE.match(trimmed) or USER_DIV.match(trimmed):
            if current_text.strip():
                msgs.append({"role": current_role, "content": current_text.strip(), "turn_index": idx})
                idx += 1
            current_role = "user"
            colon = trimmed.find(":")
            current_text = (trimmed[colon + 1:] if colon >= 0 else "") + "\n"
        elif ASST_RE.match(trimmed) or ASST_DIV.match(trimmed):
            if current_text.strip():
                msgs.append({"role": current_role, "content": current_text.strip(), "turn_index": idx})
                idx += 1
            current_role = "assistant"
            colon = trimmed.find(":")
            current_text = (trimmed[colon + 1:] if colon >= 0 else "") + "\n"
        else:
            current_text += line + "\n"

    if current_text.strip():
        msgs.append({"role": current_role, "content": current_text.strip(), "turn_index": idx})

    # No markers found? Split on blank lines and alternate
    has_user = any(m["role"] == "user" for m in msgs)
    has_asst = any(m["role"] == "assistant" for m in msgs)
    if not has_user or not has_asst:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if len(paragraphs) >= 2:
            return [
                {"role": "user" if i % 2 == 0 else "assistant", "content": p, "turn_index": i}
                for i, p in enumerate(paragraphs)
            ]

    return msgs


# ─────────────────────────────────────────────────────────────────
# Custom exception
# ─────────────────────────────────────────────────────────────────

class FetchError(Exception):
    """Raised when a URL cannot be fetched or parsed."""

    def __init__(self, message: str, *, platform: str = "unknown", recoverable: bool = True) -> None:
        super().__init__(message)
        self.platform = platform
        self.recoverable = recoverable

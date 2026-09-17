#!/usr/bin/env python3
"""
Shared security & sanitization primitives for the Pulse news aggregator.

Used by both storage backends (local SQLite in database.py and Supabase/
Postgres in database_supabase.py) so password hashing, session tokens, and
HTML sanitization behave identically regardless of where data is persisted.
"""

from __future__ import annotations

import binascii
import hashlib
import html
import math
import os
import re
import secrets
import time
from datetime import datetime, timezone
from typing import Optional

PBKDF2_ITERATIONS = 260_000
SESSION_TTL_SECONDS = 60 * 60 * 24 * 14  # 14 days

SEED_ADMIN_USERNAME = "admin"
SEED_ADMIN_PASSWORD = "ChangeMe123!"  # documented in README; change immediately after first login

ALLOWED_TAGS = {"b", "strong", "i", "em", "u", "a", "p", "br", "ul", "ol", "li",
                 "blockquote", "code", "pre", "h3", "h4", "span"}

MAX_AVATAR_BYTES = 256 * 1024  # 256KB cap on decoded avatar image data
_AVATAR_DATA_URL_RE = re.compile(r"^data:(image/(?:png|jpeg|jpg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return secrets.token_hex(12)


# --------------------------------------------------------------------------
# Password & token security
# --------------------------------------------------------------------------

def hash_password(password: str, salt: Optional[bytes] = None) -> tuple[str, str]:
    """Return (hash_hex, salt_hex) using PBKDF2-HMAC-SHA256."""
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return binascii.hexlify(digest).decode("ascii"), binascii.hexlify(salt).decode("ascii")


def verify_password(password: str, password_hash: str, salt_hex: str) -> bool:
    salt = binascii.unhexlify(salt_hex)
    candidate, _ = hash_password(password, salt)
    return secrets.compare_digest(candidate, password_hash)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    # Tokens are stored hashed (never in plaintext) so a leaked DB can't be replayed directly.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# Sanitization
# --------------------------------------------------------------------------

_TAG_RE = re.compile(r"</?([a-zA-Z0-9]+)[^>]*>")
_SCRIPT_STYLE_RE = re.compile(r"<(script|style|iframe|object|embed)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_EVENT_ATTR_RE = re.compile(r'\son\w+\s*=\s*("[^"]*"|\'[^\']*\')', re.IGNORECASE)
_JS_HREF_RE = re.compile(r'(href|src)\s*=\s*("javascript:[^"]*"|\'javascript:[^\']*\')', re.IGNORECASE)


def sanitize_rich_text(raw: str) -> str:
    """Whitelist-based sanitizer: strips scripts/styles/event handlers and disallowed tags."""
    if not raw:
        return ""
    text = _SCRIPT_STYLE_RE.sub("", raw)
    text = _EVENT_ATTR_RE.sub("", text)
    text = _JS_HREF_RE.sub("", text)

    def strip_disallowed(match: "re.Match") -> str:
        tag = match.group(1).lower()
        return match.group(0) if tag in ALLOWED_TAGS else ""

    text = _TAG_RE.sub(strip_disallowed, text)
    return text


def plain_excerpt(rich_html: str, limit: int = 240) -> str:
    text = re.sub(r"<[^>]+>", " ", rich_html or "")
    text = html.unescape(re.sub(r"\s+", " ", text)).strip()
    return text[:limit]


def validate_avatar_data_url(data_url: str) -> str:
    """Validate a profile picture is a reasonably small, well-formed image data URL."""
    match = _AVATAR_DATA_URL_RE.match((data_url or "").strip())
    if not match:
        raise ValueError("Avatar must be a PNG, JPEG, GIF, WEBP, or SVG image.")
    decoded_len = len(match.group(2)) * 3 // 4  # approximate decoded byte size from base64 length
    if decoded_len > MAX_AVATAR_BYTES:
        raise ValueError(f"Avatar image must be smaller than {MAX_AVATAR_BYTES // 1024}KB.")
    return match.group(0)


def hot_score(upvotes: int, downvotes: int, created_at: str) -> float:
    """Reddit-style time-decayed 'hot' rank."""
    score = upvotes - downvotes
    order = math.log10(max(abs(score), 1))
    sign = 1 if score > 0 else (-1 if score < 0 else 0)
    try:
        epoch = datetime.fromisoformat(created_at).timestamp()
    except Exception:
        epoch = time.time()
    seconds = epoch - 1_600_000_000
    return round(sign * order + seconds / 45000, 7)

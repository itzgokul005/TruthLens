"""Small shared helpers used across the analysis services and routes."""

import random
import re
import string
from datetime import datetime, timezone


def rand_id(prefix: str) -> str:
    """Mirrors the original JS: prefix + Math.random().toString(36).slice(2, 9)"""
    alphabet = string.digits + string.ascii_lowercase
    token = "".join(random.choice(alphabet) for _ in range(7))
    return f"{prefix}-{token}"


def now_iso() -> str:
    """ISO-8601 UTC timestamp with a trailing 'Z', matching `new Date().toISOString()`."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean_json_text(output_text: str) -> str:
    """Strips ```json / ``` fences some model responses wrap JSON in."""
    clean = (output_text or "").strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```json\s*", "", clean, flags=re.IGNORECASE)
        clean = re.sub(r"```$", "", clean).strip()
    return clean

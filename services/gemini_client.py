"""
Lazy Google GenAI (Gemini) client initializer.

Direct port of the original `getGeminiClient()` in server.ts: if no usable
API key is configured, returns None so callers fall back to the local
rule-based analysis engine — never raises.
"""

from flask import current_app
from google import genai

_client_cache = {}


def get_gemini_client():
    """Return a cached genai.Client, or None if no API key is configured."""
    api_key = current_app.config.get("GEMINI_API_KEY", "").strip()

    if not api_key or api_key == "MY_GEMINI_API_KEY":
        return None

    cached = _client_cache.get("client")
    if cached is not None:
        return cached

    client = genai.Client(
        api_key=api_key,
        http_options={"headers": {"User-Agent": "truthlens-flask"}},
    )
    _client_cache["client"] = client
    return client

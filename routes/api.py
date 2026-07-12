"""
Core analysis + ledger API routes — 1:1 port of server.ts's
`/api/analyze-text`, `/api/analyze-image`, `/api/history`, and
`/api/history/delete` endpoints.

Exactly like the original, these endpoints are intentionally NOT gated
behind login: the React app calls them regardless of auth state, so
gating them here would be a functional change, not a faithful migration.

IMPORTANT BEHAVIORAL DETAIL preserved from server.ts: a history record is
only ever written on the "no API key configured" fallback path and on a
successful Gemini call — NOT when a configured Gemini call throws partway
through (that branch returns the fallback analysis to the browser but
never touches the ledger). That asymmetry looks like an oversight in the
original, but per the migration brief it must be reproduced exactly.
"""

import time

from flask import Blueprint, request, jsonify, current_app

from services.gemini_client import get_gemini_client
from services.text_analysis import generate_local_text_analysis, analyze_text_with_gemini
from services.image_analysis import generate_local_image_analysis, analyze_image_with_gemini
from services.history_service import list_history, add_history_item, delete_history_item

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.post("/analyze-text")
def analyze_text():
    data = request.get_json(silent=True) or {}
    text = data.get("text")
    title = data.get("title")
    url = data.get("url")

    if not text or not text.strip():
        return jsonify({"error": "No news article text provided."}), 400

    client = get_gemini_client()

    if client is None:
        local_result = generate_local_text_analysis(text, title)
        _log_text_history(local_result, title, text)
        return jsonify({**local_result, "_notice": "Running in local fallback preview mode."})

    try:
        payload = analyze_text_with_gemini(text, title, url, current_app.config["GEMINI_TEXT_MODEL"])
        _log_text_history(payload, title, text)
        return jsonify(payload)
    except Exception as exc:  # noqa: BLE001 — mirrors the original's blanket catch
        current_app.logger.error("Gemini text analysis failed, reverting to local engine: %s", exc)
        fallback = generate_local_text_analysis(text, title)
        # NOTE: intentionally NOT written to history — matches the original's
        # catch-block behavior exactly (see module docstring).
        return jsonify({**fallback, "_notice": "Running in local fallback preview mode due to an API challenge."})


def _log_text_history(payload: dict, title: str | None, text: str) -> None:
    preview = (f"{title} - " if title else "") + text[:150] + "..."
    add_history_item(
        item_id=f"hist-{int(time.time() * 1000)}",
        item_type="text",
        rating=payload["rating"],
        confidence_or_score=payload["confidence"],
        summary=payload["summaryReasoning"],
        preview_text_or_image=preview,
        details=payload,
    )


@api_bp.post("/analyze-image")
def analyze_image():
    data = request.get_json(silent=True) or {}
    base64_image = data.get("base64Image")
    mime_type = data.get("mimeType")

    if not base64_image:
        return jsonify({"error": "No image payload provided for evaluation."}), 400

    client = get_gemini_client()

    if client is None:
        local_result = generate_local_image_analysis(base64_image)
        _log_image_history(local_result, base64_image)
        return jsonify({**local_result, "_notice": "Running in local fallback preview mode."})

    try:
        payload = analyze_image_with_gemini(base64_image, mime_type, current_app.config["GEMINI_IMAGE_MODEL"])
        _log_image_history(payload, base64_image)
        return jsonify(payload)
    except Exception as exc:  # noqa: BLE001
        current_app.logger.error("Gemini image analysis failed, deploying fallback engine: %s", exc)
        fallback = generate_local_image_analysis(base64_image)
        # NOTE: intentionally NOT written to history — matches the original.
        return jsonify({**fallback, "_notice": "Running in local fallback preview mode due to an API challenge."})


def _log_image_history(payload: dict, base64_image: str) -> None:
    preview = base64_image[:500] if len(base64_image) > 500 else base64_image
    add_history_item(
        item_id=f"hist-{int(time.time() * 1000)}",
        item_type="image",
        rating=payload["rating"],
        confidence_or_score=payload.get("authenticityScore", 0),
        summary=payload["summaryReasoning"],
        preview_text_or_image=preview,
        details=payload,
    )


@api_bp.get("/history")
def get_history():
    return jsonify(list_history())


@api_bp.post("/history/delete")
def delete_history():
    data = request.get_json(silent=True) or {}
    item_id = data.get("id")

    if not item_id:
        return jsonify({"error": "Missing ID to delete history item."}), 400

    delete_history_item(item_id)
    return jsonify({"success": True, "history": list_history()})

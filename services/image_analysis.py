"""
Image (deepfake/manipulation) verification service.

Line-for-line port of `generateLocalImageAnalysis()` and the real
`/api/analyze-image` Gemini vision pipeline from server.ts, including the
original's exact (and slightly quirky) random-choice behavior: the local
mock generator only ever randomly rolls DEEPFAKE / AI_GENERATED /
MANIPULATED — AUTHENTIC is present in the label list but structurally
unreachable by the original `Math.floor(Math.random() * 3)` roll. That
detail is preserved intentionally, per the "do not modify AI output
behavior" migration requirement, even though it reads like a bug.
"""

import base64
import json
import random
import re

from google.genai import types

from services.gemini_client import get_gemini_client
from utils.helpers import rand_id, now_iso, clean_json_text


def generate_local_image_analysis(base64_image: str) -> dict:
    """Offline heuristic classifier — exact port of generateLocalImageAnalysis (server.ts)."""
    ratings = ["DEEPFAKE", "AI_GENERATED", "MANIPULATED", "AUTHENTIC"]
    # NOTE: intentionally mirrors the original's `Math.floor(Math.random() * 3)`,
    # which can only ever select index 0, 1, or 2 — "AUTHENTIC" is never rolled here.
    choice = ratings[random.randrange(3)]

    if choice == "AUTHENTIC":
        auth, deep, manip, ai_prob = 94, 4, 2, 1
        summary = "No anomalous geometric edges, ambient lighting artifacts, or digital frequency mismatching identified. Image shows consistent EXIF profile characteristics."
    elif choice == "DEEPFAKE":
        auth, deep, manip, ai_prob = 12, 94, 75, 60
        summary = "Highly asymmetrical reflections in the iris, distinct facial boundary artifacts, and facial texture dissonance indicate face-swap techniques."
    elif choice == "AI_GENERATED":
        auth, deep, manip, ai_prob = 3, 80, 90, 98
        summary = "Double eyelid rendering, melting high-frequency micro textures, and structural melting in repeating background modules indicate GAN or Diffusion modeling synthesis."
    else:  # MANIPULATED
        auth, deep, manip, ai_prob = 45, 10, 92, 5
        summary = "Cloning stamp patterns, lighting gradient distortions, and high JPG block compression anomalies around specific borders indicate substantial manual digital editing."

    detected_anomalies = [
        {
            "name": "Digital Noise Discontinuity",
            "score": manip,
            "details": "The background noise does not match the subject's local frequency.",
        },
        {
            "name": "Lighting Gradient Congruency",
            "score": deep,
            "details": "Cast shadows indicate a light source of 55 degrees which is physically absent.",
        },
        {
            "name": "Symmetry Alignment Factor",
            "score": ai_prob,
            "details": "Microscopic facial details (eyebrows/ears) fail mechanical symmetry grids.",
        },
    ]

    heatmap_coordinates = [
        {
            "x": random.randrange(30) + 20,
            "y": random.randrange(30) + 20,
            "radius": 20,
            "intensity": 0.85,
            "description": "Blurry boundaries around the jawline showing digital blending artifacts.",
        },
        {
            "x": random.randrange(40) + 40,
            "y": random.randrange(40) + 30,
            "radius": 25,
            "intensity": 0.92,
            "description": "Highly asymmetric reflections and lighting disparities inside the eyeball pupils.",
        },
    ]

    image_url = (
        "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=600&q=80"
        if len(base64_image) < 200
        else base64_image
    )

    return {
        "id": rand_id("img"),
        "imageUrl": image_url,
        "rating": choice,
        "authenticityScore": auth,
        "deepfakeProbability": deep,
        "manipulationProbability": manip,
        "aiGenerativeProbability": ai_prob,
        "metadataDissonance": "Standard EXIF markers stripped. Replaced with generic utility buffers. Binary payload matches statistical noise of digital alteration tools.",
        "detectedAnomalies": detected_anomalies,
        "heatmapCoordinates": heatmap_coordinates,
        "summaryReasoning": summary,
        "timestamp": now_iso(),
    }


_IMAGE_ANALYSIS_PROMPT = """
Analyze this image for signs of deepfake synthesis, generic AI generation (e.g., GAN/Diffusion structures, hand/ear warping, text gibberish, unnatural edge blending, iris distortion), digital manipulations (cloning stamp, lighting misalignment, local high-frequency compression differences), or EXIF manipulation.

Return a rigorous JSON object mapping your analysis. Do NOT yield markdown ticks or backticks. Format STRICTLY as valid raw JSON match-compatible with:
{
  "rating": "AUTHENTIC" | "MANIPULATED" | "DEEPFAKE" | "AI_GENERATED",
  "authenticityScore": <number 0 to 100 representing how genuine it is>,
  "deepfakeProbability": <number 0 to 100>,
  "manipulationProbability": <number 0 to 100>,
  "aiGenerativeProbability": <number 0 to 100>,
  "metadataDissonance": "<evaluation of stripped EXIF headers, signature files, and binary structures>",
  "detectedAnomalies": [
    { "name": "<e.g., Spliced Edges, Asymmetric Iris Reflections>", "score": <0-100 severity>, "details": "<short description of why this was identified>" }
  ],
  "heatmapCoordinates": [
    { "x": <percentage coordinate 0-100 matching horizontal location inside image>, "y": <percentage coordinate 0-100 matching vertical location inside image>, "radius": <radius of highlight circle typically 10 to 30>, "intensity": <number 0.0 to 1.0 indicating degree of suspicion>, "description": "<anomaly observed at this visual location>" }
  ],
  "summaryReasoning": "<A thorough summary paragraph explaining detailed digital forensic highlights and visual proof findings>"
}
"""


def split_base64_payload(base64_image: str, mime_type: str | None) -> tuple[str, str]:
    """Mirrors the original's inline `data:mime;base64,...` stripping logic."""
    resolved_mime_type = mime_type or "image/jpeg"
    base64_parts = base64_image
    if "base64," in base64_image:
        prefix, base64_parts = base64_image.split("base64,", 1)
        match = re.match(r"data:(.*?);", prefix)
        if match:
            resolved_mime_type = match.group(1)
    return base64_parts, resolved_mime_type


def analyze_image_with_gemini(base64_image: str, mime_type: str | None, model_name: str) -> dict:
    """Calls Gemini vision exactly as the original app did; raises on any
    failure so the caller can fall back to the local engine."""
    client = get_gemini_client()
    base64_parts, resolved_mime_type = split_base64_payload(base64_image, mime_type)
    image_bytes = base64.b64decode(base64_parts)

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=resolved_mime_type)

    response = client.models.generate_content(
        model=model_name,
        contents=[image_part, _IMAGE_ANALYSIS_PROMPT],
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )

    clean_json = clean_json_text(response.text or "")
    payload = json.loads(clean_json)
    payload["id"] = rand_id("img")
    payload["imageUrl"] = base64_image
    payload["timestamp"] = now_iso()
    return payload

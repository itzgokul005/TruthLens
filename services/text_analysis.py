"""
Text (article) analysis service.

This is a line-for-line behavioral port of the two code paths in the
original server.ts:

  1. `generateLocalTextAnalysis()` — the offline/no-API-key rule-based
     fallback engine (keyword heuristics, fixed scores, fixed copy).
  2. The real `/api/analyze-text` Gemini pipeline — same prompt, same
     schema, same JSON parsing/cleanup, same output fields.

All keyword lists, thresholds, and score constants are preserved exactly
so the FAKE/REAL/MISLEADING/SATIRE outcome for any given input text is
identical to the original Node/Express app.
"""

import re

from google.genai import types

from services.gemini_client import get_gemini_client
from utils.helpers import rand_id, now_iso, clean_json_text


def generate_local_text_analysis(text: str, title: str | None = None) -> dict:
    """Offline heuristic classifier — exact port of generateLocalTextAnalysis (server.ts)."""
    norm_text = text.lower()

    rating = "REAL"
    confidence = 85
    emotional_manipulation_score = 15
    clickbait_score = 12
    ai_content_probability = 4
    source_reliability_score = 88
    summary = ""

    if any(
        kw in norm_text
        for kw in (
            "miracle drug",
            "suppressed",
            "shocking discovery",
            "aliens found",
            "secret conspiracy",
            "5g radiation chip",
            "cure for cancer suppressed",
        )
    ):
        rating = "FAKE"
        confidence = 92
        emotional_manipulation_score = 90
        clickbait_score = 95
        ai_content_probability = 20
        source_reliability_score = 8
        summary = "Contains known anti-scientific conspiracy claims or sensationalized medical advice with clickbait patterns."
    elif any(
        kw in norm_text
        for kw in (
            "breaking:",
            "this will change everything",
            "revelation",
            "insiders reveal",
            "shocking video",
        )
    ):
        rating = "MISLEADING"
        confidence = 78
        emotional_manipulation_score = 80
        clickbait_score = 88
        ai_content_probability = 45
        source_reliability_score = 32
        summary = "Utilizes extreme visual/textual emotional prompts to exaggerate natural occurrences into dramatic events."
    elif any(
        kw in norm_text
        for kw in (
            "onion",
            "borowitz",
            "satire",
            "the babylon bee",
            "announced today that they will replace congress with",
        )
    ):
        rating = "SATIRE"
        confidence = 95
        emotional_manipulation_score = 30
        clickbait_score = 40
        ai_content_probability = 10
        source_reliability_score = 90
        summary = "Sarcastic statement formatted as a news item parodying current social affairs."
    else:
        rating = "REAL"
        confidence = 88
        emotional_manipulation_score = 12
        clickbait_score = 15
        ai_content_probability = 8
        source_reliability_score = 92
        summary = "Neutral reporting tone using standard, logical patterns of speech with high citation consistency and no immediate signs of sensationalism."

    if title:
        generated_title = title
    else:
        first_clause = re.split(r"[.!?]", text)[0] if text else ""
        generated_title = (first_clause[:80] + "...") if first_clause else "Parsed News Snippet"

    def _status(value: int) -> str:
        if value > 70:
            return "high"
        if value > 40:
            return "medium"
        return "low"

    indicators = [
        {
            "title": "Emotional Bias Index",
            "value": emotional_manipulation_score,
            "status": _status(emotional_manipulation_score),
            "description": f"Reflects the subjective sentiment and triggers used in the content: {emotional_manipulation_score}% emotional weight detected.",
        },
        {
            "title": "Clickbait Signature",
            "value": clickbait_score,
            "status": _status(clickbait_score),
            "description": f"Analysis of headline phrasing, suspense triggers, and punctuation anomalies: {clickbait_score}% match.",
        },
        {
            "title": "Synthesized / AI Content Indicators",
            "value": ai_content_probability,
            "status": _status(ai_content_probability),
            "description": f"Statistical evaluation of syntactic predictability and semantic cohesion: {ai_content_probability}% chance.",
        },
    ]

    # Sentence parser for interactive highlights — mirrors:
    #   text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text]
    sentences_ref = re.findall(r"[^.!?]+[.!?]+(?:\s|$)", text) or [text]

    suspicious_keywords = (
        "secret",
        "shocking",
        "destroy",
        "provoked",
        "conspiracy",
        "suppressed",
        "unmask",
        "insiders",
    )

    highlighted_sentences = []
    for s in sentences_ref:
        s_lower = s.lower()
        is_suspicious = any(kw in s_lower for kw in suspicious_keywords)
        highlighted_sentences.append(
            {
                "text": s.strip(),
                "rating": "suspicious" if is_suspicious else "normal",
                "reason": (
                    "Employs dramatic bias triggers to stimulate visual fear or scientific suspicion."
                    if is_suspicious
                    else None
                ),
            }
        )

    claims_list = [
        {
            "claim": text[:60] + "...",
            "status": "confirmed" if rating == "REAL" else ("unverified" if rating == "SATIRE" else "disproven"),
            "explanation": (
                "Corresponds to standard accredited public chronicles and primary references."
                if rating == "REAL"
                else "Contradicted by objective independent scientific and official records."
            ),
            "sourcesNeeded": [
                "Sovereign Federal Records",
                "Reuters Fact Check Database",
                "Academic Research Directories",
            ],
        }
    ]

    fact_check_references = [
        {
            "title": f'Fact Check: Evaluation of public claims concerning "{generated_title[:40]}"',
            "type": "supporting" if rating == "REAL" else "contradicting",
            "publisher": "International Fact Checkers Network",
            "url": "https://example.com/factcheck/truthlens-audit",
            "summary": f"Our audit confirms that stories relating to this topic are often {rating.lower()} and carry {confidence}% verifiable consistency records.",
        }
    ]

    return {
        "id": rand_id("tx"),
        "textAnalyzed": text,
        "titleAnalyzed": generated_title,
        "rating": rating,
        "confidence": confidence,
        "summaryReasoning": summary
        or "System analysis determined the rating based on structural syntactic cues, source citation frequency, and emotional semantic loading.",
        "emotionalManipulationScore": emotional_manipulation_score,
        "clickbaitScore": clickbait_score,
        "aiContentProbability": ai_content_probability,
        "sourceReliabilityScore": source_reliability_score,
        "indicators": indicators,
        "claimsList": claims_list,
        "highlightedSentences": highlighted_sentences,
        "factCheckReferences": fact_check_references,
        "timestamp": now_iso(),
    }


def _build_text_prompt(text: str, title: str | None, url: str | None) -> str:
    """Exact port of the Gemini prompt template used in server.ts."""
    return f"""
You are an expert, neutral, objective investigative journalist and AI text analyst.
Analyze the following news article text (and optional title and URL context) for accuracy, clickbait elements, emotional manipulation indices, AI-generated probability, factual consistency, and credibility markers.

Title Context: {title or "N/A"}
URL Context: {url or "N/A"}
Article Text:
{text}

You MUST return a JSON object wrapping detailed credibility analysis.
Do not include any Markdown ticks or 'json' wrapping in your response text. Output ONLY valid, raw, parseable JSON strictly matching this schema format:
{{
  "rating": "REAL" | "FAKE" | "MISLEADING" | "SATIRE",
  "confidence": <number scale 0 to 100>,
  "summaryReasoning": "<A paragraph explaining the decision based on evidence, style, citations, and metadata clues>",
  "emotionalManipulationScore": <number scale 0 to 100>,
  "clickbaitScore": <number scale 0 to 100>,
  "aiContentProbability": <number scale 0 to 100>,
  "sourceReliabilityScore": <number scale 0 to 100>,
  "indicators": [
    {{ "title": "Headline Credibility", "value": <0-100>, "status": "low" | "medium" | "high", "description": "Analysis of title or main header" }},
    {{ "title": "Emotional Bias Index", "value": <0-100>, "status": "low" | "medium" | "high", "description": "Analysis of subjective triggers or sensational phrasings" }},
    {{ "title": "Source Transparency", "value": <0-100>, "status": "low" | "medium" | "high", "description": "Analysis of cited links, authors, and evidence" }}
  ],
  "claimsList": [
    {{ "claim": "<sentence of the key fact reported>", "status": "confirmed" | "disproven" | "unverified" | "exaggerated", "explanation": "<short fact-check explanation>", "sourcesNeeded": ["<resource/agency named>", "<other resource>"] }}
  ],
  "highlightedSentences": [
    {{ "text": "<exact sentence matching text>", "rating": "normal" | "suspicious", "reason": "<why suspicious, or empty if normal>" }}
  ],
  "factCheckReferences": [
    {{ "title": "<Related fact-check title>", "type": "supporting" | "contradicting" | "neutral", "publisher": "<AFP/Reuters/Snopes etc>", "url": "https://example.com/check", "summary": "<details of the audit findings>" }}
  ]
}}

Make sure every item in highlightedSentences corresponds EXACTLY to a sentence segment found inside the user's article text. Keep the JSON fully structured, free of syntax errors, and highly rigorous.
"""


def analyze_text_with_gemini(text: str, title: str | None, url: str | None, model_name: str) -> dict:
    """Calls Gemini exactly as the original app did; raises on any failure
    so the caller can fall back to the local engine (mirrors the
    try/catch fallback behavior in server.ts)."""
    import json

    client = get_gemini_client()
    prompt = _build_text_prompt(text, title, url)

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )

    clean_json = clean_json_text(response.text or "")
    payload = json.loads(clean_json)
    payload["id"] = rand_id("tx")
    payload["timestamp"] = now_iso()
    return payload

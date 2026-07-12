"""
History (audit ledger) service.

The original app kept `inMemoryHistory` as a plain array in server memory,
seeded with two demo records, and reset to just those two every time the
Node process restarted. This Flask version persists the exact same two
seed records into SQLite via SQLAlchemy on first run (so the "recreate
the database using SQLAlchemy" requirement is met), and grows/shrinks the
same way afterward — the only behavioral upgrade is that entries now
survive a server restart instead of vanishing.
"""

from datetime import datetime, timedelta, timezone

from extensions import db
from models import HistoryItem


def _seed_history_records() -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "id": "hist-1",
            "type": "text",
            "timestamp": now - timedelta(hours=2),
            "rating": "FAKE",
            "confidence_or_score": 94,
            "summary": "Claim that NASA has found 'colossal ancient cities' underneath Mars' soil is fully unsupported by satellite data.",
            "preview_text_or_image": "NASA Mars soil ancient cities discovered by Curiosity rover under recent dunes...",
            "details": {
                "id": "hist-1",
                "textAnalyzed": "NASA Mars soil ancient cities discovered by Curiosity rover under recent dunes with architectural layouts resembling ancient Mesopotamia. Suppressed images leaked of massive spires.",
                "titleAnalyzed": "NASA Suppresses Discovery of Colossal Ancient Cities Under Mars",
                "rating": "FAKE",
                "confidence": 94,
                "summaryReasoning": "NASA Curiosity rover images have been cropped and taken out of context. Geologists have confirmed the spires are natural basalt column formations formed by volcanic processes on ancient Mars, not Mesopotamia-type layouts. NASA has released all Mars imagery publicly with no suppression.",
                "emotionalManipulationScore": 85,
                "clickbaitScore": 90,
                "aiContentProbability": 40,
                "sourceReliabilityScore": 12,
                "indicators": [
                    {"title": "Headline Credibility", "value": 15, "status": "high", "description": "Sensationalized headline using loaded triggers ('Suppresses', 'Colossal Ancient Cities')."},
                    {"title": "Emotional Bias Index", "value": 85, "status": "high", "description": "Leverages strong conspiracy undertones and secrecy triggers to provoke anger or amazement."},
                    {"title": "Source Transparency", "value": 10, "status": "high", "description": "Referred only to unnamed 'suppressed reports' and 'leaked files' without verifiable source links."},
                ],
                "claimsList": [
                    {
                        "claim": "Curiosity detected cities under Mars Soil resembling ancient Mesopotamia",
                        "status": "disproven",
                        "explanation": "High Resolution Imaging Science Experiment (HiRISE) data shows natural geometric weathering of basaltic rocks, not structures.",
                        "sourcesNeeded": ["NASA Jet Propulsion Laboratory Mars Mission Records", "Icarus Planetary Science Journal"],
                    },
                    {
                        "claim": "NASA suppressed leaked images of huge spires",
                        "status": "disproven",
                        "explanation": "The mentioned images are available in the public raw photo stream of Curiosity sol logs; no alteration of files has occurred.",
                        "sourcesNeeded": ["NASA JPL Raw Images Archive Sol 1244"],
                    },
                ],
                "highlightedSentences": [
                    {"text": "NASA Suppresses Discovery of Colossal Ancient Cities Under Mars", "rating": "suspicious", "reason": "Highly clickable, highly suspicious claim of conspiracy."},
                    {"text": "NASA Curiosity rover discovered ancient Mesopotamian cities under the soil.", "rating": "suspicious", "reason": "Factual claim completely unsupported by any Mars planetary catalogs."},
                    {"text": "Suppressed images leaked of massive spires that look exactly like stone brick watchtowers.", "rating": "suspicious", "reason": "Uses fear of suppression and structural description to mislead readers into natural geological optical illusions."},
                    {"text": "Curiosity was exploring the Gale Crater dunes when sensors took these frames.", "rating": "normal"},
                ],
                "factCheckReferences": [
                    {
                        "title": "Fact Check: Did NASA discover cities on Mars?",
                        "type": "contradicting",
                        "publisher": "Science Fact Alliance",
                        "url": "https://example.com/factcheck/mars-cities",
                        "summary": "Conspiracy theorists misinterpret erosion lines and basalt deposits in Gale Crater as human-style masonry systems. Thoroughly debunked by NASA geologists.",
                    }
                ],
                "timestamp": (now - timedelta(hours=2)).isoformat().replace("+00:00", "Z"),
            },
        },
        {
            "id": "hist-2",
            "type": "image",
            "timestamp": now - timedelta(hours=5),
            "rating": "AI_GENERATED",
            "confidence_or_score": 98,
            "summary": "Visual checks report 98% AI generation rate. Notable visual anomalies include asymmetrical teeth alignment, unnatural hands, and melting light gradients.",
            "preview_text_or_image": "AI profile portrait depicting an international leader speaking at an urgent conference...",
            "details": {
                "id": "hist-2",
                "imageUrl": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
                "rating": "AI_GENERATED",
                "authenticityScore": 2,
                "deepfakeProbability": 98,
                "manipulationProbability": 95,
                "aiGenerativeProbability": 98,
                "metadataDissonance": "Missing standard digital camera EXIF profiles. The photo binary carries structural indices standard with stable diffusion latent parameters.",
                "detectedAnomalies": [
                    {"name": "Symmetric Earring Distortions", "score": 95, "details": "The earrings on left and right ears have different intricate shapes that fade randomly into the skin necklines."},
                    {"name": "Melted Background Textures", "score": 88, "details": "Micro-decorations of background flags dissolve into continuous abstract color pools."},
                    {"name": "Inconsistent Ambient Lighting Direction", "score": 92, "details": "Light casts from a secondary source that has no physical counterpart in the scene."},
                ],
                "heatmapCoordinates": [
                    {"x": 34, "y": 48, "radius": 25, "intensity": 0.9, "description": "Unnatural ear-lobe rendering showing fluid fusion of metal and organic tissues."},
                    {"x": 50, "y": 38, "radius": 18, "intensity": 0.85, "description": "Asymmetry in pupil shapes and inconsistent catchlights in the eyeballs."},
                    {"x": 75, "y": 70, "radius": 35, "intensity": 0.75, "description": "Melting background banner artifacts depicting abstract text structures."},
                ],
                "summaryReasoning": "The image is confirmed as completely synthesized by a deep generative AI model. High probability of diffusion modeling indicated by characteristic facial flaws, melting background flags, and mismatched lighting geometry.",
                "timestamp": (now - timedelta(hours=5)).isoformat().replace("+00:00", "Z"),
            },
        },
    ]


def seed_history_if_empty() -> None:
    """Populate the two original demo ledger entries on first run only."""
    if HistoryItem.query.count() > 0:
        return
    for record in _seed_history_records():
        db.session.add(HistoryItem(**record))
    db.session.commit()


def list_history() -> list[dict]:
    """Returns the full global ledger, newest first — matches `/api/history`."""
    items = HistoryItem.query.order_by(HistoryItem.timestamp.desc()).all()
    return [item.to_dict() for item in items]


def add_history_item(
    *,
    item_id: str,
    item_type: str,
    rating: str,
    confidence_or_score: int,
    summary: str,
    preview_text_or_image: str,
    details: dict,
    user_id: str | None = None,
) -> HistoryItem:
    item = HistoryItem(
        id=item_id,
        type=item_type,
        timestamp=datetime.now(timezone.utc),
        rating=rating,
        confidence_or_score=confidence_or_score,
        summary=summary,
        preview_text_or_image=preview_text_or_image,
        details=details,
        user_id=user_id,
    )
    db.session.add(item)
    db.session.commit()
    return item


def delete_history_item(item_id: str) -> bool:
    item = db.session.get(HistoryItem, item_id)
    if item is None:
        return False
    db.session.delete(item)
    db.session.commit()
    return True

"""
HistoryItem model.

Maps 1:1 to the original app's `HistoryItem` TypeScript interface:
    { id, type, timestamp, rating, confidenceOrScore, summary,
      previewTextOrImage, details }

`details` holds the full nested TextAnalysisResult or ImageAnalysisResult
payload exactly as originally shaped (indicators, claimsList,
highlightedSentences, factCheckReferences, detectedAnomalies,
heatmapCoordinates, etc.). Storing it as JSON preserves the original's
document-shaped data model without inventing a normalized schema that
never existed, while still being fully persisted in SQLAlchemy/SQLite
(swap-able to MySQL/Postgres JSON columns with zero code changes).

NOTE ON SCOPE: exactly like the original in-memory ledger, history is a
single global audit log shared by every visitor (not scoped per-user) —
the original React app renders the same `/api/history` list regardless
of login state. `user_id` is recorded when available purely as metadata
for future use; it intentionally does not filter what `/api/history`
returns, to keep behavior identical to the original.
"""

from datetime import datetime, timezone

from extensions import db


class HistoryItem(db.Model):
    __tablename__ = "history_items"

    id = db.Column(db.String(40), primary_key=True)
    type = db.Column(db.String(10), nullable=False)  # "text" | "image"
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    rating = db.Column(db.String(20), nullable=False)
    confidence_or_score = db.Column(db.Integer, nullable=False)
    summary = db.Column(db.Text, nullable=False)
    preview_text_or_image = db.Column(db.Text, nullable=False)
    details = db.Column(db.JSON, nullable=False)

    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)

    def to_dict(self) -> dict:
        """Serialize exactly to the frontend's `HistoryItem` interface."""
        return {
            "id": self.id,
            "type": self.type,
            "timestamp": self.timestamp.isoformat() + "Z" if self.timestamp.tzinfo is None else self.timestamp.isoformat(),
            "rating": self.rating,
            "confidenceOrScore": self.confidence_or_score,
            "summary": self.summary,
            "previewTextOrImage": self.preview_text_or_image,
            "details": self.details,
        }

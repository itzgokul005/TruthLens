"""
User model.

Maps to the original app's client-side `UserSession` shape:
    { uid, email, displayName, photoURL }

Passwords are always stored bcrypt-hashed (Flask-Bcrypt) — the original
demo never persisted or verified a real password at all, so this is a
strict security upgrade while keeping every visible field, message, and
screen identical.
"""

import uuid
from datetime import datetime, timezone

from flask_login import UserMixin

from extensions import db, login_manager


def _gen_uid() -> str:
    # Mirrors the original id shape used for mock users: "u-xxxxxxxx"
    return "u-" + uuid.uuid4().hex[:8]


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.String(40), primary_key=True, default=_gen_uid)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    display_name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    photo_url = db.Column(db.String(500), nullable=True)
    auth_provider = db.Column(db.String(20), nullable=False, default="password")  # "password" | "google"

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Password reset support (Forgot Password flow)
    reset_token = db.Column(db.String(255), nullable=True, index=True)
    reset_token_expires_at = db.Column(db.DateTime, nullable=True)

    history_items = db.relationship(
        "HistoryItem", backref="user", lazy="dynamic", cascade="all, delete-orphan"
    )

    def to_session_dict(self) -> dict:
        """Serialize exactly to the frontend's `UserSession` interface."""
        return {
            "uid": self.id,
            "email": self.email,
            "displayName": self.display_name,
            "photoURL": self.photo_url,
        }

    def __repr__(self) -> str:
        return f"<User {self.email}>"


@login_manager.user_loader
def load_user(user_id: str):
    return db.session.get(User, user_id)

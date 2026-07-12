"""
Authentication routes (Access Portal).

The original React AuthModal never talked to a real backend at all — any
email containing "@" plus any 6+ character password "succeeded" and
handed back a randomly-minted fake user object; nothing was ever stored
or verified. Per your choice of a real production backend, this version
uses genuine Flask-Login sessions, Flask-Bcrypt password hashing, and a
persisted SQLAlchemy `User` table.

Every screen, tab, field, and success/error message copy from the
original is preserved exactly EXCEPT where real persistence requires a
message the mock never needed (e.g. "wrong password" or "email already
registered" — the original could never actually fail those checks
because it never stored anything). Those new messages are called out
below with NEW: comments.
"""

import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user

from extensions import db, bcrypt
from models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# ---- Shared validation copy, verbatim from the original AuthModal.tsx ----
MSG_INVALID_EMAIL = "Please enter a valid administrative or public email address."
MSG_SHORT_PASSWORD = "Passwords must exceed a sequence length of 6 characters."
MSG_BLANK_NAME = "Your display signature name cannot be left blank."


def _is_valid_email_shape(email: str) -> bool:
    # Matches the original's deliberately loose check: `email.includes("@")`
    return isinstance(email, str) and "@" in email


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not _is_valid_email_shape(email):
        return jsonify({"error": MSG_INVALID_EMAIL}), 400
    if len(password) < 6:
        return jsonify({"error": MSG_SHORT_PASSWORD}), 400

    user = User.query.filter_by(email=email, auth_provider="password").first()

    # NEW: the mock never verified a stored credential, so it could never
    # fail here. A real backend must reject unknown emails / wrong passwords.
    if user is None or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"error": "No matching Fact-Check Vault found for those credentials. Check your email and password, or create a new account."}), 401

    login_user(user, remember=True)
    return jsonify({"message": "Authentication successfully completed.", "user": user.to_session_dict()})


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not name:
        return jsonify({"error": MSG_BLANK_NAME}), 400
    if not _is_valid_email_shape(email):
        return jsonify({"error": MSG_INVALID_EMAIL}), 400
    if len(password) < 6:
        return jsonify({"error": MSG_SHORT_PASSWORD}), 400

    # NEW: real accounts can't collide on email the way infinite mock users could.
    if User.query.filter_by(email=email).first() is not None:
        return jsonify({"error": "An account with that email already exists. Try signing in instead."}), 409

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(email=email, display_name=name, password_hash=password_hash, auth_provider="password")
    db.session.add(user)
    db.session.commit()

    login_user(user, remember=True)
    return jsonify({"message": "Account successfully provisioned.", "user": user.to_session_dict()})


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()

    if not _is_valid_email_shape(email):
        return jsonify({"error": MSG_INVALID_EMAIL}), 400

    # Always report success regardless of whether the email is registered
    # (matches the original's behavior, and avoids leaking which emails exist).
    user = User.query.filter_by(email=email, auth_provider="password").first()
    if user is not None:
        user.reset_token = secrets.token_urlsafe(32)
        user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        db.session.commit()
        _dispatch_reset_email(user)

    return jsonify({"message": "Password synchronization instructions dispatched. Please evaluate your inbox."})


def _dispatch_reset_email(user: User) -> None:
    """Sends the reset link via Flask-Mail, or logs it when mail is
    unconfigured/suppressed (keeps local/dev usage frictionless)."""
    reset_url = f"{current_app.config['APP_URL']}/reset-password/{user.reset_token}"

    if current_app.config.get("MAIL_SUPPRESS_SEND", True):
        current_app.logger.info("[TruthLens] Password reset link for %s: %s", user.email, reset_url)
        return

    from flask_mail import Message
    from extensions import mail

    msg = Message(
        subject="TruthLens — Synchronize Your Password",
        recipients=[user.email],
        body=f"Hi {user.display_name},\n\nUse the link below to reset your TruthLens password:\n{reset_url}\n\nThis link expires in 1 hour.",
    )
    mail.send(msg)


@auth_bp.post("/google")
def google_sign_in():
    """Simulated 'Google Secure Gateway' sign-in.

    NOTE: the original never integrated real Google OAuth either — it was
    a client-side setTimeout() that fabricated the same fixed fake user
    every time. Standing up real Google OAuth would need a Google Cloud
    OAuth client ID/secret you haven't provided, so this preserves the
    exact same demo behavior, upgraded only to a real persisted account +
    real login session so it survives restarts and works with Flask-Login.
    """
    demo_email = "factchecker.pro@gmail.com"
    user = User.query.filter_by(email=demo_email).first()
    if user is None:
        user = User(
            email=demo_email,
            display_name="Sovereign Verifier",
            password_hash=bcrypt.generate_password_hash(secrets.token_urlsafe(24)).decode("utf-8"),
            photo_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
            auth_provider="google",
        )
        db.session.add(user)
        db.session.commit()

    login_user(user, remember=True)
    return jsonify({"message": "Logged in successfully with Google Secure Gateway.", "user": user.to_session_dict()})


@auth_bp.post("/reset-password")
def reset_password():
    """Completes the Forgot Password flow started by /auth/forgot-password.

    NOT part of the original's screens (the mock never got this far — it
    only ever showed a fake "email sent" message). This is the minimal
    plumbing needed to make the feature genuinely work end to end, reached
    via the emailed/logged reset link at GET /reset-password/<token>.
    """
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    password = data.get("password") or ""

    if len(password) < 6:
        return jsonify({"error": MSG_SHORT_PASSWORD}), 400

    user = User.query.filter_by(reset_token=token).first() if token else None
    if (
        user is None
        or user.reset_token_expires_at is None
        or user.reset_token_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    ):
        return jsonify({"error": "This reset link is invalid or has expired. Please request a new one."}), 400

    user.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user.reset_token = None
    user.reset_token_expires_at = None
    db.session.commit()

    return jsonify({"message": "Password successfully synchronized. You may now sign in."})


@auth_bp.post("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Signed out."})


@auth_bp.get("/me")
def me():
    if current_user.is_authenticated:
        return jsonify({"user": current_user.to_session_dict()})
    return jsonify({"user": None})

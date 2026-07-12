"""
Main page route.

The original app is a client-rendered single-page app: React swaps
between "overview" / "text-mode" / "image-mode" / "dashboard" / "history"
tabs entirely with local component state — no URL/route change, no full
page reload. This Flask version reproduces that exactly: one server
route renders the full page shell (navbar + every tab section + the auth
modal), and static/js/main.js does the same client-side tab switching the
React app did. Everything past the shell (analysis calls, auth, history
CRUD) still talks to the real Flask backend via fetch().
"""

from flask import Blueprint, render_template
from flask_login import current_user

from services.history_service import list_history

main_bp = Blueprint("main", __name__)


@main_bp.get("/")
def index():
    return render_template(
        "index.html",
        initial_history=list_history(),
        current_user_json=(current_user.to_session_dict() if current_user.is_authenticated else None),
    )


@main_bp.get("/reset-password/<token>")
def reset_password_page(token):
    # Deliberately not part of the original's screens — see README.md
    # ("What changed, and why", item 3) for context. Kept as a minimal,
    # standalone page rather than folded into the SPA tab structure.
    return render_template("reset_password.html", token=token)

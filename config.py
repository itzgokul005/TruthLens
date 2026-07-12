"""
Application configuration classes.

Reads all secrets and environment-dependent values from environment
variables (loaded via python-dotenv in app.py / wsgi.py). Never hardcode
secrets here.
"""

import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Base configuration shared across all environments."""

    # --- Core Flask ---
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-secret-key-change-me")

    # --- Database (SQLAlchemy) ---
    # Defaults to a local SQLite file; swap SQLALCHEMY_DATABASE_URI in the
    # environment to point at MySQL/PostgreSQL without touching any code,
    # e.g. postgresql+psycopg2://user:pass@host:5432/truthlens
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///" + os.path.join(BASE_DIR, "instance", "truthlens.db")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # --- Sessions / Cookies ---
    PERMANENT_SESSION_LIFETIME = timedelta(days=14)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    REMEMBER_COOKIE_DURATION = timedelta(days=14)

    # --- CSRF (Flask-WTF) ---
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None  # tokens don't expire mid long-lived SPA session

    # --- File uploads (image verification) ---
    # Matches the original Express body-parser limit ("50mb") for base64 image payloads.
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB

    # --- Gemini / Google GenAI ---
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
    GEMINI_TEXT_MODEL = os.environ.get("GEMINI_TEXT_MODEL", "gemini-3.5-flash")
    GEMINI_IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3.5-flash")

    # --- Mail (Flask-Mail) — used for the "forgot password" flow ---
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "localhost")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() in ("1", "true", "yes")
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "no-reply@truthlens.local")
    # If no mail server credentials are configured, the app logs reset links
    # to the console instead of failing (keeps local/dev usage frictionless).
    MAIL_SUPPRESS_SEND = os.environ.get("MAIL_SUPPRESS_SEND", "true").lower() in ("1", "true", "yes")

    APP_URL = os.environ.get("APP_URL", "http://localhost:5000")


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = False


class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}

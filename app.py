"""
TruthLens — Flask application factory.

Run for local development with:
    flask --app app run --debug
or:
    python app.py
"""

import os

from flask import Flask
from dotenv import load_dotenv

from config import config_by_name
from extensions import db, bcrypt, csrf, login_manager, migrate, mail, cors

load_dotenv()


def create_app(config_name: str | None = None) -> Flask:
    config_name = config_name or os.environ.get("FLASK_ENV", "development")
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_by_name.get(config_name, config_by_name["default"]))

    os.makedirs(app.instance_path, exist_ok=True)

    # --- Bind extensions ---
    db.init_app(app)
    bcrypt.init_app(app)
    csrf.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)
    cors.init_app(app, supports_credentials=True)

    # --- Register blueprints ---
    from routes.main import main_bp
    from routes.auth import auth_bp
    from routes.api import api_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    # The analysis endpoints are public in the original app too (no login
    # gate), but they're still exempted from CSRF only for GET reads;
    # mutating POSTs keep CSRF enforced via the X-CSRFToken header that
    # static/js/main.js attaches to every fetch() call.

    with app.app_context():
        db.create_all()
        from services.history_service import seed_history_if_empty

        seed_history_if_empty()

    register_error_handlers(app)

    return app


def register_error_handlers(app: Flask) -> None:
    from flask import jsonify, request

    @app.errorhandler(404)
    def not_found(_err):
        if request.path.startswith("/api/") or request.path.startswith("/auth/"):
            return jsonify({"error": "Not found."}), 404
        from flask import render_template

        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def server_error(_err):
        if request.path.startswith("/api/") or request.path.startswith("/auth/"):
            return jsonify({"error": "Internal server error."}), 500
        from flask import render_template

        return render_template("errors/500.html"), 500

    @app.errorhandler(413)
    def payload_too_large(_err):
        return jsonify({"error": "Upload too large. Please choose a smaller file."}), 413


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=app.config.get("DEBUG", False))

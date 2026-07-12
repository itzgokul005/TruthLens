"""
Centralized Flask extension instances.

Instantiated here (without an app) and bound to the real app inside the
application factory in app.py, following the standard Flask "extensions"
pattern so blueprints/services can import them without circular imports.
"""

from flask import jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_bcrypt import Bcrypt
from flask_wtf import CSRFProtect
from flask_migrate import Migrate
from flask_mail import Mail
from flask_cors import CORS

db = SQLAlchemy()
bcrypt = Bcrypt()
csrf = CSRFProtect()
login_manager = LoginManager()
migrate = Migrate()
mail = Mail()
cors = CORS()

# Match the original React app's UX: unauthenticated visits to protected
# JSON endpoints should get a clean 401 JSON response, not a redirect to an
# HTML login page (there is no separate login page in this SPA-style app).
login_manager.login_view = None


@login_manager.unauthorized_handler
def _unauthorized():
    return jsonify({"error": "Authentication required."}), 401

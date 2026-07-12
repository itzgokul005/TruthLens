# TruthLens — Flask Edition

A complete technology migration of the original **React + TypeScript + Vite + Express** TruthLens app to **Python + Flask + Jinja2 + vanilla JavaScript**, with a real SQLAlchemy-backed database and genuine Flask-Login/Flask-Bcrypt authentication.

Every screen, layout, color, animation, and interaction from the original is preserved pixel-for-pixel. The AI analysis pipeline (Gemini-powered, with a local rule-based fallback) produces identical output for identical input. See **"What changed, and why"** below for the handful of deliberate, called-out exceptions.

## Quick start

```bash
# 1. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum, set GEMINI_API_KEY if you want real AI analysis
# instead of the local fallback engine, and set SECRET_KEY to something random.

# 4. Run the development server
flask --app app run --debug
# or: python app.py
```

Visit **http://localhost:5000** — the database (SQLite, at `instance/truthlens.db`) is created automatically on first run, seeded with the same two demo ledger entries the original app shipped with.

### Production deployment

```bash
gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app
```

Set `FLASK_ENV=production` in your environment and make sure `SECRET_KEY`, `DATABASE_URL` (if not using SQLite), and `GEMINI_API_KEY` are set as real environment variables rather than in a checked-in `.env` file.

### Switching databases

The app defaults to SQLite with zero configuration. To use MySQL or PostgreSQL instead, just set `DATABASE_URL` in `.env` — no code changes needed:

```
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/truthlens
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/truthlens
```

(Install the matching driver — `psycopg2-binary` or `pymysql` — for your chosen database.)

## Project structure

```
app.py                  Flask application factory
config.py                Environment-driven configuration classes
extensions.py             Shared extension instances (db, login_manager, bcrypt, csrf, migrate, mail, cors)
wsgi.py                    Gunicorn entrypoint
models/
  user.py                  User table (Flask-Login + Bcrypt password hashing)
  history.py                HistoryItem table (the audit ledger)
routes/
  main.py                    "/" — renders the single-page shell
  auth.py                    /auth/* — login, signup, logout, forgot-password, Google demo
  api.py                     /api/* — analyze-text, analyze-image, history, history/delete
services/
  gemini_client.py            Lazy Google GenAI client
  text_analysis.py             Article analysis: Gemini pipeline + local fallback
  image_analysis.py             Image forensics: Gemini vision pipeline + local fallback
  history_service.py            Ledger CRUD + the original's two seed records
utils/helpers.py            Small shared helpers (ID generation, timestamps, JSON cleanup)
templates/
  base.html                   Shared <head>/<body> shell (Tailwind CDN + Lucide icons)
  index.html                   Assembles the navbar + all 5 tabs + auth modal
  partials/                     One file per original React component
static/css/custom.css        Ported custom CSS (glass effect, ambient glow, shimmer, etc.)
static/js/main.js             All client-side interactivity (tab switching, forms, rendering)
migrations/                 Flask-Migrate scaffold (run `flask db init` to activate versioned migrations)
```

## What changed, and why

The migration brief asked for an exact, one-to-one port — and that's what this is, **except** for the specific, deliberate items below. Each one exists because the original app either had no real implementation to copy (it was a client-side demo), or because you explicitly asked for a production-grade backend rather than a faithful mock:

1. **Real authentication.** The original `AuthModal` never talked to a backend — any email containing `@` and any 6+ character password always "succeeded," and nothing was ever stored. This version uses genuine Flask-Login sessions and Flask-Bcrypt-hashed passwords in a real `User` table, so **wrong passwords and unknown emails now correctly fail** (with new error copy, clearly marked in `routes/auth.py`) where the original could never fail at all. Every field, screen, and success message is otherwise identical.
2. **Persistent history.** The original's audit ledger was a plain in-memory array that reset every server restart. It's now a SQLAlchemy `HistoryItem` table — same shape, same two seed records, same global (not per-user) visibility — but it survives restarts.
3. **Password reset actually works.** The original's "Forgot Password" always showed a fake success message and did nothing else. This version generates a real, time-limited reset token. If you configure real SMTP credentials in `.env`, it emails the link via Flask-Mail; otherwise (the default) it logs the reset link to the console, and a minimal `/reset-password/<token>` page (not part of the original's screens) lets you complete the reset.
4. **"Sign in with Google" is still a demo.** The original never integrated real Google OAuth either — it was a fake, instant "success." Standing up real OAuth needs a Google Cloud OAuth client ID/secret you haven't provided, so this preserves the same one-click demo behavior, just now backed by a real persisted account. Send me OAuth credentials if you'd like this wired up for real.
5. **No TensorFlow/PyTorch/OpenCV.** The original app has no local trained model anywhere — all "AI" is Gemini API calls (`gemini-3.5-flash`, text and vision) with a rule-based JavaScript fallback for when no API key is present. This version ports both paths exactly, using Google's Python GenAI SDK. There was no model to reuse or retrain, so none of the heavy ML libraries in the migration brief's suggested stack are included — adding unused dependencies would be dead weight.
6. **Tailwind CSS, not Bootstrap.** The original UI is built entirely with Tailwind utility classes (not Bootstrap). To stay pixel-identical, this version keeps Tailwind (via the CDN Play build with the same font/theme config) rather than hand-translating thousands of utility classes into Bootstrap, which would risk visual drift.
7. **No admin panel.** The migration brief mentions one, but there isn't one anywhere in the original codebase — so there's nothing to port. `is_admin` groundwork exists on the `User` model if you want to build one later.

Two more subtle behaviors were **intentionally preserved even though they look like bugs**, per the "don't modify AI/UI behavior" requirement:
- A history entry is only written on a successful Gemini call or full fallback — **not** when a configured Gemini call fails partway through (that path returns results to the browser but never logs them).
- The dashboard's donut chart arc math uses each item's raw count rather than its computed percentage, exactly as the original's (apparently unintentional) implementation does.

## Security

CSRF protection (Flask-WTF), password hashing (Bcrypt), secure session cookies, input validation, and SQL-injection protection (via SQLAlchemy's parameterized queries) are all active by default. Set `SECRET_KEY` to a real random value and `SESSION_COOKIE_SECURE=True` (already set in `ProductionConfig`) before deploying behind HTTPS.

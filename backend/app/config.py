"""Settings loaded from environment / backend/.env."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str) -> list[str]:
    return [p.strip() for p in os.getenv(name, "").split(",") if p.strip()]


@dataclass(frozen=True)
class Settings:
    garmin_email: str = field(default_factory=lambda: os.getenv("GARMIN_EMAIL", ""))
    garmin_password: str = field(default_factory=lambda: os.getenv("GARMIN_PASSWORD", ""))
    garmin_tokenstore: str = field(
        default_factory=lambda: os.getenv("GARMIN_TOKENSTORE", "~/.garminconnect")
    )
    gcal_ics_urls: list[str] = field(default_factory=lambda: _list("GCAL_ICS_URLS"))
    # Extra title words for categorising events from GCAL_ICS_URLS (added to built-in defaults).
    training_keywords: list[str] = field(default_factory=lambda: _list("TRAINING_KEYWORDS"))
    work_keywords: list[str] = field(default_factory=lambda: _list("WORK_KEYWORDS"))
    study_keywords: list[str] = field(default_factory=lambda: _list("STUDY_KEYWORDS"))
    reading_keywords: list[str] = field(default_factory=lambda: _list("READING_KEYWORDS"))
    personal_keywords: list[str] = field(default_factory=lambda: _list("PERSONAL_KEYWORDS"))
    # Calendars whose events all belong to one category (no keyword guessing needed).
    gcal_training_urls: list[str] = field(default_factory=lambda: _list("GCAL_TRAINING_ICS_URLS"))
    gcal_work_urls: list[str] = field(default_factory=lambda: _list("GCAL_WORK_ICS_URLS"))
    gcal_study_urls: list[str] = field(default_factory=lambda: _list("GCAL_STUDY_ICS_URLS"))
    gcal_reading_urls: list[str] = field(default_factory=lambda: _list("GCAL_READING_ICS_URLS"))
    gcal_personal_urls: list[str] = field(default_factory=lambda: _list("GCAL_PERSONAL_ICS_URLS"))
    key_session_keywords: list[str] = field(
        default_factory=lambda: _list("KEY_SESSION_KEYWORDS")
    )
    goals_path: Path = field(
        default_factory=lambda: BACKEND_DIR / os.getenv("GOALS_PATH", "goals.json")
    )
    demo_mode: bool = field(default_factory=lambda: _bool("DEMO_MODE"))
    backfill_days: int = field(default_factory=lambda: int(os.getenv("BACKFILL_DAYS", "90")))
    # Activities are one cheap ranged request, so pull much more history for the sport tabs.
    activity_backfill_days: int = field(
        default_factory=lambda: int(os.getenv("ACTIVITY_BACKFILL_DAYS", "730"))
    )
    sync_interval_minutes: int = field(
        default_factory=lambda: int(os.getenv("SYNC_INTERVAL_MINUTES", "60"))
    )
    db_path: Path = field(
        default_factory=lambda: BACKEND_DIR / os.getenv("DB_PATH", "data/lifedashboard.sqlite3")
    )
    # Contents of a saved Garmin login (see `start.py --garmin-token`), for servers where an
    # interactive login isn't possible. Written to GARMIN_TOKENSTORE on first start.
    garmin_tokens: str = field(default_factory=lambda: os.getenv("GARMIN_TOKENS", "").strip())

    # --- hosting ---------------------------------------------------------------
    # When set, the dashboard asks for this password (required when hosted online).
    dashboard_password: str = field(default_factory=lambda: os.getenv("DASHBOARD_PASSWORD", ""))
    # Set by the Docker image: refuse to show any data until DASHBOARD_PASSWORD is set.
    require_password: bool = field(default_factory=lambda: _bool("HOSTED"))
    # Signs login cookies. Optional: one is generated and kept next to the database.
    session_secret: str = field(default_factory=lambda: os.getenv("SESSION_SECRET", ""))
    # Built dashboard (npm run build). Served by the backend when present.
    frontend_dist: Path = field(
        default_factory=lambda: BACKEND_DIR.parent / os.getenv("FRONTEND_DIST", "frontend/dist")
    )


settings = Settings()


def calendar_sources(cfg: Settings) -> list[tuple[str | None, str]]:
    """(category or None for "infer from title", url) for every configured feed."""
    return (
        [(None, u) for u in cfg.gcal_ics_urls]
        + [("training", u) for u in cfg.gcal_training_urls]
        + [("work", u) for u in cfg.gcal_work_urls]
        + [("study", u) for u in cfg.gcal_study_urls]
        + [("reading", u) for u in cfg.gcal_reading_urls]
        + [("personal", u) for u in cfg.gcal_personal_urls]
    )

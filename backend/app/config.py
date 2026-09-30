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
    gcal_keywords: list[str] = field(default_factory=lambda: _list("GCAL_KEYWORDS"))
    demo_mode: bool = field(default_factory=lambda: _bool("DEMO_MODE"))
    backfill_days: int = field(default_factory=lambda: int(os.getenv("BACKFILL_DAYS", "90")))
    sync_interval_minutes: int = field(
        default_factory=lambda: int(os.getenv("SYNC_INTERVAL_MINUTES", "60"))
    )
    db_path: Path = field(
        default_factory=lambda: BACKEND_DIR / os.getenv("DB_PATH", "data/lifedashboard.sqlite3")
    )


settings = Settings()

"""SQLite cache of raw Garmin payloads.

We keep Garmin's JSON exactly as returned and normalize on read. That way a
new metric (e.g. for the readiness score) can be derived from history without
re-downloading anything.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

SCHEMA = """
CREATE TABLE IF NOT EXISTS daily (
    kind       TEXT NOT NULL,   -- sleep | hrv | stats | readiness
    day        TEXT NOT NULL,   -- YYYY-MM-DD
    fetched_at TEXT NOT NULL,
    payload    TEXT NOT NULL,
    PRIMARY KEY (kind, day)
);
CREATE TABLE IF NOT EXISTS activities (
    id         INTEGER PRIMARY KEY,
    day        TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    payload    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_day ON activities (day);
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: Path | str):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.conn.executescript(SCHEMA)

    # --- daily payloads -------------------------------------------------
    def put_daily(self, kind: str, day: str, payload: Any) -> None:
        with self.conn:
            self.conn.execute(
                "INSERT OR REPLACE INTO daily (kind, day, fetched_at, payload) VALUES (?, ?, ?, ?)",
                (kind, day, _now(), json.dumps(payload)),
            )

    def has_daily(self, kind: str, day: str) -> bool:
        row = self.conn.execute(
            "SELECT 1 FROM daily WHERE kind = ? AND day = ?", (kind, day)
        ).fetchone()
        return row is not None

    def get_daily(self, kind: str, start: str, end: str) -> dict[str, Any]:
        """Return {day: payload} for start <= day <= end."""
        rows = self.conn.execute(
            "SELECT day, payload FROM daily WHERE kind = ? AND day BETWEEN ? AND ? ORDER BY day",
            (kind, start, end),
        )
        return {day: json.loads(payload) for day, payload in rows}

    def get_one(self, kind: str, key: str) -> Any | None:
        row = self.conn.execute(
            "SELECT payload FROM daily WHERE kind = ? AND day = ?", (kind, key)
        ).fetchone()
        return json.loads(row[0]) if row else None

    # --- activities -----------------------------------------------------
    def put_activities(self, items: Iterable[tuple[int, str, Any]]) -> None:
        now = _now()
        with self.conn:
            self.conn.executemany(
                "INSERT OR REPLACE INTO activities (id, day, fetched_at, payload) VALUES (?, ?, ?, ?)",
                [(aid, day, now, json.dumps(p)) for aid, day, p in items],
            )

    def get_activities(self, start: str, end: str) -> list[Any]:
        rows = self.conn.execute(
            "SELECT payload FROM activities WHERE day BETWEEN ? AND ? ORDER BY day, id",
            (start, end),
        )
        return [json.loads(p) for (p,) in rows]

    # --- meta -----------------------------------------------------------
    def set_meta(self, key: str, value: str) -> None:
        with self.conn:
            self.conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value))

    def get_meta(self, key: str) -> str | None:
        row = self.conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

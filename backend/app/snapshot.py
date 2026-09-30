"""Encrypted snapshot of the whole dashboard, for free static hosting (GitHub Pages).

A scheduled GitHub Action syncs Garmin + calendar with the normal backend, asks
every API endpoint the dashboard uses for its answer, and bundles the answers
into one JSON document. That document is gzipped and encrypted with a key derived
from DASHBOARD_PASSWORD (PBKDF2-SHA256 → AES-256-GCM), so the published file is
unreadable without the password. The browser derives the same key and decrypts it.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import os
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from typing import Any

from .config import Settings

PBKDF2_ITERATIONS = 600_000  # OWASP 2023 recommendation for PBKDF2-SHA256
SPORT_RANGES = (91, 182, 365, 730, 1826)
DAYS_BACK, DAYS_AHEAD = 30, 21

# Endpoints the dashboard requests with fixed arguments (must match frontend/src/*.tsx).
FIXED = [
    "/api/status",
    "/api/sleep?days=30",
    "/api/readiness",
    "/api/upcoming?days=14",
    "/api/key-sessions?days=21",
    *[f"/api/sport/{s}?days={d}" for s in ("run", "ride", "swim") for d in SPORT_RANGES],
]


def salt_for(repo: str) -> bytes:
    """Stable per-repository salt, so a device that remembers its key stays signed in across updates."""
    return hashlib.sha256(f"lifedashboard-snapshot-v1:{repo}".encode()).digest()[:16]


def derive_key(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS, dklen=32)


def encrypt(bundle: dict[str, Any], password: str, salt: bytes) -> dict[str, Any]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    iv = os.urandom(12)
    plain = gzip.compress(json.dumps(bundle, separators=(",", ":")).encode(), mtime=0)
    ct = AESGCM(derive_key(password, salt)).encrypt(iv, plain, None)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iterations": PBKDF2_ITERATIONS,
            "salt": b64(salt), "iv": b64(iv), "data": b64(ct)}


def decrypt(doc: dict[str, Any], password: str) -> dict[str, Any]:
    """Inverse of encrypt (used by tests; the browser does the same with WebCrypto)."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = derive_key(password, base64.b64decode(doc["salt"]))
    plain = AESGCM(key).decrypt(base64.b64decode(doc["iv"]), base64.b64decode(doc["data"]), None)
    return json.loads(gzip.decompress(plain))


def build_bundle(cfg: Settings, today: date | None = None) -> dict[str, Any]:
    """Run a sync, then collect every answer the dashboard needs."""
    from fastapi.testclient import TestClient

    from .main import create_app

    # Inside the builder there's no login: the whole bundle is encrypted instead.
    cfg = replace(cfg, dashboard_password="", require_password=False, sync_interval_minutes=0)
    today = today or date.today()
    with TestClient(create_app(cfg)) as c:
        c.post("/api/sync")  # waits for the startup sync to finish

        def get(path: str) -> Any:
            r = c.get(path)
            r.raise_for_status()
            return r.json()

        responses = {path: get(path) for path in FIXED}
        days = {}
        for i in range(-DAYS_BACK, DAYS_AHEAD + 1):
            d = (today + timedelta(days=i)).isoformat()
            days[d] = get(f"/api/day?date={d}")
        weeks = {}
        for d in (today, today + timedelta(days=1), today - timedelta(days=7)):
            w = get(f"/api/week?date={d.isoformat()}")
            weeks[w["week_start"]] = w
        activities = get(f"/api/activities?start=2000-01-01&end={(today + timedelta(days=1)).isoformat()}")["activities"]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "today": today.isoformat(),
        "responses": responses,
        "days": days,
        "weeks": weeks,
        "activities": activities,
    }

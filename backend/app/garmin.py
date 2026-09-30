"""Pull data from Garmin Connect into the local store."""

from __future__ import annotations

import contextlib
import hashlib
import logging
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable

from .config import Settings
from .store import Store

log = logging.getLogger(__name__)

# Days this close to today are always re-fetched: Garmin keeps revising them
# (late-syncing watch, body battery through the day, etc.).
REFRESH_RECENT_DAYS = 2
# Small pause between requests so a backfill doesn't trip Garmin's rate limiting.
REQUEST_PAUSE_S = 0.4


class GarminNotConfigured(RuntimeError):
    pass


def token_file(tokenstore: str) -> Path:
    """Where python-garminconnect keeps the login for a GARMIN_TOKENSTORE value."""
    p = Path(tokenstore).expanduser()
    return p if p.name.endswith(".json") else p / "garmin_tokens.json"


def seed_tokens(settings: Settings) -> None:
    """On a server, write the pasted GARMIN_TOKENS to disk.

    Done once per pasted value: after that the file is refreshed in place, and a
    newly pasted value (e.g. after the login expired) replaces it.
    """
    if not settings.garmin_tokens:
        return
    path = token_file(settings.garmin_tokenstore)
    marker = path.with_suffix(".seeded")
    digest = hashlib.sha256(settings.garmin_tokens.encode()).hexdigest()
    if path.exists() and marker.exists() and marker.read_text() == digest:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(settings.garmin_tokens)
    path.chmod(0o600)
    marker.write_text(digest)
    log.info("Saved Garmin login from GARMIN_TOKENS to %s", path)


def save_tokens(client: Any, settings: Settings) -> None:
    """Persist the (possibly refreshed) login so it survives restarts."""
    with contextlib.suppress(Exception):
        client.client.dump(str(token_file(settings.garmin_tokenstore)))


def connect(settings: Settings, prompt_mfa: Callable[[], str] | None = None):
    """Log in, reusing cached tokens when possible."""
    from garminconnect import Garmin

    seed_tokens(settings)
    client = Garmin(
        settings.garmin_email or None,
        settings.garmin_password or None,
        prompt_mfa=prompt_mfa,
    )
    try:
        client.login(settings.garmin_tokenstore)
    except Exception as exc:  # noqa: BLE001 - surface any login failure the same way
        if not (settings.garmin_email and settings.garmin_password):
            if settings.require_password:  # hosted
                raise GarminNotConfigured(
                    "Garmin login missing or expired. On your computer run `python3 start.py --login`, "
                    "then `python3 start.py --garmin-token`, paste the output into GARMIN_TOKENS "
                    "on your host and redeploy."
                ) from exc
            raise GarminNotConfigured(
                "Not logged in to Garmin yet. Run `python3 start.py --login` "
                "(or double-click garmin-login) once, then click Sync now."
            ) from exc
        raise
    # The library only auto-saves refreshed tokens after a password login; make it
    # do so after a token login too, so a long-running server never loses its login.
    if hasattr(client, "client") and hasattr(client.client, "_tokenstore_path"):
        client.client._tokenstore_path = str(token_file(settings.garmin_tokenstore))
    save_tokens(client, settings)
    return client


def _days(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def sync(
    client: Any,
    store: Store,
    backfill_days: int,
    today: date | None = None,
    activity_backfill_days: int | None = None,
) -> dict[str, int]:
    """Fetch anything missing (or recent) for the last `backfill_days` days."""
    today = today or date.today()
    start = today - timedelta(days=backfill_days)
    counts = {"sleep": 0, "hrv": 0, "stats": 0, "readiness": 0, "maxmetrics": 0, "activities": 0}

    fetchers: dict[str, Callable[[str], Any]] = {
        "sleep": client.get_sleep_data,
        "hrv": client.get_hrv_data,
        "stats": client.get_stats,
        "readiness": client.get_training_readiness,
        "maxmetrics": client.get_max_metrics,  # VO2 max
    }

    for d in _days(start, today):
        day = d.isoformat()
        recent = (today - d).days <= REFRESH_RECENT_DAYS
        for kind, fetch in fetchers.items():
            if not recent and store.has_daily(kind, day):
                continue
            try:
                payload = fetch(day)
            except Exception as exc:  # noqa: BLE001 - one bad day shouldn't abort the sync
                log.warning("garmin %s %s failed: %s", kind, day, exc)
                continue
            # Store empties too, so days without data aren't re-requested forever.
            store.put_daily(kind, day, payload or {})
            counts[kind] += 1
            time.sleep(REQUEST_PAUSE_S)

    # Activities: one ranged call covers the whole window.
    since = store.get_meta("activities_synced_until")
    act_start = today - timedelta(days=max(backfill_days, activity_backfill_days or 0))
    if since:
        act_start = max(act_start, date.fromisoformat(since) - timedelta(days=REFRESH_RECENT_DAYS))
    items = client.get_activities_by_date(act_start.isoformat(), today.isoformat()) or []
    store.put_activities(
        (int(a["activityId"]), str(a.get("startTimeLocal", ""))[:10], a)
        for a in items
        if a.get("activityId") is not None
    )
    counts["activities"] = len(items)
    store.set_meta("activities_synced_until", today.isoformat())
    return counts

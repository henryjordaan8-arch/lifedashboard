"""FastAPI app: serves normalized Garmin + calendar data to the dashboard."""

from __future__ import annotations

import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query

from . import calendar_feed, demo, garmin, normalize, readiness
from .config import Settings, settings as default_settings
from .store import Store

log = logging.getLogger("lifedashboard")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


class SyncState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.running = False
        self.last_sync: str | None = None
        self.last_error: str | None = None
        self.last_counts: dict[str, int] | None = None


def create_app(cfg: Settings = default_settings, store: Store | None = None) -> FastAPI:
    store = store or Store(":memory:" if cfg.demo_mode else cfg.db_path)
    state = SyncState()
    client_holder: dict[str, Any] = {}

    def run_sync(wait: bool = False) -> None:
        if not state.lock.acquire(blocking=False):
            if wait:  # a sync is already in progress: let the caller see its result
                with state.lock:
                    pass
            return
        state.running = True
        try:
            if cfg.demo_mode:
                demo.seed(store, cfg.backfill_days)
                state.last_counts = {"demo": 1}
            else:
                if "client" not in client_holder:
                    client_holder["client"] = garmin.connect(cfg)
                state.last_counts = garmin.sync(client_holder["client"], store, cfg.backfill_days)
            state.last_sync = datetime.now(timezone.utc).isoformat(timespec="seconds")
            state.last_error = None
        except Exception as exc:  # noqa: BLE001
            log.exception("sync failed")
            client_holder.pop("client", None)  # force a fresh login next time
            state.last_error = str(exc)
        finally:
            state.running = False
            state.lock.release()

    async def sync_loop() -> None:
        while True:
            await asyncio.to_thread(run_sync)
            if cfg.sync_interval_minutes <= 0:
                return
            await asyncio.sleep(cfg.sync_interval_minutes * 60)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        task = asyncio.create_task(sync_loop())
        yield
        task.cancel()

    app = FastAPI(title="Life Dashboard", lifespan=lifespan)
    app.state.run_sync = run_sync  # exposed for tests

    def _range(days: int, end: date | None = None) -> tuple[str, str]:
        end = end or date.today()
        return (end - timedelta(days=days - 1)).isoformat(), end.isoformat()

    @app.get("/api/status")
    def status() -> dict[str, Any]:
        return {
            "mode": "demo" if cfg.demo_mode else "garmin",
            "syncing": state.running,
            "last_sync": state.last_sync,
            "last_error": state.last_error,
            "last_counts": state.last_counts,
            "calendar_configured": cfg.demo_mode or bool(cfg.gcal_ics_urls),
        }

    @app.post("/api/sync")
    async def sync_now() -> dict[str, Any]:
        await asyncio.to_thread(run_sync, True)
        return status()

    @app.get("/api/sleep")
    def sleep(days: int = Query(30, ge=1, le=365)) -> dict[str, Any]:
        start, end = _range(days)
        raw_sleep = store.get_daily("sleep", start, end)
        raw_hrv = store.get_daily("hrv", start, end)
        raw_stats = store.get_daily("stats", start, end)
        nights = []
        for day, raw in raw_sleep.items():
            night = normalize.sleep(day, raw)
            if not night:
                continue
            h = normalize.hrv(day, raw_hrv.get(day))
            s = normalize.stats(day, raw_stats.get(day))
            night["hrv"] = h
            night["body_battery_wake"] = s["body_battery_wake"] if s else None
            nights.append(night)
        return {"nights": nights}

    @app.get("/api/activities")
    def activities(start: str, end: str) -> dict[str, Any]:
        try:
            date.fromisoformat(start), date.fromisoformat(end)
        except ValueError as exc:
            raise HTTPException(400, "start and end must be YYYY-MM-DD") from exc
        items = [a for a in map(normalize.activity, store.get_activities(start, end)) if a]
        return {"activities": items}

    @app.get("/api/upcoming")
    def upcoming(days: int = Query(14, ge=1, le=60)) -> dict[str, Any]:
        if cfg.demo_mode:
            return {"configured": True, "events": demo.upcoming_events(days)}
        if not cfg.gcal_ics_urls:
            return {"configured": False, "events": []}
        return {
            "configured": True,
            "events": calendar_feed.upcoming(cfg.gcal_ics_urls, cfg.gcal_keywords, days),
        }

    @app.get("/api/readiness")
    def readiness_inputs() -> dict[str, Any]:
        today = date.today()
        start, end = _range(readiness.BASELINE_DAYS + 1, today)
        raw_sleep = store.get_daily("sleep", start, end)
        raw_hrv = store.get_daily("hrv", start, end)
        raw_stats = store.get_daily("stats", start, end)

        def get_day(d: str) -> dict[str, float | None]:
            return readiness.daily_values(
                d,
                normalize.sleep(d, raw_sleep.get(d)),
                normalize.hrv(d, raw_hrv.get(d)),
                normalize.stats(d, raw_stats.get(d)),
            )

        acts = [a for a in map(normalize.activity, store.get_activities(start, end)) if a]
        garmin_today = normalize.readiness(end, store.get_daily("readiness", end, end).get(end))
        return readiness.build(today, get_day, acts, garmin_today)

    return app


app = create_app()

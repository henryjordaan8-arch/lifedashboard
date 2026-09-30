"""FastAPI app: serves normalized Garmin + calendar data to the dashboard."""

from __future__ import annotations

import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from . import calendar_feed, demo, garmin, normalize, planner, readiness
from .config import BACKEND_DIR, Settings, calendar_sources, settings as default_settings
from .store import Store

log = logging.getLogger("lifedashboard")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


class ManualTick(BaseModel):
    week_start: str
    goal_id: str
    done: bool


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
            "calendar_configured": cfg.demo_mode or bool(calendar_sources(cfg)),
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

    def _day(value: str | None) -> date:
        if not value:
            return date.today()
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise HTTPException(400, "dates must be YYYY-MM-DD") from exc

    def activities_between(start: str, end: str) -> list[dict[str, Any]]:
        return [a for a in map(normalize.activity, store.get_activities(start, end)) if a]

    def events_between(start: date, end: date) -> list[dict[str, Any]]:
        """Calendar events with start <= day < end."""
        if cfg.demo_mode:
            return sorted(demo.calendar_events(start, end), key=lambda e: e["start"])
        extra = {"training": cfg.training_keywords, "work": cfg.work_keywords, "study": cfg.study_keywords}
        return calendar_feed.events(
            calendar_sources(cfg),
            datetime.combine(start, datetime.min.time()),
            datetime.combine(end, datetime.min.time()),
            extra,
            cfg.key_session_keywords,
        )

    @app.get("/api/activities")
    def activities(start: str, end: str) -> dict[str, Any]:
        return {"activities": activities_between(_day(start).isoformat(), _day(end).isoformat())}

    @app.get("/api/upcoming")
    def upcoming(days: int = Query(14, ge=1, le=60)) -> dict[str, Any]:
        """Planned training sessions from now on."""
        if not (cfg.demo_mode or calendar_sources(cfg)):
            return {"configured": False, "events": []}
        today = date.today()
        now_iso = datetime.now().isoformat(timespec="minutes")
        evs = [
            e for e in events_between(today, today + timedelta(days=days))
            if e["category"] == "training" and (e["all_day"] or e["end"] >= now_iso)
        ]
        return {"configured": True, "events": evs}

    @app.get("/api/day")
    def day_view(day: str | None = Query(None, alias="date")) -> dict[str, Any]:
        d = _day(day)
        evs = events_between(d, d + timedelta(days=1))
        plan = planner.day_plan(d, evs, activities_between(d.isoformat(), d.isoformat()))
        plan["configured"] = cfg.demo_mode or bool(calendar_sources(cfg))
        return plan

    @app.get("/api/key-sessions")
    def key_sessions(days: int = Query(21, ge=1, le=90)) -> dict[str, Any]:
        today = date.today()
        evs = events_between(today, today + timedelta(days=days))
        return {"events": planner.key_sessions(evs, datetime.now())}

    def _manual_key(week_start: str, goal_id: str) -> str:
        return f"manual:{week_start}:{goal_id}"

    @app.get("/api/week")
    def week(day: str | None = Query(None, alias="date")) -> dict[str, Any]:
        ws, we = planner.week_bounds(_day(day))
        goals, is_example = planner.load_goals(cfg.goals_path, BACKEND_DIR / "goals.example.json")
        acts = activities_between(ws.isoformat(), we.isoformat())
        evs = events_between(ws, we + timedelta(days=1))
        raw_sleep = store.get_daily("sleep", ws.isoformat(), we.isoformat())
        raw_stats = store.get_daily("stats", ws.isoformat(), we.isoformat())
        sleep_by_day = {d: normalize.sleep(d, r) for d, r in raw_sleep.items()}
        steps_by_day = {d: (normalize.stats(d, r) or {}).get("steps") for d, r in raw_stats.items()}
        manual = {g["id"]: store.get_meta(_manual_key(ws.isoformat(), g["id"])) == "1" for g in goals}
        now = datetime.now()
        results = [
            planner.evaluate_goal(
                g, week_start=ws, now=now, activities=acts, events=evs,
                sleep_by_day=sleep_by_day, steps_by_day=steps_by_day, manual=manual,
            )
            for g in goals
        ]
        return {
            "week_start": ws.isoformat(),
            "week_end": we.isoformat(),
            "using_example": is_example,
            "goals": results,
        }

    @app.post("/api/week/manual")
    def tick(body: ManualTick) -> dict[str, Any]:
        store.set_meta(_manual_key(_day(body.week_start).isoformat(), body.goal_id), "1" if body.done else "0")
        return week(body.week_start)

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

        # Recent-session stats look back 5 weeks; VO2 max trend ~2 months.
        acts = activities_between((today - timedelta(days=36)).isoformat(), end)
        garmin_today = normalize.readiness(end, store.get_daily("readiness", end, end).get(end))
        vo2_start = (today - timedelta(days=60)).isoformat()
        vo2 = {d: normalize.vo2max(d, r) for d, r in store.get_daily("maxmetrics", vo2_start, end).items()}
        return readiness.build(today, get_day, acts, garmin_today, {d: v for d, v in vo2.items() if v})

    return app


app = create_app()

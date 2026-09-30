"""FastAPI app: serves normalized Garmin + calendar data to the dashboard."""

from __future__ import annotations

import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import auth, calendar_feed, demo, garmin, normalize, planner, readiness, scoring, sport
from .config import BACKEND_DIR, Settings, calendar_sources, settings as default_settings
from .store import Store

log = logging.getLogger("lifedashboard")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx logs every request URL at INFO, and the secret calendar URLs must never reach a log.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def _version() -> str:
    try:
        return (BACKEND_DIR.parent / "VERSION").read_text().strip()
    except OSError:
        return "unknown"


class Login(BaseModel):
    password: str


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
                demo.seed(store, cfg.backfill_days, activity_days=cfg.activity_backfill_days)
                state.last_counts = {"demo": 1}
            else:
                if "client" not in client_holder:
                    client_holder["client"] = garmin.connect(cfg)
                state.last_counts = garmin.sync(
                    client_holder["client"], store, cfg.backfill_days,
                    activity_backfill_days=cfg.activity_backfill_days,
                )
                garmin.save_tokens(client_holder["client"], cfg)
            state.last_sync = datetime.now(timezone.utc).isoformat(timespec="seconds")
            state.last_error = None
        except garmin.GarminNotConfigured as exc:
            log.warning("%s", exc)
            state.last_error = str(exc)
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

    app = FastAPI(title="Life Dashboard", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.run_sync = run_sync  # exposed for tests

    # ---- login -------------------------------------------------------------
    misconfigured = cfg.require_password and not cfg.dashboard_password
    if misconfigured:
        log.error("Running hosted but DASHBOARD_PASSWORD is empty: the dashboard stays locked.")
    # With no password configured on a server, lock with an unguessable one so nothing leaks.
    password = cfg.dashboard_password or (auth.secrets.token_urlsafe(32) if misconfigured else "")
    gate = auth.Auth(password, auth.load_secret(cfg.session_secret, cfg.db_path.parent))
    public = {"/api/health", "/api/session", "/api/login", "/api/logout"}

    @app.middleware("http")
    async def require_login(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") and path not in public and not gate.valid(request.cookies.get(auth.COOKIE)):
            return JSONResponse({"detail": "login required"}, status_code=401)
        return await call_next(request)

    def _client(request: Request) -> str:
        fwd = request.headers.get("x-forwarded-for", "")
        return fwd.split(",")[0].strip() or (request.client.host if request.client else "?")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"ok": "true"}

    @app.get("/api/session")
    def session(request: Request) -> dict[str, bool]:
        return {"auth_required": gate.enabled, "logged_in": gate.valid(request.cookies.get(auth.COOKIE))}

    @app.post("/api/login")
    def login(body: Login, request: Request, response: Response) -> dict[str, bool]:
        if misconfigured:
            raise HTTPException(503, "No DASHBOARD_PASSWORD is set on the server yet. Add it in your host's settings and redeploy.")
        who = _client(request)
        # Per-address limit, plus a global one so rotating addresses doesn't help a guesser.
        if gate.locked_out(who) or gate.locked_out("*", auth.MAX_FAILURES_GLOBAL):
            raise HTTPException(429, "Too many attempts — try again in 15 minutes.")
        if gate.enabled and not gate.check_password(body.password):
            gate.record_failure(who)
            gate.record_failure("*")
            raise HTTPException(401, "Wrong password")
        response.set_cookie(
            auth.COOKIE, gate.issue(), max_age=auth.SESSION_DAYS * 86400, httponly=True,
            secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https",
            samesite="lax",
        )
        return {"logged_in": True}

    @app.post("/api/logout")
    def logout(response: Response) -> dict[str, bool]:
        response.delete_cookie(auth.COOKIE)
        return {"logged_in": False}

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
            "version": _version(),
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
        extra = {
            "training": cfg.training_keywords, "work": cfg.work_keywords, "study": cfg.study_keywords,
            "reading": cfg.reading_keywords, "personal": cfg.personal_keywords,
        }
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
        """Planned training (for the calendar) and highlights: key sessions + calls."""
        if not (cfg.demo_mode or calendar_sources(cfg)):
            return {"configured": False, "events": [], "highlights": []}
        today = date.today()
        now_iso = datetime.now().isoformat(timespec="minutes")
        ahead = [e for e in events_between(today, today + timedelta(days=days)) if e["all_day"] or e["end"] >= now_iso]
        for e in ahead:
            e["is_call"] = calendar_feed.is_call(e["title"], cfg.call_keywords)
        return {
            "configured": True,
            "events": [e for e in ahead if e["category"] == "training"],
            "highlights": [e for e in ahead if (e["category"] == "training" and e.get("key_reason")) or e["is_call"]],
        }

    @app.get("/api/events")
    def events(start: str, end: str, category: str | None = None) -> dict[str, Any]:
        """Calendar events with start <= day <= end, optionally one category (e.g. study)."""
        s, e = _day(start), _day(end)
        if (e - s).days > 120:
            raise HTTPException(400, "range too long (max 120 days)")
        evs = events_between(s, e + timedelta(days=1)) if (cfg.demo_mode or calendar_sources(cfg)) else []
        return {"events": [x for x in evs if not category or x["category"] == category]}

    @app.get("/api/day")
    def day_view(day: str | None = Query(None, alias="date")) -> dict[str, Any]:
        d = _day(day)
        evs = events_between(d, d + timedelta(days=1))
        plan = planner.day_plan(d, evs, activities_between(d.isoformat(), d.isoformat()),
                                planner.load_routine(cfg.routine_path))
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

    @app.get("/api/sport/{name}")
    def sport_dashboard(name: str, days: int = Query(182, ge=7, le=3650)) -> dict[str, Any]:
        if name not in sport.SPORTS:
            raise HTTPException(404, f"unknown sport {name!r}; use one of {', '.join(sport.SPORTS)}")
        end = date.today()
        start = end - timedelta(days=days - 1)
        acts = activities_between("0000-01-01", end.isoformat())
        vo2 = []
        if name in ("run", "ride"):
            for d, raw in store.get_daily("maxmetrics", start.isoformat(), end.isoformat()).items():
                v = normalize.vo2max(d, raw)
                if v and v.get(name) is not None:
                    vo2.append({"date": d, "value": v[name]})
        return sport.sport_view(name, acts, vo2, start, end, cfg.key_session_keywords)

    @app.get("/api/readiness")
    def readiness_inputs() -> dict[str, Any]:
        today = date.today()
        # 60-day HRV baseline + alert baselines need ~2 months of nights.
        start, end = _range(91, today)
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

        # EWMA load needs ~4 months of activities; VO2 max trend ~2 months.
        acts = activities_between((today - timedelta(days=120)).isoformat(), end)
        for a in acts:
            a["key"] = calendar_feed.key_reason(a["name"], "training", a["sport"], cfg.key_session_keywords)
            if a["sport"] in ("run", "ride"):
                a["decoupling"] = normalize.decoupling(store.get_one("splits", str(a["id"])), a["sport"])
        garmin_today = normalize.readiness(end, store.get_daily("readiness", end, end).get(end))
        vo2_start = (today - timedelta(days=60)).isoformat()
        vo2 = {d: normalize.vo2max(d, r) for d, r in store.get_daily("maxmetrics", vo2_start, end).items()}
        vo2 = {d: v for d, v in vo2.items() if v}
        result = readiness.build(today, get_day, acts, garmin_today, vo2)

        # Per-day metrics for the v2 score and the alerts.
        days: dict[str, dict[str, Any]] = {}
        for d in {*raw_sleep, *raw_hrv, *raw_stats}:
            n = normalize.sleep(d, raw_sleep.get(d)) or {}
            h = normalize.hrv(d, raw_hrv.get(d)) or {}
            s = normalize.stats(d, raw_stats.get(d)) or {}
            days[d] = {
                "hrv": h.get("last_night") or n.get("avg_hrv"),
                "rhr": s.get("resting_hr") or n.get("resting_hr"),
                "sleep_score": n.get("score"),
                "respiration": n.get("respiration"),
                "respiration_low": n.get("respiration_low"),
                "respiration_high": n.get("respiration_high"),
                "skin_temp_dev": n.get("skin_temp_dev"),
                "steps": s.get("steps"),
                "stress": s.get("avg_stress"),
            }
        vo2_run = {d: v["run"] for d, v in vo2.items() if v.get("run")}
        v2 = scoring.compute(today, days, acts, vo2_run, (garmin_today or {}).get("recovery_time_h"))
        result["score"] = v2["score"]
        result["components"] = v2["components"]
        result["alerts"] = scoring.alerts(today, days, acts, vo2_run, v2["acwr_series"])
        result["acwr_ewma"] = v2["acwr_series"][-1][1] if v2["acwr_series"] else None
        return result

    # ---- the dashboard itself (production build) ----------------------------------
    dist = cfg.frontend_dist
    if (dist / "index.html").exists():
        if (dist / "assets").is_dir():
            app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str) -> FileResponse:
            if path.startswith("api/"):
                raise HTTPException(404)
            file = (dist / path).resolve()
            if path and file.is_file() and dist.resolve() in file.parents:
                return FileResponse(file)
            return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})

    return app


app = create_app()

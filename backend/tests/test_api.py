from dataclasses import replace
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.store import Store


def make_client():
    cfg = replace(Settings(), demo_mode=True, sync_interval_minutes=0, backfill_days=60)
    app = create_app(cfg, Store(":memory:"))
    return TestClient(app)


def test_demo_end_to_end():
    with make_client() as c:
        c.post("/api/sync")
        status = c.get("/api/status").json()
        assert status["mode"] == "demo" and status["last_error"] is None

        nights = c.get("/api/sleep?days=14").json()["nights"]
        assert len(nights) == 14
        assert all(n["deep_s"] + n["light_s"] + n["rem_s"] == n["duration_s"] for n in nights)

        today = date.today()
        start = (today - timedelta(days=30)).isoformat()
        acts = c.get(f"/api/activities?start={start}&end={today.isoformat()}").json()["activities"]
        assert len(acts) > 10
        assert {a["sport"] for a in acts} <= {"run", "ride", "swim", "strength", "other"}

        up = c.get("/api/upcoming?days=7").json()
        assert up["configured"] and len(up["events"]) >= 5

        r = c.get("/api/readiness").json()
        assert r["score"] is None
        keys = {i["key"] for i in r["inputs"]}
        assert {"hrv", "resting_hr", "sleep_score"} <= keys
        hrv = next(i for i in r["inputs"] if i["key"] == "hrv")
        assert hrv["baseline_mean"] is not None and hrv["effect"] is not None
        assert len(hrv["history"]) == 14
        assert r["load"]["chronic"] > 0


def test_activities_rejects_bad_dates():
    with make_client() as c:
        assert c.get("/api/activities?start=nope&end=2026-01-01").status_code == 400

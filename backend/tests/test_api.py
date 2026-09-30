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
        assert {a["sport"] for a in acts} <= {"run", "ride", "swim", "strength", "rehab", "other"}

        up = c.get("/api/upcoming?days=7").json()
        assert up["configured"] and len(up["events"]) >= 4
        assert {e["category"] for e in up["events"]} == {"training"}
        assert [e["start"] for e in up["events"]] == sorted(e["start"] for e in up["events"])

        day = c.get("/api/day").json()
        cats = {e["category"] for e in day["events"]}
        assert day["configured"] and cats <= {"training", "work", "study", "other"}
        assert set(day["hours"]) == {"training", "work", "study", "other"}

        keys = c.get("/api/key-sessions?days=21").json()["events"]
        assert keys and all(e["key_reason"] for e in keys)

        wk = c.get("/api/week").json()
        assert wk["using_example"] and wk["goals"]
        manual = next(g for g in wk["goals"] if g["metric"] == "manual")
        assert not manual["done"]
        wk = c.post("/api/week/manual", json={"week_start": wk["week_start"], "goal_id": manual["id"], "done": True}).json()
        assert next(g for g in wk["goals"] if g["id"] == manual["id"])["done"]

        # past week: planned training should mostly be matched by demo activities
        last_week = (today - timedelta(days=7)).isoformat()
        past = c.get(f"/api/day?date={last_week}").json()
        training = [e for e in past["events"] if e["category"] == "training"]
        assert not training or any(e["completed_by"] for e in training)

        r = c.get("/api/readiness").json()
        assert r["score"] is None
        keys = {i["key"] for i in r["inputs"]}
        assert {"hrv", "resting_hr", "sleep_score"} <= keys
        hrv = next(i for i in r["inputs"] if i["key"] == "hrv")
        assert hrv["baseline_mean"] is not None and hrv["effect"] is not None
        assert len(hrv["history"]) == 14
        assert r["load"]["chronic"] > 0
        assert r["fitness"]["vo2max_run"] > 40
        assert r["recent"]["sessions_7d"] > 0 and r["recent"]["rehab_7d"] > 0


def test_activities_rejects_bad_dates():
    with make_client() as c:
        assert c.get("/api/activities?start=nope&end=2026-01-01").status_code == 400

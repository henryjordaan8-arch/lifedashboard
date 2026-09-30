from datetime import date, datetime

from app import planner


def ev(title, start, end, category="training", sport="run", key=None):
    return {"id": title, "title": title, "start": start, "end": end, "all_day": False,
            "category": category, "sport": sport, "key_reason": key}


def act(aid, start, sport="run", minutes=40, km=8.0, name="Run"):
    return {"id": aid, "name": name, "sport": sport, "date": start[:10], "start": start,
            "duration_s": minutes * 60, "distance_m": km * 1000 if km else None}


def test_planned_session_matched_to_activity():
    events = [ev("Easy run", "2026-09-28T07:00", "2026-09-28T07:45"),
              ev("Gym", "2026-09-28T18:00", "2026-09-28T19:00", sport="strength"),
              ev("Meeting", "2026-09-28T10:00", "2026-09-28T11:00", category="work", sport=None)]
    acts = [act(1, "2026-09-28T07:10"), act(2, "2026-09-28T12:00", sport="swim", km=2)]
    plan = planner.day_plan(date(2026, 9, 28), events, acts)
    done = {e["title"]: e["completed_by"] for e in plan["events"]}
    assert done["Easy run"]["id"] == 1
    assert done["Gym"] is None and done["Meeting"] is None
    assert [a["id"] for a in plan["unplanned_activities"]] == [2]
    assert plan["hours"] == {"training": 1.75, "work": 1.0, "study": 0.0, "reading": 0.0, "personal": 0.0, "other": 0.0}


def evaluate(goal, now, activities=(), events=(), sleep=None, manual=None):
    return planner.evaluate_goal(
        {"id": "g", **goal}, week_start=date(2026, 9, 28), now=now, activities=list(activities),
        events=list(events), sleep_by_day=sleep or {}, steps_by_day={}, manual=manual or {},
    )


def test_activity_goal_ticks_itself():
    runs = [act(1, "2026-09-28T07:00"), act(2, "2026-09-30T07:00"), act(3, "2026-10-01T07:00", sport="ride")]
    r = evaluate({"metric": "activity_count", "sport": "run", "target": 2}, datetime(2026, 9, 30, 12))
    assert r["progress"] == 0 and r["status"] == "behind"
    r = evaluate({"metric": "activity_count", "sport": "run", "target": 2}, datetime(2026, 9, 30, 12), runs)
    assert r["progress"] == 2 and r["done"] and r["status"] == "done"


def test_calendar_hours_count_only_finished_blocks():
    events = [ev("Study", "2026-09-28T19:00", "2026-09-28T21:00", category="study", sport=None),
              ev("Study", "2026-10-02T19:00", "2026-10-02T21:00", category="study", sport=None)]
    r = evaluate({"metric": "calendar_hours", "category": "study", "target": 4}, datetime(2026, 9, 30, 12), events=events)
    assert r["progress"] == 2 and r["planned"] == 2 and not r["done"] and r["status"] == "on_track"


def test_at_most_goal():
    runs = [act(1, "2026-09-28T07:00", km=12), act(2, "2026-09-30T07:00", km=10)]
    goal = {"metric": "activity_km", "sport": "run", "target": 20, "mode": "at_most"}
    assert evaluate(goal, datetime(2026, 9, 30, 12), runs)["status"] == "over"
    assert evaluate(goal, datetime(2026, 9, 30, 12), runs[:1])["status"] == "on_track"
    assert evaluate(goal, datetime(2026, 10, 5, 12), runs[:1])["done"]


def test_manual_and_sleep_goals():
    assert evaluate({"metric": "manual"}, datetime(2026, 9, 30), manual={"g": True})["done"]
    sleep = {"2026-09-28": {"duration_s": 7.5 * 3600, "score": 80}, "2026-09-29": {"duration_s": 6 * 3600, "score": 70}}
    r = evaluate({"metric": "sleep_nights", "min_hours": 7, "target": 5}, datetime(2026, 9, 30), sleep=sleep)
    assert r["progress"] == 1


def test_activity_count_counts_scheduled_sessions_as_planned():
    runs = [act(1, "2026-09-28T07:00")]
    events = [ev("Tempo", "2026-10-02T18:00", "2026-10-02T19:00"),
              ev("Ride", "2026-10-03T08:00", "2026-10-03T10:00", sport="ride")]
    r = evaluate({"metric": "activity_count", "sport": "run", "target": 2}, datetime(2026, 9, 30, 12), runs, events)
    assert r["progress"] == 1 and r["planned"] == 1 and r["status"] == "on_track"


def test_day_window_and_routine():
    routine = {"day_start": "05:00", "day_end": "21:00",
               "markers": [{"title": "Wake up", "at": "05:00"}, {"title": "Sleep", "at": "21:00"}],
               "blocks": [{"title": "Dinner", "start": "19:15", "end": "20:00", "category": "personal"},
                          {"title": "Bed & read", "start": "20:00", "end": "21:00", "category": "reading"}]}
    events = [ev("Early", "2026-09-28T04:00", "2026-09-28T04:45", category="work", sport=None),
              ev("Gym", "2026-09-28T06:30", "2026-09-28T07:20", sport="strength"),
              ev("Late show", "2026-09-28T22:00", "2026-09-28T23:30", category="other", sport=None),
              ev("Overlaps start", "2026-09-28T04:30", "2026-09-28T05:30", category="work", sport=None)]
    plan = planner.day_plan(date(2026, 9, 28), events, [], routine)
    titles = [e["title"] for e in plan["events"]]
    assert titles == ["Overlaps start", "Gym", "Dinner", "Bed & read"]
    assert plan["window"] == {"start": "05:00", "end": "21:00"}
    assert [m["title"] for m in plan["markers"]] == ["Wake up", "Sleep"]
    assert plan["hours"]["reading"] == 1.0 and plan["hours"]["personal"] == 0.75
    assert next(e for e in plan["events"] if e["title"] == "Dinner")["source"] == "routine"


def test_routine_file_loads(tmp_path):
    assert planner.load_routine(tmp_path / "missing.json")["day_start"] == "05:00"
    from app.config import BACKEND_DIR
    r = planner.load_routine(BACKEND_DIR / "routine.json")
    assert r["day_end"] == "21:00" and {b["title"] for b in r["blocks"]} == {"Dinner", "Bed & read"}

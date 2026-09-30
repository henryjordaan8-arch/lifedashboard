"""Daily plan, key sessions and the self-marking weekly checklist."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

MATCH_WINDOW_H = 4  # a Garmin activity within this many hours of a planned session completes it


def _dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso if "T" in iso else f"{iso}T00:00")


def event_hours(ev: dict[str, Any]) -> float:
    if ev["all_day"]:
        return 0.0
    return max(0.0, (_dt(ev["end"]) - _dt(ev["start"])).total_seconds() / 3600)


def _sports_match(planned: str | None, actual: str) -> bool:
    if planned in (None, "other") or actual == "other":
        return True
    # Rehab exercises are often logged as a strength activity, and vice versa.
    return planned == actual or {planned, actual} == {"rehab", "strength"}


def match_activities(events: list[dict], activities: list[dict]) -> None:
    """Mark planned training events as completed by the closest same-day Garmin activity."""
    used: set[int] = set()
    for ev in events:
        ev["completed_by"] = None
        if ev["category"] != "training":
            continue
        ev_day = ev["start"][:10]
        ev_start = _dt(ev["start"])
        best = None
        for a in activities:
            if a["id"] in used or a["date"] != ev_day or not _sports_match(ev.get("sport"), a["sport"]):
                continue
            gap = abs((_dt(a["start"]) - ev_start).total_seconds()) / 3600
            if ev["all_day"] or gap <= MATCH_WINDOW_H:
                if best is None or gap < best[0]:
                    best = (gap, a)
        if best:
            used.add(best[1]["id"])
            ev["completed_by"] = {
                "id": best[1]["id"], "name": best[1]["name"], "start": best[1]["start"],
                "duration_s": best[1]["duration_s"], "distance_m": best[1]["distance_m"],
            }


def day_plan(day: date, events: list[dict], activities: list[dict]) -> dict[str, Any]:
    day_iso = day.isoformat()
    todays = [e for e in events if e["start"][:10] == day_iso or (e["all_day"] and e["start"] <= day_iso < e["end"])]
    acts = [a for a in activities if a["date"] == day_iso]
    match_activities(todays, acts)
    totals = {c: 0.0 for c in ("training", "work", "study", "other")}
    for e in todays:
        totals[e["category"]] += event_hours(e)
    matched = {e["completed_by"]["id"] for e in todays if e.get("completed_by")}
    return {
        "date": day_iso,
        "events": todays,
        "hours": {k: round(v, 2) for k, v in totals.items()},
        # Garmin activities that weren't on the calendar at all
        "unplanned_activities": [a for a in acts if a["id"] not in matched],
    }


def key_sessions(events: list[dict], now: datetime) -> list[dict]:
    now_iso = now.isoformat(timespec="minutes")
    keys = [e for e in events if e.get("key_reason") and (e["all_day"] or e["end"] >= now_iso)]
    return sorted(keys, key=lambda e: e["start"])


# ---------------------------------------------------------------- weekly goals

def week_bounds(day: date) -> tuple[date, date]:
    start = day - timedelta(days=day.weekday())  # Monday
    return start, start + timedelta(days=6)


def load_goals(path: Path, example: Path) -> tuple[list[dict], bool]:
    """Return (goals, is_example)."""
    src, is_example = (path, False) if path.exists() else (example, True)
    data = json.loads(src.read_text())
    return data.get("goals", []), is_example


UNITS = {
    "activity_count": "sessions",
    "activity_hours": "h",
    "activity_km": "km",
    "calendar_hours": "h",
    "calendar_count": "sessions",
    "sleep_nights": "nights",
    "step_days": "days",
    "manual": "",
}


def _activity_filter(goal: dict):
    sport = goal.get("sport")
    sports = sport if isinstance(sport, list) else [sport] if sport else None
    name = (goal.get("name_contains") or "").lower()
    min_min = goal.get("min_minutes", 0)

    def ok(a: dict) -> bool:
        if sports and a["sport"] not in sports:
            return False
        if name and name not in a["name"].lower():
            return False
        return (a["duration_s"] or 0) >= min_min * 60

    return ok


def _event_filter(goal: dict):
    cat = goal.get("category")
    kw = (goal.get("title_contains") or "").lower()
    return lambda e: (not cat or e["category"] == cat) and (not kw or kw in e["title"].lower())


def evaluate_goal(
    goal: dict,
    *,
    week_start: date,
    now: datetime,
    activities: list[dict],
    events: list[dict],
    sleep_by_day: dict[str, dict],
    steps_by_day: dict[str, int | None],
    manual: dict[str, bool],
) -> dict[str, Any]:
    metric = goal.get("metric", "manual")
    target = float(goal.get("target", 1))
    at_most = goal.get("mode") == "at_most"
    now_iso = now.isoformat(timespec="minutes")
    progress = 0.0
    planned = 0.0  # still scheduled later this week (calendar metrics only)
    items: list[str] = []

    if metric in ("activity_count", "activity_hours", "activity_km"):
        acts = [a for a in activities if _activity_filter(goal)(a)]
        for a in acts:
            if metric == "activity_count":
                progress += 1
            elif metric == "activity_hours":
                progress += (a["duration_s"] or 0) / 3600
            else:
                progress += (a["distance_m"] or 0) / 1000
            items.append(f"{a['date']} · {a['name']}")
    elif metric in ("calendar_hours", "calendar_count"):
        for e in filter(_event_filter(goal), events):
            amount = 1.0 if metric == "calendar_count" else event_hours(e)
            # A calendar block counts as done once it's over.
            if e["end"] <= now_iso:
                progress += amount
                items.append(f"{e['start'][:10]} · {e['title']}")
            else:
                planned += amount
    elif metric == "sleep_nights":
        min_h = goal.get("min_hours", 0)
        min_score = goal.get("min_score", 0)
        for day, n in sorted(sleep_by_day.items()):
            if n and n["duration_s"] / 3600 >= min_h and (n.get("score") or 0) >= min_score:
                progress += 1
                items.append(f"{day} · {n['duration_s'] / 3600:.1f} h")
    elif metric == "step_days":
        min_steps = goal.get("min_steps", 10000)
        for day, steps in sorted(steps_by_day.items()):
            if steps and steps >= min_steps:
                progress += 1
                items.append(f"{day} · {steps:,} steps")
    else:  # manual
        metric = "manual"
        progress = 1.0 if manual.get(goal["id"]) else 0.0
        target = 1.0

    elapsed = min(1.0, max(0.0, (now - datetime.combine(week_start, datetime.min.time())).total_seconds() / (7 * 86400)))
    week_over = elapsed >= 1.0
    if at_most:
        status = "over" if progress > target else "done" if week_over else "on_track"
        done = progress <= target and week_over
    else:
        done = progress >= target
        if done:
            status = "done"
        elif metric == "manual":
            status = "todo"
        elif progress + planned >= target or progress >= target * elapsed:
            status = "on_track"
        else:
            status = "behind"

    return {
        "id": goal["id"],
        "label": goal.get("label", goal["id"]),
        "metric": metric,
        "mode": "at_most" if at_most else "at_least",
        "unit": goal.get("unit", UNITS.get(metric, "")),
        "target": target,
        "progress": round(progress, 1),
        "planned": round(planned, 1),
        "done": done,
        "status": status,
        "items": items,
    }

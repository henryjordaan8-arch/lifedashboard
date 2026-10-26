"""Per-sport dashboards: volume, progress trends, personal bests, zones."""

from __future__ import annotations

from datetime import date, timedelta
from statistics import fmean, median
from typing import Any

from .calendar_feed import activity_key

SPORTS = ("run", "ride", "swim")

# metric key -> (label, unit, direction: +1 higher is better / -1 lower is better / 0 neutral)
TREND_METRICS: dict[str, dict[str, tuple[str, str, int]]] = {
    "run": {
        "pace": ("Average pace", "s/km", -1),
        "efficiency": ("Aerobic efficiency", "m/min per bpm", +1),
        "cadence": ("Cadence", "spm", 0),
    },
    "ride": {
        "power": ("Average power", "W", +1),
        "efficiency": ("Aerobic efficiency", "W per bpm", +1),
        "max_20min_power": ("Best 20-min power", "W", +1),
    },
    "swim": {
        "pace": ("Average pace", "s/100m", -1),
        "swolf": ("SWOLF", "", -1),
        "cadence": ("Stroke rate", "spm", 0),
    },
}


def _moving(a: dict) -> float | None:
    return a.get("moving_s") or a.get("duration_s")


def derived(a: dict) -> dict[str, float | None]:
    """Sport-specific per-session metrics derived from the Garmin summary."""
    sport, dist, secs, hr = a["sport"], a.get("distance_m"), _moving(a), a.get("avg_hr")
    out: dict[str, float | None] = {}
    if sport == "run":
        out["pace"] = secs / (dist / 1000) if dist and secs else None
        speed_m_min = dist / (secs / 60) if dist and secs else None
        out["efficiency"] = round(speed_m_min / hr, 3) if speed_m_min and hr else None
        out["cadence"] = a.get("cadence")
    elif sport == "ride":
        power = a.get("norm_power") or a.get("avg_power")
        out["power"] = a.get("avg_power")
        out["speed_kmh"] = (dist / 1000) / (secs / 3600) if dist and secs else None
        out["efficiency"] = round(power / hr, 3) if power and hr else None
        out["max_20min_power"] = a.get("max_20min_power")
    elif sport == "swim":
        out["pace"] = secs / (dist / 100) if dist and secs else None
        out["swolf"] = a.get("swolf")
        out["cadence"] = a.get("cadence")
    return out


def _weighted(sessions: list[dict], key: str) -> float | None:
    pairs = [(s[key], _moving(s) or 0) for s in sessions if s.get(key) is not None]
    total = sum(w for _, w in pairs)
    return sum(v * w for v, w in pairs) / total if total else None


def summarize(sport: str, sessions: list[dict]) -> dict[str, Any]:
    dist = sum(s.get("distance_m") or 0 for s in sessions)
    secs = sum(_moving(s) or 0 for s in sessions)
    out: dict[str, Any] = {
        "sessions": len(sessions),
        "distance_km": round(dist / 1000, 1),
        "duration_h": round(sum(s.get("duration_s") or 0 for s in sessions) / 3600, 1),
        "elevation_m": round(sum(s.get("elevation_gain_m") or 0 for s in sessions)),
        "avg_hr": round(_weighted(sessions, "avg_hr")) if _weighted(sessions, "avg_hr") else None,
        "load": round(sum(s.get("training_load") or 0 for s in sessions)),
        "key_sessions": sum(1 for s in sessions if s["key"]),
    }
    if sport == "run":
        out["pace"] = round(secs / (dist / 1000)) if dist else None
    elif sport == "swim":
        out["pace"] = round(secs / (dist / 100)) if dist else None
        swolf = _weighted(sessions, "swolf")
        out["swolf"] = round(swolf, 1) if swolf else None
    elif sport == "ride":
        power = _weighted(sessions, "avg_power")
        out["power"] = round(power) if power else None
        out["speed_kmh"] = round((dist / 1000) / (secs / 3600), 1) if secs else None
    return out


def weekly(sessions: list[dict], start: date, end: date) -> list[dict[str, Any]]:
    monday = start - timedelta(days=start.weekday())
    weeks: dict[str, dict[str, Any]] = {}
    d = monday
    while d <= end:
        weeks[d.isoformat()] = {"week_start": d.isoformat(), "distance_km": 0.0, "duration_h": 0.0,
                                "sessions": 0, "key_sessions": 0, "load": 0.0}
        d += timedelta(days=7)
    for s in sessions:
        sd = date.fromisoformat(s["date"])
        w = weeks.get((sd - timedelta(days=sd.weekday())).isoformat())
        if not w:
            continue
        w["distance_km"] += (s.get("distance_m") or 0) / 1000
        w["duration_h"] += (s.get("duration_s") or 0) / 3600
        w["sessions"] += 1
        w["key_sessions"] += 1 if s["key"] else 0
        w["load"] += s.get("training_load") or 0
    for w in weeks.values():
        for k in ("distance_km", "duration_h", "load"):
            w[k] = round(w[k], 1)
    return list(weeks.values())


def trends(sport: str, sessions: list[dict]) -> list[dict[str, Any]]:
    """Per-session series for each progress metric, plus first-vs-last-4-weeks change."""
    out = []
    for key, (label, unit, direction) in TREND_METRICS[sport].items():
        points = [
            {"date": s["date"], "value": round(s["metrics"][key], 3), "name": s["name"], "key": s["key"], "id": s["id"]}
            for s in sessions if s["metrics"].get(key) is not None
        ]
        if len(points) < 2:
            continue
        # Compare like with like: base sessions when there are enough, since quality
        # sessions are faster/harder by design and their mix varies week to week.
        base = [p for p in points if not p["key"]]
        change = _change(base, "base") if len(base) >= 4 else None
        change = change or _change(points, "all")
        out.append({"key": key, "label": label, "unit": unit, "direction": direction,
                    "points": points, "change": change})
    return out


PACE_AT_HR_WINDOW = 10  # bpm either side of the reference heart rate
PACE_AT_HR_MIN_M = 3000


def pace_at_hr(history: list[dict], period: list[dict]) -> dict[str, Any] | None:
    """Easy-run pace scaled to one reference heart rate: the clearest aerobic-fitness trend.

    The reference is your typical easy-run heart rate (median of base runs, to the nearest
    5 bpm). Runs within ±10 bpm of it are scaled linearly (speed ∝ heart rate) to it.
    """
    def usable(a: dict) -> bool:
        return (not a["key"] and bool(a.get("avg_hr")) and bool(a["metrics"].get("pace"))
                and (a.get("distance_m") or 0) >= PACE_AT_HR_MIN_M)

    base = [a for a in history if usable(a)]
    if len(base) < 4:
        return None
    ref = int(round(median(a["avg_hr"] for a in base) / 5) * 5)
    points = [
        {"date": a["date"], "value": round(a["metrics"]["pace"] * a["avg_hr"] / ref, 3), "name": a["name"],
         "key": None, "id": a["id"]}
        for a in period if usable(a) and abs(a["avg_hr"] - ref) <= PACE_AT_HR_WINDOW
    ]
    if len(points) < 2:
        return None
    return {"key": "pace_at_hr", "label": f"Pace at {ref} bpm", "unit": "s/km", "direction": -1,
            "points": points, "change": _change(points, "base"), "ref_hr": ref}


def _in(rows: list[dict], start: date, end: date) -> list[dict]:
    return [r for r in rows if start.isoformat() <= r["date"] <= end.isoformat()]


def _steps_in(rows: list[dict], start: date, end: date) -> list[dict]:
    """Readings that change in steps (threshold, FTP): the one in effect at the start, then changes."""
    before = [r for r in rows if r["date"] < start.isoformat()]
    first = [{**before[-1], "date": start.isoformat()}] if before else []
    return first + _in(rows, start, end)


def _latest(rows: list[dict]) -> dict | None:
    return max(rows, key=lambda r: r["date"]) if rows else None


def run_extras(extras: dict[str, Any], start: date, end: date) -> dict[str, Any]:
    """Race predictions, lactate threshold and shoes for the running dashboard."""
    lt = sorted(extras.get("threshold") or [], key=lambda r: r["date"])
    # One reading per change: the daily snapshots repeat until Garmin updates the value.
    lt = [r for i, r in enumerate(lt) if i == 0 or (r["pace_s_km"], r["hr"]) != (lt[i - 1]["pace_s_km"], lt[i - 1]["hr"])]
    return {
        "predictions": _in(extras.get("predictions") or [], start, end),
        "threshold": {"latest": _latest(lt), "history": _steps_in(lt, start, end)},
        "shoes": extras.get("shoes") or [],
    }


def ride_extras(extras: dict[str, Any], start: date, end: date) -> dict[str, Any]:
    """FTP and watts per kilo (using the weigh-in nearest each FTP reading)."""
    weights = sorted(extras.get("weight") or [], key=lambda r: r["date"])
    ftp = sorted(extras.get("ftp") or [], key=lambda r: r["date"])
    ftp = [r for i, r in enumerate(ftp) if i == 0 or r["ftp"] != ftp[i - 1]["ftp"]]

    def kg_at(day: str) -> float | None:
        if not weights:
            return None
        return min(weights, key=lambda w: abs(date.fromisoformat(w["date"]) - date.fromisoformat(day)))["kg"]

    rows = [{"date": r["date"], "ftp": r["ftp"],
             "wkg": round(r["ftp"] / kg, 2) if (kg := kg_at(r["date"])) else None} for r in ftp]
    latest = _latest(rows)
    return {"ftp": {"latest": latest, "history": _steps_in(rows, start, end),
                    "weight_kg": _latest(weights)["kg"] if weights else None}}


CSS_WINDOW_DAYS = 56  # best 200 m and 400 m within this many days make one CSS estimate


def _css(efforts: list[dict]) -> dict[str, Any] | None:
    """Critical swim speed from the best 200 m and 400 m: pace per 100 m = (T400 − T200) / 2."""
    b200 = min((e for e in efforts if e.get("t200")), key=lambda e: e["t200"], default=None)
    b400 = min((e for e in efforts if e.get("t400")), key=lambda e: e["t400"], default=None)
    if not b200 or not b400 or not (b200["t200"] < b400["t400"] <= 3 * b200["t200"]):
        return None
    pace = (b400["t400"] - b200["t200"]) / 2
    return {"pace_s100": round(pace, 1),
            "t200": {"value": b200["t200"], "date": b200["date"], "name": b200["name"]},
            "t400": {"value": b400["t400"], "date": b400["date"], "name": b400["name"]}}


def swim_extras(efforts: list[dict], start: date, end: date) -> dict[str, Any]:
    """CSS for the range, plus how it moved: an estimate every 4 weeks from the 8 weeks before it."""
    in_range = [e for e in efforts if start.isoformat() <= e["date"] <= end.isoformat()]
    history = []
    d = end
    while d >= start:
        window = [e for e in efforts if (d - timedelta(days=CSS_WINDOW_DAYS)).isoformat() < e["date"] <= d.isoformat()]
        if est := _css(window):
            history.append({"date": d.isoformat(), "value": est["pace_s100"]})
        d -= timedelta(days=28)
    current = _css(in_range)
    return {"css": {**current, "history": history[::-1]} if current else None}


def _change(points: list[dict], group: str) -> dict[str, Any] | None:
    """Mean of the first 4 weeks vs the last 4 weeks of the range."""
    if len(points) < 2:
        return None
    first_end = (date.fromisoformat(points[0]["date"]) + timedelta(days=28)).isoformat()
    last_start = (date.fromisoformat(points[-1]["date"]) - timedelta(days=28)).isoformat()
    early = [p["value"] for p in points if p["date"] < first_end]
    late = [p["value"] for p in points if p["date"] > last_start]
    if not early or not late or first_end > last_start:
        return None
    a, b = fmean(early), fmean(late)
    return {"from": round(a, 2), "to": round(b, 2), "pct": round((b - a) / a * 100, 1) if a else None, "group": group}


def bests(sport: str, history: list[dict], period_start: str) -> list[dict[str, Any]]:
    """Personal bests across all synced history; `recent` marks ones set in the current range."""
    found: list[dict[str, Any]] = []

    def add(label: str, kind: str, candidates: list[tuple[float, dict]], lower_is_better: bool) -> None:
        if not candidates:
            return
        value, s = (min if lower_is_better else max)(candidates, key=lambda c: c[0])
        found.append({"label": label, "kind": kind, "value": round(value, 1), "date": s["date"],
                      "name": s["name"], "recent": s["date"] >= period_start})

    if sport == "run":
        for label, split in (("Fastest 1 km", "1k"), ("Fastest 5 km", "5k"), ("Fastest 10 km", "10k"),
                             ("Fastest half", "half")):
            add(label, "time", [(s["best_splits_s"][split], s) for s in history if (s.get("best_splits_s") or {}).get(split)], True)
        if not any(b["label"] == "Fastest 5 km" for b in found):
            add("Best pace (5 km+)", "pace_km",
                [(s["metrics"]["pace"], s) for s in history if s["metrics"].get("pace") and (s.get("distance_m") or 0) >= 5000], True)
        add("Longest run", "km", [((s.get("distance_m") or 0) / 1000, s) for s in history if s.get("distance_m")], False)
    elif sport == "ride":
        add("Best 20-min power", "watts", [(s["max_20min_power"], s) for s in history if s.get("max_20min_power")], False)
        add("Best average power (45 min+)", "watts",
            [(s["avg_power"], s) for s in history if s.get("avg_power") and (_moving(s) or 0) >= 2700], False)
        add("Longest ride", "km", [((s.get("distance_m") or 0) / 1000, s) for s in history if s.get("distance_m")], False)
        add("Most climbing", "m", [(s["elevation_gain_m"], s) for s in history if s.get("elevation_gain_m")], False)
    elif sport == "swim":
        add("Fastest pace (400 m+)", "pace_100",
            [(s["metrics"]["pace"], s) for s in history if s["metrics"].get("pace") and (s.get("distance_m") or 0) >= 400], True)
        add("Best SWOLF", "number", [(s["swolf"], s) for s in history if s.get("swolf")], True)
        add("Longest swim", "m", [(s.get("distance_m") or 0, s) for s in history if s.get("distance_m")], False)
    return found


def zones(sessions: list[dict], field: str = "hr_zones_s") -> list[float] | None:
    with_zones = [s[field] for s in sessions if s.get(field)]
    if not with_zones:
        return None
    return [round(sum(z[i] for z in with_zones)) for i in range(5)]


def sport_view(
    sport: str,
    all_activities: list[dict],
    vo2_history: list[dict],
    start: date,
    end: date,
    key_keywords: list[str] | None = None,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    history = sorted((a for a in all_activities if a["sport"] == sport), key=lambda a: a["start"])
    for a in history:
        a["metrics"] = derived(a)
        a["key"] = activity_key(a, key_keywords)
    period = [a for a in history if start.isoformat() <= a["date"] <= end.isoformat()]
    span = (end - start).days + 1
    prev_start, prev_end = start - timedelta(days=span), start - timedelta(days=1)
    previous = [a for a in history if prev_start.isoformat() <= a["date"] <= prev_end.isoformat()]

    trend_list = trends(sport, period)
    if sport == "run" and (p := pace_at_hr(history, period)):
        trend_list.append(p)
    out: dict[str, Any] = {
        "sport": sport,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "summary": summarize(sport, period),
        "previous": summarize(sport, previous),
        "weekly": weekly(period, start, end),
        "trends": trend_list,
        "bests": bests(sport, history, start.isoformat()),
        "zones_s": zones(period),
        "vo2max": [v for v in vo2_history if start.isoformat() <= v["date"] <= end.isoformat()],
        "sessions": list(reversed(period)),
        "history_start": history[0]["date"] if history else None,
    }
    if sport == "run":
        out |= run_extras(extras or {}, start, end)
    elif sport == "ride":
        out["power_zones_s"] = zones(period, "power_zones_s")
        out |= ride_extras(extras or {}, start, end)
    elif sport == "swim":
        out |= swim_extras((extras or {}).get("swim_efforts") or [], start, end)
    return out

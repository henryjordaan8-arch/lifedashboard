"""Training readiness: a 0-100 score built from your own baselines.

Every recovery input is compared with *your* last 28 days (a z-score), so
"good" means good for you, not for an average person. Training load, recent
hard sessions and the VO2 max trend are folded in, then a few safety caps
stop one great metric from hiding a clearly bad one.

This is version 1 — the weights and thresholds below are meant to be tuned.
"""

from __future__ import annotations

import statistics
from datetime import date, timedelta
from typing import Any, Callable

BASELINE_DAYS = 28
MIN_BASELINE_POINTS = 7
HISTORY_DAYS = 14

# key, label, unit, direction (+1 = higher is better, -1 = lower is better)
INPUTS: list[tuple[str, str, str, int]] = [
    ("hrv", "Overnight HRV", "ms", +1),
    ("resting_hr", "Resting heart rate", "bpm", -1),
    ("sleep_score", "Sleep score", "", +1),
    ("sleep_hours", "Sleep duration", "h", +1),
    ("body_battery", "Body Battery at wake", "", +1),
    ("sleep_stress", "Overnight stress", "", -1),
]


# ---- score configuration (v1) -------------------------------------------------
SCORE_VERSION = 1
WEIGHTS = {
    # recovery (80)
    "hrv": 25,
    "resting_hr": 15,
    "sleep_score": 15,
    "sleep_hours": 10,
    "body_battery": 10,
    "sleep_stress": 5,
    # training (20)
    "load": 10,      # acute:chronic load ratio
    "recent": 5,     # days since the last hard session
    "fitness": 5,    # VO2 max trend
}
COMPONENT_LABELS = {
    "load": "Training load (7d vs 28d)",
    "recent": "Days since hard session",
    "fitness": "VO₂ max trend",
}
BANDS = [  # (min score, key, label)
    (75, "high", "Ready for a hard session"),
    (55, "good", "Train as planned"),
    (35, "low", "Take it easier today"),
    (0, "rest", "Prioritise recovery"),
]


def _clip(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _lerp(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def load_points(ratio: float | None) -> float | None:
    """Acute:chronic ratio -> 0-100. Sweet spot 0.8-1.3; spikes cost points."""
    if ratio is None:
        return None
    if ratio < 0.8:
        return 75.0  # fresh, just not building
    if ratio <= 1.3:
        return 85.0
    if ratio <= 1.5:
        return _lerp(ratio, 1.3, 1.5, 85, 50)
    return _clip(_lerp(ratio, 1.5, 2.0, 50, 10))


def recent_points(days_since_hard: int | None) -> float:
    if days_since_hard is None or days_since_hard >= 3:
        return 85.0
    return {0: 30.0, 1: 35.0, 2: 60.0}[days_since_hard]


def fitness_points(change_28d: float | None) -> float | None:
    return None if change_28d is None else _clip(50 + 25 * change_28d)


def score(inputs: list[dict], load: dict, recent: dict, fitness_info: dict | None) -> dict[str, Any] | None:
    """Combine everything into one 0-100 number, with a breakdown of how it was made."""
    comps: list[dict[str, Any]] = []
    for i in inputs:
        if i["effect"] is not None:
            # +2.5 sigma better than usual -> 100, usual -> 50, 2.5 sigma worse -> 0
            comps.append({"key": i["key"], "label": i["label"], "points": _clip(50 + 20 * i["effect"])})
    for key, pts in (
        ("load", load_points(load.get("ratio"))),
        ("recent", recent_points(recent.get("days_since_hard"))),
        ("fitness", fitness_points(fitness_info["change_28d"] if fitness_info else None)),
    ):
        if pts is not None:
            comps.append({"key": key, "label": COMPONENT_LABELS[key], "points": pts})

    recovery = [c for c in comps if c["key"] in ("hrv", "resting_hr", "sleep_score", "sleep_hours")]
    if len(recovery) < 2:
        return None  # not enough baseline yet to say anything useful

    total_w = sum(WEIGHTS[c["key"]] for c in comps)
    for c in comps:
        c["weight"] = round(WEIGHTS[c["key"]] / total_w * 100, 1)  # re-normalised if inputs are missing
        c["points"] = round(c["points"])
        c["contribution"] = round(c["points"] * WEIGHTS[c["key"]] / total_w, 1)
    value = sum(c["contribution"] for c in comps)

    # Safety caps: a clearly bad signal shouldn't be averaged away.
    caps = []
    by_key = {i["key"]: i for i in inputs}
    hrv = by_key.get("hrv", {})
    if hrv.get("effect") is not None and hrv["effect"] <= -1.5:
        caps.append({"reason": "HRV well below your normal", "max": 50})
    hours = by_key.get("sleep_hours", {}).get("today")
    if hours is not None and hours < 5:
        caps.append({"reason": "Under 5 h of sleep", "max": 55})
    for c in caps:
        value = min(value, c["max"])

    value = round(value)
    band = next(b for b in BANDS if value >= b[0])
    return {
        "value": value,
        "band": band[1],
        "label": band[2],
        "components": sorted(comps, key=lambda c: -c["weight"]),
        "caps": caps,
        "version": SCORE_VERSION,
    }


def _pick(*values: Any) -> float | None:
    for v in values:
        if v is not None:
            return float(v)
    return None


def daily_values(
    day: str, sleep: dict | None, hrv: dict | None, stats: dict | None
) -> dict[str, float | None]:
    sleep, hrv, stats = sleep or {}, hrv or {}, stats or {}
    duration = sleep.get("duration_s")
    return {
        "hrv": _pick(hrv.get("last_night"), sleep.get("avg_hrv")),
        "resting_hr": _pick(stats.get("resting_hr"), sleep.get("resting_hr")),
        "sleep_score": _pick(sleep.get("score")),
        "sleep_hours": round(duration / 3600, 2) if duration else None,
        "body_battery": _pick(stats.get("body_battery_wake"), stats.get("body_battery_high")),
        "sleep_stress": _pick(sleep.get("stress")),
    }


HARD_SESSION = {"load": 150, "aerobic_te": 4.0, "anaerobic_te": 3.0}


def is_hard(a: dict) -> bool:
    return (
        (a.get("training_load") or 0) >= HARD_SESSION["load"]
        or (a.get("aerobic_te") or 0) >= HARD_SESSION["aerobic_te"]
        or (a.get("anaerobic_te") or 0) >= HARD_SESSION["anaerobic_te"]
    )


def training_load(activities: list[dict], today: date) -> dict[str, Any]:
    """Acute (7d) vs chronic (28d) average daily load, from Garmin's per-activity load."""
    per_day: dict[str, float] = {}
    for a in activities:
        if a.get("training_load"):
            per_day[a["date"]] = per_day.get(a["date"], 0.0) + a["training_load"]

    def avg(days: int) -> float:
        # Up to and including yesterday: today's training hasn't affected this morning.
        total = sum(per_day.get((today - timedelta(days=i)).isoformat(), 0.0) for i in range(1, days + 1))
        return total / days

    acute, chronic = avg(7), avg(28)
    return {
        "acute": round(acute, 1),
        "chronic": round(chronic, 1),
        "ratio": round(acute / chronic, 2) if chronic > 0 else None,
        "yesterday": round(per_day.get((today - timedelta(days=1)).isoformat(), 0.0), 1),
    }


def recent_sessions(activities: list[dict], today: date) -> dict[str, Any]:
    """What the last days of training looked like."""
    before = [a for a in activities if a["date"] < today.isoformat()]
    before.sort(key=lambda a: a["start"], reverse=True)
    week_ago = (today - timedelta(days=7)).isoformat()
    last7 = [a for a in before if a["date"] >= week_ago]

    hard = next((a for a in before if is_hard(a)), None)
    days_since_hard = (today - date.fromisoformat(hard["date"])).days if hard else None

    return {
        "sessions_7d": len(last7),
        "hard_7d": sum(1 for a in last7 if is_hard(a)),
        "days_since_hard": days_since_hard,
        "last": [
            {k: a.get(k) for k in ("id", "name", "sport", "date", "duration_s", "distance_m",
                                   "training_load", "aerobic_te", "anaerobic_te")}
            | {"hard": is_hard(a)}
            for a in before[:5]
        ],
    }


def fitness(vo2_by_day: dict[str, dict], today: date) -> dict[str, Any] | None:
    """Latest VO2 max and its change over ~4 weeks (a slow-moving fitness signal)."""
    days = sorted(d for d, v in vo2_by_day.items() if v and v.get("run") is not None)
    if not days:
        return None
    latest = vo2_by_day[days[-1]]
    cutoff = (today - timedelta(days=28)).isoformat()
    older = [d for d in days if d <= cutoff]
    ref = vo2_by_day[older[-1]] if older else vo2_by_day[days[0]]
    return {
        "vo2max_run": latest["run"],
        "vo2max_ride": latest.get("ride"),
        "as_of": days[-1],
        "change_28d": round(latest["run"] - ref["run"], 1),
        "history": [{"date": d, "value": vo2_by_day[d]["run"]} for d in days[-60:]],
    }


def build(
    today: date,
    get_day: Callable[[str], dict[str, float | None]],
    activities: list[dict],
    garmin_readiness: dict | None,
    vo2_by_day: dict[str, dict] | None = None,
) -> dict[str, Any]:
    days = [(today - timedelta(days=i)).isoformat() for i in range(BASELINE_DAYS, -1, -1)]
    values_by_day = {d: get_day(d) for d in days}
    today_iso = today.isoformat()

    inputs = []
    for key, label, unit, direction in INPUTS:
        series = [values_by_day[d][key] for d in days]
        current = series[-1]
        base = [v for v in series[:-1] if v is not None]
        mean = sd = z = None
        if len(base) >= MIN_BASELINE_POINTS:
            mean = statistics.fmean(base)
            sd = statistics.stdev(base)
            if current is not None and sd > 0:
                z = (current - mean) / sd
        inputs.append(
            {
                "key": key,
                "label": label,
                "unit": unit,
                "direction": direction,
                "today": current,
                "baseline_mean": None if mean is None else round(mean, 1),
                "baseline_sd": None if sd is None else round(sd, 2),
                "z": None if z is None else round(z, 2),
                # z flipped so that positive always means "better than usual"
                "effect": None if z is None else round(max(-3.0, min(3.0, z * direction)), 2),
                "history": [
                    {"date": d, "value": values_by_day[d][key]} for d in days[-HISTORY_DAYS:]
                ],
            }
        )

    load = training_load(activities, today)
    recent = recent_sessions(activities, today)
    fit = fitness(vo2_by_day or {}, today)
    return {
        "date": today_iso,
        "score": score(inputs, load, recent, fit),
        "inputs": inputs,
        "load": load,
        "recent": recent,
        "fitness": fit,
        "garmin": garmin_readiness,
        "baseline_days": BASELINE_DAYS,
    }

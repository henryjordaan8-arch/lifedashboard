"""Inputs for the training readiness metric.

The composite score itself is deliberately NOT defined yet — we'll design it
together. For now this computes each candidate ingredient and how today's value
compares with your own recent baseline, which is what any sensible score will
be built from.
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
    """What the last days of training looked like — intensity, rehab, and running ramp."""
    before = [a for a in activities if a["date"] < today.isoformat()]
    before.sort(key=lambda a: a["start"], reverse=True)
    week_ago = (today - timedelta(days=7)).isoformat()
    last7 = [a for a in before if a["date"] >= week_ago]

    hard = next((a for a in before if is_hard(a)), None)
    days_since_hard = (today - date.fromisoformat(hard["date"])).days if hard else None

    # Running ramp: last 7 days vs the average week of the 4 weeks before that.
    # The classic return-from-injury guardrail is roughly +10 % per week.
    run_km = lambda xs: sum((a.get("distance_m") or 0) for a in xs if a["sport"] == "run") / 1000  # noqa: E731
    prior_start = (today - timedelta(days=35)).isoformat()
    prior = [a for a in before if prior_start <= a["date"] < week_ago]
    run_7d, run_prior_week = run_km(last7), run_km(prior) / 4
    return {
        "sessions_7d": len(last7),
        "hard_7d": sum(1 for a in last7 if is_hard(a)),
        "rehab_7d": sum(1 for a in last7 if a["sport"] == "rehab"),
        "days_since_hard": days_since_hard,
        "run_km_7d": round(run_7d, 1),
        "run_km_prior_week_avg": round(run_prior_week, 1),
        "run_ramp_pct": round((run_7d / run_prior_week - 1) * 100) if run_prior_week > 0 else None,
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

    return {
        "date": today_iso,
        "score": None,  # composite formula still to be designed
        "inputs": inputs,
        "load": training_load(activities, today),
        "recent": recent_sessions(activities, today),
        "fitness": fitness(vo2_by_day or {}, today),
        "garmin": garmin_readiness,
        "baseline_days": BASELINE_DAYS,
    }

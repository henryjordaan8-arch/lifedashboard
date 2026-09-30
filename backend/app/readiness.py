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


def build(
    today: date,
    get_day: Callable[[str], dict[str, float | None]],
    activities: list[dict],
    garmin_readiness: dict | None,
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
        "garmin": garmin_readiness,
        "baseline_days": BASELINE_DAYS,
    }

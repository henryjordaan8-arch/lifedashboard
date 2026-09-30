"""Turn raw Garmin Connect JSON into the small, stable shapes the UI uses.

Garmin's payloads are large, undocumented and occasionally change, so every
field is read defensively: a missing value becomes None, never an exception.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

SPORTS = ("run", "ride", "swim", "strength", "other")

_SPORT_BY_TYPE_KEY = [
    ("run", ("running", "track_", "treadmill", "trail_run", "ultra_run")),
    ("ride", ("cycling", "biking", "ride", "bike", "spinning")),
    ("swim", ("swim",)),
    ("strength", ("strength", "hiit", "weight", "crossfit")),
]

_SPORT_BY_TITLE = [
    ("run", r"\b(run|runs|running|jog|tempo|intervals?|parkrun|fartlek|strides|long run|easy run)\b"),
    ("ride", r"\b(ride|bike|cycl\w*|zwift|spin|trainer|turbo)\b"),
    ("swim", r"\b(swim\w*|pool|open water)\b"),
    ("strength", r"\b(strength|gym|weights?|lift\w*|core|mobility|s&c)\b"),
]


def sport_from_type_key(type_key: str | None) -> str:
    key = (type_key or "").lower()
    for sport, needles in _SPORT_BY_TYPE_KEY:
        if any(n in key for n in needles):
            return sport
    return "other"


def sport_from_title(title: str | None) -> str:
    text = (title or "").lower()
    for sport, pattern in _SPORT_BY_TITLE:
        if re.search(pattern, text):
            return sport
    return "other"


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value: Any) -> int | None:
    n = _num(value)
    return None if n is None else int(round(n))


def _local_ms_to_iso(ms: Any) -> str | None:
    """Garmin's *Local timestamps are epoch-ms already shifted to local wall time."""
    n = _num(ms)
    if n is None:
        return None
    return datetime.fromtimestamp(n / 1000, tz=timezone.utc).replace(tzinfo=None).isoformat(
        timespec="minutes"
    )


def sleep(day: str, raw: dict[str, Any] | None) -> dict[str, Any] | None:
    """Normalize get_sleep_data(). Returns None when no sleep was recorded."""
    if not raw:
        return None
    dto = raw.get("dailySleepDTO") or {}
    duration = _int(dto.get("sleepTimeSeconds"))
    if not duration:
        return None
    scores = dto.get("sleepScores") or {}
    overall = scores.get("overall") or {}
    return {
        "date": day,
        "start": _local_ms_to_iso(dto.get("sleepStartTimestampLocal")),
        "end": _local_ms_to_iso(dto.get("sleepEndTimestampLocal")),
        "duration_s": duration,
        "deep_s": _int(dto.get("deepSleepSeconds")) or 0,
        "light_s": _int(dto.get("lightSleepSeconds")) or 0,
        "rem_s": _int(dto.get("remSleepSeconds")) or 0,
        "awake_s": _int(dto.get("awakeSleepSeconds")) or 0,
        "score": _int(overall.get("value")),
        "score_label": overall.get("qualifierKey"),
        "avg_hrv": _num(raw.get("avgOvernightHrv")),
        "resting_hr": _int(raw.get("restingHeartRate")),
        "spo2": _num(dto.get("averageSpO2Value")),
        "respiration": _num(dto.get("averageRespirationValue")),
        "stress": _num(dto.get("avgSleepStress")),
        "body_battery_change": _int(raw.get("bodyBatteryChange")),
    }


def hrv(day: str, raw: dict[str, Any] | None) -> dict[str, Any] | None:
    """Normalize get_hrv_data()."""
    if not raw:
        return None
    s = raw.get("hrvSummary") or {}
    if s.get("lastNightAvg") is None:
        return None
    base = s.get("baseline") or {}
    return {
        "date": day,
        "last_night": _num(s.get("lastNightAvg")),
        "weekly_avg": _num(s.get("weeklyAvg")),
        "status": s.get("status"),
        "baseline_low": _num(base.get("balancedLow")),
        "baseline_high": _num(base.get("balancedUpper")),
    }


def stats(day: str, raw: dict[str, Any] | None) -> dict[str, Any] | None:
    """Normalize get_stats() (daily summary)."""
    if not raw:
        return None
    return {
        "date": day,
        "resting_hr": _int(raw.get("restingHeartRate")),
        "body_battery_high": _int(raw.get("bodyBatteryHighestValue")),
        "body_battery_low": _int(raw.get("bodyBatteryLowestValue")),
        "body_battery_wake": _int(raw.get("bodyBatteryAtWakeTime")),
        "avg_stress": _int(raw.get("averageStressLevel")),
        "steps": _int(raw.get("totalSteps")),
    }


def readiness(day: str, raw: Any) -> dict[str, Any] | None:
    """Normalize get_training_readiness() — Garmin's own score, kept for comparison."""
    entries = raw if isinstance(raw, list) else [raw] if isinstance(raw, dict) else []
    entries = [e for e in entries if isinstance(e, dict) and e.get("score") is not None]
    if not entries:
        return None
    # Several entries per day are possible (after sleep, after activities); the
    # morning one reflects recovery best, so take the earliest.
    first = min(entries, key=lambda e: str(e.get("timestamp") or e.get("timestampLocal") or ""))
    return {
        "date": day,
        "score": _int(first.get("score")),
        "level": first.get("level"),
        "feedback": first.get("feedbackShort"),
    }


def activity(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize one item from get_activities_by_date()."""
    aid = raw.get("activityId")
    start = raw.get("startTimeLocal")
    if aid is None or not start:
        return None
    type_key = (raw.get("activityType") or {}).get("typeKey")
    return {
        "id": int(aid),
        "name": raw.get("activityName") or "Activity",
        "sport": sport_from_type_key(type_key),
        "type_key": type_key,
        "date": str(start)[:10],
        "start": str(start).replace(" ", "T")[:16],
        "duration_s": _int(raw.get("duration")),
        "distance_m": _num(raw.get("distance")),
        "avg_hr": _int(raw.get("averageHR")),
        "max_hr": _int(raw.get("maxHR")),
        "calories": _int(raw.get("calories")),
        "elevation_gain_m": _num(raw.get("elevationGain")),
        "training_load": _num(raw.get("activityTrainingLoad")),
        "aerobic_te": _num(raw.get("aerobicTrainingEffect")),
        "anaerobic_te": _num(raw.get("anaerobicTrainingEffect")),
    }


def vo2max(day: str, raw: Any) -> dict[str, Any] | None:
    """Normalize get_max_metrics(): running ("generic") and cycling VO2 max."""
    entry = raw[0] if isinstance(raw, list) and raw else raw if isinstance(raw, dict) else None
    if not entry:
        return None

    def value(block: Any) -> float | None:
        if not isinstance(block, dict):
            return None
        return _num(block.get("vo2MaxPreciseValue")) or _num(block.get("vo2MaxValue"))

    run, ride = value(entry.get("generic")), value(entry.get("cycling"))
    if run is None and ride is None:
        return None
    return {"date": day, "run": run, "ride": ride}

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
    ("ride", r"\b(ride|bike|cycl\w*|zwift|spin|trainer|turbo|ftp|sweet\s?spot|over[\s-]?unders?)\b"),
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
        "respiration_low": _num(dto.get("lowestRespirationValue")),
        "respiration_high": _num(dto.get("highestRespirationValue")),
        # Newer watches: overnight skin temperature vs your own baseline (°C).
        "skin_temp_dev": _num(
            dto.get("avgSkinTempDeviationC")
            if dto.get("avgSkinTempDeviationC") is not None
            else raw.get("avgSkinTempDeviationC")
        ),
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
    recovery_min = _num(first.get("recoveryTime"))  # Garmin reports minutes
    return {
        "date": day,
        "score": _int(first.get("score")),
        "level": first.get("level"),
        "feedback": first.get("feedbackShort"),
        "recovery_time_h": None if recovery_min is None else round(recovery_min / 60, 1),
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
        # --- sport detail (all optional; depends on sport, device and sensors) ---
        "moving_s": _int(raw.get("movingDuration")),
        "avg_speed_ms": _num(raw.get("averageSpeed")),
        "max_speed_ms": _num(raw.get("maxSpeed")),
        "cadence": _num(
            raw.get("averageRunningCadenceInStepsPerMinute")
            or raw.get("averageBikingCadenceInRevPerMinute")
            or raw.get("averageSwimCadenceInStrokesPerMinute")
        ),
        "stride_m": (_num(raw.get("avgStrideLength")) or 0) / 100 or None,  # Garmin reports cm
        "avg_power": _num(raw.get("avgPower")),
        "norm_power": _num(raw.get("normPower")),
        "max_20min_power": _num(raw.get("max20MinPower")),
        "tss": _num(raw.get("trainingStressScore")),
        "intensity_factor": _num(raw.get("intensityFactor")),
        "swolf": _num(raw.get("averageSwolf")),
        "pool_length_m": _num(raw.get("poolLength")),
        "strokes": _int(raw.get("strokes")),
        "hr_zones_s": _zones(raw),
        "power_zones_s": _power_zones(raw),
        "best_splits_s": {
            label: _num(raw.get(f"fastestSplit_{meters}"))
            for label, meters in (("1k", 1000), ("mile", 1609), ("5k", 5000), ("10k", 10000), ("half", 21098))
            if _num(raw.get(f"fastestSplit_{meters}"))
        },
    }


def _zones(raw: dict[str, Any]) -> list[float] | None:
    zones = [_num(raw.get(f"hrTimeInZone_{i}")) for i in range(1, 6)]
    return None if all(z is None for z in zones) else [z or 0.0 for z in zones]


def _power_zones(raw: dict[str, Any]) -> list[float] | None:
    """Garmin's 7 power zones folded into 5 bands like the HR zones: Z1, Z2, Z3, Z4, Z5–7."""
    zones = [_num(raw.get(f"powerTimeInZone_{i}")) for i in range(1, 8)]
    if all(z is None for z in zones):
        return None
    z = [v or 0.0 for v in zones]
    return [z[0], z[1], z[2], z[3], z[4] + z[5] + z[6]]


def _rows(raw: Any) -> list[dict[str, Any]]:
    """Garmin returns a dict, a list, or a dict wrapping a list; always give a list of dicts."""
    if isinstance(raw, dict):
        for key in ("entries", "values", "data", "dateWeightList"):
            if isinstance(raw.get(key), list):
                return [r for r in raw[key] if isinstance(r, dict)]
        return [raw]
    return [r for r in raw if isinstance(r, dict)] if isinstance(raw, list) else []


def _date_of(row: dict[str, Any]) -> str | None:
    for key in ("calendarDate", "date", "from", "updatedDate"):
        v = row.get(key)
        if isinstance(v, str) and len(v) >= 10:
            return v[:10]
    return None


def race_predictions(raw: Any) -> list[dict[str, Any]]:
    """Garmin race predictor: predicted 5K / 10K / half / marathon times (seconds), per day."""
    out = []
    for r in _rows(raw):
        times = {k: _num(r.get(f)) for k, f in (("5k", "time5K"), ("10k", "time10K"),
                                                 ("half", "timeHalfMarathon"), ("marathon", "timeMarathon"))}
        d = _date_of(r)
        if d and any(times.values()):
            out.append({"date": d, **times})
    return sorted(out, key=lambda x: x["date"])


def lactate_threshold(day: str, raw: Any) -> dict[str, Any] | None:
    """Garmin's latest running lactate threshold: pace (s/km) and heart rate."""
    speed = hr = None
    when = None
    for r in _rows(raw):
        speed = speed or _num(r.get("speed"))
        hr = hr or _num(r.get("heartRate") or r.get("hearRate"))
        when = when or _date_of(r)
    if not speed and not hr:
        return None
    # Garmin stores this speed in tens of m/s (0.32 = 3.2 m/s); real paces are > 1.5 m/s.
    if speed and speed < 1.5:
        speed *= 10
    return {"date": when or day, "pace_s_km": round(1000 / speed) if speed else None, "hr": _int(hr)}


def cycling_ftp(day: str, raw: Any) -> dict[str, Any] | None:
    """Garmin's latest cycling FTP (watts)."""
    for r in _rows(raw):
        ftp = _num(r.get("functionalThresholdPower") or r.get("value"))
        if ftp:
            return {"date": _date_of(r) or day, "ftp": round(ftp)}
    return None


def weights(raw: Any) -> list[dict[str, Any]]:
    """Weigh-ins (Garmin stores grams) as kg per day; the last reading of a day wins."""
    by_day: dict[str, float] = {}
    for r in _rows(raw):
        g, d = _num(r.get("weight")), _date_of(r)
        if g and d:
            by_day[d] = round(g / 1000 if g > 1000 else g, 1)
    return [{"date": d, "kg": kg} for d, kg in sorted(by_day.items())]


DEFAULT_SHOE_KM = 700  # typical replacement mileage when no maximum is set in Garmin


def shoes(gear: Any, stats: dict[str, Any]) -> list[dict[str, Any]]:
    """Running shoes from Garmin gear, with the distance logged on each (stats keyed by uuid)."""
    out = []
    for g in _rows(gear):
        if "shoe" not in str(g.get("gearTypeName", "")).lower():
            continue
        uuid = g.get("uuid")
        st = stats.get(uuid) or {}
        km = (_num(st.get("totalDistance")) or 0) / 1000
        max_m = _num(g.get("maximumMeters"))
        name = (g.get("displayName") or g.get("customMakeModel")
                or " ".join(x for x in (g.get("gearMakeName"), g.get("gearModelName")) if x) or "Shoes")
        out.append({
            "id": uuid, "name": name, "km": round(km, 1),
            "max_km": round(max_m / 1000) if max_m else DEFAULT_SHOE_KM,
            "max_set": bool(max_m),
            "activities": _int(st.get("totalActivities")),
            "since": str(g.get("dateBegin") or "")[:10] or None,
            "retired": str(g.get("gearStatusName", "active")).lower() != "active",
        })
    return sorted(out, key=lambda s: (s["retired"], -s["km"]))


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


# Pool intervals that count as a 200 m / 400 m effort (longer ones are scaled down to it).
SWIM_EFFORTS = {"t200": (200, 300), "t400": (400, 600)}


def swim_efforts(raw: Any) -> dict[str, float | None]:
    """Fastest 200 m and 400 m from a swim's intervals (Garmin laps between rests), in seconds."""
    laps = (raw or {}).get("lapDTOs") if isinstance(raw, dict) else None
    out: dict[str, float | None] = {k: None for k in SWIM_EFFORTS}
    for lap in laps or []:
        dist = _num(lap.get("distance"))
        secs = _num(lap.get("movingDuration")) or _num(lap.get("duration"))
        if not dist or not secs:
            continue
        for key, (lo, hi) in SWIM_EFFORTS.items():
            if lo <= dist <= hi:
                t = round(secs * lo / dist, 1)
                out[key] = t if out[key] is None else min(out[key], t)
    return out


def decoupling(raw: Any, sport: str) -> float | None:
    """Aerobic decoupling (%) from an activity's lap splits.

    Efficiency = output per heartbeat (speed, or power for rides with a power meter),
    compared between the first and second half of the session by time. Positive means
    the heart rate drifted up relative to output (Pa:HR / Pw:HR decoupling).
    """
    laps = (raw or {}).get("lapDTOs") if isinstance(raw, dict) else None
    laps = [l for l in laps or [] if _num(l.get("duration")) and _num(l.get("averageHR"))]
    if len(laps) < 2:
        return None
    use_power = sport == "ride" and all(_num(l.get("averagePower")) for l in laps)
    out_key = "averagePower" if use_power else "averageSpeed"
    if not all(_num(l.get(out_key)) for l in laps):
        return None
    total = sum(_num(l["duration"]) for l in laps)
    halves: list[list[dict]] = [[], []]
    t = 0.0
    for lap in laps:
        d = _num(lap["duration"])
        halves[0 if t + d / 2 < total / 2 else 1].append(lap)
        t += d
    if not halves[0] or not halves[1]:
        return None

    def efficiency(group: list[dict]) -> float:
        w = sum(_num(l["duration"]) for l in group)
        out = sum(_num(l[out_key]) * _num(l["duration"]) for l in group) / w
        hr = sum(_num(l["averageHR"]) * _num(l["duration"]) for l in group) / w
        return out / hr

    first, second = efficiency(halves[0]), efficiency(halves[1])
    return round((first - second) / first * 100, 1)

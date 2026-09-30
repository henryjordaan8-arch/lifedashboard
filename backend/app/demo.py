"""Realistic sample data in Garmin's raw payload shapes.

Used with DEMO_MODE=true so the dashboard can be explored (and developed)
without a Garmin account. Writing raw payloads — not normalized ones — means
demo mode exercises exactly the same code paths as real data.
"""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta, timezone
from typing import Any

from .store import Store

# Weekly pattern: gym Mon-Fri, 2 runs, 2 rides, 1 swim; two quality (key) sessions.
# weekday -> [(typeKey, title, (h, m), minutes, km, load)]
_WEEK_PLAN: list[list[tuple]] = [
    [("strength_training", "Gym: upper body", (6, 30), 55, None, 35)],
    [("strength_training", "Gym: lower body", (6, 30), 55, None, 40),
     ("running", "VO2 max run 5×3min", (18, 0), 50, 9.0, 130)],
    [("strength_training", "Gym: push", (6, 30), 50, None, 35),
     ("virtual_ride", "Zwift: sweet spot 3×12min", (18, 0), 70, 34.0, 110)],
    [("strength_training", "Gym: pull", (6, 30), 50, None, 35),
     ("lap_swimming", "Swim — technique", (18, 0), 45, 2.2, 45)],
    [("strength_training", "Gym: legs & core", (6, 30), 55, None, 40)],
    [("running", "Long run 14 km", (8, 0), 80, 14.0, 110)],
    [("road_biking", "Endurance ride Z2", (8, 30), 120, 55.0, 100)],
]

_WORK = [  # weekday (Mon-Fri) -> [(title, (h, m), minutes)]
    [("Team stand-up", (9, 0), 30), ("Deep work: project", (9, 30), 150), ("Work — client meeting", (14, 0), 60), ("Deep work: reporting", (15, 0), 120)],
    [("Team stand-up", (9, 0), 30), ("Deep work: project", (9, 30), 180), ("Work — admin", (14, 0), 180)],
    [("Team stand-up", (9, 0), 30), ("Deep work: analysis", (9, 30), 150), ("1:1 with manager", (13, 30), 30), ("Deep work: project", (14, 0), 180)],
    [("Team stand-up", (9, 0), 30), ("Deep work: project", (9, 30), 180), ("Work — planning meeting", (14, 0), 90)],
    [("Team stand-up", (9, 0), 30), ("Deep work: project", (9, 30), 150), ("Work — weekly review", (13, 30), 60)],
]
_READING = {  # weekday -> [(title, (h, m), minutes)]
    0: [("Reading — novel", (21, 30), 40)], 1: [("Reading — novel", (21, 30), 40)],
    2: [("Reading — non-fiction", (20, 30), 60)], 3: [("Reading — novel", (22, 0), 30)],
    4: [("Reading — novel", (21, 30), 45)], 5: [("Reading in the park", (15, 0), 90)],
    6: [("Reading — non-fiction", (20, 0), 60)],
}
_PERSONAL = {
    0: [("Lunch", (12, 30), 60)], 1: [("Lunch", (12, 30), 60)], 2: [("Lunch", (12, 30), 60)],
    3: [("Lunch", (12, 30), 60)], 4: [("Lunch", (12, 30), 60), ("Dinner with friends", (19, 0), 150)],
    5: [("Groceries & errands", (12, 30), 90)], 6: [("Family lunch", (12, 30), 120)],
}
_STUDY = {  # weekday -> [(title, (h, m), minutes)]
    0: [("Study — statistics module", (19, 30), 90)],
    1: [("Lecture: research methods", (19, 30), 90)],
    3: [("Study — statistics module", (19, 30), 120)],
    5: [("Study — assignment 2", (10, 30), 120)],
    6: [("Revision — weekly notes", (15, 0), 60)],
}

def _local_ms(dt: datetime) -> int:
    return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def _detail(type_key: str, name: str, minutes: float, fit: float, rng: random.Random) -> dict[str, Any]:
    """Sport-specific Garmin summary fields; `fit` goes 0 -> 1 as fitness builds over the demo year."""
    quality = any(w in name.lower() for w in ("vo2", "tempo", "sweet spot", "interval"))
    secs = minutes * 60
    if type_key == "running":
        pace = (360 - 35 * fit) - (45 if quality else 0) + rng.gauss(0, 6)  # s/km
        dist = secs / pace * 1000
        cadence = 164 + 8 * fit + (4 if quality else 0) + rng.gauss(0, 1.5)
        hr = (165 if quality else 149 - 6 * fit) + rng.gauss(0, 2.5)
        zones = [0.08, 0.25, 0.27, 0.3, 0.1] if quality else [0.1, 0.62, 0.23, 0.05, 0.0]
        splits = {"fastestSplit_1000": pace * (0.86 if quality else 0.95)}
        if dist >= 5000:
            splits["fastestSplit_5000"] = pace * 5 * (0.97 if quality else 0.99)
        if dist >= 10000:
            splits["fastestSplit_10000"] = pace * 10 * 0.995
        return {
            "distance": dist, "movingDuration": secs * 0.98, "averageSpeed": dist / secs,
            "averageHR": int(hr), "maxHR": int(hr + rng.uniform(12, 20)),
            "averageRunningCadenceInStepsPerMinute": round(cadence, 1),
            "avgStrideLength": round((dist / secs) / (cadence / 60) * 100, 1),
            "elevationGain": rng.uniform(30, 160),
            **{f"hrTimeInZone_{i + 1}": secs * z for i, z in enumerate(zones)}, **splits,
        }
    if type_key in ("road_biking", "virtual_ride"):
        ftp = 245 + 25 * fit
        avg_p = ftp * (0.8 if quality else 0.66) + rng.gauss(0, 5)
        np_ = avg_p * (1.1 if quality else 1.04)
        speed = (29 + 2 * fit) * (1.03 if quality else 1) + rng.gauss(0, 0.8)  # km/h
        hr = (156 if quality else 139 - 4 * fit) + rng.gauss(0, 2.5)
        if_ = np_ / ftp
        zones = [0.1, 0.35, 0.3, 0.22, 0.03] if quality else [0.12, 0.7, 0.16, 0.02, 0.0]
        return {
            "distance": speed * secs / 3.6, "movingDuration": secs * 0.97, "averageSpeed": speed / 3.6,
            "averageHR": int(hr), "maxHR": int(hr + rng.uniform(15, 25)),
            "avgPower": round(avg_p), "normPower": round(np_),
            "max20MinPower": round(ftp * (0.95 if quality else 0.78) + rng.gauss(0, 4)),
            "intensityFactor": round(if_, 2), "trainingStressScore": round(secs / 3600 * if_ ** 2 * 100),
            "averageBikingCadenceInRevPerMinute": round(88 + rng.gauss(0, 2), 1),
            "elevationGain": rng.uniform(100, 700) if type_key == "road_biking" else rng.uniform(50, 300),
            **{f"hrTimeInZone_{i + 1}": secs * z for i, z in enumerate(zones)},
        }
    if type_key == "lap_swimming":
        pace100 = 135 - 17 * fit + rng.gauss(0, 3)
        dist = round(secs * 0.85 / pace100 * 100 / 50) * 50  # ~15% rest at the wall
        hr = 138 + rng.gauss(0, 3)
        return {
            "distance": dist, "movingDuration": dist / 100 * pace100, "averageSpeed": 100 / pace100,
            "averageHR": int(hr), "maxHR": int(hr + 18), "poolLength": 25,
            "averageSwolf": round(42 - 6 * fit + rng.gauss(0, 1), 1),
            "averageSwimCadenceInStrokesPerMinute": round(26 + 3 * fit + rng.gauss(0, 0.8), 1),
            "strokes": int(dist / 25 * (18 - 3 * fit)),
            **{f"hrTimeInZone_{i + 1}": secs * z for i, z in enumerate([0.15, 0.5, 0.3, 0.05, 0.0])},
        }
    return {"averageHR": 105 + int(rng.gauss(0, 4)), "maxHR": 140}


def _splits(detail: dict[str, Any], minutes: float, drift_pct: float) -> dict[str, Any]:
    """Equal-length laps; heart rate creeps up in the second half by ~drift_pct."""
    n = max(4, int(minutes // 10))
    hr, speed, power = detail["averageHR"], detail.get("averageSpeed"), detail.get("avgPower")
    laps = []
    for k in range(n):
        f = 1 + drift_pct / 100 * (k / (n - 1)) * 2 - drift_pct / 100 / 2  # centred on the average
        laps.append({"duration": minutes * 60 / n, "averageHR": round(hr * f, 1),
                     "averageSpeed": speed, **({"averagePower": power} if power else {})})
    return {"lapDTOs": laps}


def seed(
    store: Store, days: int, today: date | None = None, rng_seed: int = 7, activity_days: int = 365
) -> None:
    today = today or date.today()
    rng = random.Random(rng_seed)
    hrv_base, rhr_base = 62.0, 47.0
    fatigue = 0.0
    act_id = 9_000_000_000
    span = max(days, min(activity_days, 730))

    for i in range(span, -1, -1):
        fit = 1 - i / span
        d = today - timedelta(days=i)
        day = d.isoformat()

        # Recovery responds to the previous days' load.
        hrv = hrv_base - fatigue * 6 + rng.gauss(0, 4)
        rhr = rhr_base + fatigue * 2 + rng.gauss(0, 1.2)
        total = int(rng.gauss(7.4, 0.6) * 3600)
        deep = int(total * rng.uniform(0.14, 0.22))
        rem = int(total * rng.uniform(0.18, 0.26))
        awake = int(rng.uniform(8, 35) * 60)
        light = total - deep - rem
        score = int(max(40, min(98, 60 + (total / 3600 - 6) * 12 + (hrv - 55) * 0.5 + rng.gauss(0, 4))))
        bed = datetime(d.year, d.month, d.day) - timedelta(hours=rng.uniform(1.0, 2.2))
        wake = bed + timedelta(seconds=total + awake)

        store.put_daily("sleep", day, {
            "dailySleepDTO": {
                "calendarDate": day,
                "sleepTimeSeconds": total,
                "deepSleepSeconds": deep,
                "lightSleepSeconds": light,
                "remSleepSeconds": rem,
                "awakeSleepSeconds": awake,
                "sleepStartTimestampLocal": _local_ms(bed),
                "sleepEndTimestampLocal": _local_ms(wake),
                "averageSpO2Value": round(rng.uniform(94, 98), 1),
                "averageRespirationValue": (resp := round(rng.uniform(12.8, 14.2), 1)),
                "lowestRespirationValue": round(resp - rng.uniform(1.8, 2.6), 1),
                "highestRespirationValue": round(resp + rng.uniform(2.0, 3.0), 1),
                "avgSkinTempDeviationC": round(rng.gauss(0, 0.2), 2),
                "avgSleepStress": round(max(5, 14 + fatigue * 6 + rng.gauss(0, 3)), 1),
                "sleepScores": {"overall": {"value": score, "qualifierKey": "GOOD" if score >= 80 else "FAIR"}},
            },
            "avgOvernightHrv": round(hrv, 1),
            "restingHeartRate": round(rhr),
            "hrvStatus": "BALANCED",
            "bodyBatteryChange": int(40 + (score - 60) * 0.8),
        })
        store.put_daily("hrv", day, {
            "hrvSummary": {
                "calendarDate": day,
                "lastNightAvg": round(hrv),
                "weeklyAvg": round(hrv_base - fatigue * 3),
                "status": "BALANCED" if hrv > 52 else "UNBALANCED",
                "baseline": {"balancedLow": 54, "balancedUpper": 70, "lowUpper": 50},
            }
        })
        wake_bb = int(max(20, min(100, 45 + (score - 60) * 1.1 - fatigue * 8 + rng.gauss(0, 5))))
        store.put_daily("stats", day, {
            "restingHeartRate": round(rhr),
            "bodyBatteryAtWakeTime": wake_bb,
            "bodyBatteryHighestValue": min(100, wake_bb + rng.randint(0, 6)),
            "bodyBatteryLowestValue": rng.randint(8, 30),
            "averageStressLevel": rng.randint(20, 38),
            "totalSteps": rng.randint(6000, 16000),
        })
        ready = int(max(5, min(100, 50 + (hrv - hrv_base) * 1.5 + (score - 70) * 0.8 - fatigue * 15)))
        store.put_daily("readiness", day, [{
            "calendarDate": day,
            "timestamp": f"{day}T06:30:00.0",
            "score": ready,
            "level": "HIGH" if ready >= 75 else "MODERATE" if ready >= 50 else "LOW",
            "feedbackShort": "WELL_RECOVERED" if ready >= 60 else "RECOVERING",
            "recoveryTime": int(max(0.0, fatigue * 14 + rng.gauss(3, 3)) * 60),  # minutes
        }])

        # Activities: follow the plan, skip the odd session, nothing yet for today.
        load_today = 0.0
        for type_key, name, (hh, mm), minutes, _km, load in (_WEEK_PLAN[d.weekday()] if i > 0 else []):
            if rng.random() < 0.1:
                continue
            minutes = minutes * rng.uniform(0.9, 1.1)
            act_id += 1
            start = datetime(d.year, d.month, d.day, hh, mm) + timedelta(minutes=rng.randint(-10, 20))
            load *= rng.uniform(0.85, 1.15)
            load_today += load
            quality = any(w in name.lower() for w in ("vo2", "tempo", "sweet spot"))
            detail = _detail(type_key, name, minutes, fit, rng)
            if type_key in ("running", "road_biking", "virtual_ride") and i <= 90:
                # Lap splits for aerobic decoupling. The last few long runs drift more
                # and more, so the demo shows the "overreaching" alert.
                drift = 7 - i * 0.2 if name.startswith("Long run") and i <= 21 else rng.uniform(1.0, 4.0)
                store.put_daily("splits", str(act_id), _splits(detail, minutes, drift))
            store.put_activities([(act_id, day, {
                "activityId": act_id,
                "activityName": name,
                "startTimeLocal": start.strftime("%Y-%m-%d %H:%M:%S"),
                "activityType": {"typeKey": type_key},
                "duration": minutes * 60,
                "calories": int(minutes * rng.uniform(7, 12)),
                "activityTrainingLoad": round(load, 1),
                "aerobicTrainingEffect": round(rng.uniform(3.2, 4.2) if quality else rng.uniform(1.8, 3.2), 1),
                "anaerobicTrainingEffect": round(rng.uniform(1.8, 3.2) if quality else rng.uniform(0.0, 1.0), 1),
                **detail,
            })])
        fatigue = max(0.0, fatigue * 0.6 + load_today / 200)

        # VO2 max rising slowly with fitness.
        store.put_daily("maxmetrics", day, [{
            "generic": {"calendarDate": day, "vo2MaxPreciseValue": round(47.0 + 4 * fit + rng.gauss(0, 0.1), 1)},
            "cycling": {"calendarDate": day, "vo2MaxPreciseValue": round(49.0 + 3 * fit + rng.gauss(0, 0.1), 1)},
        }])

    store.set_meta("demo_seeded_for", today.isoformat())


def calendar_events(start: date, end: date) -> list[dict[str, Any]]:
    """Sample Google Calendar events for start <= day < end."""
    from .calendar_feed import key_reason
    from .config import settings
    from .normalize import sport_from_title

    def ev(d: date, title: str, hm: tuple[int, int], minutes: int, category: str, desc: str | None = None):
        s = datetime(d.year, d.month, d.day, *hm)
        return {
            "id": f"demo-{d.isoformat()}-{hm[0]:02d}{hm[1]:02d}-{category}",
            "title": title,
            "start": s.isoformat(timespec="minutes"),
            "end": (s + timedelta(minutes=minutes)).isoformat(timespec="minutes"),
            "all_day": False,
            "category": category,
            "sport": sport_from_title(title) if category == "training" else None,
            "key_reason": key_reason(title, category, sport_from_title(title) if category == "training" else None,
                                     settings.key_session_keywords),
            "description": desc,
            "location": None,
        }

    out = []
    d = start
    while d < end:
        wd = d.weekday()
        for _, title, hm, minutes, _, _ in _WEEK_PLAN[wd]:
            desc = {
                "VO2 max run 5×3min": "15min WU, 5×3min @ 3k pace w/ 2min jog, CD.",
                "Zwift: sweet spot 3×12min": "3×12min @ 90% FTP, 5min easy between.",
                "Long run 14 km": "Easy, conversational. Fuel at 45min.",
                "Endurance ride Z2": "Steady Z2, cadence 85–95.",
            }.get(title)
            out.append(ev(d, title, hm, minutes, "training", desc))
        if wd < 5:
            out += [ev(d, t, hm, m, "work") for t, hm, m in _WORK[wd]]
        out += [ev(d, t, hm, m, "study") for t, hm, m in _STUDY.get(wd, [])]
        out += [ev(d, t, hm, m, "reading") for t, hm, m in _READING.get(wd, [])]
        out += [ev(d, t, hm, m, "personal") for t, hm, m in _PERSONAL.get(wd, [])]
        d += timedelta(days=1)

    # A couple of one-off key dates relative to "now" so there's always something ahead.
    today = date.today()
    out.append(ev(today + timedelta(days=12), "Statistics exam", (9, 0), 120, "study"))
    return [e for e in out if start.isoformat() <= e["start"][:10] < end.isoformat()]

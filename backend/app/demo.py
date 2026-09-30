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

# A typical training week. weekday -> [(typeKey, title, (h, m), minutes, km, load)]
_WEEK_PLAN: list[list[tuple]] = [
    [("strength_training", "Mobility & core", (7, 0), 35, None, 25)],
    [("running", "Easy run 6 km", (6, 30), 36, 6.0, 55)],
    [("road_biking", "Zwift endurance ride", (18, 0), 60, 26.0, 70)],
    [("running", "Tempo run 3×8min", (6, 30), 45, 8.0, 110),
     ("strength_training", "Gym: strength & core", (18, 0), 45, None, 40)],
    [],
    [("running", "Long run 12 km (key)", (8, 0), 70, 12.0, 120)],
    [("lap_swimming", "Swim — technique", (8, 30), 40, 2.0, 45)],
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
    1: [("Lecture: research methods", (18, 0), 90)],
    3: [("Study — statistics module", (19, 30), 120)],
    5: [("Study — assignment 2", (10, 30), 120)],
    6: [("Revision — weekly notes", (15, 0), 60)],
}

def _local_ms(dt: datetime) -> int:
    return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def seed(store: Store, days: int, today: date | None = None, rng_seed: int = 7) -> None:
    today = today or date.today()
    rng = random.Random(rng_seed)
    hrv_base, rhr_base = 62.0, 47.0
    fatigue = 0.0
    act_id = 9_000_000_000

    for i in range(days, -1, -1):
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
                "averageRespirationValue": round(rng.uniform(12.5, 15.0), 1),
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
        }])

        # Activities: follow the plan, skip the odd session, nothing yet for today.
        load_today = 0.0
        for type_key, name, (hh, mm), minutes, km, load in (_WEEK_PLAN[d.weekday()] if i > 0 else []):
            if rng.random() < 0.1:
                continue
            minutes = minutes * rng.uniform(0.9, 1.1)
            act_id += 1
            start = datetime(d.year, d.month, d.day, hh, mm) + timedelta(minutes=rng.randint(-10, 20))
            load *= rng.uniform(0.85, 1.15)
            load_today += load
            store.put_activities([(act_id, day, {
                "activityId": act_id,
                "activityName": name.replace(" (key)", ""),
                "startTimeLocal": start.strftime("%Y-%m-%d %H:%M:%S"),
                "activityType": {"typeKey": type_key},
                "duration": minutes * 60,
                "distance": km * 1000 * rng.uniform(0.95, 1.05) if km else None,
                "averageHR": int(rng.uniform(128, 150)) if type_key != "strength_training" else 105,
                "maxHR": int(rng.uniform(155, 175)),
                "calories": int(minutes * rng.uniform(7, 12)),
                "elevationGain": rng.uniform(20, 120) if type_key in ("running", "road_biking") else None,
                "activityTrainingLoad": round(load, 1),
                "aerobicTrainingEffect": round(rng.uniform(1.8, 3.6), 1),
                "anaerobicTrainingEffect": round(rng.uniform(0.0, 1.5), 1),
            })])
        fatigue = max(0.0, fatigue * 0.6 + load_today / 200)

        # VO2 max creeping back up as running returns.
        store.put_daily("maxmetrics", day, [{
            "generic": {"calendarDate": day, "vo2MaxPreciseValue": round(47.0 + (days - i) * 0.025 + rng.gauss(0, 0.1), 1)},
            "cycling": {"calendarDate": day, "vo2MaxPreciseValue": 49.0},
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
            "key_reason": key_reason(title, settings.key_session_keywords),
            "description": desc,
            "location": None,
        }

    out = []
    d = start
    while d < end:
        wd = d.weekday()
        for _, title, hm, minutes, _, _ in _WEEK_PLAN[wd]:
            desc = {
                "Mobility & core": "Hips, ankles, plank series.",
                "Easy run 6 km": "Conversational pace, strides at the end.",
                "Tempo run 3×8min": "10min WU, 3×8min @ threshold w/ 2min jog, CD.",
                "Long run 12 km (key)": "Steady, negative split the last 3 km.",
                "Zwift endurance ride": "Z2, cadence 85–95.",
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
    out.append(ev(today + timedelta(days=9), "parkrun 5 km — race effort", (8, 0), 45, "training",
                  "Time-trial to check fitness."))
    out.append(ev(today + timedelta(days=12), "Statistics exam", (9, 0), 120, "study"))
    return [e for e in out if start.isoformat() <= e["start"][:10] < end.isoformat()]

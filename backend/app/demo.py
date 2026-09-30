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

_WEEK_PLAN = [  # weekday -> (typeKey, name, minutes, km or None, load)
    ("running", "Easy Run", 45, 8.5, 70),
    ("strength_training", "Strength", 40, None, 35),
    ("running", "Tempo Run", 55, 11.0, 140),
    ("road_biking", "Endurance Ride", 75, 32.0, 90),
    None,  # rest day
    ("running", "Long Run", 100, 19.0, 190),
    ("lap_swimming", "Pool Swim", 40, 2.2, 45),
]


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
        plan = _WEEK_PLAN[d.weekday()]

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

        # Activities (skip some sessions at random, and today's before it's "done").
        load_today = 0.0
        if plan and i > 0 and rng.random() > 0.12:
            type_key, name, minutes, km, load = plan
            minutes = minutes * rng.uniform(0.9, 1.1)
            act_id += 1
            start = datetime(d.year, d.month, d.day, rng.choice([6, 7, 17, 18]), rng.choice([0, 15, 30]))
            load_today = load * rng.uniform(0.85, 1.15)
            store.put_activities([(act_id, day, {
                "activityId": act_id,
                "activityName": name,
                "startTimeLocal": start.strftime("%Y-%m-%d %H:%M:%S"),
                "activityType": {"typeKey": type_key},
                "duration": minutes * 60,
                "distance": km * 1000 * rng.uniform(0.95, 1.05) if km else None,
                "averageHR": int(rng.uniform(128, 158)) if type_key != "strength_training" else 112,
                "maxHR": int(rng.uniform(165, 184)),
                "calories": int(minutes * rng.uniform(9, 13)),
                "elevationGain": rng.uniform(40, 300) if type_key in ("running", "road_biking") else None,
                "activityTrainingLoad": round(load_today, 1),
                "aerobicTrainingEffect": round(rng.uniform(2.2, 4.2), 1),
                "anaerobicTrainingEffect": round(rng.uniform(0.3, 2.5), 1),
            })])
        fatigue = max(0.0, fatigue * 0.6 + load_today / 200)

    store.set_meta("demo_seeded_for", today.isoformat())


def upcoming_events(days: int, today: date | None = None) -> list[dict[str, Any]]:
    """Sample calendar events for the next `days` days."""
    from .normalize import sport_from_title

    today = today or date.today()
    templates = [
        ("Easy run — Z2 45min", "Keep HR under 145. Strides at the end.", (7, 0), 45),
        ("Gym: strength & core", "Squats, RDLs, split squats, plank series.", (18, 0), 45),
        ("Tempo run 3×10min", "10min WU, 3×10min @ threshold w/ 2min jog, CD.", (6, 30), 60),
        ("Zwift endurance ride", "90min steady Z2, cadence 85–95.", (18, 30), 90),
        (None, None, None, None),
        ("Long run 20km", "Negative split last 5km. Practice fueling.", (7, 30), 110),
        ("Swim — technique", "Drills + 10×100m aerobic.", (8, 0), 45),
    ]
    out = []
    for i in range(days):
        d = today + timedelta(days=i)
        title, desc, hm, minutes = templates[d.weekday()]
        if not title:
            continue
        start = datetime(d.year, d.month, d.day, *hm)
        out.append({
            "id": f"demo-{d.isoformat()}",
            "title": title,
            "start": start.isoformat(timespec="minutes"),
            "end": (start + timedelta(minutes=minutes)).isoformat(timespec="minutes"),
            "all_day": False,
            "sport": sport_from_title(title),
            "description": desc,
            "location": None,
        })
    return out

from app import normalize


def test_sleep_extracts_stages_and_scores():
    raw = {
        "dailySleepDTO": {
            "sleepTimeSeconds": 27000,
            "deepSleepSeconds": 5000,
            "lightSleepSeconds": 15000,
            "remSleepSeconds": 7000,
            "awakeSleepSeconds": 900,
            "sleepStartTimestampLocal": 1727650800000,  # 2024-09-29T23:00 wall time
            "sleepEndTimestampLocal": 1727678700000,
            "sleepScores": {"overall": {"value": 84, "qualifierKey": "GOOD"}},
            "avgSleepStress": 12.5,
        },
        "avgOvernightHrv": 61.0,
        "restingHeartRate": 46,
    }
    n = normalize.sleep("2024-09-30", raw)
    assert n["duration_s"] == 27000
    assert n["deep_s"] == 5000 and n["rem_s"] == 7000
    assert n["score"] == 84 and n["score_label"] == "GOOD"
    assert n["start"] == "2024-09-29T23:00"
    assert n["avg_hrv"] == 61.0 and n["resting_hr"] == 46


def test_sleep_missing_returns_none():
    assert normalize.sleep("2024-09-30", {}) is None
    assert normalize.sleep("2024-09-30", {"dailySleepDTO": {"sleepTimeSeconds": None}}) is None


def test_activity_sport_mapping():
    base = {"activityId": 1, "startTimeLocal": "2024-09-30 07:15:00"}
    cases = {
        "running": "run",
        "trail_running": "run",
        "road_biking": "ride",
        "virtual_ride": "ride",
        "lap_swimming": "swim",
        "strength_training": "strength",
        "yoga": "other",
    }
    for key, sport in cases.items():
        a = normalize.activity({**base, "activityType": {"typeKey": key}})
        assert a["sport"] == sport, key
        assert a["date"] == "2024-09-30" and a["start"] == "2024-09-30T07:15"


def test_title_sport_inference():
    assert normalize.sport_from_title("Tempo 3x10min") == "run"
    assert normalize.sport_from_title("Zwift: FTP builder") == "ride"
    assert normalize.sport_from_title("Open water swim") == "swim"
    assert normalize.sport_from_title("Gym — legs") == "strength"
    assert normalize.sport_from_title("Dentist") == "other"


def test_readiness_takes_morning_entry():
    raw = [
        {"timestamp": "2024-09-30T15:00:00", "score": 40, "level": "LOW"},
        {"timestamp": "2024-09-30T06:30:00", "score": 78, "level": "HIGH"},
    ]
    assert normalize.readiness("2024-09-30", raw)["score"] == 78


def test_vo2max():
    raw = [{"generic": {"vo2MaxPreciseValue": 51.3}, "cycling": None}]
    assert normalize.vo2max("2024-09-30", raw) == {"date": "2024-09-30", "run": 51.3, "ride": None}
    assert normalize.vo2max("2024-09-30", []) is None


def test_power_zones_fold_into_five_bands():
    raw = {"activityId": 1, "startTimeLocal": "2026-09-01 07:00:00", "activityType": {"typeKey": "road_biking"},
           **{f"powerTimeInZone_{i}": 10.0 * i for i in range(1, 8)}}
    assert normalize.activity(raw)["power_zones_s"] == [10, 20, 30, 40, 50 + 60 + 70]


def test_extras_normalisers():
    preds = normalize.race_predictions([{"calendarDate": "2026-09-01", "time5K": 1300, "time10K": 2700}])
    assert preds == [{"date": "2026-09-01", "5k": 1300, "10k": 2700, "half": None, "marathon": None}]
    lt = normalize.lactate_threshold("2026-09-30", [{"calendarDate": "2026-09-12", "speed": 0.3448, "heartRate": None},
                                                    {"calendarDate": "2026-09-12", "speed": None, "hearRate": 169}])
    assert lt == {"date": "2026-09-12", "pace_s_km": 290, "hr": 169}  # Garmin's speed is in tens of m/s
    assert normalize.cycling_ftp("2026-09-30", [{"functionalThresholdPower": 261.6, "calendarDate": "2026-08-02"}]) == \
        {"date": "2026-08-02", "ftp": 262}
    assert normalize.weights({"dateWeightList": [{"calendarDate": "2026-09-01", "weight": 74250}]}) == \
        [{"date": "2026-09-01", "kg": 74.2}]
    shoes = normalize.shoes(
        [{"uuid": "a", "gearTypeName": "Shoes", "displayName": "Trainer", "gearStatusName": "active"},
         {"uuid": "b", "gearTypeName": "Bike", "displayName": "Road"}],
        {"a": {"totalDistance": 512300, "totalActivities": 50}})
    assert shoes == [{"id": "a", "name": "Trainer", "km": 512.3, "max_km": 700, "max_set": False,
                      "activities": 50, "since": None, "retired": False}]

from datetime import date

from app import sport


def run(aid, day, km, minutes, hr=150, name="Easy run", splits=None, zones=None):
    return {"id": aid, "name": name, "sport": "run", "date": day, "start": f"{day}T07:00",
            "distance_m": km * 1000, "duration_s": minutes * 60, "moving_s": minutes * 60,
            "avg_hr": hr, "cadence": 170, "elevation_gain_m": 50, "training_load": 80,
            "best_splits_s": splits or {}, "hr_zones_s": zones}


def test_derived_run_metrics():
    m = sport.derived(run(1, "2026-09-01", 10, 50))
    assert m["pace"] == 300  # 5:00 /km
    assert m["efficiency"] == round(200 / 150, 3)  # 200 m/min at 150 bpm


def test_view_summarises_period_vs_previous_and_weeks():
    acts = [
        run(1, "2026-06-10", 8, 48),                       # previous period
        run(2, "2026-08-03", 10, 55, name="Tempo run 3×8min", zones=[0, 600, 1200, 1200, 300]),
        run(3, "2026-09-20", 12, 60, splits={"5k": 1400}),
        {"id": 9, "name": "Ride", "sport": "ride", "date": "2026-09-21", "start": "2026-09-21T07:00"},
    ]
    v = sport.sport_view("run", acts, [], date(2026, 7, 3), date(2026, 9, 30))
    assert v["summary"]["sessions"] == 2 and v["summary"]["distance_km"] == 22.0
    assert v["previous"]["sessions"] == 1
    assert v["summary"]["key_sessions"] == 1
    assert v["summary"]["pace"] == round((55 + 60) * 60 / 22)
    assert sum(w["sessions"] for w in v["weekly"]) == 2
    assert v["weekly"][0]["week_start"] == "2026-06-29"  # Monday on/before the range start
    assert v["zones_s"] == [0, 600, 1200, 1200, 300]
    assert [s["id"] for s in v["sessions"]] == [3, 2]  # newest first
    labels = {b["label"]: b for b in v["bests"]}
    assert labels["Fastest 5 km"]["value"] == 1400 and labels["Fastest 5 km"]["recent"]
    assert labels["Longest run"]["value"] == 12.0


def test_trend_change_compares_first_and_last_four_weeks():
    acts = [run(i, f"2026-{m:02d}-{d:02d}", 10, mins)
            for i, (m, d, mins) in enumerate([(4, 1, 60), (4, 8, 60), (9, 1, 50), (9, 8, 50)])]
    v = sport.sport_view("run", acts, [], date(2026, 3, 1), date(2026, 9, 30))
    pace = next(t for t in v["trends"] if t["key"] == "pace")
    assert pace["change"]["from"] == 360 and pace["change"]["to"] == 300 and pace["change"]["pct"] < 0


def test_pace_at_hr_scales_easy_runs_to_reference_heart_rate():
    acts = [run(i, f"2026-09-{i:02d}", 10, 50, hr=hr) for i, hr in enumerate([144, 146, 145, 150, 140, 170], 1)]
    view = sport.sport_view("run", acts, [], date(2026, 9, 1), date(2026, 9, 30))
    t = next(t for t in view["trends"] if t["key"] == "pace_at_hr")
    assert t["ref_hr"] == 145 and t["label"] == "Pace at 145 bpm"
    assert len(t["points"]) == 5  # the 170 bpm run is outside ±10 bpm
    by_hr = {p["id"]: p["value"] for p in t["points"]}
    assert by_hr[4] == round(300 * 150 / 145, 3)  # same pace at a higher HR counts as slower at 145


def test_run_and_ride_extras():
    extras = {
        "predictions": [{"date": "2026-08-01", "5k": 1300, "10k": None, "half": None, "marathon": None},
                        {"date": "2026-09-10", "5k": 1280, "10k": None, "half": None, "marathon": None}],
        "threshold": [{"date": "2026-08-01", "pace_s_km": 280, "hr": 168}, {"date": "2026-08-01", "pace_s_km": 280, "hr": 168},
                      {"date": "2026-09-15", "pace_s_km": 275, "hr": 169}],
        "shoes": [{"id": "a", "name": "Trainer", "km": 600}],
        "ftp": [{"date": "2026-07-01", "ftp": 250}, {"date": "2026-09-20", "ftp": 262}],
        "weight": [{"date": "2026-07-03", "kg": 75.0}, {"date": "2026-09-18", "kg": 74.0}],
    }
    start, end = date(2026, 9, 1), date(2026, 9, 30)
    r = sport.sport_view("run", [run(1, "2026-09-05", 10, 50)], [], start, end, extras=extras)
    assert [p["date"] for p in r["predictions"]] == ["2026-09-10"]
    assert r["threshold"]["latest"]["pace_s_km"] == 275
    # the reading in effect at the start of the range, then the change
    assert [(h["date"], h["pace_s_km"]) for h in r["threshold"]["history"]] == [("2026-09-01", 280), ("2026-09-15", 275)]
    assert r["shoes"][0]["name"] == "Trainer"
    ride = dict(run(2, "2026-09-05", 40, 80), sport="ride", power_zones_s=[60, 120, 60, 30, 10])
    b = sport.sport_view("ride", [ride], [], start, end, extras=extras)
    assert b["power_zones_s"] == [60, 120, 60, 30, 10]
    assert b["ftp"]["latest"] == {"date": "2026-09-20", "ftp": 262, "wkg": round(262 / 74.0, 2)}
    assert b["ftp"]["history"][0] == {"date": "2026-09-01", "ftp": 250, "wkg": round(250 / 75.0, 2)}


def test_css_from_best_200_and_400():
    efforts = [
        {"id": 1, "date": "2026-09-03", "name": "Swim", "t200": 190.0, "t400": None},
        {"id": 2, "date": "2026-09-10", "name": "Swim", "t200": 186.0, "t400": 400.0},
        {"id": 3, "date": "2026-09-17", "name": "Swim", "t200": None, "t400": 392.0},
    ]
    css = sport.swim_extras(efforts, date(2026, 9, 1), date(2026, 9, 30))["css"]
    assert css["pace_s100"] == (392 - 186) / 2  # 1:43 /100m
    assert css["t200"]["date"] == "2026-09-10" and css["t400"]["date"] == "2026-09-17"
    assert css["history"][-1] == {"date": "2026-09-30", "value": 103.0}
    assert sport.swim_extras(efforts[:1], date(2026, 9, 1), date(2026, 9, 30))["css"] is None

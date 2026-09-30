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

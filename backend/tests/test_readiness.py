from datetime import date, timedelta

from app import normalize, scoring

TODAY = date(2026, 9, 30)


def iso(n: int) -> str:
    return (TODAY - timedelta(days=n)).isoformat()


def healthy_days(n: int = 90, **today_overrides) -> dict[str, dict]:
    days = {}
    for i in range(n, -1, -1):
        days[iso(i)] = {"hrv": 60 + (i % 3), "rhr": 48 + (i % 2), "sleep_score": 80, "respiration": 14.0,
                        "respiration_low": 12.0, "respiration_high": 16.5, "skin_temp_dev": 0.0,
                        "steps": 10000 + (i % 5) * 300, "stress": 25}
    days[iso(0)].update(today_overrides)
    return days


def runs(loads_per_day: float = 60, days: int = 120) -> list[dict]:
    return [{"id": i, "name": "Easy run", "sport": "run", "date": iso(i), "start": iso(i) + "T07:00",
             "training_load": loads_per_day, "decoupling": 2.0} for i in range(days, 0, -1)]


def test_points_tables_sum_to_100_and_follow_spec():
    assert sum(m for _, m, _ in scoring.COMPONENTS.values()) == 100
    hrv = scoring.COMPONENTS["hrv"][2]
    assert scoring.banded(12, hrv) >= 26 and scoring.banded(-20, hrv) <= 7
    assert 16 <= scoring.banded(0, hrv) <= 21 and 22 <= scoring.banded(7, hrv) <= 25
    sleep = scoring.COMPONENTS["sleep"][2]
    assert scoring.banded(95, sleep) >= 17 and scoring.banded(40, sleep) <= 3
    acwr = scoring.COMPONENTS["acwr"][2]
    assert scoring.banded(0.9, acwr) >= 14 and scoring.banded(1.1, acwr) >= 11
    assert scoring.banded(1.7, acwr) <= 3 and scoring.banded(0.4, acwr) <= 3
    assert scoring.banded(0, scoring.COMPONENTS["recovery"][2]) == 12
    assert scoring.banded(80, scoring.COMPONENTS["stress"][2]) == 0


def test_healthy_steady_day_scores_well():
    res = scoring.compute(TODAY, healthy_days(), runs(), {iso(i): 50.0 for i in range(30)}, 0)
    s = res["score"]
    assert s and s["available"] == 100 and s["value"] >= 70
    by_key = {c["key"]: c for c in res["components"]}
    assert by_key["recovery"]["points"] == 12 and by_key["vo2max"]["points"] == 3


def test_missing_components_rescale_not_penalise():
    days = healthy_days()
    for d in days.values():
        d["respiration"] = None
    res = scoring.compute(TODAY, days, runs(), {}, None)
    s = res["score"]
    assert s["available"] < 100
    missing = [c for c in res["components"] if not c["available"]]
    assert {c["key"] for c in missing} == {"respiration", "recovery", "vo2max"}
    assert s["value"] == round(s["earned"] / s["available"] * 100)


def test_poor_recovery_scores_low_and_flags_components():
    res = scoring.compute(TODAY, healthy_days(hrv=40, sleep_score=42, rhr=58), runs(), {}, 60)
    by_key = {c["key"]: c for c in res["components"]}
    assert by_key["hrv"]["status"] == "bad" and by_key["sleep"]["status"] == "bad"
    assert by_key["recovery"]["points"] <= 1
    assert res["score"]["value"] < 55


def test_ewma_acwr_spike():
    loads = {iso(i): (60.0 if i > 7 else 200.0) for i in range(1, 121)}
    series = scoring.ewma_acwr(loads, TODAY - timedelta(days=1))
    assert series[-1][1] > 1.5 and 0.9 < series[-30][1] < 1.1


def test_illness_alert_needs_three_signals_on_two_nights():
    days = healthy_days()
    sick = {"rhr": 55, "hrv": 45, "skin_temp_dev": 0.8}
    days[iso(0)].update(sick)
    assert not any(a["id"] == "illness" for a in scoring.alerts(TODAY, days, [], {}, []))  # one night only
    days[iso(1)].update(sick)
    alert = next(a for a in scoring.alerts(TODAY, days, [], {}, []) if a["id"] == "illness")
    assert alert["severity"] == "critical" and len(alert["signals"]) >= 3


def test_sleep_debt_even_when_last_night_is_better():
    days = healthy_days()
    days[iso(2)]["sleep_score"], days[iso(1)]["sleep_score"], days[iso(0)]["sleep_score"] = 45, 50, 70
    alert = next(a for a in scoring.alerts(TODAY, days, [], {}, []) if a["id"] == "sleep_debt")
    assert "Last night (70)" in alert["detail"]


def test_overreaching_from_acwr_and_decoupling():
    series = [(iso(i), 1.6) for i in range(3, 0, -1)]
    a = next(x for x in scoring.alerts(TODAY, healthy_days(), [], {}, series) if x["id"] == "overreaching")
    assert "1.5" in a["signals"][0]
    rs = [{"id": i, "name": "Long run", "sport": "run", "date": iso(10 - i), "start": iso(10 - i) + "T08:00",
           "decoupling": d} for i, d in enumerate([2.0, 3.5, 5.0])]
    a = next(x for x in scoring.alerts(TODAY, healthy_days(), rs, {}, []) if x["id"] == "overreaching")
    assert "decoupling" in a["signals"][0]


def test_decoupling_from_laps():
    laps = [{"duration": 600, "averageHR": hr, "averageSpeed": 3.0} for hr in (140, 140, 147, 147)]
    assert normalize.decoupling({"lapDTOs": laps}, "run") == round((1 - 140 / 147) * 100, 1)
    assert normalize.decoupling({"lapDTOs": laps[:1]}, "run") is None
    power_laps = [dict(l, averagePower=200) for l in laps]
    assert normalize.decoupling({"lapDTOs": power_laps}, "ride") == round((1 - 140 / 147) * 100, 1)

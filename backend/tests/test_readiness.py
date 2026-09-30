from app import readiness


def inp(key, effect, today=None):
    return {"key": key, "label": key, "effect": effect, "today": today}


GOOD = [inp("hrv", 0.5), inp("resting_hr", 0.5), inp("sleep_score", 0.5), inp("sleep_hours", 0.2, 7.8),
        inp("body_battery", 0.3), inp("sleep_stress", 0.0)]


def test_score_is_high_when_recovered_and_load_is_sane():
    s = readiness.score(GOOD, {"ratio": 1.0}, {"days_since_hard": 4}, {"change_28d": 0.5})
    assert 55 <= s["value"] <= 100 and s["band"] in ("good", "high")
    assert abs(sum(c["weight"] for c in s["components"]) - 100) < 0.5
    assert not s["caps"]


def test_score_drops_with_poor_recovery_and_load_spike():
    bad = [inp("hrv", -1.2), inp("resting_hr", -1.0), inp("sleep_score", -1.0), inp("sleep_hours", -1.0, 6.0)]
    good = readiness.score(GOOD, {"ratio": 1.0}, {"days_since_hard": 4}, None)
    worse = readiness.score(bad, {"ratio": 1.7}, {"days_since_hard": 1}, None)
    assert worse["value"] < good["value"] - 20


def test_caps_override_average():
    inputs = GOOD[1:] + [inp("hrv", -2.0)]
    s = readiness.score(inputs, {"ratio": 1.0}, {"days_since_hard": 5}, None)
    assert s["value"] <= 50 and s["caps"][0]["reason"].startswith("HRV")
    short = [i if i["key"] != "sleep_hours" else inp("sleep_hours", -2.5, 4.5) for i in GOOD]
    assert readiness.score(short, {"ratio": 1.0}, {"days_since_hard": 5}, None)["value"] <= 55


def test_missing_baseline_gives_no_score():
    assert readiness.score([inp("hrv", None)], {"ratio": None}, {"days_since_hard": None}, None) is None


def test_load_points_shape():
    assert readiness.load_points(1.0) > readiness.load_points(1.45) > readiness.load_points(1.9)

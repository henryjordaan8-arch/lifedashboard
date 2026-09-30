from dataclasses import replace

import pytest

from app import snapshot
from app.config import Settings


@pytest.fixture(scope="module")
def bundle(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("snap")
    cfg = replace(Settings(), demo_mode=True, backfill_days=40, activity_backfill_days=120,
                  db_path=tmp / "db.sqlite3", goals_path=tmp / "none.json")
    return snapshot.build_bundle(cfg)


def test_bundle_has_everything_the_dashboard_asks_for(bundle):
    for path in snapshot.FIXED:
        assert path in bundle["responses"], path
    assert bundle["responses"]["/api/status"]["mode"] == "demo"
    assert len(bundle["days"]) == snapshot.DAYS_BACK + snapshot.DAYS_AHEAD + 1
    assert bundle["today"] in bundle["days"]
    assert bundle["weeks"] and bundle["activities"]
    assert bundle["responses"]["/api/sport/run?days=182"]["summary"]["sessions"] > 0


def test_encrypt_round_trip_and_wrong_password(bundle):
    salt = snapshot.salt_for("me/repo")
    doc = snapshot.encrypt(bundle, "a long enough password", salt)
    assert "activities" not in str(doc)  # nothing readable leaks
    assert snapshot.decrypt(doc, "a long enough password") == bundle
    with pytest.raises(Exception):
        snapshot.decrypt(doc, "wrong password")


def test_salt_is_stable_per_repo():
    assert snapshot.salt_for("a/b") == snapshot.salt_for("a/b") != snapshot.salt_for("a/c")

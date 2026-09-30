from datetime import date

from app import garmin
from app.store import Store


class FakeClient:
    def __init__(self):
        self.calls = []

    def _rec(self, kind):
        def f(day):
            self.calls.append((kind, day))
            return {"kind": kind, "day": day}
        return f

    def __getattr__(self, name):
        return self._rec(name)

    def get_activities_by_date(self, start, end):
        self.calls.append(("activities", start))
        return [{"activityId": 1, "startTimeLocal": f"{end} 07:00:00"}]


def test_sync_backfills_then_only_refreshes_recent(monkeypatch):
    monkeypatch.setattr(garmin, "REQUEST_PAUSE_S", 0)
    store, today = Store(":memory:"), date(2026, 9, 30)

    c1 = FakeClient()
    counts = garmin.sync(c1, store, backfill_days=10, today=today)
    assert counts["maxmetrics"] == 11 and counts["sleep"] == 11
    assert store.has_daily("maxmetrics", "2026-09-20")

    c2 = FakeClient()
    counts = garmin.sync(c2, store, backfill_days=10, today=today)
    # Only the last REFRESH_RECENT_DAYS+1 days are re-fetched on later syncs.
    assert counts["sleep"] == garmin.REFRESH_RECENT_DAYS + 1
    assert ("activities", "2026-09-28") in c2.calls


def test_pasted_tokens_seed_once_and_new_paste_replaces(tmp_path):
    from dataclasses import replace

    from app.config import Settings

    store_dir = tmp_path / "garmin"
    cfg = replace(Settings(), garmin_tokenstore=str(store_dir), garmin_tokens='{"v": 1}')
    garmin.seed_tokens(cfg)
    f = garmin.token_file(str(store_dir))
    assert f.read_text() == '{"v": 1}'

    f.write_text('{"v": 1, "refreshed": true}')  # the library refreshed it in place
    garmin.seed_tokens(cfg)
    assert "refreshed" in f.read_text()  # same paste: keep the refreshed file

    garmin.seed_tokens(replace(cfg, garmin_tokens='{"v": 2}'))  # new paste after expiry
    assert f.read_text() == '{"v": 2}'


class RangeClient(FakeClient):
    """Records the activity date ranges requested."""

    def get_activities_by_date(self, start, end):
        self.calls.append(("activities", start, end))
        return []


def test_longer_window_backfills_older_activities(monkeypatch):
    monkeypatch.setattr(garmin, "REQUEST_PAUSE_S", 0)
    store, today = Store(":memory:"), date(2026, 9, 30)
    ranges = lambda c: [x for x in c.calls if x[0] == "activities"]  # noqa: E731

    c1 = RangeClient()
    garmin.sync(c1, store, backfill_days=5, today=today, activity_backfill_days=730)
    assert ranges(c1) == [("activities", "2024-09-30", "2026-09-30")]

    c2 = RangeClient()  # next sync, same setting: only the recent days
    garmin.sync(c2, store, backfill_days=5, today=today, activity_backfill_days=730)
    assert ranges(c2) == [("activities", "2026-09-28", "2026-09-30")]

    c3 = RangeClient()  # window raised to 5 years: the older stretch is fetched once
    garmin.sync(c3, store, backfill_days=5, today=today, activity_backfill_days=1826)
    assert ranges(c3) == [("activities", "2026-09-28", "2026-09-30"), ("activities", "2021-09-30", "2024-09-30")]
    assert store.get_meta("activities_synced_from") == "2021-09-30"

    c4 = RangeClient()
    garmin.sync(c4, store, backfill_days=5, today=today, activity_backfill_days=1826)
    assert ranges(c4) == [("activities", "2026-09-28", "2026-09-30")]


def test_existing_install_without_from_marker_backfills(monkeypatch):
    """Someone who synced 2 years with the old code (no 'from' marker) gets the rest."""
    monkeypatch.setattr(garmin, "REQUEST_PAUSE_S", 0)
    store, today = Store(":memory:"), date(2026, 9, 30)
    store.set_meta("activities_synced_until", "2026-09-29")
    c = RangeClient()
    garmin.sync(c, store, backfill_days=5, today=today, activity_backfill_days=1826)
    assert [x for x in c.calls if x[0] == "activities"] == [
        ("activities", "2026-09-27", "2026-09-30"), ("activities", "2021-09-30", "2026-09-29")]

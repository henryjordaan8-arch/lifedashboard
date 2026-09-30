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

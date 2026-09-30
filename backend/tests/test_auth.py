from dataclasses import replace

from fastapi.testclient import TestClient

from app import auth
from app.config import Settings
from app.main import create_app
from app.store import Store


def client(tmp_path, password="hunter22", dist=None):
    cfg = replace(
        Settings(), demo_mode=True, sync_interval_minutes=0, backfill_days=10, activity_backfill_days=30,
        dashboard_password=password, session_secret="test-secret", db_path=tmp_path / "db.sqlite3",
        frontend_dist=dist or tmp_path / "no-dist",
    )
    return TestClient(create_app(cfg, Store(":memory:")))


def test_api_requires_login_when_password_set(tmp_path):
    with client(tmp_path) as c:
        assert c.get("/api/health").status_code == 200
        assert c.get("/api/session").json() == {"auth_required": True, "logged_in": False}
        assert c.get("/api/status").status_code == 401
        assert c.post("/api/sync").status_code == 401

        assert c.post("/api/login", json={"password": "nope"}).status_code == 401
        r = c.post("/api/login", json={"password": "hunter22"})
        assert r.status_code == 200 and auth.COOKIE in r.cookies
        cookie = r.headers["set-cookie"].lower()
        assert "httponly" in cookie and "samesite=lax" in cookie

        assert c.get("/api/status").status_code == 200
        assert c.get("/api/session").json()["logged_in"] is True

        c.post("/api/logout")
        c.cookies.clear()
        assert c.get("/api/status").status_code == 401


def test_no_password_means_open(tmp_path):
    with client(tmp_path, password="") as c:
        assert c.get("/api/status").status_code == 200
        assert c.get("/api/session").json()["auth_required"] is False


def test_tampered_or_expired_cookie_rejected():
    gate = auth.Auth("pw", b"secret")
    token = gate.issue(now=1000)
    assert gate.valid(token, now=1001)
    assert not gate.valid(token, now=1000 + auth.SESSION_DAYS * 86400 + 1)
    expires, sig = token.split(".")
    assert not gate.valid(f"{int(expires) + 999999}.{sig}", now=1001)
    assert not auth.Auth("pw", b"other-secret").valid(token, now=1001)


def test_brute_force_lockout(tmp_path):
    with client(tmp_path) as c:
        for _ in range(auth.MAX_FAILURES):
            assert c.post("/api/login", json={"password": "guess"}).status_code == 401
        # even the right password is refused while locked out
        assert c.post("/api/login", json={"password": "hunter22"}).status_code == 429


def test_serves_built_dashboard(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>dashboard</html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    with client(tmp_path, dist=dist) as c:
        assert "dashboard" in c.get("/").text
        assert "dashboard" in c.get("/today").text  # unknown paths fall back to the app
        assert c.get("/assets/app.js").status_code == 200
        assert c.get("/../../etc/passwd").text.startswith("<html>")
        assert c.get("/api/nope").status_code == 401  # API stays protected, never the HTML page


def test_server_without_password_stays_locked(tmp_path):
    cfg = replace(
        Settings(), demo_mode=True, sync_interval_minutes=0, backfill_days=10, activity_backfill_days=30,
        dashboard_password="", require_password=True, session_secret="s", db_path=tmp_path / "db.sqlite3",
        frontend_dist=tmp_path / "none",
    )
    with TestClient(create_app(cfg, Store(":memory:"))) as c:
        assert c.get("/api/status").status_code == 401
        r = c.post("/api/login", json={"password": ""})
        assert r.status_code == 503 and "DASHBOARD_PASSWORD" in r.json()["detail"]

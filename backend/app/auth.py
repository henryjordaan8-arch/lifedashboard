"""Single-user password login for the hosted dashboard.

A successful login sets an HttpOnly cookie holding an expiry time signed with
HMAC-SHA256. No user table, no third-party dependency: there is exactly one
user (you) and one password (DASHBOARD_PASSWORD).
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
from pathlib import Path

COOKIE = "ld_session"
SESSION_DAYS = 90
MAX_FAILURES = 10          # per client address…
MAX_FAILURES_GLOBAL = 50   # …and across all addresses…
FAILURE_WINDOW_S = 15 * 60  # …within this window, then logins are refused until it passes


def load_secret(configured: str, data_dir: Path) -> bytes:
    """Use SESSION_SECRET if set, else a random one persisted next to the database."""
    if configured:
        return configured.encode()
    path = data_dir / "session_secret"
    try:
        return path.read_bytes()
    except FileNotFoundError:
        data_dir.mkdir(parents=True, exist_ok=True)
        secret = secrets.token_bytes(32)
        path.write_bytes(secret)
        path.chmod(0o600)
        return secret


class Auth:
    def __init__(self, password: str, secret: bytes):
        self.password = password
        self.secret = secret
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self.password)

    # --- tokens ----------------------------------------------------------------
    def _sign(self, payload: str) -> str:
        return hmac.new(self.secret, payload.encode(), hashlib.sha256).hexdigest()

    def issue(self, now: float | None = None) -> str:
        expires = int((now or time.time()) + SESSION_DAYS * 86400)
        return f"{expires}.{self._sign(str(expires))}"

    def valid(self, token: str | None, now: float | None = None) -> bool:
        if not self.enabled:
            return True
        if not token or "." not in token:
            return False
        expires, sig = token.split(".", 1)
        if not hmac.compare_digest(sig, self._sign(expires)):
            return False
        try:
            return int(expires) > (now or time.time())
        except ValueError:
            return False

    # --- password checks with brute-force protection ---------------------------
    def locked_out(self, client: str, limit: int = MAX_FAILURES, now: float | None = None) -> bool:
        now = now or time.time()
        with self._lock:
            recent = [t for t in self._failures.get(client, []) if now - t < FAILURE_WINDOW_S]
            self._failures[client] = recent
            return len(recent) >= limit

    def record_failure(self, client: str, now: float | None = None) -> None:
        with self._lock:
            self._failures.setdefault(client, []).append(now or time.time())

    def check_password(self, attempt: str) -> bool:
        return hmac.compare_digest(attempt.encode(), self.password.encode())

#!/usr/bin/env python3
"""One-command launcher for Life Dashboard.

    python3 start.py            # set up (first run), start everything, open the browser
    python3 start.py --login    # one-time Garmin login (handles MFA), then exit
    python3 start.py --demo     # run on sample data, no accounts needed

Needs Python 3.11+ and Node.js 20+. Press Ctrl+C to stop.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
BACKEND_PORT = 8000
FRONTEND_PORT = 5173
URL = f"http://localhost:{FRONTEND_PORT}"


def say(msg: str) -> None:
    print(f"\033[1m›\033[0m {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"\n\033[31m✗ {msg}\033[0m\n", file=sys.stderr)
    sys.exit(1)


def run(cmd: list, **kw) -> None:
    subprocess.check_call([str(c) for c in cmd], **kw)


def _changed(src: Path, stamp: Path) -> bool:
    """True when `src` differs from the last time we installed from it."""
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    if stamp.exists() and stamp.read_text() == digest:
        return False
    stamp.parent.mkdir(parents=True, exist_ok=True)
    stamp.write_text(digest)
    return True


def setup_backend() -> None:
    if sys.version_info < (3, 11):
        fail(f"Python 3.11 or newer is needed (this is {sys.version.split()[0]}). Get it from python.org.")
    if not PY.exists():
        say("Creating Python environment (first run only)…")
        run([sys.executable, "-m", "venv", VENV])
    stamp = VENV / ".requirements.sha"
    if _changed(BACKEND / "requirements.txt", stamp):
        say("Installing backend packages…")
        try:
            run([PY, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "-r", BACKEND / "requirements.txt"])
        except subprocess.CalledProcessError:
            stamp.unlink(missing_ok=True)
            fail("Installing backend packages failed (see above).")
    env = BACKEND / ".env"
    if not env.exists():
        shutil.copy(BACKEND / ".env.example", env)
        say(f"Created {env.relative_to(ROOT)}: add your Garmin login and calendar links there.")


def setup_frontend() -> str:
    node = shutil.which("node")
    npm = shutil.which("npm")
    if not node or not npm:
        fail("Node.js is needed for the dashboard. Install the LTS version from nodejs.org, then run this again.")
    stamp = FRONTEND / "node_modules" / ".lock.sha"
    if not (FRONTEND / "node_modules").exists() or _changed(FRONTEND / "package-lock.json", stamp):
        say("Installing dashboard packages (first run only)…")
        try:
            run([npm, "ci", "--no-audit", "--no-fund", "--loglevel=error"], cwd=FRONTEND)
        except subprocess.CalledProcessError:
            stamp.unlink(missing_ok=True)
            fail("Installing dashboard packages failed (see above).")
        _changed(FRONTEND / "package-lock.json", stamp)
    return node


def wait_for(url: str, seconds: float) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except Exception:  # noqa: BLE001 - not up yet
            time.sleep(0.5)
    return False


def env_value(key: str) -> str:
    env = BACKEND / ".env"
    if not env.exists():
        return ""
    for line in env.read_text().splitlines():
        if line.strip().startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return ""


def _stop(*_: object) -> None:
    raise KeyboardInterrupt


def main() -> int:
    # Ctrl+C, closing the terminal window, or a plain `kill` all shut both servers down cleanly.
    for sig in ("SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"):
        if hasattr(signal, sig):
            signal.signal(getattr(signal, sig), _stop)

    ap = argparse.ArgumentParser(description="Start Life Dashboard")
    ap.add_argument("--login", action="store_true", help="one-time Garmin login (handles MFA), then exit")
    ap.add_argument("--demo", action="store_true", help="run on sample data, no accounts needed")
    ap.add_argument("--no-browser", action="store_true", help="don't open the browser")
    args = ap.parse_args()

    setup_backend()

    if args.login:
        say("Logging in to Garmin…")
        return subprocess.call([str(PY), "-m", "scripts.garmin_login"], cwd=BACKEND)

    node = setup_frontend()

    demo = args.demo or env_value("DEMO_MODE").lower() == "true"
    token_dir = Path(os.path.expanduser(env_value("GARMIN_TOKENSTORE") or "~/.garminconnect"))
    if not demo and not token_dir.exists():
        say("No Garmin login saved yet. Run  python3 start.py --login  once (or use --demo to look around).")
    if not demo and not any(env_value(k) for k in (
        "GCAL_ICS_URLS", "GCAL_TRAINING_ICS_URLS", "GCAL_WORK_ICS_URLS", "GCAL_STUDY_ICS_URLS",
        "GCAL_READING_ICS_URLS", "GCAL_PERSONAL_ICS_URLS",
    )):
        say("No Google Calendar link in backend/.env yet: the Today view and Upcoming will be empty.")

    backend_env = dict(os.environ, **({"DEMO_MODE": "true"} if args.demo else {}))
    say(f"Starting backend{' (demo data)' if demo else ''}…")
    backend = subprocess.Popen(
        [str(PY), "-m", "uvicorn", "app.main:app", "--port", str(BACKEND_PORT), "--log-level", "warning"],
        cwd=BACKEND, env=backend_env,
    )
    say("Starting dashboard…")
    frontend = subprocess.Popen(
        [node, str(FRONTEND / "node_modules" / "vite" / "bin" / "vite.js"),
         "--port", str(FRONTEND_PORT), "--strictPort", "--logLevel", "warn"],
        cwd=FRONTEND,
    )

    procs = [backend, frontend]
    try:
        if not wait_for(f"http://127.0.0.1:{BACKEND_PORT}/api/status", 60):
            fail(f"The backend didn't start. Is something else using port {BACKEND_PORT}?")
        if not wait_for(URL, 60):
            fail(f"The dashboard didn't start. Is something else using port {FRONTEND_PORT}?")
        print(f"\n  \033[1;32m✓ Life Dashboard is running:\033[0m {URL}")
        if not demo:
            print("    The first Garmin sync takes 5–10 minutes; the dashboard fills in as it goes.")
        print("    Press Ctrl+C to stop.\n", flush=True)
        if not args.no_browser:
            webbrowser.open(URL)
        while all(p.poll() is None for p in procs):
            time.sleep(1)
        fail("A server stopped unexpectedly (see the messages above).")
    except KeyboardInterrupt:
        print()
        say("Stopping…")
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                p.kill()
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""One-time interactive Garmin login.

Handles MFA if your account uses it, then caches OAuth tokens in
GARMIN_TOKENSTORE so the dashboard can sync without your password.

    python3 start.py --login          (from the repo root; or double-click garmin-login)
"""

from __future__ import annotations

import getpass
import sys
from dataclasses import replace

from app.config import settings
from app.garmin import connect


def main() -> int:
    email = settings.garmin_email or input("Garmin email: ").strip()
    password = settings.garmin_password or getpass.getpass("Garmin password: ")
    cfg = replace(settings, garmin_email=email, garmin_password=password)
    try:
        client = connect(cfg, prompt_mfa=lambda: input("MFA code: ").strip())
    except Exception as exc:  # noqa: BLE001 - show a readable message, not a traceback
        print(f"\nGarmin login failed: {exc}")
        print("Check your email and password (the same as connect.garmin.com) and try again.")
        print("If it keeps failing, Garmin may be rate-limiting logins: wait 15 minutes.")
        return 1
    print(f"Logged in as {client.full_name or client.display_name}.")
    print(f"Login saved in {cfg.garmin_tokenstore}. Your password isn't stored by the dashboard.")
    print("Next: start the dashboard (start.command / start.bat, or `python3 start.py`).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

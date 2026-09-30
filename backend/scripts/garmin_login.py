"""One-time interactive Garmin login.

Handles MFA if your account uses it, then caches OAuth tokens in
GARMIN_TOKENSTORE so the dashboard can sync without your password.

    cd backend && python -m scripts.garmin_login
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
    client = connect(cfg, prompt_mfa=lambda: input("MFA code: ").strip())
    print(f"Logged in as {client.full_name or client.display_name}.")
    print(f"Tokens cached in {cfg.garmin_tokenstore}; you can remove GARMIN_PASSWORD from .env.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

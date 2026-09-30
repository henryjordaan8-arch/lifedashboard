"""One-time interactive Garmin login.

Handles MFA if your account uses it, then caches OAuth tokens in
GARMIN_TOKENSTORE so the dashboard can sync without your password.

    python3 start.py --login          (from the repo root; or double-click garmin-login)
"""

from __future__ import annotations

import getpass
import os
import sys
from dataclasses import replace

from app.config import settings
from app.garmin import connect


def ask_password() -> str:
    """Hidden password prompt, with a visible fallback when hidden input doesn't work.

    Windows consoles don't accept Ctrl+V in hidden prompts (right-click does), and
    nothing appears while typing either way, which looks broken, so explain that,
    and fall back to a visible prompt if the hidden one comes back empty or garbled.
    """
    paste = "right-click to paste" if os.name == "nt" else "paste as usual"
    print(f"\nGarmin password: nothing appears as you type or paste (that's normal); {paste}, then press Enter.")
    try:
        pw = getpass.getpass("Password: ").strip()
    except (EOFError, KeyboardInterrupt):
        raise
    except Exception:  # noqa: BLE001 - some consoles can't hide input at all
        pw = ""
    if not pw or "\x16" in pw:  # empty, or Ctrl+V captured as a literal control character
        print("\nThat didn't come through. Enter it here instead (it WILL be visible on screen):")
        pw = input("Password: ").strip()
    return pw


def main() -> int:
    email = settings.garmin_email or input("Garmin email: ").strip()
    password = settings.garmin_password or ask_password()
    cfg = replace(settings, garmin_email=email, garmin_password=password)
    try:
        client = connect(cfg, prompt_mfa=lambda: input("MFA code: ").strip())
    except Exception as exc:  # noqa: BLE001 - show a readable message, not a traceback
        print(f"\nGarmin login failed: {exc}")
        print("Check your email and password (the same as connect.garmin.com) and try again.")
        print("Tip: you can also put GARMIN_EMAIL and GARMIN_PASSWORD in backend/.env, run this again,")
        print("then delete the password from .env once it says 'Logged in'.")
        print("If it keeps failing, Garmin may be rate-limiting logins: wait 15 minutes.")
        return 1
    print(f"Logged in as {client.full_name or client.display_name}.")
    print(f"Login saved in {cfg.garmin_tokenstore}. Your password isn't stored by the dashboard.")
    print("Next: start the dashboard (start.command / start.bat, or `python3 start.py`).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

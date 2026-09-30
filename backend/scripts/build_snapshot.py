"""Build the encrypted dashboard snapshot for GitHub Pages.

    DASHBOARD_PASSWORD=… python -m scripts.build_snapshot --out ../frontend/public/data.enc

Run by .github/workflows/publish.yml. Reads the same settings as the app
(environment / backend/.env). Prints only a short summary — never data, tokens
or calendar addresses, because CI logs on a public repository are public.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from app.config import settings
from app.snapshot import build_bundle, encrypt, salt_for


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()

    password = settings.dashboard_password
    if len(password) < 12:
        print("DASHBOARD_PASSWORD must be set and at least 12 characters: the published "
              "data is only as strong as this password.", file=sys.stderr)
        return 1

    bundle = build_bundle(settings)
    status = bundle["responses"]["/api/status"]
    doc = encrypt(bundle, password, salt_for(os.getenv("GITHUB_REPOSITORY", "local")))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(doc))

    print(f"Snapshot built: {len(bundle['activities'])} activities, "
          f"{len(bundle['days'])} days, {args.out.stat().st_size // 1024} KB encrypted.")
    if status.get("last_error"):
        # The message is ours (no secrets); the dashboard shows it too.
        print(f"Sync warning: {status['last_error']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

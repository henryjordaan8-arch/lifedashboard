#!/usr/bin/env sh
# Start Life Dashboard (macOS / Linux). Extra flags: --demo, --login, --no-browser
cd "$(dirname "$0")" || exit 1
exec python3 start.py "$@"

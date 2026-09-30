#!/usr/bin/env sh
# Double-click in Finder to start Life Dashboard (macOS).
cd "$(dirname "$0")" || exit 1
python3 start.py "$@"

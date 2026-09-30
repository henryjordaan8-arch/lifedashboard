#!/usr/bin/env sh
# Double-click in Finder once to log in to Garmin (macOS).
cd "$(dirname "$0")" || exit 1
python3 start.py --login
printf "\nPress Enter to close…"; read -r _

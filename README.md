# Life Dashboard

A personal desktop dashboard for Garmin data.

![Dashboard with demo data](docs/screenshot.png)


- **Sleep at a glance**: last night's duration, score and stages; HRV, resting HR, Body Battery, SpO₂ and respiration; a 14-night stage chart and an HRV trend against your balanced range.
- **Training calendar**: a month view of completed Garmin activities, colour-coded by sport, with monthly totals. Click a session for pace, heart rate, load and training effect. Planned sessions show as dashed chips on future days.
- **Upcoming sessions**: the next 14 days from Google Calendar, grouped by day.
- **Readiness**: the ingredients for a custom readiness score (HRV, resting HR, sleep score and duration, Body Battery, overnight stress, acute:chronic load), each compared with your own 28-day baseline. The combined score is still to be designed.

```
backend/   FastAPI + SQLite. Syncs Garmin (python-garminconnect) and reads Google Calendar (iCal)
frontend/  React + Vite + TypeScript. Dashboard UI; hand-drawn SVG charts, no chart library
```

## Quick start (demo data, no accounts needed)

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
DEMO_MODE=true uvicorn app.main:app --port 8000          # or set DEMO_MODE=true in .env

# frontend (second terminal)
cd frontend
npm install
npm run dev                                              # http://localhost:5173
```

## Using your real data

1. `cp backend/.env.example backend/.env` and fill it in.
2. **Garmin**: set `GARMIN_EMAIL`/`GARMIN_PASSWORD`, then log in once interactively (this handles MFA and caches tokens in `~/.garminconnect`):
   ```bash
   cd backend && python -m scripts.garmin_login
   ```
   After that you can remove the password from `.env`. The first sync backfills `BACKFILL_DAYS` (default 90) of history, which takes a few minutes. After that only new and recent days are fetched, every `SYNC_INTERVAL_MINUTES`, or when you click **Sync now**.
3. **Google Calendar**: open *Settings → your training calendar → Integrate calendar* and copy the **Secret address in iCal format** into `GCAL_ICS_URLS`. Optionally set `GCAL_KEYWORDS` (for example `run,ride,swim,gym`) if that calendar also contains non-training events.

> This uses Garmin's *unofficial* API (the same one the Garmin Connect website uses). It's fine for personal use, but it can break when Garmin changes things. If it does, upgrade the library first: `pip install -U garminconnect`.

Raw Garmin responses are stored untouched in `backend/data/lifedashboard.sqlite3` and normalised when read. New metrics can therefore be computed from your whole history without downloading anything again.

## Tests

```bash
cd backend && python -m pytest
cd frontend && npm run typecheck
```

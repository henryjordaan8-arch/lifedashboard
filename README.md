# Life Dashboard

A personal desktop dashboard for Garmin data, training, work and study.

![Today view with demo data](docs/today.png)

![Training & sleep view with demo data](docs/screenshot.png)


**Today** tab:

- **Your day**: a timeline of today's calendar with training, work and study blocks and hours per area. Planned training is checked against Garmin: ✓ done, or flagged if nothing matching was recorded. Garmin activities that weren't on the calendar show up too. Use ‹ › to move between days.
- **This morning**: sleep, HRV, resting HR and Body Battery against your average, plus knee-return context: rehab sessions this week, running km and the ramp against your usual week, and days since the last hard session.
- **Key sessions ahead**: upcoming sessions flagged as key. For now the rule is a title keyword or a ★ in the title (`KEY_SESSION_KEYWORDS`); it will be refined.
- **This week**: a checklist that ticks itself from Garmin and calendar data. Goals live in `backend/goals.json`; see below.

**Training & sleep** tab:

- **Sleep at a glance**: last night's duration, score and stages; HRV, resting HR, Body Battery, SpO₂ and respiration; a 14-night stage chart and an HRV trend against your balanced range.
- **Training calendar**: a month view of completed Garmin activities, colour-coded by sport, with monthly totals. Click a session for pace, heart rate, load and training effect. Planned sessions show as dashed chips on future days.
- **Upcoming sessions**: the next 14 days from Google Calendar, grouped by day.
- **Readiness**: VO₂ max and its 4-week change, recent sessions, and the ingredients for a custom readiness score (HRV, resting HR, sleep score and duration, Body Battery, overnight stress, acute:chronic load), each compared with your own 28-day baseline. The combined score is still to be designed.

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
3. **Google Calendar**: for each calendar, open *Settings → (calendar) → Integrate calendar* and copy the **Secret address in iCal format**.
   - If training, work and study live in separate calendars, put them in `GCAL_TRAINING_ICS_URLS`, `GCAL_WORK_ICS_URLS` and `GCAL_STUDY_ICS_URLS`. Every event in those calendars gets that category.
   - Put mixed calendars in `GCAL_ICS_URLS`. Their events are categorised by title: sport words or rehab/physio → training, "lecture/study/exam…" → study, "meeting/stand-up/work…" → work. Add your own words with `TRAINING_KEYWORDS`, `WORK_KEYWORDS` and `STUDY_KEYWORDS`.
   - The sport comes from the title too ("run", "Zwift", "swim", "gym", "knee rehab", …).
4. **Weekly goals**: `cp backend/goals.example.json backend/goals.json` and edit it. Each goal has a metric that the app measures for you:

   | metric | counts | options |
   |---|---|---|
   | `activity_count` / `activity_hours` / `activity_km` | Garmin activities | `sport` (one or a list), `name_contains`, `min_minutes` |
   | `calendar_hours` / `calendar_count` | calendar blocks that have ended | `category`, `title_contains` |
   | `sleep_nights` | nights meeting a bar | `min_hours`, `min_score` |
   | `step_days` | days meeting a bar | `min_steps` |
   | `manual` | you tick it on the dashboard | |

   Add `"mode": "at_most"` for caps, for example a weekly running-km limit while the knee comes back.

> This uses Garmin's *unofficial* API (the same one the Garmin Connect website uses). It's fine for personal use, but it can break when Garmin changes things. If it does, upgrade the library first: `pip install -U garminconnect`.

Raw Garmin responses are stored untouched in `backend/data/lifedashboard.sqlite3` and normalised when read. New metrics can therefore be computed from your whole history without downloading anything again.

## Tests

```bash
cd backend && python -m pytest
cd frontend && npm run typecheck
```

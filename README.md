# Life Dashboard

A personal desktop dashboard for Garmin data, training, work and study.

![Dashboard with demo data](docs/screenshot.png)

![Today view with demo data](docs/today.png)

![Running tab with demo data](docs/running.png)


**Dashboard** tab:

- **Sleep at a glance**: last night's duration, score and stages; HRV, resting HR, Body Battery, SpO₂ and respiration; a 14-night stage chart and an HRV trend against your balanced range.
- **Training calendar**: a month view of completed Garmin activities, colour-coded by sport, with monthly totals. Click a session for pace, heart rate, load and training effect. Planned sessions show as dashed chips on future days.
- **Upcoming sessions**: the next 14 days from Google Calendar, grouped by day.
- **Training readiness**: a 0–100 score with a breakdown of what's driving it; see below.

**Today** tab:

- **Your day**: an hour-by-hour plan from Google Calendar, colour-coded as training, work, study, reading, personal or other, with hours per area and a bar showing how the day is split. Planned training is checked against Garmin: ✓ done, or flagged if nothing matching was recorded. Garmin activities that weren't on the calendar show up too. Use ‹ › to move between days.
- **Key sessions ahead**: your quality sessions for the next 3 weeks: tempo, threshold, VO₂ max and interval runs, and structured bike sessions (sweet spot, FTP, over-unders, or reps like `3×12min`). Base sessions (easy, long, Z2, endurance, recovery), swims and gym are never key. Put a ★ in any event title to mark it by hand, or add title words with `KEY_SESSION_KEYWORDS`.
- **This week**: a checklist that ticks itself from Garmin and calendar data. Goals live in `backend/goals.json`; see below.

**Running / Cycling / Swimming** tabs, one dashboard per sport. Pick a range (3M · 6M · 1Y · 2Y):

- **Headline numbers** for the range compared with the previous one: sessions, distance, time and key sessions, plus pace for running, power and speed for cycling, and pace and SWOLF for swimming. Performance changes are green or red; volume changes stay neutral, since doing less can be a deliberate taper.
- **Weekly volume** as distance, time or training load.
- **Progress charts** with a 4-week rolling average:
  - Running: pace, aerobic efficiency (metres per minute per heartbeat) and VO₂ max.
  - Cycling: average power, aerobic efficiency (normalised watts per heartbeat) and VO₂ max.
  - Swimming: pace per 100 m, SWOLF and stroke rate.

  Key and base sessions get separate average lines, because a VO₂ session is faster than an easy run by design. The "% better" figure compares the first and last 4 weeks of the range, using base sessions when there are enough of them.
- **Personal bests** across all synced history, flagged when set in the current range: fastest 1 km, 5 km and 10 km, and longest run; best 20-min power and longest ride; fastest pace per 100 m, best SWOLF and longest swim.
- **Intensity**: time in heart-rate zones Z1–Z5, and the key vs base session split.
- **Sessions table**, sortable by any column, with ★ on key sessions.

Activity history is synced for `ACTIVITY_BACKFILL_DAYS`, 2 years by default. It's a single request, so it's cheap. Metrics that need a particular sensor (power meter, running dynamics, pool swim) only appear when Garmin has them.

## Readiness score (v1)

Each recovery input is compared with your own previous 28 days. An input at your normal scores 50; 2.5 standard deviations better scores 100, and 2.5 worse scores 0. The inputs are then weighted:

| Input | Weight |
|---|---|
| Overnight HRV | 25 |
| Resting heart rate (lower is better) | 15 |
| Sleep score | 15 |
| Sleep duration | 10 |
| Body Battery at wake | 10 |
| Overnight stress (lower is better) | 5 |
| Training load: 7-day vs 28-day ratio (sweet spot 0.8–1.3) | 10 |
| Days since the last hard session | 5 |
| VO₂ max trend over 4 weeks | 5 |

Some caps override the average: HRV well below normal caps the score at 50, and under 5 h of sleep caps it at 55. Bands: 75+ ready for hard, 55+ train as planned, 35+ take it easier, below 35 recover. If an input is missing, the weights are rebalanced across the rest. Weights and thresholds live at the top of `backend/app/readiness.py`.

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
   - If an area has its own calendar, put it in `GCAL_TRAINING_ICS_URLS`, `GCAL_WORK_ICS_URLS`, `GCAL_STUDY_ICS_URLS`, `GCAL_READING_ICS_URLS` or `GCAL_PERSONAL_ICS_URLS`. Every event in it gets that category.
   - Put mixed calendars in `GCAL_ICS_URLS`. Their events are categorised by title: sport words → training, "lecture/study/exam…" → study, "meeting/stand-up/work…" → work, "read/book…" → reading, "lunch/groceries/friends…" → personal. Add your own words with `*_KEYWORDS`.
   - The sport comes from the title too ("run", "Zwift", "swim", "gym", …).
4. **Weekly goals** live in `backend/goals.json`. Currently: 5 gym sessions, 2 runs, 2 bike sessions, 1 swim and 5 study sessions, all minimums. Gym counts Garmin *strength* activities, and study counts finished study blocks in your calendar. Sessions still on the calendar later in the week count toward "on track". Each goal has a metric that the app measures for you:

   | metric | counts | options |
   |---|---|---|
   | `activity_count` / `activity_hours` / `activity_km` | Garmin activities | `sport` (one or a list), `name_contains`, `min_minutes` |
   | `calendar_hours` / `calendar_count` | calendar blocks that have ended | `category`, `title_contains` |
   | `sleep_nights` | nights meeting a bar | `min_hours`, `min_score` |
   | `step_days` | days meeting a bar | `min_steps` |
   | `manual` | you tick it on the dashboard | |

   Add `"mode": "at_most"` for caps, for example a weekly running-km limit.

> This uses Garmin's *unofficial* API (the same one the Garmin Connect website uses). It's fine for personal use, but it can break when Garmin changes things. If it does, upgrade the library first: `pip install -U garminconnect`.

Raw Garmin responses are stored untouched in `backend/data/lifedashboard.sqlite3` and normalised when read. New metrics can therefore be computed from your whole history without downloading anything again.

## Tests

```bash
cd backend && python -m pytest
cd frontend && npm run typecheck
```

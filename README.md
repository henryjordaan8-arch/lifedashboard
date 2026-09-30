# Life Dashboard

A personal desktop dashboard for Garmin data, training, work and study.

![Dashboard with demo data](docs/screenshot.png)

![Today view with demo data](docs/today.png)

![Running tab with demo data](docs/running.png)


**Dashboard** tab:

- **Sleep at a glance**: last night's duration, score and stages; HRV, resting HR, Body Battery, SpO₂ and respiration; a 14-night stage chart, and a 14-night trend for any sleep metric (HRV, resting HR, score, stages, SpO₂, respiration, Body Battery, stress) against your normal range.
- **Training calendar**: a month view of completed Garmin activities, colour-coded by sport, with monthly totals. Click a session for pace, heart rate, load and training effect. Planned sessions show as dashed chips on future days.
- **Upcoming**: the next 14 days of **key training sessions** (★) and **calls** (☎: any calendar event with "call" in the title; change the word with `CALL_KEYWORDS`).
- **Training readiness**: a 100-point score with a bar per component, plus alerts for illness, overreaching and sleep debt; see below.

**Today** tab:

- **Your day**: an hour-by-hour plan from 05:00 (wake up) to 21:00 (sleep). Your fixed routine is always shown: dinner at 19:15, then bed and reading at 20:00. It lives in `backend/routine.json` if you want to change a time. Calendar events between those times are added, colour-coded as training, work, study, reading, personal or other, with hours per area and a bar showing how the day is split. Planned training is checked against Garmin: ✓ done, or flagged if nothing matching was recorded. Garmin activities that weren't on the calendar show up too. Use ‹ › to move between days.
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

## Readiness score (v2)

The score is out of 100 points. Within each band, points scale with how far into the band you are.

| Component | Points | Measured as | Full marks … zero |
|---|---|---|---|
| HRV | 28 | last night vs your 60-day average | ≥ +10% … below −15% |
| Sleep last night | 18 | Garmin sleep score | 90–100 … below 45 |
| Load ratio (ACWR) | 15 | EWMA 7-day ÷ 28-day training load | 0.8–1.0 … above 1.5 or below 0.5 |
| Recovery time | 12 | Garmin recovery time | 0 h … over 48 h |
| Sleep, last 3 nights | 7 | average sleep score | ≥ 80 … below 50 |
| Resting HR | 5 | vs 7-day average | at or below … more than 6 bpm above |
| Respiration | 5 | vs 30-day average | at or below … more than 2 breaths/min above |
| Aerobic decoupling | 4 | 7-day average over steady runs and rides | under 3% … over 12% |
| VO₂ max | 3 | 14-day trend | stable or rising … down more than 5% |
| Stress | 3 | Garmin average, last 3 days | 0–25 … over 75 |

- **Missing data:** components with no data (e.g. no respiration from your watch) are left out, and the total is rescaled to 100.
- **Colours:** each component shows a bar of points earned. Amber and red mark the ones holding the score back.
- **Aerobic decoupling:** compares output per heartbeat in the first and second half of a run or ride, using lap splits. Key sessions are left out because intervals aren't steady efforts.
- **Where to change it:** the points tables live at the top of `backend/app/scoring.py`.

**Alerts** show above the dashboard. They're not part of the score:

- **Possible illness:** 3 or more of these signals on each of the last 2 nights:
  - skin temperature up (watches that measure it)
  - resting HR up
  - fewer steps than usual
  - HRV down
  - breathing faster or more variable
- **Overreaching:** any of these:
  - load ratio above 1.5 for 3 days running
  - aerobic decoupling rising across your last 3 steady runs
  - VO₂ max falling for 14+ days while training load held up
- **Sleep debt:** the 3-night average sleep score is below 60, even if last night looked better.

## Getting started

You need **Python 3.11+** ([python.org](https://www.python.org/downloads/)) and **Node.js 20+** ([nodejs.org](https://nodejs.org), the LTS version).

```bash
git clone https://github.com/henryjordaan8-arch/lifedashboard.git
cd lifedashboard
```

| | macOS | Windows | Terminal (any OS) |
|---|---|---|---|
| **1. Log in to Garmin** (once) | double-click `garmin-login.command` | double-click `garmin-login.bat` | `python3 start.py --login` |
| **2. Start the dashboard** | double-click `start.command` | double-click `start.bat` | `python3 start.py` |
| Try it with sample data | | | `python3 start.py --demo` |

The first start installs everything, which takes a minute or two. After that it opens **http://localhost:5173** in your browser. Keep the window open while you use the dashboard and press **Ctrl+C** (or close the window) to stop.

> macOS may block the first double-click ("unidentified developer"). Right-click the file, choose **Open**, then **Open** again. You only need to do this once.

## Open it from any device

- **Free:** **[PAGES.md](PAGES.md)** sets up GitHub Pages. GitHub syncs your data every hour,
  encrypts it with your password and publishes it, and your browser decrypts it. About
  10 minutes to set up, and costs nothing.
- **Live server, about $5/month:** **[DEPLOY.md](DEPLOY.md)** covers Railway or any Docker host. Data is
  always up to date and **Sync now** works instantly.

## Connecting your accounts

1. **Garmin**: run the login step above. It asks for your Garmin email, password and, if you use it, a two-factor code, then saves a login token in `~/.garminconnect`. Your password isn't stored. The first sync pulls 90 days of sleep and health data plus 2 years of activities, which takes 5–10 minutes; the dashboard fills in as it goes. After that it syncs every hour, or when you click **Sync now**.
2. **Google Calendar**: the first start creates `backend/.env`; open it in any text editor. For each calendar, go to Google Calendar → ⚙️ **Settings** → the calendar under *Settings for my calendars* → **Integrate calendar**, and copy the **Secret address in iCal format**. Keep these addresses private.
   - If everything is in one calendar, use `GCAL_ICS_URLS=`. Events are categorised by title: sport words → training, "lecture/study/exam…" → study, "meeting/stand-up/work…" → work, "read/book…" → reading, "lunch/groceries/friends…" → personal. Add your own words with the `*_KEYWORDS` settings.
   - If an area has its own calendar, use `GCAL_TRAINING_ICS_URLS`, `GCAL_WORK_ICS_URLS`, `GCAL_STUDY_ICS_URLS`, `GCAL_READING_ICS_URLS` or `GCAL_PERSONAL_ICS_URLS`. Every event in it gets that category.
   - Training sessions get their sport from the title too ("run", "Zwift", "swim", "gym", …).

   Save the file and restart the dashboard.
3. **Troubleshooting**: if the pill at the top right says **Sync failed**, hover over it for the reason. Usually the Garmin login has expired; run the login step again. The `backend/.env` file (never uploaded to GitHub) holds every other setting, with notes.

<details><summary>Running the two servers by hand</summary>

```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# second terminal
cd frontend && npm install && npm run dev
```
</details>

## Weekly goals

**Weekly goals** live in `backend/goals.json`. Currently: 5 gym sessions, 2 runs, 2 bike sessions, 1 swim and 5 study sessions, all minimums. Gym counts Garmin *strength* activities, and study counts finished study blocks in your calendar. Sessions still on the calendar later in the week count toward "on track". Each goal has a metric that the app measures for you:

| metric | counts | options |
|---|---|---|
| `activity_count` / `activity_hours` / `activity_km` | Garmin activities | `sport` (one or a list), `name_contains`, `min_minutes` |
| `calendar_hours` / `calendar_count` | calendar blocks that have ended | `category`, `title_contains` |
| `sleep_nights` | nights meeting a bar | `min_hours`, `min_score` |
| `step_days` | days meeting a bar | `min_steps` |
| `manual` | you tick it on the dashboard | |

Add `"mode": "at_most"` for caps, for example a weekly running-km limit.

> This uses Garmin's *unofficial* API (the same one the Garmin Connect website uses). It's fine for personal use, but it can break when Garmin changes things. If it does, update the library with `backend/.venv/bin/pip install -U garminconnect` (Windows: `backend\.venv\Scripts\pip install -U garminconnect`).

Raw Garmin responses are stored untouched in `backend/data/lifedashboard.sqlite3` and normalised when read. New metrics can therefore be computed from your whole history without downloading anything again.

## Tests

```bash
cd backend && python -m pytest
cd frontend && npm run typecheck
```

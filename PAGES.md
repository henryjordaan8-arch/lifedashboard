# Free hosting on GitHub Pages

Open your dashboard from any device at
**https://henryjordaan8-arch.github.io/lifedashboard/**, for free. The layout is exactly
the same as on your computer.

## How it works

GitHub Pages can only host files; it can't run the app's server. So:

1. **Every hour**, a GitHub Action (free for public repositories) runs the normal sync.
   It pulls Garmin and your calendars and works out everything the dashboard shows.
2. It **encrypts** all of that with your dashboard password (AES-256, with the key
   derived from your password) and publishes it with the dashboard to GitHub Pages.
3. You open the page and type your password. **Your browser** decrypts the data. The
   password never leaves your device, and anyone else who finds the page gets
   unreadable data.

Compared with running it on your computer:

- **Updates:** data is refreshed **hourly**. **Refresh** loads the latest hourly update. To
  sync right away, go to **Actions → Publish dashboard → Run workflow** (it works from
  the GitHub mobile app too); it takes a few minutes.
- **Read-only:** ticking a *manual* weekly goal isn't saved. None of your current goals are manual.

---

## Setup (about 10 minutes, once)

### 1. Export your Garmin login (on your computer)

```bash
python3 start.py --login          # if you haven't yet
python3 start.py --garmin-token   # prints one long line: copy it
```

### 2. Turn on GitHub Pages

On GitHub, open your repository, then **Settings → Pages**. Under
*Build and deployment → Source*, choose **GitHub Actions**.

### 3. Add your secrets

Go to **Settings → Secrets and variables → Actions**. On the **Secrets** tab, click
**New repository secret** for each of these:

| Name | Value |
|---|---|
| `DASHBOARD_PASSWORD` | A **long** password, at least 12 characters. A passphrase of 4–5 random words is ideal. The encrypted file is public, so this password is what protects it. |
| `GARMIN_TOKENS` | The line from step 1. |
| `GCAL_ICS_URLS` | Your calendar's secret iCal address. Separate several with commas. Or use `GCAL_TRAINING_ICS_URLS`, `GCAL_WORK_ICS_URLS`, `GCAL_STUDY_ICS_URLS`, `GCAL_READING_ICS_URLS` and `GCAL_PERSONAL_ICS_URLS` for per-category calendars. |

Secrets are encrypted by GitHub. They're never shown in logs and aren't
visible to anyone else, even though the repository is public.

### 4. Add two variables

Same page, **Variables** tab → **New repository variable**:

| Name | Value |
|---|---|
| `TZ` | Your time zone, e.g. `Africa/Johannesburg` or `Europe/London` ([list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)) |
| `PUBLISH_DASHBOARD` | `true` (the on-switch for the hourly job) |

### 5. Run it

Go to **Actions → Publish dashboard → Run workflow**. The first run takes 5–10 minutes
because it pulls 90 days of health data and 2 years of activities. After that it runs
every hour by itself, and whenever you push a change.

### 6. Open it

Go to **https://henryjordaan8-arch.github.io/lifedashboard/** and enter your password. Each
device remembers you until you click **Sign out**. On a phone, *Add to Home Screen* makes it
open like an app.

---

## Good to know

- **Only one copy should sync with Garmin.** Garmin may renew the saved login when it's
  used, and two copies using it can knock each other out. Once the hosted one works, run
  locally with `python3 start.py --demo` if you want to tinker.
- **"Garmin login missing or expired"** in the dashboard: repeat step 1 and paste the new
  line into the `GARMIN_TOKENS` secret, then run the workflow.
- **Changing the password:** update the `DASHBOARD_PASSWORD` secret and run the workflow.
  Every device will ask for the new password. Saved history is encrypted with the old password,
  so it's re-synced from scratch (a few minutes).
- **GitHub pauses hourly jobs** in repositories with no activity for 60 days. It emails you
  first; click **Enable workflow** on the Actions tab, or push any change.
- **Security:**
  - What's public: the dashboard code (the repository is public) and one encrypted data file.
  - What stays private: your Garmin login, calendar addresses and password live only in GitHub Secrets.
  - The saved sync history is stored encrypted in GitHub's cache.
  - The workflow logs print only counts, never your data.
- **Garmin and cloud servers:** Garmin sometimes refuses requests from data-centre addresses.
  If syncing fails repeatedly from GitHub, the dashboard shows the error. Tell me and we'll
  look at options (see DEPLOY.md for a paid server).

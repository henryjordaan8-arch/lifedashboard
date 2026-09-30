# Hosting Life Dashboard online

Put the dashboard on the internet so you can open it from any device, behind
your own password. The layout is the same desktop layout you use locally.

The steps use **[Railway](https://railway.com)**: it deploys straight from your
GitHub repo, gives you an `https://` address, keeps a small persistent disk, and
costs about **US$5/month** (Hobby plan). The app is a standard Docker image, so
Fly.io, Render or your own server work too; see the end.

> **Before you start:** get the dashboard working on your computer first
> (see the README). You'll copy your Garmin login and settings from there.

---

## 1. Export your Garmin login (on your computer)

Garmin logins need your password and sometimes a two-factor code, which a
server can't type. So you log in on your computer and hand the server the
saved login:

```bash
python3 start.py --login          # if you haven't already
python3 start.py --garmin-token   # prints one long line
```

Copy the line between the dashes. **Treat it like a password.** After this,
let the hosted copy be the one that syncs; see the note in step 5.

## 2. Create the Railway project

1. Sign up at [railway.com](https://railway.com) with your GitHub account and choose the Hobby plan.
2. Click **New Project → Deploy from GitHub repo** and pick `lifedashboard`.
   Railway finds the `Dockerfile` and starts building. The first build takes a few minutes.
3. Open the service, go to **Settings → Networking → Generate Domain**. That's your
   dashboard's address, e.g. `https://lifedashboard-production.up.railway.app`.

## 3. Add a volume (persistent storage)

Without it, your synced history and Garmin login would be wiped on every deploy.

- In the project canvas, right-click the service (or press ⌘K / Ctrl+K) and choose **Attach Volume**.
- Mount path: **`/data`**. 1 GB is plenty.

## 4. Set the variables

In the service, open **Variables → Raw Editor** and paste this, filling in your values:

```ini
# Required
DASHBOARD_PASSWORD=choose-a-long-password
GARMIN_TOKENS=paste-the-line-from-step-1
TZ=Africa/Johannesburg

# Google Calendar: the same values as in your local backend/.env
GCAL_ICS_URLS=https://calendar.google.com/calendar/ical/.../basic.ics
# GCAL_TRAINING_ICS_URLS=
# GCAL_WORK_ICS_URLS=
# GCAL_STUDY_ICS_URLS=
# GCAL_READING_ICS_URLS=
# GCAL_PERSONAL_ICS_URLS=
```

- **`DASHBOARD_PASSWORD`**: the password you'll sign in with. Use something long. Until it's set, the dashboard stays locked and shows no data.
- **`TZ`**: your time zone, [from this list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), e.g. `Europe/London` or `America/New_York`. Servers run on UTC, so without it "today" and calendar times would be off.
- **Other settings**: any other setting from `backend/.env.example` works here too, such as `KEY_SESSION_KEYWORDS` or `BACKFILL_DAYS`.

Click **Deploy** (Railway also redeploys by itself when variables change).

## 5. Open it

Go to your domain from step 2 and sign in with your password. The first
sync pulls 90 days of health data and 5 years of activities, which takes
5–10 minutes; the dashboard fills in as it goes. After that it syncs every hour.
You stay signed in for 90 days on each device.

> **Only one copy should sync.** Garmin may renew the login each time it's used. If
> your computer and the server both use it, one of them can end up with an
> expired login. Once the hosted copy works, use that. You can still run
> locally with `python3 start.py --demo`.

---

## Everyday use

- **Changing the dashboard or goals:** edit, commit and push to GitHub. Railway rebuilds and redeploys by itself in a few minutes, and your data on the volume is kept.
- **"Sync failed: Garmin login missing or expired":** on your computer, run `python3 start.py --login` and then `--garmin-token`. Paste the new line into `GARMIN_TOKENS` on Railway; it redeploys and picks it up.
- **Changing your password:** edit `DASHBOARD_PASSWORD`. Existing sign-ins stay valid. To sign out every device, also set `SESSION_SECRET` to any new random text.
- **Cost:** Railway bills by usage. This app idles at a small fraction of the $5 Hobby allowance.

## Security

- **Access:** everything except the sign-in page needs your password.
- **Sign-in:** it uses a signed, HttpOnly, 90-day cookie. Repeated wrong guesses lock sign-in for 15 minutes.
- **Encryption:** traffic is HTTPS, provided by Railway.
- **Your data** (database, Garmin login) lives only on the volume attached to your service.
- **The Garmin login and calendar addresses** are stored as Railway variables, never in the repo.

## Other hosts

The `Dockerfile` works anywhere that runs containers. Whichever host you use:

- Mount a persistent volume at `/data`.
- Set the variables from step 4.
- Expose the port given in `$PORT` (default 8000).

For example, on a VPS:

```bash
docker build -t lifedashboard .
docker run -d --restart unless-stopped -p 8000:8000 -v lifedashboard-data:/data \
  -e DASHBOARD_PASSWORD=… -e GARMIN_TOKENS='…' -e TZ=Europe/London -e GCAL_ICS_URLS=… \
  lifedashboard
```

Then put it behind HTTPS, e.g. with Caddy: `caddy reverse-proxy --from dash.example.com --to :8000`.

## Garmin and cloud servers

This uses Garmin's unofficial API. Garmin sometimes blocks sign-ins from data-centre
addresses, which is one reason you sign in on your computer and export the login.
Syncing with a saved login normally works from servers. If Garmin starts refusing it,
the dashboard shows the error: export a fresh login as above, and if it keeps
happening, tell me and we'll look at alternatives.

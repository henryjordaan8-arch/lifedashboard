# Life Dashboard for Android

A phone app with the **Dashboard** (sleep, readiness score and alerts, training calendar,
upcoming key sessions and calls), **Today** (your day hour by hour, key sessions ahead and the
weekly checklist) and the **Running**, **Cycling** and **Swimming** tabs. It
signs in to Garmin itself, so it needs no computer, server or GitHub sync. It keeps the
**last 12 months** of activities and the last 3 months of sleep and health data on the phone.
Your daily routine and weekly goals come from `backend/routine.json` and `backend/goals.json`,
built into the app: change them there and the next APK picks them up.

The layout is the desktop layout, scaled to fit the screen. Turn the phone sideways for a
bigger view, and tap a point or bar in a chart to see its details.

## Install

1. On your phone, open **https://github.com/henryjordaan8-arch/lifedashboard/releases/tag/android**.
2. Tap **LifeDashboard.apk** to download it, then open it.
3. Android asks to allow installs from your browser: tap **Settings**, turn on **Allow from this
   source**, go back and tap **Install**. Google Play Protect may warn about an unknown app; tap
   **More details → Install anyway**. The warning appears because the app isn't from the Play
   Store.
4. Open **Life Dashboard**, then sign in with your Garmin Connect email and password. If you use
   two-factor sign-in, enter the code Garmin sends you.

The first sync downloads a year of activities plus 3 months of sleep, HRV and daily stats,
which takes a few minutes. The dashboard fills in when it's done. After that, the app syncs
whenever you open it if the data is over an hour old, or when you tap **Sync now**.

**Calendar (optional):** tap **Calendar** at the top and paste your Google Calendar's
*Secret address in iCal format*, one per line. The steps are on that screen. This adds planned
sessions to the training calendar and key sessions and calls to Upcoming. To put a whole
calendar in one category, start its line with the category, for example `study: https://…`.

## Updates

Every change to the dashboard builds a new APK automatically (GitHub → **Actions** → *Android
app*). To update, download it from the same page and install it over the old one. Your login
and data are kept. Each build checks that it's signed with the same key as the last one, and
won't publish if it isn't.

- **"App not installed" or "conflicts with an existing package":** the new build was signed
  with a different key. That happens when no build ran for more than 7 days, because GitHub
  then clears the saved key. Uninstall the old app, install the new one and sign in again.
- **To avoid that:** make your own key once and add it as a repository secret called
  `ANDROID_SIGNING_KEY` (GitHub → Settings → Secrets and variables → Actions). This needs Java
  installed. Run the following, then paste the contents of `key.txt` as the secret value:
  ```bash
  keytool -genkeypair -keystore key.jks -storepass android -keypass android -alias androiddebugkey \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Life Dashboard"
  base64 -w0 key.jks > key.txt     # macOS: base64 -i key.jks -o key.txt
  ```
  You'll need to reinstall once after adding it.

## Privacy

- Your Garmin password goes only to Garmin and is never stored. The app keeps Garmin's login
  token and your activities in its own storage on the phone.
- Your calendar addresses are also kept only on the phone.
- **Sign out** deletes your Garmin login and data. The calendar addresses stay until you remove
  them under **Calendar**.
- The APK on the release page contains no data or login. It's the same app for anyone who
  downloads it.

## Things to know

- This uses Garmin's *unofficial* sign-in, like the desktop version. If Garmin changes it,
  sign-in can stop working until the app is updated.
- If you see *"Garmin is limiting sign-ins"*, wait 15–30 minutes or switch between Wi-Fi and
  mobile data.
- Personal bests are taken from the 12 months on the phone, not your whole history. For the 1Y
  range, there's no previous year to compare against.
- The readiness score uses the same formula as the desktop version, computed on the phone.
  Custom keyword settings from `backend/.env` (such as `KEY_SESSION_KEYWORDS`) don't apply on
  the phone, but ★ in a title still marks a key session.

## Build it yourself

You need Node.js 22+, Java 21 and the Android SDK (Android Studio installs it).

```bash
cd frontend
npm ci
npm run build:app
npx cap add android   # first time only
npx cap sync android
cd android && ./gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
```

The app's code is in `frontend/src/mobile/`:

- `garmin.ts` handles sign-in and API calls.
- `data.ts` syncs and stores the data on the phone.
- `local.ts` answers the dashboard's `/api/...` requests in place of the backend.
- `sport.ts`, `normalize.ts`, `readiness.ts` and `calendar.ts` mirror `backend/app/sport.py`,
  `normalize.py`, `readiness.py` + `scoring.py` and `calendar_feed.py`. Change both sides
  together.

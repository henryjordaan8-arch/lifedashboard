# Life Dashboard for Android

A phone app with the **Running**, **Cycling** and **Swimming** dashboards. It signs in to
Garmin itself, so it needs no computer, server or GitHub sync, and it keeps the **last 12
months** of activities on the phone.

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

The first sync downloads your last year of activities and VO₂ max, which takes about a minute.
After that, the app syncs whenever you open it if the data is over an hour old, or when you tap
**Sync now**.

## Updates

Every change to the dashboard builds a new APK automatically (GitHub → **Actions** → *Android
app*). To update, download it from the same page and install it over the old one. Your login
and data are kept.

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
- **Sign out** deletes both.
- The APK on the release page contains no data or login. It's the same app for anyone who
  downloads it.

## Things to know

- This uses Garmin's *unofficial* sign-in, like the desktop version. If Garmin changes it,
  sign-in can stop working until the app is updated.
- If you see *"Garmin is limiting sign-ins"*, wait 15–30 minutes or switch between Wi-Fi and
  mobile data.
- Personal bests are taken from the 12 months on the phone, not your whole history. For the 1Y
  range, there's no previous year to compare against.

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
- `sport.ts` computes the dashboards, mirroring `backend/app/sport.py`.

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { api, APP } from "./api";
import { STATIC } from "./static";
import { AlertsBar } from "./components/AlertsBar";
import { ReadinessCard } from "./components/ReadinessCard";
import { SportView } from "./components/SportView";
import { TodayView } from "./components/TodayView";
import { SleepCard } from "./components/SleepCard";
import { SleepTimingCard } from "./components/SleepTimingCard";
import { TrainingCalendar } from "./components/TrainingCalendar";
import { UpcomingCard } from "./components/UpcomingCard";
import { ago } from "./format";
import type { CalEvent, Readiness, SleepNight, SleepTargets, Status } from "./types";

// Your routine's wake-up and lights-out (backend/routine.json); the Android app has no routine file.
const DEFAULT_TARGETS: SleepTargets = { wake: "05:00", bed: "21:00" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const ALL_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "today", label: "Today" },
  { id: "run", label: "Running" },
  { id: "ride", label: "Cycling" },
  { id: "swim", label: "Swimming" },
] as const;
type Tab = (typeof ALL_TABS)[number]["id"];
// Android app only (keeps its calendar code out of the web builds).
const CalendarSettings = lazy(() => import("./components/CalendarSettings").then((m) => ({ default: m.CalendarSettings })));
// The Android app has no Today view (no routine or weekly goals on the phone).
const TABS = APP ? ALL_TABS.filter((t) => t.id !== "today") : ALL_TABS;
const tabFromHash = (): Tab => TABS.find((t) => `#/${t.id}` === window.location.hash)?.id ?? "dashboard";

export function App({ onSignOut }: { onSignOut?: (() => void) | null }) {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const [status, setStatus] = useState<Status | null>(null);
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [sleepTargets, setSleepTargets] = useState<SleepTargets>(DEFAULT_TARGETS);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [upcoming, setUpcoming] = useState<{ configured: boolean; events: CalEvent[]; highlights?: CalEvent[] }>({
    configured: true,
    events: [],
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, n, r, u] = await Promise.all([api.status(), api.sleep(30), api.readiness(), api.upcoming(14)]);
      setStatus(s);
      setNights(n.nights);
      setSleepTargets(n.targets ?? DEFAULT_TARGETS);
      setReadiness(r);
      setUpcoming(u);
      setRefreshKey((k) => k + 1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While the backend's first sync is running, poll so data appears as soon as it lands.
  useEffect(() => {
    if (!status?.syncing) return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [status, load]);

  const syncNow = async () => {
    setStatus((s) => (s ? { ...s, syncing: true } : s));
    try {
      await api.sync();
    } finally {
      await load();
    }
  };

  const pillClass = status?.last_error ? "pill err" : status?.mode === "demo" ? "pill demo" : "pill";
  const pillText = status?.last_error
    ? "Sync failed"
    : status?.mode === "demo"
      ? "Demo data"
      : status?.syncing
        ? "Syncing…"
        : `Garmin · synced ${ago(status?.last_sync ?? null)}`;

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>{greeting()}</h1>
          <div className="date" title={status?.version ? `Version ${status.version}` : undefined}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <nav className="tabs" aria-label="Views">
          {TABS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} className={tab === t.id ? "on" : ""} aria-current={tab === t.id ? "page" : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
        <div className="sync">
          <span className={pillClass} title={status?.last_error ?? undefined}>
            <span className="dot" />
            {pillText}
          </span>
          <button
            className="btn"
            onClick={syncNow}
            disabled={status?.syncing}
            title={STATIC ? "Data is re-synced every hour; this loads the latest update" : undefined}
          >
            {status?.syncing ? "Syncing…" : STATIC ? "Refresh" : "Sync now"}
          </button>
          {APP && (
            <button className="btn ghost" onClick={() => setCalendarOpen(true)} title="Google Calendar links">
              Calendar
            </button>
          )}
          {onSignOut && (
            <button className="btn ghost" onClick={onSignOut} title="Sign out">
              Sign out
            </button>
          )}
        </div>
      </header>

      {calendarOpen && (
        <Suspense fallback={null}>
          <CalendarSettings onClose={() => (setCalendarOpen(false), load())} />
        </Suspense>
      )}
      {error && <div className="card" style={{ marginBottom: 20, color: "var(--bad)" }}>Can't reach the backend: {error}</div>}
      {status?.last_error && (
        <div className="card" style={{ marginBottom: 20, fontSize: 13 }}>
          <b>Garmin sync error:</b> <span className="ink2">{status.last_error}</span>
        </div>
      )}

      {tab === "today" ? (
        <TodayView refreshKey={refreshKey} />
      ) : tab === "run" || tab === "ride" || tab === "swim" ? (
        <SportView sport={tab} refreshKey={refreshKey} maxDays={APP ? 365 : undefined} />
      ) : (
        <main className="grid">
          <AlertsBar alerts={readiness?.alerts ?? []} />
          <SleepCard nights={nights} />
          <ReadinessCard data={readiness} />
          <TrainingCalendar planned={upcoming.events} refreshKey={refreshKey} />
          <UpcomingCard
            events={upcoming.highlights ?? []}
            configured={upcoming.configured}
            onSetUp={APP ? () => setCalendarOpen(true) : undefined}
          />
          <SleepTimingCard nights={nights} targets={sleepTargets} />
        </main>
      )}
      <footer className="app-foot">Life Dashboard · version {status?.version ?? "—"}</footer>
    </div>
  );
}

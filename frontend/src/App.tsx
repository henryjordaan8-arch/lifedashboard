import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { ReadinessCard } from "./components/ReadinessCard";
import { SportView } from "./components/SportView";
import { TodayView } from "./components/TodayView";
import { SleepCard } from "./components/SleepCard";
import { TrainingCalendar } from "./components/TrainingCalendar";
import { UpcomingCard } from "./components/UpcomingCard";
import { ago } from "./format";
import type { CalEvent, Readiness, SleepNight, Status } from "./types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "today", label: "Today" },
  { id: "run", label: "Running" },
  { id: "ride", label: "Cycling" },
  { id: "swim", label: "Swimming" },
] as const;
type Tab = (typeof TABS)[number]["id"];
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
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [upcoming, setUpcoming] = useState<{ configured: boolean; events: CalEvent[] }>({ configured: true, events: [] });
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, n, r, u] = await Promise.all([api.status(), api.sleep(30), api.readiness(), api.upcoming(14)]);
      setStatus(s);
      setNights(n);
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
          <div className="date">
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
          <button className="btn" onClick={syncNow} disabled={status?.syncing}>
            {status?.syncing ? "Syncing…" : "Sync now"}
          </button>
          {onSignOut && (
            <button className="btn ghost" onClick={onSignOut} title="Sign out">
              Sign out
            </button>
          )}
        </div>
      </header>

      {error && <div className="card" style={{ marginBottom: 20, color: "var(--bad)" }}>Can't reach the backend: {error}</div>}
      {status?.last_error && (
        <div className="card" style={{ marginBottom: 20, fontSize: 13 }}>
          <b>Garmin sync error:</b> <span className="ink2">{status.last_error}</span>
        </div>
      )}

      {tab === "today" ? (
        <TodayView refreshKey={refreshKey} />
      ) : tab === "run" || tab === "ride" || tab === "swim" ? (
        <SportView sport={tab} refreshKey={refreshKey} />
      ) : (
        <main className="grid">
          <SleepCard nights={nights} />
          <ReadinessCard data={readiness} />
          <TrainingCalendar planned={upcoming.events} refreshKey={refreshKey} />
          <UpcomingCard events={upcoming.events} configured={upcoming.configured} />
        </main>
      )}
    </div>
  );
}

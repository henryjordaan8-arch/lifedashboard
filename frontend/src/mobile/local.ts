/**
 * The phone app's stand-in for the backend: answers the same /api/... requests the
 * dashboard makes, from the data kept on the phone (data.ts) and your calendars.
 */
import { AUTH_EVENT } from "../api";
import type { Status } from "../types";
import { eventsBetween, isCall, sources } from "./calendar";
import * as data from "./data";
import { SignInNeeded } from "./garmin";
import { buildReadiness } from "./readiness";
import { addDaysIso } from "./sport";

const SYNC_EVERY_MS = 60 * 60 * 1000;
let lastError: string | null = null;

async function runSync(): Promise<void> {
  try {
    await data.sync();
    lastError = null;
  } catch (e) {
    if (e instanceof SignInNeeded) window.dispatchEvent(new Event(AUTH_EVENT));
    lastError = e instanceof Error ? e.message : String(e);
  }
}

function status(): Status {
  return {
    mode: "garmin",
    syncing: data.syncing(),
    last_sync: data.lastSync(),
    last_error: lastError,
    calendar_configured: sources().length > 0,
    version: __APP_VERSION__,
  };
}

export async function localGet(path: string): Promise<unknown> {
  const url = new URL(path, "http://x");
  const q = url.searchParams;
  const today = data.today();
  const num = (k: string, d: number) => Number(q.get(k) ?? d);

  switch (url.pathname) {
    case "/api/status": {
      // Opening the app (the dashboard polls status) syncs when the data is over an hour old.
      const last = data.lastSync();
      if (!data.syncing() && (!last || Date.now() - new Date(last).getTime() > SYNC_EVERY_MS)) void runSync();
      return status();
    }
    case "/api/sync":
      await runSync();
      return status();
    case "/api/sleep": {
      const from = addDaysIso(today, -(num("days", 30) - 1));
      const nights = Object.entries(data.daily())
        .filter(([d, x]) => d >= from && x.sleep)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([, x]) => ({ ...x.sleep, hrv: x.hrv, body_battery_wake: x.stats?.body_battery_wake ?? null }));
      return { nights };
    }
    case "/api/readiness":
      return buildReadiness(today, data.daily(), data.activitiesWithDecoupling(),
        data.daily()[today]?.readiness ?? null, data.vo2ByDay());
    case "/api/activities":
      return { activities: data.activitiesBetween(q.get("start") ?? today, q.get("end") ?? today) };
    case "/api/upcoming": {
      if (!sources().length) return { configured: false, events: [], highlights: [] };
      const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const ahead = (await eventsBetween(today, addDaysIso(today, num("days", 14))))
        .filter((e) => e.all_day || e.end >= now)
        .map((e) => ({ ...e, is_call: isCall(e.title) }));
      return {
        configured: true,
        events: ahead.filter((e) => e.category === "training"),
        highlights: ahead.filter((e) => (e.category === "training" && e.key_reason) || e.is_call),
      };
    }
    case "/api/events": {
      const cat = q.get("category");
      const events = await eventsBetween(q.get("start") ?? today, addDaysIso(q.get("end") ?? today, 1));
      return { events: events.filter((e) => !cat || e.category === cat) };
    }
  }
  const sport = url.pathname.match(/^\/api\/sport\/(run|ride|swim)$/);
  if (sport) return data.sportData(sport[1] as "run" | "ride" | "swim", num("days", 182));
  throw new Error(`Not available in the app: ${url.pathname}`);
}

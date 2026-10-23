/**
 * The phone app's stand-in for the backend: answers the same /api/... requests the
 * dashboard makes, from the data kept on the phone (data.ts) and your calendars.
 */
import { AUTH_EVENT } from "../api";
import type { Status } from "../types";
import { eventsBetween, isCall, sources } from "./calendar";
import * as data from "./data";
import { SignInNeeded } from "./garmin";
import { dayPlan, evaluateGoal, GOALS, keySessions } from "./planner";
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

const MANUAL_KEY = "ld.week.manual"; // ticks for "manual" goals: { "<week start>:<goal id>": true }
function manualTicks(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(MANUAL_KEY) ?? "{}");
  } catch {
    return {};
  }
}

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const mondayOf = (iso: string) => addDaysIso(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

async function week(day: string) {
  const ws = mondayOf(day), we = addDaysIso(ws, 6);
  const events = sources().length ? await eventsBetween(ws, addDaysIso(we, 1)) : [];
  const daily = data.daily();
  const sleepByDay: Record<string, { duration_s: number; score: number | null } | null> = {};
  const stepsByDay: Record<string, number | null> = {};
  for (let d = ws; d <= we; d = addDaysIso(d, 1)) {
    if (!daily[d]) continue;
    sleepByDay[d] = daily[d].sleep;
    stepsByDay[d] = daily[d].stats?.steps ?? null;
  }
  const ticks = manualTicks();
  const manual = Object.fromEntries(GOALS.map((g) => [g.id, !!ticks[`${ws}:${g.id}`]]));
  const now = new Date();
  return {
    week_start: ws,
    week_end: we,
    using_example: false,
    goals: GOALS.map((g) => evaluateGoal(g, {
      weekStart: ws, now, nowIso: nowLocal(), activities: data.activitiesBetween(ws, we), events, sleepByDay, stepsByDay, manual,
    })),
  };
}

export async function localGet(path: string, init?: RequestInit): Promise<unknown> {
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
      return { nights }; // no routine on the phone: the dashboard uses its default sleep targets
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
    case "/api/day": {
      const d = q.get("date") ?? today;
      const events = sources().length ? await eventsBetween(d, addDaysIso(d, 1)) : [];
      return { ...dayPlan(d, events, data.activitiesBetween(d, d)), configured: sources().length > 0 };
    }
    case "/api/key-sessions":
      return { events: keySessions(sources().length ? await eventsBetween(today, addDaysIso(today, num("days", 21))) : [], nowLocal()) };
    case "/api/week":
      return week(q.get("date") ?? today);
    case "/api/week/manual": {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const ticks = manualTicks();
      ticks[`${mondayOf(body.week_start)}:${body.goal_id}`] = !!body.done;
      localStorage.setItem(MANUAL_KEY, JSON.stringify(ticks));
      return week(body.week_start);
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

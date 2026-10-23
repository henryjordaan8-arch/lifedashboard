/**
 * The phone app's data, kept on the phone (localStorage) and topped up from Garmin
 * on each sync: the last year of activities and VO₂ max, the last 91 days of sleep,
 * HRV, daily stats and Garmin's readiness, and lap splits of recent runs and rides.
 * Mirrors backend/app/garmin.py's sync.
 */
import type { SportData, SportKey } from "../types";
import { garminGet } from "./garmin";
import * as normalize from "./normalize";
import type { DayData } from "./readiness";
import { addDaysIso, normalizeActivity, normalizeVo2, sportView } from "./sport";

export const HISTORY_DAYS = 365;
const DAILY_DAYS = 91; // readiness baselines need ~2 months of nights
const SPLITS_DAYS = 60;
const RECENT_DAYS = 2; // re-fetched every sync: Garmin keeps revising them
const PAGE = 100;
const VO2_CHUNK_DAYS = 31;
const PARALLEL = 4;
const KEY = "ld.mobile.data.v2";

type Activity = Record<string, any>;
interface Daily extends DayData { readiness: normalize.GarminReadiness | null }
interface Cache {
  activities: Activity[];
  vo2: { date: string; run: number | null; ride: number | null }[];
  daily: Record<string, Daily>;
  decoupling: Record<string, number | null>; // activity id -> %, null when splits had none
  syncedUntil: string | null;
  syncedFrom: string | null;
  lastSync: string | null; // ISO timestamp
}

const empty = (): Cache => ({
  activities: [], vo2: [], daily: {}, decoupling: {}, syncedUntil: null, syncedFrom: null, lastSync: null,
});

function read(): Cache {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return empty();
  }
}
let cache = read();
localStorage.removeItem("ld.mobile.data"); // first version's sports-only cache

export const lastSync = () => cache.lastSync;
export const hasData = () => cache.syncedUntil != null;
export function clearData() {
  cache = empty();
  displayName = null;
  localStorage.removeItem(KEY);
}

export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Run `fn` over `items`, a few at a time. */
async function pool<T>(items: T[], fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function fetchActivities(start: string, end: string): Promise<Activity[]> {
  const out: Activity[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await garminGet<Record<string, unknown>[]>("/activitylist-service/activities/search/activities", {
      startDate: start, endDate: end, start: String(offset), limit: String(PAGE),
    });
    if (!Array.isArray(page) || !page.length) break;
    for (const raw of page) {
      const a = normalizeActivity(raw);
      if (a) out.push(a);
    }
    if (page.length < PAGE) break;
  }
  return out;
}

async function fetchVo2(start: string, end: string): Promise<Cache["vo2"]> {
  const out: Cache["vo2"] = [];
  for (let from = start; from <= end; from = addDaysIso(from, VO2_CHUNK_DAYS)) {
    const to = addDaysIso(from, VO2_CHUNK_DAYS - 1) < end ? addDaysIso(from, VO2_CHUNK_DAYS - 1) : end;
    const raw = await garminGet<unknown>(`/metrics-service/metrics/maxmet/daily/${from}/${to}`);
    for (const entry of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      const v = entry && typeof entry === "object" ? normalizeVo2(entry as Record<string, unknown>) : null;
      if (v) out.push(v);
    }
  }
  return out;
}

let displayName: string | null = null;
async function userName(): Promise<string> {
  if (!displayName) {
    const prof = await garminGet<{ displayName?: string }>("/userprofile-service/socialProfile");
    if (!prof?.displayName) throw new Error("Couldn't read your Garmin profile");
    displayName = prof.displayName;
  }
  return displayName;
}

/** Sleep, HRV, daily summary and Garmin readiness for one day. A failed part is left empty. */
async function fetchDay(day: string): Promise<Daily> {
  const name = await userName();
  const get = (path: string, params?: Record<string, string>) => garminGet<any>(path, params).catch(() => null);
  const [sleep, hrv, stats, ready] = await Promise.all([
    get(`/wellness-service/wellness/dailySleepData/${name}`, { date: day, nonSleepBufferMinutes: "60" }),
    get(`/hrv-service/hrv/${day}`),
    get(`/usersummary-service/usersummary/daily/${name}`, { calendarDate: day }),
    get(`/metrics-service/metrics/trainingreadiness/${day}`),
  ]);
  return {
    sleep: normalize.sleep(day, sleep),
    hrv: normalize.hrv(day, hrv),
    stats: normalize.stats(day, stats),
    readiness: normalize.readiness(day, ready),
  };
}

let running: Promise<void> | null = null;
export const syncing = () => running != null;

/** Fetch what's missing. The first sync pulls everything; later ones just the last few days. */
export function sync(): Promise<void> {
  running ??= doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<void> {
  const end = today();
  const want = addDaysIso(end, -(HISTORY_DAYS - 1));
  const ranges: [string, string][] = [];
  if (!cache.syncedUntil) ranges.push([want, end]);
  else {
    ranges.push([addDaysIso(cache.syncedUntil, -RECENT_DAYS), end]);
    if (cache.syncedFrom && want < cache.syncedFrom) ranges.push([want, cache.syncedFrom]);
  }

  const byId = new Map(cache.activities.map((a) => [a.id, a]));
  const vo2ByDate = new Map(cache.vo2.map((v) => [v.date, v]));
  for (const [start, stop] of ranges) {
    for (const a of await fetchActivities(start, stop)) byId.set(a.id, a);
    for (const v of await fetchVo2(start, stop)) vo2ByDate.set(v.date, v);
  }
  const activities = [...byId.values()].filter((a) => a.date >= want);

  const daily: Cache["daily"] = {};
  const dailyFrom = addDaysIso(end, -(DAILY_DAYS - 1));
  const recentFrom = addDaysIso(end, -RECENT_DAYS);
  const todo: string[] = [];
  for (let d = dailyFrom; d <= end; d = addDaysIso(d, 1)) {
    if (cache.daily[d] && d < recentFrom) daily[d] = cache.daily[d];
    else todo.push(d);
  }
  await pool(todo, async (d) => {
    daily[d] = await fetchDay(d);
  });

  // Lap splits → aerobic decoupling, once per recent run/ride.
  const decoupling: Cache["decoupling"] = {};
  const splitsFrom = addDaysIso(end, -SPLITS_DAYS);
  const need = activities.filter((a) => (a.sport === "run" || a.sport === "ride") && a.date >= splitsFrom);
  for (const a of need) if (String(a.id) in cache.decoupling) decoupling[a.id] = cache.decoupling[a.id];
  await pool(need.filter((a) => !(String(a.id) in decoupling)), async (a) => {
    try {
      decoupling[a.id] = normalize.decoupling(await garminGet(`/activity-service/activity/${a.id}/splits`), a.sport);
    } catch {
      /* try again next sync */
    }
  });

  cache = {
    activities,
    vo2: [...vo2ByDate.values()].filter((v) => v.date >= want).sort((a, b) => (a.date < b.date ? -1 : 1)),
    daily,
    decoupling,
    syncedUntil: end,
    syncedFrom: want,
    lastSync: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(cache));
}

// ---------- read side (used by local.ts) ----------

export const activitiesBetween = (start: string, end: string) =>
  cache.activities.filter((a) => a.date >= start && a.date <= end).sort((a, b) => (a.start < b.start ? -1 : 1));

export function activitiesWithDecoupling(): Activity[] {
  return cache.activities.map((a) => (String(a.id) in cache.decoupling ? { ...a, decoupling: cache.decoupling[a.id] } : a));
}

export const daily = () => cache.daily;
export const vo2ByDay = () => Object.fromEntries(cache.vo2.map((v) => [v.date, { run: v.run, ride: v.ride }]));

export function sportData(sport: SportKey, days: number): SportData {
  const end = today();
  const start = addDaysIso(end, -(days - 1));
  const vo2 =
    sport === "swim"
      ? []
      : cache.vo2.filter((v) => v[sport] != null).map((v) => ({ date: v.date, value: v[sport] as number }));
  return sportView(sport, cache.activities, vo2, start, end);
}

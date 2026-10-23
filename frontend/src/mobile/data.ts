/**
 * The phone app's data: the last year of Garmin activities and VO₂ max, kept on the
 * phone (localStorage) and topped up from Garmin on each sync.
 */
import type { SportData, SportKey } from "../types";
import { garminGet } from "./garmin";
import { addDaysIso, normalizeActivity, normalizeVo2, sportView } from "./sport";

export const HISTORY_DAYS = 365;
const RECENT_DAYS = 2; // re-fetched every sync: Garmin keeps revising them
const PAGE = 100;
const VO2_CHUNK_DAYS = 31;
const KEY = "ld.mobile.data";

type Activity = Record<string, any>;
interface Cache {
  activities: Activity[];
  vo2: { date: string; run: number | null; ride: number | null }[];
  syncedUntil: string | null;
  syncedFrom: string | null;
  lastSync: string | null; // ISO timestamp
}

const empty = (): Cache => ({ activities: [], vo2: [], syncedUntil: null, syncedFrom: null, lastSync: null });

function read(): Cache {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return empty();
  }
}
let cache = read();

export const lastSync = () => cache.lastSync;
export const hasData = () => cache.syncedUntil != null;
export function clearData() {
  cache = empty();
  localStorage.removeItem(KEY);
}

export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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

/** Fetch what's missing. The first sync pulls the whole year; later ones just the last few days. */
export async function sync(): Promise<void> {
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

  cache = {
    activities: [...byId.values()].filter((a) => a.date >= want && ["run", "ride", "swim"].includes(a.sport)),
    vo2: [...vo2ByDate.values()].filter((v) => v.date >= want).sort((a, b) => (a.date < b.date ? -1 : 1)),
    syncedUntil: end,
    syncedFrom: want,
    lastSync: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(cache));
}

export function sportData(sport: SportKey, days: number): SportData {
  const end = today();
  const start = addDaysIso(end, -(days - 1));
  const vo2 =
    sport === "swim"
      ? []
      : cache.vo2.filter((v) => v[sport] != null).map((v) => ({ date: v.date, value: v[sport] as number }));
  return sportView(sport, cache.activities, vo2, start, end);
}

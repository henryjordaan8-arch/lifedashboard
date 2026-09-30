import type { Activity, CalEvent, DayPlan, Readiness, SleepNight, SportData, SportKey, Status, Week } from "./types";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  status: () => get<Status>("/api/status"),
  sync: () => get<Status>("/api/sync", { method: "POST" }),
  sleep: (days: number) => get<{ nights: SleepNight[] }>(`/api/sleep?days=${days}`).then((r) => r.nights),
  activities: (start: string, end: string) =>
    get<{ activities: Activity[] }>(`/api/activities?start=${start}&end=${end}`).then((r) => r.activities),
  upcoming: (days: number) => get<{ configured: boolean; events: CalEvent[] }>(`/api/upcoming?days=${days}`),
  readiness: () => get<Readiness>("/api/readiness"),
  sport: (name: SportKey, days: number) => get<SportData>(`/api/sport/${name}?days=${days}`),
  day: (date: string) => get<DayPlan>(`/api/day?date=${date}`),
  keySessions: (days: number) => get<{ events: CalEvent[] }>(`/api/key-sessions?days=${days}`).then((r) => r.events),
  week: (date: string) => get<Week>(`/api/week?date=${date}`),
  tick: (week_start: string, goal_id: string, done: boolean) =>
    get<Week>("/api/week/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start, goal_id, done }),
    }),
};

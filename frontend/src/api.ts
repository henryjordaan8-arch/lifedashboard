import type { Activity, PlannedSession, Readiness, SleepNight, Status } from "./types";

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
  upcoming: (days: number) => get<{ configured: boolean; events: PlannedSession[] }>(`/api/upcoming?days=${days}`),
  readiness: () => get<Readiness>("/api/readiness"),
};

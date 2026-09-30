import { isUnlocked, resume, STATIC, staticGet, unlock } from "./static";
import type { Activity, CalEvent, DayPlan, Readiness, SleepNight, SportData, SportKey, Status, Week } from "./types";

/** Fired when the server says the login has expired, so the app can show the login screen. */
export const AUTH_EVENT = "lifedashboard:login-required";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  if (STATIC) {
    if (!isUnlocked() && path !== "/api/session" && path !== "/api/logout") {
      window.dispatchEvent(new Event(AUTH_EVENT));
    }
    return staticGet(path, init) as Promise<T>;
  }
  const res = await fetch(path, { credentials: "same-origin", ...init });
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT));
    throw new Error("Please sign in");
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  get<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const api = {
  session: async () => {
    if (STATIC && !isUnlocked()) await resume(); // a remembered device signs in silently
    return get<{ auth_required: boolean; logged_in: boolean }>("/api/session");
  },
  logout: () => post<{ logged_in: boolean }>("/api/logout"),
  /** Returns an error message, or null on success. */
  login: async (password: string): Promise<string | null> => {
    if (STATIC) return unlock(password);
    const res = await fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return null;
    const detail = await res.json().catch(() => null);
    return detail?.detail ?? `Sign-in failed (${res.status})`;
  },
  status: () => get<Status>("/api/status"),
  sync: () => get<Status>("/api/sync", { method: "POST" }),
  sleep: (days: number) => get<{ nights: SleepNight[] }>(`/api/sleep?days=${days}`).then((r) => r.nights),
  activities: (start: string, end: string) =>
    get<{ activities: Activity[] }>(`/api/activities?start=${start}&end=${end}`).then((r) => r.activities),
  upcoming: (days: number) =>
    get<{ configured: boolean; events: CalEvent[]; highlights?: CalEvent[] }>(`/api/upcoming?days=${days}`),
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

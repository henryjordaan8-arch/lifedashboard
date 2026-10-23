/**
 * The Today view on the phone: day plan, key sessions and the weekly checklist.
 * Port of backend/app/planner.py; keep them in step. Your routine and goals are
 * built into the app from backend/routine.json and backend/goals.json.
 */
import goalsFile from "../../../backend/goals.json";
import routineFile from "../../../backend/routine.json";
import type { CalEvent, Category } from "../types";

type Act = Record<string, any>;
type Ev = CalEvent & Record<string, any>;

const CATEGORIES: Category[] = ["training", "work", "study", "reading", "personal", "other"];
const MATCH_WINDOW_H = 4; // a Garmin activity within this many hours of a planned session completes it

interface Routine {
  day_start: string;
  day_end: string;
  markers: { title: string; at: string }[];
  blocks: { title: string; start: string; end: string; category?: string }[];
}
export const ROUTINE: Routine = { day_start: "05:00", day_end: "21:00", markers: [], blocks: [], ...(routineFile as Partial<Routine>) };
export const GOALS = ((goalsFile as { goals?: Record<string, any>[] }).goals ?? []) as Record<string, any>[];

const dt = (iso: string) => new Date(iso.includes("T") ? iso : `${iso}T00:00`);
const hoursBetween = (a: string, b: string) => (dt(b).getTime() - dt(a).getTime()) / 3_600_000;
export const eventHours = (e: Ev) => (e.all_day ? 0 : Math.max(0, hoursBetween(e.start, e.end)));
const sportsMatch = (planned: string | null | undefined, actual: string) =>
  planned == null || planned === "other" || actual === "other" || planned === actual;

/** Mark planned training events as completed by the closest same-day Garmin activity. */
function matchActivities(events: Ev[], activities: Act[]) {
  const used = new Set<number>();
  for (const ev of events) {
    ev.completed_by = null;
    if (ev.category !== "training") continue;
    let best: [number, Act] | null = null;
    for (const a of activities) {
      if (used.has(a.id) || a.date !== ev.start.slice(0, 10) || !sportsMatch(ev.sport, a.sport)) continue;
      const gap = Math.abs(hoursBetween(ev.start, a.start));
      if ((ev.all_day || gap <= MATCH_WINDOW_H) && (!best || gap < best[0])) best = [gap, a];
    }
    if (best) {
      const a = best[1];
      used.add(a.id);
      ev.completed_by = { id: a.id, name: a.name, start: a.start, duration_s: a.duration_s, distance_m: a.distance_m };
    }
  }
}

function routineEvents(day: string): Ev[] {
  return ROUTINE.blocks.map((b, i) => ({
    id: `routine-${day}-${i}`, title: b.title, start: `${day}T${b.start}`, end: `${day}T${b.end}`, all_day: false,
    category: (b.category ?? "personal") as Category, sport: null, key_reason: null, description: null, location: null,
    source: "routine",
  }));
}

export function dayPlan(day: string, events: Ev[], activities: Act[]) {
  const winStart = `${day}T${ROUTINE.day_start}`, winEnd = `${day}T${ROUTINE.day_end}`;
  const todays = [
    ...events.filter((e) =>
      (!e.all_day && e.start.slice(0, 10) <= day && day <= e.end.slice(0, 10) && e.start < winEnd && e.end > winStart) ||
      (e.all_day && e.start <= day && day < e.end)),
    ...routineEvents(day),
  ].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const acts = activities.filter((a) => a.date === day);
  matchActivities(todays, acts);
  const hours = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const e of todays) hours[e.category] += eventHours(e);
  for (const c of CATEGORIES) hours[c] = Math.round(hours[c] * 100) / 100;
  const matched = new Set(todays.flatMap((e) => (e.completed_by ? [e.completed_by.id] : [])));
  return {
    date: day,
    window: { start: ROUTINE.day_start, end: ROUTINE.day_end },
    markers: ROUTINE.markers.map((m) => ({ title: m.title, at: m.at })),
    events: todays,
    hours,
    unplanned_activities: acts.filter((a) => !matched.has(a.id)),
  };
}

export const keySessions = (events: Ev[], nowIso: string) =>
  events.filter((e) => e.key_reason && (e.all_day || e.end >= nowIso)).sort((a, b) => (a.start < b.start ? -1 : 1));

// ---------- weekly goals ----------

const UNITS: Record<string, string> = {
  activity_count: "sessions", activity_hours: "h", activity_km: "km", calendar_hours: "h",
  calendar_count: "sessions", sleep_nights: "nights", step_days: "days", manual: "",
};

const asList = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : null) as string[] | null;

export function evaluateGoal(
  goal: Record<string, any>,
  o: { weekStart: string; now: Date; nowIso: string; activities: Act[]; events: Ev[];
    sleepByDay: Record<string, { duration_s: number; score: number | null } | null>;
    stepsByDay: Record<string, number | null>; manual: Record<string, boolean> },
) {
  let metric: string = goal.metric ?? "manual";
  let target = Number(goal.target ?? 1);
  const atMost = goal.mode === "at_most";
  let progress = 0, planned = 0;
  const items: string[] = [];

  if (["activity_count", "activity_hours", "activity_km"].includes(metric)) {
    const sports = asList(goal.sport);
    const name = String(goal.name_contains ?? "").toLowerCase();
    const minS = (goal.min_minutes ?? 0) * 60;
    for (const a of o.activities) {
      if ((sports && !sports.includes(a.sport)) || (name && !a.name.toLowerCase().includes(name)) || (a.duration_s ?? 0) < minS) continue;
      progress += metric === "activity_count" ? 1 : metric === "activity_hours" ? (a.duration_s ?? 0) / 3600 : (a.distance_m ?? 0) / 1000;
      items.push(`${a.date} · ${a.name}`);
    }
    if (metric === "activity_count") {
      planned = o.events.filter((e) => e.category === "training" && e.end > o.nowIso && (!sports || sports.includes(e.sport ?? ""))).length;
    }
  } else if (metric === "calendar_hours" || metric === "calendar_count") {
    const kw = String(goal.title_contains ?? "").toLowerCase();
    for (const e of o.events) {
      if ((goal.category && e.category !== goal.category) || (kw && !e.title.toLowerCase().includes(kw))) continue;
      const amount = metric === "calendar_count" ? 1 : eventHours(e);
      if (e.end <= o.nowIso) {
        progress += amount;
        items.push(`${e.start.slice(0, 10)} · ${e.title}`);
      } else planned += amount;
    }
  } else if (metric === "sleep_nights") {
    for (const [day, n] of Object.entries(o.sleepByDay).sort()) {
      if (n && n.duration_s / 3600 >= (goal.min_hours ?? 0) && (n.score ?? 0) >= (goal.min_score ?? 0)) {
        progress += 1;
        items.push(`${day} · ${(n.duration_s / 3600).toFixed(1)} h`);
      }
    }
  } else if (metric === "step_days") {
    for (const [day, steps] of Object.entries(o.stepsByDay).sort()) {
      if (steps && steps >= (goal.min_steps ?? 10000)) {
        progress += 1;
        items.push(`${day} · ${steps.toLocaleString("en-US")} steps`);
      }
    }
  } else {
    metric = "manual";
    progress = o.manual[goal.id] ? 1 : 0;
    target = 1;
  }

  const elapsed = Math.min(1, Math.max(0, (o.now.getTime() - dt(o.weekStart).getTime()) / (7 * 86_400_000)));
  const weekOver = elapsed >= 1;
  let status: string, done: boolean;
  if (atMost) {
    status = progress > target ? "over" : weekOver ? "done" : "on_track";
    done = progress <= target && weekOver;
  } else {
    done = progress >= target;
    status = done ? "done" : metric === "manual" ? "todo"
      : progress + planned >= target || progress >= target * elapsed ? "on_track" : "behind";
  }
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    id: goal.id, label: goal.label ?? goal.id, metric, mode: atMost ? "at_most" : "at_least",
    unit: goal.unit ?? UNITS[metric] ?? "", target, progress: r1(progress), planned: r1(planned), done, status, items,
  };
}

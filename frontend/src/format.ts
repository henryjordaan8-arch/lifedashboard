import type { Sport } from "./types";

export const SPORT_LABEL: Record<Sport, string> = {
  run: "Run",
  ride: "Ride",
  swim: "Swim",
  strength: "Strength",
  other: "Other",
};

export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${String(mm).padStart(2, "0")}m`;
}

export function km(meters: number | null | undefined, digits = 1): string {
  if (meters == null) return "—";
  return `${(meters / 1000).toFixed(digits)} km`;
}

/** min/km for runs, min/100m for swims, km/h for rides. */
export function pace(sport: Sport, meters: number | null, seconds: number | null): string | null {
  if (!meters || !seconds) return null;
  if (sport === "run") {
    const s = seconds / (meters / 1000);
    return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")} /km`;
  }
  if (sport === "swim") {
    const s = seconds / (meters / 100);
    return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")} /100m`;
  }
  if (sport === "ride") return `${((meters / 1000) / (seconds / 3600)).toFixed(1)} km/h`;
  return null;
}

export function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(11, 16);
}

/** Parse "YYYY-MM-DD" as a local date (not UTC). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function relativeDay(day: string, today = new Date()): string {
  const diff = Math.round((parseDay(day).getTime() - parseDay(isoDay(today)).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return parseDay(day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

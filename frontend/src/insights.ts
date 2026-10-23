/**
 * Dashboard trends computed in the browser from sleep and activities, so they work the
 * same against the backend, the GitHub Pages snapshot and the phone app.
 */
import { addDays, isoDay, parseDay } from "./format";
import { keyReason } from "./mobile/sport";
import type { Activity, SleepNight } from "./types";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const shift = (iso: string, n: number) => isoDay(addDays(parseDay(iso), n));

// ---------- what predicts your good days ----------

const BASELINE_DAYS = 42; // a session is compared with your same-sport sessions of the 6 weeks before
const MIN_BASELINE = 3;
export const MIN_PAIRS = 8;

/** Output per heartbeat: m/min per bpm (run) or watts per bpm (ride). */
function efficiency(a: Activity): number | null {
  const hr = a.avg_hr, secs = a.moving_s || a.duration_s;
  if (!hr) return null;
  if (a.sport === "run") return a.distance_m && secs ? a.distance_m / (secs / 60) / hr : null;
  if (a.sport === "ride") {
    const p = a.norm_power || a.avg_power;
    return p ? p / hr : null;
  }
  return null;
}

export interface Factor {
  key: string;
  label: string;
  unit: string;
  /** Pearson correlation between the factor and session quality */
  r: number;
  n: number;
  /** Mean session quality (% vs normal) in the top third of the factor minus the bottom third */
  spread: number;
}

export interface Insights {
  sessions: number;
  factors: Factor[];
}

function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/**
 * Session quality = efficiency of a steady (non-key) run or ride vs your normal for that
 * sport, in %. Each factor is what things looked like that morning.
 */
export function goodDayInsights(nights: SleepNight[], activities: Activity[]): Insights {
  const night = new Map(nights.map((n) => [n.date, n]));
  const hrvOf = (d: string) => night.get(d)?.hrv?.last_night ?? night.get(d)?.avg_hrv ?? null;
  const rhrOf = (d: string) => night.get(d)?.resting_hr ?? null;
  const loadOn = new Map<string, number>();
  for (const a of activities) if (a.training_load) loadOn.set(a.date, (loadOn.get(a.date) ?? 0) + a.training_load);
  const loadBetween = (from: number, to: number, d: string) => {
    let t = 0;
    for (let i = from; i <= to; i++) t += loadOn.get(shift(d, -i)) ?? 0;
    return t;
  };
  const avgOf = (get: (d: string) => number | null, d: string, days: number, min: number) => {
    const v: number[] = [];
    for (let i = 1; i <= days; i++) {
      const x = get(shift(d, -i));
      if (x != null) v.push(x);
    }
    return v.length >= min ? mean(v) : null;
  };

  const steady = activities
    .filter((a) => (a.sport === "run" || a.sport === "ride") && !keyReason(a.name, a.sport))
    .map((a) => ({ a, eff: efficiency(a) }))
    .filter((x): x is { a: Activity; eff: number } => x.eff != null);

  const rows: { quality: number; f: Record<string, number | null> }[] = [];
  for (const { a, eff } of steady) {
    const from = shift(a.date, -BASELINE_DAYS);
    const base = steady.filter((x) => x.a.sport === a.sport && x.a.date >= from && x.a.date < a.date).map((x) => x.eff);
    if (base.length < MIN_BASELINE || !night.has(a.date)) continue;
    const sorted = [...base].sort((p, q) => p - q);
    const med = sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const hrv = hrvOf(a.date), hrvBase = avgOf(hrvOf, a.date, 60, 14);
    const rhr = rhrOf(a.date), rhrBase = avgOf(rhrOf, a.date, 7, 4);
    rows.push({
      quality: (eff / med - 1) * 100,
      f: {
        sleep: night.get(a.date)?.score ?? null,
        hrv: hrv != null && hrvBase ? (hrv / hrvBase - 1) * 100 : null,
        rhr: rhr != null && rhrBase != null ? rhr - rhrBase : null,
        battery: night.get(a.date)?.body_battery_wake ?? null,
        load1: loadBetween(1, 1, a.date),
        load7: loadBetween(1, 7, a.date),
      },
    });
  }

  const FACTORS = [
    { key: "sleep", label: "Sleep score that night", unit: "" },
    { key: "hrv", label: "HRV vs your 60-day normal", unit: "%" },
    { key: "rhr", label: "Resting HR vs your week", unit: " bpm" },
    { key: "battery", label: "Body Battery at wake", unit: "" },
    { key: "load1", label: "Training load the day before", unit: "" },
    { key: "load7", label: "Training load, previous 7 days", unit: "" },
  ];
  const factors: Factor[] = [];
  for (const f of FACTORS) {
    const pairs = rows.filter((r) => r.f[f.key] != null).map((r) => [r.f[f.key] as number, r.quality]);
    if (pairs.length < MIN_PAIRS) continue;
    const r = pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
    const byX = [...pairs].sort((p, q) => p[0] - q[0]);
    const third = Math.max(1, Math.floor(byX.length / 3));
    const spread = mean(byX.slice(-third).map((p) => p[1])) - mean(byX.slice(0, third).map((p) => p[1]));
    factors.push({ ...f, r, n: pairs.length, spread });
  }
  factors.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return { sessions: rows.length, factors };
}

export const strength = (r: number) => {
  const a = Math.abs(r);
  return a < 0.1 ? "no link" : a < 0.3 ? "weak" : a < 0.5 ? "moderate" : "strong";
};

// ---------- 80/20 intensity balance ----------

export interface IntensityWeek {
  week_start: string;
  easy_s: number; // Z1–2
  moderate_s: number; // Z3
  hard_s: number; // Z4–5
}

/** Weekly time in heart-rate zones across every sport, oldest first. */
export function intensityWeeks(activities: Activity[], weeks: number, today = new Date()): IntensityWeek[] {
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const out: IntensityWeek[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ week_start: isoDay(addDays(monday, -7 * i)), easy_s: 0, moderate_s: 0, hard_s: 0 });
  const byStart = new Map(out.map((w) => [w.week_start, w]));
  for (const a of activities) {
    const z = a.hr_zones_s;
    if (!z) continue;
    const d = parseDay(a.date);
    const w = byStart.get(isoDay(addDays(d, -((d.getDay() + 6) % 7))));
    if (!w) continue;
    w.easy_s += z[0] + z[1];
    w.moderate_s += z[2];
    w.hard_s += z[3] + z[4];
  }
  return out;
}

/**
 * Readiness on the phone: port of backend/app/readiness.py (context), scoring.py
 * (v2 score + alerts) and the /api/readiness endpoint in main.py. Keep them in step.
 */
import type { Alert, Readiness, ScoreComponent } from "../types";
import type { GarminReadiness, Hrv, Night, Stats } from "./normalize";
import { activityKey, addDaysIso } from "./sport";

type Act = Record<string, any>;
type Band = [number, number, number, number];
export interface DayData { sleep: Night | null; hrv: Hrv | null; stats: Stats | null }

const fmean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const stdev = (xs: number[]) => {
  const m = fmean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const f = (v: number, d = 0) => v.toFixed(d);
const sf = (v: number, d = 0) => (v >= 0 ? "+" : "") + v.toFixed(d);
const present = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => x != null);
const mean = (xs: (number | null | undefined)[], minN = 1) => {
  const v = present(xs);
  return v.length >= minN ? fmean(v) : null;
};
const sd = (xs: (number | null | undefined)[]) => {
  const v = present(xs);
  return v.length >= 3 ? stdev(v) : null;
};
/** n ISO dates ending `offset` days before `end` (oldest first). */
const daysBack = (end: string, n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => addDaysIso(end, -(offset + n - 1 - i)));

// ---------- readiness.py ----------

const BASELINE_DAYS = 28, MIN_BASELINE_POINTS = 7, HISTORY_DAYS = 14;
const INPUTS: [string, string, string, number][] = [
  ["hrv", "Overnight HRV", "ms", 1],
  ["resting_hr", "Resting heart rate", "bpm", -1],
  ["sleep_score", "Sleep score", "", 1],
  ["sleep_hours", "Sleep duration", "h", 1],
  ["body_battery", "Body Battery at wake", "", 1],
  ["sleep_stress", "Overnight stress", "", -1],
];
const pick = (...vs: (number | null | undefined)[]) => vs.find((v) => v != null) ?? null;

function dailyValues(d: DayData | undefined): Record<string, number | null> {
  const s = d?.sleep, h = d?.hrv, st = d?.stats;
  return {
    hrv: pick(h?.last_night, s?.avg_hrv),
    resting_hr: pick(st?.resting_hr, s?.resting_hr),
    sleep_score: pick(s?.score),
    sleep_hours: s?.duration_s ? round(s.duration_s / 3600, 2) : null,
    body_battery: pick(st?.body_battery_wake, st?.body_battery_high),
    sleep_stress: pick(s?.stress),
  };
}

const HARD = { load: 150, aerobic_te: 4.0, anaerobic_te: 3.0 };
const isHard = (a: Act) =>
  !!activityKey(a) ||
  (a.training_load ?? 0) >= HARD.load || (a.aerobic_te ?? 0) >= HARD.aerobic_te || (a.anaerobic_te ?? 0) >= HARD.anaerobic_te;

function trainingLoad(acts: Act[], today: string) {
  const perDay: Record<string, number> = {};
  for (const a of acts) if (a.training_load) perDay[a.date] = (perDay[a.date] ?? 0) + a.training_load;
  const avg = (n: number) => {
    let t = 0;
    for (let i = 1; i <= n; i++) t += perDay[addDaysIso(today, -i)] ?? 0;
    return t / n;
  };
  const acute = avg(7), chronic = avg(28);
  return {
    acute: round(acute, 1),
    chronic: round(chronic, 1),
    ratio: chronic > 0 ? round(acute / chronic, 2) : null,
    yesterday: round(perDay[addDaysIso(today, -1)] ?? 0, 1),
  };
}

function recentSessions(acts: Act[], today: string) {
  const before = acts.filter((a) => a.date < today).sort((a, b) => (a.start < b.start ? 1 : -1));
  const weekAgo = addDaysIso(today, -7);
  const last7 = before.filter((a) => a.date >= weekAgo);
  const hard = before.find(isHard);
  return {
    sessions_7d: last7.length,
    hard_7d: last7.filter(isHard).length,
    days_since_hard: hard ? Math.round((Date.parse(today) - Date.parse(hard.date)) / 864e5) : null,
    last: before.slice(0, 5).map((a) => ({
      id: a.id, name: a.name, sport: a.sport, date: a.date, duration_s: a.duration_s, distance_m: a.distance_m,
      training_load: a.training_load, aerobic_te: a.aerobic_te, anaerobic_te: a.anaerobic_te, hard: isHard(a),
    })),
  };
}

function fitness(vo2: Record<string, { run: number | null; ride: number | null }>, today: string) {
  const days = Object.keys(vo2).filter((d) => vo2[d].run != null).sort();
  if (!days.length) return null;
  const latest = vo2[days[days.length - 1]];
  const cutoff = addDaysIso(today, -28);
  const older = days.filter((d) => d <= cutoff);
  const ref = older.length ? vo2[older[older.length - 1]] : vo2[days[0]];
  return {
    vo2max_run: latest.run!,
    vo2max_ride: latest.ride,
    as_of: days[days.length - 1],
    change_28d: round(latest.run! - ref.run!, 1),
    history: days.slice(-60).map((d) => ({ date: d, value: vo2[d].run! })),
  };
}

// ---------- scoring.py ----------

// Garmin recovery time never syncs from the current watch, so it's left out of the score
// (the rest is scaled up to 100). Set to true after a watch upgrade to bring it back.
const USE_RECOVERY_TIME = false;

const ALL_COMPONENTS: [string, string, number, Band[]][] = [
  ["hrv", "HRV vs 60-day baseline", 28, [[-30, -15, 0, 7], [-15, -5, 8, 15], [-5, 5, 16, 21], [5, 10, 22, 25], [10, 20, 26, 28]]],
  ["sleep", "Sleep last night", 18, [[20, 45, 0, 3], [45, 60, 4, 7], [60, 75, 8, 12], [75, 90, 13, 16], [90, 100, 17, 18]]],
  ["acwr", "Load ratio (ACWR)", 15,
    [[0.3, 0.5, 0, 3], [0.5, 0.6, 3, 8], [0.6, 0.8, 8, 10], [0.8, 1.0, 14, 15], [1.0, 1.2, 13, 11], [1.2, 1.5, 7, 4], [1.5, 2.0, 3, 0]]],
  ["recovery", "Recovery time", 12, [[0, 1, 12, 11], [1, 12, 11, 9], [12, 24, 8, 6], [24, 48, 5, 2], [48, 72, 1, 0]]],
  ["sleep_history", "Sleep, last 3 nights", 7, [[35, 50, 0, 1], [50, 65, 2, 3], [65, 80, 4, 5], [80, 95, 6, 7]]],
  ["rhr", "Resting HR vs 7-day avg", 5, [[-5, 0, 5, 5], [0, 1, 5, 4], [1, 3, 4, 3], [3, 4, 3, 2], [4, 6, 2, 1], [6, 10, 0, 0]]],
  ["respiration", "Respiration vs 30-day baseline", 5, [[-2, 0, 5, 5], [0, 0.5, 5, 4], [0.5, 1, 4, 3], [1, 2, 2, 1], [2, 4, 0, 0]]],
  ["decoupling", "Aerobic decoupling (7 days)", 4, [[-10, 3, 4, 4], [3, 5, 3, 3], [5, 8, 2, 2], [8, 12, 1, 1], [12, 50, 0, 0]]],
  ["vo2max", "VO₂ max, 14-day trend", 3, [[-20, -5, 0, 0], [-5, -2, 1, 1], [-2, -0.5, 2, 2], [-0.5, 20, 3, 3]]],
  ["stress", "Stress, last 3 days", 3, [[0, 25.5, 3, 3], [25.5, 50.5, 2, 2], [50.5, 75.5, 1, 1], [75.5, 100, 0, 0]]],
];
const COMPONENTS = ALL_COMPONENTS.filter(([key]) => USE_RECOVERY_TIME || key !== "recovery");
const TOTAL_POINTS = COMPONENTS.reduce((t, [, , max]) => t + max, 0);
const BANDS: [number, "high" | "good" | "low" | "rest", string][] = [
  [75, "high", "Ready for a hard session"],
  [55, "good", "Train as planned"],
  [35, "low", "Take it easier today"],
  [0, "rest", "Prioritise recovery"],
];

function banded(x: number, bands: Band[]): number {
  if (x < bands[0][0]) return bands[0][2];
  const lastHi = bands[bands.length - 1][1];
  for (const [lo, hi, pLo, pHi] of bands) {
    if ((lo <= x && x < hi) || (hi === lastHi && x === hi)) return hi > lo ? pLo + ((pHi - pLo) * (x - lo)) / (hi - lo) : pLo;
  }
  return bands[bands.length - 1][3];
}
const status = (pts: number, max: number) => {
  const r = pts / max;
  return r >= 0.75 ? "good" : r >= 0.5 ? "ok" : r >= 0.25 ? "warn" : "bad";
};

function ewmaAcwr(loads: Record<string, number>, end: string, historyDays = 120): [string, number | null][] {
  const la = 2 / 8, lc = 2 / 29;
  const days = daysBack(end, historyDays);
  let acute = fmean(days.slice(0, 28).map((d) => loads[d] ?? 0));
  let chronic = acute;
  return days.map((d) => {
    const x = loads[d] ?? 0;
    acute += la * (x - acute);
    chronic += lc * (x - chronic);
    return [d, chronic > 1 ? round(acute / chronic, 2) : null];
  });
}

function vo2At(vo2: Record<string, number>, day: string, window = 3): number | null {
  const vals = Object.keys(vo2).sort().filter((d) => d <= day).slice(-window).map((d) => vo2[d]);
  return vals.length ? fmean(vals) : null;
}

type Metrics = Record<string, number | null>;

function compute(today: string, days: Record<string, Metrics>, acts: Act[], vo2: Record<string, number>, recoveryH: number | null) {
  const g = (d: string, k: string) => days[d]?.[k] ?? null;
  const raw: Record<string, [number, string, string]> = {};

  const hrvNow = g(today, "hrv"), base = mean(daysBack(today, 60, 1).map((d) => g(d, "hrv")), 14);
  if (hrvNow != null && base) {
    const delta = ((hrvNow - base) / base) * 100;
    raw.hrv = [delta, `${f(hrvNow)} ms`, `${sf(delta)}% vs ${f(base)} ms baseline`];
  }
  const s = g(today, "sleep_score");
  if (s != null) raw.sleep = [s, f(s), "Garmin sleep score"];

  const loads: Record<string, number> = {};
  for (const a of acts) if (a.training_load) loads[a.date] = (loads[a.date] ?? 0) + a.training_load;
  const acwrSeries = ewmaAcwr(loads, addDaysIso(today, -1));
  const ratio = acwrSeries.length ? acwrSeries[acwrSeries.length - 1][1] : null;
  if (ratio != null) raw.acwr = [ratio, f(ratio, 2), "7-day vs 28-day load (EWMA)"];

  if (recoveryH != null && USE_RECOVERY_TIME) raw.recovery = [recoveryH, `${f(recoveryH)} h`, "Garmin recovery time"];

  const sh = mean(daysBack(today, 3).map((d) => g(d, "sleep_score")), 2);
  if (sh != null) raw.sleep_history = [sh, f(sh), "average sleep score, last 3 nights"];

  const rhr = g(today, "rhr"), rhrBase = mean(daysBack(today, 7, 1).map((d) => g(d, "rhr")), 4);
  if (rhr != null && rhrBase != null) {
    const delta = rhr - rhrBase;
    raw.rhr = [delta, `${f(rhr)} bpm`, `${sf(delta, 1)} vs ${f(rhrBase)} bpm 7-day avg`];
  }
  const resp = g(today, "respiration"), respBase = mean(daysBack(today, 30, 1).map((d) => g(d, "respiration")), 7);
  if (resp != null && respBase != null) {
    const delta = resp - respBase;
    raw.respiration = [delta, `${f(resp, 1)} brpm`, `${sf(delta, 1)} vs ${f(respBase, 1)} baseline`];
  }
  const week = addDaysIso(today, -7);
  const dec = acts.filter((a) => a.decoupling != null && !a.key && week <= a.date && a.date <= today).map((a) => a.decoupling);
  if (dec.length) {
    const avg = fmean(dec);
    raw.decoupling = [avg, `${f(avg, 1)}%`, `average of ${dec.length} steady session${dec.length > 1 ? "s" : ""}`];
  }
  const nowV = vo2At(vo2, today), thenV = vo2At(vo2, addDaysIso(today, -14));
  if (nowV && thenV) {
    const pct = ((nowV - thenV) / thenV) * 100;
    raw.vo2max = [pct, f(nowV, 1), `${sf(pct, 1)}% in 14 days`];
  }
  const st = mean(daysBack(today, 3, 1).map((d) => g(d, "stress")), 2);
  if (st != null) raw.stress = [st, f(st), "Garmin average stress, last 3 days"];

  const components: ScoreComponent[] = [];
  let earned = 0, available = 0;
  for (const [key, label, max, bands] of COMPONENTS) {
    if (raw[key]) {
      const [x, text, detail] = raw[key];
      const pts = round(banded(x, bands), 1);
      earned += pts;
      available += max;
      components.push({ key, label, max, points: pts, available: true, value: round(x, 2), value_text: text, detail, status: status(pts, max) } as ScoreComponent);
    } else {
      components.push({ key, label, max, points: null, available: false, value: null, value_text: "—", detail: "no data yet", status: "none" } as ScoreComponent);
    }
  }
  let score: Readiness["score"] = null;
  if (available >= TOTAL_POINTS / 2) {
    const value = Math.round((earned / available) * 100);
    const band = BANDS.find((b) => value >= b[0])!;
    score = { value, band: band[1], label: band[2], components, earned: round(earned, 1), available, total: TOTAL_POINTS, version: 2 };
  }
  return { score, components, acwrSeries };
}

function illnessSignals(days: Record<string, Metrics>, night: string) {
  const g = (d: string, k: string) => days[d]?.[k] ?? null;
  const baseDays = daysBack(night, 28, 2);
  const out: { key: string; label: string; on: boolean; value: string }[] = [];
  const check = (key: string, label: string, fired: boolean | null, value: string) => {
    if (fired != null) out.push({ key, label, on: fired, value });
  };

  const temp = g(night, "skin_temp_dev");
  check("skin_temp", "Skin temperature up", temp == null ? null : temp >= 0.5, temp != null ? `${sf(temp, 1)} °C` : "");

  const rhr = g(night, "rhr"), base = mean(baseDays.map((d) => g(d, "rhr"))), rsd = sd(baseDays.map((d) => g(d, "rhr")));
  check("rhr", "Resting HR up", rhr == null || base == null ? null : rhr >= base + Math.max(3, rsd ?? 0),
    rhr != null && base != null ? `${f(rhr)} vs ${f(base)} bpm` : "");

  const steps = g(addDaysIso(night, -1), "steps");
  const stepBase = present(baseDays.map((d) => g(d, "steps")));
  const med = stepBase.length ? median(stepBase) : null;
  const n0 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  check("steps", "Steps down", steps == null || !med ? null : steps <= 0.7 * med, steps != null && med ? `${n0(steps)} vs ${n0(med)} usual` : "");

  const hrv = g(night, "hrv"), hb = mean(baseDays.map((d) => g(d, "hrv"))), hsd = sd(baseDays.map((d) => g(d, "hrv")));
  check("hrv", "HRV down", hrv == null || hb == null ? null : hrv <= hb - Math.max(hsd ?? 0, 0.1 * hb),
    hrv != null && hb != null ? `${f(hrv)} vs ${f(hb)} ms` : "");

  const resp = g(night, "respiration"), rb = mean(baseDays.map((d) => g(d, "respiration")));
  const lo = g(night, "respiration_low"), hi = g(night, "respiration_high");
  const ranges = baseDays
    .filter((d) => g(d, "respiration_high") && g(d, "respiration_low"))
    .map((d) => (g(d, "respiration_high") ?? 0) - (g(d, "respiration_low") ?? 0));
  const rangeNow = hi && lo ? hi - lo : null;
  const rangeBase = ranges.length ? mean(ranges) : null, rangeSd = ranges.length ? sd(ranges) : null;
  let fired: boolean | null = null;
  if (resp != null && rb != null) {
    fired = resp >= rb + 1.0;
    if (rangeNow != null && rangeBase != null) fired = fired || rangeNow >= rangeBase + Math.max(rangeSd ?? 0, 1.5);
  }
  check("respiration", "Breathing faster / more variable", fired, resp != null && rb != null ? `${f(resp, 1)} vs ${f(rb, 1)} brpm` : "");
  return out;
}

function alerts(today: string, days: Record<string, Metrics>, acts: Act[], vo2: Record<string, number>, acwrSeries: [string, number | null][]): Alert[] {
  const out: Alert[] = [];
  const nights = [1, 0].map((i) => illnessSignals(days, addDaysIso(today, -i)));
  if (nights.every((n) => n.filter((s) => s.on).length >= 3)) {
    const on = nights[1].filter((s) => s.on);
    out.push({
      id: "illness", severity: "critical", title: "Possible illness coming on",
      detail: `${on.length} of ${nights[1].length} warning signs on each of the last 2 nights. Consider an easy day or rest, even if you feel fine.`,
      signals: on.map((s) => `${s.label} (${s.value})`),
    });
  }

  const reasons: string[] = [];
  const last3 = acwrSeries.slice(-3).map(([, r]) => r);
  if (last3.length === 3 && last3.every((r) => r != null && r > 1.5)) {
    reasons.push(`Load ratio above 1.5 for 3 days running (${last3.map((r) => f(r!, 2)).join(", ")})`);
  }
  const runs = [...acts].sort((a, b) => (a.start < b.start ? -1 : 1))
    .filter((a) => a.sport === "run" && a.decoupling != null && !a.key).slice(-3);
  if (runs.length === 3) {
    const [d1, d2, d3] = runs.map((r) => r.decoupling as number);
    if (d1 < d2 && d2 < d3 && d3 - d1 >= 1) {
      reasons.push(`Aerobic decoupling rising over your last 3 steady runs (${f(d1, 1)}% → ${f(d2, 1)}% → ${f(d3, 1)}%)`);
    }
  }
  const [vNow, v7, v14] = [0, 7, 14].map((k) => vo2At(vo2, addDaysIso(today, -k)));
  if (vNow && v7 && v14 && vNow < v7 && v7 < v14 && (v14 - vNow) / v14 >= 0.005) {
    const sum = (from: string, to: string, incl: boolean) =>
      acts.filter((a) => from <= a.date && (incl ? a.date <= to : a.date < to)).reduce((t, a) => t + (a.training_load || 0), 0);
    const now = sum(addDaysIso(today, -14), today, true);
    const before = sum(addDaysIso(today, -28), addDaysIso(today, -14), false);
    if (before && now >= 0.9 * before) {
      reasons.push(`VO₂ max down for 14+ days (${f(v14, 1)} → ${f(vNow, 1)}) while training load held up`);
    }
  }
  if (reasons.length) {
    out.push({ id: "overreaching", severity: "warning", title: "Signs of overreaching",
      detail: "Your body may not be absorbing the training. Consider a lighter few days.", signals: reasons });
  }

  const nights3 = daysBack(today, 3);
  const scores = nights3.map((d) => days[d]?.sleep_score ?? null);
  if (scores.every((s) => s != null)) {
    const avg = fmean(scores as number[]);
    if (avg < 60) {
      const last = scores[2]!;
      const note = last >= 60 ? ` Last night (${f(last)}) looked better, but it hasn't made up the deficit.` : "";
      out.push({ id: "sleep_debt", severity: "warning", title: "Sleep debt building",
        detail: `Sleep score has averaged ${f(avg)} over the last 3 nights.${note}`,
        signals: nights3.map((d, i) => `${d.slice(5)}: ${f(scores[i]!)}`) });
    }
  }
  return out;
}

// ---------- the /api/readiness endpoint ----------

export function buildReadiness(
  today: string,
  daily: Record<string, DayData>,
  activities: Act[], // with `decoupling` set where known
  garminToday: GarminReadiness | null,
  vo2ByDay: Record<string, { run: number | null; ride: number | null }>,
): Readiness {
  const acts = activities
    .filter((a) => a.date >= addDaysIso(today, -120) && a.date <= today)
    .map((a) => ({ ...a, key: activityKey(a) }));

  const days = daysBack(today, BASELINE_DAYS + 1);
  const values = Object.fromEntries(days.map((d) => [d, dailyValues(daily[d])]));
  const inputs = INPUTS.map(([key, label, unit, direction]) => {
    const series = days.map((d) => values[d][key]);
    const current = series[series.length - 1];
    const base = present(series.slice(0, -1));
    let m: number | null = null, s: number | null = null, z: number | null = null;
    if (base.length >= MIN_BASELINE_POINTS) {
      m = fmean(base);
      s = stdev(base);
      if (current != null && s > 0) z = (current - m) / s;
    }
    return {
      key, label, unit, direction, today: current,
      baseline_mean: m == null ? null : round(m, 1),
      baseline_sd: s == null ? null : round(s, 2),
      z: z == null ? null : round(z, 2),
      effect: z == null ? null : round(Math.max(-3, Math.min(3, z * direction)), 2),
      history: days.slice(-HISTORY_DAYS).map((d) => ({ date: d, value: values[d][key] })),
    };
  });

  const vo2 = Object.fromEntries(Object.entries(vo2ByDay).filter(([d]) => d >= addDaysIso(today, -60) && d <= today));
  const metrics: Record<string, Metrics> = {};
  for (const [d, x] of Object.entries(daily)) {
    const n = x.sleep, h = x.hrv, s = x.stats;
    metrics[d] = {
      hrv: h?.last_night || n?.avg_hrv || null,
      rhr: s?.resting_hr || n?.resting_hr || null,
      sleep_score: n?.score ?? null,
      respiration: n?.respiration ?? null,
      respiration_low: n?.respiration_low ?? null,
      respiration_high: n?.respiration_high ?? null,
      skin_temp_dev: n?.skin_temp_dev ?? null,
      steps: s?.steps ?? null,
      stress: s?.avg_stress ?? null,
    };
  }
  const vo2Run = Object.fromEntries(Object.entries(vo2).filter(([, v]) => v.run).map(([d, v]) => [d, v.run as number]));
  const v2 = compute(today, metrics, acts, vo2Run, garminToday?.recovery_time_h ?? null);
  return {
    date: today,
    score: v2.score,
    components: v2.components,
    alerts: alerts(today, metrics, acts, vo2Run, v2.acwrSeries),
    acwr_ewma: v2.acwrSeries.length ? v2.acwrSeries[v2.acwrSeries.length - 1][1] : null,
    inputs: inputs as Readiness["inputs"],
    load: trainingLoad(acts, today),
    garmin: garminToday,
    recent: recentSessions(acts, today) as Readiness["recent"],
    fitness: fitness(vo2, today),
    baseline_days: BASELINE_DAYS,
  };
}

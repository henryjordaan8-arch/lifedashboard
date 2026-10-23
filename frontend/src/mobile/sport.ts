/**
 * The phone app has no backend, so the per-sport dashboards are computed here.
 * A straight port of backend/app/normalize.py (activity, vo2max), key_reason from
 * calendar_feed.py and backend/app/sport.py; keep them in step.
 */
import type { FtpReading, RacePrediction, Shoe, SportData, SportKey, Threshold } from "../types";

type Raw = Record<string, unknown>;
type Act = Record<string, any>;

const num = (v: unknown): number | null => {
  if (typeof v === "boolean" || v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};
const round = (v: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

// ---------- normalize.py ----------

const SPORT_BY_TYPE_KEY: [string, string[]][] = [
  ["run", ["running", "track_", "treadmill", "trail_run", "ultra_run"]],
  ["ride", ["cycling", "biking", "ride", "bike", "spinning"]],
  ["swim", ["swim"]],
  ["strength", ["strength", "hiit", "weight", "crossfit"]],
];

export function sportFromTypeKey(typeKey: string | null | undefined): string {
  const key = (typeKey ?? "").toLowerCase();
  for (const [sport, needles] of SPORT_BY_TYPE_KEY) if (needles.some((n) => key.includes(n))) return sport;
  return "other";
}

/** One item from Garmin's activity search, in the shape the UI uses. */
export function normalizeActivity(raw: Raw): Act | null {
  const aid = raw.activityId;
  const start = raw.startTimeLocal;
  if (aid == null || !start) return null;
  const typeKey = ((raw.activityType as Raw | undefined)?.typeKey as string | undefined) ?? null;
  const zones = [1, 2, 3, 4, 5].map((i) => num(raw[`hrTimeInZone_${i}`]));
  const splits: Record<string, number> = {};
  for (const [label, meters] of [["1k", 1000], ["mile", 1609], ["5k", 5000], ["10k", 10000], ["half", 21098]] as const) {
    const v = num(raw[`fastestSplit_${meters}`]);
    if (v) splits[label] = v;
  }
  return {
    id: Math.trunc(Number(aid)),
    name: (raw.activityName as string) || "Activity",
    sport: sportFromTypeKey(typeKey),
    type_key: typeKey,
    date: String(start).slice(0, 10),
    start: String(start).replace(" ", "T").slice(0, 16),
    duration_s: int(raw.duration),
    distance_m: num(raw.distance),
    avg_hr: int(raw.averageHR),
    max_hr: int(raw.maxHR),
    calories: int(raw.calories),
    elevation_gain_m: num(raw.elevationGain),
    training_load: num(raw.activityTrainingLoad),
    aerobic_te: num(raw.aerobicTrainingEffect),
    anaerobic_te: num(raw.anaerobicTrainingEffect),
    moving_s: int(raw.movingDuration),
    avg_speed_ms: num(raw.averageSpeed),
    max_speed_ms: num(raw.maxSpeed),
    cadence: num(
      raw.averageRunningCadenceInStepsPerMinute || raw.averageBikingCadenceInRevPerMinute ||
        raw.averageSwimCadenceInStrokesPerMinute,
    ),
    stride_m: (num(raw.avgStrideLength) ?? 0) / 100 || null, // Garmin reports cm
    avg_power: num(raw.avgPower),
    norm_power: num(raw.normPower),
    max_20min_power: num(raw.max20MinPower),
    tss: num(raw.trainingStressScore),
    intensity_factor: num(raw.intensityFactor),
    swolf: num(raw.averageSwolf),
    pool_length_m: num(raw.poolLength),
    strokes: int(raw.strokes),
    hr_zones_s: zones.every((z) => z == null) ? null : zones.map((z) => z ?? 0),
    power_zones_s: powerZones(raw),
    best_splits_s: splits,
  };
}

/** Garmin's 7 power zones folded into 5 bands like the HR zones: Z1, Z2, Z3, Z4, Z5–7. */
function powerZones(raw: Raw): number[] | null {
  const z = [1, 2, 3, 4, 5, 6, 7].map((i) => num(raw[`powerTimeInZone_${i}`]));
  if (z.every((v) => v == null)) return null;
  const v = z.map((x) => x ?? 0);
  return [v[0], v[1], v[2], v[3], v[4] + v[5] + v[6]];
}

/** Garmin's max-metrics entries (running "generic" and cycling VO2 max), one per day. */
export function normalizeVo2(entry: Raw): { date: string; run: number | null; ride: number | null } | null {
  const block = (b: unknown) => {
    if (!b || typeof b !== "object") return { value: null, date: null };
    const r = b as Raw;
    return { value: num(r.vo2MaxPreciseValue) || num(r.vo2MaxValue), date: (r.calendarDate as string) ?? null };
  };
  const run = block(entry.generic);
  const ride = block(entry.cycling);
  const date = run.date ?? ride.date ?? (entry.calendarDate as string | undefined) ?? null;
  if (!date || (run.value == null && ride.value == null)) return null;
  return { date: String(date).slice(0, 10), run: run.value, ride: ride.value };
}

// ---------- calendar_feed.key_reason (no custom keywords on the phone) ----------

const KEY_RULES: [RegExp, string, string][] = [
  [/v\.?o\s?2|vo₂/, "VO₂ max session", "VO₂ max session"],
  [/\btempo\b/, "Tempo run", "Tempo ride"],
  [/\bthreshold\b|\blt\s?\d|\blactate\b/, "Threshold session", "Threshold session"],
  [/sweet\s?spot|\bftp\b|over[\s-]?unders?|\bstructured\b/, "Structured ride", "Structured ride"],
  [/\bintervals?\b|\brepeats\b|\breps\b|\bfartlek\b|\btrack\b|\d+\s*[x×]\s*\d+/, "Interval run", "Structured ride"],
];

export function keyReason(title: string, sport: string | null): string | null {
  if (title.includes("★") || title.includes("⭐")) return "starred";
  if (sport === "swim" || sport === "strength") return null;
  const text = title.toLowerCase();
  for (const [re, run, ride] of KEY_RULES) if (re.test(text)) return sport === "ride" ? ride : run;
  return null;
}

// ---------- sport.py ----------

const TREND_METRICS: Record<SportKey, [string, string, string, number][]> = {
  run: [
    ["pace", "Average pace", "s/km", -1],
    ["efficiency", "Aerobic efficiency", "m/min per bpm", 1],
    ["cadence", "Cadence", "spm", 0],
  ],
  ride: [
    ["power", "Average power", "W", 1],
    ["efficiency", "Aerobic efficiency", "W per bpm", 1],
    ["max_20min_power", "Best 20-min power", "W", 1],
  ],
  swim: [
    ["pace", "Average pace", "s/100m", -1],
    ["swolf", "SWOLF", "", -1],
    ["cadence", "Stroke rate", "spm", 0],
  ],
};

const moving = (a: Act): number | null => a.moving_s || a.duration_s;

export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const weekdayIso = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const fmean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function derived(a: Act): Record<string, number | null> {
  const dist = a.distance_m, secs = moving(a), hr = a.avg_hr;
  const out: Record<string, number | null> = {};
  if (a.sport === "run") {
    out.pace = dist && secs ? secs / (dist / 1000) : null;
    const speed = dist && secs ? dist / (secs / 60) : null;
    out.efficiency = speed && hr ? round(speed / hr, 3) : null;
    out.cadence = a.cadence ?? null;
  } else if (a.sport === "ride") {
    const power = a.norm_power || a.avg_power;
    out.power = a.avg_power ?? null;
    out.speed_kmh = dist && secs ? dist / 1000 / (secs / 3600) : null;
    out.efficiency = power && hr ? round(power / hr, 3) : null;
    out.max_20min_power = a.max_20min_power ?? null;
  } else if (a.sport === "swim") {
    out.pace = dist && secs ? secs / (dist / 100) : null;
    out.swolf = a.swolf ?? null;
    out.cadence = a.cadence ?? null;
  }
  return out;
}

function weighted(sessions: Act[], key: string): number | null {
  const pairs = sessions.filter((s) => s[key] != null).map((s) => [s[key] as number, moving(s) || 0]);
  const total = pairs.reduce((t, [, w]) => t + w, 0);
  return total ? pairs.reduce((t, [v, w]) => t + v * w, 0) / total : null;
}

function summarize(sport: SportKey, sessions: Act[]) {
  const dist = sessions.reduce((t, s) => t + (s.distance_m || 0), 0);
  const secs = sessions.reduce((t, s) => t + (moving(s) || 0), 0);
  const hr = weighted(sessions, "avg_hr");
  const out: SportData["summary"] = {
    sessions: sessions.length,
    distance_km: round(dist / 1000, 1),
    duration_h: round(sessions.reduce((t, s) => t + (s.duration_s || 0), 0) / 3600, 1),
    elevation_m: Math.round(sessions.reduce((t, s) => t + (s.elevation_gain_m || 0), 0)),
    avg_hr: hr ? Math.round(hr) : null,
    load: Math.round(sessions.reduce((t, s) => t + (s.training_load || 0), 0)),
    key_sessions: sessions.filter((s) => s.key).length,
  };
  if (sport === "run") out.pace = dist ? Math.round(secs / (dist / 1000)) : null;
  else if (sport === "swim") {
    out.pace = dist ? Math.round(secs / (dist / 100)) : null;
    const swolf = weighted(sessions, "swolf");
    out.swolf = swolf ? round(swolf, 1) : null;
  } else {
    const power = weighted(sessions, "avg_power");
    out.power = power ? Math.round(power) : null;
    out.speed_kmh = secs ? round(dist / 1000 / (secs / 3600), 1) : null;
  }
  return out;
}

function weekly(sessions: Act[], start: string, end: string): SportData["weekly"] {
  const weeks = new Map<string, SportData["weekly"][number]>();
  for (let d = addDaysIso(start, -weekdayIso(start)); d <= end; d = addDaysIso(d, 7)) {
    weeks.set(d, { week_start: d, distance_km: 0, duration_h: 0, sessions: 0, key_sessions: 0, load: 0 });
  }
  for (const s of sessions) {
    const w = weeks.get(addDaysIso(s.date, -weekdayIso(s.date)));
    if (!w) continue;
    w.distance_km += (s.distance_m || 0) / 1000;
    w.duration_h += (s.duration_s || 0) / 3600;
    w.sessions += 1;
    w.key_sessions += s.key ? 1 : 0;
    w.load += s.training_load || 0;
  }
  for (const w of weeks.values()) {
    w.distance_km = round(w.distance_km, 1);
    w.duration_h = round(w.duration_h, 1);
    w.load = round(w.load, 1);
  }
  return [...weeks.values()];
}

type Point = { date: string; value: number; name: string; key: string | null; id: number };

function change(points: Point[], group: "base" | "all") {
  if (points.length < 2) return null;
  const firstEnd = addDaysIso(points[0].date, 28);
  const lastStart = addDaysIso(points[points.length - 1].date, -28);
  const early = points.filter((p) => p.date < firstEnd).map((p) => p.value);
  const late = points.filter((p) => p.date > lastStart).map((p) => p.value);
  if (!early.length || !late.length || firstEnd > lastStart) return null;
  const a = fmean(early), b = fmean(late);
  return { from: round(a, 2), to: round(b, 2), pct: a ? round(((b - a) / a) * 100, 1) : null, group };
}

function trends(sport: SportKey, sessions: Act[]): SportData["trends"] {
  const out: SportData["trends"] = [];
  for (const [key, label, unit, direction] of TREND_METRICS[sport]) {
    const points: Point[] = sessions
      .filter((s) => s.metrics[key] != null)
      .map((s) => ({ date: s.date, value: round(s.metrics[key], 3), name: s.name, key: s.key, id: s.id }));
    if (points.length < 2) continue;
    // Like with like: base sessions when there are enough (see sport.py).
    const base = points.filter((p) => !p.key);
    const c = (base.length >= 4 ? change(base, "base") : null) ?? change(points, "all");
    out.push({ key, label, unit, direction: direction as 1 | -1 | 0, points, change: c });
  }
  return out;
}

function bests(sport: SportKey, history: Act[], periodStart: string): SportData["bests"] {
  const found: SportData["bests"] = [];
  const add = (label: string, kind: SportData["bests"][number]["kind"], cands: [number, Act][], lower: boolean) => {
    if (!cands.length) return;
    // First best wins on ties, like Python's min/max.
    const [value, s] = cands.reduce((best, c) => ((lower ? c[0] < best[0] : c[0] > best[0]) ? c : best));
    found.push({ label, kind, value: round(value, 1), date: s.date, name: s.name, recent: s.date >= periodStart });
  };
  if (sport === "run") {
    for (const [label, split] of [["Fastest 1 km", "1k"], ["Fastest 5 km", "5k"], ["Fastest 10 km", "10k"], ["Fastest half", "half"]]) {
      add(label, "time", history.filter((s) => s.best_splits_s?.[split]).map((s) => [s.best_splits_s[split], s]), true);
    }
    if (!found.some((b) => b.label === "Fastest 5 km")) {
      add("Best pace (5 km+)", "pace_km",
        history.filter((s) => s.metrics.pace && (s.distance_m || 0) >= 5000).map((s) => [s.metrics.pace, s]), true);
    }
    add("Longest run", "km", history.filter((s) => s.distance_m).map((s) => [s.distance_m / 1000, s]), false);
  } else if (sport === "ride") {
    add("Best 20-min power", "watts", history.filter((s) => s.max_20min_power).map((s) => [s.max_20min_power, s]), false);
    add("Best average power (45 min+)", "watts",
      history.filter((s) => s.avg_power && (moving(s) || 0) >= 2700).map((s) => [s.avg_power, s]), false);
    add("Longest ride", "km", history.filter((s) => s.distance_m).map((s) => [s.distance_m / 1000, s]), false);
    add("Most climbing", "m", history.filter((s) => s.elevation_gain_m).map((s) => [s.elevation_gain_m, s]), false);
  } else {
    add("Fastest pace (400 m+)", "pace_100",
      history.filter((s) => s.metrics.pace && (s.distance_m || 0) >= 400).map((s) => [s.metrics.pace, s]), true);
    add("Best SWOLF", "number", history.filter((s) => s.swolf).map((s) => [s.swolf, s]), true);
    add("Longest swim", "m", history.filter((s) => s.distance_m).map((s) => [s.distance_m, s]), false);
  }
  return found;
}

function zones(sessions: Act[], field = "hr_zones_s"): number[] | null {
  const withZones = sessions.map((s) => s[field]).filter(Boolean) as number[][];
  if (!withZones.length) return null;
  return [0, 1, 2, 3, 4].map((i) => Math.round(withZones.reduce((t, z) => t + z[i], 0)));
}

const PACE_AT_HR_WINDOW = 10, PACE_AT_HR_MIN_M = 3000;

/** Easy-run pace scaled to your typical easy heart rate (see pace_at_hr in sport.py). */
function paceAtHr(history: Act[], period: Act[]): SportData["trends"][number] | null {
  const usable = (a: Act) => !a.key && !!a.avg_hr && !!a.metrics.pace && (a.distance_m || 0) >= PACE_AT_HR_MIN_M;
  const base = history.filter(usable);
  if (base.length < 4) return null;
  const hrs = base.map((a) => a.avg_hr as number).sort((a, b) => a - b), m = hrs.length >> 1;
  const med = hrs.length % 2 ? hrs[m] : (hrs[m - 1] + hrs[m]) / 2;
  const ref = Math.round(med / 5) * 5;
  const points: Point[] = period
    .filter((a) => usable(a) && Math.abs(a.avg_hr - ref) <= PACE_AT_HR_WINDOW)
    .map((a) => ({ date: a.date, value: round((a.metrics.pace * a.avg_hr) / ref, 3), name: a.name, key: null, id: a.id }));
  if (points.length < 2) return null;
  return { key: "pace_at_hr", label: `Pace at ${ref} bpm`, unit: "s/km", direction: -1, points, change: change(points, "base"), ref_hr: ref };
}

/** Optional Garmin extras for the run / ride dashboards (see run_extras / ride_extras in sport.py). */
export interface Extras {
  predictions?: RacePrediction[];
  threshold?: Threshold[];
  shoes?: Shoe[];
  ftp?: { date: string; ftp: number }[];
  weight?: { date: string; kg: number }[];
  swim_efforts?: SwimEffort[];
}

export interface SwimEffort { id: number; date: string; name: string; t200: number | null; t400: number | null }

const CSS_WINDOW_DAYS = 56;

/** Critical swim speed from the best 200 m and 400 m (see _css in sport.py). */
function css(efforts: SwimEffort[]) {
  const best = (k: "t200" | "t400") =>
    efforts.filter((e) => e[k]).reduce<SwimEffort | null>((b, e) => (!b || e[k]! < b[k]! ? e : b), null);
  const b200 = best("t200"), b400 = best("t400");
  if (!b200 || !b400 || !(b200.t200! < b400.t400! && b400.t400! <= 3 * b200.t200!)) return null;
  return {
    pace_s100: round((b400.t400! - b200.t200!) / 2, 1),
    t200: { value: b200.t200!, date: b200.date, name: b200.name },
    t400: { value: b400.t400!, date: b400.date, name: b400.name },
  };
}

function swimExtras(efforts: SwimEffort[], start: string, end: string) {
  const history: { date: string; value: number }[] = [];
  for (let d = end; d >= start; d = addDaysIso(d, -28)) {
    const from = addDaysIso(d, -CSS_WINDOW_DAYS);
    const est = css(efforts.filter((e) => from < e.date && e.date <= d));
    if (est) history.push({ date: d, value: est.pace_s100 });
  }
  const current = css(efforts.filter((e) => start <= e.date && e.date <= end));
  return { css: current ? { ...current, history: history.reverse() } : null };
}

const inRange = <T extends { date: string }>(rows: T[], start: string, end: string) => rows.filter((r) => start <= r.date && r.date <= end);
/** Step values: the reading in effect at the start, then the changes. */
function stepsIn<T extends { date: string }>(rows: T[], start: string, end: string): T[] {
  const before = rows.filter((r) => r.date < start);
  return [...(before.length ? [{ ...before[before.length - 1], date: start }] : []), ...inRange(rows, start, end)];
}
const latest = <T extends { date: string }>(rows: T[]) => (rows.length ? rows.reduce((a, b) => (b.date > a.date ? b : a)) : null);

function runExtras(x: Extras, start: string, end: string) {
  const lt = [...(x.threshold ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1))
    .filter((r, i, all) => i === 0 || r.pace_s_km !== all[i - 1].pace_s_km || r.hr !== all[i - 1].hr);
  return {
    predictions: inRange(x.predictions ?? [], start, end),
    threshold: { latest: latest(lt), history: stepsIn(lt, start, end) },
    shoes: x.shoes ?? [],
  };
}

function rideExtras(x: Extras, start: string, end: string) {
  const weights = [...(x.weight ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  const ftp = [...(x.ftp ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1)).filter((r, i, all) => i === 0 || r.ftp !== all[i - 1].ftp);
  const kgAt = (day: string) =>
    weights.length ? weights.reduce((a, b) => (Math.abs(daysBetween(b.date, day)) < Math.abs(daysBetween(a.date, day)) ? b : a)).kg : null;
  const rows: FtpReading[] = ftp.map((r) => {
    const kg = kgAt(r.date);
    return { date: r.date, ftp: r.ftp, wkg: kg ? round(r.ftp / kg, 2) : null };
  });
  return { ftp: { latest: latest(rows), history: stepsIn(rows, start, end), weight_kg: latest(weights)?.kg ?? null } };
}

export function sportView(
  sport: SportKey,
  allActivities: Act[],
  vo2History: { date: string; value: number }[],
  start: string,
  end: string,
  extras: Extras = {},
): SportData {
  const history = allActivities
    .filter((a) => a.sport === sport)
    .map((a) => ({ ...a }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  for (const a of history) {
    a.metrics = derived(a);
    a.key = keyReason(a.name, sport);
  }
  const period = history.filter((a) => start <= a.date && a.date <= end);
  const span = daysBetween(start, end) + 1;
  const prevStart = addDaysIso(start, -span), prevEnd = addDaysIso(start, -1);
  const previous = history.filter((a) => prevStart <= a.date && a.date <= prevEnd);
  const trendList = trends(sport, period);
  const pah = sport === "run" ? paceAtHr(history, period) : null;
  if (pah) trendList.push(pah);
  const out: SportData = {
    sport,
    start,
    end,
    summary: summarize(sport, period),
    previous: summarize(sport, previous),
    weekly: weekly(period, start, end),
    trends: trendList,
    bests: bests(sport, history, start),
    zones_s: zones(period),
    vo2max: vo2History.filter((v) => start <= v.date && v.date <= end),
    sessions: [...period].reverse() as SportData["sessions"],
    history_start: history.length ? history[0].date : null,
  };
  if (sport === "run") return { ...out, ...runExtras(extras, start, end) };
  if (sport === "ride") return { ...out, power_zones_s: zones(period, "power_zones_s"), ...rideExtras(extras, start, end) };
  return { ...out, ...swimExtras(extras.swim_efforts ?? [], start, end) };
}

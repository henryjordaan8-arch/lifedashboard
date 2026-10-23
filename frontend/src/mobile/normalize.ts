/**
 * Daily Garmin payloads (sleep, HRV, daily summary, training readiness, lap splits)
 * in the shapes the UI uses. Port of backend/app/normalize.py; keep them in step.
 */
type Raw = Record<string, any>;

const num = (v: unknown): number | null => {
  if (typeof v === "boolean" || v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

/** Garmin's *Local timestamps are epoch-ms already shifted to local wall time. */
function localMsToIso(ms: unknown): string | null {
  const n = num(ms);
  return n == null ? null : new Date(n).toISOString().slice(0, 16);
}

export function sleep(day: string, raw: Raw | null) {
  if (!raw) return null;
  const dto = raw.dailySleepDTO ?? {};
  const duration = int(dto.sleepTimeSeconds);
  if (!duration) return null;
  const overall = dto.sleepScores?.overall ?? {};
  return {
    date: day,
    start: localMsToIso(dto.sleepStartTimestampLocal),
    end: localMsToIso(dto.sleepEndTimestampLocal),
    duration_s: duration,
    deep_s: int(dto.deepSleepSeconds) || 0,
    light_s: int(dto.lightSleepSeconds) || 0,
    rem_s: int(dto.remSleepSeconds) || 0,
    awake_s: int(dto.awakeSleepSeconds) || 0,
    score: int(overall.value),
    score_label: overall.qualifierKey ?? null,
    avg_hrv: num(raw.avgOvernightHrv),
    resting_hr: int(raw.restingHeartRate),
    spo2: num(dto.averageSpO2Value),
    respiration: num(dto.averageRespirationValue),
    respiration_low: num(dto.lowestRespirationValue),
    respiration_high: num(dto.highestRespirationValue),
    skin_temp_dev: num(dto.avgSkinTempDeviationC ?? raw.avgSkinTempDeviationC),
    stress: num(dto.avgSleepStress),
    body_battery_change: int(raw.bodyBatteryChange),
  };
}

export function hrv(day: string, raw: Raw | null) {
  const s = raw?.hrvSummary ?? {};
  if (s.lastNightAvg == null) return null;
  const base = s.baseline ?? {};
  return {
    date: day,
    last_night: num(s.lastNightAvg),
    weekly_avg: num(s.weeklyAvg),
    status: s.status ?? null,
    baseline_low: num(base.balancedLow),
    baseline_high: num(base.balancedUpper),
  };
}

export function stats(day: string, raw: Raw | null) {
  if (!raw || !Object.keys(raw).length) return null;
  return {
    date: day,
    resting_hr: int(raw.restingHeartRate),
    body_battery_high: int(raw.bodyBatteryHighestValue),
    body_battery_low: int(raw.bodyBatteryLowestValue),
    body_battery_wake: int(raw.bodyBatteryAtWakeTime),
    avg_stress: int(raw.averageStressLevel),
    steps: int(raw.totalSteps),
  };
}

/** Garmin's own Training Readiness, kept for comparison; the morning entry. */
export function readiness(day: string, raw: unknown) {
  const all = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const entries = all.filter((e): e is Raw => !!e && typeof e === "object" && e.score != null);
  if (!entries.length) return null;
  const when = (e: Raw) => String(e.timestamp ?? e.timestampLocal ?? "");
  const first = entries.reduce((a, b) => (when(b) < when(a) ? b : a));
  const recoveryMin = num(first.recoveryTime); // Garmin reports minutes
  return {
    date: day,
    score: int(first.score),
    level: first.level ?? null,
    feedback: first.feedbackShort ?? null,
    recovery_time_h: recoveryMin == null ? null : Math.round((recoveryMin / 60) * 10) / 10,
  };
}

/** Aerobic decoupling (%) from lap splits: output per heartbeat, first vs second half. */
export function decoupling(raw: Raw | null, sport: string): number | null {
  const laps = ((raw?.lapDTOs as Raw[] | undefined) ?? []).filter((l) => num(l.duration) && num(l.averageHR));
  if (laps.length < 2) return null;
  const usePower = sport === "ride" && laps.every((l) => num(l.averagePower));
  const outKey = usePower ? "averagePower" : "averageSpeed";
  if (!laps.every((l) => num(l[outKey]))) return null;
  const total = laps.reduce((t, l) => t + num(l.duration)!, 0);
  const halves: Raw[][] = [[], []];
  let t = 0;
  for (const lap of laps) {
    const d = num(lap.duration)!;
    halves[t + d / 2 < total / 2 ? 0 : 1].push(lap);
    t += d;
  }
  if (!halves[0].length || !halves[1].length) return null;
  const efficiency = (group: Raw[]) => {
    const w = group.reduce((s, l) => s + num(l.duration)!, 0);
    const out = group.reduce((s, l) => s + num(l[outKey])! * num(l.duration)!, 0) / w;
    const hr = group.reduce((s, l) => s + num(l.averageHR)! * num(l.duration)!, 0) / w;
    return out / hr;
  };
  const first = efficiency(halves[0]), second = efficiency(halves[1]);
  return Math.round(((first - second) / first) * 1000) / 10;
}

export type Night = NonNullable<ReturnType<typeof sleep>>;
export type Hrv = NonNullable<ReturnType<typeof hrv>>;
export type Stats = NonNullable<ReturnType<typeof stats>>;
export type GarminReadiness = NonNullable<ReturnType<typeof readiness>>;

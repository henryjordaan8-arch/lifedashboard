export type Sport = "run" | "ride" | "swim" | "strength" | "other";

export interface Status {
  mode: "demo" | "garmin";
  syncing: boolean;
  last_sync: string | null;
  last_error: string | null;
  calendar_configured: boolean;
}

export interface HrvDay {
  last_night: number | null;
  weekly_avg: number | null;
  status: string | null;
  baseline_low: number | null;
  baseline_high: number | null;
}

export interface SleepNight {
  date: string;
  start: string | null;
  end: string | null;
  duration_s: number;
  deep_s: number;
  light_s: number;
  rem_s: number;
  awake_s: number;
  score: number | null;
  score_label: string | null;
  avg_hrv: number | null;
  resting_hr: number | null;
  spo2: number | null;
  respiration: number | null;
  stress: number | null;
  body_battery_change: number | null;
  body_battery_wake: number | null;
  hrv: HrvDay | null;
}

export interface Activity {
  id: number;
  name: string;
  sport: Sport;
  type_key: string | null;
  date: string;
  start: string;
  duration_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  elevation_gain_m: number | null;
  training_load: number | null;
  aerobic_te: number | null;
  anaerobic_te: number | null;
}

export interface PlannedSession {
  id: string;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  sport: Sport;
  description: string | null;
  location: string | null;
}

export interface ReadinessInput {
  key: string;
  label: string;
  unit: string;
  direction: 1 | -1;
  today: number | null;
  baseline_mean: number | null;
  baseline_sd: number | null;
  z: number | null;
  effect: number | null;
  history: { date: string; value: number | null }[];
}

export interface Readiness {
  date: string;
  score: number | null;
  inputs: ReadinessInput[];
  load: { acute: number; chronic: number; ratio: number | null; yesterday: number };
  garmin: { score: number | null; level: string | null; feedback: string | null } | null;
  baseline_days: number;
}

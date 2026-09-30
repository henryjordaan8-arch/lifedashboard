export type Sport = "run" | "ride" | "swim" | "strength" | "other";
export type Category = "training" | "work" | "study" | "reading" | "personal" | "other";

export interface Status {
  mode: "demo" | "garmin";
  syncing: boolean;
  last_sync: string | null;
  last_error: string | null;
  calendar_configured: boolean;
  version?: string;
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
  respiration_low: number | null;
  respiration_high: number | null;
  skin_temp_dev: number | null;
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

export interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  category: Category;
  sport: Sport | null;
  key_reason: string | null;
  description: string | null;
  location: string | null;
  completed_by?: { id: number; name: string; start: string; duration_s: number | null; distance_m: number | null } | null;
  /** "routine" for your fixed daily blocks (routine.json) */
  source?: string;
  is_call?: boolean;
}

export interface DayPlan {
  date: string;
  window?: { start: string; end: string };
  markers?: { title: string; at: string }[];
  configured: boolean;
  events: CalEvent[];
  hours: Record<Category, number>;
  unplanned_activities: Activity[];
}

export interface WeekGoal {
  id: string;
  label: string;
  metric: string;
  mode: "at_least" | "at_most";
  unit: string;
  target: number;
  progress: number;
  planned: number;
  done: boolean;
  status: "done" | "on_track" | "behind" | "over" | "todo";
  items: string[];
}

export interface Week {
  week_start: string;
  week_end: string;
  using_example: boolean;
  goals: WeekGoal[];
}

export interface RecentActivity {
  id: number;
  name: string;
  sport: Sport;
  date: string;
  duration_s: number | null;
  distance_m: number | null;
  training_load: number | null;
  aerobic_te: number | null;
  anaerobic_te: number | null;
  hard: boolean;
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

export type ComponentStatus = "good" | "ok" | "warn" | "bad" | "none";

export interface ScoreComponent {
  key: string;
  label: string;
  max: number;
  points: number | null;
  available: boolean;
  value: number | null;
  value_text: string;
  detail: string;
  status: ComponentStatus;
}

export interface ReadinessScore {
  value: number;
  band: "high" | "good" | "low" | "rest";
  label: string;
  components: ScoreComponent[];
  earned: number;
  available: number;
  version: number;
}

export interface Alert {
  id: "illness" | "overreaching" | "sleep_debt" | string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
  signals: string[];
}

export interface Readiness {
  date: string;
  score: ReadinessScore | null;
  components: ScoreComponent[];
  alerts: Alert[];
  acwr_ewma: number | null;
  inputs: ReadinessInput[];
  load: { acute: number; chronic: number; ratio: number | null; yesterday: number };
  garmin: { score: number | null; level: string | null; feedback: string | null; recovery_time_h: number | null } | null;
  recent: {
    sessions_7d: number;
    hard_7d: number;
    days_since_hard: number | null;
    last: RecentActivity[];
  };
  fitness: {
    vo2max_run: number;
    vo2max_ride: number | null;
    as_of: string;
    change_28d: number;
    history: { date: string; value: number }[];
  } | null;
  baseline_days: number;
}

export type SportKey = "run" | "ride" | "swim";

export interface SportSession extends Activity {
  moving_s: number | null;
  avg_speed_ms: number | null;
  cadence: number | null;
  stride_m: number | null;
  avg_power: number | null;
  norm_power: number | null;
  max_20min_power: number | null;
  tss: number | null;
  swolf: number | null;
  pool_length_m: number | null;
  hr_zones_s: number[] | null;
  metrics: Record<string, number | null>;
  key: string | null;
}

export interface SportSummary {
  sessions: number;
  distance_km: number;
  duration_h: number;
  elevation_m: number;
  avg_hr: number | null;
  load: number;
  key_sessions: number;
  pace?: number | null;
  swolf?: number | null;
  power?: number | null;
  speed_kmh?: number | null;
}

export interface TrendSeries {
  key: string;
  label: string;
  unit: string;
  direction: 1 | -1 | 0;
  points: { date: string; value: number; name: string; key: string | null }[];
  change: { from: number; to: number; pct: number | null; group: "base" | "all" } | null;
}

export interface SportBest {
  label: string;
  kind: "time" | "pace_km" | "pace_100" | "km" | "m" | "watts" | "number";
  value: number;
  date: string;
  name: string;
  recent: boolean;
}

export interface SportData {
  sport: SportKey;
  start: string;
  end: string;
  summary: SportSummary;
  previous: SportSummary;
  weekly: { week_start: string; distance_km: number; duration_h: number; sessions: number; key_sessions: number; load: number }[];
  trends: TrendSeries[];
  bests: SportBest[];
  zones_s: number[] | null;
  vo2max: { date: string; value: number }[];
  sessions: SportSession[];
  history_start: string | null;
}

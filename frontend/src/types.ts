export type Sport = "run" | "ride" | "swim" | "strength" | "rehab" | "other";
export type Category = "training" | "work" | "study" | "other";

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
}

export interface DayPlan {
  date: string;
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

export interface Readiness {
  date: string;
  score: number | null;
  inputs: ReadinessInput[];
  load: { acute: number; chronic: number; ratio: number | null; yesterday: number };
  garmin: { score: number | null; level: string | null; feedback: string | null } | null;
  recent: {
    sessions_7d: number;
    hard_7d: number;
    rehab_7d: number;
    days_since_hard: number | null;
    run_km_7d: number;
    run_km_prior_week_avg: number;
    run_ramp_pct: number | null;
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

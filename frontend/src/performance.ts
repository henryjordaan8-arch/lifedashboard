/**
 * Performance trends computed in the browser (backend, Pages snapshot and phone alike):
 * fitness / fatigue / form from training load, and how effective sessions were.
 */
import { addDays, isoDay, parseDay } from "./format";
import type { SportSession } from "./types";

// ---------- fitness, fatigue, form ----------

const FITNESS_DAYS = 42; // chronic training load time constant
const FATIGUE_DAYS = 7; // acute

export interface FitnessDay {
  date: string;
  load: number;
  fitness: number;
  fatigue: number;
  /** fitness − fatigue going into the day, as % of fitness (positive = fresh) */
  form_pct: number | null;
}

/**
 * Exponentially weighted 42-day (fitness) and 7-day (fatigue) averages of Garmin's
 * per-activity training load. Form is yesterday's fitness minus yesterday's fatigue.
 */
export function fitnessSeries(activities: { date: string; training_load: number | null }[], days: number, today = new Date()): FitnessDay[] {
  const load = new Map<string, number>();
  for (const a of activities) if (a.training_load) load.set(a.date, (load.get(a.date) ?? 0) + a.training_load);
  const first = [...load.keys()].sort()[0];
  if (!first) return [];
  const start = parseDay(first);
  const all: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) all.push(isoDay(d));
  const seedDays = all.slice(0, FITNESS_DAYS);
  let fit = seedDays.reduce((s, d) => s + (load.get(d) ?? 0), 0) / Math.max(1, seedDays.length);
  let fat = fit;
  const out: FitnessDay[] = [];
  for (const d of all) {
    const form = fit > 0 ? ((fit - fat) / fit) * 100 : null;
    const x = load.get(d) ?? 0;
    fit += (x - fit) / FITNESS_DAYS;
    fat += (x - fat) / FATIGUE_DAYS;
    out.push({ date: d, load: x, fitness: fit, fatigue: fat, form_pct: form });
  }
  return out.slice(-days);
}

export interface FormState { label: string; detail: string; icon: string; tone: "good" | "warn" | "bad" | "neutral" }

/** Form zones as a share of fitness (after TrainingPeaks' TSB ranges, scaled to your fitness). */
export const FORM_ZONES = { fresh: 10, productive: -10, overload: -30 };

export function formState(pct: number | null): FormState {
  if (pct == null) return { label: "—", detail: "not enough training data", icon: "", tone: "neutral" };
  if (pct > FORM_ZONES.fresh) return { label: "Fresh", detail: "ready to race; long spells here lose fitness", icon: "●", tone: "neutral" };
  if (pct >= FORM_ZONES.productive) return { label: "Neutral", detail: "maintaining", icon: "●", tone: "neutral" };
  if (pct >= FORM_ZONES.overload) return { label: "Productive", detail: "building fitness", icon: "▲", tone: "good" };
  return { label: "Overloaded", detail: "fatigue well above fitness: plan recovery", icon: "⚠", tone: "bad" };
}

// ---------- session effectiveness ----------

type Intent = "vo2" | "threshold" | "tempo" | "intervals" | "structured" | "quality";

const INTENT: { match: RegExp; intent: Intent; label: string }[] = [
  { match: /vo₂|vo2/i, intent: "vo2", label: "VO₂ max" },
  { match: /threshold/i, intent: "threshold", label: "Threshold" },
  { match: /tempo/i, intent: "tempo", label: "Tempo" },
  { match: /interval/i, intent: "intervals", label: "Intervals" },
  { match: /structured/i, intent: "structured", label: "Structured" },
];

/** What the zones should show for each intent: share of HR time in the target zones. */
const TARGET: Record<Intent, { zones: number[]; min: number; text: string }> = {
  vo2: { zones: [3, 4], min: 0.25, text: "25%+ in Z4–5" },
  intervals: { zones: [3, 4], min: 0.25, text: "25%+ in Z4–5" },
  threshold: { zones: [3, 4], min: 0.25, text: "25%+ in Z4–5" },
  tempo: { zones: [2, 3], min: 0.4, text: "40%+ in Z3–4" },
  structured: { zones: [2, 3, 4], min: 0.4, text: "40%+ in Z3–5" },
  quality: { zones: [2, 3, 4], min: 0.3, text: "30%+ in Z3–5" },
};
/** Garmin primary benefits that confirm each intent. */
const BENEFIT_FITS: Record<Intent, string[]> = {
  vo2: ["VO2MAX", "ANAEROBIC_CAPACITY"],
  intervals: ["VO2MAX", "ANAEROBIC_CAPACITY", "LACTATE_THRESHOLD"],
  threshold: ["LACTATE_THRESHOLD", "VO2MAX"],
  tempo: ["TEMPO", "LACTATE_THRESHOLD"],
  structured: ["TEMPO", "LACTATE_THRESHOLD", "VO2MAX"],
  quality: ["TEMPO", "LACTATE_THRESHOLD", "VO2MAX", "ANAEROBIC_CAPACITY"],
};
const EASY_MIN = 0.75; // a base session should be at least 75% Z1–2

export const BENEFIT_LABEL: Record<string, string> = {
  RECOVERY: "Recovery", AEROBIC_BASE: "Base", TEMPO: "Tempo", LACTATE_THRESHOLD: "Threshold",
  VO2MAX: "VO₂ max", ANAEROBIC_CAPACITY: "Anaerobic", SPEED: "Sprint", NO_BENEFIT: "No benefit",
};

export interface KeyVerdict {
  s: SportSession;
  intent: string;
  target: string;
  share: number | null;
  onTarget: boolean | null;
  benefit: string | null;
  benefitFits: boolean | null;
}

export interface Progression {
  title: string;
  latest: SportSession;
  value: number;
  previous: number;
  /** % better than the average of the previous (up to 3) times (positive = better) */
  pct: number;
  count: number;
}

export interface Effectiveness {
  key: KeyVerdict[];
  keyOnTarget: number;
  keyJudged: number;
  easyKept: number;
  easyJudged: number;
  /** mean Z3+ share of base sessions, the "grey zone" creep */
  easyGrey: number | null;
  progressions: Progression[];
}

const shareIn = (z: number[] | null | undefined, zones: number[]) => {
  if (!z) return null;
  const total = z.reduce((a, b) => a + b, 0);
  return total ? zones.reduce((s, i) => s + z[i], 0) / total : null;
};
/** Same workout, different days: "VO2 max run 5×3min" ≈ "vo2 max run 5x3min". */
const titleKey = (t: string) => t.toLowerCase().replace(/[×x]/g, "x").replace(/[^a-z0-9x]+/g, " ").trim();

export function effectiveness(sessions: SportSession[], sport: "run" | "ride"): Effectiveness {
  const chrono = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const key: KeyVerdict[] = [];
  let easyKept = 0, easyJudged = 0;
  const grey: number[] = [];

  for (const s of chrono) {
    if (s.key) {
      const it = INTENT.find((i) => i.match.test(s.key!)) ?? { intent: "quality" as Intent, label: "Quality" };
      const t = TARGET[it.intent];
      const share = shareIn(s.hr_zones_s, t.zones);
      const benefitFits = s.te_label ? BENEFIT_FITS[it.intent].includes(s.te_label) : null;
      const onTarget = share == null && benefitFits == null ? null : (share != null && share >= t.min) || benefitFits === true;
      key.push({ s, intent: it.label, target: t.text, share, onTarget, benefit: s.te_label ? BENEFIT_LABEL[s.te_label] ?? s.te_label : null, benefitFits });
    } else {
      const easy = shareIn(s.hr_zones_s, [0, 1]);
      if (easy == null) continue;
      easyJudged++;
      if (easy >= EASY_MIN) easyKept++;
      grey.push(1 - easy);
    }
  }

  // Repeated key sessions: latest vs the average of the up-to-3 before it.
  const perf = (s: SportSession) => (sport === "run" ? s.metrics.pace : s.norm_power || s.avg_power) ?? null;
  const groups = new Map<string, SportSession[]>();
  for (const s of chrono) if (s.key && perf(s) != null) groups.set(titleKey(s.name), [...(groups.get(titleKey(s.name)) ?? []), s]);
  const progressions: Progression[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const latest = list[list.length - 1];
    const prev = list.slice(-4, -1).map((s) => perf(s)!);
    const previous = prev.reduce((a, b) => a + b, 0) / prev.length;
    const value = perf(latest)!;
    // Pace: lower is better; power: higher is better.
    const pct = sport === "run" ? ((previous - value) / previous) * 100 : ((value - previous) / previous) * 100;
    progressions.push({ title: latest.name, latest, value, previous, pct, count: list.length });
  }
  progressions.sort((a, b) => b.latest.date.localeCompare(a.latest.date));

  const judged = key.filter((k) => k.onTarget != null);
  return {
    key: key.reverse(),
    keyOnTarget: judged.filter((k) => k.onTarget).length,
    keyJudged: judged.length,
    easyKept,
    easyJudged,
    easyGrey: grey.length ? grey.reduce((a, b) => a + b, 0) / grey.length : null,
    progressions,
  };
}

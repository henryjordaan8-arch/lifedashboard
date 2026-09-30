import { useState } from "react";
import { duration, parseDay } from "../format";
import type { SleepNight } from "../types";
import { useWidth } from "../useWidth";

interface Metric {
  key: string;
  label: string;
  unit: string;
  get: (n: SleepNight) => number | null | undefined;
  fmt: (v: number) => string;
  /** Garmin's own "balanced" range (HRV only); everything else uses your 30-night normal. */
  band?: (nights: SleepNight[]) => [number, number] | null;
}

const h = (s: number | null | undefined) => (s == null ? null : s / 3600);
const hrs = (v: number) => duration(v * 3600);
const n0 = (v: number) => String(Math.round(v));
const n1 = (v: number) => v.toFixed(1);

export const NIGHT_METRICS: Metric[] = [
  {
    key: "hrv", label: "HRV", unit: "ms", get: (n) => n.hrv?.last_night ?? n.avg_hrv, fmt: n0,
    band: (ns) => {
      const hv = [...ns].reverse().find((n) => n.hrv?.baseline_low != null)?.hrv;
      return hv?.baseline_low != null && hv.baseline_high != null ? [hv.baseline_low, hv.baseline_high] : null;
    },
  },
  { key: "rhr", label: "Resting HR", unit: "bpm", get: (n) => n.resting_hr, fmt: n0 },
  { key: "score", label: "Sleep score", unit: "", get: (n) => n.score, fmt: n0 },
  { key: "duration", label: "Duration", unit: "h", get: (n) => h(n.duration_s), fmt: hrs },
  { key: "deep", label: "Deep", unit: "h", get: (n) => h(n.deep_s), fmt: hrs },
  { key: "rem", label: "REM", unit: "h", get: (n) => h(n.rem_s), fmt: hrs },
  { key: "light", label: "Light", unit: "h", get: (n) => h(n.light_s), fmt: hrs },
  { key: "awake", label: "Awake", unit: "h", get: (n) => h(n.awake_s), fmt: hrs },
  { key: "bb", label: "Body Battery", unit: "", get: (n) => n.body_battery_wake, fmt: n0 },
  { key: "spo2", label: "SpO₂", unit: "%", get: (n) => n.spo2, fmt: n0 },
  { key: "resp", label: "Respiration", unit: "brpm", get: (n) => n.respiration, fmt: n1 },
  { key: "stress", label: "Stress", unit: "", get: (n) => n.stress, fmt: n0 },
];

const H = 250;
const PAD = { top: 12, right: 12, bottom: 22, left: 40 };

/** Short axis labels; the tooltip shows the full value. */
const axisFmt = (m: Metric, v: number) =>
  m.unit === "h" ? (v < 1 ? `${Math.round(v * 60)}m` : `${Math.round(v * 10) / 10}h`) : m.fmt(v);

/** Mean ± 1 SD over all loaded nights: "your normal". */
function normalRange(vals: number[]): [number, number] | null {
  if (vals.length < 5) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
  return [mean - sd, mean + sd];
}

function niceStep(span: number) {
  const raw = span / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= raw) ?? raw;
}

/** Last 14 nights of one sleep metric against your normal range, with metric toggles. */
export function NightTrend({ nights, all }: { nights: SleepNight[]; all: SleepNight[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(300);
  const [key, setKey] = useState("hrv");
  const [hover, setHover] = useState<number | null>(null);
  const m = NIGHT_METRICS.find((x) => x.key === key) ?? NIGHT_METRICS[0];

  const pts = nights.map((n) => ({ date: n.date, v: m.get(n) ?? null }));
  const vals = pts.map((p) => p.v).filter((v): v is number => v != null);
  const allVals = all.map((n) => m.get(n)).filter((v): v is number => v != null);
  const band = m.band?.(all) ?? normalRange(allVals);
  const bandNote = m.band && m.band(all) ? "Band = Garmin's balanced range" : `Band = your normal (${all.length} nights)`;

  const header = (
    <>
      <div className="chart-title">
        <span>
          {m.label}
          {m.unit && m.unit !== "h" ? ` (${m.unit})` : ""}
        </span>
        <span className="muted">{bandNote}</span>
      </div>
      <div className="metric-toggles" role="tablist" aria-label="Sleep metric">
        {NIGHT_METRICS.map((x) => (
          <button
            key={x.key} role="tab" aria-selected={x.key === key}
            className={x.key === key ? "on" : ""}
            onClick={() => { setKey(x.key); setHover(null); }}
          >
            {x.label}
          </button>
        ))}
      </div>
    </>
  );

  if (vals.length < 2) {
    return (
      <div ref={ref}>
        {header}
        <div className="empty" style={{ height: H, display: "grid", placeItems: "center" }}>No {m.label.toLowerCase()} data for these nights</div>
      </div>
    );
  }

  const lo0 = Math.min(...vals, band?.[0] ?? Infinity);
  const hi0 = Math.max(...vals, band?.[1] ?? -Infinity);
  const step = niceStep((hi0 - lo0) * 1.2 || 1);
  const lo = Math.floor((lo0 - step * 0.3) / step) * step;
  const hi = Math.ceil((hi0 + step * 0.3) / step) * step;
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t);

  let d = "";
  pts.forEach((p, i) => {
    if (p.v == null) return;
    d += `${d && pts[i - 1]?.v != null ? "L" : "M"}${x(i)},${y(p.v)}`;
  });
  const last = pts.length - 1;
  const hp = hover != null ? pts[hover] : null;
  const outside = (v: number) => band != null && (v < band[0] || v > band[1]);

  return (
    <div ref={ref}>
      {header}
      <div
        className="chart-wrap"
        onMouseMove={(e) => {
          const bx = e.currentTarget.getBoundingClientRect().left;
          const i = Math.round(((e.clientX - bx - PAD.left) / innerW) * (pts.length - 1));
          setHover(Math.max(0, Math.min(last, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg width={width} height={H} role="img" aria-label={`${m.label}, last ${pts.length} nights`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="gridline" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="tnum">{axisFmt(m, t)}</text>
            </g>
          ))}
          {band && (
            <rect x={PAD.left} width={innerW} y={y(band[1])} height={Math.max(0, y(band[0]) - y(band[1]))}
                  fill="var(--better)" opacity={0.1} />
          )}
          <path d={d} fill="none" stroke="var(--better)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) =>
            p.v != null && (i === last || outside(p.v)) ? (
              <circle key={i} cx={x(i)} cy={y(p.v)} r={4}
                      fill={i === last ? "var(--better)" : "var(--surface)"} stroke="var(--better)"
                      strokeWidth={i === last ? 2 : 1.5} />
            ) : null,
          )}
          {[0, Math.floor(last / 2), last].map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}>
              {parseDay(pts[i].date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </text>
          ))}
          {hp && hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--baseline)" />
              {hp.v != null && <circle cx={x(hover)} cy={y(hp.v)} r={4} fill="var(--better)" stroke="var(--surface)" strokeWidth={2} />}
            </g>
          )}
        </svg>
        {hp && hover != null && (
          <div className="tip" style={{ left: x(hover), top: hp.v != null ? y(hp.v) : PAD.top }}>
            <div className="t">{parseDay(hp.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</div>
            <div className="row">{m.label} <b>{hp.v != null ? `${m.fmt(hp.v)}${m.unit && m.unit !== "h" ? ` ${m.unit}` : ""}` : "—"}</b></div>
            {band && <div className="row">Normal <b>{m.fmt(band[0])}–{m.fmt(band[1])}</b></div>}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { addDays, isoDay, parseDay, shortDate } from "../format";
import { type FitnessDay, fitnessSeries, FORM_ZONES, formState } from "../performance";
import type { Activity } from "../types";
import { useWidth } from "../useWidth";

const SHOW_DAYS = 120;
const WARMUP_DAYS = 160; // history before the window, so fitness has settled
const PAD = { top: 10, right: 12, bottom: 22, left: 40 };
const LINES_H = 180;
const FORM_H = 110;
const TONE = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", neutral: "var(--ink-2)" };

/** Fitness (42-day load), fatigue (7-day load) and form, from Garmin's training load. */
export function FitnessCard({ refreshKey }: { refreshKey: number }) {
  const [acts, setActs] = useState<Activity[]>([]);
  useEffect(() => {
    let live = true;
    const today = new Date();
    api.activities(isoDay(addDays(today, -(SHOW_DAYS + WARMUP_DAYS))), isoDay(today))
      .then((a) => live && setActs(a))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [refreshKey]);
  const series = useMemo(() => fitnessSeries(acts, SHOW_DAYS), [acts]);
  const [ref, width] = useWidth<HTMLDivElement>(800);
  const [hover, setHover] = useState<number | null>(null);

  if (series.length < 14) {
    return (
      <section className="card span-12">
        <div className="card-head"><h2>Fitness trend</h2></div>
        <div className="empty">Needs a few weeks of activities with Garmin training load.</div>
      </section>
    );
  }

  const today = series[series.length - 1];
  const sixWeeks = series[Math.max(0, series.length - 43)];
  const fitChange = sixWeeks.fitness > 0 ? ((today.fitness - sixWeeks.fitness) / sixWeeks.fitness) * 100 : null;
  const state = formState(today.form_pct);

  const innerW = Math.max(100, width - PAD.left - PAD.right);
  const x = (i: number) => PAD.left + (i / (series.length - 1)) * innerW;
  const maxLoad = Math.max(10, ...series.map((d) => Math.max(d.fitness, d.fatigue)));
  const yL = (v: number) => PAD.top + (1 - v / (maxLoad * 1.08)) * (LINES_H - PAD.top - PAD.bottom);
  const forms = series.map((d) => d.form_pct ?? 0);
  const fLo = Math.min(-45, ...forms), fHi = Math.max(25, ...forms);
  const yF = (v: number) => PAD.top + ((fHi - v) / (fHi - fLo)) * (FORM_H - PAD.top - PAD.bottom);
  const path = (get: (d: FitnessDay) => number, y: (v: number) => number) =>
    series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(get(d)).toFixed(1)}`).join("");
  const monthTicks = series.map((d, i) => ({ d, i })).filter(({ d }) => parseDay(d.date).getDate() === 1);
  const h = hover != null ? series[hover] : null;
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };
  const hoverRect = (H: number) => (
    <rect x={PAD.left} y={0} width={innerW} height={H} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
  );
  const crosshair = (H: number) =>
    hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--baseline)" pointerEvents="none" />;
  const months = (H: number) =>
    monthTicks.map(({ d, i }) => (
      <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle">
        {parseDay(d.date).toLocaleDateString(undefined, { month: "short" })}
      </text>
    ));

  return (
    <section className="card span-12">
      <div className="card-head">
        <h2>Fitness trend</h2>
        <span className="sub">from Garmin training load · fitness = 42-day average, fatigue = 7-day · last {SHOW_DAYS} days</span>
      </div>
      <div className="fitness">
        <div className="fitness-tiles">
          <div className="tile">
            <div className="k">Fitness</div>
            <div className="v tnum">{Math.round(today.fitness)}</div>
            <div className="d">
              {fitChange == null ? " " : (
                <span style={{ color: fitChange >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {fitChange >= 0 ? "▲ +" : "▼ −"}{Math.abs(Math.round(fitChange))}% in 6 weeks
                </span>
              )}
            </div>
          </div>
          <div className="tile">
            <div className="k">Fatigue</div>
            <div className="v tnum">{Math.round(today.fatigue)}</div>
            <div className="d">{today.fatigue > today.fitness ? "above fitness" : "below fitness"}</div>
          </div>
          <div className="tile">
            <div className="k">Form</div>
            <div className="v tnum" style={{ color: TONE[state.tone] }}>
              {state.icon} {state.label}
            </div>
            <div className="d">{today.form_pct == null ? "" : `${today.form_pct > 0 ? "+" : "−"}${Math.abs(Math.round(today.form_pct))}% · `}{state.detail}</div>
          </div>
        </div>
        <div className="chart-wrap" ref={ref}>
          <svg width={width} height={LINES_H} role="img" aria-label="Fitness and fatigue over time">
            {[0, 0.5, 1].map((t) => {
              const v = Math.round(maxLoad * t);
              return (
                <g key={t}>
                  <line className={t === 0 ? "axis" : "gridline"} x1={PAD.left} x2={width - PAD.right} y1={yL(v)} y2={yL(v)} />
                  <text x={PAD.left - 6} y={yL(v) + 3} textAnchor="end" className="tnum">{v}</text>
                </g>
              );
            })}
            {months(LINES_H)}
            <path d={path((d) => d.fatigue, yL)} fill="none" stroke="var(--series-2)" strokeWidth={1.5} strokeOpacity={0.85} />
            <path d={path((d) => d.fitness, yL)} fill="none" stroke="var(--series-1)" strokeWidth={2} />
            {crosshair(LINES_H)}
            {hover != null && (
              <>
                <circle cx={x(hover)} cy={yL(series[hover].fitness)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
                <circle cx={x(hover)} cy={yL(series[hover].fatigue)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
              </>
            )}
            {hoverRect(LINES_H)}
          </svg>
          <div className="chart-title" style={{ marginTop: 4 }}>
            <span>Form</span>
            <span className="muted">fitness − fatigue, as % of fitness</span>
          </div>
          <svg width={width} height={FORM_H} role="img" aria-label="Form over time">
            <rect x={PAD.left} width={innerW} y={yF(FORM_ZONES.productive)} height={yF(FORM_ZONES.overload) - yF(FORM_ZONES.productive)}
              fill="var(--good)" opacity={0.08} />
            <rect x={PAD.left} width={innerW} y={yF(FORM_ZONES.overload)} height={Math.max(0, yF(fLo) - yF(FORM_ZONES.overload))}
              fill="var(--bad)" opacity={0.07} />
            <line className="axis" x1={PAD.left} x2={width - PAD.right} y1={yF(0)} y2={yF(0)} />
            {[FORM_ZONES.fresh, FORM_ZONES.productive, FORM_ZONES.overload].map((v) => (
              <text key={v} x={PAD.left - 6} y={yF(v) + 3} textAnchor="end" className="tnum">{v > 0 ? `+${v}` : v}%</text>
            ))}
            <text x={width - PAD.right - 4} y={yF((FORM_ZONES.productive + FORM_ZONES.overload) / 2) + 3} textAnchor="end">productive</text>
            <text x={width - PAD.right - 4} y={yF(FORM_ZONES.overload) + 12} textAnchor="end">overload</text>
            {months(FORM_H)}
            <path d={path((d) => d.form_pct ?? 0, yF)} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
            {crosshair(FORM_H)}
            {hover != null && <circle cx={x(hover)} cy={yF(series[hover].form_pct ?? 0)} r={4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />}
            {hoverRect(FORM_H)}
          </svg>
          {h && hover != null && (
            <div className="tip" style={{ left: x(hover), top: yL(Math.max(h.fitness, h.fatigue)) }}>
              <div className="t">{shortDate(h.date, true)}</div>
              <div className="row"><span>Fitness</span><b className="tnum">{Math.round(h.fitness)}</b></div>
              <div className="row"><span>Fatigue</span><b className="tnum">{Math.round(h.fatigue)}</b></div>
              <div className="row"><span>Form</span><b className="tnum">{h.form_pct == null ? "—" : `${Math.round(h.form_pct)}% · ${formState(h.form_pct).label}`}</b></div>
              <div className="row"><span>Load that day</span><b className="tnum">{Math.round(h.load)}</b></div>
            </div>
          )}
          <div className="timing-legend muted" style={{ paddingLeft: PAD.left }}>
            <span><i className="bar" style={{ background: "var(--series-1)" }} /> Fitness</span>
            <span><i className="bar" style={{ background: "var(--series-2)" }} /> Fatigue</span>
            <span><i className="bar" style={{ background: "var(--ink)" }} /> Form</span>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import { parseDay } from "../format";
import type { SleepNight } from "../types";
import { useWidth } from "../useWidth";

const H = 250;
const PAD = { top: 12, right: 12, bottom: 22, left: 28 };

/** Overnight HRV with Garmin's personal "balanced" range as a band. */
export function HrvTrend({ nights }: { nights: SleepNight[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(300);
  const [hover, setHover] = useState<number | null>(null);

  const pts = nights.map((n) => ({ date: n.date, v: n.hrv?.last_night ?? n.avg_hrv }));
  const vals = pts.map((p) => p.v).filter((v): v is number => v != null);
  const latest = [...nights].reverse().find((n) => n.hrv?.baseline_low != null)?.hrv;
  if (vals.length < 2) return <div className="empty">Not enough HRV data yet</div>;

  const lo = Math.floor((Math.min(...vals, latest?.baseline_low ?? Infinity) - 5) / 10) * 10;
  const hi = Math.ceil((Math.max(...vals, latest?.baseline_high ?? -Infinity) + 5) / 10) * 10;
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const ticks = Array.from({ length: Math.floor((hi - lo) / 10) + 1 }, (_, i) => lo + i * 10);

  let d = "";
  pts.forEach((p, i) => {
    if (p.v == null) return;
    d += `${d && pts[i - 1]?.v != null ? "L" : "M"}${x(i)},${y(p.v)}`;
  });
  const last = pts.length - 1;
  const hp = hover != null ? pts[hover] : null;

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Overnight HRV trend"
        onMouseMove={(e) => {
          const bx = e.currentTarget.getBoundingClientRect().left;
          const i = Math.round(((e.clientX - bx - PAD.left) / innerW) * (pts.length - 1));
          setHover(Math.max(0, Math.min(last, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="tnum">{t}</text>
          </g>
        ))}
        {latest?.baseline_low != null && latest.baseline_high != null && (
          <rect
            x={PAD.left}
            width={innerW}
            y={y(latest.baseline_high)}
            height={y(latest.baseline_low) - y(latest.baseline_high)}
            fill="var(--better)"
            opacity={0.1}
          />
        )}
        <path d={d} fill="none" stroke="var(--better)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts[last].v != null && (
          <circle cx={x(last)} cy={y(pts[last].v!)} r={4} fill="var(--better)" stroke="var(--surface)" strokeWidth={2} />
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
          <div className="row">HRV <b>{hp.v != null ? `${Math.round(hp.v)} ms` : "—"}</b></div>
          {latest?.baseline_low != null && (
            <div className="row">Balanced <b>{latest.baseline_low}–{latest.baseline_high}</b></div>
          )}
        </div>
      )}
    </div>
  );
}

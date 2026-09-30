import { type ReactNode, useState } from "react";
import { parseDay, shortDate } from "../format";
import { useWidth } from "../useWidth";

export interface TrendPoint {
  date: string;
  value: number;
  name?: string;
  key?: string | null;
  /** Garmin activity id, when the point is a session */
  id?: number;
}

/** Place a tooltip beside (not above) the point, flipping to stay inside the chart. */
export function sideTip(x: number, y: number, width: number, height: number) {
  const right = x > width * 0.55;
  return {
    left: x,
    top: Math.max(8, Math.min(height - 8, y)),
    transform: `translate(${right ? "calc(-100% - 14px)" : "14px"}, ${y < height * 0.3 ? "-10%" : y > height * 0.7 ? "-90%" : "-50%"})`,
  };
}
const PAD = { top: 12, right: 14, bottom: 22, left: 44 };
const DAY = 86_400_000;

/** Rolling mean over the previous `days` days (inclusive) for each point. */
function rolling(points: TrendPoint[], days: number) {
  return points.map((p, i) => {
    const t = parseDay(p.date).getTime();
    const win = points.slice(0, i + 1).filter((q) => t - parseDay(q.date).getTime() < days * DAY);
    return win.reduce((s, q) => s + q.value, 0) / win.length;
  });
}

export function TrendChart({
  points,
  color,
  format,
  invert = false,
  lineOnly = false,
  start,
  end,
  height = 200,
  renderTip,
}: {
  points: TrendPoint[];
  color: string;
  format: (v: number) => string;
  /** true when lower is better (pace, SWOLF): the axis is flipped so "up" always means better */
  invert?: boolean;
  lineOnly?: boolean;
  start: string;
  end: string;
  height?: number;
  /** Detailed hover card (expanded view); gets the point and its 4-week average. */
  renderTip?: (p: TrendPoint, avg: number | null) => ReactNode;
}) {
  const H = height;
  const [ref, width] = useWidth<HTMLDivElement>(300);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="empty">Not enough sessions in this range yet</div>;

  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || 1;
  const [y0, y1] = [lo - pad, hi + pad];
  const t0 = parseDay(start).getTime();
  const t1 = parseDay(end).getTime();
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (d: string) => PAD.left + ((parseDay(d).getTime() - t0) / Math.max(t1 - t0, DAY)) * innerW;
  const y = (v: number) => {
    const f = (v - y0) / (y1 - y0);
    return PAD.top + (invert ? f : 1 - f) * innerH;
  };
  // Quality and base sessions aren't comparable (a VO₂ run is faster than an easy
  // run by design), so each group gets its own rolling average.
  const hasKey = points.some((p) => p.key);
  const hasBase = points.some((p) => !p.key);
  const split = !lineOnly && hasKey && hasBase;
  const groups = split
    ? [
        { id: "key", label: "Key sessions", color, pts: points.filter((p) => p.key) },
        { id: "base", label: "Base sessions", color: "var(--ink-2)", pts: points.filter((p) => !p.key) },
      ]
    : [{ id: "all", label: "", color, pts: points }];
  const lines = groups.map((g) => {
    const avg = lineOnly ? g.pts.map((p) => p.value) : rolling(g.pts, 28);
    return { ...g, avg, d: g.pts.map((p, i) => `${i ? "L" : "M"}${x(p.date)},${y(avg[i])}`).join("") };
  });
  const avgFor = (p: TrendPoint) => {
    const l = lines.find((ln) => ln.pts.includes(p));
    return l ? l.avg[l.pts.indexOf(p)] : p.value;
  };
  const ticks = [y0 + (y1 - y0) * 0.1, (y0 + y1) / 2, y1 - (y1 - y0) * 0.1];
  const months: string[] = [];
  for (let d = new Date(parseDay(start)); d <= parseDay(end); d.setMonth(d.getMonth() + 1, 1)) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  const monthTicks = months.filter((m) => m >= start).filter((_, i, arr) => arr.length <= 7 || i % 2 === 0);
  const hp = hover != null ? points[hover] : null;

  return (
    <div
      className="chart-wrap"
      ref={ref}
      onMouseMove={(e) => {
        const bx = e.currentTarget.getBoundingClientRect().left;
        const mx = e.clientX - bx;
        let best = 0;
        points.forEach((p, i) => {
          if (Math.abs(x(p.date) - mx) < Math.abs(x(points[best].date) - mx)) best = i;
        });
        setHover(best);
      }}
      onMouseLeave={() => setHover(null)}
    >
      <svg width={width} height={H} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="tnum">{format(t)}</text>
          </g>
        ))}
        {monthTicks.map((m) => (
          <text key={m} x={x(m)} y={H - 6} textAnchor="middle">
            {parseDay(m).toLocaleDateString(undefined, { month: "short" })}
          </text>
        ))}
        {!lineOnly &&
          points.map((p, i) => {
            const c = split && !p.key ? "var(--ink-2)" : color;
            return (
              <circle
                key={i}
                cx={x(p.date)} cy={y(p.value)} r={renderTip && hover === i ? 7 : 4}
                fill={p.key || !split ? c : "var(--surface)"}
                stroke={c} strokeWidth={p.key || !split ? 0 : 1.5}
                opacity={hover === i ? 1 : 0.4}
              />
            );
          })}
        {lines.map((l) => (
          <g key={l.id}>
            <path d={l.d} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {l.pts.length > 0 && (
              <circle
                cx={x(l.pts[l.pts.length - 1].date)} cy={y(l.avg[l.avg.length - 1])} r={4}
                fill={l.color} stroke="var(--surface)" strokeWidth={2}
              />
            )}
          </g>
        ))}
        {hp && hover != null && (
          <line x1={x(hp.date)} x2={x(hp.date)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--baseline)" />
        )}
      </svg>
      {split && (
        <div className="legend" style={{ marginTop: 2 }}>
          <span><span className="sw" style={{ background: color, borderRadius: "50%" }} />Key sessions</span>
          <span><span className="sw" style={{ border: "1.5px solid var(--ink-2)", borderRadius: "50%", background: "transparent" }} />Base sessions</span>
        </div>
      )}
      {hp && hover != null && renderTip && (
        <div className="tip rich" style={sideTip(x(hp.date), y(hp.value), width, H)}>
          {renderTip(hp, lineOnly ? null : avgFor(hp))}
        </div>
      )}
      {hp && hover != null && !renderTip && (
        <div className="tip" style={{ left: x(hp.date), top: y(hp.value) }}>
          <div className="t">{shortDate(hp.date, true)}</div>
          {hp.name && <div className="row">{hp.name}{hp.key ? " ★" : ""}</div>}
          <div className="row">{lineOnly ? "Value" : "Session"} <b>{format(hp.value)}</b></div>
          {!lineOnly && (
            <div className="row">
              4-week avg{split ? (hp.key ? " (key)" : " (base)") : ""} <b>{format(avgFor(hp))}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

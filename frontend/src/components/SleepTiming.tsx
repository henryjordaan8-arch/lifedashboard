import { useState } from "react";
import { parseDay } from "../format";
import type { SleepNight, SleepTargets } from "../types";
import { useWidth } from "../useWidth";

const NIGHTS = 14;
const ON_TARGET_MIN = 30;
const PAD = { top: 8, right: 16, bottom: 22, left: 64 };
const ROW = 16;

/** Minutes since noon, so a night (evening → morning) is one increasing range. */
function sinceNoon(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h * 60 + m - 720 + 1440) % 1440;
}
const clockOf = (m: number) => {
  const t = (Math.round(m) + 720) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const signed = (m: number) => `${m > 0 ? "+" : m < 0 ? "−" : "±"}${Math.abs(Math.round(m))} min`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
};

/** Lights-out and wake-up times of the last two weeks against the routine's targets (inside the Sleep card). */
export function SleepTiming({ nights, targets }: { nights: SleepNight[]; targets: SleepTargets }) {
  const [ref, width] = useWidth<HTMLDivElement>(700);
  const [hover, setHover] = useState<number | null>(null);
  const rows = nights
    .filter((n) => n.start && n.end)
    .slice(-NIGHTS)
    .map((n) => ({ n, bed: sinceNoon(n.start!.slice(11, 16)), wake: sinceNoon(n.end!.slice(11, 16)) }));

  const bedT = sinceNoon(targets.bed), wakeT = sinceNoon(targets.wake);
  if (!rows.length) return null;

  const beds = rows.map((r) => r.bed), wakes = rows.map((r) => r.wake);
  const lo = Math.floor((Math.min(...beds, bedT) - 30) / 60) * 60;
  const hi = Math.ceil((Math.max(...wakes, wakeT) + 30) / 60) * 60;
  const innerW = Math.max(100, width - PAD.left - PAD.right);
  const x = (m: number) => PAD.left + ((m - lo) / (hi - lo)) * innerW;
  const H = PAD.top + rows.length * ROW + PAD.bottom;
  const ticks: number[] = [];
  for (let m = lo; m <= hi; m += (hi - lo) / 60 > 10 ? 120 : 60) ticks.push(m);

  const bedDrift = mean(beds) - bedT, wakeDrift = mean(wakes) - wakeT;
  const onTarget = rows.filter((r) => Math.abs(r.bed - bedT) <= ON_TARGET_MIN).length;
  const h = hover != null ? rows[hover] : null;

  return (
    <div className="sleep-timing">
      <div className="chart-title">
        <span>Sleep timing</span>
        <span className="muted">last {rows.length} nights vs your routine · lights out {targets.bed} · wake {targets.wake}</span>
      </div>
      <div className="timing">
        <div className="timing-stats">
          <div className="tile">
            <div className="k">Avg lights out</div>
            <div className="v tnum">{clockOf(mean(beds))}</div>
            <div className="d">{signed(bedDrift)} vs {targets.bed}</div>
          </div>
          <div className="tile">
            <div className="k">Avg wake-up</div>
            <div className="v tnum">{clockOf(mean(wakes))}</div>
            <div className="d">{signed(wakeDrift)} vs {targets.wake}</div>
          </div>
          <div className="tile">
            <div className="k">Bedtime spread</div>
            <div className="v tnum">±{Math.round(sd(beds))} min</div>
            <div className="d">night to night</div>
          </div>
          <div className="tile">
            <div className="k">On target</div>
            <div className="v tnum">{onTarget}/{rows.length}</div>
            <div className="d">lights out ±{ON_TARGET_MIN} min</div>
          </div>
        </div>
        <div className="chart-wrap" ref={ref}>
          <svg width={width} height={H} role="img" aria-label="Sleep start and end per night against target times">
            {ticks.map((t) => (
              <g key={t}>
                <line className="gridline" x1={x(t)} x2={x(t)} y1={PAD.top} y2={H - PAD.bottom} />
                <text x={x(t)} y={H - 6} textAnchor="middle" className="tnum">{clockOf(t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const y = PAD.top + i * ROW;
              return (
                <g key={r.n.date} opacity={hover == null || hover === i ? 1 : 0.45}>
                  <text x={PAD.left - 8} y={y + ROW / 2 + 3} textAnchor="end">
                    {parseDay(r.n.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                  </text>
                  <rect x={x(r.bed)} y={y + 4} width={Math.max(2, x(r.wake) - x(r.bed))} height={ROW - 8} rx={4}
                    fill="var(--accent)" />
                  <rect x={PAD.left} y={y} width={innerW} height={ROW} fill="transparent"
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                </g>
              );
            })}
            {[bedT, wakeT].map((m) => (
              <line key={m} x1={x(m)} x2={x(m)} y1={PAD.top - 2} y2={H - PAD.bottom} pointerEvents="none"
                stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" />
            ))}
          </svg>
          {h && hover != null && (
            <div className="tip" style={{ left: x((h.bed + h.wake) / 2), top: PAD.top + hover * ROW }}>
              <div className="t">{parseDay(h.n.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</div>
              <div className="row"><span>Lights out</span><b className="tnum">{clockOf(h.bed)} ({signed(h.bed - bedT)})</b></div>
              <div className="row"><span>Woke</span><b className="tnum">{clockOf(h.wake)} ({signed(h.wake - wakeT)})</b></div>
              <div className="row"><span>Asleep</span><b className="tnum">{(h.n.duration_s / 3600).toFixed(1)} h</b></div>
            </div>
          )}
          <div className="timing-legend muted">
            <span><i className="bar" /> asleep</span>
            <span><i className="dash" /> routine targets</span>
          </div>
        </div>
      </div>
    </div>
  );
}

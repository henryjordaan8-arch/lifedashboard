import { type ReactNode, useState } from "react";
import { duration, shortDate } from "../format";
import type { SportData } from "../types";
import { useWidth } from "../useWidth";
import { sideTip } from "./TrendChart";

type Measure = "distance" | "time" | "load";
const PAD = { top: 16, right: 8, bottom: 24, left: 40 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) ?? v;
}

function topRounded(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

type Week = SportData["weekly"][number];

export function WeeklyVolumeChart({
  data,
  color,
  unitKm = "km",
  height = 220,
  renderTip,
}: {
  data: SportData;
  color: string;
  unitKm?: string;
  height?: number;
  /** Detailed hover card (expanded view). */
  renderTip?: (week: Week) => ReactNode;
}) {
  const H = height;
  const [ref, width] = useWidth<HTMLDivElement>();
  const [measure, setMeasure] = useState<Measure>("distance");
  const [hover, setHover] = useState<number | null>(null);
  const weeks = data.weekly;
  const val = (w: Week) =>
    measure === "distance" ? w.distance_km : measure === "time" ? w.duration_h : w.load;
  const max = niceMax(Math.max(...weeks.map(val), 0));
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / Math.max(weeks.length, 1);
  const barW = Math.max(3, Math.min(24, band - 4));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const unit = measure === "distance" ? unitKm : measure === "time" ? "h" : "";
  const fmt = (v: number) => (measure === "time" ? duration(v * 3600) : `${Math.round(v * 10) / 10}${unit ? ` ${unit}` : ""}`);
  const labelEvery = Math.ceil(weeks.length / 8);
  const hw = hover != null ? weeks[hover] : null;

  return (
    <div>
      <div className="chart-title">
        <span>Weekly volume</span>
        <div className="seg" role="tablist" aria-label="Measure">
          {(["distance", "time", "load"] as Measure[]).map((m) => (
            <button key={m} className={measure === m ? "on" : ""} onClick={() => setMeasure(m)}>
              {m === "distance" ? "Distance" : m === "time" ? "Time" : "Load"}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-wrap" ref={ref}>
        <svg width={width} height={H} role="img" aria-label={`Weekly ${measure}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? "axis" : "gridline"} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="tnum">
                {measure === "time" ? `${Math.round(t * 10) / 10}h` : max < 10 ? Math.round(t * 10) / 10 : Math.round(t)}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const v = val(w);
            const x = PAD.left + band * i + (band - barW) / 2;
            return (
              <g key={w.week_start} opacity={hover == null || hover === i ? 1 : 0.45}>
                {v > 0 && <path d={topRounded(x, y(v), barW, y(0) - y(v), 4)} fill={color} />}
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle">{shortDate(w.week_start)}</text>
                )}
                <rect
                  x={PAD.left + band * i} y={PAD.top} width={band} height={innerH} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hw && hover != null && renderTip && (
          <div className="tip rich" style={sideTip(PAD.left + band * hover + band / 2, y(val(hw)), width, H)}>
            {renderTip(hw)}
          </div>
        )}
        {hw && hover != null && !renderTip && (
          <div className="tip" style={{ left: PAD.left + band * hover + band / 2, top: y(val(hw)) }}>
            <div className="t">Week of {shortDate(hw.week_start)}</div>
            <div className="row">Distance <b>{hw.distance_km} {unitKm}</b></div>
            <div className="row">Time <b>{duration(hw.duration_h * 3600)}</b></div>
            <div className="row">Sessions <b>{hw.sessions}{hw.key_sessions ? ` (${hw.key_sessions} key)` : ""}</b></div>
            <div className="row">Load <b>{Math.round(hw.load)}</b></div>
          </div>
        )}
      </div>
      <div className="sr-only">{weeks.map((w) => `${w.week_start}: ${fmt(val(w))}`).join("; ")}</div>
    </div>
  );
}

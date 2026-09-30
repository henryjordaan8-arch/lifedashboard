import { useState } from "react";
import { duration, parseDay, titleCase } from "../format";
import type { SleepNight } from "../types";
import { useWidth } from "../useWidth";

const STAGES = [
  { key: "deep_s", label: "Deep", color: "var(--stage-deep)" },
  { key: "light_s", label: "Light", color: "var(--stage-light)" },
  { key: "rem_s", label: "REM", color: "var(--stage-rem)" },
  { key: "awake_s", label: "Awake", color: "var(--stage-awake)" },
] as const;

const H = 250;
const PAD = { top: 10, right: 4, bottom: 22, left: 26 };
const GAP = 2;

/** Rect with only the top corners rounded (data-end rounded, baseline square). */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function SleepStagesChart({ nights }: { nights: SleepNight[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxH = Math.max(10, Math.ceil(Math.max(...nights.map((n) => (n.duration_s + n.awake_s) / 3600))));
  const y = (hours: number) => PAD.top + innerH - (hours / maxH) * innerH;
  const band = innerW / Math.max(nights.length, 1);
  const barW = Math.min(24, band * 0.6);
  const ticks = [0, 2, 4, 6, 8, 10, 12].filter((t) => t <= maxH);

  const hovered = hover != null ? nights[hover] : null;

  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={width} height={H} role="img" aria-label="Sleep stages per night">
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "axis" : "gridline"} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="tnum">{t}h</text>
          </g>
        ))}
        {nights.map((n, i) => {
          const cx = PAD.left + band * i + band / 2;
          const x = cx - barW / 2;
          let acc = 0;
          const segs = STAGES.map((s) => ({ ...s, hours: (n[s.key] as number) / 3600 })).filter((s) => s.hours > 0);
          return (
            <g key={n.date} opacity={hover == null || hover === i ? 1 : 0.45}>
              {segs.map((s, j) => {
                const y0 = y(acc);
                acc += s.hours;
                const y1 = y(acc);
                const top = j === segs.length - 1;
                const h = Math.max(0, y0 - y1 - (j > 0 ? GAP : 0));
                return top ? (
                  <path key={s.key} d={topRounded(x, y1, barW, h, 4)} fill={s.color} />
                ) : (
                  <rect key={s.key} x={x} y={y1} width={barW} height={h} fill={s.color} />
                );
              })}
              <text x={cx} y={H - 6} textAnchor="middle">
                {parseDay(n.date).toLocaleDateString(undefined, { weekday: "narrow" })}
              </text>
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {hovered && hover != null && (
        <div className="tip" style={{ left: PAD.left + band * hover + band / 2, top: y((hovered.duration_s + hovered.awake_s) / 3600) }}>
          <div className="t">
            {parseDay(hovered.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
          </div>
          <div className="row">Asleep <b>{duration(hovered.duration_s)}</b></div>
          <div className="row">Score <b>{hovered.score ?? "—"} {hovered.score_label ? `· ${titleCase(hovered.score_label)}` : ""}</b></div>
          {STAGES.map((s) => (
            <div className="row" key={s.key}>
              <span><span className="sw" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 6 }} />{s.label}</span>
              <b>{duration(hovered[s.key] as number)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { STAGES };

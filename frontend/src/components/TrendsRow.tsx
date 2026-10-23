import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { addDays, duration, isoDay, shortDate } from "../format";
import { goodDayInsights, type IntensityWeek, intensityWeeks, MIN_PAIRS, strength } from "../insights";
import type { Activity, SleepNight } from "../types";
import { useWidth } from "../useWidth";

const WEEKS = 12;
const EASY_TARGET = 0.8;

/** Dashboard row: what predicts your good days, and the 80/20 intensity balance. */
export function TrendsRow({ refreshKey }: { refreshKey: number }) {
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [acts, setActs] = useState<Activity[]>([]);
  useEffect(() => {
    let live = true;
    const today = new Date();
    Promise.all([api.sleep(91), api.activities(isoDay(addDays(today, -140)), isoDay(today))])
      .then(([s, a]) => live && (setNights(s.nights), setActs(a)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [refreshKey]);

  const insights = useMemo(() => goodDayInsights(nights, acts), [nights, acts]);
  const weeks = useMemo(() => intensityWeeks(acts, WEEKS), [acts]);
  return (
    <>
      <GoodDaysCard insights={insights} />
      <IntensityCard weeks={weeks} />
    </>
  );
}

function GoodDaysCard({ insights }: { insights: ReturnType<typeof goodDayInsights> }) {
  const top = insights.factors[0];
  const lead = top && Math.abs(top.r) >= 0.3
    ? `Your steady sessions were ${Math.abs(top.spread).toFixed(1)}% ${top.spread >= 0 ? "more" : "less"} efficient when “${top.label.toLowerCase()}” was in its highest third than in its lowest.`
    : null;
  return (
    <section className="card span-6">
      <div className="card-head">
        <h2>What predicts your good days</h2>
        <span className="sub">{insights.sessions} steady runs & rides · last 90 days</span>
      </div>
      {!insights.factors.length ? (
        <div className="empty">
          Needs at least {MIN_PAIRS} steady runs or rides with heart rate (and sleep data) to compare. Keep training, it fills in.
        </div>
      ) : (
        <>
          {lead && <p className="insight-lead">{lead}</p>}
          <div className="factors">
            <div className="factor head muted">
              <span>That morning…</span><span className="axis-lbl"><span>worse</span><span>better</span></span><span>link</span><span>top vs bottom ⅓</span>
            </div>
            {insights.factors.map((f) => (
              <div className="factor" key={f.key} title={`${f.n} sessions · correlation ${f.r.toFixed(2)}`}>
                <span>{f.label}</span>
                <span className="dbar" aria-hidden>
                  <i style={f.r >= 0
                    ? { left: "50%", width: `${Math.abs(f.r) * 50}%`, background: "var(--accent)" }
                    : { right: "50%", width: `${Math.abs(f.r) * 50}%`, background: "var(--bad)" }} />
                </span>
                <span className="tnum">{f.r >= 0 ? "+" : "−"}{Math.abs(f.r).toFixed(2)} <span className="muted">{strength(f.r)}</span></span>
                <span className="tnum">{f.spread >= 0 ? "+" : "−"}{Math.abs(f.spread).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <p className="note">
            Session quality is output per heartbeat (pace or power) compared with your normal for that sport over the
            previous 6 weeks. Bars to the right mean higher values went with better sessions. This shows links, not proof
            of cause, and gets more reliable as sessions build up.
          </p>
        </>
      )}
    </section>
  );
}

const PAD = { top: 10, right: 8, bottom: 22, left: 34 };
const H = 170;
const GAP = 2;
const BANDS = [
  { key: "easy_s", label: "Easy (Z1–2)", color: "var(--zone-1)" },
  { key: "moderate_s", label: "Moderate (Z3)", color: "var(--zone-3)" },
  { key: "hard_s", label: "Hard (Z4–5)", color: "var(--zone-5)" },
] as const;

function IntensityCard({ weeks }: { weeks: IntensityWeek[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(500);
  const [hover, setHover] = useState<number | null>(null);
  const total = (w: IntensityWeek) => w.easy_s + w.moderate_s + w.hard_s;
  const withData = weeks.filter((w) => total(w) > 0);
  const full = withData.filter((w) => w !== weeks[weeks.length - 1]);
  const share = (ws: IntensityWeek[]) => {
    const t = ws.reduce((s, w) => s + total(w), 0);
    return t ? ws.reduce((s, w) => s + w.easy_s, 0) / t : null;
  };
  const avg = share(full);
  const hits = full.filter((w) => w.easy_s / total(w) >= EASY_TARGET).length;
  const now = weeks[weeks.length - 1];
  const nowShare = now && total(now) ? now.easy_s / total(now) : null;

  const innerW = Math.max(100, width - PAD.left - PAD.right);
  const band = innerW / weeks.length;
  const barW = Math.min(28, band * 0.6);
  const y = (p: number) => PAD.top + (1 - p) * (H - PAD.top - PAD.bottom);
  const h = hover != null ? weeks[hover] : null;
  const pct = (v: number, t: number) => `${Math.round((v / t) * 100)}%`;

  return (
    <section className="card span-6">
      <div className="card-head">
        <h2>Intensity balance (80/20)</h2>
        <span className="sub">all sports · time in heart-rate zones · last {WEEKS} weeks</span>
      </div>
      {!withData.length ? (
        <div className="empty">No heart-rate zone data in the last {WEEKS} weeks.</div>
      ) : (
        <>
          <div className="mini-tiles three">
            <div className="tile">
              <div className="k">Easy share</div>
              <div className="v tnum">{avg == null ? "—" : `${Math.round(avg * 100)}%`}</div>
              <div className="d">{avg == null ? " " : avg >= EASY_TARGET ? "✓ on the 80% target" : `${Math.round((EASY_TARGET - avg) * 100)} pts under 80%`}</div>
            </div>
            <div className="tile">
              <div className="k">Weeks at 80%+</div>
              <div className="v tnum">{hits}/{full.length}</div>
              <div className="d">complete weeks</div>
            </div>
            <div className="tile">
              <div className="k">This week</div>
              <div className="v tnum">{nowShare == null ? "—" : `${Math.round(nowShare * 100)}%`}</div>
              <div className="d">easy so far</div>
            </div>
          </div>
          <div className="chart-wrap" ref={ref}>
            <svg width={width} height={H} role="img" aria-label="Weekly share of easy, moderate and hard training">
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <line className={t === 0 ? "axis" : "gridline"} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
                  <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="tnum">{t * 100}%</text>
                </g>
              ))}
              {weeks.map((w, i) => {
                const t = total(w);
                const x = PAD.left + band * i + (band - barW) / 2;
                let acc = 0;
                return (
                  <g key={w.week_start} opacity={hover == null || hover === i ? 1 : 0.45}>
                    {t > 0 && BANDS.map((b, j) => {
                      const v = w[b.key] / t;
                      if (v <= 0) return null;
                      const y0 = y(acc), y1 = y(acc + v);
                      acc += v;
                      const hh = Math.max(0, y0 - y1 - (j > 0 ? GAP : 0));
                      return <rect key={b.key} x={x} y={y1} width={barW} height={hh} rx={j === 2 || acc >= 0.999 ? 3 : 0} fill={b.color} />;
                    })}
                    {i % 2 === (weeks.length - 1) % 2 && (
                      <text x={x + barW / 2} y={H - 6} textAnchor="middle">{shortDate(w.week_start)}</text>
                    )}
                    <rect x={PAD.left + band * i} y={PAD.top} width={band} height={H - PAD.top - PAD.bottom} fill="transparent"
                      onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                  </g>
                );
              })}
              <line x1={PAD.left} x2={width - PAD.right} y1={y(EASY_TARGET)} y2={y(EASY_TARGET)} stroke="var(--ink)"
                strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />
            </svg>
            {h && hover != null && total(h) > 0 && (
              <div className="tip" style={{ left: PAD.left + band * hover + band / 2, top: y(1) + 10 }}>
                <div className="t">Week of {shortDate(h.week_start)}{hover === weeks.length - 1 ? " (so far)" : ""}</div>
                {BANDS.map((b) => (
                  <div className="row" key={b.key}>
                    <span>{b.label}</span>
                    <b className="tnum">{duration(h[b.key])} · {pct(h[b.key], total(h))}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="timing-legend muted" style={{ paddingLeft: PAD.left }}>
            {BANDS.map((b) => <span key={b.key}><i className="bar" style={{ background: b.color }} /> {b.label}</span>)}
            <span><i className="dash" /> 80% easy target</span>
          </div>
        </>
      )}
    </section>
  );
}

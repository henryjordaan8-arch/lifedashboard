import { clock, duration, parseDay, titleCase } from "../format";
import type { SleepNight } from "../types";
import { HrvTrend } from "./HrvTrend";
import { SleepStagesChart, STAGES } from "./SleepStagesChart";

function avg(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function Delta({ now, base, unit = "", invert = false }: { now: number | null; base: number | null; unit?: string; invert?: boolean }) {
  if (now == null || base == null) return <div className="d">&nbsp;</div>;
  const diff = now - base;
  const r = Math.round(diff * 10) / 10;
  if (Math.abs(r) < 0.5) return <div className="d">≈ 7-day avg</div>;
  const better = invert ? diff < 0 : diff > 0;
  return (
    <div className="d">
      <span style={{ color: better ? "var(--good)" : "var(--ink-2)" }}>{r > 0 ? "▲" : "▼"} {Math.abs(Math.round(r))}{unit}</span> vs 7-day
    </div>
  );
}

export function SleepCard({ nights }: { nights: SleepNight[] }) {
  if (!nights.length) {
    return (
      <section className="card span-8">
        <div className="card-head"><h2>Sleep</h2></div>
        <div className="empty">No sleep data yet — it appears after the first sync.</div>
      </section>
    );
  }
  const last = nights[nights.length - 1];
  const prev7 = nights.slice(-8, -1);
  const recent = nights.slice(-14);
  const total = last.deep_s + last.light_s + last.rem_s + last.awake_s;
  const hrv = last.hrv?.last_night ?? last.avg_hrv;

  return (
    <section className="card span-8">
      <div className="card-head">
        <h2>Sleep</h2>
        <span className="sub">
          Last night · {parseDay(last.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      <div className="sleep-top">
        <div>
          <div className="hero">
            <span className="big tnum">{duration(last.duration_s)}</span>
            {last.score != null && (
              <span className="score-badge">
                <span className="v">{last.score}</span>
                <span className="l">{titleCase(last.score_label) || "Score"}</span>
              </span>
            )}
          </div>
          <div className="times">
            {clock(last.start)} → {clock(last.end)}
            <span className="muted"> · 7-night avg {duration(avg(prev7.map((n) => n.duration_s)))}</span>
          </div>
          <div className="stagebar" role="img" aria-label="Last night's sleep stages">
            {STAGES.map((s) => {
              const v = last[s.key] as number;
              return v > 0 ? <div key={s.key} style={{ width: `${(v / total) * 100}%`, background: s.color }} /> : null;
            })}
          </div>
          <div className="legend">
            {STAGES.map((s) => (
              <span key={s.key}>
                <span className="sw" style={{ background: s.color }} />
                {s.label}<b className="tnum">{duration(last[s.key] as number)}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="tiles">
          <div className="tile">
            <div className="k">HRV</div>
            <div className="v tnum">{hrv != null ? Math.round(hrv) : "—"}<small>ms</small></div>
            <div className="d">{titleCase(last.hrv?.status) || " "}</div>
          </div>
          <div className="tile">
            <div className="k">Resting HR</div>
            <div className="v tnum">{last.resting_hr ?? "—"}<small>bpm</small></div>
            <Delta now={last.resting_hr} base={avg(prev7.map((n) => n.resting_hr))} invert />
          </div>
          <div className="tile">
            <div className="k">Body Battery</div>
            <div className="v tnum">{last.body_battery_wake ?? "—"}</div>
            <div className="d">{last.body_battery_change != null ? `+${last.body_battery_change} overnight` : " "}</div>
          </div>
          <div className="tile">
            <div className="k">Sleep score</div>
            <div className="v tnum">{last.score ?? "—"}</div>
            <Delta now={last.score} base={avg(prev7.map((n) => n.score))} />
          </div>
          <div className="tile">
            <div className="k">SpO₂</div>
            <div className="v tnum">{last.spo2 != null ? Math.round(last.spo2) : "—"}<small>%</small></div>
            <div className="d">&nbsp;</div>
          </div>
          <div className="tile">
            <div className="k">Respiration</div>
            <div className="v tnum">{last.respiration?.toFixed(1) ?? "—"}<small>brpm</small></div>
            <div className="d">&nbsp;</div>
          </div>
        </div>
      </div>

      <div className="sleep-charts">
        <div>
          <div className="chart-title">
            <span>Last 14 nights</span>
            <span className="muted">Hover a night for details</span>
          </div>
          <SleepStagesChart nights={recent} />
        </div>
        <div>
          <div className="chart-title">
            <span>Overnight HRV (ms)</span>
            <span className="muted">Band = your balanced range</span>
          </div>
          <HrvTrend nights={recent} />
        </div>
      </div>
    </section>
  );
}

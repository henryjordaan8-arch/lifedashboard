import { duration, km, parseDay, SPORT_LABEL, titleCase } from "../format";
import type { Readiness, ReadinessInput } from "../types";

/** Diverging bar: how far today sits from your baseline, oriented so right = better. */
function DeviationBar({ effect }: { effect: number | null }) {
  const W = 92;
  const H = 8;
  const mid = W / 2;
  if (effect == null) return <svg width={W} height={H}><rect x={0} y={3} width={W} height={2} rx={1} fill="var(--neutral)" /></svg>;
  const len = (Math.min(Math.abs(effect), 2.5) / 2.5) * mid;
  const color = effect >= 0 ? "var(--better)" : "var(--worse)";
  return (
    <svg width={W} height={H} aria-hidden>
      <rect x={0} y={3} width={W} height={2} rx={1} fill="var(--neutral)" />
      <rect x={effect >= 0 ? mid : mid - len} y={0} width={Math.max(len, 2)} height={H} rx={3} fill={color} />
      <line x1={mid} x2={mid} y1={-2} y2={H + 2} stroke="var(--baseline)" />
    </svg>
  );
}

function fmt(v: number | null, key: string) {
  if (v == null) return "—";
  return key === "sleep_hours" ? v.toFixed(1) : Math.round(v).toString();
}

function describe(i: ReadinessInput) {
  if (i.effect == null) return "no baseline yet";
  const a = Math.abs(i.effect);
  if (a < 0.5) return "normal";
  const word = i.effect > 0 ? "better" : "worse";
  return `${a >= 1.5 ? "much " : ""}${word}`;
}

function loadZone(ratio: number | null) {
  if (ratio == null) return { label: "Not enough history", icon: "·", color: "var(--muted)" };
  if (ratio < 0.8) return { label: "Below usual — fresh / detraining", icon: "▽", color: "var(--ink-2)" };
  if (ratio <= 1.3) return { label: "In your usual range", icon: "●", color: "var(--good)" };
  if (ratio <= 1.5) return { label: "Ramping up — watch recovery", icon: "▲", color: "var(--warn)" };
  return { label: "Spike — elevated injury risk", icon: "▲", color: "var(--bad)" };
}

function Ring({ score }: { score: number | null }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const frac = score == null ? 0 : score / 100;
  return (
    <svg className="ring" viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="var(--grid)" strokeWidth={5} />
      <circle
        cx={28} cy={28} r={r} fill="none" stroke="var(--muted)" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 28 28)"
      />
      <text x={28} y={32} textAnchor="middle" style={{ fontSize: 14, fontWeight: 650, fill: "var(--ink)" }}>
        {score ?? "—"}
      </text>
    </svg>
  );
}

export function ReadinessCard({ data }: { data: Readiness | null }) {
  const zone = loadZone(data?.load.ratio ?? null);
  return (
    <section className="card span-4">
      <div className="card-head">
        <h2>Readiness</h2>
        <span className="sub">vs your {data?.baseline_days ?? 28}-day baseline</span>
      </div>

      <div className="ready-hero">
        <Ring score={data?.garmin?.score ?? null} />
        <div className="txt">
          <b>Our score: not designed yet</b>
          Garmin's own estimate shown for reference
          {data?.garmin?.level ? ` · ${titleCase(data.garmin.level)}` : ""}. The ingredients are below.
        </div>
      </div>

      {data ? (
        <div className="inputs">
          {data.inputs.map((i) => (
            <div className="input-row" key={i.key}>
              <div>
                <div className="name">{i.label}</div>
                <div className="vals tnum">
                  <b>{fmt(i.today, i.key)}{i.unit && ` ${i.unit}`}</b>
                  avg {fmt(i.baseline_mean, i.key)}
                </div>
              </div>
              <div>
                <DeviationBar effect={i.effect} />
                <div className="dev">{describe(i)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Loading…</div>
      )}

      {data && (
        <div className="load">
          <div>
            <div className="k">Acute (7d)</div>
            <div className="v tnum">{Math.round(data.load.acute)}</div>
          </div>
          <div>
            <div className="k">Chronic (28d)</div>
            <div className="v tnum">{Math.round(data.load.chronic)}</div>
          </div>
          <div>
            <div className="k">Ratio</div>
            <div className="v tnum">{data.load.ratio?.toFixed(2) ?? "—"}</div>
          </div>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--ink-2)" }}>
            <span style={{ color: zone.color, marginRight: 6 }}>{zone.icon}</span>
            {zone.label}
          </div>
        </div>
      )}
      {data?.fitness && (
        <div className="load">
          <div>
            <div className="k">VO₂ max (run)</div>
            <div className="v tnum">{data.fitness.vo2max_run.toFixed(1)}</div>
          </div>
          <div>
            <div className="k">4-week change</div>
            <div className="v tnum" style={{ color: data.fitness.change_28d > 0 ? "var(--good)" : "var(--ink)" }}>
              {data.fitness.change_28d > 0 ? "+" : ""}{data.fitness.change_28d.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="k">VO₂ max (ride)</div>
            <div className="v tnum">{data.fitness.vo2max_ride?.toFixed(0) ?? "—"}</div>
          </div>
        </div>
      )}

      {data && data.recent.last.length > 0 && (
        <div className="recent">
          <div className="k">Recent sessions</div>
          {data.recent.last.map((a) => (
            <div className="recent-row" key={a.id}>
              <span className="dot" style={{ background: `var(--sport-${a.sport})` }} />
              <span className="nm">{a.name}</span>
              <span className="muted tnum">
                {parseDay(a.date).toLocaleDateString(undefined, { weekday: "short" })} · {a.distance_m ? km(a.distance_m) : duration(a.duration_s)}
              </span>
              <span className="ld tnum" title={`${SPORT_LABEL[a.sport]} · load ${Math.round(a.training_load ?? 0)}`}>
                {a.hard ? "▲ hard" : `load ${Math.round(a.training_load ?? 0)}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="note">Bars point right when today is better than usual for you (e.g. higher HRV, lower resting HR).</p>
    </section>
  );
}

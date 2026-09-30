import { duration, km, parseDay, SPORT_LABEL, titleCase } from "../format";
import type { ComponentStatus, Readiness, ReadinessScore, ScoreComponent } from "../types";

const BAND: Record<ReadinessScore["band"], { color: string; icon: string }> = {
  high: { color: "var(--good)", icon: "▲" },
  good: { color: "var(--good)", icon: "●" },
  low: { color: "var(--warn)", icon: "▼" },
  rest: { color: "var(--bad)", icon: "■" },
};

/** On-track components stay in the neutral accent; only the ones that are off get colour. */
const STATUS: Record<ComponentStatus, { color: string; icon: string; label: string }> = {
  good: { color: "var(--accent)", icon: "", label: "" },
  ok: { color: "var(--accent)", icon: "", label: "" },
  warn: { color: "var(--warn)", icon: "▼", label: "low" },
  bad: { color: "var(--bad)", icon: "■", label: "very low" },
  none: { color: "var(--neutral)", icon: "", label: "" },
};

function Ring({ score }: { score: ReadinessScore | null }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = score ? score.value / 100 : 0;
  return (
    <svg className="score-ring" viewBox="0 0 104 104" role="img" aria-label={score ? `Readiness ${score.value} of 100` : "No score yet"}>
      <circle cx={52} cy={52} r={r} fill="none" stroke="var(--grid)" strokeWidth={8} />
      {score && (
        <circle
          cx={52} cy={52} r={r} fill="none" stroke={BAND[score.band].color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 52 52)"
        />
      )}
      <text x={52} y={60} textAnchor="middle" style={{ fontSize: 30, fontWeight: 680, fill: "var(--ink)" }}>
        {score?.value ?? "—"}
      </text>
    </svg>
  );
}

function ComponentRow({ c }: { c: ScoreComponent }) {
  const st = STATUS[c.status];
  const pct = c.points == null ? 0 : (c.points / c.max) * 100;
  const pts = c.points == null ? "—" : Number.isInteger(c.points) ? c.points : c.points.toFixed(1);
  return (
    <div className={`comp ${c.available ? "" : "na"}`} title={`${c.label}: ${c.detail}`}>
      <div className="comp-top">
        <span className="comp-name">
          {c.label}
          {st.icon && (
            <span className="comp-flag" style={{ color: st.color }}>
              {st.icon} {st.label}
            </span>
          )}
        </span>
        <span className="comp-pts tnum">
          <b>{pts}</b>/{c.max}
        </span>
      </div>
      <div className="comp-bar" role="img" aria-label={`${pts} of ${c.max} points`}>
        <div style={{ width: `${pct}%`, background: st.color }} />
      </div>
      <div className="comp-detail">
        <b className="tnum">{c.value_text}</b> {c.detail}
      </div>
    </div>
  );
}

export function ReadinessCard({ data }: { data: Readiness | null }) {
  const score = data?.score ?? null;
  const components = data?.components ?? [];
  return (
    <section className="card span-4">
      <div className="card-head">
        <h2>Training readiness</h2>
        <span className="sub">{score ? `${score.earned} of ${score.available} points` : "out of 100"}</span>
      </div>

      <div className="score-hero">
        <Ring score={score} />
        <div>
          {score ? (
            <>
              <div className="band" style={{ color: BAND[score.band].color }}>
                <span aria-hidden>{BAND[score.band].icon}</span> {titleCase(score.band === "rest" ? "recover" : score.band)}
              </div>
              <div className="band-label">{score.label}</div>
              {score.available < 100 && (
                <div className="garmin-ref">
                  Rescaled to 100: {100 - score.available} points' worth of inputs have no data yet.
                </div>
              )}
            </>
          ) : (
            <div className="band-label">Not enough history yet: a score appears after about a week of data.</div>
          )}
          {data?.garmin?.score != null && (
            <div className="garmin-ref">Garmin's own estimate: {data.garmin.score} · {titleCase(data.garmin.level)}</div>
          )}
        </div>
      </div>

      <div className="comps">
        {components.map((c) => (
          <ComponentRow key={c.key} c={c} />
        ))}
      </div>

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
      <p className="note">Bars show points earned out of each component's maximum. Amber and red mark the ones holding the score back.</p>
    </section>
  );
}

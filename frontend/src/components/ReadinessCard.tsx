import { duration, km, parseDay, SPORT_LABEL, titleCase } from "../format";
import type { Readiness, ReadinessScore, ScoreComponent } from "../types";

const BAND: Record<ReadinessScore["band"], { color: string; icon: string }> = {
  high: { color: "var(--good)", icon: "▲" },
  good: { color: "var(--good)", icon: "●" },
  low: { color: "var(--warn)", icon: "▼" },
  rest: { color: "var(--bad)", icon: "■" },
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

/** Diverging bar: points above 50 push right (helping), below 50 push left (hurting). */
function ImpactBar({ points }: { points: number }) {
  const W = 84;
  const H = 8;
  const mid = W / 2;
  const d = points - 50;
  const len = (Math.min(Math.abs(d), 50) / 50) * mid;
  return (
    <svg width={W} height={H} aria-hidden>
      <rect x={0} y={3} width={W} height={2} rx={1} fill="var(--neutral)" />
      {Math.abs(d) >= 2 && (
        <rect x={d >= 0 ? mid : mid - len} y={0} width={Math.max(len, 2)} height={H} rx={3} fill={d >= 0 ? "var(--better)" : "var(--worse)"} />
      )}
      <line x1={mid} x2={mid} y1={-2} y2={H + 2} stroke="var(--baseline)" />
    </svg>
  );
}

function detail(c: ScoreComponent, data: Readiness): string {
  const input = data.inputs.find((i) => i.key === c.key);
  if (input) {
    const fmt = (v: number | null) => (v == null ? "—" : c.key === "sleep_hours" ? v.toFixed(1) : String(Math.round(v)));
    return `${fmt(input.today)}${input.unit ? ` ${input.unit}` : ""} · avg ${fmt(input.baseline_mean)}`;
  }
  if (c.key === "load") return `ratio ${data.load.ratio?.toFixed(2) ?? "—"} · ${Math.round(data.load.acute)} vs ${Math.round(data.load.chronic)}`;
  if (c.key === "recent") {
    const d = data.recent.days_since_hard;
    return d == null ? "none in 5 weeks" : d === 1 ? "yesterday" : `${d} days ago`;
  }
  if (c.key === "fitness" && data.fitness) {
    const ch = data.fitness.change_28d;
    return `${data.fitness.vo2max_run.toFixed(1)} · ${ch > 0 ? "+" : ""}${ch.toFixed(1)} in 4 wk`;
  }
  return "";
}

function verdict(points: number) {
  if (points >= 65) return "helping";
  if (points <= 35) return "hurting";
  return "neutral";
}

export function ReadinessCard({ data }: { data: Readiness | null }) {
  const score = data?.score ?? null;
  return (
    <section className="card span-4">
      <div className="card-head">
        <h2>Training readiness</h2>
        <span className="sub">vs your {data?.baseline_days ?? 28}-day normal</span>
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
              {score.caps.map((cap) => (
                <div key={cap.reason} className="cap">Capped at {cap.max}: {cap.reason}</div>
              ))}
            </>
          ) : (
            <div className="band-label">Not enough history yet — a score appears after about a week of data.</div>
          )}
          {data?.garmin?.score != null && (
            <div className="garmin-ref">Garmin's own estimate: {data.garmin.score} · {titleCase(data.garmin.level)}</div>
          )}
        </div>
      </div>

      {score && data && (
        <div className="drivers">
          <div className="drivers-head">
            <span>What's driving it</span>
            <span>weight</span>
          </div>
          {score.components.map((c) => (
            <div className="driver" key={c.key} title={`${c.points}/100 → ${c.contribution} points of the score`}>
              <div style={{ minWidth: 0 }}>
                <div className="name">{c.label}</div>
                <div className="vals tnum">{detail(c, data)}</div>
              </div>
              <div className="impact">
                <ImpactBar points={c.points} />
                <div className="dev">{verdict(c.points)}</div>
              </div>
              <div className="w tnum">{Math.round(c.weight)}%</div>
            </div>
          ))}
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
      <p className="note">Bars point right when a factor is better than your normal and lifts the score.</p>
    </section>
  );
}

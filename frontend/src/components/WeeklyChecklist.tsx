import { parseDay } from "../format";
import type { Week, WeekGoal } from "../types";

const STATUS: Record<WeekGoal["status"], { icon: string; label: string; color: string }> = {
  done: { icon: "✓", label: "Done", color: "var(--good)" },
  on_track: { icon: "●", label: "On track", color: "var(--ink-2)" },
  behind: { icon: "▲", label: "Behind", color: "var(--warn)" },
  over: { icon: "✕", label: "Over limit", color: "var(--bad)" },
  todo: { icon: "○", label: "To do", color: "var(--muted)" },
};

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Progress({ g }: { g: WeekGoal }) {
  const max = Math.max(g.target, g.progress + g.planned, 0.0001);
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const color = g.status === "over" ? "var(--bad)" : g.done ? "var(--good)" : "var(--accent)";
  return (
    <div className="gbar" aria-hidden>
      <div className="fill" style={{ width: pct(g.progress), background: color }} />
      {g.planned > 0 && (
        <div className="plan" style={{ left: pct(g.progress), width: pct(g.planned), background: color }} />
      )}
      <div className="target" style={{ left: pct(g.target) }} />
    </div>
  );
}

export function WeeklyChecklist({
  week,
  onTick,
}: {
  week: Week | null;
  onTick: (goalId: string, done: boolean) => void;
}) {
  if (!week) return <section className="card"><div className="empty">Loading…</div></section>;
  const done = week.goals.filter((g) => g.done).length;
  const dayOfWeek = Math.min(7, Math.floor((Date.now() - parseDay(week.week_start).getTime()) / 86_400_000) + 1);

  return (
    <section className="card">
      <div className="card-head">
        <h2>This week</h2>
        <span className="sub">
          {parseDay(week.week_start).toLocaleDateString(undefined, { day: "numeric", month: "short" })}–
          {parseDay(week.week_end).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · day {dayOfWeek} of 7
        </span>
      </div>
      <div className="week-score">
        <span className="v tnum">{done}</span>
        <span className="muted">/ {week.goals.length} goals complete</span>
      </div>
      <div className="goals">
        {week.goals.map((g) => {
          const st = STATUS[g.status];
          const manual = g.metric === "manual";
          return (
            <div className={`goal ${g.done ? "done" : ""}`} key={g.id} title={g.items.join("\n") || undefined}>
              <button
                className={`check ${g.done ? "on" : ""} ${manual ? "manual" : ""}`}
                disabled={!manual}
                onClick={() => manual && onTick(g.id, !g.done)}
                aria-label={manual ? `Mark “${g.label}” ${g.done ? "not done" : "done"}` : g.done ? "Complete" : "Not complete yet"}
              >
                {g.done ? "✓" : ""}
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="g-row">
                  <span className="g-label">{g.label}</span>
                  {!manual && (
                    <span className="g-val tnum">
                      {fmt(g.progress)}
                      <span className="muted"> {g.mode === "at_most" ? "of max" : "/"} {fmt(g.target)} {g.unit}</span>
                    </span>
                  )}
                </div>
                {!manual && <Progress g={g} />}
                <div className="g-status" style={{ color: st.color }}>
                  <span aria-hidden>{st.icon}</span> {st.label}
                  {g.planned > 0 && !g.done && <span className="muted"> · {fmt(g.planned)} {g.unit} still scheduled</span>}
                  {manual && !g.done && <span className="muted"> · tick it yourself</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {week.using_example && (
        <p className="note">
          These are example goals. Copy <code>backend/goals.example.json</code> to <code>backend/goals.json</code> and set your own targets.
        </p>
      )}
    </section>
  );
}

import { CATEGORY_LABEL, clock, parseDay, SPORT_LABEL } from "../format";
import type { CalEvent } from "../types";

function countdown(day: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const n = Math.round((parseDay(day).getTime() - today.getTime()) / 86_400_000);
  return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
}

export function KeySessionsCard({ events }: { events: CalEvent[] }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Key sessions ahead</h2>
        <span className="sub">Next 3 weeks</span>
      </div>
      {events.length === 0 ? (
        <div className="empty">No key sessions coming up.</div>
      ) : (
        <div className="keys">
          {events.slice(0, 6).map((e) => (
            <div className="key-row" key={e.id}>
              <div className="when">
                <div className="cd">{countdown(e.start)}</div>
                <div className="muted">{parseDay(e.start).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</div>
              </div>
              <div className="bar" style={{ background: `var(--cat-${e.category})` }} />
              <div style={{ minWidth: 0 }}>
                <div className="title">{e.title}</div>
                <div className="tag">
                  {e.category === "training" ? SPORT_LABEL[e.sport ?? "other"] : CATEGORY_LABEL[e.category]}
                  {!e.all_day && ` · ${clock(e.start)}`}
                  <span className="why" title="Why this is a key session (rule to be refined)">★ {e.key_reason}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

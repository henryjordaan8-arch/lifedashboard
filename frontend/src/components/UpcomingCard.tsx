import { clock, duration, parseDay, relativeDay, SPORT_LABEL } from "../format";
import type { CalEvent } from "../types";

export function UpcomingCard({ events, configured }: { events: CalEvent[]; configured: boolean }) {
  const groups = new Map<string, CalEvent[]>();
  for (const e of events) {
    const d = e.start.slice(0, 10);
    groups.set(d, [...(groups.get(d) ?? []), e]);
  }
  const nextId = events.find((e) => !e.all_day)?.id;

  return (
    <section className="card span-4 upcoming">
      <div className="card-head">
        <h2>Upcoming</h2>
        <span className="sub">Next 14 days · Google Calendar</span>
      </div>
      {!configured ? (
        <div className="empty">
          Add your calendar's secret iCal address as <code>GCAL_ICS_URLS</code> in <code>backend/.env</code>.
        </div>
      ) : events.length === 0 ? (
        <div className="empty">Nothing planned — enjoy the rest.</div>
      ) : (
        <div className="up-list">
        {[...groups.entries()].map(([day, items]) => (
          <div className="up-day" key={day}>
            <h3>
              {relativeDay(day)}
              {["Today", "Tomorrow"].includes(relativeDay(day)) && (
                <span className="d">{parseDay(day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
              )}
            </h3>
            {items.map((e) => {
              const mins = e.all_day ? null : (new Date(e.end).getTime() - new Date(e.start).getTime()) / 1000;
              return (
                <div className={`session ${e.id === nextId ? "next" : ""}`} key={e.id}>
                  <div className="bar" style={{ background: `var(--sport-${e.sport ?? "other"})` }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="row1">
                      <span className="title">{e.title}</span>
                      <span className="time tnum">{e.all_day ? "All day" : `${clock(e.start)}–${clock(e.end)}`}</span>
                    </div>
                    <div className="tag">
                      {SPORT_LABEL[e.sport ?? "other"]}
                      {mins ? ` · ${duration(mins)}` : ""}
                      {e.location ? ` · ${e.location}` : ""}
                    </div>
                    {e.description && <div className="desc">{e.description}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        </div>
      )}
    </section>
  );
}

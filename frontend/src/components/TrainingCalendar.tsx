import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { addDays, clock, duration, isoDay, km, pace, parseDay, SPORT_LABEL } from "../format";
import type { Activity, PlannedSession, Sport } from "../types";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SPORT_ORDER: Sport[] = ["run", "ride", "swim", "strength", "other"];

function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7)); // back to Monday
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = addDays(last, 6 - ((last.getDay() + 6) % 7)); // forward to Sunday
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

function shortMeta(a: Activity) {
  if (a.distance_m && a.sport !== "strength") return km(a.distance_m, a.sport === "swim" ? 1 : 0).replace(" km", "k");
  return duration(a.duration_s);
}

export function TrainingCalendar({ planned, refreshKey }: { planned: PlannedSession[]; refreshKey: number }) {
  const [month, setMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const days = useMemo(() => monthGrid(month), [month]);
  const todayIso = isoDay(new Date());

  useEffect(() => {
    let live = true;
    api
      .activities(isoDay(days[0]), isoDay(days[days.length - 1]))
      .then((a) => live && setActivities(a))
      .catch(() => live && setActivities([]));
    return () => {
      live = false;
    };
  }, [days, refreshKey]);

  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of activities) m.set(a.date, [...(m.get(a.date) ?? []), a]);
    return m;
  }, [activities]);

  const plannedByDay = useMemo(() => {
    const m = new Map<string, PlannedSession[]>();
    for (const p of planned) {
      const d = p.start.slice(0, 10);
      m.set(d, [...(m.get(d) ?? []), p]);
    }
    return m;
  }, [planned]);

  const inMonth = activities.filter((a) => parseDay(a.date).getMonth() === month.getMonth());
  const totalS = inMonth.reduce((s, a) => s + (a.duration_s ?? 0), 0);
  const totalM = inMonth.reduce((s, a) => s + (a.distance_m ?? 0), 0);
  const bySport = SPORT_ORDER.map((sport) => ({
    sport,
    secs: inMonth.filter((a) => a.sport === sport).reduce((s, a) => s + (a.duration_s ?? 0), 0),
  })).filter((x) => x.secs > 0);

  const shift = (n: number) => {
    setSelected(null);
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  };

  return (
    <section className="card span-8">
      <div className="card-head">
        <h2>Training</h2>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <span className="month">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="cal-summary">
        <div><div className="k">Sessions</div><div className="v tnum">{inMonth.length}</div></div>
        <div><div className="k">Time</div><div className="v tnum">{duration(totalS)}</div></div>
        <div><div className="k">Distance</div><div className="v tnum">{km(totalM, 0)}</div></div>
        <div className="sport-sum">
          {bySport.map((x) => (
            <span key={x.sport}>
              <span className="sw" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, marginRight: 6, verticalAlign: -1, background: `var(--sport-${x.sport})` }} />
              {SPORT_LABEL[x.sport]} <b className="tnum">{duration(x.secs)}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="cal">
        {DOW.map((d) => <div className="dow" key={d}>{d}</div>)}
        {days.map((d) => {
          const iso = isoDay(d);
          const acts = byDay.get(iso) ?? [];
          // Planned sessions only on today/future days (past days show what actually happened).
          const plans = iso >= todayIso ? plannedByDay.get(iso) ?? [] : [];
          const cls = ["day", d.getMonth() !== month.getMonth() && "out", iso === todayIso && "today"].filter(Boolean).join(" ");
          return (
            <div className={cls} key={iso}>
              <span className="n tnum">{d.getDate()}</span>
              {acts.map((a) => (
                <button
                  key={a.id}
                  className={`chip ${selected?.id === a.id ? "sel" : ""}`}
                  onClick={() => setSelected(selected?.id === a.id ? null : a)}
                  title={`${a.name} · ${duration(a.duration_s)}`}
                >
                  <span className="bar" style={{ background: `var(--sport-${a.sport})` }} />
                  <span className="lbl">{a.name}</span>
                  <span className="meta tnum">{shortMeta(a)}</span>
                </button>
              ))}
              {plans.map((p) => (
                <div key={p.id} className="chip planned" title={`Planned: ${p.title}`}>
                  <span className="bar" style={{ background: `var(--sport-${p.sport})` }} />
                  <span className="lbl">{p.title}</span>
                  {!p.all_day && <span className="meta tnum">{clock(p.start)}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="detail">
          <div>
            <div className="name">{selected.name}</div>
            <div className="when">
              {parseDay(selected.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })} · {clock(selected.start)} · {SPORT_LABEL[selected.sport]}
            </div>
          </div>
          <div><div className="k">Duration</div><div className="v tnum">{duration(selected.duration_s)}</div></div>
          <div><div className="k">Distance</div><div className="v tnum">{km(selected.distance_m)}</div></div>
          <div><div className="k">Pace</div><div className="v tnum">{pace(selected.sport, selected.distance_m, selected.duration_s) ?? "—"}</div></div>
          <div><div className="k">Avg / max HR</div><div className="v tnum">{selected.avg_hr ?? "—"} / {selected.max_hr ?? "—"}</div></div>
          <div><div className="k">Load</div><div className="v tnum">{selected.training_load != null ? Math.round(selected.training_load) : "—"}</div></div>
          <div><div className="k">Aer / Ana TE</div><div className="v tnum">{selected.aerobic_te?.toFixed(1) ?? "—"} / {selected.anaerobic_te?.toFixed(1) ?? "—"}</div></div>
        </div>
      )}
    </section>
  );
}

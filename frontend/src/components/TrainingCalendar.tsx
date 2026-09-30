import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { addDays, CATEGORY_LABEL, clock, duration, isoDay, KIND_EMOJI, km, oneWord, pace, parseDay, SPORT_LABEL } from "../format";
import type { Activity, CalEvent, Sport } from "../types";

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

type Selected = { kind: "activity"; a: Activity } | { kind: "event"; e: CalEvent; done: boolean };
type Kind = Sport | "study";
const kindColor = (k: Kind) => (k === "study" ? "var(--cat-study)" : `var(--sport-${k})`);
const kindLabel = (k: Kind) => (k === "study" ? "Study" : SPORT_LABEL[k]);

/** Emoji + one word; solid when done, a lighter tint of the same colour when still to come. */
function Chip({ kind, title, done, selected, onClick, tooltip }: {
  kind: Kind; title: string; done: boolean; selected: boolean; onClick: () => void; tooltip: string;
}) {
  return (
    <button
      className={`chip k ${done ? "done" : "todo"} ${selected ? "sel" : ""}`}
      style={{ ["--c" as string]: kindColor(kind) }}
      onClick={onClick}
      title={tooltip}
      aria-pressed={selected}
    >
      <span className="emo" aria-label={kindLabel(kind)}>{KIND_EMOJI[kind]}</span>
      <span className="word">{oneWord(title, kind)}</span>
    </button>
  );
}

function EventDetail({ e, done }: { e: CalEvent; done: boolean }) {
  const kind: Kind = e.category === "study" ? "study" : e.sport ?? "other";
  const mins = e.all_day ? null : (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000;
  return (
    <div className="detail event">
      <div>
        <div className="name">{KIND_EMOJI[kind]} {e.title}</div>
        <div className="when">
          {parseDay(e.start).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
          {e.all_day ? " · all day" : ` · ${clock(e.start)}–${clock(e.end)}`}
        </div>
      </div>
      <div><div className="k">Type</div><div className="v">{e.category === "training" ? kindLabel(kind) : CATEGORY_LABEL[e.category]}</div></div>
      <div><div className="k">Duration</div><div className="v tnum">{mins != null ? duration(mins * 60) : "—"}</div></div>
      <div><div className="k">Status</div><div className="v">{done ? "✓ Done" : "Planned"}</div></div>
      <div><div className="k">Key session</div><div className="v">{e.key_reason ? `★ ${e.key_reason}` : "—"}</div></div>
      <div className="desc-cell">
        <div className="k">Notes</div>
        <div className="ink2">{[e.location, e.description].filter(Boolean).join(" · ") || "—"}</div>
      </div>
    </div>
  );
}

export function TrainingCalendar({ planned, refreshKey }: { planned: CalEvent[]; refreshKey: number }) {
  const [month, setMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [study, setStudy] = useState<CalEvent[]>([]);
  const [selected, setSelected] = useState<Selected | null>(null);
  const isSel = (id: string | number) =>
    selected != null && (selected.kind === "activity" ? selected.a.id === id : selected.e.id === id);
  const toggle = (next: Selected, id: string | number) => setSelected(isSel(id) ? null : next);
  const days = useMemo(() => monthGrid(month), [month]);
  const todayIso = isoDay(new Date());
  const nowIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  useEffect(() => {
    let live = true;
    api
      .activities(isoDay(days[0]), isoDay(days[days.length - 1]))
      .then((a) => live && setActivities(a))
      .catch(() => live && setActivities([]));
    api
      .events(isoDay(days[0]), isoDay(days[days.length - 1]), "study")
      .then((e) => live && setStudy(e))
      .catch(() => live && setStudy([]));
    return () => {
      live = false;
    };
  }, [days, refreshKey]);

  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of activities) m.set(a.date, [...(m.get(a.date) ?? []), a]);
    return m;
  }, [activities]);

  const studyByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of study) m.set(e.start.slice(0, 10), [...(m.get(e.start.slice(0, 10)) ?? []), e]);
    return m;
  }, [study]);

  const plannedByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
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
              <span className="emo" role="img" aria-label={SPORT_LABEL[x.sport]} title={SPORT_LABEL[x.sport]}>
                {KIND_EMOJI[x.sport]}
              </span>{" "}
              <b className="tnum">{duration(x.secs)}</b>
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
                <Chip
                  key={a.id} kind={a.sport} title={a.name} done selected={isSel(a.id)}
                  onClick={() => toggle({ kind: "activity", a }, a.id)}
                  tooltip={`${a.name} · ${duration(a.duration_s)}`}
                />
              ))}
              {plans.map((p) => (
                <Chip
                  key={p.id} kind={p.sport ?? "other"} title={p.title} done={false} selected={isSel(p.id)}
                  onClick={() => toggle({ kind: "event", e: p, done: false }, p.id)}
                  tooltip={`Planned: ${p.title}${p.all_day ? "" : ` · ${clock(p.start)}`}`}
                />
              ))}
              {(studyByDay.get(iso) ?? []).map((e) => {
                const done = e.end <= nowIso;
                return (
                  <Chip
                    key={e.id} kind="study" title={e.title} done={done} selected={isSel(e.id)}
                    onClick={() => toggle({ kind: "event", e, done }, e.id)}
                    tooltip={`${e.title}${e.all_day ? "" : ` · ${clock(e.start)}–${clock(e.end)}`}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><i style={{ background: "color-mix(in srgb, var(--sport-run) 72%, var(--surface))" }} />Done</span>
        <span><i style={{ background: "color-mix(in srgb, var(--sport-run) 18%, var(--surface))", border: "1px dashed color-mix(in srgb, var(--sport-run) 60%, var(--surface))" }} />Planned</span>
        <span>Click an entry for details</span>
      </div>
      {selected?.kind === "activity" && (() => {
        const a = selected.a;
        return (
          <div className="detail">
            <div>
              <div className="name">{KIND_EMOJI[a.sport]} {a.name}</div>
              <div className="when">
                {parseDay(a.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })} · {clock(a.start)} · {SPORT_LABEL[a.sport]}
              </div>
            </div>
            <div><div className="k">Duration</div><div className="v tnum">{duration(a.duration_s)}</div></div>
            <div><div className="k">Distance</div><div className="v tnum">{km(a.distance_m)}</div></div>
            <div><div className="k">Pace</div><div className="v tnum">{pace(a.sport, a.distance_m, a.duration_s) ?? "—"}</div></div>
            <div><div className="k">Avg / max HR</div><div className="v tnum">{a.avg_hr ?? "—"} / {a.max_hr ?? "—"}</div></div>
            <div><div className="k">Load</div><div className="v tnum">{a.training_load != null ? Math.round(a.training_load) : "—"}</div></div>
            <div><div className="k">Aer / Ana TE</div><div className="v tnum">{a.aerobic_te?.toFixed(1) ?? "—"} / {a.anaerobic_te?.toFixed(1) ?? "—"}</div></div>
          </div>
        );
      })()}
      {selected?.kind === "event" && <EventDetail e={selected.e} done={selected.done} />}
    </section>
  );
}

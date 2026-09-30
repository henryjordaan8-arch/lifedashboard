import { useEffect, useState } from "react";
import { addDays, CATEGORY_LABEL, clock, duration, isoDay, km, parseDay, SPORT_LABEL } from "../format";
import type { Activity, CalEvent, Category, DayPlan } from "../types";

const HOUR_PX = 52;
const CATS: Category[] = ["training", "work", "study", "reading", "personal", "other"];

interface Block {
  id: string;
  title: string;
  start: string;
  end: string;
  category: Category;
  sub: string;
  status?: { icon: string; text: string; tone: "good" | "muted" | "warn" };
  key: string | null;
  desc: string | null;
  lane: number;
  lanes: number;
}

const minutes = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

function eventBlock(e: CalEvent, nowIso: string): Omit<Block, "lane" | "lanes"> {
  let status: Block["status"];
  if (e.category === "training") {
    if (e.completed_by) {
      const c = e.completed_by;
      const bits = [duration(c.duration_s), c.distance_m ? km(c.distance_m) : null].filter(Boolean).join(" · ");
      status = { icon: "✓", text: `Done — ${bits}`, tone: "good" };
    } else if (e.end < nowIso) {
      status = { icon: "!", text: "No matching Garmin activity", tone: "warn" };
    } else {
      status = { icon: "○", text: "Planned", tone: "muted" };
    }
  }
  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    category: e.category,
    sub: e.category === "training" ? `Training · ${SPORT_LABEL[e.sport ?? "other"]}` : CATEGORY_LABEL[e.category],
    status,
    key: e.key_reason,
    desc: e.description,
  };
}

function activityBlock(a: Activity): Omit<Block, "lane" | "lanes"> {
  const end = new Date(parseDay(a.date).getTime() + (minutes(a.start) * 60 + (a.duration_s ?? 1800)) * 1000);
  const endIso = `${a.date}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  return {
    id: `a${a.id}`,
    title: a.name,
    start: a.start,
    end: endIso,
    category: "training",
    sub: `${SPORT_LABEL[a.sport]} · from Garmin`,
    status: { icon: "✓", text: `Unplanned — ${[duration(a.duration_s), a.distance_m ? km(a.distance_m) : null].filter(Boolean).join(" · ")}`, tone: "good" },
    key: null,
    desc: null,
  };
}

/** Assign side-by-side lanes to overlapping blocks. */
function layout(items: Omit<Block, "lane" | "lanes">[]): Block[] {
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = "";
  const flush = () => {
    const n = Math.max(1, ...cluster.map((b) => b.lane + 1));
    cluster.forEach((b) => (b.lanes = n));
    out.push(...cluster);
    cluster = [];
    clusterEnd = "";
  };
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) flush();
    const laneEnd: string[] = [];
    for (const b of cluster) if (!laneEnd[b.lane] || b.end > laneEnd[b.lane]) laneEnd[b.lane] = b.end;
    let lane = 0;
    while (laneEnd[lane] && laneEnd[lane] > it.start) lane++;
    cluster.push({ ...it, lane, lanes: 1 });
    if (it.end > clusterEnd) clusterEnd = it.end;
  }
  flush();
  return out;
}

export function DayTimeline({
  plan,
  day,
  onDay,
}: {
  plan: DayPlan | null;
  day: string;
  onDay: (day: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const todayIso = isoDay(now);
  const nowIso = `${todayIso}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const timed = plan?.events.filter((e) => !e.all_day) ?? [];
  const allDay = plan?.events.filter((e) => e.all_day) ?? [];
  const blocks = layout([
    ...timed.map((e) => eventBlock(e, nowIso)),
    ...(plan?.unplanned_activities ?? []).map(activityBlock),
  ]);

  const startH = Math.min(6, ...blocks.map((b) => Math.floor(minutes(b.start) / 60)));
  const endH = Math.max(22, ...blocks.map((b) => (b.end.slice(0, 10) > day ? 24 : Math.ceil(minutes(b.end) / 60))));
  const y = (iso: string) => ((iso.slice(0, 10) > day ? 24 * 60 : minutes(iso)) - startH * 60) * (HOUR_PX / 60);
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);

  const hoursTotal: Record<Category, number> = { training: 0, work: 0, study: 0, reading: 0, personal: 0, other: 0, ...plan?.hours };
  const scheduled = CATS.reduce((sum, c) => sum + hoursTotal[c], 0);
  const label =
    day === todayIso
      ? "Today"
      : day === isoDay(addDays(now, 1))
        ? "Tomorrow"
        : day === isoDay(addDays(now, -1))
          ? "Yesterday"
          : parseDay(day).toLocaleDateString(undefined, { weekday: "long" });

  return (
    <section className="card">
      <div className="card-head">
        <h2>Your day</h2>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => onDay(isoDay(addDays(parseDay(day), -1)))} aria-label="Previous day">‹</button>
          <span className="month" style={{ minWidth: 220 }}>
            {label}
            <span className="muted" style={{ fontSize: 13, fontWeight: 500, marginLeft: 8 }}>
              {parseDay(day).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
          </span>
          <button className="icon-btn" onClick={() => onDay(isoDay(addDays(parseDay(day), 1)))} aria-label="Next day">›</button>
          {day !== todayIso && (
            <button className="btn" style={{ boxShadow: "none" }} onClick={() => onDay(todayIso)}>Today</button>
          )}
        </div>
      </div>

      <div className="cat-totals">
        {CATS.filter((c) => c !== "other" || hoursTotal.other > 0).map((c) => (
          <div key={c} className="cat-total">
            <div className="k"><span className="sw" style={{ background: `var(--cat-${c})` }} />{CATEGORY_LABEL[c]}</div>
            <div className="v tnum">{hoursTotal[c] ? duration(hoursTotal[c] * 3600) : "—"}</div>
          </div>
        ))}
      </div>
      {scheduled > 0 && (
        <div className="alloc" role="img" aria-label="Share of scheduled time per category">
          {CATS.filter((c) => hoursTotal[c] > 0).map((c) => (
            <div key={c} style={{ flex: hoursTotal[c], background: `var(--cat-${c})` }} title={`${CATEGORY_LABEL[c]} · ${duration(hoursTotal[c] * 3600)}`} />
          ))}
          <div className="alloc-free" style={{ flex: Math.max(0, 16 - scheduled) }} title="Unscheduled (of a 16 h waking day)" />
        </div>
      )}

      {plan && !plan.configured && (
        <div className="empty">
          Connect Google Calendar (<code>GCAL_*_ICS_URLS</code> in <code>backend/.env</code>) to see your day.
        </div>
      )}

      {allDay.length > 0 && (
        <div className="allday">
          {allDay.map((e) => (
            <span key={e.id} className="chip planned" style={{ width: "auto" }}>
              <span className="bar" style={{ background: `var(--cat-${e.category})` }} />
              <span className="lbl">{e.key_reason ? "★ " : ""}{e.title}</span>
            </span>
          ))}
        </div>
      )}

      <div className="timeline" style={{ height: (endH - startH) * HOUR_PX }}>
        {hours.map((h) => (
          <div key={h} className="hour" style={{ top: (h - startH) * HOUR_PX }}>
            <span className="tnum">{String(h).padStart(2, "0")}:00</span>
          </div>
        ))}
        <div className="lanes">
          {blocks.map((b) => {
            const top = y(b.start);
            const height = Math.max(22, y(b.end) - top - 2);
            const compact = height < 50;
            const past = b.end <= nowIso;
            return (
              <div
                key={b.id}
                className={`block ${past ? "past" : ""} ${b.key ? "key" : ""}`}
                style={{
                  ["--c" as string]: `var(--cat-${b.category})`,
                  top,
                  height,
                  left: `calc(${(b.lane / b.lanes) * 100}% + 2px)`,
                  width: `calc(${100 / b.lanes}% - 4px)`,
                }}
                title={[b.title, `${clock(b.start)}–${clock(b.end)}`, b.status?.text, b.key && `Key: ${b.key}`, b.desc].filter(Boolean).join("\n")}
              >
                <div className="b-row">
                  <span className="b-title">
                    {compact && b.status && (
                      <span className={`b-status ${b.status.tone}`} style={{ marginRight: 6 }} aria-label={b.status.text}>{b.status.icon}</span>
                    )}
                    {b.key && <span className="star" aria-label="Key session">★</span>}
                    {b.title}
                  </span>
                  <span className="b-time tnum">{clock(b.start)}–{clock(b.end)}</span>
                </div>
                {!compact && (
                  <div className="b-sub">
                    {b.sub}
                    {b.status && (
                      <span className={`b-status ${b.status.tone}`}>
                        <span aria-hidden>{b.status.icon}</span> {b.status.text}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {day === todayIso && minutes(nowIso) >= startH * 60 && minutes(nowIso) <= endH * 60 && (
          <div className="now" style={{ top: y(nowIso) }}>
            <span className="tnum">{clock(nowIso)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

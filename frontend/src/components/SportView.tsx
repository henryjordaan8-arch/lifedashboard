import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { addDays, duration, mmss, parseDay, shortDate, SPORT_LABEL } from "../format";
import type { SportBest, SportData, SportKey, SportSession, SportSummary } from "../types";
import { ChartModal, ExpandButton } from "./ChartModal";
import { TrendChart, type TrendPoint } from "./TrendChart";
import { WeeklyVolumeChart } from "./WeeklyVolumeChart";

const RANGES = [
  { label: "3M", days: 91 },
  { label: "6M", days: 182 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
  { label: "5Y", days: 1826 },
];

interface Kpi {
  label: string;
  get: (s: SportSummary) => number | null | undefined;
  fmt: (v: number) => string;
  /** +1 higher is better, -1 lower is better, 0 neutral */
  dir: 1 | -1 | 0;
}

interface Column {
  label: string;
  get: (s: SportSession) => number | string | null | undefined;
  fmt?: (v: number) => string;
  num?: boolean;
}

interface ChartSpec {
  title: string;
  hint: string;
  series: (d: SportData) => TrendPoint[];
  fmt: (v: number) => string;
  invert?: boolean;
  lineOnly?: boolean;
  change?: (d: SportData) => { pct: number | null; dir: 1 | -1 | 0; group?: string } | null;
}

interface SportConfig {
  title: string;
  color: string;
  distUnit: string;
  kpis: Kpi[];
  charts: ChartSpec[];
  columns: Column[];
}

const trend = (key: string) => (d: SportData) => d.trends.find((t) => t.key === key)?.points ?? [];
const trendChange = (key: string) => (d: SportData) => {
  const t = d.trends.find((x) => x.key === key);
  return t?.change ? { pct: t.change.pct, dir: t.direction, group: t.change.group } : null;
};
const vo2Change = (d: SportData) => {
  if (d.vo2max.length < 2) return null;
  const a = d.vo2max[0].value;
  const b = d.vo2max[d.vo2max.length - 1].value;
  return { pct: Math.round(((b - a) / a) * 1000) / 10, dir: 1 as const };
};
const n0 = (v: number) => String(Math.round(v));
const n1 = (v: number) => v.toFixed(1);
const km = (v: number) => `${v.toFixed(v >= 100 ? 0 : 1)} km`;
const hrs = (v: number) => duration(v * 3600);
const date = (s: SportSession) => s.date;
const name = (s: SportSession) => s.name;

const COMMON_KPIS: Kpi[] = [
  // Volume changes are shown neutrally: less can be a deliberate taper.
  { label: "Sessions", get: (s) => s.sessions, fmt: n0, dir: 0 },
  { label: "Distance", get: (s) => s.distance_km, fmt: km, dir: 0 },
  { label: "Time", get: (s) => s.duration_h, fmt: hrs, dir: 0 },
];

const CONFIG: Record<SportKey, SportConfig> = {
  run: {
    title: "Running",
    color: "var(--sport-run)",
    distUnit: "km",
    kpis: [
      ...COMMON_KPIS,
      { label: "Avg pace", get: (s) => s.pace, fmt: (v) => `${mmss(v)} /km`, dir: -1 },
      { label: "Avg HR", get: (s) => s.avg_hr, fmt: (v) => `${n0(v)} bpm`, dir: 0 },
      { label: "Elevation", get: (s) => s.elevation_m, fmt: (v) => `${n0(v)} m`, dir: 0 },
      { label: "Key sessions", get: (s) => s.key_sessions, fmt: n0, dir: 0 },
    ],
    charts: [
      { title: "Pace", hint: "4-week averages · up = faster", series: trend("pace"), fmt: mmss, invert: true, change: trendChange("pace") },
      { title: "Aerobic efficiency", hint: "metres/min per heartbeat · higher = fitter", series: trend("efficiency"), fmt: (v) => v.toFixed(2), change: trendChange("efficiency") },
      { title: "VO₂ max", hint: "Garmin running estimate", series: (d) => d.vo2max, fmt: n1, lineOnly: true, change: vo2Change },
    ],
    columns: [
      { label: "Date", get: date },
      { label: "Session", get: name },
      { label: "Distance", get: (s) => (s.distance_m ?? 0) / 1000, fmt: (v) => v.toFixed(1), num: true },
      { label: "Time", get: (s) => s.duration_s, fmt: (v) => duration(v), num: true },
      { label: "Pace /km", get: (s) => s.metrics.pace, fmt: mmss, num: true },
      { label: "Avg HR", get: (s) => s.avg_hr, fmt: n0, num: true },
      { label: "Cadence", get: (s) => s.cadence, fmt: n0, num: true },
      { label: "Efficiency", get: (s) => s.metrics.efficiency, fmt: (v) => v.toFixed(2), num: true },
      { label: "Load", get: (s) => s.training_load, fmt: n0, num: true },
    ],
  },
  ride: {
    title: "Cycling",
    color: "var(--sport-ride)",
    distUnit: "km",
    kpis: [
      ...COMMON_KPIS,
      { label: "Avg power", get: (s) => s.power, fmt: (v) => `${n0(v)} W`, dir: 1 },
      { label: "Avg speed", get: (s) => s.speed_kmh, fmt: (v) => `${n1(v)} km/h`, dir: 1 },
      { label: "Elevation", get: (s) => s.elevation_m, fmt: (v) => `${n0(v)} m`, dir: 0 },
      { label: "Key sessions", get: (s) => s.key_sessions, fmt: n0, dir: 0 },
    ],
    charts: [
      { title: "Average power", hint: "4-week averages", series: trend("power"), fmt: (v) => `${n0(v)} W`, change: trendChange("power") },
      { title: "Aerobic efficiency", hint: "normalised watts per heartbeat · higher = fitter", series: trend("efficiency"), fmt: (v) => v.toFixed(2), change: trendChange("efficiency") },
      { title: "VO₂ max", hint: "Garmin cycling estimate", series: (d) => d.vo2max, fmt: n1, lineOnly: true, change: vo2Change },
    ],
    columns: [
      { label: "Date", get: date },
      { label: "Session", get: name },
      { label: "Distance", get: (s) => (s.distance_m ?? 0) / 1000, fmt: (v) => v.toFixed(1), num: true },
      { label: "Time", get: (s) => s.duration_s, fmt: (v) => duration(v), num: true },
      { label: "Speed", get: (s) => s.metrics.speed_kmh, fmt: n1, num: true },
      { label: "Avg W", get: (s) => s.avg_power, fmt: n0, num: true },
      { label: "NP", get: (s) => s.norm_power, fmt: n0, num: true },
      { label: "Avg HR", get: (s) => s.avg_hr, fmt: n0, num: true },
      { label: "TSS", get: (s) => s.tss, fmt: n0, num: true },
    ],
  },
  swim: {
    title: "Swimming",
    color: "var(--sport-swim)",
    distUnit: "km",
    kpis: [
      ...COMMON_KPIS,
      { label: "Avg pace", get: (s) => s.pace, fmt: (v) => `${mmss(v)} /100m`, dir: -1 },
      { label: "Avg SWOLF", get: (s) => s.swolf, fmt: n1, dir: -1 },
      { label: "Avg HR", get: (s) => s.avg_hr, fmt: (v) => `${n0(v)} bpm`, dir: 0 },
    ],
    charts: [
      { title: "Pace /100m", hint: "4-week average · up = faster", series: trend("pace"), fmt: mmss, invert: true, change: trendChange("pace") },
      { title: "SWOLF", hint: "strokes + seconds per length · up = more efficient", series: trend("swolf"), fmt: n1, invert: true, change: trendChange("swolf") },
      { title: "Stroke rate", hint: "strokes per minute", series: trend("cadence"), fmt: n1, change: trendChange("cadence") },
    ],
    columns: [
      { label: "Date", get: date },
      { label: "Session", get: name },
      { label: "Distance m", get: (s) => s.distance_m, fmt: n0, num: true },
      { label: "Time", get: (s) => s.duration_s, fmt: (v) => duration(v), num: true },
      { label: "Pace /100m", get: (s) => s.metrics.pace, fmt: mmss, num: true },
      { label: "SWOLF", get: (s) => s.swolf, fmt: n1, num: true },
      { label: "Stroke rate", get: (s) => s.cadence, fmt: n1, num: true },
      { label: "Avg HR", get: (s) => s.avg_hr, fmt: n0, num: true },
    ],
  },
};

function Delta({ now, prev, dir }: { now: number | null | undefined; prev: number | null | undefined; dir: 1 | -1 | 0 }) {
  if (now == null || prev == null || prev === 0) return <div className="d">&nbsp;</div>;
  const pct = ((now - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 1) return <div className="d">≈ previous</div>;
  const better = dir === 0 ? null : Math.sign(pct) === dir;
  return (
    <div className="d">
      <span style={{ color: better == null ? "var(--ink-2)" : better ? "var(--good)" : "var(--bad)" }}>
        {pct > 0 ? "▲" : "▼"} {Math.abs(Math.round(pct))}%
      </span>{" "}
      vs previous
    </div>
  );
}

function ChangeChip({ change }: { change: { pct: number | null; dir: 1 | -1 | 0; group?: string } | null }) {
  if (!change || change.pct == null) return null;
  const { pct, dir } = change;
  const better = dir === 0 || Math.abs(pct) < 0.5 ? null : Math.sign(pct) === dir;
  const color = better == null ? "var(--ink-2)" : better ? "var(--good)" : "var(--bad)";
  const word = better == null ? "" : better ? " better" : " worse";
  return (
    <span
      className="chip-change"
      style={{ color }}
      title={`First 4 weeks vs last 4 weeks of the range${change.group === "base" ? ", base sessions only" : ""}`}
    >
      {better == null ? "●" : better ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%{word}
    </span>
  );
}

function bestValue(b: SportBest) {
  switch (b.kind) {
    case "time":
      return mmss(b.value);
    case "pace_km":
      return `${mmss(b.value)} /km`;
    case "pace_100":
      return `${mmss(b.value)} /100m`;
    case "km":
      return `${b.value.toFixed(1)} km`;
    case "m":
      return `${Math.round(b.value).toLocaleString()} m`;
    case "watts":
      return `${Math.round(b.value)} W`;
    default:
      return b.value.toFixed(1);
  }
}

const ZONE_NAMES = ["Z1 recovery", "Z2 endurance", "Z3 tempo", "Z4 threshold", "Z5 VO₂ max"];

function Zones({ zones }: { zones: number[] | null }) {
  if (!zones) return <div className="empty">No heart-rate zone data in this range.</div>;
  const total = zones.reduce((a, b) => a + b, 0) || 1;
  const pct = zones.map((z) => (z / total) * 100);
  const easy = pct[0] + pct[1];
  const hard = pct[3] + pct[4];
  return (
    <div>
      <div className="zonebar" role="img" aria-label="Time in heart-rate zones">
        {pct.map((p, i) => (p > 0 ? <div key={i} style={{ flex: p, background: `var(--zone-${i + 1})` }} title={`${ZONE_NAMES[i]} · ${Math.round(p)}%`} /> : null))}
      </div>
      <div className="zone-rows">
        {zones.map((z, i) => (
          <div className="zone-row" key={i}>
            <span><span className="sw" style={{ background: `var(--zone-${i + 1})` }} />{ZONE_NAMES[i]}</span>
            <span className="muted tnum">{duration(z)}</span>
            <b className="tnum">{Math.round(pct[i])}%</b>
          </div>
        ))}
      </div>
      <p className="note">
        {Math.round(easy)}% easy (Z1–2) · {Math.round(pct[2])}% moderate · {Math.round(hard)}% hard (Z4–5)
      </p>
    </div>
  );
}

function SessionsTable({ sessions, columns }: { sessions: SportSession[]; columns: Column[] }) {
  const [sort, setSort] = useState<{ i: number; desc: boolean }>({ i: 0, desc: true });
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    const col = columns[sort.i];
    return [...sessions].sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.desc ? -c : c;
    });
  }, [sessions, columns, sort]);
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <div>
      <div className="table-wrap">
        <table className="sessions">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.label}
                  className={c.num ? "num" : ""}
                  aria-sort={sort.i === i ? (sort.desc ? "descending" : "ascending") : "none"}
                >
                  <button onClick={() => setSort({ i, desc: sort.i === i ? !sort.desc : true })}>
                    {c.label}
                    {sort.i === i ? (sort.desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                {columns.map((c, i) => {
                  const v = c.get(s);
                  let text: string;
                  if (c.label === "Date") text = shortDate(String(v), true);
                  else if (v == null || v === "") text = "—";
                  else text = typeof v === "number" && c.fmt ? c.fmt(v) : String(v);
                  return (
                    <td key={i} className={c.num ? "num tnum" : ""}>
                      {c.label === "Session" && s.key ? (
                        <span title={s.key}><span className="key-star" aria-label="Key session">★</span>{text}</span>
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 12 && (
        <button className="btn link" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${rows.length} sessions`}
        </button>
      )}
    </div>
  );
}

function cellText(c: Column, s: SportSession): string {
  const v = c.get(s);
  if (v == null || v === "") return "—";
  return typeof v === "number" && c.fmt ? c.fmt(v) : String(v);
}

/** Units for the detail card (the table has them in its column headers). */
const CARD_UNITS: Record<string, string> = {
  Distance: " km", "Distance m": " m", Speed: " km/h", "Avg W": " W", NP: " W", "Avg HR": " bpm",
  Cadence: " spm", "Stroke rate": " spm",
};

/** Everything we know about one session, for the expanded charts' hover card. */
function SessionCard({ s, cfg, value, avg, metric }: {
  s: SportSession;
  cfg: SportConfig;
  value?: string;
  avg?: string | null;
  metric?: string;
}) {
  const rows = cfg.columns.filter((c) => c.label !== "Date" && c.label !== "Session");
  const extra: [string, string][] = [];
  if (s.elevation_gain_m) extra.push(["Elevation", `${Math.round(s.elevation_gain_m)} m`]);
  if (s.aerobic_te != null) extra.push(["Training effect", `${s.aerobic_te.toFixed(1)} aer / ${(s.anaerobic_te ?? 0).toFixed(1)} ana`]);
  if (s.calories) extra.push(["Calories", String(s.calories)]);
  return (
    <div className="scard">
      <div className="scard-head">
        <div className="scard-name">{s.key && <span aria-label="Key session">★ </span>}{s.name}</div>
        <div className="muted">
          {parseDay(s.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          {" · "}{s.start.slice(11, 16)} · {SPORT_LABEL[s.sport]}
        </div>
        {s.key && <div className="scard-key">★ {s.key}</div>}
      </div>
      {metric && value && (
        <div className="scard-metric">
          <span>{metric}</span>
          <b className="tnum">{value}</b>
          {avg && <span className="muted">4-week avg {avg}</span>}
        </div>
      )}
      <dl className="scard-grid">
        {[
          ...rows.map((c) => {
            const t = cellText(c, s);
            return [c.label.replace(/ (m|km)$/, ""), t === "—" ? t : t + (CARD_UNITS[c.label] ?? "")] as [string, string];
          }),
          ...extra,
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="tnum">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A week's totals and its sessions, for the expanded weekly-volume chart. */
function WeekCard({ week, sessions, cfg }: { week: SportData["weekly"][number]; sessions: SportSession[]; cfg: SportConfig }) {
  const end = addDays(parseDay(week.week_start), 6);
  const inWeek = sessions
    .filter((s) => s.date >= week.week_start && parseDay(s.date) <= end)
    .sort((a, b) => a.start.localeCompare(b.start));
  const dist = cfg.columns.find((c) => c.label.startsWith("Distance"));
  return (
    <div className="scard">
      <div className="scard-head">
        <div className="scard-name">Week of {shortDate(week.week_start, true)}</div>
        <div className="muted">
          {week.sessions} session{week.sessions === 1 ? "" : "s"}
          {week.key_sessions ? ` (${week.key_sessions} key)` : ""} · {week.distance_km} km · {duration(week.duration_h * 3600)} · load {Math.round(week.load)}
        </div>
      </div>
      {inWeek.length > 0 && (
        <ul className="scard-list">
          {inWeek.map((s) => (
            <li key={s.id}>
              <span className="muted tnum">{parseDay(s.date).toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="nm">{s.key ? "★ " : ""}{s.name}</span>
              <span className="tnum">{dist ? cellText(dist, s) : ""}{dist?.label === "Distance" ? " km" : ""}</span>
              <span className="tnum muted">{duration(s.duration_s)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SportView({ sport, refreshKey }: { sport: SportKey; refreshKey: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const close = useCallback(() => setExpanded(null), []);
  const cfg = CONFIG[sport];
  const [days, setDays] = useState(182);
  const [data, setData] = useState<SportData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .sport(sport, days)
      .then((d) => live && (setData(d), setErr(null)))
      .catch((e) => live && setErr(String(e)));
    return () => {
      live = false;
    };
  }, [sport, days, refreshKey]);

  const rangeLabel = RANGES.find((r) => r.days === days)?.label ?? `${days}d`;
  const loaded = data && data.sport === sport ? data : null;

  return (
    <main className="grid">
      <section className="card span-12">
        <div className="card-head" style={{ marginBottom: 14 }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="sport-dot" style={{ background: cfg.color }} />
            {cfg.title}
          </h2>
          <div className="seg" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.label} className={days === r.days ? "on" : ""} onClick={() => setDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {err && <div className="empty">Couldn't load: {err}</div>}
        {loaded && loaded.summary.sessions === 0 ? (
          <div className="empty">No {cfg.title.toLowerCase()} sessions in the last {rangeLabel}.</div>
        ) : (
          loaded && (
            <div className="kpis">
              {cfg.kpis.map((k) => {
                const v = k.get(loaded.summary);
                return (
                  <div className="kpi" key={k.label}>
                    <div className="k">{k.label}</div>
                    <div className="v tnum">{v == null ? "—" : k.fmt(v)}</div>
                    <Delta now={v} prev={k.get(loaded.previous)} dir={k.dir} />
                  </div>
                );
              })}
            </div>
          )
        )}
      </section>

      {loaded && loaded.summary.sessions > 0 && (
        <>
          <section className="card span-8 has-expand">
            <ExpandButton label="weekly volume" onClick={() => setExpanded("volume")} />
            <WeeklyVolumeChart data={loaded} color={cfg.color} unitKm={cfg.distUnit} />
          </section>
          <section className="card span-4">
            <div className="card-head">
              <h2>Personal bests</h2>
              <span className="sub">all synced history</span>
            </div>
            <div className="bests">
              {loaded.bests.map((b) => (
                <div className="best" key={b.label}>
                  <div>
                    <div className="name">{b.label}</div>
                    <div className="vals">{b.name} · {shortDate(b.date, true)}</div>
                  </div>
                  <div className="bv tnum">
                    {bestValue(b)}
                    {b.recent && <span className="new">new in {rangeLabel}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {cfg.charts.map((c) => (
            <section className="card span-4 has-expand" key={c.title}>
              <ExpandButton label={c.title} onClick={() => setExpanded(c.title)} />
              <div className="chart-title">
                <span>{c.title}</span>
                <ChangeChip change={c.change?.(loaded) ?? null} />
              </div>
              <div className="chart-hint">{c.hint}</div>
              <TrendChart
                points={c.series(loaded)}
                color={cfg.color}
                format={c.fmt}
                invert={c.invert}
                lineOnly={c.lineOnly}
                start={loaded.start}
                end={loaded.end}
              />
            </section>
          ))}

          <section className="card span-8">
            <div className="card-head">
              <h2>Sessions</h2>
              <span className="sub">★ key (quality) session · click a column to sort</span>
            </div>
            <SessionsTable sessions={loaded.sessions} columns={cfg.columns} />
          </section>
          <section className="card span-4">
            <div className="card-head">
              <h2>Intensity</h2>
              <span className="sub">time in heart-rate zones</span>
            </div>
            <Zones zones={loaded.zones_s} />
            {sport !== "swim" && (
            <div className="quality">
              <div className="k">Key vs base sessions</div>
              <div className="qbar">
                <div style={{ flex: loaded.summary.key_sessions, background: cfg.color }} />
                <div style={{ flex: loaded.summary.sessions - loaded.summary.key_sessions, background: "var(--neutral)" }} />
              </div>
              <div className="ink2" style={{ fontSize: 12, marginTop: 6 }}>
                {loaded.summary.key_sessions} key · {loaded.summary.sessions - loaded.summary.key_sessions} base
              </div>
            </div>
            )}
          </section>
        </>
      )}
      {loaded && expanded && (() => {
        const byId = new Map(loaded.sessions.map((s) => [s.id, s]));
        const range = `${shortDate(loaded.start, true)} – ${shortDate(loaded.end, true)}`;
        if (expanded === "volume") {
          return (
            <ChartModal title={`${cfg.title} · weekly volume`} subtitle={range} onClose={close}>
              <WeeklyVolumeChart
                data={loaded} color={cfg.color} unitKm={cfg.distUnit} height={Math.max(360, window.innerHeight - 260)}
                renderTip={(w) => <WeekCard week={w} sessions={loaded.sessions} cfg={cfg} />}
              />
            </ChartModal>
          );
        }
        const c = cfg.charts.find((x) => x.title === expanded);
        if (!c) return null;
        return (
          <ChartModal
            title={`${cfg.title} · ${c.title}`}
            subtitle={<>{c.hint} · {range} <ChangeChip change={c.change?.(loaded) ?? null} /></>}
            onClose={close}
          >
            <TrendChart
              points={c.series(loaded)} color={cfg.color} format={c.fmt} invert={c.invert} lineOnly={c.lineOnly}
              start={loaded.start} end={loaded.end} height={Math.max(360, window.innerHeight - 280)}
              renderTip={(p, avg) => {
                const s = p.id != null ? byId.get(p.id) : undefined;
                if (!s) {
                  return (
                    <div className="scard">
                      <div className="scard-head">
                        <div className="scard-name">{c.title}: {c.fmt(p.value)}</div>
                        <div className="muted">{shortDate(p.date, true)}</div>
                      </div>
                    </div>
                  );
                }
                return <SessionCard s={s} cfg={cfg} metric={c.title} value={c.fmt(p.value)} avg={avg == null ? null : c.fmt(avg)} />;
              }}
            />
          </ChartModal>
        );
      })()}
    </main>
  );
}

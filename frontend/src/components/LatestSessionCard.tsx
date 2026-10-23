import { duration, mmss, parseDay } from "../format";
import type { Lap, SportData, SportKey } from "../types";

interface Col {
  label: string;
  get: (l: Lap) => number | null;
  fmt: (v: number) => string;
  /** draw a bar for this column; lower = better for pace */
  bar?: "low" | "high";
}

const n0 = (v: number) => String(Math.round(v));
const km = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${Math.round(v)} m`);

const COLUMNS: Record<SportKey, Col[]> = {
  run: [
    { label: "Distance", get: (l) => l.distance_m || null, fmt: km },
    { label: "Time", get: (l) => l.duration_s, fmt: mmss },
    { label: "Pace /km", get: (l) => l.pace_s_km, fmt: mmss, bar: "low" },
    { label: "Avg HR", get: (l) => l.avg_hr, fmt: n0 },
    { label: "Max HR", get: (l) => l.max_hr, fmt: n0 },
    { label: "Cadence", get: (l) => l.cadence, fmt: n0 },
    { label: "Climb", get: (l) => l.elevation_gain_m, fmt: (v) => `${Math.round(v)} m` },
  ],
  ride: [
    { label: "Distance", get: (l) => l.distance_m || null, fmt: km },
    { label: "Time", get: (l) => l.duration_s, fmt: mmss },
    { label: "Speed", get: (l) => l.speed_kmh, fmt: (v) => `${v.toFixed(1)}` },
    { label: "Avg W", get: (l) => l.avg_power, fmt: n0, bar: "high" },
    { label: "Max W", get: (l) => l.max_power, fmt: n0 },
    { label: "Avg HR", get: (l) => l.avg_hr, fmt: n0 },
    { label: "Max HR", get: (l) => l.max_hr, fmt: n0 },
    { label: "Cadence", get: (l) => l.cadence, fmt: n0 },
  ],
  swim: [
    { label: "Distance", get: (l) => l.distance_m || null, fmt: (v) => `${Math.round(v)} m` },
    { label: "Time", get: (l) => l.duration_s, fmt: mmss },
    { label: "Pace /100m", get: (l) => l.pace_s_100, fmt: mmss, bar: "low" },
    { label: "Strokes", get: (l) => l.strokes, fmt: n0 },
    { label: "SWOLF", get: (l) => l.swolf, fmt: (v) => v.toFixed(0) },
    { label: "Avg HR", get: (l) => l.avg_hr, fmt: n0 },
  ],
};

/** The most recent session of this sport, lap by lap (always the latest, whatever the range). */
export function LatestSessionCard({ data, sport, color }: { data: SportData; sport: SportKey; color: string }) {
  const latest = data.latest;
  if (!latest) return null;
  const s = latest.session;
  const cols = COLUMNS[sport];
  const work = latest.laps.filter((l) => !l.rest);
  // Bars and the best lap are judged against the column's range across work laps.
  const barCol = cols.find((c) => c.bar);
  const barVals = barCol ? work.map(barCol.get).filter((v): v is number => v != null) : [];
  const best = barVals.length ? (barCol!.bar === "low" ? Math.min(...barVals) : Math.max(...barVals)) : null;
  const barPct = (v: number | null) => {
    if (v == null || best == null) return 0;
    return Math.max(4, Math.min(100, barCol!.bar === "low" ? (best / v) * 100 : (v / best) * 100));
  };

  const pace = sport === "run" ? s.metrics.pace && `${mmss(s.metrics.pace)} /km`
    : sport === "swim" ? s.metrics.pace && `${mmss(s.metrics.pace)} /100m`
    : s.metrics.speed_kmh && `${s.metrics.speed_kmh.toFixed(1)} km/h`;
  const tiles: [string, string | null | undefined | 0][] = [
    ["Distance", s.distance_m ? km(s.distance_m) : null],
    ["Time", duration(s.duration_s)],
    [sport === "ride" ? "Avg speed" : "Avg pace", pace],
    ["Avg / max HR", s.avg_hr ? `${s.avg_hr} / ${s.max_hr ?? "—"}` : null],
    ...(sport === "ride"
      ? [["Avg / NP", s.avg_power ? `${Math.round(s.avg_power)} / ${s.norm_power ? Math.round(s.norm_power) : "—"} W` : null] as [string, string | null]]
      : sport === "swim"
        ? [["SWOLF", s.swolf?.toFixed(1)] as [string, string | undefined]]
        : [["Cadence", s.cadence ? `${Math.round(s.cadence)} spm` : null] as [string, string | null]]),
    ["Load", s.training_load != null ? String(Math.round(s.training_load)) : null],
    ["Training effect", s.aerobic_te != null ? `${s.aerobic_te.toFixed(1)} aer · ${(s.anaerobic_te ?? 0).toFixed(1)} ana` : null],
    ...(sport === "run" ? [["Climb", s.elevation_gain_m ? `${Math.round(s.elevation_gain_m)} m` : null] as [string, string | null]] : []),
  ];

  return (
    <section className="card span-12">
      <div className="card-head">
        <h2>Latest session</h2>
        <span className="sub">
          {parseDay(s.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })} · {s.start.slice(11, 16)}
        </span>
      </div>
      <div className="latest">
        <div>
          <div className="latest-name">
            {s.key && <span className="key-star" aria-label="Key session">★</span>}{s.name}
          </div>
          {s.key && <div className="muted latest-key">{s.key}</div>}
          <div className="latest-tiles">
            {tiles.map(([k, v]) => (
              <div key={k}>
                <div className="k">{k}</div>
                <div className="v tnum">{v || "—"}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="latest-laps">
          {!latest.laps.length ? (
            <div className="empty">
              No lap data for this session yet. Garmin records laps when you press lap or use auto-lap; it appears after the next sync.
            </div>
          ) : (
            <table className="sessions laps">
              <thead>
                <tr>
                  <th><button tabIndex={-1}>{sport === "swim" ? "Interval" : "Lap"}</button></th>
                  {cols.map((c) => (
                    <th key={c.label} className="num"><button tabIndex={-1}>{c.label}</button></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latest.laps.map((l) =>
                  l.rest ? (
                    <tr key={l.n} className="rest">
                      <td className="muted">Rest</td>
                      <td className="muted" colSpan={cols.length}>{mmss(l.duration_s)}</td>
                    </tr>
                  ) : (
                    <tr key={l.n} className={barCol && barCol.get(l) === best && work.length > 1 ? "top-lap" : ""}>
                      <td className="tnum">{work.indexOf(l) + 1}</td>
                      {cols.map((c) => {
                        const v = c.get(l);
                        return (
                          <td key={c.label} className="num tnum">
                            {c.bar ? (
                              <span className="lap-bar">
                                <i style={{ width: `${(barPct(v) * 0.8).toFixed(1)}px`, background: color }} />
                                <b>{v == null ? "—" : c.fmt(v)}</b>
                              </span>
                            ) : v == null ? "—" : c.fmt(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

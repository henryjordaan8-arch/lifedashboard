/** Extra boxes on the sport dashboards: mileage ramp, race predictions + threshold, shoes, FTP. */
import { mmss, shortDate } from "../format";
import type { SportData } from "../types";
import { TrendChart } from "./TrendChart";

const RAMP_WEEKS = 8;
const RAMP_WARN = 10; // % week-on-week increase worth a look

const pctText = (p: number) => `${p > 0 ? "+" : "−"}${Math.abs(Math.round(p))}%`;

/** Week-on-week change in running distance, flagging jumps above 10%. */
export function RampCard({ data, color }: { data: SportData; color: string }) {
  const weeks = data.weekly.slice(-RAMP_WEEKS);
  const full = data.weekly.slice(0, -1); // the last week is still in progress
  const last = full[full.length - 1];
  const prev = full[full.length - 2];
  const prior4 = full.slice(-5, -1);
  const avg4 = prior4.length ? prior4.reduce((s, w) => s + w.distance_km, 0) / prior4.length : 0;
  const change = last && prev && prev.distance_km > 0 ? ((last.distance_km - prev.distance_km) / prev.distance_km) * 100 : null;
  const ratio = last && avg4 > 0 ? last.distance_km / avg4 : null;
  const max = Math.max(1, ...weeks.map((w) => w.distance_km));

  return (
    <section className="card span-4">
      <div className="chart-title"><span>Weekly mileage ramp</span></div>
      <div className="chart-hint">week-on-week change · flags jumps over {RAMP_WARN}%</div>
      <div className="mini-tiles">
        <div className="tile">
          <div className="k">Last week</div>
          <div className="v tnum">{last ? `${last.distance_km.toFixed(1)} km` : "—"}</div>
          <div className="d">{change == null ? " " : <Flagged pct={change} />}</div>
        </div>
        <div className="tile">
          <div className="k">vs 4-week avg</div>
          <div className="v tnum">{ratio == null ? "—" : `${ratio.toFixed(2)}×`}</div>
          <div className="d">{avg4 ? `${avg4.toFixed(1)} km average` : " "}</div>
        </div>
      </div>
      <div className="ramp">
        {weeks.map((w, i) => {
          const before = i > 0 ? weeks[i - 1] : data.weekly[data.weekly.length - weeks.length - 1];
          const current = i === weeks.length - 1;
          const pct = !current && before && before.distance_km > 0 ? ((w.distance_km - before.distance_km) / before.distance_km) * 100 : null;
          return (
            <div className="ramp-row" key={w.week_start}>
              <span className="muted tnum">{shortDate(w.week_start)}</span>
              <span className="ramp-bar"><i style={{ width: `${(w.distance_km / max) * 100}%`, background: color, opacity: current ? 0.45 : 1 }} /></span>
              <span className="tnum">{w.distance_km.toFixed(1)}</span>
              <span className="tnum">{current ? <span className="muted">so far</span> : pct == null ? "" : <Flagged pct={pct} short />}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Flagged({ pct, short = false }: { pct: number; short?: boolean }) {
  if (pct > RAMP_WARN) {
    return <span style={{ color: "var(--warn)" }} title="More than a 10% jump on the week before">⚠ {pctText(pct)}{short ? "" : " vs week before"}</span>;
  }
  return <span className="ink2">{pctText(pct)}{short ? "" : " vs week before"}</span>;
}

const RACES = [
  { key: "5k", label: "5K" },
  { key: "10k", label: "10K" },
  { key: "half", label: "Half" },
  { key: "marathon", label: "Marathon" },
] as const;

/** Garmin's race predictor and lactate threshold, with change over the range. */
export function PredictionsCard({ data, color }: { data: SportData; color: string }) {
  const preds = data.predictions ?? [];
  const first = preds[0], last = preds[preds.length - 1];
  const lt = data.threshold;
  const ltFirst = lt?.history[0];
  if (!last && !lt?.latest) {
    return (
      <section className="card span-4">
        <div className="chart-title"><span>Race predictions</span></div>
        <div className="empty">Garmin hasn't shared race predictions or a lactate threshold for this account yet.</div>
      </section>
    );
  }
  return (
    <section className="card span-4">
      <div className="chart-title"><span>Race predictions</span></div>
      <div className="chart-hint">Garmin's estimates · change since {first ? shortDate(first.date) : "the start of the range"}</div>
      {last && (
        <div className="mini-tiles four">
          {RACES.map((r) => {
            const now = last[r.key], then = first?.[r.key];
            const diff = now != null && then != null ? now - then : null;
            return (
              <div className="tile" key={r.key}>
                <div className="k">{r.label}</div>
                <div className="v tnum">{mmss(now)}</div>
                <div className="d tnum">
                  {diff == null || Math.abs(diff) < 1 ? " " : (
                    <span style={{ color: diff < 0 ? "var(--good)" : "var(--bad)" }} title={diff < 0 ? "faster" : "slower"}>
                      {diff < 0 ? "▲ −" : "▼ +"}{mmss(Math.abs(diff))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {preds.length > 1 && (
        <TrendChart
          points={preds.filter((p) => p["5k"] != null).map((p) => ({ date: p.date, value: p["5k"]! }))}
          color={color} format={mmss} invert lineOnly start={data.start} end={data.end} height={110}
        />
      )}
      {lt?.latest && (
        <div className="lt-row">
          <span className="k">Lactate threshold</span>
          <b className="tnum">{lt.latest.pace_s_km ? `${mmss(lt.latest.pace_s_km)} /km` : "—"}</b>
          <b className="tnum">{lt.latest.hr ? `${lt.latest.hr} bpm` : ""}</b>
          {ltFirst?.pace_s_km && lt.latest.pace_s_km && ltFirst.pace_s_km !== lt.latest.pace_s_km && (
            <span className="tnum" style={{ color: lt.latest.pace_s_km < ltFirst.pace_s_km ? "var(--good)" : "var(--bad)" }}>
              {lt.latest.pace_s_km < ltFirst.pace_s_km ? "▲" : "▼"} from {mmss(ltFirst.pace_s_km)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/** Distance on each pair of running shoes against its replacement mileage. */
export function ShoesCard({ data }: { data: SportData }) {
  const shoes = data.shoes ?? [];
  const active = shoes.filter((s) => !s.retired);
  const retired = shoes.length - active.length;
  return (
    <section className="card span-12">
      <div className="card-head">
        <h2>Shoes</h2>
        <span className="sub">distance logged in Garmin Connect{retired ? ` · ${retired} retired pair${retired > 1 ? "s" : ""} hidden` : ""}</span>
      </div>
      {!active.length ? (
        <div className="empty">No running shoes in Garmin Connect. Add them under Gear in the Garmin Connect app to track their mileage here.</div>
      ) : (
        <div className="shoes">
          {active.map((s) => {
            const pct = (s.km / s.max_km) * 100;
            const state = pct >= 100 ? { c: "var(--bad)", t: "⛔ Past its mileage" } : pct >= 80 ? { c: "var(--warn)", t: "⚠ Replace soon" } : null;
            return (
              <div className="shoe tile" key={s.id}>
                <div className="shoe-head">
                  <b>{s.name}</b>
                  {state && <span style={{ color: state.c }}>{state.t}</span>}
                </div>
                <div className="v tnum">{Math.round(s.km)} <small>/ {s.max_km} km{s.max_set ? "" : " (typical)"}</small></div>
                <div className="shoe-bar"><i style={{ width: `${Math.min(100, pct)}%`, background: state?.c ?? "var(--accent)" }} /></div>
                <div className="d">
                  {s.activities != null ? `${s.activities} runs` : ""}{s.since ? ` · since ${shortDate(s.since, true)}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Cycling FTP and watts per kilo over the range. */
export function FtpCard({ data, color }: { data: SportData; color: string }) {
  const ftp = data.ftp;
  const hist = ftp?.history ?? [];
  const first = hist[0], latest = ftp?.latest;
  return (
    <section className="card span-8">
      <div className="chart-title"><span>FTP and power-to-weight</span></div>
      <div className="chart-hint">Garmin's FTP estimate · watts per kilo use your nearest weigh-in</div>
      {!latest ? (
        <div className="empty">No FTP from Garmin yet. It needs rides with a power meter (or an FTP test).</div>
      ) : (
        <>
          <div className="mini-tiles four">
            <div className="tile">
              <div className="k">FTP</div>
              <div className="v tnum">{latest.ftp} <small>W</small></div>
              <div className="d">{first && first.ftp !== latest.ftp ? <Change now={latest.ftp} then={first.ftp} unit=" W" /> : `as of ${shortDate(latest.date)}`}</div>
            </div>
            <div className="tile">
              <div className="k">W/kg</div>
              <div className="v tnum">{latest.wkg?.toFixed(2) ?? "—"}</div>
              <div className="d">{first?.wkg && latest.wkg && first.wkg !== latest.wkg ? <Change now={latest.wkg} then={first.wkg} digits={2} /> : " "}</div>
            </div>
            <div className="tile">
              <div className="k">Weight</div>
              <div className="v tnum">{ftp?.weight_kg?.toFixed(1) ?? "—"} <small>kg</small></div>
              <div className="d">{ftp?.weight_kg ? "latest weigh-in" : "log weight in Garmin for W/kg"}</div>
            </div>
            <div className="tile">
              <div className="k">20-min power</div>
              <div className="v tnum">{bestTwenty(data) ?? "—"} <small>W</small></div>
              <div className="d">best in this range</div>
            </div>
          </div>
          {hist.length > 0 && (
            <div className="two-charts">
              <div>
                <div className="chart-title"><span>FTP</span></div>
                <TrendChart points={stepped(hist.map((h) => ({ date: h.date, value: h.ftp })), data.end)} color={color}
                  format={(v) => `${Math.round(v)} W`} lineOnly start={data.start} end={data.end} height={130} />
              </div>
              <div>
                <div className="chart-title"><span>W/kg</span></div>
                <TrendChart points={stepped(hist.filter((h) => h.wkg != null).map((h) => ({ date: h.date, value: h.wkg! })), data.end)}
                  color={color} format={(v) => v.toFixed(2)} lineOnly start={data.start} end={data.end} height={130} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Carry the last reading to the end of the range, so a step value draws as a line to today. */
function stepped(points: { date: string; value: number }[], end: string) {
  if (!points.length) return points;
  const last = points[points.length - 1];
  return last.date < end ? [...points, { date: end, value: last.value }] : points;
}

function bestTwenty(data: SportData): number | null {
  const v = data.sessions.map((s) => s.max_20min_power).filter((x): x is number => x != null);
  return v.length ? Math.round(Math.max(...v)) : null;
}

function Change({ now, then, unit = "", digits = 0 }: { now: number; then: number; unit?: string; digits?: number }) {
  const d = now - then;
  return (
    <span style={{ color: d > 0 ? "var(--good)" : "var(--bad)" }}>
      {d > 0 ? "▲ +" : "▼ −"}{Math.abs(d).toFixed(digits)}{unit} in range
    </span>
  );
}

// Training paces from CSS (seconds per 100 m added to it), after Swim Smooth's CSS zones.
const CSS_PACES = [
  { label: "Endurance", add: [6, 10], note: "long aerobic sets" },
  { label: "Threshold", add: [-1, 2], note: "CSS sets, short rest" },
  { label: "Speed", add: [-6, -3], note: "short, fast repeats" },
];

/** Critical swim speed: the pace you could hold for ~30 min, from your best 200 m and 400 m. */
export function CssCard({ data, color }: { data: SportData; color: string }) {
  const css = data.css;
  return (
    <section className="card span-12">
      <div className="card-head">
        <h2>Critical swim speed</h2>
        <span className="sub">from your fastest 200 m and 400 m intervals in this range · (T400 − T200) ÷ 2</span>
      </div>
      {!css ? (
        <div className="empty">
          Needs a 200 m and a 400 m swum as single intervals (pause your watch between them) in this range. A 400 time
          trial and a 200 time trial in one session is the classic way.
        </div>
      ) : (
        <div className="css">
          <div>
            <div className="tile">
              <div className="k">CSS pace</div>
              <div className="v tnum">{mmss(css.pace_s100)} <small>/100m</small></div>
              <div className="d">{css.history.length > 1 ? <CssChange history={css.history} /> : " "}</div>
            </div>
            <div className="css-efforts muted">
              <div>Best 200 m <b className="tnum">{mmss(css.t200.value)}</b> · {shortDate(css.t200.date)}</div>
              <div>Best 400 m <b className="tnum">{mmss(css.t400.value)}</b> · {shortDate(css.t400.date)}</div>
            </div>
          </div>
          <div className="css-paces">
            {CSS_PACES.map((p) => (
              <div className="tile" key={p.label}>
                <div className="k">{p.label}</div>
                <div className="v tnum">{mmss(css.pace_s100 + p.add[0])}–{mmss(css.pace_s100 + p.add[1])}</div>
                <div className="d">{p.note}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="chart-title"><span>CSS over time</span><span className="muted">8-week best, every 4 weeks · up = faster</span></div>
            {css.history.length > 1 ? (
              <TrendChart points={css.history} color={color} format={mmss} invert lineOnly start={data.start} end={data.end} height={130} />
            ) : (
              <div className="empty">Pick a longer range to see the trend.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CssChange({ history }: { history: { value: number }[] }) {
  const d = history[history.length - 1].value - history[0].value;
  if (Math.abs(d) < 0.5) return <span className="ink2">≈ unchanged in range</span>;
  return (
    <span style={{ color: d < 0 ? "var(--good)" : "var(--bad)" }}>
      {d < 0 ? "▲ −" : "▼ +"}{Math.abs(d).toFixed(1)} s in range
    </span>
  );
}

import { mmss, shortDate } from "../format";
import { effectiveness } from "../performance";
import type { SportData } from "../types";

const SHOW_KEY = 8;

/** Did key sessions hit their target, did easy ones stay easy, and are repeated sessions improving? */
export function EffectivenessCard({ data, sport }: { data: SportData; sport: "run" | "ride" }) {
  const e = effectiveness(data.sessions, sport);
  const fmt = (v: number) => (sport === "run" ? `${mmss(v)} /km` : `${Math.round(v)} W`);
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  return (
    <section className="card span-12">
      <div className="card-head">
        <h2>Session effectiveness</h2>
        <span className="sub">key sessions vs their target zones and Garmin's primary benefit · easy sessions kept easy · this range</span>
      </div>
      <div className="mini-tiles three">
        <div className="tile">
          <div className="k">Key sessions on target</div>
          <div className="v tnum">{e.keyJudged ? `${e.keyOnTarget}/${e.keyJudged}` : "—"}</div>
          <div className="d">{e.keyJudged ? pct(e.keyOnTarget, e.keyJudged) : "no key sessions with heart rate"}</div>
        </div>
        <div className="tile">
          <div className="k">Easy sessions kept easy</div>
          <div className="v tnum">{e.easyJudged ? `${e.easyKept}/${e.easyJudged}` : "—"}</div>
          <div className="d">75%+ of time in Z1–2</div>
        </div>
        <div className="tile">
          <div className="k">Grey-zone creep</div>
          <div className="v tnum">{e.easyGrey == null ? "—" : `${Math.round(e.easyGrey * 100)}%`}</div>
          <div className="d">of easy-session time spent in Z3+</div>
        </div>
      </div>
      <div className="eff">
        <div>
          <div className="chart-title"><span>Recent key sessions</span><span className="muted">target · time in target zones · Garmin's benefit</span></div>
          {!e.key.length ? (
            <div className="empty">No key sessions in this range.</div>
          ) : (
            <table className="sessions eff-table">
              <tbody>
                {e.key.slice(0, SHOW_KEY).map((k) => (
                  <tr key={k.s.id}>
                    <td className="muted tnum">{shortDate(k.s.date)}</td>
                    <td>{k.s.name}<div className="muted eff-sub">{k.intent} · aim {k.target}</div></td>
                    <td className="num tnum">{k.share == null ? "—" : `${Math.round(k.share * 100)}%`}</td>
                    <td>{k.benefit ?? <span className="muted">—</span>}</td>
                    <td className="num">
                      {k.onTarget == null ? <span className="muted">no data</span> : k.onTarget ? (
                        <span style={{ color: "var(--good)" }}>✓ on target</span>
                      ) : (
                        <span style={{ color: "var(--warn)" }} title="Not enough time in the target zones, and Garmin's benefit didn't match">⚠ too easy</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <div className="chart-title"><span>Repeated sessions</span><span className="muted">latest vs your previous 3 · {sport === "run" ? "avg pace" : "power"}</span></div>
          {!e.progressions.length ? (
            <div className="empty">Repeat a key session (same title) to see whether it's getting {sport === "run" ? "faster" : "stronger"}.</div>
          ) : (
            <div className="prog">
              {e.progressions.slice(0, 6).map((p) => (
                <div className="prog-row" key={p.title}>
                  <div>
                    <div>{p.title}</div>
                    <div className="muted eff-sub">{shortDate(p.latest.date)} · {p.count} times in range</div>
                  </div>
                  <div className="tnum">{fmt(p.value)}<div className="muted eff-sub">vs {fmt(p.previous)}</div></div>
                  <div className="tnum" style={{ color: Math.abs(p.pct) < 0.5 ? "var(--ink-2)" : p.pct > 0 ? "var(--good)" : "var(--bad)" }}>
                    {Math.abs(p.pct) < 0.5 ? "≈ same" : `${p.pct > 0 ? "▲" : "▼"} ${Math.abs(p.pct).toFixed(1)}% ${p.pct > 0 ? "better" : "worse"}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import { duration, titleCase } from "../format";
import type { Readiness, SleepNight } from "../types";

function vsAvg(key: string, r: Readiness | null) {
  const i = r?.inputs.find((x) => x.key === key);
  if (!i || i.today == null) return { value: null, note: "" };
  const d = i.baseline_mean != null ? i.today - i.baseline_mean : null;
  const good = i.effect != null && i.effect >= 0.5;
  const bad = i.effect != null && i.effect <= -0.5;
  return {
    value: i.today,
    note: d == null ? "" : `${d > 0 ? "+" : ""}${Math.round(d)} vs avg`,
    tone: good ? "var(--good)" : bad ? "var(--bad)" : "var(--ink-2)",
  };
}

export function MorningCard({ nights, readiness }: { nights: SleepNight[]; readiness: Readiness | null }) {
  const last = nights[nights.length - 1];
  const hrv = vsAvg("hrv", readiness);
  const rhr = vsAvg("resting_hr", readiness);
  const recent = readiness?.recent;
  const ramp = recent?.run_ramp_pct;

  return (
    <section className="card">
      <div className="card-head">
        <h2>This morning</h2>
        {readiness?.garmin?.score != null && (
          <span className="sub">Garmin readiness {readiness.garmin.score} · {titleCase(readiness.garmin.level)}</span>
        )}
      </div>
      <div className="tiles four">
        <div className="tile">
          <div className="k">Sleep</div>
          <div className="v tnum">{last ? duration(last.duration_s) : "—"}</div>
          <div className="d">{last?.score != null ? `Score ${last.score}` : " "}</div>
        </div>
        <div className="tile">
          <div className="k">HRV</div>
          <div className="v tnum">{hrv.value != null ? Math.round(hrv.value) : "—"}<small>ms</small></div>
          <div className="d" style={{ color: hrv.tone }}>{hrv.note || " "}</div>
        </div>
        <div className="tile">
          <div className="k">Resting HR</div>
          <div className="v tnum">{rhr.value != null ? Math.round(rhr.value) : "—"}<small>bpm</small></div>
          <div className="d" style={{ color: rhr.tone }}>{rhr.note || " "}</div>
        </div>
        <div className="tile">
          <div className="k">Body Battery</div>
          <div className="v tnum">{last?.body_battery_wake ?? "—"}</div>
          <div className="d">at wake</div>
        </div>
      </div>
      {recent && (
        <ul className="facts">
          <li>
            <span>Knee rehab this week</span>
            <b className="tnum">{recent.rehab_7d} sessions</b>
          </li>
          <li>
            <span>Running, last 7 days</span>
            <b className="tnum">
              {recent.run_km_7d} km
              {ramp != null && (
                <span style={{ color: ramp > 10 ? "var(--warn)" : "var(--ink-2)", fontWeight: 500, marginLeft: 6 }}>
                  {ramp > 10 ? "▲ " : ""}{ramp > 0 ? "+" : ""}{ramp}% vs usual week
                </span>
              )}
            </b>
          </li>
          <li>
            <span>Last hard session</span>
            <b className="tnum">
              {recent.days_since_hard == null ? "none in 5 weeks" : recent.days_since_hard === 1 ? "yesterday" : `${recent.days_since_hard} days ago`}
            </b>
          </li>
        </ul>
      )}
    </section>
  );
}

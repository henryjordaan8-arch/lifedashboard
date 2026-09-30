import type { Alert } from "../types";

const ICON: Record<Alert["severity"], string> = { critical: "■", warning: "▲" };

/** Multi-signal flags (illness onset, overreaching, sleep debt). Not part of the score. */
export function AlertsBar({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="alerts" role="region" aria-label="Alerts">
      {alerts.map((a) => (
        <div key={a.id} className={`alert ${a.severity}`} role="alert">
          <span className="alert-icon" aria-hidden>{ICON[a.severity]}</span>
          <div style={{ minWidth: 0 }}>
            <div className="alert-title">{a.title}</div>
            <div className="alert-detail">{a.detail}</div>
            {a.signals.length > 0 && (
              <ul className="alert-signals">
                {a.signals.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

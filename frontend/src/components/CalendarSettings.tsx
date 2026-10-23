import { useState } from "react";
import { createPortal } from "react-dom";
import { parseSources, saveSources, sourcesText } from "../mobile/calendar";

/** Android app: paste Google Calendar's secret iCal addresses (kept only on the phone). */
export function CalendarSettings({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(sourcesText);
  const count = parseSources(text).length;

  // Rendered outside the scaled dashboard so it's full size on the phone.
  return createPortal(
    <div className="login-page settings-page" role="dialog" aria-modal="true" aria-label="Calendar">
      <div className="card login-card settings-card">
        <h1>Google Calendar</h1>
        <p className="muted">
          In Google Calendar on a computer: ⚙️ <b>Settings</b> → your calendar under <i>Settings for my calendars</i> →{" "}
          <b>Integrate calendar</b> → copy the <b>Secret address in iCal format</b>. Paste one address per line.
        </p>
        <p className="muted">
          Events are sorted into training, study, work and so on by their titles. To put a whole calendar in one
          category, start its line with the category, for example <code>study: https://…</code>.
        </p>
        <label htmlFor="ics">Calendar addresses</label>
        <textarea
          id="ics" rows={5} spellCheck={false} autoCapitalize="off" autoCorrect="off"
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          value={text} onChange={(e) => setText(e.target.value)}
        />
        <div className="muted" style={{ fontSize: 12 }}>
          {count} calendar{count === 1 ? "" : "s"} · kept only on this phone. Treat these addresses like passwords.
        </div>
        <button className="btn primary" onClick={() => (saveSources(text), onClose())}>Save</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body,
  );
}

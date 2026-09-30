import { type ReactNode, useEffect, useRef } from "react";

/** Full-size overlay for an enlarged chart. Esc, the ✕ button or a click outside closes it. */
export function ChartModal({ title, subtitle, onClose, children }: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="chart-hint" style={{ margin: 0 }}>{subtitle}</div>}
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
        <div className="modal-foot muted">Hover the chart for details · Esc to close</div>
      </div>
    </div>
  );
}

export function ExpandButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="expand-btn" onClick={onClick} aria-label={`Expand ${label}`} title="Expand">
      <span aria-hidden>⤢</span>
    </button>
  );
}

import { useState, type ReactNode } from 'react';

/**
 * In-app confirmation (the browser's confirm() is blocked in some views and looks foreign to kids).
 * With `typeToConfirm`, the parent must type a word before the dangerous button is enabled.
 */
export function ConfirmModal({
  title,
  children,
  confirmLabel,
  danger,
  typeToConfirm,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  typeToConfirm?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const ready = !typeToConfirm || typed.trim() === typeToConfirm;
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
        {typeToConfirm && (
          <>
            <p className="small">
              כדי לאשר, הקלידו: <b>{typeToConfirm}</b>
            </p>
            <input id="confirm-type" className="field" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <button className={`btn grow ${danger ? 'pink' : 'green'}`} disabled={!ready || busy} onClick={onConfirm}>
            {busy ? '...' : confirmLabel}
          </button>
          <button className="btn white" onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

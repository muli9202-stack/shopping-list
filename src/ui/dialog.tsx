import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';

interface DialogRequest {
  kind: 'confirm' | 'prompt';
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
  initial?: string;
  placeholder?: string;
  resolve: (v: string | boolean | null) => void;
}

const useDialogs = create<{ current: DialogRequest | null }>(() => ({ current: null }));

export function confirmDialog(opts: { title: string; message?: string; confirmText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) =>
    useDialogs.setState({ current: { kind: 'confirm', ...opts, resolve: (v) => resolve(v === true) } }),
  );
}

export function promptDialog(opts: { title: string; message?: string; initial?: string; placeholder?: string; confirmText?: string }): Promise<string | null> {
  return new Promise((resolve) =>
    useDialogs.setState({
      current: { kind: 'prompt', ...opts, resolve: (v) => resolve(typeof v === 'string' && v.trim() ? v.trim() : null) },
    }),
  );
}

export function DialogHost() {
  const req = useDialogs((s) => s.current);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (req?.kind === 'prompt') {
      setValue(req.initial ?? '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [req]);

  if (!req) return null;
  const close = (v: string | boolean | null) => {
    useDialogs.setState({ current: null });
    req.resolve(v);
  };

  return (
    <div className="overlay" onClick={() => close(null)}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          close(req.kind === 'prompt' ? value : true);
        }}
      >
        <h3>{req.title}</h3>
        {req.message && <p className="muted">{req.message}</p>}
        {req.kind === 'prompt' && (
          <input ref={inputRef} className="input" value={value} placeholder={req.placeholder} onChange={(e) => setValue(e.target.value)} />
        )}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => close(null)}>
            ביטול
          </button>
          <button type="submit" className={`btn ${req.danger ? 'danger' : 'primary'}`}>
            {req.confirmText ?? 'אישור'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="סגירה">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

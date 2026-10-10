import { useState } from 'react';

/** 4-digit code entry with big keys. Calls onDone with the code; the parent decides if it is right. */
export function PinPad({ title, onDone, error }: { title: string; onDone: (code: string) => void; error?: string }) {
  const [entry, setEntry] = useState('');
  const press = (d: string) => {
    const v = (entry + d).slice(0, 4);
    setEntry(v);
    if (v.length === 4)
      setTimeout(() => {
        setEntry('');
        onDone(v);
      }, 150);
  };
  return (
    <div className="center" style={{ gap: 10 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>{title}</p>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < entry.length ? 'on' : ''} />
        ))}
      </div>
      <div className="pinpad" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) =>
          d ? (
            <button key={i} onClick={() => (d === '⌫' ? setEntry(entry.slice(0, -1)) : press(d))}>
              {d}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      {error && <div style={{ color: 'var(--red)' }}>{error}</div>}
    </div>
  );
}

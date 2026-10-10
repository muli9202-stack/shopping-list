import { explainFix, letterMarks } from '../engine/explain';

/** What the child wrote (wrong letters in red), the right spelling, and why. */
export function Correction({ expected, typed }: { expected: string; typed: string }) {
  const why = explainFix(expected, typed);
  return (
    <div className="center" style={{ gap: 4, animation: 'pop .4s' }}>
      <div className="word-big" style={{ fontSize: 44, textDecoration: 'line-through wavy var(--red)' }}>
        {letterMarks(expected, typed).map((m, i) => (
          <span key={i} style={{ color: m.ok ? 'var(--ink)' : 'var(--red)' }}>
            {m.ch}
          </span>
        ))}
      </div>
      <div className="word-big" style={{ fontSize: 56, color: 'var(--green)' }}>
        {expected}
      </div>
      {why.map((w) => (
        <div key={w} className="small" style={{ fontWeight: 700, color: '#495057' }}>
          💡 {w}
        </div>
      ))}
    </div>
  );
}

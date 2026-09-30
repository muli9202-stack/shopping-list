import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useNav, type Route } from '../nav';
import { TopBar, useSpeakOnMount } from '../ui/kit';

/**
 * Parent gate (Google Play Families requirement): a multiplication question young kids can't solve,
 * then the parent's own 4-digit code. The first time, the parent chooses the code.
 */
export function ParentGateScreen({ next }: { next: Route }) {
  const pin = useStore((s) => s.settings.parentPin);
  const setSettings = useStore((s) => s.setSettings);
  const replace = useNav((s) => s.replace);
  const [stage, setStage] = useState<'math' | 'pin' | 'new' | 'confirm'>(pin ? 'pin' : 'math');
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState('');
  useSpeakOnMount('האזור הזה מיועד להורים בלבד.');

  const q = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    return { a, b, ans: a * b };
  }, []);

  const [mathAns, setMathAns] = useState('');
  const [resetting, setResetting] = useState(false);

  const press = (d: string) => {
    setErr('');
    const v = (entry + d).slice(0, 4);
    setEntry(v);
    if (v.length < 4) return;
    setTimeout(() => {
      if (stage === 'pin') {
        if (v === pin) replace(next);
        else {
          setErr('הקוד לא נכון');
          setEntry('');
        }
      } else if (stage === 'new') {
        setFirst(v);
        setEntry('');
        setStage('confirm');
      } else if (stage === 'confirm') {
        if (v === first) {
          setSettings({ parentPin: v });
          replace(next);
        } else {
          setErr('הקודים לא תואמים, נסו שוב');
          setEntry('');
          setStage('new');
        }
      }
    }, 150);
  };

  return (
    <div className="screen" style={{ background: '#f3f0ff' }}>
      <TopBar title="🔒 אזור הורים" right={<span style={{ width: 52 }} />} />
      <div className="card center" style={{ gap: 10 }}>
        {stage === 'math' ? (
          <>
            <p>כדי להמשיך, פתרו את התרגיל:</p>
            <div style={{ fontSize: 40, fontWeight: 700 }} dir="ltr">
              {q.a} × {q.b} = ?
            </div>
            <input className="field" inputMode="numeric" dir="ltr" style={{ textAlign: 'center', maxWidth: 160 }} value={mathAns} onChange={(e) => setMathAns(e.target.value.replace(/\D/g, ''))} />
            <button
              className="btn purple"
              onClick={() => {
                if (Number(mathAns) === q.ans) {
                  setStage(pin && !resetting ? 'pin' : 'new');
                  setErr('');
                } else setErr('התשובה לא נכונה');
              }}
            >
              המשך
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>{stage === 'pin' ? 'הקלידו את קוד ההורים' : stage === 'new' ? 'בחרו קוד הורים בן 4 ספרות' : 'הקלידו את הקוד שוב לאישור'}</p>
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
            {stage === 'pin' && (
              <button className="btn ghost" onClick={() => { setResetting(true); setStage('math'); setEntry(''); }}>
                שכחתי את הקוד
              </button>
            )}
          </>
        )}
        {err && <div style={{ color: 'var(--red)' }}>{err}</div>}
      </div>
      {stage === 'math' && pin && !resetting && <p className="small muted center">אחרי התרגיל תתבקשו להקליד את קוד ההורים.</p>}
    </div>
  );
}

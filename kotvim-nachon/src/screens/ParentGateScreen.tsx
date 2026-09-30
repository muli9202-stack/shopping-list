import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useNav, type Route } from '../nav';
import { TopBar, useSpeakOnMount } from '../ui/kit';
import { currentEmail, reauthenticate, signInMethod } from '../services/account';
import { authErrorText } from '../services/auth';

type Stage = 'math' | 'pin' | 'new' | 'confirm' | 'reauth';

/**
 * Parent gate (Google Play Families requirement). The parent's 4-digit code protects the parents'
 * area. The first time, a multiplication question comes first and then the parent chooses a code.
 * "Forgot the code" asks for the account password again – a child cannot reset the code.
 */
export function ParentGateScreen({ next }: { next: Route }) {
  const pin = useStore((s) => s.settings.parentPin);
  const mode = useStore((s) => s.mode);
  const setSettings = useStore((s) => s.setSettings);
  const replace = useNav((s) => s.replace);
  const [stage, setStage] = useState<Stage>(pin ? 'pin' : 'math');
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState('');
  const [mathAns, setMathAns] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useSpeakOnMount('האזור הזה מיועד להורים בלבד.');

  const q = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    return { a, b, ans: a * b };
  }, []);

  const press = (d: string) => {
    if (busy) return;
    setErr('');
    const v = (entry + d).slice(0, 4);
    setEntry(v);
    if (v.length < 4) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
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

  const forgot = () => {
    setEntry('');
    setErr('');
    // with an account, only the parent's password (or Google login) can reset the code
    setStage(mode === 'cloud' ? 'reauth' : 'math');
  };

  const doReauth = async () => {
    setBusy(true);
    setErr('');
    try {
      await reauthenticate(password);
      setStage('new');
    } catch (e) {
      setErr(authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const google = signInMethod() === 'google';

  return (
    <div className="screen" style={{ background: '#f3f0ff' }}>
      <TopBar title="🔒 אזור הורים" right={<span style={{ width: 52 }} />} />
      <div className="card center" style={{ gap: 10 }}>
        {stage === 'math' && (
          <>
            <p>כדי להמשיך, פתרו את התרגיל:</p>
            <div style={{ fontSize: 40, fontWeight: 700 }} dir="ltr">
              {q.a} × {q.b} = ?
            </div>
            <input id="gate-math" className="field" inputMode="numeric" dir="ltr" style={{ textAlign: 'center', maxWidth: 160 }} value={mathAns} onChange={(e) => setMathAns(e.target.value.replace(/\D/g, ''))} />
            <button
              className="btn purple"
              onClick={() => {
                if (Number(mathAns) === q.ans) {
                  setStage('new');
                  setErr('');
                } else setErr('התשובה לא נכונה');
              }}
            >
              המשך
            </button>
          </>
        )}

        {stage === 'reauth' && (
          <>
            <p style={{ margin: 0 }}>כדי לבחור קוד חדש, אמתו שזה אתם{google ? '' : ` – הקלידו את הסיסמה של ${currentEmail() ?? 'החשבון'}`}:</p>
            {!google && <input id="gate-password" className="field" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
            <button className="btn purple" disabled={busy || (!google && password.length < 6)} onClick={doReauth}>
              {busy ? '...' : google ? 'אימות עם Google' : 'אימות'}
            </button>
          </>
        )}

        {(stage === 'pin' || stage === 'new' || stage === 'confirm') && (
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
              <button className="btn ghost" onClick={forgot}>
                שכחתי את הקוד
              </button>
            )}
          </>
        )}
        {err && <div style={{ color: 'var(--red)' }}>{err}</div>}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { firebaseEnabled } from '../services/firebase';
import { authErrorText, signInWithEmail, signInWithGoogle } from '../services/auth';
import { resetPassword } from '../services/account';
import { useStore } from '../store';
import { useNav } from '../nav';
import { Mascot } from '../ui/Mascot';
import { useSpeakOnMount } from '../ui/kit';
import { speak } from '../services/tts';

/**
 * First screen. The account belongs to the parent, so login sits behind a neutral parent check
 * (Google Play Families policy: sign-in only behind an age/parent screen). Login with email is required.
 */
export function LoginScreen() {
  const setMode = useStore((s) => s.setMode);
  const reset = useNav((s) => s.reset);
  const [stage, setStage] = useState<'welcome' | 'gate' | 'login'>('welcome');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [ans, setAns] = useState('');
  const q = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    return { a, b };
  }, []);
  useSpeakOnMount('ברוכים הבאים לכותבים נכון! כדי להתחיל, צריך שאבא או אמא יתחברו. קראו להורים ולחצו על הכפתור.');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    setInfo('');
    try {
      await fn();
      // App.tsx notices the signed-in parent and opens the family page
    } catch (e) {
      setErr(authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <div className="screen sky-bg center" style={{ justifyContent: 'center', gap: 14 }}>
      <Mascot size={stage === 'welcome' ? 150 : 100} cheer />
      <h1 style={{ fontSize: 44, color: 'var(--purple)', margin: 0 }}>
        כותבים <span className="script" style={{ color: 'var(--orange)', fontSize: 56 }}>נכון</span>
      </h1>

      {stage === 'welcome' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>לומדים לכתוב בלי שגיאות – בכיף, במשחק!</p>
          <div className="card center" style={{ maxWidth: 380, gap: 10 }}>
            <b>👨‍👩‍👧 את החשבון פותחים ההורים</b>
            <p className="small muted" style={{ margin: 0 }}>
              ההורה מתחבר פעם אחת עם המייל, ומוסיף את הילדים. ההתקדמות של כל ילד נשמרת בחשבון.
            </p>
            <button
              className="btn big purple"
              onClick={() => {
                setStage('gate');
                speak('הורים, פתרו את התרגיל כדי להמשיך.');
              }}
            >
              🔑 כניסת הורים
            </button>
          </div>
        </>
      )}

      {stage === 'gate' && (
        <div className="card center" style={{ width: '100%', maxWidth: 380, gap: 10 }}>
          <b>לפני שממשיכים – שאלה להורים</b>
          <div style={{ fontSize: 40, fontWeight: 700 }} dir="ltr">
            {q.a} × {q.b} = ?
          </div>
          <input id="gate-answer" className="field" inputMode="numeric" dir="ltr" style={{ textAlign: 'center', maxWidth: 160 }} value={ans} onChange={(e) => setAns(e.target.value.replace(/\D/g, ''))} />
          <button
            className="btn purple"
            onClick={() => {
              if (Number(ans) === q.a * q.b) {
                setErr('');
                setStage('login');
              } else setErr('התשובה לא נכונה, נסו שוב');
            }}
          >
            המשך
          </button>
          {err && <div style={{ color: 'var(--red)' }}>{err}</div>}
        </div>
      )}

      {stage === 'login' && (
        <div className="card" style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {firebaseEnabled ? (
            <>
              <b>{isNew ? 'פתיחת חשבון הורה חדש' : 'כניסה עם המייל שלכם'}</b>
              <label className="small muted" htmlFor="login-email">
                מייל
              </label>
              <input id="login-email" className="field" type="email" dir="ltr" autoComplete="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className="small muted" htmlFor="login-pass">
                סיסמה {isNew ? '(לפחות 6 תווים)' : ''}
              </label>
              <input id="login-pass" className="field" type="password" dir="ltr" autoComplete={isNew ? 'new-password' : 'current-password'} value={pass} onChange={(e) => setPass(e.target.value)} />
              <button className="btn blue block" disabled={busy || !emailOk || pass.length < 6} onClick={() => run(() => signInWithEmail(email.trim(), pass, isNew))}>
                {busy ? '...' : isNew ? 'פתיחת חשבון' : 'כניסה'}
              </button>
              <button className="btn ghost" onClick={() => setIsNew(!isNew)}>
                {isNew ? 'כבר יש לי חשבון – כניסה' : 'אין לי חשבון – פתיחת חשבון חדש'}
              </button>
              {!isNew && (
                <button
                  className="btn ghost"
                  disabled={!emailOk || busy}
                  onClick={() => run(async () => {
                    await resetPassword(email.trim());
                    setInfo('שלחנו מייל לאיפוס הסיסמה ✉️');
                  })}
                >
                  שכחתי סיסמה
                </button>
              )}
              <div className="row small muted" style={{ justifyContent: 'center' }}>
                — או —
              </div>
              <button className="btn white block" disabled={busy} onClick={() => run(signInWithGoogle)}>
                כניסה עם חשבון Google
              </button>
            </>
          ) : (
            <>
              <b>גרסת הדגמה</b>
              <p className="small muted" style={{ margin: 0 }}>
                בגרסה הזו החיבור לחשבון עוד לא הוגדר, ולכן הכול נשמר רק במכשיר הזה.
              </p>
              <button
                className="btn big green"
                onClick={() => {
                  setMode('local');
                  reset({ name: 'family' });
                }}
              >
                בואו נתחיל!
              </button>
            </>
          )}
          {err && <div style={{ color: 'var(--red)' }}>{err}</div>}
          {info && <div style={{ color: 'var(--green)' }}>{info}</div>}
        </div>
      )}
    </div>
  );
}

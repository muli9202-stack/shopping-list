import { useState } from 'react';
import { useStore } from '../store';
import { useNav, type Route } from '../nav';
import { TopBar, useSpeakOnMount } from '../ui/kit';
import { currentEmail, reauthenticate, signInMethod } from '../services/account';
import { authErrorText } from '../services/auth';
import { PinPad } from '../ui/PinPad';

type Stage = 'pin' | 'new' | 'confirm' | 'reauth';

/**
 * Parent gate. The parents' area is protected by a 4-digit code the parents choose the first time.
 * "Forgot the code" asks for the account password again – a child cannot reset the code.
 */
export function ParentGateScreen({ next }: { next: Route }) {
  const pin = useStore((s) => s.settings.parentPin);
  const mode = useStore((s) => s.mode);
  const setSettings = useStore((s) => s.setSettings);
  const replace = useNav((s) => s.replace);
  const [stage, setStage] = useState<Stage>(pin ? 'pin' : 'new');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useSpeakOnMount('האזור הזה מיועד להורים בלבד.');

  const done = (v: string) => {
    setErr('');
    if (stage === 'pin') {
      if (v === pin) replace(next);
      else setErr('הקוד לא נכון');
    } else if (stage === 'new') {
      setFirst(v);
      setStage('confirm');
    } else if (stage === 'confirm') {
      if (v === first) {
        setSettings({ parentPin: v });
        replace(next);
      } else {
        setErr('הקודים לא תואמים, נסו שוב');
        setStage('new');
      }
    }
  };

  const forgot = () => {
    setErr('');
    // with an account, only the parent's password (or Google login) can reset the code
    setStage(mode === 'cloud' ? 'reauth' : 'new');
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
        {stage === 'reauth' && (
          <>
            <p style={{ margin: 0 }}>כדי לבחור קוד חדש, אמתו שזה אתם{google ? '' : ` – הקלידו את הסיסמה של ${currentEmail() ?? 'החשבון'}`}:</p>
            {!google && <input id="gate-password" className="field" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
            <button className="btn purple" disabled={busy || (!google && password.length < 6)} onClick={doReauth}>
              {busy ? '...' : google ? 'אימות עם Google' : 'אימות'}
            </button>
            {err && <div style={{ color: 'var(--red)' }}>{err}</div>}
          </>
        )}
        {stage !== 'reauth' && (
          <PinPad
            key={stage}
            title={stage === 'pin' ? 'הקלידו את קוד ההורים' : stage === 'new' ? 'הורים, בחרו קוד בן 4 ספרות' : 'הקלידו את הקוד שוב לאישור'}
            onDone={done}
            error={err}
          />
        )}
        {stage === 'pin' && (
          <button className="btn ghost" onClick={forgot}>
            שכחתי את הקוד
          </button>
        )}
      </div>
    </div>
  );
}

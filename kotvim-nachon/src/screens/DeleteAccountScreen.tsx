import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { useStore } from '../store';
import { useNav } from '../nav';
import { TopBar } from '../ui/kit';
import { ConfirmModal } from '../ui/ConfirmModal';
import { firebaseEnabled } from '../services/firebase';
import { authErrorText, signInWithEmail, signInWithGoogle, watchUser } from '../services/auth';
import { deleteAccountAndData, reauthenticate, signInMethod } from '../services/account';
import { stopSync } from '../services/sync';

/**
 * Account deletion, reachable from Settings and from the web at  <site>/#delete-account
 * (Google Play requires both an in-app and a web way to delete an account).
 */
export function DeleteAccountScreen() {
  const resetAll = useStore((s) => s.resetAll);
  const reset = useNav((s) => s.reset);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => watchUser(setUser), []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseEnabled)
    return (
      <div className="screen" style={{ background: '#fff' }}>
        <TopBar title="מחיקת חשבון" right={<span style={{ width: 52 }} />} />
        <p>בגרסה הזו אין חשבון בענן. כל הנתונים נשמרים רק במכשיר, ואפשר למחוק ילד בהגדרות או למחוק את האפליקציה.</p>
      </div>
    );

  return (
    <div className="screen" style={{ background: '#fff' }}>
      <TopBar title="מחיקת חשבון" right={<span style={{ width: 52 }} />} />
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {done ? (
          <>
            <b>החשבון נמחק ✔</b>
            <p style={{ margin: 0 }}>החשבון, כל הילדים וכל ההתקדמות נמחקו לצמיתות.</p>
            <button className="btn white" onClick={() => reset({ name: 'login' })}>
              למסך הפתיחה
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              מחיקת החשבון מוחקת לצמיתות את חשבון ההורה, את כל הילדים, ההתקדמות, הטעויות, הסיפורים והחדרים. אי אפשר לשחזר אותם.
            </p>
            {!user ? (
              <>
                <b>התחברו לחשבון שרוצים למחוק:</b>
                <input id="del-email" className="field" type="email" dir="ltr" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input id="del-pass" className="field" type="password" dir="ltr" placeholder="סיסמה" value={pass} onChange={(e) => setPass(e.target.value)} />
                <button className="btn blue" disabled={busy} onClick={() => run(() => signInWithEmail(email.trim(), pass, false))}>
                  כניסה
                </button>
                <button className="btn white" disabled={busy} onClick={() => run(signInWithGoogle)}>
                  כניסה עם Google
                </button>
              </>
            ) : (
              <>
                <div>
                  מחוברים כ-<b dir="ltr">{user.email}</b>
                </div>
                {signInMethod() === 'password' && (
                  <input id="del-reauth" className="field" type="password" dir="ltr" placeholder="הקלידו שוב את הסיסמה" value={pass} onChange={(e) => setPass(e.target.value)} />
                )}
                <button className="btn pink" disabled={busy || (signInMethod() === 'password' && pass.length < 6)} onClick={() => setAsk(true)}>
                  מחיקת החשבון וכל הנתונים
                </button>
              </>
            )}
          </>
        )}
        {err && <div style={{ color: 'var(--red)' }}>{err}</div>}
      </div>
      {ask && (
        <ConfirmModal
          title="למחוק את החשבון?"
          confirmLabel="מחיקה לצמיתות"
          danger
          typeToConfirm="מחיקה"
          busy={busy}
          onCancel={() => setAsk(false)}
          onConfirm={() =>
            run(async () => {
              await reauthenticate(pass);
              stopSync();
              await deleteAccountAndData();
              resetAll();
              setAsk(false);
              setDone(true);
            })
          }
        >
          <p>כל הנתונים של כל הילדים יימחקו.</p>
        </ConfirmModal>
      )}
    </div>
  );
}

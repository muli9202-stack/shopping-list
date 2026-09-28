import { useState } from 'react';
import { useApp } from '../store';
import type { SyncSettings } from '../types';
import { confirmDialog, promptDialog } from './dialog';
import { useSyncStatus } from '../syncStatus';

export const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{code}/{col}/{docId} {
      allow read, write: if code.size() >= 20;
    }
  }
}`;

const STATUS_TEXT = { off: 'לא מחובר', connecting: 'מתחבר…', online: '✓ מחובר ומסונכרן', error: '⚠ שגיאה בחיבור' } as const;

/** Link that sets up sync on another phone in one tap. */
export function inviteLink(sync: SyncSettings) {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ c: sync.firebaseConfig, k: sync.familyCode }))));
  return `${location.href.split('#')[0]}#/join/${encodeURIComponent(payload)}`;
}

export function decodeInvite(payload: string): { config: string; code: string } | null {
  try {
    const { c, k } = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(payload)))));
    return typeof c === 'string' && typeof k === 'string' ? { config: c, code: k } : null;
  } catch {
    return null;
  }
}

export default function SyncCard() {
  const sync = useApp((s) => s.settings.sync);
  const { status, error } = useSyncStatus();
  const [config, setConfig] = useState(sync?.firebaseConfig ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showGuide, setShowGuide] = useState(!sync?.firebaseConfig);

  const save = (patch: Partial<SyncSettings>) =>
    useApp.getState().updateSettings({ sync: { firebaseConfig: config, familyCode: '', enabled: false, ...sync, ...patch } });

  const connect = async (mode: 'create' | 'join', code: string) => {
    setBusy(true);
    setMsg('');
    try {
      const { startSync, parseFirebaseConfig } = await import('../sync');
      parseFirebaseConfig(config);
      await startSync(config, code, mode);
      save({ firebaseConfig: config, familyCode: code, enabled: true });
      setMsg(mode === 'create' ? 'הקבוצה נוצרה. שלח הזמנה לבן/בת הזוג.' : 'הצטרפת לרשימה המשותפת.');
    } catch (e) {
      setMsg(`לא הצלחתי להתחבר: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const { newFamilyCode } = await import('../sync');
    await connect('create', newFamilyCode());
  };
  const join = async () => {
    const code = await promptDialog({ title: 'הצטרפות לקבוצה', message: 'הדבק את הקוד המשפחתי שקיבלת.', placeholder: 'קוד משפחתי' });
    if (!code) return;
    if (!(await confirmDialog({ title: 'הצטרפות', message: 'הרשימות והמוצרים במכשיר הזה יוחלפו ברשימה המשותפת. ההיסטוריה של שני המכשירים תישמר.', confirmText: 'הצטרפות' })))
      return;
    await connect('join', code.replace(/\s/g, ''));
  };
  const disconnect = async () => {
    if (!(await confirmDialog({ title: 'ניתוק מהרשימה המשותפת', message: 'הנתונים יישארו במכשיר, אבל לא יסונכרנו יותר.', confirmText: 'ניתוק', danger: true }))) return;
    const { stopSync } = await import('../sync');
    await stopSync();
    save({ enabled: false });
  };
  const share = async () => {
    const link = inviteLink({ ...sync!, firebaseConfig: config });
    const text = `הצטרפות לרשימת הקניות המשותפת שלנו:\n${link}`;
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const connected = sync?.enabled;
  return (
    <section className="card">
      <h2>👨‍👩‍👧 רשימה משותפת</h2>
      <p className="muted small">שני טלפונים (או יותר) רואים ומעדכנים את אותן רשימות בזמן אמת, גם בזמן הקנייה.</p>

      {connected ? (
        <>
          <p className={`sync-status s-${status}`}>{STATUS_TEXT[status]}</p>
          {status === 'error' && <p className="error-msg small">{error}</p>}
          <label className="form">
            קוד משפחתי
            <input className="input ltr" readOnly value={sync!.familyCode} onFocus={(e) => e.target.select()} />
          </label>
          <div className="stack">
            <button className="btn primary" onClick={share}>
              📤 שליחת הזמנה (וואטסאפ)
            </button>
            <button className="btn ghost danger-text" onClick={disconnect}>
              ניתוק
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="link-btn" onClick={() => setShowGuide(!showGuide)}>
            {showGuide ? 'הסתרת ההוראות' : 'איך מגדירים? (פעם אחת, כ-10 דקות)'}
          </button>
          {showGuide && (
            <ol className="guide">
              <li>
                נכנסים ל-
                <a className="link" href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">
                  console.firebase.google.com
                </a>{' '}
                עם חשבון Google, ולוחצים <b>Create a project</b>. נותנים שם (למשל shopping), ואפשר לכבות את Google Analytics.
              </li>
              <li>
                בתפריט: <b>Build → Firestore Database → Create database</b>. בוחרים מיקום (למשל eur3) ו-<b>production mode</b>.
              </li>
              <li>
                בלשונית <b>Rules</b> מוחקים הכול, מדביקים את הכללים האלה ולוחצים <b>Publish</b>:
                <pre className="rules">{FIRESTORE_RULES}</pre>
                <button className="btn small" onClick={() => navigator.clipboard?.writeText(FIRESTORE_RULES).then(() => setMsg('הכללים הועתקו'))}>
                  העתקת הכללים
                </button>
              </li>
              <li>
                לוחצים על ⚙️ <b>Project settings</b>, ובתחתית, תחת <b>Your apps</b>, על הסמל <b>&lt;/&gt;</b>. נותנים שם ולוחצים <b>Register app</b>.
              </li>
              <li>
                מעתיקים את הקטע <b>const firebaseConfig = {'{…}'}</b> ומדביקים כאן למטה.
              </li>
            </ol>
          )}
          <label className="form">
            הגדרות Firebase
            <textarea
              className="input ltr"
              rows={4}
              placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  projectId: "...",\n  ...\n};'}
              value={config}
              onChange={(e) => setConfig(e.target.value)}
            />
          </label>
          <div className="stack">
            <button className="btn primary" disabled={!config.trim() || busy} onClick={create}>
              {busy ? 'מתחבר…' : 'יצירת רשימה משותפת חדשה'}
            </button>
            <button className="btn" disabled={!config.trim() || busy} onClick={join}>
              הצטרפות עם קוד משפחתי
            </button>
          </div>
          <p className="muted small">בטלפון השני אין צורך בכל זה: פשוט פותחים את קישור ההזמנה.</p>
        </>
      )}
      {msg && <p className="ok-msg">{msg}</p>}
    </section>
  );
}

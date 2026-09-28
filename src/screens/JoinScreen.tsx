import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { Empty, Header } from '../ui/components';
import { decodeInvite } from '../ui/SyncCard';

/** Opened from an invite link: connects this phone to the family's shared lists. */
export default function JoinScreen() {
  const { payload = '' } = useParams();
  const navigate = useNavigate();
  const invite = decodeInvite(payload);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    if (!invite) return;
    setBusy(true);
    setError('');
    try {
      const { startSync } = await import('../sync');
      await startSync(invite.config, invite.code, 'join');
      useApp.getState().updateSettings({ sync: { firebaseConfig: invite.config, familyCode: invite.code, enabled: true } });
      navigate('/', { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Header title="הצטרפות לרשימה משותפת" back="/" />
      {!invite ? (
        <Empty icon="⚠️" title="הקישור לא תקין">
          <p className="muted">בקש מבן/בת הזוג לשלוח את ההזמנה שוב.</p>
        </Empty>
      ) : (
        <Empty icon="👨‍👩‍👧" title="הוזמנת לרשימת קניות משותפת">
          <p className="muted">אחרי ההצטרפות שניכם תראו ותעדכנו את אותן רשימות בזמן אמת. הרשימות במכשיר הזה יוחלפו ברשימה המשותפת, וההיסטוריה של שניכם תישמר.</p>
          <div className="stack">
            <button className="btn primary big" disabled={busy} onClick={join}>
              {busy ? 'מצטרף…' : 'הצטרפות'}
            </button>
          </div>
          {error && <p className="error-msg">לא הצלחתי להצטרף: {error}</p>}
        </Empty>
      )}
    </div>
  );
}

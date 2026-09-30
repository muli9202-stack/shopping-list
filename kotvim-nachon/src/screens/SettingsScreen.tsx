import { useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../nav';
import { TopBar } from '../ui/kit';
import { ChildForm, GRADES } from './FamilyScreen';
import { setVoiceEnabled, speak } from '../services/tts';
import { signOut } from '../services/auth';
import { deleteChildRemote, stopSync } from '../services/sync';
import { ConfirmModal } from '../ui/ConfirmModal';

export function SettingsScreen() {
  const { settings, setSettings, children, removeChild, mode, uid, email, resetAll, setMode } = useStore();
  const reset = useNav((s) => s.reset);
  const go = useNav((s) => s.go);
  const [editing, setEditing] = useState<string | null>(null);
  const [pinEdit, setPinEdit] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);

  return (
    <div className="screen" style={{ background: '#f8f9fa' }}>
      <TopBar title="⚙️ הגדרות" right={<span style={{ width: 52 }} />} />

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <span style={{ fontSize: 30 }}>🔊</span>
          <div className="grow">
            <b>הנחיה קולית</b>
            <div className="small muted">האפליקציה מקריאה בקול כל מסך, שלב ומשחק</div>
          </div>
          <button
            className={`btn ${settings.voiceOn ? 'green' : 'white'}`}
            onClick={() => {
              const on = !settings.voiceOn;
              setSettings({ voiceOn: on });
              setVoiceEnabled(on);
              if (on) speak('ההנחיה הקולית פועלת');
            }}
          >
            {settings.voiceOn ? 'פועלת' : 'כבויה'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <span style={{ fontSize: 30 }}>🔒</span>
          <div className="grow">
            <b>קוד כניסה לאזור ההורים</b>
            <div className="small muted">{settings.parentPin ? 'מוגדר קוד בן 4 ספרות' : 'עוד לא הוגדר'}</div>
          </div>
          <button className="btn white" onClick={() => setPinEdit(!pinEdit)}>
            שינוי
          </button>
        </div>
        {pinEdit && (
          <div className="row" style={{ marginTop: 10 }}>
            <input className="field grow" inputMode="numeric" dir="ltr" maxLength={4} placeholder="4 ספרות" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} />
            <button
              className="btn purple"
              disabled={newPin.length !== 4}
              onClick={() => {
                setSettings({ parentPin: newPin });
                setPinEdit(false);
                setNewPin('');
                setMsg('הקוד עודכן ✔');
              }}
            >
              שמירה
            </button>
          </div>
        )}
        {msg && <div className="small" style={{ color: 'var(--green)', marginTop: 6 }}>{msg}</div>}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <b>👧 הילדים</b>
        {children.map((c) => (
          <div key={c.id} className="stat-row">
            <span style={{ fontSize: 30 }}>{c.avatar}</span>
            <span className="grow">
              {c.name} · כיתה {GRADES[c.grade - 1]}
            </span>
            <button className="btn white" style={{ padding: '8px 14px', fontSize: 16 }} onClick={() => setEditing(c.id)}>
              עריכה
            </button>
            <button
              className="btn ghost"
              style={{ padding: 8 }}
              aria-label={`מחיקת ${c.name}`}
              onClick={() => setToDelete(c.id)}
            >
              🗑️
            </button>
          </div>
        ))}
        <p className="small muted">שינוי כיתה מעדכן מיד את רמת המילים, הסיפורים, המשחקים וההכתבות.</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <b>👤 חשבון</b>
        <p className="small muted">
          {mode === 'cloud' ? `מחובר כ-${email ?? ''}. הנתונים נשמרים בענן ומסונכרנים.` : 'הנתונים נשמרים במכשיר הזה בלבד.'}
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn white"
            onClick={async () => {
              stopSync();
              await signOut();
              resetAll();
              reset({ name: 'login' });
              setMode('none');
            }}
          >
            {mode === 'cloud' ? 'התנתקות' : 'יציאה'}
          </button>
          <button className="btn ghost" onClick={() => go({ name: 'privacy' })}>
            מדיניות פרטיות
          </button>
          {mode === 'cloud' && (
            <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={() => go({ name: 'deleteAccount' })}>
              מחיקת החשבון
            </button>
          )}
        </div>
      </div>

      <p className="small muted center">
        כותבים נכון · גרסה 1.0
        <br />
        גופן כתב יד: Ktav Yad CLM מפרויקט Culmus (רישיון GPL)
      </p>

      {editing && <ChildForm childId={editing} onClose={() => setEditing(null)} />}
      {toDelete && (
        <ConfirmModal
          title={`למחוק את ${children.find((c) => c.id === toDelete)?.name ?? ''}?`}
          confirmLabel="מחיקה"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            removeChild(toDelete);
            if (mode === 'cloud' && uid) deleteChildRemote(uid, toDelete);
            setToDelete(null);
          }}
        >
          <p>כל ההתקדמות, הנקודות והחדר של הילד יימחקו.</p>
        </ConfirmModal>
      )}
    </div>
  );
}

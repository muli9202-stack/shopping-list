import { useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../nav';
import { Mascot } from '../ui/Mascot';
import { useSpeakOnMount } from '../ui/kit';
import { speak } from '../services/tts';
import { SKILL_BY_ID } from '../data/skills';
import { isWeak, weakestSkills } from '../engine/progress';

export const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐵', '🦄', '🐯', '🐨', '🐙', '🦖', '🐧', '🐰'];
export const GRADES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳'];

export function FamilyScreen() {
  const children = useStore((s) => s.children);
  const setActive = useStore((s) => s.setActive);
  const email = useStore((s) => s.email);
  const go = useNav((s) => s.go);
  const [adding, setAdding] = useState(false);
  useSpeakOnMount(children.length ? 'מי לומד עכשיו? לחצו על השם שלכם.' : 'בואו נוסיף ילד. לחצו על הכפתור הגדול.');

  return (
    <div className="screen sky-bg">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="icon-btn" aria-label="הגדרות" onClick={() => go({ name: 'parentGate', next: { name: 'settings' } })}>
          ⚙️
        </button>
        <h2 style={{ margin: 0 }}>המשפחה שלנו</h2>
        <Mascot size={56} />
      </div>
      {email && <p className="small muted center">מחובר כ-{email}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        {children.map((c) => (
          <button
            key={c.id}
            className="card row"
            style={{ border: 'none', cursor: 'pointer', textAlign: 'right' }}
            onClick={() => {
              setActive(c.id);
              speak(`שלום ${c.name}!`);
              go({ name: 'child' });
            }}
          >
            <span style={{ fontSize: 56 }}>{c.avatar}</span>
            <span className="grow">
              <b style={{ fontSize: 26 }}>{c.name}</b>
              <br />
              <span className="muted small">
                כיתה {GRADES[c.grade - 1]} · ⭐ {c.points} · 🔥 {c.streak}
              </span>
            </span>
            <span style={{ fontSize: 30 }}>⬅️</span>
          </button>
        ))}

        <button className="btn big green block" style={{ minHeight: 90, fontSize: 28 }} onClick={() => setAdding(true)}>
          ➕ הוספת ילד
        </button>
      </div>

      {children.length > 0 && (
        <div className="card" style={{ marginTop: 22, background: '#f3f0ff' }}>
          <div className="row">
            <b className="grow">👨‍👩‍👧 אזור ההורים</b>
            <button className="btn purple" onClick={() => go({ name: 'parentGate', next: { name: 'parents' } })}>
              כניסה 🔒
            </button>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>
            {children.map((c) => {
              const weak = weakestSkills(c).filter((s) => isWeak(c, s)).slice(0, 2);
              return (
                <div key={c.id}>
                  {c.avatar} {c.name}: {weak.length ? `מתאמן/ת על ${weak.map((s) => SKILL_BY_ID[s].parentTitle).join(', ')}` : 'עוד אין מספיק נתונים'}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {adding && <ChildForm onClose={() => setAdding(false)} />}
    </div>
  );
}

export function ChildForm({ onClose, childId }: { onClose: () => void; childId?: string }) {
  const existing = useStore((s) => s.children.find((c) => c.id === childId));
  const addChild = useStore((s) => s.addChild);
  const updateChild = useStore((s) => s.updateChild);
  const [name, setName] = useState(existing?.name ?? '');
  const [grade, setGrade] = useState(existing?.grade ?? 1);
  const [avatar, setAvatar] = useState(existing?.avatar ?? AVATARS[0]);

  const save = () => {
    if (!name.trim()) return;
    if (existing) updateChild(existing.id, (c) => ({ ...c, name: name.trim(), grade, avatar, updatedAt: Date.now() }));
    else addChild(name.trim(), grade, avatar);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{existing ? 'עריכת פרטים' : 'ילד חדש 🎉'}</h2>
        <label className="small muted">שם</label>
        <input className="field" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="למשל: נועה" autoFocus />
        <label className="small muted" style={{ display: 'block', marginTop: 14 }}>
          באיזו כיתה?
        </label>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {GRADES.map((g, i) => (
            <button key={g} className={`chip ${grade === i + 1 ? 'on' : ''}`} onClick={() => setGrade(i + 1)}>
              {g}
            </button>
          ))}
        </div>
        <p className="small muted">
          {grade <= 2 ? 'מילים פשוטות, עם ניקוד לעזרה בקריאה.' : grade <= 4 ? 'מילים ומשפטים ברמה בינונית, ניקוד רק כשצריך.' : 'מילים ומשפטים מתקדמים, בלי ניקוד.'}
        </p>
        <label className="small muted">דמות</label>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {AVATARS.map((a) => (
            <button key={a} className={`chip ${avatar === a ? 'on' : ''}`} style={{ fontSize: 28, padding: '4px 8px' }} onClick={() => setAvatar(a)}>
              {a}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn green grow" onClick={save} disabled={!name.trim()}>
            שמירה
          </button>
          <button className="btn white" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { HelpBtn, PointsPill, SpeakBtn } from '../ui/kit';
import { useGuide } from '../ui/guide';
import { Mascot } from '../ui/Mascot';
import { DAILY_GOAL_SECONDS, dayKey, touchDay } from '../engine/progress';
import { confetti, sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { coinsOf } from '../engine/merge';
import { PinPad } from '../ui/PinPad';

const SQUARES = [
  { id: 'teacher', emoji: '👩‍🏫', title: 'לומדים עם המורה', sub: 'המורה מסביר, מתרגלים, וממשיכים לבד', say: 'לומדים עם המורה. המורה מסביר לך, מתרגלים במשחק, והוא בוחר מה לומדים הלאה.', bg: 'linear-gradient(135deg,#3a86ff,#8338ec)' },
  { id: 'write', emoji: '✏️', title: 'כתיבה ומבחן', sub: 'סיפורים והכתבות', say: 'כתיבה ומבחן. כאן כותבים סיפור או הכתבה, ורואים כמה השתפרתם.', bg: 'linear-gradient(135deg,#fb8500,#ff5d8f)' },
  { id: 'room', emoji: '🏠', title: 'החדר שלי', sub: 'קונים ומעצבים בנקודות', say: 'החדר שלי. כאן קונים רהיטים וחיות עם הנקודות שצברתם.', bg: 'linear-gradient(135deg,#2ec27e,#20c997)' },
  { id: 'arcade', emoji: '🎢', title: 'עולם העסקים', sub: '30 עסקים לנהל עם מטבעות זהב', say: 'עולם העסקים. כאן מנהלים מסעדה, בית חולים ותחנת דלק, עם מטבעות הזהב שמרוויחים בלמידה.', bg: 'linear-gradient(135deg,#f08c00,#fab005)' },
] as const;

export function ChildHomeScreen() {
  const child = useActiveChild();
  const go = useNav((s) => s.go);
  const back = useNav((s) => s.back);
  const [bonus, setBonus] = useState(0);
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    if (!child) return;
    const r = touchDay(child);
    if (r.bonus) {
      updateActive(() => r.child);
      setBonus(r.bonus);
      setTimeout(() => {
        confetti(140);
        sfx('win');
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGuide(child ? 'child' : null);

  if (!child) return null;
  return (
    <div className="screen sky-bg">
      <div className="topbar">
        <button className="icon-btn" aria-label="חזרה למשפחה" onClick={back}>
          👪
        </button>
        <div className="title">
          {child.avatar} {child.name}
        </div>
        <HelpBtn guide="child" />
        <span className="points-pill" style={{ background: '#fff3bf' }}>🪙 {coinsOf(child)}</span>
        <PointsPill points={child.points} />
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 6 }}>
        <Mascot size={80} />
        <div className="bubble">
          {child.streak > 1 ? `🔥 ${child.streak} ימים ברצף! ממשיכים?` : 'בוא נכתוב נכון היום!'}
        </div>
      </div>

      <DailyGoal seconds={child.daily?.[dayKey()] ?? 0} />
      {!!child.weekWords?.words.length && (
        <button className="btn white block" style={{ marginBottom: 6 }} onClick={() => go({ name: 'weekwords' })}>
          📚 מילות השבוע מבית הספר ({child.weekWords.words.length}){child.weekDone === dayKey() ? ' ✅' : ''}
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 10 }}>
        {SQUARES.map((s) => (
          <button
            key={s.id}
            className="big-square"
            style={{ background: s.bg }}
            onClick={() => {
              sfx('pop');
              speak(s.title);
              go({ name: s.id });
            }}
          >
            <span className="emoji">{s.emoji}</span>
            <span className="grow">
              {s.title}
              <span className="sub">{s.sub}</span>
            </span>
            <SpeakBtn text={s.say} small />
          </button>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
        <button className="btn white" onClick={() => go({ name: 'learn' })}>
          🗺️ מפה ומשחקים
        </button>
        <button className="btn white" onClick={() => go({ name: 'tricks' })}>
          💡 ספריית הטריקים
        </button>
        <button className="btn white" onClick={() => setPinOpen(true)}>
          {child.pin ? '🔒 הקוד שלי' : '🔓 קוד לפרופיל'}
        </button>
      </div>

      {pinOpen && <ChildPinModal hasPin={!!child.pin} onClose={() => setPinOpen(false)} />}
      {bonus > 0 && (
        <div className="overlay" onClick={() => setBonus(0)}>
          <div className="modal center">
            <div style={{ fontSize: 80, animation: 'pop 0.8s infinite' }}>🎁</div>
            <h2>הפתעה יומית!</h2>
            <p>
              קיבלת <b>{bonus}</b> נקודות כי באת היום{child.streak > 1 ? ` – ${child.streak} ימים ברצף! 🔥` : '!'}
            </p>
            <button className="btn green big" onClick={() => setBonus(0)}>
              יש! 🎉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The child chooses a code for their own profile (the parents' code always opens it too). */
function ChildPinModal({ hasPin, onClose }: { hasPin: boolean; onClose: () => void }) {
  const [stage, setStage] = useState<'menu' | 'new' | 'confirm'>(hasPin ? 'menu' : 'new');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal center" style={{ gap: 10 }} onClick={(e) => e.stopPropagation()}>
        {stage === 'menu' ? (
          <>
            <b>לפרופיל שלך יש קוד 🔒</b>
            <button className="btn purple" onClick={() => setStage('new')}>
              החלפת קוד
            </button>
            <button
              className="btn white"
              onClick={() => {
                updateActive((c) => ({ ...c, pin: undefined, updatedAt: Date.now() }));
                onClose();
              }}
            >
              בלי קוד
            </button>
          </>
        ) : (
          <PinPad
            key={stage}
            title={stage === 'new' ? 'בחרו קוד בן 4 ספרות לפרופיל שלכם' : 'הקלידו את הקוד שוב'}
            error={err}
            onDone={(code) => {
              setErr('');
              if (stage === 'new') {
                setFirst(code);
                setStage('confirm');
              } else if (code === first) {
                updateActive((c) => ({ ...c, pin: code, updatedAt: Date.now() }));
                sfx('win');
                onClose();
              } else {
                setErr('הקודים לא תואמים, נסו שוב');
                setStage('new');
              }
            }}
          />
        )}
        <p className="small muted" style={{ margin: 0 }}>גם הקוד של ההורים פותח את הפרופיל.</p>
        <button className="btn ghost" onClick={onClose}>
          סגירה
        </button>
      </div>
    </div>
  );
}

/** Today's practice towards the daily goal of 10 minutes. */
function DailyGoal({ seconds }: { seconds: number }) {
  const min = Math.min(10, Math.floor(seconds / 60));
  const pct = Math.min(100, (seconds / DAILY_GOAL_SECONDS) * 100);
  return (
    <div className="card" style={{ padding: '8px 12px', marginBottom: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <span>{pct >= 100 ? '🏆' : '⏱️'}</span>
        <span className="grow small" style={{ fontWeight: 700 }}>{pct >= 100 ? 'השלמת את 10 הדקות של היום!' : `היום: ${min} מתוך 10 דקות למידה`}</span>
      </div>
      <div style={{ height: 10, background: '#e9ecef', borderRadius: 10, overflow: 'hidden', marginTop: 6 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--green)' : 'var(--orange)', transition: 'width .5s' }} />
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { PointsPill, SpeakBtn, useSpeakOnMount } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { touchDay } from '../engine/progress';
import { confetti, sfx } from '../ui/effects';
import { speak } from '../services/tts';

const SQUARES = [
  { id: 'learn', emoji: '🎮', title: 'למידה', sub: 'משחקים, טריקים ושלבים', say: 'למידה. כאן משחקים ולומדים טריקים לכתיבה נכונה.', bg: 'linear-gradient(135deg,#3a86ff,#8338ec)' },
  { id: 'write', emoji: '✏️', title: 'כתיבה ומבחן', sub: 'סיפורים והכתבות', say: 'כתיבה ומבחן. כאן כותבים סיפור או הכתבה, ורואים כמה השתפרתם.', bg: 'linear-gradient(135deg,#fb8500,#ff5d8f)' },
  { id: 'room', emoji: '🏠', title: 'החדר שלי', sub: 'קונים ומעצבים בנקודות', say: 'החדר שלי. כאן קונים רהיטים וחיות עם הנקודות שצברתם.', bg: 'linear-gradient(135deg,#2ec27e,#20c997)' },
] as const;

export function ChildHomeScreen() {
  const child = useActiveChild();
  const go = useNav((s) => s.go);
  const back = useNav((s) => s.back);
  const [bonus, setBonus] = useState(0);

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

  useSpeakOnMount(child ? `היי ${child.name}! מה בא לך לעשות? למידה, כתיבה, או החדר שלך?` : null);

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
        <PointsPill points={child.points} />
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 6 }}>
        <Mascot size={80} />
        <div className="bubble">
          {child.streak > 1 ? `🔥 ${child.streak} ימים ברצף! ממשיכים?` : 'בוא נכתוב נכון היום!'}
        </div>
      </div>

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
        <button className="btn white" onClick={() => go({ name: 'tricks' })}>
          💡 ספריית הטריקים
        </button>
      </div>

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

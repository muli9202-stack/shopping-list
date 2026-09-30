import { useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { TopBar, Stars, PRAISE, pick } from '../ui/kit';
import { GameHost } from '../games/GameHost';
import { dueWords } from '../engine/review';
import { addPoints } from '../engine/progress';
import { Mascot, MascotSays } from '../ui/Mascot';
import { confetti, sfx } from '../ui/effects';
import { speak } from '../services/tts';
import type { GameId, SkillId } from '../types';

const REVIEW_GAMES: GameId[] = ['cards', 'listen', 'train', 'rocket'];

/** Daily "smart review": the child's own mistake words that are due today (spaced repetition). */
export function ReviewScreen() {
  const child = useActiveChild();
  const back = useNav((s) => s.back);
  const [plan] = useState(() => {
    const due = child ? dueWords(child) : [];
    const skills = [...new Set(due.map((d) => d.skill))] as SkillId[];
    return { count: due.length, skills, game: REVIEW_GAMES[new Date().getDate() % REVIEW_GAMES.length] };
  });
  const [done, setDone] = useState<null | number>(null);
  if (!child) return null;

  if (!plan.count)
    return (
      <div className="screen sky-bg">
        <TopBar title="🔁 חזרה חכמה" />
        <div className="center" style={{ marginTop: 30 }}>
          <MascotSays text="אין היום מילים לחזרה – כל הכבוד! 🎉" size={110} />
        </div>
      </div>
    );

  return (
    <div className="screen" style={{ background: 'linear-gradient(#e6fcf5, #fff7e6)' }}>
      <TopBar title={`🔁 חזרה חכמה · ${plan.count} מילים`} />
      {done === null ? (
        <GameHost
          game={plan.game}
          skills={plan.skills}
          rounds={Math.min(10, Math.max(4, plan.count))}
          onFinish={(c, t) => {
            const stars = c / t >= 0.9 ? 3 : c / t >= 0.65 ? 2 : 1;
            updateActive((ch) => addPoints(ch, 20 + stars * 10));
            setDone(stars);
            sfx('win');
            confetti(120);
            speak(pick(PRAISE));
          }}
        />
      ) : (
        <div className="overlay">
          <div className="modal center" style={{ gap: 10 }}>
            <Mascot size={110} cheer />
            <div style={{ fontSize: 44 }}>
              <Stars n={done} />
            </div>
            <p style={{ margin: 0 }}>מילים שעניתם נכון יחזרו בעוד כמה ימים, עד שיישארו בזיכרון לתמיד.</p>
            <button className="btn green big" onClick={back}>
              סיימתי
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

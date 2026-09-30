import { useState } from 'react';
import { updateActive, useActiveChild, useStore } from '../store';
import { useNav } from '../nav';
import { TopBar } from '../ui/kit';
import { GameHost } from '../games/GameHost';
import { eligibleSkills, ensureWorld, addPoints, weakestSkills } from '../engine/progress';
import { MascotSays } from '../ui/Mascot';
import { SKILL_BY_ID } from '../data/skills';
import { confetti, sfx } from '../ui/effects';
import { speak } from '../services/tts';
import type { SkillId } from '../types';

/**
 * Placement check in two rounds: two questions on every topic, then two more on each topic
 * where the child made a mistake – so the learning path starts from the real weak spots.
 */
export function DiagnosticScreen() {
  const child = useActiveChild();
  // the screen that sent the child here (teacher or map) is underneath – go back to it
  const back = useNav((s) => s.back);
  const [round, setRound] = useState<{ n: 1 | 2; skills: SkillId[] }>(() => ({ n: 1, skills: child ? eligibleSkills(child.grade) : [] }));
  const [done, setDone] = useState(false);
  if (!child) return null;

  const finishAll = () => {
    updateActive((c) => addPoints(ensureWorld({ ...c, diagnosed: true, updatedAt: Date.now() }), 50));
    sfx('win');
    confetti(150);
    speak('כל הכבוד! סיימנו את הבדיקה וקיבלת חמישים נקודות.');
    setDone(true);
  };

  if (done) {
    const weak = weakestSkills(child).slice(0, 3);
    return (
      <div className="screen sky-bg center" style={{ gap: 16 }}>
        <MascotSays text="סיימנו! עכשיו אני יודע בדיוק איך לעזור לך." cheer size={110} />
        <div className="card" style={{ width: '100%' }}>
          <b>נתחיל להתאמן על:</b>
          {weak.map((s) => (
            <div key={s} className="row" style={{ fontSize: 22, marginTop: 8 }}>
              <span style={{ fontSize: 32 }}>{SKILL_BY_ID[s].icon}</span> {SKILL_BY_ID[s].title}
            </div>
          ))}
        </div>
        <button className="btn big green" onClick={back}>
          למפה! 🗺️
        </button>
      </div>
    );
  }

  return (
    <div className="screen sky-bg">
      <TopBar title={round.n === 1 ? '🔍 בודקים מה כבר יודעים' : '🔍 עוד כמה שאלות'} guide="diagnostic" />
      <GameHost
        key={round.n}
        game="cards"
        skills={round.skills}
        rounds={round.skills.length * 2}
        source="diagnostic"
        onFinish={() => {
          if (round.n === 1) {
            // a topic with a mistake in round 1 has mastery below the 0.5 starting point
            const c = useStore.getState().children.find((x) => x.id === child.id)!;
            const unsure = round.skills.filter((s) => (c.skills[s]?.mastery ?? 0.5) < 0.5);
            if (unsure.length) {
              speak('יופי! עוד כמה שאלות קטנות ומסיימים.');
              setRound({ n: 2, skills: unsure });
              return;
            }
          }
          finishAll();
        }}
      />
    </div>
  );
}

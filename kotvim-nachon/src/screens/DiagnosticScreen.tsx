import { useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { TopBar } from '../ui/kit';
import { GameHost } from '../games/GameHost';
import { eligibleSkills, ensureWorld, addPoints, weakestSkills } from '../engine/progress';
import { MascotSays } from '../ui/Mascot';
import { SKILL_BY_ID } from '../data/skills';
import { confetti, sfx } from '../ui/effects';
import { speak } from '../services/tts';

/** Placement check: two quick questions per topic, then the learning path is planned around the weak spots. */
export function DiagnosticScreen() {
  const child = useActiveChild();
  const replace = useNav((s) => s.replace);
  const [skills] = useState(() => (child ? eligibleSkills(child.grade) : []));
  const [done, setDone] = useState(false);
  if (!child) return null;

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
        <button className="btn big green" onClick={() => replace({ name: 'learn' })}>
          למפה! 🗺️
        </button>
      </div>
    );
  }

  return (
    <div className="screen sky-bg">
      <TopBar title="🔍 בודקים מה כבר יודעים" />
      <GameHost
        game="cards"
        skills={skills}
        rounds={skills.length * 2}
        source="diagnostic"
        onFinish={() => {
          updateActive((c) => addPoints(ensureWorld({ ...c, diagnosed: true, updatedAt: Date.now() }), 50));
          sfx('win');
          confetti(150);
          speak('כל הכבוד! קיבלת חמישים נקודות על הבדיקה.');
          setDone(true);
        }}
      />
    </div>
  );
}

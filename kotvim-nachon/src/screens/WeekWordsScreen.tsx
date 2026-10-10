import { useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { TopBar, Stars } from '../ui/kit';
import { GameHost } from '../games/GameHost';
import { MascotSays, Mascot } from '../ui/Mascot';
import { dayKey } from '../engine/progress';
import { confetti, sfx } from '../ui/effects';

/** The weekly spelling list from school (typed in by the parents), practised by writing from memory. */
export function WeekWordsScreen() {
  const child = useActiveChild();
  const back = useNav((s) => s.back);
  const [done, setDone] = useState<null | number>(null);
  const [round, setRound] = useState(0);
  if (!child) return null;
  const words = child.weekWords?.words ?? [];
  if (!words.length)
    return (
      <div className="screen sky-bg">
        <TopBar title="📚 מילות השבוע" />
        <div className="center" style={{ marginTop: 30 }}>
          <MascotSays text="עוד אין מילות שבוע. אבא או אמא יכולים להוסיף אותן באזור ההורים." size={110} />
        </div>
      </div>
    );
  return (
    <div className="screen" style={{ background: 'linear-gradient(#fff3bf, #fff7e6)' }}>
      <TopBar title={`📚 מילות השבוע · ${words.length} מילים`} />
      {done === null ? (
        <GameHost
          key={round}
          game="memwrite"
          skills={['full_spelling']}
          words={words}
          rounds={words.length}
          onFinish={(c, t) => {
            const stars = c / t >= 0.9 ? 3 : c / t >= 0.65 ? 2 : 1;
            updateActive((ch) => ({ ...ch, weekDone: dayKey(), updatedAt: Date.now() }));
            setDone(stars);
            sfx('win');
            confetti(100);
          }}
        />
      ) : (
        <div className="overlay">
          <div className="modal center" style={{ gap: 10 }}>
            <Mascot size={100} cheer />
            <div style={{ fontSize: 44 }}>
              <Stars n={done} />
            </div>
            <p style={{ margin: 0 }}>מתרגלים כל יום – ובמבחן כבר יודעים!</p>
            <button
              className="btn white"
              onClick={() => {
                setDone(null);
                setRound(round + 1);
              }}
            >
              🔁 עוד פעם
            </button>
            <button className="btn green big" onClick={back}>
              סיימתי
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

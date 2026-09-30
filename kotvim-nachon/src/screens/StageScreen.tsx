import { useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { TopBar, Stars, PRAISE, pick } from '../ui/kit';
import { GAME_INFO, GameHost } from '../games/GameHost';
import { LEVEL_NAMES, gameKey } from './GamesScreen';
import { TrickPlayer } from '../tricks/TrickPlayer';
import { addPoints, completeStage, reviewSkills, stageAt } from '../engine/progress';
import { worldInfo } from './LearnScreen';
import { Mascot } from '../ui/Mascot';
import { confetti, sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { maybeShowBreakAd } from '../services/ads';
import type { GameId, SkillId } from '../types';

function starsFor(correct: number, total: number) {
  const r = total ? correct / total : 1;
  return r >= 0.9 ? 3 : r >= 0.65 ? 2 : 1;
}

/** Runs the current stage of the current world, then shows the reward. */
export function StageScreen() {
  const child = useActiveChild();
  const back = useNav((s) => s.back);
  const [result, setResult] = useState<null | { stars: number; bonus: number }>(null);
  const [snapshot] = useState(() => {
    if (!child) return null;
    const wi = child.worlds.length - 1;
    const w = child.worlds[wi];
    return { w, wi, stage: stageAt(w, wi, w.done), skills: (w.skill === 'review' ? reviewSkills(child) : [w.skill]) as SkillId[] };
  });
  if (!child || !snapshot) return null;
  const info = worldInfo(snapshot.w);

  const complete = (stars: number) => {
    const bonus = 20 + stars * 10;
    updateActive((c) => addPoints(completeStage(c, stars), bonus));
    setResult({ stars, bonus });
    sfx('win');
    confetti(160);
    speak(`${pick(PRAISE)} קיבלת ${stars} כוכבים ו-${bonus} נקודות בונוס!`);
  };

  const onGameDone = (correct: number, total: number) => complete(starsFor(correct, total));

  return (
    <div className="screen" style={{ background: `linear-gradient(${info.color}33, #fff7e6)` }}>
      <TopBar title={`${info.icon} ${info.title}`} />
      {!result &&
        (snapshot.stage.kind === 'trick' ? (
          <TrickPlayer
            skill={snapshot.skills[0]}
            onDone={() => {
              updateActive((c) => (c.seenTricks.includes(snapshot.skills[0]) ? c : { ...c, seenTricks: [...c.seenTricks, snapshot.skills[0]] }));
              complete(3);
            }}
          />
        ) : snapshot.stage.kind === 'game' ? (
          <GameHost game={snapshot.stage.game as GameId} skills={snapshot.skills} rounds={8} source="learn" onFinish={onGameDone} />
        ) : (
          <GameHost game="listen" title="👑 אתגר האלוף" skills={snapshot.skills} rounds={6} source="learn" onFinish={onGameDone} />
        ))}

      {result && (
        <div className="overlay">
          <div className="modal center" style={{ gap: 10 }}>
            <Mascot size={120} cheer mood="wow" />
            <h2 style={{ margin: 0 }}>{snapshot.stage.kind === 'boss' ? 'ניצחת את האתגר! 👑' : 'שלב הושלם!'}</h2>
            <div style={{ fontSize: 48 }}>
              <Stars n={result.stars} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--orange)' }}>+{result.bonus} ⭐ בונוס</div>
            {snapshot.w.done + 1 >= 5 && <p>🏆 סיימת את כל העולם! עולם חדש מחכה לך.</p>}
            <button
              className="btn green big"
              onClick={async () => {
                back();
                await maybeShowBreakAd();
              }}
            >
              ממשיכים ⬅️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Free practice from the game box – points per answer, no stage progress. */
export function PracticeScreen({ skill, game, level }: { skill: SkillId; game: GameId; level: 1 | 2 | 3 }) {
  const back = useNav((s) => s.back);
  const [done, setDone] = useState<null | { stars: number }>(null);
  const [round, setRound] = useState(0);
  return (
    <div className="screen" style={{ background: 'linear-gradient(#f3f0ff, #fff7e6)' }}>
      <TopBar title={`${GAME_INFO[game].emoji} ${GAME_INFO[game].title} · ${LEVEL_NAMES[level]}`} />
      {!done && (
        <GameHost
          key={round}
          game={game}
          skills={[skill]}
          rounds={8}
          level={level}
          onFinish={(c, t) => {
            const stars = starsFor(c, t);
            const key = gameKey(game, skill, level);
            // best result per game; finishing a level with 2+ stars opens the next level
            updateActive((ch) => ({
              ...addPoints(ch, 10 + stars * 10 * level),
              gameStars: { ...(ch.gameStars ?? {}), [key]: Math.max(ch.gameStars?.[key] ?? 0, stars) },
            }));
            if (stars >= 2 && level < 3) speak('יש! נפתח שלב חדש!');
            setDone({ stars });
            sfx('win');
            confetti(100);
            speak(pick(PRAISE));
          }}
        />
      )}
      {done && (
        <div className="overlay">
          <div className="modal center" style={{ gap: 10 }}>
            <Mascot size={110} cheer />
            <div style={{ fontSize: 44 }}>
              <Stars n={done.stars} />
            </div>
            <div className="row">
              <button
                className="btn green"
                onClick={() => {
                  setDone(null);
                  setRound(round + 1);
                }}
              >
                🔁 עוד סיבוב
              </button>
              <button
                className="btn white"
                onClick={async () => {
                  back();
                  await maybeShowBreakAd();
                }}
              >
                סיימתי
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

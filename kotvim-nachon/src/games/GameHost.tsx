import { useCallback, useRef, useState } from 'react';
import type { GameId, SkillId } from '../types';
import type { GameProps } from './common';
import { CardsGame } from './CardsGame';
import { BalloonsGame } from './BalloonsGame';
import { RainGame } from './RainGame';
import { SortGame } from './SortGame';
import { BuilderGame } from './BuilderGame';
import { MemoryGame } from './MemoryGame';
import { TrueFalseGame } from './TrueFalseGame';
import { ListenGame } from './ListenGame';
import { updateActive, useStore } from '../store';
import { addPoints, recordAnswer } from '../engine/progress';
import { classifyWord } from '../engine/analyze';
import { flyPoints } from '../ui/effects';
import { TrickPlayer } from '../tricks/TrickPlayer';
import { TRICKS } from '../tricks/tricks';

export const GAME_INFO: Record<GameId, { title: string; emoji: string; color: string }> = {
  cards: { title: 'קלפי קסם', emoji: '🃏', color: '#8338ec' },
  balloons: { title: 'בלונים', emoji: '🎈', color: '#ff5d8f' },
  rain: { title: 'גשם אותיות', emoji: '🌠', color: '#4c6ef5' },
  sort: { title: 'סלסלות', emoji: '🧺', color: '#fb8500' },
  builder: { title: 'בונים מילה', emoji: '🧱', color: '#f59f00' },
  memory: { title: 'זיכרון', emoji: '🧠', color: '#20c997' },
  truefalse: { title: 'נכון או לא?', emoji: '✅', color: '#2ec27e' },
  listen: { title: 'שומעים וכותבים', emoji: '👂', color: '#3a86ff' },
};

const COMPONENTS: Record<GameId, (p: GameProps) => React.ReactNode> = {
  cards: CardsGame,
  balloons: BalloonsGame,
  rain: RainGame,
  sort: SortGame,
  builder: BuilderGame,
  memory: MemoryGame,
  truefalse: TrueFalseGame,
  listen: ListenGame,
};

export const POINTS_PER_CORRECT = 10;

/**
 * Runs one mini-game: records every answer in the child's mistake map, awards points,
 * and pops up the matching trick right when the child is struggling (2nd mistake in a skill).
 */
export function GameHost({
  game,
  skills,
  rounds = 8,
  source = 'game',
  onFinish,
  title,
}: {
  game: GameId;
  skills: SkillId[];
  rounds?: number;
  source?: 'game' | 'learn' | 'diagnostic';
  onFinish: (correct: number, total: number) => void;
  title?: string;
}) {
  const liveGrade = useStore((s) => s.children.find((c) => c.id === s.activeChildId)?.grade ?? 1);
  // freeze inputs for the whole game so store updates (points) never regenerate the questions
  const [frozen] = useState(() => ({ skills, grade: liveGrade }));
  const wrongs = useRef<Record<string, number>>({});
  const shown = useRef<Set<string>>(new Set());
  const [trick, setTrick] = useState<SkillId | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const report = useCallback(
    (skill: SkillId, correct: boolean, expected: string, typed: string) => {
      const issue = correct ? undefined : classifyWord(expected, typed)[0];
      updateActive((c) => {
        let next = recordAnswer(c, skill, correct, correct ? undefined : { expected, typed, pair: issue?.pair, skill: issue?.skill ?? skill, source });
        if (correct && source !== 'diagnostic') next = addPoints(next, POINTS_PER_CORRECT);
        return next;
      });
      if (correct && source !== 'diagnostic') flyPoints(POINTS_PER_CORRECT);
      if (!correct && source !== 'diagnostic') {
        wrongs.current[skill] = (wrongs.current[skill] ?? 0) + 1;
        if (wrongs.current[skill] === 2 && !shown.current.has(skill) && TRICKS[skill]) {
          shown.current.add(skill);
          setTimeout(() => setTrick(skill), 2500);
        }
      }
    },
    [source],
  );

  const finish = useCallback((c: number, t: number) => finishRef.current(c, t), []);
  const Comp = COMPONENTS[game];
  const props = { skills: frozen.skills, grade: frozen.grade, rounds, report, finish };

  return (
    <>
      {game === 'listen' && title ? <ListenGame {...props} title={title} /> : <Comp {...props} />}
      {trick && (
        <div className="overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <h3 className="center" style={{ margin: '0 0 8px' }}>
              💡 טריק בדיוק בשבילך!
            </h3>
            <TrickPlayer
              skill={trick}
              compact
              onDone={() => {
                updateActive((c) => (c.seenTricks.includes(trick) ? c : { ...c, seenTricks: [...c.seenTricks, trick], updatedAt: Date.now() }));
                setTrick(null);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

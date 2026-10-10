import { useCallback, useEffect, useRef, useState } from 'react';
import { speak } from '../services/tts';
import type { GameId, SkillId, Level } from '../types';
import type { GameProps } from './common';
import { CardsGame } from './CardsGame';
import { BalloonsGame } from './BalloonsGame';
import { RainGame } from './RainGame';
import { SortGame } from './SortGame';
import { BuilderGame } from './BuilderGame';
import { MemoryGame } from './MemoryGame';
import { TrueFalseGame } from './TrueFalseGame';
import { ListenGame } from './ListenGame';
import { RocketGame } from './RocketGame';
import { BubblesGame } from './BubblesGame';
import { PathGame } from './PathGame';
import { FishingGame } from './FishingGame';
import { WhackGame } from './WhackGame';
import { TrainGame } from './TrainGame';
import { DetectiveGame } from './DetectiveGame';
import { RootsGame } from './RootsGame';
import { MemoryWriteGame } from './MemoryWriteGame';
import { DictationGame } from './DictationGame';
import { WordDinerGame } from './WordDinerGame';
import { updateActive, useStore } from '../store';
import { addPoints, addPractice, recordAnswer } from '../engine/progress';
import { changeCoins } from '../engine/merge';
import { classifyWord } from '../engine/analyze';
import { confetti, flyPoints } from '../ui/effects';
import { TrickPlayer } from '../tricks/TrickPlayer';
import { TRICKS } from '../tricks/tricks';
import { nextTip, type Tip } from '../data/tips';
import { dueWords, reviewAnswer } from '../engine/review';
import { setFocusWords } from '../engine/questions';
import { waitBeforeNextQuestion } from './common';

export const GAME_INFO: Record<GameId, { title: string; emoji: string; color: string }> = {
  cards: { title: 'קלפי קסם', emoji: '🃏', color: '#8338ec' },
  balloons: { title: 'בלונים', emoji: '🎈', color: '#ff5d8f' },
  rain: { title: 'גשם אותיות', emoji: '🌠', color: '#4c6ef5' },
  sort: { title: 'סלסלות', emoji: '🧺', color: '#fb8500' },
  builder: { title: 'בונים מילה', emoji: '🧱', color: '#f59f00' },
  memory: { title: 'זיכרון', emoji: '🧠', color: '#20c997' },
  truefalse: { title: 'נכון או לא?', emoji: '✅', color: '#2ec27e' },
  listen: { title: 'שומעים וכותבים', emoji: '👂', color: '#3a86ff' },
  bubbles: { title: 'בועות קסם', emoji: '🫧', color: '#15aabf' },
  rocket: { title: 'חללית המילים', emoji: '🚀', color: '#364fc7' },
  path: { title: 'גשר האבנים', emoji: '🪨', color: '#5c940d' },
  fishing: { title: 'דיג המילים', emoji: '🎣', color: '#1864ab' },
  whack: { title: 'הקש בשפן', emoji: '🐰', color: '#e8590c' },
  train: { title: 'רכבת המילים', emoji: '🚂', color: '#c2255c' },
  detective: { title: 'בלש הטעויות', emoji: '🔍', color: '#495057' },
  roots: { title: 'עץ השורשים', emoji: '🌳', color: '#9c36b5' },
  memwrite: { title: 'כותבים מהזיכרון', emoji: '🙈', color: '#5f3dc4' },
  dictation: { title: 'הכתבה', emoji: '📝', color: '#0b7285' },
  worddiner: { title: 'מסעדת המילים', emoji: '🍽️', color: '#e8590c' },
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
  bubbles: BubblesGame,
  rocket: RocketGame,
  path: PathGame,
  fishing: FishingGame,
  whack: WhackGame,
  train: TrainGame,
  detective: DetectiveGame,
  roots: RootsGame,
  memwrite: MemoryWriteGame,
  dictation: DictationGame,
  worddiner: WordDinerGame,
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
  level = 2,
  source = 'game',
  onFinish,
  onAnswer,
  title,
  words,
}: {
  game: GameId;
  skills: SkillId[];
  rounds?: number;
  level?: Level;
  source?: 'game' | 'learn' | 'diagnostic';
  onFinish: (correct: number, total: number) => void;
  /** every answer, e.g. so the teacher can re-teach the words that went wrong */
  onAnswer?: (skill: SkillId, correct: boolean, expected: string) => void;
  title?: string;
  /** the parents' own words (weekly school list) instead of the word bank */
  words?: string[];
}) {
  const liveGrade = useStore((s) => s.children.find((c) => c.id === s.activeChildId)?.grade ?? 1);
  // freeze inputs for the whole game so store updates (points) never regenerate the questions
  const [frozen] = useState(() => {
    // the child's own mistake words that are due for review come first in the questions
    const child = useStore.getState().children.find((c) => c.id === useStore.getState().activeChildId);
    setFocusWords(child ? dueWords(child) : []);
    // the level changes the words: "קל" takes easier words, "אלופים" words above the child's grade
    return { skills, grade: Math.max(1, Math.min(8, liveGrade + (level - 2))) };
  });
  const streak = useRef(0);
  const [combo, setCombo] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const wrongs = useRef<Record<string, number>>({});
  const shown = useRef<Set<string>>(new Set());
  const [trick, setTrick] = useState<SkillId | null>(null);
  // hearts: three mistakes and the game is lost – play it again (the placement check has no hearts)
  // a dictation is a test of whole sentences: its corrections are shown inside it, no hearts or tip pop-ups
  const quiet = source === 'diagnostic' || game === 'dictation';
  const hearts = quiet ? Infinity : 3;
  const [lost, setLost] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const lostRef = useRef(0);
  useEffect(() => {
    if (lost >= hearts) speak('אוי, נגמרו הלבבות. לא נורא, מנסים שוב!');
  }, [lost, hearts]);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  const report = useCallback(
    (skill: SkillId, correct: boolean, expected: string, typed: string) => {
      onAnswerRef.current?.(skill, correct, expected);
      const issue = correct ? undefined : classifyWord(expected, typed)[0];
      updateActive((c) => {
        let next = recordAnswer(c, skill, correct, correct ? undefined : { expected, typed, pair: issue?.pair, skill: issue?.skill ?? skill, source });
        next = reviewAnswer(next, skill, expected, correct);
        if (correct && source !== 'diagnostic') next = changeCoins(addPoints(next, POINTS_PER_CORRECT), 1);
        return next;
      });
      if (correct && source !== 'diagnostic') {
        streak.current += 1;
        // a streak of right answers earns extra points
        const bonus = streak.current >= 3 ? Math.min(streak.current, 10) * 2 : 0;
        if (bonus) updateActive((c) => addPoints(c, bonus));
        flyPoints(POINTS_PER_CORRECT + bonus);
        setCombo(streak.current);
      } else if (!correct) {
        streak.current = 0;
        setCombo(0);
      }
      if (!correct && !quiet) {
        lostRef.current += 1;
        setLost(lostRef.current);
        wrongs.current[skill] = (wrongs.current[skill] ?? 0) + 1;
        const child = useStore.getState().children.find((c) => c.id === useStore.getState().activeChildId);
        if (wrongs.current[skill] === 2 && !shown.current.has(skill) && TRICKS[skill] && !child?.seenTricks.includes(skill)) {
          // the animated trick for this topic, the first time the child struggles with it
          shown.current.add(skill);
          setTimeout(() => setTrick(skill), 2500);
        } else if (child) {
          // otherwise a new tip about exactly this word – never one the child has heard before
          const t = nextTip(child.seenTips ?? [], skill, expected);
          if (t) {
            updateActive((c) => ({ ...c, seenTips: [...(c.seenTips ?? []), t.id], updatedAt: Date.now() }));
            const said = new Promise<void>((resolve) =>
              setTimeout(() => {
                setTip(t);
                speak(t.text, { force: true }).then(() => {
                  setTimeout(() => setTip((cur) => (cur?.id === t.id ? null : cur)), 700);
                  resolve();
                });
              }, 1900),
            );
            waitBeforeNextQuestion(said);
          }
        }
      }
    },
    [source, quiet],
  );

  // practice time counts towards the daily goal (10 minutes)
  const started = useRef(Date.now());
  const finish = useCallback((c: number, t: number) => {
    if (source !== 'diagnostic') {
      const secs = (Date.now() - started.current) / 1000;
      started.current = Date.now();
      let reached = false;
      updateActive((ch) => {
        const r = addPractice(ch, secs);
        reached = r.reached;
        return r.reached ? changeCoins(addPoints(r.child, 50), 10) : r.child;
      });
      if (reached)
        setTimeout(() => {
          confetti(200);
          speak('וואו! השלמת עשר דקות של למידה היום!');
        }, 1600);
    }
    if (lostRef.current < hearts) finishRef.current(c, t);
  }, [hearts, source]);
  const Comp = COMPONENTS[game];
  const props = { skills: frozen.skills, grade: frozen.grade, rounds, level, report, finish, words };

  return (
    <>
      {hearts !== Infinity && (
        <div className="row" style={{ justifyContent: 'center', gap: 4, fontSize: 24, marginBottom: 6 }} aria-label={`${Math.max(0, hearts - lost)} לבבות`}>
          {Array.from({ length: hearts }, (_, k) => (
            <span key={k} style={{ transition: 'transform .3s', transform: k >= hearts - lost ? 'scale(.8)' : 'none' }}>
              {k < hearts - lost ? '❤️' : '🤍'}
            </span>
          ))}
        </div>
      )}
      {combo >= 3 && (
        <div key={combo} className="combo" aria-live="polite">
          🔥 {combo} ברצף!
        </div>
      )}
      {tip && (
        <div className="tip-card" role="status" onClick={() => setTip(null)}>
          <span style={{ fontSize: 34 }}>💡</span>
          <span className="grow">{tip.text}</span>
        </div>
      )}
      <div key={attempt}>{game === 'listen' && title ? <ListenGame {...props} title={title} /> : <Comp {...props} />}</div>
      {lost >= hearts && (
        <div className="overlay">
          <div className="modal center" style={{ gap: 10 }}>
            <div style={{ fontSize: 64 }}>💔</div>
            <h2 style={{ margin: 0 }}>אוי, נגמרו הלבבות</h2>
            <p style={{ margin: 0 }}>היו שלוש טעויות. לא נורא – מנסים שוב, והפעם עם יותר תשומת לב!</p>
            <button
              className="btn green big"
              onClick={() => {
                lostRef.current = 0;
                setLost(0);
                wrongs.current = {};
                setAttempt((a) => a + 1);
              }}
            >
              🔁 עוד ניסיון
            </button>
          </div>
        </div>
      )}
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

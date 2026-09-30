import { useEffect, useRef, useState } from 'react';
import { updateActive, useActiveChild, useStore } from '../store';
import { useNav } from '../nav';
import { TopBar, Stars, PRAISE, pick } from '../ui/kit';
import { GameHost } from '../games/GameHost';
import { TrickPlayer } from '../tricks/TrickPlayer';
import { Mascot, MascotSays } from '../ui/Mascot';
import { confetti, sfx } from '../ui/effects';
import { speak, stop } from '../services/tts';
import { STAGES_PER_WORLD, addPoints, completeStage, ensureWorld, gamesForSkill, mastery, reviewSkills, stageAt } from '../engine/progress';
import { dueWords } from '../engine/review';
import { poolFor } from '../engine/questions';
import { nextTip, type Tip } from '../data/tips';
import { WORDS } from '../data/words';
import { worldInfo } from './LearnScreen';
import type { Child, GameId, Level, SkillId } from '../types';

/**
 * "The teacher": the child just presses "continue" – the app decides what to learn.
 * Every step: explain (trick the first time, then new tips with example words) → practise with a
 * game at the right difficulty → if it did not go well, explain again with the words that went
 * wrong and practise with another game → next step, next topic. Due review words come first.
 */
type Phase =
  | { k: 'review' }
  | { k: 'trick'; skill: SkillId }
  | { k: 'teach'; cards: LessonCard[]; again: boolean }
  | { k: 'play'; game: GameId; level: Level; attempt: number }
  | { k: 'result'; stars: number; bonus: number; passed: boolean; newTopic: string | null };

interface LessonCard {
  word: string;
  emoji?: string;
  tip: Tip;
}

function current(c: Child) {
  const wi = c.worlds.length - 1;
  const w = c.worlds[wi];
  const skills = (w.skill === 'review' ? reviewSkills(c) : [w.skill]) as SkillId[];
  return { w, wi, skills, stage: stageAt(w, wi, w.done) };
}

/** Difficulty follows how well the child already knows the topic. */
function levelFor(c: Child, skills: SkillId[]): Level {
  const m = skills.reduce((a, s) => a + mastery(c, s), 0) / skills.length;
  return m < 0.5 ? 1 : m < 0.7 ? 2 : m < 0.85 ? 3 : 4;
}

/** Two or three new tips, about the words that went wrong first, then the child's review words. */
function lessonCards(c: Child, skills: SkillId[], missed: string[], n: number): LessonCard[] {
  const seen = [...(c.seenTips ?? [])];
  const due = dueWords(c).filter((d) => skills.includes(d.skill)).map((d) => d.word);
  const words = [...new Set([...missed, ...due, ...skills.flatMap((s) => poolFor(s, c.grade).map((e) => e.w))])];
  const cards: LessonCard[] = [];
  for (const word of words) {
    if (cards.length >= n) break;
    const skill = skills.find((s) => WORDS[s].some((e) => e.w === word)) ?? skills[0];
    const tip = nextTip(seen, skill, word);
    if (!tip || cards.some((x) => x.tip.id === tip.id)) continue;
    seen.push(tip.id);
    const w = tip.word && tip.word.length > 1 ? tip.word : word;
    cards.push({ word: w, emoji: WORDS[skill].find((e) => e.w === w)?.e, tip });
  }
  return cards;
}

export function TeacherScreen() {
  const child = useActiveChild();
  const go = useNav((s) => s.go);
  const [phase, setPhase] = useState<Phase | null>(null);
  const missed = useRef<string[]>([]);
  const reviewed = useRef(false);

  /** Decide the next step from the child's saved progress. */
  const next = (again = false) => {
    stop();
    updateActive((c) => ensureWorld(c));
    const c = useStore.getState().children.find((x) => x.id === useStore.getState().activeChildId);
    if (!c) return;
    if (!reviewed.current && dueWords(c).length >= 3) {
      reviewed.current = true;
      speak('קודם נחזור על מילים שלך שמחכות לחזרה.');
      return setPhase({ k: 'review' });
    }
    const { w, skills, stage } = current(c);
    if (stage.kind === 'trick' && w.skill !== 'review' && !c.seenTricks.includes(w.skill)) return setPhase({ k: 'trick', skill: w.skill });
    const cards = lessonCards(c, skills, again ? missed.current : [], again ? 3 : 2);
    if (cards.length) return setPhase({ k: 'teach', cards, again });
    startPlay(0);
  };

  const startPlay = (attempt: number) => {
    const c = useStore.getState().children.find((x) => x.id === useStore.getState().activeChildId);
    if (!c) return;
    const { w, wi, skills, stage } = current(c);
    missed.current = [];
    let game: GameId = stage.kind === 'game' ? stage.game : 'listen';
    if (stage.kind === 'trick' || attempt > 0) {
      const games = gamesForSkill(w.skill);
      game = games[(wi * 3 + w.done + attempt) % games.length];
    }
    setPhase({ k: 'play', game, level: levelFor(c, skills), attempt });
  };

  useEffect(() => {
    if (!child?.diagnosed) return;
    next();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.diagnosed]);

  if (child && !child.diagnosed)
    return (
      <div className="screen sky-bg">
        <TopBar title="👩‍🏫 המורה" guide="diagnostic" />
        <div className="center" style={{ gap: 18, marginTop: 30 }}>
          <MascotSays text="לפני שמתחילים ללמוד – משחק קצר כדי שאדע מה כבר יודעים ובמה לעזור!" size={120} />
          <button className="btn big green" onClick={() => go({ name: 'diagnostic' })}>
            🚀 יוצאים לדרך!
          </button>
        </div>
      </div>
    );
  if (!child || !phase) return null;
  const { w } = current(child);
  const info = worldInfo(w);

  const finishStage = (correct: number, total: number, attempt: number) => {
    const r = total ? correct / total : 1;
    const stars = r >= 0.9 ? 3 : r >= 0.65 ? 2 : 1;
    // a second try moves on anyway, so a child never gets stuck – the review brings the words back
    const passed = stars >= 2 || attempt >= 1;
    let newTopic: string | null = null;
    const bonus = passed ? 20 + stars * 10 : 0;
    if (passed) {
      const before = useStore.getState().children.find((x) => x.id === useStore.getState().activeChildId)!;
      const worldEnds = before.worlds[before.worlds.length - 1].done + 1 >= STAGES_PER_WORLD;
      updateActive((c) => addPoints(completeStage(c, stars), bonus));
      if (worldEnds) {
        const after = useStore.getState().children.find((x) => x.id === useStore.getState().activeChildId)!;
        newTopic = worldInfo(after.worlds[after.worlds.length - 1]).title;
      }
      sfx('win');
      confetti(stars * 50);
      speak(newTopic ? 'סיימת את הנושא! עוברים לנושא חדש.' : `${pick(PRAISE)} עוברים לשלב הבא.`);
    } else {
      sfx('pop');
      speak('בוא נלמד את זה שוב, ואז ננסה עוד פעם.');
    }
    setPhase({ k: 'result', stars, bonus, passed, newTopic });
  };

  return (
    <div className="screen" style={{ background: `linear-gradient(${info.color}33, #fff7e6)` }}>
      <TopBar title={`👩‍🏫 המורה · ${info.icon} ${info.title}`} guide="teacher" />
      <div className="row" style={{ gap: 4, marginBottom: 8 }}>
        {Array.from({ length: STAGES_PER_WORLD }, (_, k) => (
          <div key={k} className="grow" style={{ height: 8, borderRadius: 8, background: k < w.done ? info.color : '#dee2e6' }} />
        ))}
      </div>

      {phase.k === 'review' && (
        <GameHost
          game="cards"
          skills={[...new Set(dueWords(child).map((d) => d.skill))]}
          rounds={Math.min(8, Math.max(4, dueWords(child).length))}
          onFinish={() => next()}
        />
      )}

      {phase.k === 'trick' && (
        <TrickPlayer
          skill={phase.skill}
          onDone={() => {
            updateActive((c) => (c.seenTricks.includes(phase.skill) ? c : { ...c, seenTricks: [...c.seenTricks, phase.skill] }));
            // the trick itself is the explanation of this step; practice follows right away
            startPlay(0);
          }}
        />
      )}

      {phase.k === 'teach' && <Lesson cards={phase.cards} again={phase.again} onDone={() => startPlay(phase.again ? 1 : 0)} />}

      {phase.k === 'play' && (
        <GameHost
          key={`${w.done}-${phase.attempt}`}
          game={phase.game}
          skills={current(child).skills}
          rounds={8}
          level={phase.level}
          source="learn"
          onAnswer={(_, ok, expected) => {
            if (!ok && !missed.current.includes(expected)) missed.current.push(expected);
          }}
          onFinish={(c, t) => finishStage(c, t, phase.attempt)}
        />
      )}

      {phase.k === 'result' && (
        <div className="overlay">
          <div className="modal center" style={{ gap: 10 }}>
            <Mascot size={110} cheer={phase.passed} mood={phase.passed ? 'wow' : 'think'} />
            {phase.passed ? (
              <>
                <div style={{ fontSize: 44 }}>
                  <Stars n={phase.stars} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--orange)' }}>+{phase.bonus} ⭐</div>
                {phase.newTopic ? <p>🏆 סיימת את הנושא! עכשיו לומדים: <b>{phase.newTopic}</b></p> : <p>כל הכבוד! עוברים לשלב הבא.</p>}
              </>
            ) : (
              <p style={{ fontSize: 20 }}>היו כמה טעויות – זה בסדר! בוא נלמד את זה שוב, ואז ננסה עוד פעם.</p>
            )}
            <button className="btn green big" onClick={() => next(!phase.passed)}>
              ממשיכים ⬅️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Explanation cards: a word, the tip about it (said aloud), then "understood". */
function Lesson({ cards, again, onDone }: { cards: LessonCard[]; again: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const card = cards[i];
  useEffect(() => {
    updateActive((c) => ((c.seenTips ?? []).includes(card.tip.id) ? c : { ...c, seenTips: [...(c.seenTips ?? []), card.tip.id] }));
    const t = setTimeout(() => speak(card.tip.text, { force: true, rate: 0.9 }), 300);
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [card]);

  return (
    <div className="center" style={{ gap: 14 }}>
      <div className="bubble">{again ? '📘 נלמד שוב, לאט ובעיון' : `📘 שיעור קצר · ${i + 1} מתוך ${cards.length}`}</div>
      <div key={i} className="card center" style={{ width: '100%', gap: 10, animation: 'screenIn .4s', minHeight: 260, justifyContent: 'center' }}>
        {card.emoji && <div style={{ fontSize: 56 }}>{card.emoji}</div>}
        <div className="word-big" style={{ fontSize: 64 }}>
          {card.word}
        </div>
        <div style={{ fontSize: 20, lineHeight: 1.6, textAlign: 'center' }}>💡 {card.tip.text}</div>
      </div>
      <div className="row">
        <button className="btn white" onClick={() => speak(card.tip.text, { force: true, rate: 0.85 })}>
          🔊
        </button>
        <button
          className="btn green big"
          onClick={() => {
            sfx('pop');
            if (i + 1 >= cards.length) onDone();
            else setI(i + 1);
          }}
        >
          הבנתי ⬅️
        </button>
      </div>
    </div>
  );
}

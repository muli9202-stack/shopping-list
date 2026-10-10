import { useEffect, useRef, useState } from 'react';
import { updateActive, useActiveChild, useStore } from '../store';
import { useNav } from '../nav';
import { TopBar, Stars, PRAISE, pick } from '../ui/kit';
import { GameHost } from '../games/GameHost';
import { TrickPlayer } from '../tricks/TrickPlayer';
import { Mascot, MascotSays } from '../ui/Mascot';
import { confetti, sfx } from '../ui/effects';
import { speak, stop } from '../services/tts';
import { addPoints, dayKey, gamesForSkill } from '../engine/progress';
import { changeCoins } from '../engine/merge';
import { PATH_LENGTH, UNIT, completeLevel, pathLevel, pathStep, rankOf } from '../engine/path';
import { SKILL_BY_ID } from '../data/skills';
import { dueWords } from '../engine/review';
import { poolFor } from '../engine/questions';
import { nextTip, type Tip } from '../data/tips';
import { WORDS } from '../data/words';
import type { Child, GameId, SkillId } from '../types';

/**
 * "The teacher": the child just presses "continue" – the app leads the 1000-level path (engine/path.ts).
 * Every level: explain (trick when a topic starts, then new tips with example words) → practise with
 * the level's game → if it did not go well, explain again with the words that went wrong and practise
 * with another game → next level. Due review words come first.
 */
type Phase =
  | { k: 'week' }
  | { k: 'pretest' }
  | { k: 'review' }
  | { k: 'trick'; skill: SkillId }
  | { k: 'teach'; cards: LessonCard[]; again: boolean }
  | { k: 'play'; game: GameId; attempt: number }
  | { k: 'result'; stars: number; bonus: number; passed: boolean; milestone: string | null };

interface LessonCard {
  word: string;
  emoji?: string;
  tip: Tip;
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
    cards.push({ word: w, emoji: WORDS[skill]?.find((e) => e.w === w)?.e, tip });
  }
  return cards;
}

function activeChild() {
  const st = useStore.getState();
  return st.children.find((x) => x.id === st.activeChildId);
}

export function TeacherScreen() {
  const child = useActiveChild();
  const go = useNav((s) => s.go);
  const [phase, setPhase] = useState<Phase | null>(null);
  const missed = useRef<string[]>([]);
  const reviewed = useRef(false);

  /** Decide the next step from the child's place on the path. */
  const next = (again = false) => {
    stop();
    const c = activeChild();
    if (!c) return;
    // the weekly school words come first, once a day
    if (!again && c.weekWords?.words.length && c.weekDone !== dayKey()) {
      speak('קודם נתרגל את מילות השבוע שלך מבית הספר.');
      return setPhase({ k: 'week' });
    }
    if (!again && !reviewed.current && dueWords(c).length >= 3) {
      reviewed.current = true;
      speak('קודם נחזור על מילים שלך שמחכות לחזרה.');
      return setPhase({ k: 'review' });
    }
    const step = pathStep(c, pathLevel(c));
    // a short test before a new topic, to compare with the unit test at its end
    if (step.intro && !again && c.unitTests?.[step.unit]?.pre === undefined) {
      speak('לפני שמתחילים נושא חדש, בוא נבדוק מה כבר יודעים.');
      return setPhase({ k: 'pretest' });
    }
    if (step.intro && !c.seenTricks.includes(step.topic)) return setPhase({ k: 'trick', skill: step.topic });
    const cards = lessonCards(c, step.skills, again ? missed.current : [], again ? 3 : step.intro ? 3 : 2);
    if (cards.length) return setPhase({ k: 'teach', cards, again });
    startPlay(0);
  };

  const startPlay = (attempt: number) => {
    const c = activeChild();
    if (!c) return;
    const step = pathStep(c, pathLevel(c));
    missed.current = [];
    const games = gamesForSkill(step.topic);
    // a second try uses another game, so the same words are practised in a new way
    const game = attempt > 0 ? games[(step.n + attempt * 3) % games.length] : step.game;
    setPhase({ k: 'play', game, attempt });
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
  const n = pathLevel(child);
  const step = pathStep(child, n);
  const topic = SKILL_BY_ID[step.topic];
  const label = step.kind === 'boss' ? '👑 שלב אלופים' : step.kind === 'review' ? '🔁 שלב חזרה' : step.kind === 'dictation' ? '📝 הכתבה' : `${topic.icon} ${topic.title}`;

  const finishLevel = (correct: number, total: number, attempt: number) => {
    const r = total ? correct / total : 1;
    const stars = r >= 0.9 ? 3 : r >= 0.65 ? 2 : 1;
    // a second try moves on anyway, so a child never gets stuck – the review brings the words back
    const passed = stars >= 2 || attempt >= 1;
    const bonus = passed ? 20 + stars * 10 + (step.kind === 'boss' ? 30 : 0) : 0;
    let milestone: string | null = null;
    if (passed) {
      updateActive((c) => {
        let next = changeCoins(addPoints(completeLevel(c, n, stars), bonus), 3 + stars);
        // the unit test: how much the child knows now, next to the test before the topic
        if (step.pos === UNIT - 1 && step.kind === 'lesson') next = { ...next, unitTests: { ...(next.unitTests ?? {}), [step.unit]: { ...(next.unitTests?.[step.unit] ?? { topic: step.topic }), post: Math.round(r * 100) } } };
        return next;
      });
      if (n % 100 === 0 && n < PATH_LENGTH) milestone = `🎖️ עלית לדרגה חדשה: ${rankOf(n + 1)}`;
      else if (n === PATH_LENGTH) milestone = '👑 סיימת את כל 1000 השלבים! אתה מלך הכתיב!';
      else if (n % 10 === 0) milestone = `🏆 עברת את שלב האלופים ${n}!`;
      sfx('win');
      confetti(milestone ? 220 : stars * 50);
      speak(n % 100 === 0 ? 'וואו! הגעת לדרגה חדשה!' : n % 10 === 0 ? 'ניצחת את שלב האלופים!' : `${pick(PRAISE)} עוברים לשלב הבא.`);
    } else {
      sfx('pop');
      speak('בוא נלמד את זה שוב, ואז ננסה עוד פעם.');
    }
    setPhase({ k: 'result', stars, bonus, passed, milestone });
  };

  return (
    <div className="screen" style={{ background: `linear-gradient(${topic.color}33, #fff7e6)` }}>
      <TopBar title={`👩‍🏫 שלב ${n} · ${label}`} guide="teacher" />
      <div className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <span className="small" style={{ whiteSpace: 'nowrap' }}>{rankOf(n)}</span>
        <div className="grow" style={{ height: 10, borderRadius: 10, background: '#dee2e6', overflow: 'hidden' }}>
          <div style={{ width: `${((n - 1) % 100) + 1}%`, height: '100%', background: topic.color }} />
        </div>
        <span className="small muted">{n}/{PATH_LENGTH}</span>
      </div>

      {phase.k === 'week' && (
        <GameHost
          game="memwrite"
          skills={step.skills}
          words={child.weekWords!.words}
          rounds={child.weekWords!.words.length}
          onFinish={() => {
            updateActive((c) => ({ ...c, weekDone: dayKey(), updatedAt: Date.now() }));
            next();
          }}
        />
      )}

      {phase.k === 'pretest' && (
        <GameHost
          game="cards"
          title="🧪 בדיקה לפני הנושא"
          skills={[step.topic]}
          rounds={6}
          source="diagnostic"
          onFinish={(c, t) => {
            updateActive((ch) => ({ ...ch, unitTests: { ...(ch.unitTests ?? {}), [step.unit]: { topic: step.topic, pre: Math.round((c / Math.max(1, t)) * 100) } }, updatedAt: Date.now() }));
            next();
          }}
        />
      )}

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
            // the trick itself is the explanation of this level; practice follows right away
            startPlay(0);
          }}
        />
      )}

      {phase.k === 'teach' && <Lesson cards={phase.cards} again={phase.again} onDone={() => startPlay(phase.again ? 1 : 0)} />}

      {phase.k === 'play' && (
        <GameHost
          key={`${n}-${phase.attempt}`}
          game={phase.game}
          skills={step.skills}
          rounds={step.rounds}
          level={step.level}
          source="learn"
          onAnswer={(_, ok, expected) => {
            if (!ok && !missed.current.includes(expected)) missed.current.push(expected);
          }}
          onFinish={(c, t) => finishLevel(c, t, phase.attempt)}
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
                {phase.milestone ? <p style={{ fontSize: 20 }}>{phase.milestone}</p> : <p>כל הכבוד! עוברים לשלב {Math.min(PATH_LENGTH, n + 1)}.</p>}
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

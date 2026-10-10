import { useEffect, useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, HebrewKeyboard, showNikud } from './common';
import { writeItems } from './ListenGame';
import { classifyWord, norm } from '../engine/analyze';
import { WORDS } from '../data/words';
import { shuffle } from '../engine/questions';
import type { SkillId } from '../types';
import type { Item } from './ListenGame';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { PRAISE, pick } from '../ui/kit';
import { Correction } from './Correction';

type Phase = 'look' | 'write' | 'check';

/** The weekly school words: each one in its topic if the word bank knows it (then it has nikud, a picture and the voice). */
function weekItems(words: string[], skills: SkillId[]): Item[] {
  return shuffle(words).map((w) => {
    for (const s of Object.keys(WORDS) as SkillId[]) {
      const e = WORDS[s].find((x) => x.w === w);
      if (e) return { skill: s, word: w, say: e.n ?? w, nikud: e.n, emoji: e.e };
    }
    return { skill: skills[0], word: w, say: w };
  });
}

/**
 * "Look, cover, write, check" – the classic way to learn spelling for real: see the word and hear it,
 * the word is covered, write it from memory, then compare letter by letter. Writing from memory (not
 * choosing) is what a dictation at school asks for.
 */
export function MemoryWriteGame({ skills, grade, rounds, level = 2, report, finish, words }: GameProps) {
  const items = useMemo(() => (words?.length ? weekItems(words, skills) : writeItems(skills, grade, rounds)), [skills, grade, rounds, words]);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('look');
  const [typed, setTyped] = useState('');
  const [ok, setOk] = useState(false);
  const [score, setScore] = useState(0);
  const it = items[i];
  // harder levels show the word for a shorter time
  const lookMs = [0, 6000, 4500, 3500, 2500][level];

  useEffect(() => {
    if (!it) return;
    setPhase('look');
    setTyped('');
    const s = setTimeout(() => speak(it.say, { force: true, rate: 0.8 }), 300);
    const t = setTimeout(() => setPhase('write'), lookMs + 600);
    return () => {
      clearTimeout(s);
      clearTimeout(t);
    };
  }, [it, lookMs]);

  if (!it) return null;
  const shown = it.sentence ? it.sentence.replace('___', it.word) : it.word;

  const check = () => {
    if (phase !== 'write' || !typed.trim()) return;
    const good = norm(typed) === norm(it.word);
    setOk(good);
    setPhase('check');
    // the parents' own words: the mistake itself tells which topic it belongs to
    const issue = good ? undefined : classifyWord(it.word, typed)[0]?.skill;
    report(issue && issue !== 'other' ? issue : it.skill, good, it.word, typed.trim());
    if (good) {
      sfx('good');
      setScore((s) => s + 1);
      speak(pick(PRAISE));
    } else {
      sfx('bad');
      speak('כמעט! תראו איך כותבים');
    }
  };

  const next = () => {
    if (i + 1 >= items.length) finish(score, items.length);
    else setI(i + 1);
  };

  return (
    <GameShell game="memwrite" title="🙈 כותבים מהזיכרון" done={i} total={items.length} instruction="מסתכלים טוב על המילה, היא נעלמת – וכותבים אותה מהזיכרון">
      <div className="card center" style={{ gap: 8, marginBottom: 12, minHeight: 210 }}>
        {phase === 'look' && (
          <>
            <div className="small muted">👀 מסתכלים ומצלמים בראש...</div>
            {it.emoji && <div style={{ fontSize: 50 }}>{it.emoji}</div>}
            <div className="word-big" style={{ fontSize: it.sentence ? 36 : 66 }}>
              {shown}
            </div>
            {showNikud(grade) && it.nikud && <div className="nikud-hint">{it.nikud}</div>}
            <div style={{ height: 8, width: '80%', background: '#dee2e6', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--purple)', animation: `shrink ${lookMs}ms linear forwards` }} />
            </div>
            <button className="btn white" onClick={() => setPhase('write')}>
              זכרתי! 🙈
            </button>
          </>
        )}
        {phase !== 'look' && (
          <>
            {it.emoji && <div style={{ fontSize: 40 }}>{it.emoji}</div>}
            {it.sentence && <div className="script" style={{ fontSize: 26 }}>{it.sentence.replace('___', '____')}</div>}
            {phase === 'write' && (
              <>
                <div className="small muted">🙈 המילה מוסתרת – כתבו אותה מהזיכרון</div>
                <div className="word-big" style={{ minHeight: 80, minWidth: 200, borderBottom: '4px solid #dee2e6' }}>
                  {typed || ' '}
                </div>
                <button className="btn white" onClick={() => speak(it.say, { force: true, rate: 0.75 })}>
                  🔊 שוב
                </button>
              </>
            )}
            {phase === 'check' &&
              (ok ? (
                <div className="word-big" style={{ color: 'var(--green)', fontSize: 64, animation: 'pop .5s' }}>
                  {it.word} ✔
                </div>
              ) : (
                <Correction expected={it.word} typed={typed} />
              ))}
            {phase === 'check' && (
              <button className="btn green big" onClick={next}>
                ממשיכים ⬅️
              </button>
            )}
          </>
        )}
      </div>
      {phase === 'write' && (
        <HebrewKeyboard onKey={(k) => setTyped((t) => (t + k).slice(0, 16))} onBack={() => setTyped((t) => t.slice(0, -1))} onEnter={check} />
      )}
    </GameShell>
  );
}

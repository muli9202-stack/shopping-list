import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, HebrewKeyboard, showNikud, useSayQuestion } from './common';
import { shuffle, wordsFor } from '../engine/questions';
import { IM_SENTENCES } from '../data/words';
import { classifyWord, norm } from '../engine/analyze';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { PRAISE, SpeakBtn, pick } from '../ui/kit';
import type { SkillId } from '../types';

export interface Item {
  skill: SkillId;
  word: string;
  say: string;
  nikud?: string;
  emoji?: string;
  /** sentence context for אם/עם */
  sentence?: string;
}

/** Words (or אם/עם sentences) to write, for the writing games. */
export function writeItems(skills: SkillId[], grade: number, rounds: number): Item[] {
  const per = Math.ceil(rounds / skills.length);
  const list: Item[] = [];
  for (const s of skills) {
    if (s === 'im_im') {
      shuffle(IM_SENTENCES.filter((x) => x.g <= grade + 1))
        .slice(0, per)
        .forEach((x) => list.push({ skill: s, word: x.a, say: x.s.replace('___', x.a), sentence: x.s }));
    } else wordsFor(s, grade, per).forEach((w) => list.push({ skill: s, word: w.w, say: w.n ?? w.w, nikud: w.n, emoji: w.e }));
  }
  return shuffle(list).slice(0, rounds);
}

/** Dictation of single words: hear it, type it on the big keyboard. Also used as the "boss" challenge. */
export function ListenGame({ skills, grade, rounds, report, finish, title = '👂 שומעים וכותבים' }: GameProps & { title?: string }) {
  const items = useMemo(() => writeItems(skills, grade, rounds), [skills, grade, rounds]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const it = items[i];

  useSayQuestion(it?.say, 0.75);

  if (!it) return null;

  const check = () => {
    if (state !== null || !typed.trim()) return;
    const ok = norm(typed) === norm(it.word);
    setState(ok);
    report(it.skill, ok, it.word, typed.trim());
    if (ok) {
      sfx('good');
      speak(pick(PRAISE));
      setScore((s) => s + 1);
    } else {
      sfx('bad');
      const issue = classifyWord(it.word, typed)[0];
      speak(issue?.pair ? 'כמעט! תראו איך כותבים' : 'לא נורא, ככה כותבים');
    }
    setTimeout(() => {
      setTyped('');
      setState(null);
      if (i + 1 >= items.length) finish(score + (ok ? 1 : 0), items.length);
      else setI(i + 1);
    }, ok ? 1200 : 2800);
  };

  return (
    <GameShell game="listen" title={title} done={i} total={items.length} instruction="הקשיבו וכתבו את המילה">
      <div className="card center" style={{ gap: 8, marginBottom: 12 }}>
        <div className="row">
          {it.emoji && <span style={{ fontSize: 44 }}>{it.emoji}</span>}
          <button className="btn blue" onClick={() => speak(it.say, { force: true, rate: 0.7 })}>
            🔊 שוב
          </button>
          {it.sentence && <SpeakBtn text={it.say} small />}
        </div>
        {it.sentence && <div className="script" style={{ fontSize: 28 }}>{it.sentence.replace('___', '____')}</div>}
        <div
          className="word-big"
          style={{
            minHeight: 86,
            minWidth: 200,
            borderBottom: '4px solid #dee2e6',
            color: state === null ? 'var(--ink)' : state ? 'var(--green)' : 'var(--red)',
            textDecoration: state === false ? 'line-through' : undefined,
          }}
        >
          {typed || ' '}
        </div>
        {state === false && (
          <div className="word-big" style={{ color: 'var(--green)', fontSize: 56 }}>
            {it.word}
          </div>
        )}
        {state !== null && showNikud(grade) && it.nikud && <div className="nikud-hint">{it.nikud}</div>}
      </div>
      <HebrewKeyboard
        onKey={(k) => state === null && setTyped((t) => (t + k).slice(0, 16))}
        onBack={() => state === null && setTyped((t) => t.slice(0, -1))}
        onEnter={check}
      />
    </GameShell>
  );
}

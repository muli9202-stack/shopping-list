import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, showNikud } from './common';
import { shuffle, wordsFor } from '../engine/questions';
import { SKILL_BY_ID } from '../data/skills';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { PRAISE, SpeakBtn, pick } from '../ui/kit';
import { classifyWord, misspell } from '../engine/analyze';

/** Word builder: listen to the word and build it from letter tiles (with tricky look-alike tiles mixed in). */
export function BuilderGame({ skills, grade, rounds, report, finish }: GameProps) {
  const words = useMemo(() => {
    const per = Math.ceil(rounds / skills.length);
    return shuffle(skills.flatMap((s) => wordsFor(s, grade, per).map((w) => ({ ...w, skill: s })))).slice(0, rounds);
  }, [skills, grade, rounds]);
  const [i, setI] = useState(0);
  const [slots, setSlots] = useState<number[]>([]);
  const [state, setState] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const w = words[i];

  const tiles = useMemo(() => {
    if (!w) return [];
    const letters = w.w.split('');
    const extra: string[] = [];
    const m = misspell(w.w, w.skill, SKILL_BY_ID[w.skill].groups);
    if (m) extra.push(m.wrong[m.index]);
    if (w.x[0]) for (const ch of w.x[0]) if (!letters.includes(ch) && ch !== ' ') extra.push(ch);
    return shuffle([...letters, ...Array.from(new Set(extra)).slice(0, 2)]);
  }, [w]);

  if (!w) return null;
  const built = slots.map((k) => tiles[k]).join('');

  const tap = (k: number) => {
    if (state !== null || slots.includes(k) || slots.length >= w.w.length) return;
    sfx('pop');
    const next = [...slots, k];
    setSlots(next);
    if (next.length === w.w.length) {
      const typed = next.map((x) => tiles[x]).join('');
      const ok = typed === w.w;
      setState(ok);
      report(w.skill, ok, w.w, typed);
      if (ok) {
        sfx('good');
        speak(pick(PRAISE));
        setScore((s) => s + 1);
      } else {
        sfx('bad');
        const issue = classifyWord(w.w, typed)[0];
        speak(issue?.skill && issue.skill !== 'other' ? `כמעט! שימו לב ל${SKILL_BY_ID[issue.skill].title}` : 'כמעט! ככה כותבים');
      }
      setTimeout(() => {
        setSlots([]);
        setState(null);
        if (i + 1 >= words.length) finish(score + (ok ? 1 : 0), words.length);
        else setI(i + 1);
      }, ok ? 1200 : 2600);
    }
  };

  return (
    <GameShell title="🧱 בונים מילה" done={i} total={words.length} instruction="הקשיבו למילה ובנו אותה מהאותיות">
      <div className="card center" key={i} style={{ gap: 10, animation: 'screenIn .35s' }}>
        <div className="row">
          {w.e && <span style={{ fontSize: 54 }}>{w.e}</span>}
          <SpeakBtn text={w.n ?? w.w} />
        </div>
        <div style={{ display: 'flex', gap: 6, direction: 'rtl', flexWrap: 'wrap', justifyContent: 'center' }}>
          {w.w.split('').map((_, k) => (
            <span
              key={k}
              className="slot"
              style={{ borderColor: state === null ? undefined : state ? 'var(--green)' : 'var(--red)', background: state === true ? '#d3f9d8' : undefined }}
              onClick={() => state === null && k === slots.length - 1 && setSlots(slots.slice(0, -1))}
            >
              {built[k] ?? ''}
            </span>
          ))}
        </div>
        {state === false && (
          <div className="word-big" style={{ color: 'var(--green)', fontSize: 56 }}>
            {w.w}
          </div>
        )}
        {showNikud(grade) && w.n && state !== null && <div className="nikud-hint">{w.n}</div>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
        {tiles.map((t, k) => (
          <button key={k} className={`tile ${slots.includes(k) ? 'used' : ''}`} onClick={() => tap(k)}>
            {t}
          </button>
        ))}
      </div>
      <div className="center" style={{ marginTop: 12 }}>
        <button className="btn white" onClick={() => state === null && setSlots(slots.slice(0, -1))}>
          ⌫ מחיקה
        </button>
      </div>
    </GameShell>
  );
}

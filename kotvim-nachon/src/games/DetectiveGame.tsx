import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, useSayQuestion } from './common';
import { detectiveItems } from '../engine/questions';
import { DETECTIVE_SENTENCES } from '../data/detective';
import { DICTATIONS, SHORT_DICTATIONS } from '../data/stories';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, SpeakBtn, pick } from '../ui/kit';
import { Mascot } from '../ui/Mascot';

const SENTENCES = [
  ...DETECTIVE_SENTENCES,
  ...[...SHORT_DICTATIONS, ...DICTATIONS].flatMap((d) => d.sentences.map((s) => ({ s, g: d.band === 1 ? 1 : d.band === 2 ? 3 : 5 }))),
];

/**
 * "Mistake detective" – proofreading, the way it is done for real: a whole sentence hides one
 * spelling mistake. Step 1: find the wrong word. Step 2: choose how it is really written.
 */
export function DetectiveGame({ skills, grade, rounds, report, finish }: GameProps) {
  const items = useMemo(() => detectiveItems(skills, grade, rounds, SENTENCES), [skills, grade, rounds]);
  const [i, setI] = useState(0);
  const [found, setFound] = useState<null | number>(null); // the word the child tapped
  const [fixed, setFixed] = useState<null | string>(null);
  const [score, setScore] = useState(0);
  const it = items[i];
  useSayQuestion(it?.sentence, 0.85);
  if (!it) return null;

  const next = (ok: boolean) =>
    setTimeout(
      () => {
        setFound(null);
        setFixed(null);
        if (i + 1 >= items.length) finish(score + (ok ? 1 : 0), items.length);
        else setI(i + 1);
      },
      ok ? 1500 : 2800,
    );

  const tapWord = (k: number) => {
    if (found !== null) return;
    setFound(k);
    if (k === it.bad) {
      sfx('pop');
      speak('מצאתם! עכשיו בחרו איך כותבים נכון.');
    } else {
      // tapped a word that was fine: show the hidden mistake and move on
      sfx('bad');
      report(it.skill, false, it.right, it.wrong);
      speak(`${pick(ENCOURAGE)}. כותבים ${it.right}`);
      next(false);
    }
  };

  const choose = (opt: string) => {
    if (fixed) return;
    setFixed(opt);
    const ok = opt === it.right;
    report(it.skill, ok, it.right, ok ? it.right : opt);
    if (ok) {
      sfx('good');
      setScore((s) => s + 1);
      speak(pick(PRAISE));
    } else {
      sfx('bad');
      speak(`${pick(ENCOURAGE)}. כותבים ${it.right}`);
    }
    next(ok);
  };

  const missed = found !== null && found !== it.bad;
  const showRight = missed || fixed !== null;

  return (
    <GameShell game="detective" title="🔍 בלש הטעויות" done={i} total={items.length} instruction="במשפט מסתתרת מילה אחת עם טעות. מצאו אותה ותקנו!">
      <div className="center" key={i} style={{ gap: 12, animation: 'screenIn .35s' }}>
        <Mascot size={80} mood={fixed === null && !missed ? 'think' : fixed === it.right ? 'happy' : 'wow'} cheer={fixed === it.right} />
        <div className="card center" style={{ width: '100%', gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
            <b>{found === null ? '🔍 איזו מילה כתובה עם טעות?' : found === it.bad && !fixed ? '✏️ איך כותבים אותה נכון?' : ''}</b>
            <SpeakBtn text={it.sentence} small />
          </div>
          <div dir="rtl" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {it.words.map((w, k) => {
              const isBad = k === it.bad;
              const shownWord = isBad && showRight ? it.right + w.slice(it.wrong.length) : w;
              return (
                <button
                  key={k}
                  className="btn white"
                  onClick={() => tapWord(k)}
                  style={{
                    fontFamily: 'var(--script)',
                    fontSize: 30,
                    padding: '6px 12px',
                    background: found === k && !isBad ? '#ffe3e3' : isBad && found !== null ? (showRight ? '#d3f9d8' : '#fff3bf') : undefined,
                    textDecoration: isBad && found !== null && !showRight ? 'underline wavy var(--red)' : undefined,
                    animation: isBad && showRight ? 'pop .5s' : undefined,
                  }}
                >
                  {shownWord}
                </button>
              );
            })}
          </div>
        </div>
        {found === it.bad && (
          <div className="options">
            {it.options.map((opt) => (
              <button key={opt} className={`opt ${fixed === opt ? (opt === it.right ? 'good' : 'bad') : fixed && opt === it.right ? 'good' : ''}`} style={{ fontSize: 40, minWidth: 130 }} onClick={() => choose(opt)}>
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </GameShell>
  );
}

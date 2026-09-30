import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, showNikud, useSayQuestion } from './common';
import { mixedQuestions, shuffle } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { Mascot } from '../ui/Mascot';
import { PRAISE, SpeakBtn, pick } from '../ui/kit';

/** "Right or wrong?" – the owl shows a spelling, the child decides if it is correct. */
export function TrueFalseGame({ skills, grade, rounds, report, finish }: GameProps) {
  const items = useMemo(() => {
    const qs = mixedQuestions(skills, grade, Math.ceil(rounds / skills.length), 'choose', true).slice(0, rounds);
    return qs.map((q) => {
      const wrongs = q.kind === 'sentence' ? [q.options.find((o) => o !== q.answer)!] : q.options.filter((o) => o !== q.answer);
      const showWrong = Math.random() < 0.5 && wrongs.length > 0;
      const shown = showWrong ? shuffle(wrongs)[0] : q.answer;
      const text = q.kind === 'sentence' ? q.display.replace('___', shown) : shown;
      const correctText = q.kind === 'sentence' ? q.display.replace('___', q.answer) : q.answer;
      return { q, shown, text, correctText, isRight: !showWrong };
    });
  }, [skills, grade, rounds]);
  const [i, setI] = useState(0);
  const [result, setResult] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const it = items[i];
  useSayQuestion(it?.q.say);
  if (!it) return null;

  const answer = (saysRight: boolean) => {
    if (result !== null) return;
    const ok = saysRight === it.isRight;
    setResult(ok);
    report(it.q.skill, ok, it.q.answer, saysRight ? it.shown : it.q.answer);
    if (ok) {
      sfx('good');
      setScore((s) => s + 1);
      speak(pick(PRAISE));
    } else {
      sfx('bad');
      speak(it.isRight ? 'דווקא זה היה נכון!' : `אופס, כאן יש טעות. כותבים כך`);
    }
    setTimeout(() => {
      setResult(null);
      if (i + 1 >= items.length) finish(score + (ok ? 1 : 0), items.length);
      else setI(i + 1);
    }, ok ? 1100 : 2400);
  };

  return (
    <GameShell game="truefalse" title="✅ נכון או לא?" done={i} total={items.length} instruction="האם המילה כתובה נכון? לחצו וי או איקס">
      <div className="center" key={i} style={{ gap: 12, animation: 'screenIn .35s' }}>
        <Mascot size={90} mood={result === null ? 'think' : result ? 'happy' : 'wow'} cheer={result === true} />
        <div className="card center" style={{ width: '100%', gap: 8 }}>
          <div className="row">
            {it.q.emoji && <span style={{ fontSize: 44 }}>{it.q.emoji}</span>}
            <SpeakBtn text={it.q.say} small />
          </div>
          <div className="word-big" style={{ fontSize: it.q.kind === 'sentence' ? 36 : 64, textDecoration: result !== null && !it.isRight ? 'line-through wavy var(--red)' : undefined }}>
            {it.text}
          </div>
          {result !== null && !it.isRight && (
            <div className="word-big" style={{ fontSize: it.q.kind === 'sentence' ? 36 : 60, color: 'var(--green)', animation: 'pop .5s' }}>
              {it.correctText}
            </div>
          )}
          {showNikud(grade) && it.q.nikud && result !== null && <div className="nikud-hint">{it.q.nikud}</div>}
        </div>
        <div className="row" style={{ gap: 24 }}>
          <button className="btn green big" style={{ fontSize: 40, width: 120 }} onClick={() => answer(true)}>
            ✔
          </button>
          <button className="btn pink big" style={{ fontSize: 40, width: 120 }} onClick={() => answer(false)}>
            ✖
          </button>
        </div>
      </div>
    </GameShell>
  );
}

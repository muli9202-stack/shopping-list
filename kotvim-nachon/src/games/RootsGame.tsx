import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, QuestionPrompt, useSayQuestion } from './common';
import { rootItems } from '../engine/roots';
import { familyOf, showRoot } from '../data/roots';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, pick } from '../ui/kit';
import { Mascot } from '../ui/Mascot';

/** "The root tree": find a word's root, find its family, then spell with the family's help. */
export function RootsGame({ grade, rounds, report, finish }: GameProps) {
  const items = useMemo(() => rootItems(grade, rounds), [grade, rounds]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const it = items[i];
  const prompt = !it ? undefined : it.kind === 'root' ? `מה השורש של המילה ${it.word}?` : it.kind === 'family' ? `איזו מילה מאותה משפחה כמו ${it.word}?` : it.q.say;
  useSayQuestion(prompt, 0.85);
  if (!it) return null;

  const answer = it.kind === 'spell' ? it.q.answer : it.answer;
  const options = it.kind === 'spell' ? it.q.options : it.options;
  const word = it.kind === 'spell' ? it.q.word : it.word;

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const ok = opt === answer;
    report('roots', ok, word, it.kind === 'spell' ? it.q.display.replace('_', opt) : opt);
    if (ok) {
      sfx('good');
      setScore((s) => s + 1);
      speak(pick(PRAISE));
    } else {
      sfx('bad');
      const fam = familyOf(word);
      speak(it.kind === 'spell' ? `${pick(ENCOURAGE)}. כותבים ${it.q.say}` : fam ? `${pick(ENCOURAGE)}. ${fam.words.join(', ')}` : pick(ENCOURAGE));
    }
    setTimeout(
      () => {
        setPicked(null);
        if (i + 1 >= items.length) finish(score + (ok ? 1 : 0), items.length);
        else setI(i + 1);
      },
      ok ? 1300 : 2800,
    );
  };

  const fam = familyOf(word);
  return (
    <GameShell game="roots" title="🌳 עץ השורשים" done={i} total={items.length} instruction="מוצאים שורש, מוצאים משפחה, וכותבים נכון בעזרת המשפחה">
      <div className="center" key={i} style={{ gap: 12, animation: 'screenIn .35s' }}>
        <Mascot size={70} mood={picked ? (picked === answer ? 'happy' : 'wow') : 'think'} cheer={picked === answer} />
        {it.kind === 'spell' ? (
          <>
            <QuestionPrompt q={it.q} grade={grade} fill={picked ? it.q.answer : null} />
            {it.hint && (
              <div className="card center" style={{ background: '#f8f0fc' }}>
                🌳 רמז מהמשפחה: <b style={{ fontFamily: 'var(--script)', fontSize: 30 }}>{it.hint}</b>
              </div>
            )}
          </>
        ) : (
          <div className="card center" style={{ width: '100%', gap: 6 }}>
            <b>{it.kind === 'root' ? '🌳 מה השורש של המילה?' : '👨‍👩‍👧 איזו מילה מאותה משפחה?'}</b>
            <div className="word-big" style={{ fontSize: 60 }}>
              {it.word}
            </div>
          </div>
        )}
        <div className="options">
          {options.map((opt) => (
            <button key={opt} className={`opt ${picked === opt ? (opt === answer ? 'good' : 'bad') : picked && opt === answer ? 'good' : ''}`} style={{ fontSize: it.kind === 'root' ? 34 : 40, minWidth: 120 }} onClick={() => choose(opt)}>
              {opt}
            </button>
          ))}
        </div>
        {picked && fam && (
          <div className="card center" style={{ animation: 'pop .5s', background: '#f8f0fc' }}>
            <div className="small muted">המשפחה של השורש {showRoot(fam.root)}:</div>
            <div style={{ fontFamily: 'var(--script)', fontSize: 28 }}>{fam.words.join(' · ')}</div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

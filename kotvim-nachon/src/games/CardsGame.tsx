import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, QuestionPrompt } from './common';
import { mixedQuestions } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, pick } from '../ui/kit';

/** "Magic cards": option cards flip in with a 3D turn; pick the right letter or spelling. */
export function CardsGame({ skills, grade, rounds, report, finish }: GameProps) {
  const qs = useMemo(() => mixedQuestions(skills, grade, Math.ceil(rounds / skills.length), 'missing').slice(0, rounds), [skills, grade, rounds]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const q = qs[i];
  if (!q) return null;
  const right = picked === q.answer;

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const ok = opt === q.answer;
    report(q.skill, ok, q.word, q.kind === 'missing' ? q.display.replace('_', opt) : opt);
    if (ok) {
      sfx('good');
      speak(pick(PRAISE));
      setScore((s) => s + 1);
    } else {
      sfx('bad');
      speak(`${pick(ENCOURAGE)}. כותבים ${q.say}`);
    }
    setTimeout(() => {
      setPicked(null);
      if (i + 1 >= qs.length) finish(score + (ok ? 1 : 0), qs.length);
      else setI(i + 1);
    }, ok ? 1300 : 2300);
  };

  return (
    <GameShell game="cards" title="🃏 קלפי קסם" done={i} total={qs.length} instruction="בחרו את הקלף הנכון כדי להשלים את המילה">
      <div key={i} style={{ animation: 'screenIn .4s' }}>
        <QuestionPrompt q={q} grade={grade} fill={picked ? q.answer : null} />
        {picked && q.kind === 'choose' && (
          <div className="center word-big" style={{ color: 'var(--green)', fontSize: 56 }}>
            {q.answer}
          </div>
        )}
        <div className="options" style={{ perspective: 900 }}>
          {q.options.map((opt, k) => (
            <button
              key={opt}
              className={`opt ${picked === opt ? (right ? 'good' : 'bad') : picked && opt === q.answer ? 'good' : ''}`}
              style={{
                animation: `cardIn .6s ${k * 0.12}s both`,
                fontSize: q.kind === 'missing' ? 60 : 40,
                minWidth: q.kind === 'missing' ? 110 : 140,
              }}
              onClick={() => choose(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes cardIn{from{transform:rotateY(180deg) translateY(40px);opacity:0}}`}</style>
    </GameShell>
  );
}

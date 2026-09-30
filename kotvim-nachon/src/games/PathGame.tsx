import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, QuestionPrompt, fitFont, optionsFor, useRounds } from './common';
import { mixedQuestions } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, pick } from '../ui/kit';

const HEROES = ['🦊', '🐸', '🐼', '🦁', '🐧', '🐰'];

/** Stepping-stone bridge over a river (CSS 3D): jump on the stone with the right spelling. */
export function PathGame({ skills, grade, rounds, level = 2, report, finish }: GameProps) {
  const total = rounds + (level - 2) * 2;
  const qs = useMemo(() => mixedQuestions(skills, grade, Math.ceil(total / skills.length), 'choose').slice(0, total), [skills, grade, total]);
  const { i, locked, answer } = useRounds(qs.length, finish);
  const [sunk, setSunk] = useState<string | null>(null);
  const [hop, setHop] = useState(0);
  const [hero] = useState(() => HEROES[Math.floor(Math.random() * HEROES.length)]);
  const q = qs[i];
  const opts = useMemo(() => (q ? optionsFor(q, level) : []), [q, level]);
  if (!q) return null;

  const step = (o: string) => {
    if (locked) return;
    const ok = o === q.answer;
    report(q.skill, ok, q.word, q.kind === 'missing' ? q.display.replace('_', o) : o);
    if (ok) {
      setHop((h) => h + 1);
      sfx('good');
      speak(pick(PRAISE));
    } else {
      setSunk(o);
      sfx('bad');
      speak(`${pick(ENCOURAGE)}. כותבים ${q.say}`);
      setTimeout(() => setSunk(null), 1600);
    }
    answer(ok);
  };

  return (
    <GameShell game="path" title="🪨 גשר האבנים" done={i} total={qs.length}>
      <QuestionPrompt q={q} grade={grade} fill={locked && !sunk ? q.answer : null} />
      <div
        style={{
          perspective: 700,
          height: 300,
          borderRadius: 26,
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(#8ce99a 0 14%, #4dabf7 14% 86%, #8ce99a 86%)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateX(48deg)', transformOrigin: '50% 100%' }}>
          {/* ripples */}
          {[0, 1, 2, 3].map((k) => (
            <div key={k} style={{ position: 'absolute', left: `${10 + k * 22}%`, top: `${20 + (k % 2) * 30}%`, width: 60, height: 14, borderRadius: '50%', border: '3px solid rgba(255,255,255,.5)', animation: `floaty ${2 + k * 0.4}s infinite` }} />
          ))}
          <div className="row" style={{ position: 'absolute', top: '32%', left: 0, right: 0, justifyContent: 'center', gap: 34, flexWrap: 'wrap' }}>
            {opts.map((o) => (
              <button
                key={`${i}-${o}`}
                onClick={() => step(o)}
                style={{
                  width: 128,
                  height: 88,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'radial-gradient(circle at 40% 30%, #dee2e6, #868e96)',
                  boxShadow: '0 10px 0 #495057',
                  fontFamily: 'var(--script)',
                  fontSize: q.kind === 'missing' ? 52 : fitFont(o, 36, 20),
                  color: 'var(--ink)',
                  transition: 'transform .8s, opacity .8s',
                  transform: sunk === o ? 'translateY(60px) scale(.6)' : 'none',
                  opacity: sunk === o ? 0 : 1,
                  cursor: 'pointer',
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: `${8 + ((hop * 84) / Math.max(1, qs.length)) % 90}%`, fontSize: 52, transition: 'left .6s', animation: locked && !sunk ? 'cheer .6s' : undefined }}>{hero}</div>
        <div style={{ position: 'absolute', top: 6, right: 12, fontSize: 40 }}>🏁</div>
      </div>
    </GameShell>
  );
}

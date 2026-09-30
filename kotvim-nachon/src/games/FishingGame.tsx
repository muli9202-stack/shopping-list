import { useEffect, useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, QuestionPrompt, useRounds } from './common';
import { mixedQuestions } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, pick } from '../ui/kit';

const FISH_COLORS = ['#ff922b', '#f06595', '#4dabf7', '#51cf66', '#fcc419', '#9775fa'];

/** Fishing: fish swim across the sea, each carrying a letter – catch the missing one. */
export function FishingGame({ skills, grade, rounds, level = 2, report, finish }: GameProps) {
  const qs = useMemo(
    () => mixedQuestions(skills, grade, Math.ceil(rounds / skills.length) + 2, 'missing').filter((q) => q.kind !== 'choose').slice(0, rounds),
    [skills, grade, rounds],
  );
  const { i, locked, answer } = useRounds(qs.length, finish);
  const [caught, setCaught] = useState<number | null>(null);
  const q = qs[i];
  const fish = useMemo(() => {
    if (!q) return [];
    const copies = level === 1 ? 1 : level === 2 ? 2 : 3;
    return Array.from({ length: q.options.length * copies }, (_, k) => ({
      id: k,
      letter: q.options[k % q.options.length],
      lane: k % 4,
      dur: (level === 3 ? 5 : level === 2 ? 7 : 9) + Math.random() * 3,
      delay: -Math.random() * 8,
      dir: k % 2 ? 1 : -1,
      color: FISH_COLORS[k % FISH_COLORS.length],
    }));
  }, [q, level]);
  useEffect(() => setCaught(null), [i]);
  if (!q) return <div className="card">אין מספיק מילים – ממשיכים!</div>;

  const hook = (f: (typeof fish)[number]) => {
    if (locked) return;
    const ok = f.letter === q.answer;
    report(q.skill, ok, q.word, q.kind === 'missing' ? q.display.replace('_', f.letter) : f.letter);
    if (ok) {
      setCaught(f.id);
      sfx('coin');
      speak(pick(PRAISE));
    } else {
      sfx('bad');
      speak(`${pick(ENCOURAGE)}. כותבים ${q.say}`);
    }
    answer(ok, ok ? 1400 : 1200);
  };

  return (
    <GameShell game="fishing" title="🎣 דיג המילים" done={i} total={qs.length}>
      <QuestionPrompt q={q} grade={grade} fill={locked ? q.answer : null} />
      <div style={{ position: 'relative', height: 300, borderRadius: 26, overflow: 'hidden', background: 'linear-gradient(#74c0fc, #1864ab)', boxShadow: 'var(--shadow)' }}>
        <style>{`@keyframes swimR{from{transform:translateX(-120px)}to{transform:translateX(520px)}}@keyframes swimL{from{transform:translateX(520px) scaleX(-1)}to{transform:translateX(-120px) scaleX(-1)}}`}</style>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <div key={k} style={{ position: 'absolute', bottom: 8 + (k % 3) * 6, left: `${k * 17}%`, width: 10, height: 40 + (k % 3) * 20, background: '#2f9e44', borderRadius: 8, transformOrigin: 'bottom', animation: `floaty ${2 + k * 0.3}s infinite` }} />
        ))}
        {fish.map((f) => (
          <button
            key={`${i}-${f.id}`}
            onClick={() => hook(f)}
            style={{
              position: 'absolute',
              top: 20 + f.lane * 64,
              left: 0,
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              animation: caught === f.id ? 'none' : `${f.dir > 0 ? 'swimR' : 'swimL'} ${f.dur}s linear ${f.delay}s infinite`,
              transition: 'transform .8s',
              transform: caught === f.id ? 'translate(200px,-260px) rotate(-30deg)' : undefined,
            }}
          >
            <svg width="110" height="60" viewBox="0 0 110 60" aria-hidden>
              <path d="M18 30 L0 12 L0 48 Z" fill={f.color} />
              <ellipse cx="60" cy="30" rx="44" ry="26" fill={f.color} />
              <circle cx="90" cy="24" r="5" fill="#fff" />
              <circle cx="91" cy="24" r="2.5" fill="#222" />
              <text x="58" y="44" textAnchor="middle" fontFamily="KtavYad" fontSize="36" fill="#fff" style={{ transform: f.dir < 0 && caught !== f.id ? 'scaleX(-1)' : undefined, transformOrigin: '58px 30px' }}>
                {f.letter}
              </text>
            </svg>
          </button>
        ))}
      </div>
    </GameShell>
  );
}

import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { BlankWord, GameShell, fitFont, optionsFor, useRounds } from './common';
import { mixedQuestions } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, SpeakBtn, pick } from '../ui/kit';

const CAR_COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66', '#cc5de8'];

/** Word train: pick the carriage with the missing letter (or the right word) and the train leaves the station. */
export function TrainGame({ skills, grade, rounds, level = 2, report, finish }: GameProps) {
  const qs = useMemo(() => mixedQuestions(skills, grade, Math.ceil(rounds / skills.length), 'missing').slice(0, rounds), [skills, grade, rounds]);
  const { i, locked, answer } = useRounds(qs.length, finish);
  const [picked, setPicked] = useState<string | null>(null);
  const q = qs[i];
  const opts = useMemo(() => (q ? optionsFor(q, level) : []), [q, level]);
  if (!q) return null;
  const ok = picked === q.answer;

  const choose = (o: string) => {
    if (locked) return;
    setPicked(o);
    const good = o === q.answer;
    report(q.skill, good, q.word, q.kind === 'missing' ? q.display.replace('_', o) : o);
    if (good) {
      sfx('win');
      speak(`${pick(PRAISE)} צ׳וּ צ׳וּ!`);
    } else {
      sfx('bad');
      speak(`${pick(ENCOURAGE)}. כותבים ${q.say}`);
    }
    setTimeout(() => setPicked(null), good ? 1500 : 2200);
    answer(good, good ? 1600 : 2300);
  };

  return (
    <GameShell game="train" title="🚂 רכבת המילים" done={i} total={qs.length}>
      <div className="card center" style={{ gap: 6, marginBottom: 12 }}>
        <div className="row">
          {q.emoji && <span style={{ fontSize: 44 }}>{q.emoji}</span>}
          <SpeakBtn text={q.say} small />
        </div>
        {q.kind === 'missing' ? <BlankWord text={q.display} fill={ok ? q.answer : null} size={60} /> : <div className="muted">איזה קרון כתוב נכון?</div>}
      </div>
      <div style={{ position: 'relative', height: 150, overflow: 'hidden', borderRadius: 20, background: 'linear-gradient(#e7f5ff 70%, #ced4da 70%)' }}>
        <div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, height: 6, background: '#868e96' }} />
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            right: 10,
            display: 'flex',
            direction: 'rtl',
            gap: 4,
            transition: 'transform 1.2s ease-in',
            transform: ok ? 'translateX(-420px)' : 'none',
          }}
        >
          <span style={{ fontSize: 64 }}>🚂</span>
          {ok && (
            <div style={{ background: CAR_COLORS[i % CAR_COLORS.length], borderRadius: 12, padding: '4px 14px', fontFamily: 'var(--script)', fontSize: 40, color: '#fff', alignSelf: 'flex-end' }}>{q.answer}</div>
          )}
        </div>
        {ok && <div style={{ position: 'absolute', top: 10, right: 60, fontSize: 30, animation: 'floaty .6s infinite' }}>💨</div>}
      </div>
      <div className="options" style={{ marginTop: 14 }}>
        {opts.map((o, k) => (
          <button
            key={o}
            onClick={() => choose(o)}
            className={`opt ${picked === o ? (ok ? 'good' : 'bad') : ''}`}
            style={{ background: CAR_COLORS[k % CAR_COLORS.length], color: '#fff', borderRadius: 14, fontSize: q.kind === 'missing' ? 52 : fitFont(o, 36, 20), boxShadow: '0 6px 0 rgba(0,0,0,.25)' }}
          >
            {o}
          </button>
        ))}
      </div>
    </GameShell>
  );
}

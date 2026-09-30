import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, fitFont } from './common';
import { mixedQuestions } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { PRAISE, pick } from '../ui/kit';
import type { SkillId } from '../types';

interface Pop {
  hole: number;
  text: string;
  right: string;
  ok: boolean;
  skill: SkillId;
  id: number;
}

/** Whack-a-bunny: bunnies pop out of holes holding words – tap only the ones spelled correctly. */
export function WhackGame({ skills, grade, level = 2, report, finish }: GameProps) {
  const seconds = level === 1 ? 35 : level === 2 ? 40 : 45;
  const showMs = level === 1 ? 2600 : level === 2 ? 2000 : 1500;
  const pool = useMemo(() => mixedQuestions(skills, grade, 12, 'choose', true).filter((q) => q.kind === 'choose'), [skills, grade]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [time, setTime] = useState(seconds);
  const [hits, setHits] = useState<Record<number, 'good' | 'bad'>>({});
  const stats = useRef({ good: 0, total: 0 });
  const nextId = useRef(0);
  const ended = useRef(false);

  useEffect(() => {
    const spawn = setInterval(() => {
      if (!pool.length) return;
      const q = pool[Math.floor(Math.random() * pool.length)];
      const ok = Math.random() < 0.5;
      const wrong = q.options.find((o) => o !== q.answer) ?? q.answer;
      setPops((ps) => {
        const free = [0, 1, 2, 3, 4, 5].filter((h) => !ps.some((p) => p.hole === h));
        if (!free.length) return ps;
        const hole = free[Math.floor(Math.random() * free.length)];
        const p: Pop = { hole, text: ok ? q.answer : wrong, right: q.answer, ok: ok || wrong === q.answer, skill: q.skill, id: nextId.current++ };
        setTimeout(() => setPops((cur) => cur.filter((x) => x.id !== p.id)), showMs);
        return [...ps, p];
      });
    }, showMs / 2);
    const clock = setInterval(() => setTime((t) => t - 1), 1000);
    return () => {
      clearInterval(spawn);
      clearInterval(clock);
    };
  }, [pool, showMs]);

  useEffect(() => {
    if (time <= 0 && !ended.current) {
      ended.current = true;
      speak('נגמר הזמן! כל הכבוד!');
      finish(stats.current.good, Math.max(stats.current.total, 1));
    }
  }, [time, finish]);

  const whack = (p: Pop) => {
    if (hits[p.id] || time <= 0) return;
    report(p.skill, p.ok, p.right, p.text);
    stats.current.total += 1;
    if (p.ok) {
      stats.current.good += 1;
      sfx('coin');
      if (stats.current.good % 4 === 0) speak(pick(PRAISE));
    } else {
      sfx('bad');
      speak(`זהירות! כותבים ${p.right}`);
    }
    setHits((h) => ({ ...h, [p.id]: p.ok ? 'good' : 'bad' }));
    setTimeout(() => setPops((cur) => cur.filter((x) => x.id !== p.id)), 450);
  };

  return (
    <GameShell game="whack" title="🐰 הקש בשפן" done={seconds - Math.max(0, time)} total={seconds}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="points-pill">⏱️ {Math.max(0, time)}</span>
        <span className="points-pill">✅ {stats.current.good}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: 'linear-gradient(#b2f2bb, #69db7c)', padding: 14, borderRadius: 26, boxShadow: 'var(--shadow)' }}>
        {[0, 1, 2, 3, 4, 5].map((h) => {
          const p = pops.find((x) => x.hole === h);
          const hit = p ? hits[p.id] : undefined;
          return (
            <div key={h} style={{ height: 130, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
              {p && (
                <button
                  onClick={() => whack(p)}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: 26,
                    transform: `translateX(-50%) ${hit ? 'scale(.85)' : ''}`,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    animation: 'popUp .25s ease-out',
                    padding: 0,
                  }}
                >
                  <div style={{ fontSize: 44, lineHeight: 1 }}>{hit === 'good' ? '😵' : hit === 'bad' ? '😜' : '🐰'}</div>
                  <div
                    style={{
                      background: hit === 'good' ? '#d3f9d8' : hit === 'bad' ? '#ffe3e3' : '#fff',
                      borderRadius: 12,
                      padding: '2px 8px',
                      fontFamily: 'var(--script)',
                      fontSize: fitFont(p.text, 28, 16),
                      boxShadow: '0 3px 0 rgba(0,0,0,.15)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.text}
                  </div>
                </button>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 34, borderRadius: '50%', background: '#5c3d2e', boxShadow: 'inset 0 6px 0 rgba(0,0,0,.35)' }} />
            </div>
          );
        })}
      </div>
      <style>{`@keyframes popUp{from{transform:translate(-50%,80px)}}`}</style>
    </GameShell>
  );
}

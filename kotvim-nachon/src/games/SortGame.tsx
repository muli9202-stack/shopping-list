import { useMemo, useRef, useState } from 'react';
import type { GameProps } from './common';
import { BlankWord, GameShell, showNikud } from './common';
import { mixedQuestions } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { PRAISE, SpeakBtn, pick } from '../ui/kit';
import type { Question } from '../types';
import { CardsGame } from './CardsGame';

/** Sorting baskets: drag (or tap) each word into the basket of the missing letter / word. */
export function SortGame({ skills, grade, rounds, report, finish }: GameProps) {
  const qs = useMemo(() => {
    const all = mixedQuestions(skills, grade, rounds * 2, 'missing').filter((q) => q.kind !== 'choose' && q.options.length === 2);
    // keep the two most common option pairs so both baskets stay the same through the game
    const key = (q: Question) => q.options.slice().sort().join('|');
    const counts = new Map<string, number>();
    all.forEach((q) => counts.set(key(q), (counts.get(key(q)) ?? 0) + 1));
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return all.filter((q) => key(q) === best).slice(0, rounds);
  }, [skills, grade, rounds]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [hot, setHot] = useState<string | null>(null);
  const [flash, setFlash] = useState<null | { bin: string; ok: boolean }>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const binRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const q = qs[i];
  if (!q || qs.length < 3) return <CardsGame skills={skills} grade={grade} rounds={rounds} report={report} finish={finish} />;
  const bins = q.options.slice().sort();
  const colors = ['#3a86ff', '#ff5d8f'];

  const drop = (bin: string) => {
    if (flash) return;
    const ok = bin === q.answer;
    setFlash({ bin, ok });
    report(q.skill, ok, q.word, q.kind === 'missing' ? q.display.replace('_', bin) : bin);
    if (ok) {
      sfx('coin');
      speak(pick(PRAISE));
      setScore((s) => s + 1);
    } else {
      sfx('bad');
      speak(`לא, כותבים ${q.say}`);
    }
    setTimeout(() => {
      setFlash(null);
      if (i + 1 >= qs.length) finish(score + (ok ? 1 : 0), qs.length);
      else setI(i + 1);
    }, ok ? 1000 : 2200);
  };

  const binAt = (x: number, y: number) =>
    bins.find((b) => {
      const r = binRefs.current[b]?.getBoundingClientRect();
      return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }) ?? null;

  return (
    <GameShell title="🧺 סלסלות" done={i} total={qs.length} instruction="גררו את המילה לסל הנכון, או לחצו על הסל">
      <div
        key={i}
        className="card center"
        style={{
          touchAction: 'none',
          transform: drag ? `translate(${drag.x}px, ${drag.y}px) rotate(-4deg)` : undefined,
          transition: drag ? 'none' : 'transform .3s',
          zIndex: 5,
          position: 'relative',
          animation: 'screenIn .35s',
        }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          const sx = e.clientX;
          const sy = e.clientY;
          const move = (ev: PointerEvent) => {
            setDrag({ x: ev.clientX - sx, y: ev.clientY - sy });
            setHot(binAt(ev.clientX, ev.clientY));
          };
          const up = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            const b = binAt(ev.clientX, ev.clientY);
            setDrag(null);
            setHot(null);
            if (b) drop(b);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      >
        <div className="row">
          {q.emoji && <span style={{ fontSize: 44 }}>{q.emoji}</span>}
          <SpeakBtn text={q.say} small />
        </div>
        {q.kind === 'missing' ? (
          <BlankWord text={q.display} fill={flash?.ok ? q.answer : null} size={60} />
        ) : (
          <div className="script" style={{ fontSize: 34 }}>
            {q.display.replace('___', flash?.ok ? q.answer : '____')}
          </div>
        )}
        {showNikud(grade) && q.nikud && flash && <div className="nikud-hint">{q.nikud}</div>}
      </div>
      <div className="row" style={{ marginTop: 26, gap: 16 }}>
        {bins.map((b, k) => (
          <div
            key={b}
            ref={(el) => {
              binRefs.current[b] = el;
            }}
            className={`bin ${hot === b ? 'hot' : ''}`}
            style={{
              borderColor: colors[k],
              background: flash?.bin === b ? (flash.ok ? '#d3f9d8' : '#ffe3e3') : `${colors[k]}18`,
            }}
            onClick={() => drop(b)}
          >
            <span style={{ fontSize: 44 }}>🧺</span>
            <span className="script" style={{ fontSize: 64, color: colors[k] }}>
              {b}
            </span>
          </div>
        ))}
      </div>
    </GameShell>
  );
}

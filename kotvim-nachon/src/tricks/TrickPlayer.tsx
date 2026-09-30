import { useEffect, useRef, useState } from 'react';
import type { SkillId } from '../types';
import { TRICKS, type TrickVisual } from './tricks';
import { speak, stop } from '../services/tts';
import { confetti, sfx } from '../ui/effects';
import { Mascot } from '../ui/Mascot';
import { SKILL_BY_ID } from '../data/skills';

/** Plays a trick as a short narrated animation ("video"), step by step. */
export function TrickPlayer({ skill, onDone, compact }: { skill: SkillId; onDone: () => void; compact?: boolean }) {
  const trick = TRICKS[skill];
  const [step, setStep] = useState(0);
  const [handsDone, setHandsDone] = useState(false);
  const s = trick.steps[step];
  const color = SKILL_BY_ID[skill].color;
  const last = step === trick.steps.length - 1;
  const needsHands = s.visual.kind === 'hands' && !handsDone;

  useEffect(() => {
    speak(s.say, { force: true, rate: 0.9 });
    return () => stop();
  }, [s]);

  return (
    <div className="center" style={{ gap: 12 }}>
      <div className="row" style={{ width: '100%' }}>
        {trick.steps.map((_, k) => (
          <div key={k} className="grow" style={{ height: 8, borderRadius: 8, background: k <= step ? color : '#dee2e6', transition: 'background .3s' }} />
        ))}
      </div>
      <div
        key={step}
        className="card center"
        style={{ width: '100%', minHeight: compact ? 230 : 300, justifyContent: 'center', gap: 10, background: `linear-gradient(160deg, #fff, ${color}22)`, animation: 'screenIn .45s' }}
      >
        <Visual v={s.visual} color={color} onHands={() => setHandsDone(true)} />
        <div style={{ fontSize: 22, fontWeight: 700, color }}>{s.caption}</div>
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Mascot size={70} cheer={last} />
        <div className="bubble small" style={{ maxWidth: 260 }}>
          {s.say}
        </div>
      </div>
      <div className="row">
        {step > 0 && (
          <button className="btn white" onClick={() => setStep(step - 1)}>
            ➡️
          </button>
        )}
        <button className="btn white" onClick={() => speak(s.say, { force: true, rate: 0.85 })}>
          🔊
        </button>
        <button
          className="btn green big"
          disabled={needsHands}
          onClick={() => {
            sfx('pop');
            if (last) {
              confetti(80);
              onDone();
            } else setStep(step + 1);
          }}
        >
          {last ? 'הבנתי! 🎉' : 'הבא ⬅️'}
        </button>
      </div>
    </div>
  );
}

function Visual({ v, color, onHands }: { v: TrickVisual; color: string; onHands: () => void }) {
  switch (v.kind) {
    case 'text':
      return (
        <div className="center">
          {v.emoji && <div style={{ fontSize: 56, animation: 'floaty 2s infinite' }}>{v.emoji}</div>}
          <div className="word-big" style={{ color: v.color ?? color, animation: 'pop 1s' }}>
            {v.big}
          </div>
        </div>
      );
    case 'compare':
      return (
        <div className="row" style={{ gap: 28 }}>
          {[v.left, v.right].map((x, k) => (
            <div key={k} className="center" style={{ animation: `cardIn2 .7s ${k * 0.3}s both` }}>
              <span style={{ fontSize: 48 }}>{x.e}</span>
              <span className="word-big" style={{ fontSize: 76, color: k ? color : 'var(--ink)' }}>
                {x.w}
              </span>
            </div>
          ))}
          <style>{`@keyframes cardIn2{from{transform:rotateY(90deg) scale(.5);opacity:0}}`}</style>
        </div>
      );
    case 'morph':
      return <Morph from={v.from} to={v.to} emoji={v.emoji} color={color} />;
    case 'list':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {v.items.map((it, k) => (
            <div key={k} className="card center" style={{ padding: '8px 14px', animation: `popIn .5s ${k * 0.25}s both` }}>
              {it.e && <span style={{ fontSize: 34 }}>{it.e}</span>}
              <span className="script" style={{ fontSize: 40 }}>
                {it.mark === undefined
                  ? it.w
                  : it.w.split('').map((ch, j) => (
                      <span key={j} style={j === it.mark ? { color, textShadow: `0 0 12px ${color}88`, fontWeight: 700 } : undefined}>
                        {ch}
                      </span>
                    ))}
              </span>
            </div>
          ))}
        </div>
      );
    case 'family':
      return (
        <div className="center" style={{ gap: 6 }}>
          <div style={{ fontSize: 30 }}>🌳</div>
          <div className="word-big" style={{ fontSize: 56, color, animation: 'pop 1s' }}>
            {v.root}
          </div>
          <svg width="260" height="36" aria-hidden>
            <path d="M130 0 L40 36 M130 0 L130 36 M130 0 L220 36" stroke={color} strokeWidth="4" strokeDasharray="6 6">
              <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite" />
            </path>
          </svg>
          <div className="row" style={{ gap: 14 }}>
            {v.kids.map((k, j) => (
              <span key={k} className="script card" style={{ fontSize: 30, padding: '6px 12px', animation: `popIn .5s ${0.4 + j * 0.3}s both` }}>
                {k}
              </span>
            ))}
          </div>
        </div>
      );
    case 'hands':
      return <HandsTrick onDone={onHands} />;
    case 'eyes':
      return (
        <svg viewBox="0 0 200 160" width="220" height="176" aria-hidden>
          <text x="100" y="140" textAnchor="middle" fontFamily="KtavYad" fontSize="150" fill={color}>
            ע
          </text>
          {[62, 132].map((x) => (
            <g key={x}>
              <circle cx={x} cy="30" r="17" fill="#fff" stroke="#2b2d42" strokeWidth="3" />
              <circle cx={x} cy="32" r="8" fill="#2b2d42">
                <animate attributeName="cx" values={`${x - 5};${x + 5};${x - 5}`} dur="2s" repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>
      );
    case 'train':
      return <Train cars={v.cars} word={v.word} color={color} />;
    case 'finals':
      return <Finals color={color} />;
    case 'sinDot':
      return (
        <svg viewBox="0 0 220 170" width="220" height="170" aria-hidden>
          <text x="110" y="150" textAnchor="middle" fontFamily="Rubik, sans-serif" fontSize="140" fill="#2b2d42">
            ש
          </text>
          <circle r="11" fill={color} cy="18">
            <animate attributeName="cx" values="165;165;52;52" keyTimes="0;0.3;0.6;1" dur="3s" repeatCount="indefinite" />
          </circle>
          <text x="30" y="20" fontSize="22" fill={color}>
            ⬅ שמאל
          </text>
        </svg>
      );
  }
}

function Morph({ from, to, emoji, color }: { from: string; to: string; emoji?: string; color: string }) {
  const [shown, setShown] = useState(from);
  useEffect(() => {
    const a = setTimeout(() => setShown(to), 1400);
    return () => clearTimeout(a);
  }, [from, to]);
  return (
    <div className="center">
      {emoji && <div style={{ fontSize: 44 }}>{emoji}</div>}
      <div key={shown} className="word-big" style={{ color: shown === to ? color : 'var(--muted)', animation: 'pop .6s', textDecoration: shown === from && from !== to ? 'line-through' : undefined }}>
        {shown}
      </div>
    </div>
  );
}

function Train({ cars, word, color }: { cars: string[]; word: string; color: string }) {
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setJoined(true);
      sfx('coin');
    }, 1300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="center" style={{ gap: 6 }}>
      <div style={{ display: 'flex', gap: joined ? 0 : 30, transition: 'gap .8s cubic-bezier(.5,1.8,.5,1)', direction: 'rtl', alignItems: 'flex-end' }}>
        {cars.map((c, k) => (
          <div key={k} style={{ background: color, color: '#fff', borderRadius: 14, padding: '4px 12px', fontFamily: 'var(--script)', fontSize: 48 }}>
            {c}
          </div>
        ))}
        <div style={{ background: '#3a86ff', color: '#fff', borderRadius: 14, padding: '4px 12px', fontFamily: 'var(--script)', fontSize: 48 }}>{word}</div>
        <div style={{ fontSize: 48 }}>🚂</div>
      </div>
      {joined && (
        <div className="word-big" style={{ color, animation: 'pop .6s' }}>
          {cars.join('') + word}
        </div>
      )}
    </div>
  );
}

function Finals({ color }: { color: string }) {
  const pairs = [
    ['מ', 'ם'],
    ['נ', 'ן'],
    ['צ', 'ץ'],
    ['פ', 'ף'],
    ['כ', 'ך'],
  ];
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setOn((x) => !x), 1300);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="row" style={{ gap: 14 }}>
      {pairs.map(([a, b], k) => (
        <span key={k} className="word-big" style={{ fontSize: 64, color: on ? color : 'var(--ink)', transition: 'color .4s', display: 'inline-block', transform: on ? 'translateY(10px)' : 'none', transitionProperty: 'transform, color', transitionDuration: `.4s`, transitionDelay: `${k * 0.08}s` }}>
          {on ? b : a}
        </span>
      ))}
    </div>
  );
}

/** Interactive אם/עם trick: drag the two hands together – they join into the letter ע. */
function HandsTrick({ onDone }: { onDone: () => void }) {
  const [pos, setPos] = useState({ l: -90, r: 90 });
  const [joined, setJoined] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  const joinedRef = useRef(false);

  const drag = (side: 'l' | 'r') => (e: React.PointerEvent) => {
    if (joined) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const start = e.clientX;
    const base = posRef.current[side];
    const move = (ev: PointerEvent) => {
      if (joinedRef.current) return;
      const nx = base + (ev.clientX - start);
      const np = { ...posRef.current, [side]: side === 'l' ? Math.min(nx, -18) : Math.max(nx, 18) };
      posRef.current = np;
      setPos(np);
      if (np.r - np.l < 60) {
        joinedRef.current = true;
        setJoined(true);
        sfx('win');
        confetti(60);
        speak('וואו! הידיים התחברו ונוצרה האות ע. עם זה ביחד!', { force: true });
        onDone();
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div ref={box} style={{ position: 'relative', width: 280, height: 190, touchAction: 'none' }}>
      {!joined ? (
        <>
          <Hand x={pos.l} flip={false} onPointerDown={drag('l')} />
          <Hand x={pos.r} flip onPointerDown={drag('r')} />
          <div className="small muted" style={{ position: 'absolute', bottom: 0, width: '100%', textAlign: 'center' }}>
            👆 גררו את הידיים זו אל זו
          </div>
        </>
      ) : (
        <svg viewBox="0 0 280 190" width="280" height="190" aria-hidden>
          <path d="M70 30 Q90 120 150 150" stroke="#f4a261" strokeWidth="26" strokeLinecap="round" fill="none">
            <animate attributeName="stroke" from="#f4a261" to="#7950f2" dur="1s" fill="freeze" />
          </path>
          <path d="M200 30 Q185 110 120 170" stroke="#e9c46a" strokeWidth="26" strokeLinecap="round" fill="none">
            <animate attributeName="stroke" from="#e9c46a" to="#7950f2" dur="1s" fill="freeze" />
          </path>
          <circle cx="70" cy="30" r="17" fill="#fff" stroke="#7950f2" strokeWidth="4" />
          <circle cx="200" cy="30" r="17" fill="#fff" stroke="#7950f2" strokeWidth="4" />
          <text x="140" y="120" textAnchor="middle" fontSize="0" fontFamily="KtavYad" fill="#7950f2">
            ע
            <animate attributeName="font-size" from="0" to="120" begin="0.8s" dur="0.6s" fill="freeze" />
          </text>
        </svg>
      )}
    </div>
  );
}

function Hand({ x, flip, onPointerDown }: { x: number; flip: boolean; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        top: 20,
        left: `calc(50% + ${x}px - 45px)`,
        width: 90,
        height: 140,
        cursor: 'grab',
        transform: flip ? 'scaleX(-1)' : undefined,
        touchAction: 'none',
      }}
    >
      <svg viewBox="0 0 90 140" width="90" height="140" aria-hidden>
        <path d="M30 135 Q20 80 25 40" stroke={flip ? '#e9c46a' : '#f4a261'} strokeWidth="24" strokeLinecap="round" fill="none" />
        <circle cx="26" cy="30" r="18" fill="#fff" stroke="#2b2d42" strokeWidth="3" />
        <circle cx="30" cy="30" r="7" fill="#2b2d42" />
        <text x="55" y="100" fontSize="30">
          {flip ? '✋' : '🤚'}
        </text>
      </svg>
    </div>
  );
}

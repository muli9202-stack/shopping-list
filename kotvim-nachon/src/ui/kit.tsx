import { useEffect, useRef, useState, type ReactNode } from 'react';
import { speak } from '../services/tts';
import { useNav } from '../nav';
import { speakGuide } from './guide';
import { useActiveChild } from '../store';
export { PRAISE, ENCOURAGE } from '../data/phrases';

/** Speak `text` once when the screen/component mounts (voice guidance). */
export function useSpeakOnMount(text: string | null | undefined, deps: unknown[] = []) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => speak(text), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function SpeakBtn({ text, force = true, small }: { text: string; force?: boolean; small?: boolean }) {
  return (
    <button
      className="icon-btn"
      style={small ? { width: 40, height: 40, fontSize: 20 } : undefined}
      aria-label="השמעה"
      onClick={(e) => {
        e.stopPropagation();
        speak(text, { force });
      }}
    >
      🔊
    </button>
  );
}

export function TopBar({ title, onBack, right, guide }: { title?: string; onBack?: () => void; right?: ReactNode; guide?: string }) {
  const back = useNav((s) => s.back);
  const child = useActiveChild();
  return (
    <div className="topbar">
      <button className="icon-btn" aria-label="חזרה" onClick={onBack ?? back}>
        ➡️
      </button>
      <div className="title">{title}</div>
      {guide && <HelpBtn guide={guide} />}
      {right ?? (child ? <PointsPill points={child.points} /> : <span style={{ width: 52 }} />)}
    </div>
  );
}

/** ❓ – reads the full explanation of the current screen or game again. */
export function HelpBtn({ guide }: { guide: string }) {
  return (
    <button className="icon-btn" aria-label="הסבר" style={{ width: 44, height: 44, fontSize: 22 }} onClick={() => speakGuide(guide)}>
      ❓
    </button>
  );
}

export function PointsPill({ points }: { points: number }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(points);
  useEffect(() => {
    if (points !== prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 500);
      prev.current = points;
      return () => clearTimeout(t);
    }
  }, [points]);
  return (
    <span className={`points-pill ${bump ? 'bump' : ''}`}>
      ⭐ <span>{points}</span>
    </span>
  );
}

/** A word in handwriting font, with an optional printed-with-nikud line underneath for young readers. */
export function Word({ word, nikud, size = 64, showNikud }: { word: string; nikud?: string; size?: number; showNikud?: boolean }) {
  return (
    <div className="center">
      <div className="word-big" style={{ fontSize: size }}>
        {word}
      </div>
      {showNikud && nikud && <div className="nikud-hint">{nikud}</div>}
    </div>
  );
}

/** Render a word with "_" as an animated blank. */
export function Blanked({ text, size = 64, fill }: { text: string; size?: number; fill?: string | null }) {
  const parts = text.split('_');
  return (
    <div className="word-big" style={{ fontSize: size }}>
      {parts[0]}
      {parts.length > 1 &&
        (fill ? (
          <span style={{ color: 'var(--green)' }}>{fill}</span>
        ) : (
          <span className="blank">א</span>
        ))}
      {parts[1]}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} style={{ opacity: i < n ? 1 : 0.25 }}>
          ⭐
        </span>
      ))}
    </span>
  );
}

export function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

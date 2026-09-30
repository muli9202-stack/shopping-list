import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SpeakBtn } from '../ui/kit';
import type { GameId, Question, SkillId, Level } from '../types';
import { HelpBtn, Progress } from '../ui/kit';
import { speak } from '../services/tts';
import { GUIDES, isFirstTime, speakGuide } from '../ui/guide';
import { isVisualOnly } from '../engine/questions';

/** Resolves when the current game explanation has finished, so the first question is not spoken over it. */
let guideDone: Promise<void> = Promise.resolve();
export function afterGuide(): Promise<void> {
  return guideDone;
}
/** Make the next question wait until something else (e.g. a tip) has been said. */
export function waitBeforeNextQuestion(p: Promise<void>) {
  guideDone = p;
}

export interface GameProps {
  /** skills practised in this game (one for a regular world, several for review) */
  skills: SkillId[];
  grade: number;
  rounds: number;
  /** difficulty 1-4: more options, faster movement, harder words */
  level?: Level;
  /** report every answer – feeds the mistake map */
  report: (skill: SkillId, correct: boolean, expected: string, typed: string) => void;
  finish: (correct: number, total: number) => void;
}

export function showNikud(grade: number) {
  return grade <= 2;
}

export function GameShell({ title, done, total, game, children }: { title: string; done: number; total: number; game: GameId; instruction?: string; children: ReactNode }) {
  const key = `game:${game}`;
  const [first] = useState(() => isFirstTime(key));
  const [hand, setHand] = useState(first);
  useEffect(() => {
    // first time: the full "how to play" explanation and a pointing hand; later just a short reminder
    const g = GUIDES[key];
    if (g) {
      guideDone = new Promise((resolve) => {
        setTimeout(() => {
          (first ? speakGuide(key) : speak(g.short)).then(resolve);
          try {
            localStorage.setItem(`kn-guide-${key}`, '1');
          } catch {
            // ignore
          }
        }, 300);
      });
    }
    const t = setTimeout(() => setHand(false), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: 'relative' }} onPointerDown={() => hand && setHand(false)}>
      <div className="row" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 20 }}>{title}</b>
        <div className="grow">
          <Progress value={done / total} />
        </div>
        <HelpBtn guide={key} />
      </div>
      {isVisualOnly() && (
        <div className="small" style={{ background: '#fff3bf', borderRadius: 14, padding: '6px 10px', marginBottom: 8 }}>
          🔇 במכשיר הזה אין קול בעברית, אז משחקים עם תמונות ומילים שרואים.
        </div>
      )}
      {children}
      {hand && (
        <div className="tutorial-hand" aria-hidden>
          👆
        </div>
      )}
    </div>
  );
}

/** Read the current word/sentence aloud (after the game explanation, if one is playing). */
export function useSayQuestion(text: string | undefined, rate = 0.8) {
  useEffect(() => {
    if (!text) return;
    let alive = true;
    afterGuide().then(() => setTimeout(() => alive && speak(text, { force: true, rate }), 300));
    return () => {
      alive = false;
    };
  }, [text, rate]);
}

/** Prompt area for a question: emoji, "hear it" button and the word with a blank / the sentence. */
export function QuestionPrompt({ q, grade, fill }: { q: Question; grade: number; fill?: string | null }) {
  // the printed word with nikud would give the answer away – show it only once answered
  const nik = showNikud(grade) && q.nikud && fill;
  useEffect(() => {
    let alive = true;
    afterGuide().then(() => setTimeout(() => alive && speak(q.say, { force: true, rate: 0.8 }), 300));
    return () => {
      alive = false;
    };
  }, [q]);
  return (
    <div className="card center" style={{ gap: 6, marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'center' }}>
        {q.emoji && <span style={{ fontSize: 54 }}>{q.emoji}</span>}
        <SpeakBtn text={q.say} />
      </div>
      {q.kind === 'missing' ? (
        <BlankWord text={q.display} fill={fill} />
      ) : q.kind === 'sentence' ? (
        <div className="script" style={{ fontSize: 38, lineHeight: 1.5 }}>
          {q.display.split('___')[0]}
          {fill ? <span style={{ color: 'var(--green)' }}>{fill}</span> : <span className="blank">עם</span>}
          {q.display.split('___')[1]}
        </div>
      ) : (
        <div className="muted">איך כותבים את המילה?</div>
      )}
      {nik && q.kind !== 'sentence' && <div className="nikud-hint">{q.nikud}</div>}
    </div>
  );
}

export function BlankWord({ text, fill, size = 70 }: { text: string; fill?: string | null; size?: number }) {
  const [a, b] = text.split('_');
  return (
    <div className="word-big" style={{ fontSize: size }}>
      {a}
      {fill ? <span style={{ color: 'var(--green)' }}>{fill}</span> : <span className="blank">א</span>}
      {b}
    </div>
  );
}

const KB_ROWS = [
  ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
  ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
  ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ'],
];

/** Big on-screen Hebrew keyboard with handwriting-style keys. */
/** Standard Israeli layout: a physical keyboard left in English still types Hebrew letters. */
const LATIN_TO_HEBREW: Record<string, string> = {
  e: 'ק', r: 'ר', t: 'א', y: 'ט', u: 'ו', i: 'ן', o: 'ם', p: 'פ',
  a: 'ש', s: 'ד', d: 'ג', f: 'כ', g: 'ע', h: 'י', j: 'ח', k: 'ל', l: 'ך', ';': 'ף',
  z: 'ז', x: 'ס', c: 'ב', v: 'ה', b: 'נ', n: 'מ', m: 'צ',
};
const HEBREW_KEYS = new Set(KB_ROWS.flat());

/** Big on-screen Hebrew keyboard with handwriting-style keys. The computer's own keyboard works too. */
export function HebrewKeyboard({ onKey, onBack, onSpace, onEnter, punctuation }: { onKey: (k: string) => void; onBack: () => void; onSpace?: () => void; onEnter?: () => void; punctuation?: boolean }) {
  const [pressed, setPressed] = useState<string | null>(null);
  const key = (k: string) => {
    setPressed(k);
    setTimeout(() => setPressed(null), 120);
    onKey(k);
  };
  // the latest handlers, so the one window listener always calls the current ones
  const handlers = useRef({ key, onBack, onSpace, onEnter, punctuation });
  handlers.current = { key, onBack, onSpace, onEnter, punctuation };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const h = handlers.current;
      const k = e.key;
      let handled = true;
      if (HEBREW_KEYS.has(k)) h.key(k);
      else if (LATIN_TO_HEBREW[k.toLowerCase()]) h.key(LATIN_TO_HEBREW[k.toLowerCase()]);
      else if (k === 'Backspace') h.onBack();
      else if (k === ' ' && h.onSpace) h.onSpace();
      else if (k === 'Enter' && h.onEnter) h.onEnter();
      else if (h.punctuation && ['.', ',', '!', '?'].includes(k)) h.key(k);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <div style={{ background: '#e9ecef', borderRadius: 20, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }} dir="rtl">
      {KB_ROWS.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
          {row.map((k) => (
            <button
              key={k}
              onClick={() => key(k)}
              style={{
                flex: 1,
                maxWidth: 46,
                height: 54,
                borderRadius: 12,
                border: 'none',
                background: pressed === k ? '#ffd43b' : '#fff',
                boxShadow: '0 3px 0 rgba(0,0,0,.15)',
                fontFamily: 'var(--script)',
                fontSize: 30,
                padding: 0,
              }}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        {punctuation &&
          ['.', ',', '!', '?'].map((p) => (
            <button key={p} className="btn white" style={{ padding: '10px 12px', minWidth: 40 }} onClick={() => key(p)}>
              {p}
            </button>
          ))}
        {onEnter && (
          <button className="btn green" style={{ padding: '10px 18px' }} onClick={onEnter}>
            ✔️
          </button>
        )}
        {onSpace && (
          <button className="btn white grow" style={{ padding: 10 }} onClick={onSpace}>
            רווח
          </button>
        )}
        <button className="btn white" style={{ padding: '10px 18px' }} onClick={onBack}>
          ⌫
        </button>
      </div>
    </div>
  );
}

/** Wait for the handwriting font before drawing it onto canvases (three.js textures). */
export async function fontReady() {
  try {
    await Promise.all([document.fonts.load('64px KtavYad'), document.fonts.load('bold 64px KtavYad')]);
  } catch {
    // fall back to whatever is available
  }
}

/**
 * Writing area with the app's own keyboard. The phone keyboard is not used for writing tests:
 * its suggestions and auto-correct would fix the child's spelling and hide real mistakes.
 */
export function WriteBox({ value, onChange, onEnter, placeholder, minHeight = 110 }: { value: string; onChange: (v: string) => void; onEnter?: () => void; placeholder: string; minHeight?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="write-area" style={{ minHeight, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} aria-label={placeholder}>
        {value ? value : <span style={{ color: '#adb5bd', fontFamily: 'var(--ui)', fontSize: 20 }}>{placeholder}</span>}
        <span className="caret">|</span>
      </div>
      <HebrewKeyboard
        punctuation
        onKey={(k) => onChange((value + k).slice(0, 1200))}
        onBack={() => onChange(value.slice(0, -1))}
        onSpace={() => onChange(value.endsWith(' ') || !value ? value : value + ' ')}
        onEnter={onEnter}
      />
    </div>
  );
}

/**
 * Round bookkeeping shared by the question games: current index, score, and moving on after an
 * answer (with a short pause so the child sees the result).
 */
export function useRounds(total: number, finish: (correct: number, total: number) => void) {
  const [i, setI] = useState(0);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const answer = (ok: boolean, pause = ok ? 1200 : 2300) => {
    setLocked(true);
    const nextScore = score + (ok ? 1 : 0);
    if (ok) setScore(nextScore);
    setTimeout(() => {
      setLocked(false);
      if (i + 1 >= total) finish(nextScore, total);
      else setI(i + 1);
    }, pause);
  };
  return { i, locked, score, answer };
}

/** Font size that keeps a word inside its box: long words get smaller. */
export function fitFont(text: string, base: number, min = 20): number {
  const extra = Math.max(0, [...text].length - 4);
  return Math.max(min, Math.round(base - extra * base * 0.09));
}

/** Options for a question at a difficulty level: level 1 keeps it to two choices. */
export function optionsFor(q: Question, level: Level = 2): string[] {
  if (level === 1 && q.options.length > 2) {
    const wrong = q.options.find((o) => o !== q.answer)!;
    return Math.random() < 0.5 ? [q.answer, wrong] : [wrong, q.answer];
  }
  return q.options;
}

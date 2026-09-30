import { useEffect, useState, type ReactNode } from 'react';
import type { Question, SkillId } from '../types';
import { Progress, SpeakBtn } from '../ui/kit';
import { speak } from '../services/tts';

export interface GameProps {
  /** skills practised in this game (one for a regular world, several for review) */
  skills: SkillId[];
  grade: number;
  rounds: number;
  /** report every answer – feeds the mistake map */
  report: (skill: SkillId, correct: boolean, expected: string, typed: string) => void;
  finish: (correct: number, total: number) => void;
}

export function showNikud(grade: number) {
  return grade <= 2;
}

export function GameShell({ title, done, total, instruction, children }: { title: string; done: number; total: number; instruction: string; children: ReactNode }) {
  useEffect(() => {
    const t = setTimeout(() => speak(instruction), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 20 }}>{title}</b>
        <div className="grow">
          <Progress value={done / total} />
        </div>
        <SpeakBtn text={instruction} small />
      </div>
      {children}
    </div>
  );
}

/** Prompt area for a question: emoji, "hear it" button and the word with a blank / the sentence. */
export function QuestionPrompt({ q, grade, fill }: { q: Question; grade: number; fill?: string | null }) {
  // the printed word with nikud would give the answer away – show it only once answered
  const nik = showNikud(grade) && q.nikud && fill;
  useEffect(() => {
    const t = setTimeout(() => speak(q.say, { force: true, rate: 0.8 }), 700);
    return () => clearTimeout(t);
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
export function HebrewKeyboard({ onKey, onBack, onSpace, onEnter }: { onKey: (k: string) => void; onBack: () => void; onSpace?: () => void; onEnter?: () => void }) {
  const [pressed, setPressed] = useState<string | null>(null);
  const key = (k: string) => {
    setPressed(k);
    setTimeout(() => setPressed(null), 120);
    onKey(k);
  };
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

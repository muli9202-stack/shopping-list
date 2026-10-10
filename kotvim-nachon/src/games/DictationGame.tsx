import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from './common';
import { GameShell, HebrewKeyboard } from './common';
import { alignTexts, norm } from '../engine/analyze';
import { shuffle } from '../engine/questions';
import { explainFix } from '../engine/explain';
import { DETECTIVE_SENTENCES } from '../data/detective';
import { DICTATIONS, SHORT_DICTATIONS } from '../data/stories';
import { WORDS, sentencesFor } from '../data/words';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { PRAISE, pick } from '../ui/kit';
import { Correction } from './Correction';
import type { SkillId } from '../types';

type Mode = 'sentence' | 'missing';

interface Item {
  mode: Mode;
  sentence: string;
  /** for 'missing': the word to write and where it is */
  target?: string;
  targetIndex?: number;
}

const ALL = [
  ...DETECTIVE_SENTENCES,
  ...[...SHORT_DICTATIONS, ...DICTATIONS].flatMap((d) => d.sentences.map((s) => ({ s, g: d.band === 1 ? 1 : d.band === 2 ? 3 : 5 }))),
];

/** Sentences for the topic first (they contain its practice words), fitting the grade. */
function dictationItems(skills: SkillId[], grade: number, count: number): Item[] {
  const topicWords = new Set(skills.flatMap((s) => (WORDS[s] ?? []).map((e) => e.w)));
  for (const sk of skills) for (const x of sentencesFor(sk) ?? []) topicWords.add(x.a);
  const fit = shuffle(ALL.filter((x) => x.g <= grade + 1 && x.s.split(' ').length <= (grade <= 2 ? 5 : 9)));
  const words = (s: string) => s.replace(/[.,!?:"]/g, '').split(' ');
  const withTopic = fit.filter((x) => words(x.s).some((w) => topicWords.has(w)));
  const pool = [...withTopic, ...fit.filter((x) => !withTopic.includes(x))].slice(0, count);
  return pool.map((x, k) => {
    // younger children start with one missing word; then whole sentences
    const mode: Mode = grade <= 2 ? (k % 3 === 2 ? 'sentence' : 'missing') : k % 2 === 0 ? 'sentence' : 'missing';
    if (mode === 'sentence') return { mode, sentence: x.s };
    const ws = words(x.s);
    let idx = ws.findIndex((w) => topicWords.has(w));
    if (idx < 0) idx = ws.reduce((best, w, i) => (w.length > ws[best].length ? i : best), 0);
    return { mode, sentence: x.s, target: ws[idx], targetIndex: idx };
  });
}

/**
 * Dictation: hear a sentence and write it all, or write the missing word of a sentence. Every
 * mistake is shown with the right spelling and an explanation of what to fix.
 */
export function DictationGame({ skills, grade, rounds, report, finish }: GameProps) {
  const items = useMemo(() => dictationItems(skills, grade, Math.max(3, Math.min(5, Math.round(rounds / 2)))), [skills, grade, rounds]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const tally = useRef({ right: 0, total: 0 });
  const it = items[i];
  useEffect(() => {
    if (!it) return;
    const t = setTimeout(() => speak(it.sentence, { force: true, rate: 0.85 }), 500);
    return () => clearTimeout(t);
  }, [it]);
  if (!it) return null;

  const skillOf = (expected: string, issueSkill?: string): SkillId =>
    issueSkill && issueSkill !== 'other' ? (issueSkill as SkillId) : (skills.find((s) => (WORDS[s] ?? []).some((e) => e.w === expected)) ?? skills[0]);

  const aligned = checked && it.mode === 'sentence' ? alignTexts(it.sentence, typed).filter((a) => a.expected) : [];

  const check = () => {
    if (checked || !typed.trim()) return;
    setChecked(true);
    if (it.mode === 'missing') {
      const ok = norm(typed) === norm(it.target!);
      tally.current.total++;
      if (ok) tally.current.right++;
      report(skillOf(it.target!), ok, it.target!, typed.trim());
      sfx(ok ? 'good' : 'bad');
      speak(ok ? pick(PRAISE) : 'כמעט! תראו איך כותבים');
      return;
    }
    const list = alignTexts(it.sentence, typed).filter((a) => a.expected);
    let wrong = 0;
    for (const a of list) {
      tally.current.total++;
      if (a.ok) tally.current.right++;
      else wrong++;
      report(skillOf(a.expected!, a.issues[0]?.skill), a.ok, a.expected!, a.typed ?? '');
    }
    sfx(wrong ? 'bad' : 'win');
    speak(!wrong ? 'וואו! אין אף טעות. אתה כותב מושלם!' : wrong <= 2 ? 'כמעט מושלם! רק כמה טעויות קטנות.' : 'עבודה יפה! תיקנו יחד כמה מילים.');
  };

  const next = () => {
    setTyped('');
    setChecked(false);
    if (i + 1 >= items.length) finish(tally.current.right, Math.max(1, tally.current.total));
    else setI(i + 1);
  };

  const ws = it.sentence.split(' ');
  return (
    <GameShell game="dictation" title="📝 הכתבה" done={i} total={items.length} instruction={it.mode === 'sentence' ? 'הקשיבו למשפט וכתבו את כולו' : 'הקשיבו למשפט וכתבו את המילה החסרה'}>
      <div className="card center" style={{ gap: 8, marginBottom: 10 }}>
        <div className="row">
          <button className="btn blue" onClick={() => speak(it.sentence, { force: true, rate: 0.85 })}>
            🔊 שוב
          </button>
          <button className="btn white" onClick={() => speak(it.sentence, { force: true, rate: 0.7 })}>
            🐢 לאט
          </button>
        </div>
        {it.mode === 'missing' && (
          <div dir="rtl" className="script" style={{ fontSize: 28, textAlign: 'center' }}>
            {ws.map((w, k) => (k === it.targetIndex ? <b key={k}> ____{w.replace(/^[^.,!?:"]+/, '')} </b> : <span key={k}>{w} </span>))}
          </div>
        )}
        {!checked && (
          <div dir="rtl" className="word-big" style={{ fontSize: it.mode === 'sentence' ? 30 : 52, minHeight: 64, minWidth: 220, borderBottom: '4px solid #dee2e6', textAlign: 'center' }}>
            {typed || ' '}
          </div>
        )}
        {checked && it.mode === 'missing' && (norm(typed) === norm(it.target!) ? <div className="word-big" style={{ color: 'var(--green)' }}>{it.target} ✔</div> : <Correction expected={it.target!} typed={typed} />)}
        {checked && it.mode === 'sentence' && (
          <div style={{ width: '100%' }}>
            <div className="small muted">✅ ככה כותבים:</div>
            <div dir="rtl" className="script" style={{ fontSize: 26, marginBottom: 6 }}>
              {it.sentence}
            </div>
            {aligned.filter((a) => !a.ok).map((a, k) => (
              <div key={k} className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="script" style={{ color: 'var(--red)', textDecoration: 'line-through', fontSize: 24 }}>{a.typed || '—'}</span>
                <span>⬅</span>
                <span className="script" style={{ color: 'var(--green)', fontSize: 26, fontWeight: 700 }}>{a.expected}</span>
                <span className="small">💡 {explainFix(a.expected!, a.typed ?? '')[0] ?? ''}</span>
              </div>
            ))}
            {!aligned.some((a) => !a.ok) && <div style={{ color: 'var(--green)', fontWeight: 700 }}>🎉 בלי אף טעות!</div>}
          </div>
        )}
        {checked && (
          <button className="btn green big" onClick={next}>
            ממשיכים ⬅️
          </button>
        )}
      </div>
      {!checked && (
        <HebrewKeyboard
          punctuation={it.mode === 'sentence'}
          onKey={(k) => setTyped((t) => (t + k).slice(0, 200))}
          onBack={() => setTyped((t) => t.slice(0, -1))}
          onSpace={it.mode === 'sentence' ? () => setTyped((t) => (t && !t.endsWith(' ') ? t + ' ' : t)) : undefined}
          onEnter={check}
        />
      )}
    </GameShell>
  );
}


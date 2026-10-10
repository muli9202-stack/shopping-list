import { editOps, norm } from './analyze.ts';
import { FINAL_TO_REGULAR } from '../data/skills.ts';

const PREFIXES = new Set(['ו', 'ה', 'ב', 'כ', 'ל', 'מ', 'ש', 'כש']);

/**
 * Explains, in a child's words, what to fix in a written word and why – shown under every mistake
 * in the writing games and dictations. At most two short sentences.
 */
export function explainFix(expected: string, typed: string): string[] {
  const e = norm(expected);
  const t = norm(typed);
  if (!t) return ['המילה חסרה – כדאי לכתוב את כל המילים של המשפט.'];
  // a prefix written as a separate word: "ל בית"
  const parts = typed.trim().split(/\s+/);
  if (parts.length === 2 && PREFIXES.has(parts[0]) && norm(parts.join('')) === e) return [`האות ${parts[0]} נדבקת למילה – כותבים ${expected} בלי רווח.`];
  if (e === t) return [];
  if ((e === 'עם' && t === 'אם') || (e === 'אם' && t === 'עם'))
    return [e === 'עם' ? 'כאן צריך עם עם ע – כי אפשר להגיד ביחד.' : 'כאן צריך אם עם א – כי יש כאן תנאי או שאלה.'];

  const out: string[] = [];
  for (const op of editOps(e, t)) {
    if (out.length >= 2) break;
    if (op.type === 'sub') {
      const want = op.a;
      const got = op.b;
      if (FINAL_TO_REGULAR[want] === got) out.push(`בסוף מילה כותבים אות סופית: ${want} ולא ${got}.`);
      else if (FINAL_TO_REGULAR[got] === want) out.push(`אות סופית באה רק בסוף המילה – באמצע כותבים ${want}.`);
      else out.push(`כתבת ${got} במקום ${want}.`);
    } else if (op.type === 'del') {
      if (op.a === 'ו' || op.a === 'י') out.push(`חסרה האות ${op.a} – בכתיב מלא מוסיפים אותה.`);
      else out.push(`חסרה האות ${op.a}.`);
    } else {
      if (op.b === 'ה' && op.i > 0 && PREFIXES.has(e[op.i - 1])) out.push('אחרי ב, ל או כ, ה הידיעה נעלמת.');
      else out.push(`האות ${op.b} מיותרת.`);
    }
  }
  return out;
}

/** Letter-by-letter marks of a typed word against the right one, for coloring: true = right letter. */
export function letterMarks(expected: string, typed: string): { ch: string; ok: boolean }[] {
  const e = norm(expected);
  const t = norm(typed);
  const bad = new Set<number>();
  // positions in `t` that are not a plain match
  let ti = 0;
  let ei = 0;
  for (const op of editOps(e, t)) {
    // advance over matching letters before this op
    while (ei < op.i) {
      ei++;
      ti++;
    }
    if (op.type === 'sub') {
      bad.add(ti);
      ei++;
      ti++;
    } else if (op.type === 'ins') {
      bad.add(ti);
      ti++;
    } else ei++;
  }
  return [...t].map((ch, i) => ({ ch, ok: !bad.has(i) }));
}

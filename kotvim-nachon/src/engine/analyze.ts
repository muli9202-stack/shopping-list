import type { SkillId } from '../types';
import { FINAL_TO_REGULAR, REGULAR_TO_FINAL, skillForSwap } from '../data/skills.ts';

const NIKUD = /[֑-ׇ]/g;
const PREFIX_LETTERS = new Set(['ו', 'ה', 'ב', 'כ', 'ל', 'מ', 'ש']);

export function stripNikud(s: string): string {
  return s.replace(NIKUD, '');
}

/** Normalise a word for comparison: no nikud, no punctuation, no quotes. */
export function norm(w: string): string {
  return stripNikud(w).replace(/[^א-ת]/g, '');
}

export function tokenize(text: string): string[] {
  return stripNikud(text)
    .split(/[\s ]+/)
    .map((t) => t.replace(/^[^א-ת]+|[^א-ת]+$/g, ''))
    .filter(Boolean);
}

export interface WordIssue {
  skill: SkillId | 'other';
  pair?: string;
}

/**
 * Classify why `typed` differs from `expected` (both single words, already normalised).
 * Returns the list of detected issues (usually one).
 */
export function classifyWord(expected: string, typed: string): WordIssue[] {
  const e = norm(expected);
  const t = norm(typed);
  if (e === t) return [];
  if ((e === 'עם' && t === 'אם') || (e === 'אם' && t === 'עם')) return [{ skill: 'im_im', pair: `${e}→${t}` }];

  const ops = editOps(e, t);
  const issues: WordIssue[] = [];
  for (const op of ops) {
    if (op.type === 'sub') {
      const atEnd = op.i === e.length - 1;
      const skill = skillForSwap(op.a, op.b, atEnd);
      issues.push({ skill: skill ?? 'other', pair: `${op.a}→${op.b}` });
    } else if (op.type === 'del' || op.type === 'ins') {
      const ch = op.type === 'del' ? op.a : op.b;
      if (ch === 'ו' || ch === 'י') issues.push({ skill: 'full_spelling', pair: op.type === 'del' ? `חסר ${ch}` : `עודף ${ch}` });
      else if (ch === 'ה' && op.type === 'ins' && op.i > 0 && PREFIX_LETTERS.has(e[op.i - 1])) issues.push({ skill: 'prefixes', pair: 'ה מיותרת אחרי תחילית' });
      else issues.push({ skill: 'other', pair: op.type === 'del' ? `חסר ${ch}` : `עודף ${ch}` });
    }
  }
  // a final letter written in the middle of a word or a regular letter at the end
  if (issues.length === 0) issues.push({ skill: 'other' });
  return dedupe(issues);
}

function dedupe(list: WordIssue[]): WordIssue[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = `${i.skill}|${i.pair}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

type Op = { type: 'sub'; i: number; a: string; b: string } | { type: 'del'; i: number; a: string } | { type: 'ins'; i: number; b: string };

/** Levenshtein with backtrace, returning only the non-match operations. */
export function editOps(a: string, b: string): Op[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) ops.push({ type: 'sub', i: i - 1, a: a[i - 1], b: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: 'del', i: i - 1, a: a[i - 1] });
      i--;
    } else {
      ops.push({ type: 'ins', i, b: b[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

export interface AlignedWord {
  expected: string | null;
  typed: string | null;
  ok: boolean;
  issues: WordIssue[];
}

/**
 * Align a typed text against the expected text word by word (used for dictations).
 * Handles split prefixes ("ל בית" for "לבית") and joined words.
 */
export function alignTexts(expectedText: string, typedText: string): AlignedWord[] {
  const E = tokenize(expectedText);
  const T = tokenize(typedText);
  const n = E.length;
  const m = T.length;
  const sim = (x: string, y: string) => {
    const a = norm(x);
    const b = norm(y);
    if (a === b) return 0;
    const d = editOps(a, b).length;
    return d / Math.max(a.length, b.length);
  };
  // DP over words: match (cost = similarity), skip expected (1), extra typed (1), split prefix (typed i + i+1 == expected)
  const INF = 1e9;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  const back: (string | null)[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const cur = dp[i][j];
      if (cur >= INF) continue;
      if (i < n && j < m) {
        const c = cur + Math.min(sim(E[i], T[j]) * 1.5, 1.6);
        if (c < dp[i + 1][j + 1]) {
          dp[i + 1][j + 1] = c;
          back[i + 1][j + 1] = 'm';
        }
      }
      if (i < n && j + 1 < m && PREFIX_LETTERS.has(norm(T[j])) && norm(T[j]).length <= 2) {
        const c = cur + sim(E[i], T[j] + T[j + 1]) * 1.5 + 0.2;
        if (c < dp[i + 1][j + 2]) {
          dp[i + 1][j + 2] = c;
          back[i + 1][j + 2] = 's';
        }
      }
      if (i < n && cur + 1 < dp[i + 1][j]) {
        dp[i + 1][j] = cur + 1;
        back[i + 1][j] = 'e';
      }
      if (j < m && cur + 1 < dp[i][j + 1]) {
        dp[i][j + 1] = cur + 1;
        back[i][j + 1] = 't';
      }
    }
  const out: AlignedWord[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const b = back[i][j];
    if (b === 'm') {
      const ok = norm(E[i - 1]) === norm(T[j - 1]);
      out.push({ expected: E[i - 1], typed: T[j - 1], ok, issues: ok ? [] : classifyWord(E[i - 1], T[j - 1]) });
      i--;
      j--;
    } else if (b === 's') {
      const typed = `${T[j - 2]} ${T[j - 1]}`;
      out.push({ expected: E[i - 1], typed, ok: false, issues: [{ skill: 'prefixes', pair: 'תחילית נפרדה' }] });
      i--;
      j -= 2;
    } else if (b === 'e') {
      out.push({ expected: E[i - 1], typed: null, ok: false, issues: [{ skill: 'other', pair: 'מילה חסרה' }] });
      i--;
    } else {
      out.push({ expected: null, typed: T[j - 1], ok: false, issues: [{ skill: 'other', pair: 'מילה מיותרת' }] });
      j--;
    }
  }
  return out.reverse();
}

/** Make a plausible misspelling of `word` for the given skill. Returns null if the skill does not apply. */
export function misspell(word: string, skill: SkillId, groups: string[][]): { wrong: string; index: number } | null {
  const w = norm(word);
  if (skill === 'finals') {
    const last = w[w.length - 1];
    const reg = FINAL_TO_REGULAR[last];
    if (reg) return { wrong: w.slice(0, -1) + reg, index: w.length - 1 };
    for (let i = 0; i < w.length - 1; i++) {
      const fin = REGULAR_TO_FINAL[w[i]];
      if (fin) return { wrong: w.slice(0, i) + fin + w.slice(i + 1), index: i };
    }
    return null;
  }
  if (skill === 'he_alef_end') {
    const last = w[w.length - 1];
    if (last === 'ה') return { wrong: w.slice(0, -1) + 'א', index: w.length - 1 };
    if (last === 'א') return { wrong: w.slice(0, -1) + 'ה', index: w.length - 1 };
    return null;
  }
  for (let i = 0; i < w.length; i++) {
    for (const g of groups) {
      const k = g.indexOf(w[i]);
      if (k >= 0) {
        const other = g[(k + 1) % g.length];
        if (!other) continue;
        return { wrong: w.slice(0, i) + other + w.slice(i + 1), index: i };
      }
    }
  }
  return null;
}

/** Index of the first differing character between two words of equal length, else -1. */
export function diffIndex(a: string, b: string): number {
  if (a.length !== b.length) return -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

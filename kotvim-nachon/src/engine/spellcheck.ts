import type { SkillId } from '../types';
import { allKnownWords } from '../data/words.ts';
import { COMMON_WORDS, DICTATIONS } from '../data/stories.ts';
import { FINAL_TO_REGULAR, REGULAR_TO_FINAL } from '../data/skills.ts';
import { classifyWord, norm, stripNikud } from './analyze.ts';

let LEX: Set<string> | null = null;
function lexicon(): Set<string> {
  if (LEX) return LEX;
  const s = allKnownWords();
  for (const w of COMMON_WORDS.split(/\s+/)) if (w) s.add(w);
  for (const d of DICTATIONS) for (const sent of d.sentences) for (const w of sent.split(/\s+/)) if (norm(w)) s.add(norm(w));
  LEX = s;
  return s;
}

const PREFIXES = ['וכש', 'וש', 'וה', 'וב', 'ול', 'ומ', 'כש', 'מה', 'שה', 'ו', 'ה', 'ב', 'כ', 'ל', 'מ', 'ש'];

const SWAPS: Record<string, string[]> = {
  'א': ['ע', 'ה'], 'ע': ['א'], 'ט': ['ת'], 'ת': ['ט'], 'כ': ['ח', 'ק'], 'ח': ['כ', 'ך'], 'ק': ['כ'],
  'ך': ['ח'], 'ס': ['ש'], 'ש': ['ס'], 'ב': ['ו'], 'ו': ['ב'], 'ה': ['א'],
};

/**
 * Known misspellings → correct word. Built by applying typical kid mistakes to every word we know,
 * so the offline checker only "corrects" words it is sure about and never flags an unknown correct word.
 */
let MIS: Map<string, string> | null = null;
function misspellings(): Map<string, string> {
  if (MIS) return MIS;
  const L = lexicon();
  const m = new Map<string, string>();
  for (const c of L) {
    if (c.length < 2) continue;
    for (const v of variants(c)) if (!L.has(v) && !m.has(v)) m.set(v, c);
  }
  MIS = m;
  return m;
}

function variants(w: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    for (const s of SWAPS[ch] ?? []) {
      const v = w.slice(0, i) + s + w.slice(i + 1);
      out.push(v, fixFinals(v));
    }
  }
  for (let i = 1; i < w.length - 1; i++) if (w[i] === 'ו' || w[i] === 'י') out.push(w.slice(0, i) + w.slice(i + 1));
  if (w.endsWith('ה')) out.push(w.slice(0, -1) + 'א');
  if (w.endsWith('א')) out.push(w.slice(0, -1) + 'ה');
  return out;
}

function lookup(tok: string): string | null {
  const L = lexicon();
  if (L.has(tok)) return null;
  const M = misspellings();
  const direct = M.get(tok);
  if (direct) return direct;
  for (const p of PREFIXES) {
    if (tok.startsWith(p) && tok.length - p.length >= 2) {
      const rest = tok.slice(p.length);
      if (L.has(rest)) return null;
      const hit = M.get(rest);
      if (hit) return p + hit;
    }
  }
  return null;
}

/** Deterministic final-letter fix: finals only at the end, regular forms never at the end. */
export function fixFinals(w: string): string {
  let out = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    const last = i === w.length - 1;
    if (!last && FINAL_TO_REGULAR[ch]) out += FINAL_TO_REGULAR[ch];
    else if (last && REGULAR_TO_FINAL[ch] && w.length > 1) out += REGULAR_TO_FINAL[ch];
    else out += ch;
  }
  return out;
}

export interface CheckedWord {
  typed: string;
  corrected: string;
  skill?: SkillId | 'other';
  pair?: string;
}

export interface CheckResult {
  words: CheckedWord[];
  corrected: string;
  engine: 'offline' | 'ai';
  feedback?: string;
  creativity?: number;
}

export function checkOffline(text: string): CheckResult {
  const words: CheckedWord[] = [];
  const corrected = stripNikud(text).replace(/[א-ת]+/g, (tok) => {
    let fix = tok;
    const finalsFixed = fixFinals(tok);
    if (finalsFixed !== tok) fix = finalsFixed;
    fix = lookup(fix) ?? fix;
    if (fix !== tok) {
      const issue = classifyWord(fix, tok)[0];
      words.push({ typed: tok, corrected: fix, skill: issue?.skill, pair: issue?.pair });
    } else words.push({ typed: tok, corrected: tok });
    return fix;
  });
  return { words, corrected, engine: 'offline' };
}

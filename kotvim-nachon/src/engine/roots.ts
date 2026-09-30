import type { Question } from '../types';
import { FAMILIES, familyOf, showRoot } from '../data/roots.ts';
import { buildQuestions, shuffle } from './questions.ts';

export type RootItem =
  | { kind: 'root'; word: string; answer: string; options: string[] }
  | { kind: 'family'; word: string; answer: string; options: string[] }
  | { kind: 'spell'; q: Question; hint?: string };

/**
 * The roots game mixes three kinds of questions, from finding to using:
 * 1. what is the root of a word, 2. which word belongs to the same family,
 * 3. spell a word – with a family member as a hint (the root keeps the letters).
 */
export function rootItems(grade: number, count: number): RootItem[] {
  const spell = buildQuestions('roots', grade, Math.ceil(count / 3) + 1, 'missing');
  const out: RootItem[] = [];
  for (let k = 0; out.length < count && k < count * 3; k++) {
    const kind = k % 3;
    if (kind === 0) {
      const f = shuffle(FAMILIES)[0];
      const others = shuffle(FAMILIES.filter((x) => x !== f)).slice(0, 2);
      out.push({ kind: 'root', word: shuffle(f.words)[0], answer: showRoot(f.root), options: shuffle([f, ...others].map((x) => showRoot(x.root))) });
    } else if (kind === 1) {
      const f = shuffle(FAMILIES)[0];
      const [word, answer] = shuffle(f.words);
      const others = shuffle(FAMILIES.filter((x) => x !== f)).slice(0, 2).map((x) => shuffle(x.words)[0]);
      out.push({ kind: 'family', word, answer, options: shuffle([answer, ...others]) });
    } else {
      const q = spell.shift();
      if (!q) continue;
      const fam = familyOf(q.word);
      out.push({ kind: 'spell', q, hint: fam?.words.find((w) => w !== q.word) });
    }
  }
  return out;
}

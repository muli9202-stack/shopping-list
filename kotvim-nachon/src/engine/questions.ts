import type { Question, SkillId } from '../types';
import { SKILL_BY_ID } from '../data/skills.ts';
import { IM_SENTENCES, WORDS, type WordEntry } from '../data/words.ts';
import { diffIndex, misspell, norm } from './analyze.ts';

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Words suited to the child's grade: never above grade+1, and for older kids prefer harder words. */
export function poolFor(skill: SkillId, grade: number): WordEntry[] {
  const all = WORDS[skill] ?? [];
  const fit = all.filter((w) => w.g <= grade + 1);
  if (grade >= 3) {
    const harder = fit.filter((w) => w.g >= Math.min(grade - 1, 3));
    if (harder.length >= 6) return shuffle(harder).concat(shuffle(fit.filter((w) => !harder.includes(w)))).slice(0, 40);
  }
  return shuffle(fit.length ? fit : all);
}

function wrongFor(entry: WordEntry, skill: SkillId): { wrong: string[]; index: number } | null {
  if (entry.x.length) {
    const idx = diffIndex(entry.w, entry.x[0]);
    return { wrong: entry.x, index: idx };
  }
  const m = misspell(entry.w, skill, SKILL_BY_ID[skill].groups);
  if (!m) return null;
  const wrong = [m.wrong];
  // for 3-way groups add another distractor (כ/ח/ק)
  if (skill === 'kaf_het_kuf') {
    const ch = entry.w[m.index];
    const third = ['כ', 'ח', 'ק'].find((c) => c !== ch && c !== m.wrong[m.index]);
    if (third && m.index < entry.w.length - 1) wrong.push(entry.w.slice(0, m.index) + third + entry.w.slice(m.index + 1));
  }
  return { wrong, index: m.index };
}

export function makeQuestion(skill: SkillId, entry: WordEntry, kind: 'choose' | 'missing'): Question | null {
  const wr = wrongFor(entry, skill);
  if (!wr) return null;
  const base = { skill, word: entry.w, nikud: entry.n, emoji: entry.e, say: entry.n ?? entry.w };
  if (kind === 'missing' && wr.index >= 0 && wr.wrong.every((x) => x.length === entry.w.length)) {
    const correct = entry.w[wr.index];
    const letters = Array.from(new Set([correct, ...wr.wrong.map((x) => x[wr.index])]));
    if (letters.length < 2) return makeQuestion(skill, entry, 'choose');
    return {
      ...base,
      kind: 'missing',
      display: entry.w.slice(0, wr.index) + '_' + entry.w.slice(wr.index + 1),
      answer: correct,
      options: shuffle(letters),
    };
  }
  return { ...base, kind: 'choose', display: entry.w, answer: entry.w, options: shuffle([entry.w, ...wr.wrong.slice(0, 2)]) };
}

function imQuestions(grade: number): Question[] {
  return shuffle(IM_SENTENCES.filter((s) => s.g <= grade + 1)).map((s) => ({
    kind: 'sentence' as const,
    skill: 'im_im' as const,
    word: s.a,
    say: s.s.replace('___', s.a),
    display: s.s,
    answer: s.a,
    options: shuffle(['אם', 'עם']),
    emoji: s.a === 'עם' ? '🤝' : '🤔',
  }));
}

/** Build `count` questions for a skill. `prefer` chooses the question style when possible. */
export function buildQuestions(skill: SkillId, grade: number, count: number, prefer: 'choose' | 'missing' = 'choose'): Question[] {
  if (skill === 'im_im') return cycle(imQuestions(grade), count);
  const qs: Question[] = [];
  for (const entry of poolFor(skill, grade)) {
    const q = makeQuestion(skill, entry, prefer) ?? makeQuestion(skill, entry, 'choose');
    if (q) qs.push(q);
    if (qs.length >= count) break;
  }
  return cycle(qs, count);
}

function cycle<T>(list: T[], count: number): T[] {
  if (!list.length) return [];
  const out: T[] = [];
  while (out.length < count) out.push(...shuffle(list));
  return out.slice(0, count);
}

/** Mixed questions from several skills, e.g. for review worlds and the diagnostic. */
export function mixedQuestions(skills: SkillId[], grade: number, perSkill: number, prefer: 'choose' | 'missing' = 'choose'): Question[] {
  return shuffle(skills.flatMap((s) => buildQuestions(s, grade, perSkill, prefer)));
}

/** Plain words for a skill (for typing and building games). */
export function wordsFor(skill: SkillId, grade: number, count: number): WordEntry[] {
  if (skill === 'im_im') return [];
  const pool = poolFor(skill, grade).filter((w) => norm(w.w).length <= (grade <= 2 ? 6 : 9));
  return cycle(pool, count);
}

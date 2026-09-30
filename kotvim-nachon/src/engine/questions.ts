import type { Question, SkillId } from '../types';
import { IM_SENTENCES, WORDS, type WordEntry } from '../data/words.ts';
import { diffIndex, norm } from './analyze.ts';
// wrong spellings checked with hspell (scripts/validate-content.ts): never a real Hebrew word
import DISTRACTORS from '../data/generated/distractors.json' with { type: 'json' };

const DIS = DISTRACTORS as Record<string, Record<string, string[]>>;

/**
 * Without any Hebrew voice the child cannot hear which word is meant, so games switch to questions
 * where the word can be seen: a word with a missing letter, a sentence, or a picture.
 */
let visualOnly = false;
export function setVisualOnly(on: boolean) {
  visualOnly = on;
}
export function isVisualOnly() {
  return visualOnly;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The child's due review words come first in every game (spaced repetition). */
let focus: Partial<Record<SkillId, Set<string>>> = {};
export function setFocusWords(words: { skill: SkillId; word: string }[]) {
  focus = {};
  for (const w of words) (focus[w.skill] ??= new Set()).add(w.word);
}

function withFocus(skill: SkillId, list: WordEntry[]): WordEntry[] {
  const f = focus[skill];
  if (!f?.size) return list;
  return [...list.filter((e) => f.has(e.w)), ...list.filter((e) => !f.has(e.w))];
}

/** Words suited to the child's grade: never above grade+1, and for older kids prefer harder words. */
export function poolFor(skill: SkillId, grade: number): WordEntry[] {
  return withFocus(skill, poolForGrade(skill, grade));
}

function poolForGrade(skill: SkillId, grade: number): WordEntry[] {
  const all = WORDS[skill] ?? [];
  const fit = all.filter((w) => w.g <= grade + 1);
  if (grade >= 3) {
    const harder = fit.filter((w) => w.g >= Math.min(grade - 1, 3));
    if (harder.length >= 6) return shuffle(harder).concat(shuffle(fit.filter((w) => !harder.includes(w)))).slice(0, 40);
  }
  return shuffle(fit.length ? fit : all);
}

function wrongFor(entry: WordEntry, skill: SkillId): { wrong: string[]; index: number } | null {
  const list = shuffle(DIS[skill]?.[entry.w] ?? []);
  if (!list.length) return null;
  // prefer distractors that differ in the same position, so "missing letter" questions work
  const index = diffIndex(entry.w, list[0]);
  const same = index >= 0 ? list.filter((x) => diffIndex(entry.w, x) === index) : [];
  return same.length ? { wrong: [...same, ...list.filter((x) => !same.includes(x))], index } : { wrong: list, index: -1 };
}

/** True if the word has at least one safe wrong spelling (usable in choose / missing-letter games). */
export function hasDistractor(skill: SkillId, word: string): boolean {
  return (DIS[skill]?.[word]?.length ?? 0) > 0;
}

export function makeQuestion(skill: SkillId, entry: WordEntry, kind: 'choose' | 'missing'): Question | null {
  const wr = wrongFor(entry, skill);
  if (!wr) return null;
  const base = { skill, word: entry.w, nikud: entry.n, emoji: entry.e, say: entry.n ?? entry.w };
  if (kind === 'missing' && wr.index >= 0 && wr.wrong.every((x) => x.length === entry.w.length)) {
    const correct = entry.w[wr.index];
    const letters = Array.from(new Set([correct, ...wr.wrong.filter((x) => diffIndex(entry.w, x) === wr.index).map((x) => x[wr.index])]));
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
/** `seeOnly`: the game shows the words themselves (judge right/wrong), so it works without sound. */
export function buildQuestions(skill: SkillId, grade: number, count: number, prefer: 'choose' | 'missing' = 'choose', seeOnly = false): Question[] {
  if (skill === 'im_im') return cycle(imQuestions(grade), count);
  const noSound = visualOnly && !seeOnly;
  if (noSound) prefer = 'missing';
  const qs: Question[] = [];
  const pool = poolFor(skill, grade).filter((e) => hasDistractor(skill, e.w));
  for (const entry of balanceEndings(skill, pool)) {
    const q = makeQuestion(skill, entry, prefer) ?? makeQuestion(skill, entry, 'choose');
    // a "which spelling?" question with no sound needs a picture to know the word
    if (q && noSound && q.kind === 'choose' && !q.emoji) continue;
    if (q) qs.push(q);
    if (qs.length >= count) break;
  }
  return cycle(qs, count);
}

/** For ה/א at the end, alternate ה-words and א-words so the answer is not always ה. */
function balanceEndings(skill: SkillId, pool: WordEntry[]): WordEntry[] {
  if (skill !== 'he_alef_end') return pool;
  const he = pool.filter((e) => e.w.endsWith('ה'));
  const alef = pool.filter((e) => e.w.endsWith('א'));
  const out: WordEntry[] = [];
  for (let i = 0; i < Math.max(he.length, alef.length); i++) {
    if (he[i]) out.push(he[i]);
    if (alef[i]) out.push(alef[i]);
  }
  return out;
}

function cycle<T>(list: T[], count: number): T[] {
  if (!list.length) return [];
  const out: T[] = [];
  while (out.length < count) out.push(...shuffle(list));
  return out.slice(0, count);
}

/** Mixed questions from several skills, e.g. for review worlds and the diagnostic. */
export function mixedQuestions(skills: SkillId[], grade: number, perSkill: number, prefer: 'choose' | 'missing' = 'choose', seeOnly = false): Question[] {
  return shuffle(skills.flatMap((s) => buildQuestions(s, grade, perSkill, prefer, seeOnly)));
}

/** Plain words for a skill (for typing and building games). */
export function wordsFor(skill: SkillId, grade: number, count: number): WordEntry[] {
  if (skill === 'im_im') return [];
  const pool = poolFor(skill, grade).filter((w) => norm(w.w).length <= (grade <= 2 ? 6 : 9));
  const seen = visualOnly ? pool.filter((w) => w.e) : pool;
  return cycle(seen.length >= 4 ? seen : pool, count);
}

export interface DetectiveItem {
  skill: SkillId;
  /** the sentence split into words; `bad` is the index of the misspelled one */
  words: string[];
  bad: number;
  right: string;
  wrong: string;
  /** the correct spelling plus two wrong ones, for the "fix it" step */
  options: string[];
  sentence: string;
}

/**
 * "Mistake detective": a whole sentence with one word misspelled (a real mistake children make,
 * never another real word). The child finds the word, then chooses how it is really written.
 */
export function detectiveItems(skills: SkillId[], grade: number, count: number, sentences: { s: string; g: number }[]): DetectiveItem[] {
  const bySkill = new Map<string, { skill: SkillId; entry: WordEntry }>();
  for (const skill of skills)
    for (const entry of WORDS[skill] ?? []) if (hasDistractor(skill, entry.w) && !bySkill.has(entry.w)) bySkill.set(entry.w, { skill, entry });
  const fit = sentences.filter((x) => x.g <= grade + 1);
  const out: DetectiveItem[] = [];
  const focusFirst = (a: DetectiveItem[]) => a.sort((x, y) => Number(!!focus[y.skill]?.has(y.right)) - Number(!!focus[x.skill]?.has(x.right)));
  for (const x of shuffle(fit)) {
    const words = x.s.split(' ');
    const targets = shuffle(words.map((w, i) => ({ i, core: w.replace(/[.,!?:]/g, '') })).filter((t) => bySkill.has(t.core)));
    if (!targets.length) continue;
    const t = targets[0];
    const { skill, entry } = bySkill.get(t.core)!;
    const wr = wrongFor(entry, skill)!;
    const wrong = wr.wrong[0];
    const punct = words[t.i].slice(t.core.length);
    const shown = words.slice();
    shown[t.i] = wrong + punct;
    out.push({ skill, words: shown, bad: t.i, right: entry.w, wrong, options: shuffle([entry.w, ...wr.wrong.slice(0, 2)]), sentence: x.s });
  }
  // אם / עם: the sentences of that topic, with the wrong one of the two
  if (skills.includes('im_im'))
    for (const x of shuffle(IM_SENTENCES.filter((y) => y.g <= grade + 1))) {
      const wrong = x.a === 'אם' ? 'עם' : 'אם';
      const words = x.s.replace('___', wrong).split(' ');
      const bad = words.findIndex((w) => w === wrong || w.startsWith(wrong + ','));
      if (bad >= 0) out.push({ skill: 'im_im', words, bad, right: x.a, wrong, options: shuffle([x.a, wrong]), sentence: x.s.replace('___', x.a) });
    }
  return focusFirst(shuffle(out)).slice(0, count);
}

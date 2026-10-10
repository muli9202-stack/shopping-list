import type { Child, SkillId } from '../types';
import { dayKey } from './progress.ts';
import { sentencesFor } from '../data/words.ts';

/**
 * Spaced repetition (Leitner boxes) for the child's own mistakes.
 * A word the child got wrong enters box 0 and comes back today; each correct answer moves it to
 * the next box and pushes the next review further away: 1, 3, 7, 14, 30 days. After the last box
 * the word counts as learned. A mistake sends it back to box 0.
 */
export const INTERVALS = [1, 3, 7, 14, 30];

export interface ReviewEntry {
  skill: SkillId;
  word: string;
  box: number;
  due: string;
}

export function reviewKey(skill: SkillId, word: string) {
  return `${skill}|${word}`;
}

function addDays(days: number) {
  return dayKey(Date.now() + days * 86400000);
}

export function reviewAnswer(c: Child, skill: SkillId, word: string, correct: boolean): Child {
  if (!word || sentencesFor(skill)) return c;
  const key = reviewKey(skill, word);
  const review = { ...(c.review ?? {}) };
  const cur = review[key];
  if (!correct) review[key] = { skill, word, box: 0, due: dayKey() };
  else if (cur) {
    const box = cur.box + 1;
    if (box >= INTERVALS.length) {
      delete review[key];
      return { ...c, review, learnedWords: (c.learnedWords ?? 0) + 1 };
    }
    review[key] = { ...cur, box, due: addDays(INTERVALS[box - 1]) };
  } else return c;
  return { ...c, review };
}

export function dueWords(c: Child): ReviewEntry[] {
  const today = dayKey();
  return Object.values(c.review ?? {})
    .filter((e) => e.due <= today)
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due));
}

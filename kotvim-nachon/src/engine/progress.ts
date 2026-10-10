import type { Child, GameId, MistakeRecord, SkillId, SkillProgress, World } from '../types';
import { SKILLS } from '../data/skills.ts';
import { changePoints } from './merge.ts';

export function dayKey(t = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function emptySkill(): SkillProgress {
  return { attempts: 0, correct: 0, mastery: 0.5, days: [] };
}

export function newChild(name: string, grade: number, avatar: string): Child {
  const now = Date.now();
  return {
    id: `c${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    grade,
    avatar,
    createdAt: now,
    updatedAt: now,
    points: 100,
    totalEarned: 100,
    streak: 0,
    lastActiveDay: '',
    diagnosed: false,
    skills: {},
    pairs: {},
    mistakes: [],
    worlds: [],
    room: { owned: ['bed', 'rug_round'], placed: [
      { uid: 'p1', itemId: 'bed', x: -1.6, z: -1.4, rot: 0 },
      { uid: 'p2', itemId: 'rug_round', x: 0, z: 0.3, rot: 0 },
    ], wall: '#ffe8cc', floor: '#e6c9a8' },
    writings: [],
    seenTricks: [],
  };
}

const MAX_MISTAKES = 300;

export function recordAnswer(
  child: Child,
  skill: SkillId,
  correct: boolean,
  mistake?: Omit<MistakeRecord, 't' | 'skill'> & { skill?: SkillId | 'other' },
): Child {
  const sp: SkillProgress = { ...(child.skills[skill] ?? emptySkill()) };
  sp.attempts += 1;
  if (correct) sp.correct += 1;
  // learn quickly from the first answers, then settle into a moving average of recent answers
  const alpha = Math.max(0.12, 0.45 / (1 + (sp.attempts - 1) / 3));
  sp.mastery = Math.max(0, Math.min(1, sp.mastery * (1 - alpha) + (correct ? alpha : 0)));
  const today = dayKey();
  const days = sp.days.slice();
  const last = days[days.length - 1];
  if (last && last.d === today) days[days.length - 1] = { d: today, a: last.a + 1, c: last.c + (correct ? 1 : 0) };
  else days.push({ d: today, a: 1, c: correct ? 1 : 0 });
  sp.days = days.slice(-120);
  const next: Child = { ...child, skills: { ...child.skills, [skill]: sp }, updatedAt: Date.now() };
  if (!correct && mistake) return addMistake(next, { ...mistake, skill: mistake.skill ?? skill });
  return next;
}

export function addMistake(child: Child, m: Omit<MistakeRecord, 't'>): Child {
  const pairs = { ...child.pairs };
  if (m.pair) pairs[m.pair] = (pairs[m.pair] ?? 0) + 1;
  const mistakes = [...child.mistakes, { ...m, t: Date.now() }].slice(-MAX_MISTAKES);
  return { ...child, pairs, mistakes, updatedAt: Date.now() };
}

export function addPoints(child: Child, pts: number): Child {
  return changePoints(child, pts);
}

export function spendPoints(child: Child, pts: number): Child {
  return changePoints(child, -pts);
}

/** Called when the child starts an activity. Updates the streak and returns a daily surprise bonus (once a day). */
export function touchDay(child: Child): { child: Child; bonus: number } {
  const today = dayKey();
  if (child.lastActiveDay === today) return { child, bonus: 0 };
  const yesterday = dayKey(Date.now() - 86400000);
  const streak = child.lastActiveDay === yesterday ? child.streak + 1 : 1;
  const bonus = 20 + Math.min(streak, 10) * 10;
  return { child: addPoints({ ...child, streak, lastActiveDay: today }, bonus), bonus };
}

export function eligibleSkills(grade: number): SkillId[] {
  return SKILLS.filter((s) => s.minGrade <= grade).map((s) => s.id);
}

export function mastery(child: Child, skill: SkillId): number {
  return child.skills[skill]?.mastery ?? 0.5;
}

/** Skills sorted weakest-first. */
export function weakestSkills(child: Child): SkillId[] {
  return eligibleSkills(child.grade).sort((a, b) => mastery(child, a) - mastery(child, b));
}

export function isWeak(child: Child, skill: SkillId): boolean {
  const s = child.skills[skill];
  return !!s && s.attempts >= 3 && s.mastery < 0.7;
}

// ---- Learning path ("worlds") ----

export const STAGES_PER_WORLD = 5;

const LETTER_GAMES: GameId[] = ['cards', 'balloons', 'rain', 'sort', 'builder', 'memory', 'truefalse', 'listen', 'bubbles', 'rocket', 'path', 'fishing', 'whack', 'train', 'detective', 'memwrite', 'dictation', 'worddiner'];
/** Which games fit which topic (e.g. אם/עם only works in sentence games). */
const SKILL_GAMES: Partial<Record<SkillId, GameId[]>> = {
  im_im: ['balloons', 'sort', 'truefalse', 'cards', 'rocket', 'path', 'train', 'listen', 'detective', 'memwrite', 'dictation', 'worddiner'],
  prefixes: ['balloons', 'truefalse', 'cards', 'listen', 'bubbles', 'rocket', 'path', 'whack', 'train', 'builder', 'detective', 'memwrite', 'dictation', 'worddiner'],
  roots: ['roots', 'cards', 'truefalse', 'builder', 'roots', 'balloons', 'detective', 'train', 'listen', 'roots', 'rocket', 'path', 'memwrite', 'dictation', 'worddiner'],
  full_spelling: ['balloons', 'builder', 'truefalse', 'listen', 'memory', 'cards', 'bubbles', 'rocket', 'path', 'whack', 'train', 'detective', 'memwrite', 'dictation', 'worddiner'],
};

export function gamesForSkill(skill: SkillId | 'review'): GameId[] {
  if (skill === 'review') return ['balloons', 'truefalse', 'cards', 'listen', 'rocket', 'path', 'train', 'detective', 'memwrite', 'dictation', 'worddiner'];
  return SKILL_GAMES[skill] ?? LETTER_GAMES;
}

export type Stage = { kind: 'trick' } | { kind: 'game'; game: GameId } | { kind: 'boss' };

export function stageAt(world: World, worldIndex: number, idx: number): Stage {
  if (idx === 0 && world.skill !== 'review') return { kind: 'trick' };
  if (idx === STAGES_PER_WORLD - 1) return { kind: 'boss' };
  const games = gamesForSkill(world.skill);
  return { kind: 'game', game: games[(worldIndex * 3 + idx) % games.length] };
}

/** Pick the skill for the next world: the weakest one that was not practised in the last world. */
export function planNextWorld(child: Child): World {
  const last = child.worlds[child.worlds.length - 1];
  const order = weakestSkills(child).filter((s) => s !== last?.skill);
  const pick = order.find((s) => mastery(child, s) < 0.85);
  if (!pick || (child.worlds.length % 4 === 3 && child.worlds.length > 0)) return { skill: 'review', done: 0, stars: [] };
  return { skill: pick, done: 0, stars: [] };
}

export function ensureWorld(child: Child): Child {
  const last = child.worlds[child.worlds.length - 1];
  if (last && last.done < STAGES_PER_WORLD) return child;
  return { ...child, worlds: [...child.worlds, planNextWorld(child)], updatedAt: Date.now() };
}

export function completeStage(child: Child, stars: number): Child {
  const worlds = child.worlds.slice();
  const w = { ...worlds[worlds.length - 1] };
  w.stars = [...w.stars, stars];
  w.done += 1;
  worlds[worlds.length - 1] = w;
  return ensureWorld({ ...child, worlds, updatedAt: Date.now() });
}

/** Skills that are relevant for a review world: the currently weakest three. */
export function reviewSkills(child: Child): SkillId[] {
  return weakestSkills(child).slice(0, 3);
}

// ---- daily goal ----
export const DAILY_GOAL_SECONDS = 600;

/** Adds practice time to today; `reached` is true when this time completed the daily 10 minutes. */
export function addPractice(child: Child, seconds: number): { child: Child; reached: boolean } {
  const today = dayKey();
  const before = child.daily?.[today] ?? 0;
  const after = before + Math.max(0, Math.min(seconds, 600));
  const days = Object.entries({ ...(child.daily ?? {}), [today]: after })
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30);
  return { child: { ...child, daily: Object.fromEntries(days), updatedAt: Date.now() }, reached: before < DAILY_GOAL_SECONDS && after >= DAILY_GOAL_SECONDS };
}

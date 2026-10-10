import type { Child, GameId, Level, SkillId } from '../types';
import { eligibleSkills, gamesForSkill, mastery, weakestSkills } from './progress.ts';

/**
 * The 1000-level learning path the teacher leads. Every level is derived from its number, so the
 * path needs no stored content and grows harder in a fixed, explainable way:
 * - topics come in units of 8 levels, one topic after the other (only topics fit for the grade)
 * - every 100 levels is a "tier": harder words, more questions, harder game modes
 * - from tier 4 the child's weakest topic is mixed in, from tier 7 two of them
 * - every 10th level is a champions level (several topics, a dictation-style game)
 * - every other 5th level is a sentence dictation with an explained correction
 * - in every unit, two levels are "look, cover, write, check" (writing from memory)
 * - every 25th level is a review of the child's own mistake words (every 100th is a champions level)
 */
export const PATH_LENGTH = 1000;
export const UNIT = 8;

export const RANKS = ['מתחילים 🌱', 'חוקרים 🔎', 'כותבים 📝', 'בלשים 🕵️', 'קוסמים 🪄', 'אלופים 🏅', 'מומחים 🎓', 'אגדות 🌟', 'גאונים 🧠', 'מלכי הכתיב 👑'];

export interface PathStep {
  n: number;
  kind: 'lesson' | 'boss' | 'review' | 'dictation';
  skills: SkillId[];
  /** the topic this unit teaches (for tricks and tips) */
  topic: SkillId;
  game: GameId;
  level: Level;
  rounds: number;
  /** first level of a unit: the topic is introduced */
  intro: boolean;
  /** topic unit number and the level's place in it (the last place is the unit test) */
  unit: number;
  pos: number;
}

export function tierOf(n: number) {
  return Math.min(9, Math.floor((n - 1) / 100));
}

export function rankOf(n: number) {
  return RANKS[tierOf(n)];
}

export function pathLevel(c: Child): number {
  return Math.min(PATH_LENGTH, c.path?.level ?? 1);
}

/** Game difficulty: set by the tier, then nudged by how well the child knows the topic. */
function levelFor(c: Child, n: number, skills: SkillId[]): Level {
  const tier = tierOf(n);
  const base = tier === 0 ? 1 : tier <= 2 ? 2 : tier <= 5 ? 3 : 4;
  const m = skills.reduce((a, s) => a + mastery(c, s), 0) / skills.length;
  const nudge = m < 0.5 ? -1 : m > 0.9 ? 1 : 0;
  return Math.max(1, Math.min(4, base + nudge)) as Level;
}

export function pathStep(c: Child, n: number): PathStep {
  const topics = eligibleSkills(c.grade);
  const unit = Math.floor((n - 1) / UNIT);
  const pos = (n - 1) % UNIT;
  const topic = topics[unit % topics.length];
  const tier = tierOf(n);
  const rounds = 6 + Math.floor(tier / 2);

  if (n % 25 === 0 && n % 100 !== 0) {
    const skills = weakestSkills(c).slice(0, 3);
    return { n, kind: 'review', skills, topic: skills[0], game: (['cards', 'truefalse', 'detective'] as GameId[])[(n / 25) % 3], level: levelFor(c, n, skills), rounds: rounds + 2, intro: false, unit, pos };
  }
  if (n % 10 === 0) {
    // champions: this unit's topic with the ones learned just before it
    const skills = [...new Set([topic, topics[(unit + topics.length - 1) % topics.length], topics[(unit + topics.length - 2) % topics.length]])];
    const game: GameId = tier >= 2 && n % 20 === 0 ? 'detective' : 'listen';
    return { n, kind: 'boss', skills, topic, game, level: levelFor(c, n, skills), rounds: rounds + 2, intro: false, unit, pos };
  }

  const games = gamesForSkill(topic);
  // the unit test (last level of a unit) is a dictation-style game; the rest rotate through the topic's games
  // writing from memory twice in every unit; the unit test is a dictation-style game
  const game: GameId = pos === UNIT - 1 ? (topic === 'roots' ? 'roots' : 'listen') : pos === 2 || pos === 5 ? 'memwrite' : pos === 4 && topic !== 'roots' ? 'worddiner' : games[(unit * 5 + pos) % games.length];
  // every 5th level: a dictation of sentences with the words learned (what a test at school asks for)
  if (n % 5 === 0) return { n, kind: 'dictation', skills: [topic], topic, game: 'dictation', level: levelFor(c, n, [topic]), rounds, intro: false, unit, pos };
  const skills: SkillId[] = [topic];
  // mixed practice: the child's weakest topics join in – only those the game can ask about
  const weak = game === 'roots' ? [] : weakestSkills(c).filter((s) => s !== topic && gamesForSkill(s).includes(game));
  if (tier >= 4 && weak[0]) skills.push(weak[0]);
  if (tier >= 7 && weak[1]) skills.push(weak[1]);
  return { n, kind: 'lesson', skills, topic, game, level: levelFor(c, n, skills), rounds, intro: pos === 0, unit, pos };
}

/** A finished level: stars are kept (best of), and the path moves on. */
export function completeLevel(c: Child, n: number, stars: number): Child {
  const prev = c.path ?? { level: 1, stars: {} };
  return {
    ...c,
    path: { level: Math.max(prev.level, Math.min(PATH_LENGTH, n + 1)), stars: { ...prev.stars, [String(n)]: Math.max(prev.stars[String(n)] ?? 0, stars) } },
    updatedAt: Date.now(),
  };
}

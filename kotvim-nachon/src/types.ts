export type SkillId =
  | 'alef_ayin'
  | 'tet_tav'
  | 'kaf_het_kuf'
  | 'samekh_sin'
  | 'bet_vav'
  | 'he_alef_end'
  | 'finals'
  | 'prefixes'
  | 'im_im'
  | 'full_spelling';

export type GameId =
  | 'balloons'
  | 'rain'
  | 'cards'
  | 'builder'
  | 'memory'
  | 'truefalse'
  | 'listen'
  | 'sort';

/** Daily aggregate for one skill – used for the parents' progress charts. */
export interface DayStat {
  d: string; // YYYY-MM-DD
  a: number; // attempts
  c: number; // correct
}

export interface SkillProgress {
  attempts: number;
  correct: number;
  /** 0..1, exponential moving average of recent answers */
  mastery: number;
  days: DayStat[];
}

export interface MistakeRecord {
  t: number;
  expected: string;
  typed: string;
  skill: SkillId | 'other';
  /** e.g. "א→ע" */
  pair?: string;
  source: 'learn' | 'game' | 'write' | 'dictation' | 'diagnostic';
}

export interface World {
  skill: SkillId | 'review';
  /** how many of the world's stages are complete */
  done: number;
  stars: number[];
}

export interface PlacedItem {
  uid: string;
  itemId: string;
  x: number;
  z: number;
  rot: number;
}

export interface RoomState {
  owned: string[];
  placed: PlacedItem[];
  wall: string;
  floor: string;
}

export interface WritingRecord {
  t: number;
  mode: 'story' | 'dictation';
  text: string;
  corrected: string;
  words: number;
  mistakes: number;
  points: number;
}

export interface Child {
  id: string;
  name: string;
  grade: number; // 1..8
  avatar: string;
  createdAt: number;
  updatedAt: number;
  /** derived from `wallet` (see engine/merge.ts) */
  points: number;
  /** per-device earned/spent counters, so points from several devices add up */
  wallet?: Record<string, { e: number; s: number }>;
  totalEarned: number;
  streak: number;
  lastActiveDay: string;
  diagnosed: boolean;
  skills: Partial<Record<SkillId, SkillProgress>>;
  pairs: Record<string, number>;
  mistakes: MistakeRecord[];
  worlds: World[];
  room: RoomState;
  writings: WritingRecord[];
  seenTricks: SkillId[];
  aiSummary?: { t: number; text: string };
}

export interface FamilySettings {
  voiceOn: boolean;
  parentPin: string | null;
  updatedAt: number;
}

export interface Question {
  kind: 'choose' | 'missing' | 'sentence';
  skill: SkillId;
  /** the correct full word */
  word: string;
  /** word with nikud for reading support / TTS */
  nikud?: string;
  emoji?: string;
  /** text to read aloud */
  say: string;
  /** for 'missing': the word with "_" in place of the missing letter; for 'sentence': sentence with ___ */
  display: string;
  answer: string;
  options: string[];
}

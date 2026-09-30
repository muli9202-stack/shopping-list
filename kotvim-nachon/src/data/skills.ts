import type { SkillId } from '../types';

export interface SkillDef {
  id: SkillId;
  /** short title shown to kids */
  title: string;
  /** title for the parents' dashboard */
  parentTitle: string;
  /** letter groups that get confused with each other */
  groups: string[][];
  color: string;
  icon: string;
  /** minimal grade where the skill is introduced */
  minGrade: number;
}

export const SKILLS: SkillDef[] = [
  { id: 'alef_ayin', title: 'א או ע?', parentTitle: 'בלבול א/ע', groups: [['א', 'ע']], color: '#ff6b6b', icon: '👁️', minGrade: 1 },
  { id: 'tet_tav', title: 'ט או ת?', parentTitle: 'בלבול ט/ת', groups: [['ט', 'ת']], color: '#4dabf7', icon: '🍓', minGrade: 1 },
  { id: 'kaf_het_kuf', title: 'כ, ח או ק?', parentTitle: 'בלבול כ/ח/ק', groups: [['כ', 'ח'], ['כ', 'ק'], ['ך', 'ח']], color: '#51cf66', icon: '🐒', minGrade: 1 },
  { id: 'samekh_sin', title: 'ס או שׂ?', parentTitle: 'בלבול ס/ש', groups: [['ס', 'ש']], color: '#cc5de8', icon: '🐴', minGrade: 1 },
  { id: 'bet_vav', title: 'ב או ו?', parentTitle: 'בלבול ב/ו', groups: [['ב', 'ו']], color: '#ff922b', icon: '🌹', minGrade: 1 },
  { id: 'he_alef_end', title: 'ה או א בסוף?', parentTitle: 'ה/א בסוף מילה', groups: [['ה', 'א']], color: '#f06595', icon: '👧', minGrade: 1 },
  { id: 'finals', title: 'אותיות סופיות', parentTitle: 'אותיות סופיות (ם ן ץ ף ך)', groups: [['מ', 'ם'], ['נ', 'ן'], ['צ', 'ץ'], ['פ', 'ף'], ['כ', 'ך']], color: '#20c997', icon: '🏁', minGrade: 1 },
  { id: 'prefixes', title: 'אותיות שנדבקות', parentTitle: 'תחיליות (ו, ה, ב, כ, ל, מ, ש)', groups: [], color: '#fab005', icon: '🚂', minGrade: 1 },
  { id: 'im_im', title: 'אם או עם?', parentTitle: 'אם / עם', groups: [], color: '#7950f2', icon: '🤝', minGrade: 1 },
  { id: 'roots', title: 'שורשים ומשפחות', parentTitle: 'שורשים ומשפחות מילים', groups: [], color: '#9c36b5', icon: '🌳', minGrade: 3 },
  { id: 'full_spelling', title: 'כתיב מלא', parentTitle: 'כתיב מלא וחסר (ו/י)', groups: [['ו', ''], ['י', '']], color: '#1098ad', icon: '🧩', minGrade: 2 },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

export const FINAL_TO_REGULAR: Record<string, string> = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' };
export const REGULAR_TO_FINAL: Record<string, string> = { 'מ': 'ם', 'נ': 'ן', 'צ': 'ץ', 'פ': 'ף', 'כ': 'ך' };

/** Which skill a single-letter swap belongs to. `a` is the expected letter, `b` what was written. */
export function skillForSwap(a: string, b: string, atEnd: boolean): SkillId | null {
  const pair = new Set([a, b]);
  const has = (x: string, y: string) => pair.has(x) && pair.has(y);
  if (FINAL_TO_REGULAR[a] === b || FINAL_TO_REGULAR[b] === a) return 'finals';
  if (has('א', 'ע')) return 'alef_ayin';
  if (has('ט', 'ת')) return 'tet_tav';
  if (has('כ', 'ח') || has('כ', 'ק') || has('ח', 'ק') || has('ך', 'ח') || has('ך', 'ק')) return 'kaf_het_kuf';
  if (has('ס', 'ש')) return 'samekh_sin';
  if (has('ב', 'ו')) return 'bet_vav';
  if (has('ה', 'א') && atEnd) return 'he_alef_end';
  if (has('ה', 'א')) return 'alef_ayin';
  return null;
}

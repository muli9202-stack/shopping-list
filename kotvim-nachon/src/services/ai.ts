import { httpsCallable } from 'firebase/functions';
import { auth, fns } from './firebase';
import { checkOffline, type CheckResult } from '../engine/spellcheck';
import { classifyWord } from '../engine/analyze';
import type { Child, SkillId } from '../types';
import { SKILLS, SKILL_BY_ID } from '../data/skills';

interface AiCheckResponse {
  corrected: string;
  corrections: { from: string; to: string }[];
  feedback: string;
  creativity: number;
}

/**
 * Check a free-writing story. Uses the Cloud Function (Claude) when the parent is signed in,
 * otherwise falls back to the on-device checker. Only the story text and grade are sent – no names.
 */
export async function checkStory(text: string, grade: number): Promise<CheckResult> {
  if (fns && auth?.currentUser) {
    try {
      const call = httpsCallable<{ text: string; grade: number }, AiCheckResponse>(fns, 'checkWriting', { timeout: 60000 });
      const { data } = await call({ text, grade });
      const fixes = new Map(data.corrections.map((c) => [c.from, c.to]));
      const words = text
        .split(/\s+/)
        .filter(Boolean)
        .map((raw) => {
          const tok = raw.replace(/^[^א-ת]+|[^א-ת]+$/g, '');
          const to = fixes.get(tok);
          if (!to || to === tok) return { typed: tok, corrected: tok };
          const issue = classifyWord(to, tok)[0];
          return { typed: tok, corrected: to, skill: issue?.skill, pair: issue?.pair };
        })
        .filter((w) => w.typed);
      return { words, corrected: data.corrected, engine: 'ai', feedback: data.feedback, creativity: data.creativity };
    } catch (e) {
      console.warn('AI check failed, using offline checker', e);
    }
  }
  return checkOffline(text);
}

/** Summary of a child's mistakes for the parents' dashboard. */
export async function parentSummary(child: Child): Promise<string> {
  const stats = SKILLS.map((s) => {
    const p = child.skills[s.id];
    return p ? { skill: s.parentTitle, attempts: p.attempts, correct: p.correct, mastery: Math.round(p.mastery * 100) } : null;
  }).filter(Boolean);
  const pairs = Object.entries(child.pairs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const recent = child.mistakes.slice(-40).map((m) => `${m.expected}→${m.typed}`);
  if (fns && auth?.currentUser) {
    try {
      const call = httpsCallable<object, { summary: string }>(fns, 'parentSummary', { timeout: 60000 });
      const { data } = await call({ grade: child.grade, stats, pairs, recent });
      if (data.summary) return data.summary;
    } catch (e) {
      console.warn('AI summary failed, using local summary', e);
    }
  }
  return localSummary(child);
}

export function localSummary(child: Child): string {
  const practiced = SKILLS.filter((s) => (child.skills[s.id]?.attempts ?? 0) >= 3);
  if (!practiced.length) return 'עדיין אין מספיק נתונים. אחרי כמה שלבי למידה וכתיבה יופיע כאן ניתוח מפורט.';
  const byMastery = practiced.slice().sort((a, b) => (child.skills[a.id]!.mastery) - (child.skills[b.id]!.mastery));
  const weak = byMastery.filter((s) => child.skills[s.id]!.mastery < 0.7);
  const strong = byMastery.filter((s) => child.skills[s.id]!.mastery >= 0.85);
  const topPairs = Object.entries(child.pairs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, n]) => `${p} (${n} פעמים)`);
  const trend = (id: SkillId) => {
    const days = child.skills[id]?.days ?? [];
    if (days.length < 2) return '';
    const half = Math.floor(days.length / 2);
    const acc = (list: typeof days) => list.reduce((a, d) => a + d.c, 0) / Math.max(1, list.reduce((a, d) => a + d.a, 0));
    const diff = acc(days.slice(half)) - acc(days.slice(0, half));
    return diff > 0.05 ? ' – ורואים שיפור 📈' : diff < -0.05 ? ' – כדאי לחזק' : '';
  };
  const lines: string[] = [];
  if (weak.length) lines.push(`הנושאים שדורשים חיזוק: ${weak.map((s) => s.parentTitle + trend(s.id)).join('; ')}.`);
  if (strong.length) lines.push(`נושאים שכבר שולטים בהם: ${strong.map((s) => s.parentTitle).join(', ')}.`);
  if (topPairs.length) lines.push(`הבלבולים הנפוצים ביותר: ${topPairs.join(', ')}.`);
  lines.push(`רצף ימים: ${child.streak}. האפליקציה מתאימה אוטומטית את השלבים הבאים לנושא "${SKILL_BY_ID[byMastery[0].id].parentTitle}".`);
  return lines.join('\n');
}

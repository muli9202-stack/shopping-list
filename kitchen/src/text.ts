import type { Recipe, Video } from './types';

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Lower-cases, drops niqqud/punctuation and folds final letters so "קציצות" ≈ "קציצה". */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Strips common Hebrew plural/feminine endings so singular and plural forms meet. */
function stem(w: string): string {
  if (w.length > 4) for (const suf of ['יות', 'ות', 'ימ', 'ית']) if (w.endsWith(suf)) return w.slice(0, -suf.length);
  if (w.length > 3 && (w.endsWith('ה') || w.endsWith('ת'))) return w.slice(0, -1);
  return w;
}

const STOP = new Set(['של', 'עמ', 'עם', 'את', 'על', 'או', 'ו', 'ב', 'ל', 'מ', 'the', 'and', 'with', 'of']);

const words = (s: string) => norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w));

/** 0 = no match. Higher = better. Every query word must appear (as a word or stem) in the text. */
export function matchScore(query: string, text: string): number {
  const q = words(query);
  if (!q.length) return 0;
  const t = norm(text);
  const tw = t.split(' ');
  const ts = tw.map(stem);
  let score = 0;
  for (const w of q) {
    if (tw.includes(w)) score += 3;
    else if (ts.includes(stem(w))) score += 2;
    else if (t.includes(w) || (stem(w).length >= 3 && t.includes(stem(w)))) score += 1;
    else return 0;
  }
  if (t.startsWith(norm(query))) score += 1;
  return score;
}

export type Candidate = { kind: 'video'; item: Video; score: number } | { kind: 'recipe'; item: Recipe; score: number };

/** Recipes and videos whose title matches the planner item's name, best first. */
export function findMatches(name: string, videos: Video[], recipes: Recipe[]): Candidate[] {
  const out: Candidate[] = [];
  for (const r of recipes) {
    const score = matchScore(name, r.title);
    if (score) out.push({ kind: 'recipe', item: r, score });
  }
  for (const v of videos) {
    const score = matchScore(name, v.title);
    if (score) out.push({ kind: 'video', item: v, score });
  }
  return out.sort((a, b) => b.score - a.score || b.item.rating - a.item.rating);
}

/* ------------------------------------------------------------------ */
/* Recipe extraction from a YouTube description                         */
/* ------------------------------------------------------------------ */

const ING_HEAD = /^(?:רשימת\s+)?(?:ה?מצרכים|ה?רכיבים|ה?חומרים|מה צריך|ingredients?)(?=$|[\s:：\-–])/i;
const STEP_HEAD =
  /^(?:אופן\s+ה?הכנה|דרך\s+ה?הכנה|הוראות(?:\s+ה?הכנה)?|שלבי\s+ה?הכנה|ה?הכנה|instructions?|directions?|method|preparation|how to make)(?=$|[\s:：\-–])/i;
/** Lines that mark the end of the recipe part: links, hashtags, social plugs, chapters. */
const END =
  /^(?:#|https?:|www\.|לעוד|עקבו|הירשמו|הרשמו|תירשמו|instagram|facebook|tiktok|subscribe|follow|music|מוזיקה|לפרטים|לקבוצת|לרכישת|קוד קופון|\d{1,2}:\d{2})/i;

const BULLET = /^\s*(?:[-–—•*·▪►✔✅☑️🔸🔹]+|\d+\s*[.)]|[א-ת]\s*[.)])\s*/u;

const isHeading = (l: string) => /[:：]\s*$/.test(l) && l.length < 40;
const clean = (l: string) => l.replace(/\s+/g, ' ').trim();

/**
 * Pulls ingredients and steps verbatim out of a description. Nothing is
 * invented: when either section can't be found the recipe is flagged missing.
 */
export function parseDescription(desc: string): { ingredients: string[]; steps: string[]; missing: boolean } {
  const lines = desc.split(/\r?\n/).map(clean);
  const ingredients: string[] = [];
  const steps: string[] = [];
  let mode: 'none' | 'ing' | 'step' = 'none';

  for (const raw of lines) {
    if (!raw) continue;
    const head = raw.replace(/^[^\p{L}]+/u, '');
    if (ING_HEAD.test(head) && head.length < 40) {
      mode = 'ing';
      const rest = head.replace(ING_HEAD, '').replace(/^[^\p{L}\p{N}]+/u, '');
      if (rest && !/^[:：]?$/.test(rest) && rest.length > 2) ingredients.push(rest);
      continue;
    }
    if (STEP_HEAD.test(head) && head.length < 40) {
      mode = 'step';
      continue;
    }
    if (END.test(head) || END.test(raw)) {
      if (mode !== 'none') mode = 'none';
      continue;
    }
    if (mode === 'ing') {
      const l = raw.replace(BULLET, '').trim();
      if (l) ingredients.push(l);
    } else if (mode === 'step') {
      const l = raw.replace(BULLET, '').trim();
      if (!l) continue;
      // A sub-heading inside the steps stays as its own line.
      steps.push(l);
    }
  }

  const realIng = ingredients.filter((l) => !isHeading(l));
  const realSteps = steps.filter((l) => !isHeading(l));
  return { ingredients, steps, missing: realIng.length === 0 || realSteps.length === 0 };
}

export { isHeading };

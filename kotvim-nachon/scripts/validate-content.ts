/**
 * Content validator (dev tool, needs `hspell`: sudo apt-get install hspell).
 *
 *   npm run validate-content          → checks and regenerates src/data/generated/*.json
 *   npm run validate-content -- --check  → fails if content has errors or the generated files are stale (CI)
 *
 * 1. Every correct word, sentence and prompt must be a valid Hebrew spelling (Academy full spelling).
 * 2. Every nikud form must match its word.
 * 3. Wrong-spelling options ("distractors") that are real Hebrew words are dropped,
 *    so a child is never told that a real word is a mistake.
 * 4. The offline checker's list of known misspellings is filtered the same way.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { WORDS, IM_SENTENCES } from '../src/data/words.ts';
import { DICTATIONS, STORY_IDEAS, COMMON_WORDS, SHORT_DICTATIONS } from '../src/data/stories.ts';
import { SKILLS, FINAL_TO_REGULAR, REGULAR_TO_FINAL } from '../src/data/skills.ts';
import { TRICKS } from '../src/tricks/tricks.ts';
import { allTips } from '../src/data/tips.ts';
import type { SkillId } from '../src/types.ts';

const CHECK = process.argv.includes('--check');
const OUT = new URL('../src/data/generated/', import.meta.url);

/** Words hspell does not know but that are correct (loanwords, brand-free everyday words). */
const ALLOW = new Set([
  // spellings schools accept although hspell follows a stricter Academy form
  'אמא', 'איתו', 'אונייה', 'בריכה', 'לבריכה',
  // mnemonic and deliberate counter-examples inside tricks
  'מנצפך', 'מנצפ', 'בהבית',
  'בפארק', 'פארק', 'פיצה', 'ופל', 'שוקו', 'קקטוס', 'טרקטור', 'אטרקציה', 'חמסה', 'מתמטיקה', 'טמפרטורה', 'סוודר', 'אוטו', 'שוקולד', 'מוזיקה', 'טלפון', 'קרקס', 'בלון']);

const heb = (s: string) => s.replace(/[֑-ׇ]/g, '');
const tokens = (s: string) =>
  heb(s)
    .split(/[\s .,!?:;"״׳'()–\-]+/)
    .filter((t) => /^[א-ת]+$/.test(t));

function hspellInvalid(words: string[]): Set<string> {
  const uniq = [...new Set(words)].filter((w) => /^[א-ת]+$/.test(w));
  // hspell works in ISO-8859-8: א..ת are 0xE0..0xFA
  const iso = Buffer.from(uniq.map((w) => [...w].map((c) => String.fromCharCode(c.charCodeAt(0) - 0x05d0 + 0xe0)).join('')).join('\n'), 'latin1');
  const out = execFileSync('hspell', [], { input: iso }).toString('latin1');
  const bad = new Set<string>();
  for (const line of out.split('\n')) {
    const w = [...line.trim()].map((c) => (c.charCodeAt(0) >= 0xe0 && c.charCodeAt(0) <= 0xfa ? String.fromCharCode(c.charCodeAt(0) - 0xe0 + 0x05d0) : '')).join('');
    if (w && w.length === line.trim().length) bad.add(w);
  }
  return bad;
}

const toIso = (w: string) => [...w].map((c) => String.fromCharCode(c.charCodeAt(0) - 0x05d0 + 0xe0)).join('');
const fromIso = (w: string) => [...w].map((c) => (c.charCodeAt(0) >= 0xe0 && c.charCodeAt(0) <= 0xfa ? String.fromCharCode(c.charCodeAt(0) - 0xe0 + 0x05d0) : c)).join('');

/**
 * Words a child would recognise as real: a standalone noun, adjective, function word or basic
 * verb form (hspell -l analysis without possessive suffix). Rare inflections and prefix
 * combinations ("אוגה", "ש+לחן") are not counted, so they stay usable as wrong options.
 */
function hspellCommon(words: string[]): { all: Set<string>; nouns: Set<string> } {
  const uniq = [...new Set(words)].filter((w) => /^[\u05D0-\u05EA]+$/.test(w));
  const out = fromIso(execFileSync('hspell', ['-l'], { input: Buffer.from(uniq.map(toIso).join('\n'), 'latin1') }).toString('latin1'));
  const common = new Set<string>();
  const nouns = new Set<string>();
  let cur: string | null = null;
  for (const line of out.split('\n')) {
    const m = line.match(/^מילה חוקית: (.+)$/);
    if (m) {
      cur = m[1].trim();
      continue;
    }
    if (/^\S/.test(line)) {
      cur = null;
      continue;
    }
    if (!cur) continue;
    const a = line.trim().match(/^(.+)\((.+)\)$/);
    if (!a) continue;
    const feats = a[2].split(',');
    const pos = feats[0];
    const plain = !feats.some((f) => f.startsWith('כינוי'));
    if (plain && (pos === 'ע' || pos === 'ת' || pos === 'x' || (pos === 'פ' && feats.includes('עבר') && feats.includes('3') && feats.includes('יחיד')) || (pos === 'פ' && feats.includes('הווה') && feats.includes('יחיד'))))
      common.add(cur);
    if (plain && (pos === 'ע' || pos === 'ת' || pos === 'x')) nouns.add(cur);
  }
  return { all: common, nouns };
}

// ---------- 1. collect correct text ----------
const correct = new Map<string, string>(); // word → where it came from
const add = (w: string, where: string) => {
  if (!correct.has(w)) correct.set(w, where);
};
for (const [skill, list] of Object.entries(WORDS)) for (const e of list) add(e.w, `words:${skill}`);
for (const s of IM_SENTENCES) for (const t of tokens(s.s.replace('___', s.a))) add(t, 'im_im sentence');
for (const d of DICTATIONS) for (const s of d.sentences) for (const t of tokens(s)) add(t, `dictation ${d.id}`);
for (const d of SHORT_DICTATIONS) for (const s of d.sentences) for (const t of tokens(s)) add(t, `short dictation ${d.id}`);
for (const list of Object.values(STORY_IDEAS)) for (const i of list) for (const t of tokens(i.text)) add(t, 'story idea');
for (const t of COMMON_WORDS.split(/\s+/).filter(Boolean)) add(t, 'common words');
for (const tr of Object.values(TRICKS))
  for (const st of tr.steps) {
    // tricks talk about single letters and endings ("ות", "ית") – only check real words
    for (const t of tokens(st.caption)) if (t.length > 2) add(t, `trick ${tr.skill}`);
    for (const t of tokens(st.say)) if (t.length > 2) add(t, `trick ${tr.skill}`);
  }

// the deliberate wrong form after "ולא" in a tip is not checked
for (const t of allTips()) for (const w of tokens(t.text.replace(/ולא [\u05D0-\u05EA]+/g, ''))) if (w.length > 2) add(w, `tip ${t.id}`);

const errors: string[] = [];
const invalidCorrect = hspellInvalid([...correct.keys()]);
for (const w of invalidCorrect)
  if (!ALLOW.has(w) && !('ובהלכמש'.includes(w[0]) && ALLOW.has(w.slice(1)))) errors.push(`לא תקין לפי hspell: "${w}" (${correct.get(w)})`);

// ---------- 2. nikud matches the word ----------
const skeleton = (s: string) => heb(s).replace(/[וי]/g, '').replace(/[ךםןףץ]/g, (c) => FINAL_TO_REGULAR[c]);
for (const [skill, list] of Object.entries(WORDS))
  for (const e of list) if (e.n && skeleton(e.n) !== skeleton(e.w)) errors.push(`ניקוד לא תואם: ${e.w} / ${e.n} (${skill})`);

// ---------- 3. distractors ----------
function variants(word: string, skill: SkillId): string[] {
  const def = SKILLS.find((s) => s.id === skill)!;
  const out: string[] = [];
  const w = word;
  if (skill === 'finals') {
    const last = w[w.length - 1];
    if (FINAL_TO_REGULAR[last]) out.push(w.slice(0, -1) + FINAL_TO_REGULAR[last]);
    for (let i = 0; i < w.length - 1; i++) if (REGULAR_TO_FINAL[w[i]]) out.push(w.slice(0, i) + REGULAR_TO_FINAL[w[i]] + w.slice(i + 1));
    return out;
  }
  if (skill === 'he_alef_end') {
    if (w.endsWith('ה')) out.push(w.slice(0, -1) + 'א');
    if (w.endsWith('א')) out.push(w.slice(0, -1) + 'ה');
    return out;
  }
  for (let i = 0; i < w.length; i++)
    for (const g of def.groups)
      for (const other of g)
        if (g.includes(w[i]) && other && other !== w[i]) {
          let ch = other;
          if (i === w.length - 1 && REGULAR_TO_FINAL[ch]) ch = REGULAR_TO_FINAL[ch];
          if (i < w.length - 1 && FINAL_TO_REGULAR[ch]) ch = FINAL_TO_REGULAR[ch];
          out.push(w.slice(0, i) + ch + w.slice(i + 1));
        }
  return out;
}

const candidates: { skill: SkillId; word: string; list: string[]; keep: string[] }[] = [];
for (const [skill, list] of Object.entries(WORDS) as [SkillId, (typeof WORDS)[SkillId]][])
  for (const e of list)
    candidates.push({
      skill,
      word: e.w,
      list: [...new Set([...e.x, ...variants(e.w, skill)])].filter((x) => x !== e.w),
      // in כתיב מלא the explicit "wrong" forms are defective spellings (עפרון, ספור) – words in vocalized text,
      // but exactly the mistake being taught in unvocalized writing, so they are always kept
      keep: skill === 'full_spelling' ? e.x : [],
    });
const allCand = candidates.flatMap((c) => c.list.filter((x) => !x.includes(' ')));
const commonCand = hspellCommon(allCand);
const distractors: Record<string, Record<string, string[]>> = {};
const noDistractor: string[] = [];
for (const c of candidates) {
  // for ה/א at the end, rare verb forms ("אבה") are fine as wrong options – otherwise the answer would almost always be ה
  const bad = c.skill === 'he_alef_end' ? commonCand.nouns : commonCand.all;
  const ok = c.list.filter((x) => c.keep.includes(x) || x.includes(' ') || (!bad.has(x) && !correct.has(x)));
  (distractors[c.skill] ??= {})[c.word] = ok;
  if (!ok.length) noDistractor.push(`${c.skill}:${c.word}`);
}

// ---------- 4. misspellings for the offline checker ----------
const SWAPS: Record<string, string[]> = {
  'א': ['ע', 'ה'], 'ע': ['א'], 'ט': ['ת'], 'ת': ['ט'], 'כ': ['ח', 'ק'], 'ח': ['כ'], 'ק': ['כ'],
  'ך': ['ח'], 'ס': ['ש'], 'ש': ['ס'], 'ב': ['ו'], 'ו': ['ב'], 'ה': ['א'],
};
const fixFinals = (w: string) =>
  [...w].map((ch, i) => (i < w.length - 1 && FINAL_TO_REGULAR[ch] ? FINAL_TO_REGULAR[ch] : i === w.length - 1 && REGULAR_TO_FINAL[ch] && w.length > 1 ? REGULAR_TO_FINAL[ch] : ch)).join('');
const lexicon = [...correct.keys()].filter((w) => w.length >= 2 && !invalidCorrect.has(w));
const misCand = new Map<string, string>();
for (const c of lexicon) {
  const vs: string[] = [];
  for (let i = 0; i < c.length; i++) for (const s of SWAPS[c[i]] ?? []) vs.push(fixFinals(c.slice(0, i) + s + c.slice(i + 1)));
  for (let i = 1; i < c.length - 1; i++) if (c[i] === 'ו' || c[i] === 'י') vs.push(c.slice(0, i) + c.slice(i + 1));
  for (const v of vs) if (v !== c && !misCand.has(v) && !correct.has(v)) misCand.set(v, c);
}
const commonMis = hspellCommon([...misCand.keys()]);
const misspellings: Record<string, string> = {};
// the offline checker never "corrects" a common real word (e.g. אין → עין)
for (const [wrong, right] of [...misCand.entries()].sort()) if (!commonMis.all.has(wrong)) misspellings[wrong] = right;

// ---------- output ----------
const files: Record<string, string> = {
  'distractors.json': JSON.stringify(distractors, null, 0),
  'misspellings.json': JSON.stringify(misspellings, null, 0),
  'lexicon.json': JSON.stringify(lexicon.sort(), null, 0),
};
console.log(`correct words: ${correct.size}, distractor words checked: ${allCand.length}, misspellings: ${Object.keys(misspellings).length}`);
if (noDistractor.length) console.log(`words without a safe distractor (used only in typing games): ${noDistractor.length}\n  ${noDistractor.join(', ')}`);
if (errors.length) {
  console.error(`\n${errors.length} content errors:\n` + errors.join('\n'));
  process.exit(1);
}
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
let stale = false;
for (const [name, content] of Object.entries(files)) {
  const url = new URL(name, OUT);
  const old = existsSync(url) ? readFileSync(url, 'utf8') : '';
  if (old !== content) {
    stale = true;
    if (!CHECK) writeFileSync(url, content);
  }
}
if (CHECK && stale) {
  console.error('generated files are stale – run: npm run validate-content');
  process.exit(1);
}
console.log(CHECK ? 'content OK' : 'content OK – generated files updated');

/**
 * Collects every text the app speaks, for the recorded natural voice (scripts/voice-build.py).
 * Output: voice/texts.json – [{ text, nikud?, slow?, keys[] }]
 *   text   what the voice reads (full spelling – the nikud model vocalises it)
 *   nikud  our own vocalisation of single words, used to check the model's reading
 *   slow   also record a slow version (dictation, "listen & write")
 *   keys   lookup keys the app may use for this clip (voiceKey of every spelling of it)
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { WORDS, IM_SENTENCES } from '../src/data/words.ts';
import { DICTATIONS, SHORT_DICTATIONS, STORY_IDEAS } from '../src/data/stories.ts';
import { GUIDES } from '../src/data/guides.ts';
import { PRAISE, ENCOURAGE } from '../src/data/phrases.ts';
import { SKILLS } from '../src/data/skills.ts';
import { TRICKS } from '../src/tricks/tricks.ts';
import { voiceKey, voiceSegments } from '../src/services/voiceKey.ts';

interface Item {
  text: string;
  nikud?: string;
  slow?: boolean;
  keys: string[];
}
const items = new Map<string, Item>();

function add(text: string, opts: { nikud?: string; slow?: boolean; alias?: (string | undefined)[] } = {}) {
  const k = voiceKey(text);
  if (!k) return;
  const it = items.get(k) ?? { text, keys: [] as string[] };
  if (opts.nikud) it.nikud = opts.nikud;
  if (opts.slow) it.slow = true;
  for (const a of [text, ...(opts.alias ?? [])]) if (a && voiceKey(a) && !it.keys.includes(voiceKey(a))) it.keys.push(voiceKey(a));
  items.set(k, it);
}

/** A whole text plus each of its sentences, so combined phrases can be assembled from pieces. */
function addWithSegments(text: string, opts: { slow?: boolean } = {}) {
  add(text, opts);
  const segs = voiceSegments(text);
  if (segs.length > 1) for (const s of segs) add(s, opts);
}

// words (with our nikud as a pronunciation check), fast and slow
for (const list of Object.values(WORDS)) for (const e of list) add(e.w, { nikud: e.n, slow: true, alias: [e.n] });

// sentences
for (const s of IM_SENTENCES) add(s.s.replace('___', s.a), { slow: true });
for (const d of [...DICTATIONS, ...SHORT_DICTATIONS]) d.sentences.forEach((s, i) => add(s, { slow: true, alias: [d.spoken?.[i]] }));
for (const list of Object.values(STORY_IDEAS)) for (const i of list) add(i.text);
add('הרעיון לסיפור:');

// guides and tricks
for (const g of Object.values(GUIDES)) {
  addWithSegments(g.long);
  addWithSegments(g.short);
}
for (const t of Object.values(TRICKS)) for (const st of t.steps) addWithSegments(st.say);

// reactions and the fixed fragments games combine with a word
for (const p of [...PRAISE, ...ENCOURAGE]) addWithSegments(p);
for (const f of ['כותבים', 'זהירות!', 'אופס!', 'בבועה הזו יש טעות.', 'לא,', 'טוּ טוּ!', 'איזה יופי!', 'קיבלת כוכבים ונקודות בונוס!']) add(f);

// topic names, feedback phrases, shop items
for (const s of SKILLS) add(s.title);
for (const s of SKILLS) add(`כדאי לשים לב ל${s.title}, יש לי טריק בשבילך!`);
for (const f of ['וואו! אין אף טעות. אתה כותב מושלם!', 'כמעט מושלם! רק כמה טעויות קטנות.', 'עבודה יפה! תיקנו יחד כמה מילים.']) addWithSegments(f);
const itemsSrc = readFileSync(new URL('../src/room/items.ts', import.meta.url), 'utf8');
for (const m of itemsSrc.matchAll(/name: '([^']+)'/g)) add(`קנית ${m[1]}!`);

// every literal string passed to speak(...), useSpeakOnMount(...) or `say:` in the source
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}
for (const file of walk(new URL('../src', import.meta.url).pathname)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:speak|useSpeakOnMount)\(\s*'([^'\n]+)'/g)) addWithSegments(m[1]);
  for (const m of src.matchAll(/\bsay: '([^'\n]+)'/g)) addWithSegments(m[1]);
  for (const m of src.matchAll(/\btitle: '([^'\n]+)'/g)) if (/[א-ת]/.test(m[1])) add(m[1].replace(/[^א-ת ?!,.]/g, '').trim());
}

const out = [...items.values()];
mkdirSync(new URL('../voice/', import.meta.url), { recursive: true });
writeFileSync(new URL('../voice/texts.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`${out.length} clips (${out.filter((i) => i.slow).length} also slow)`);

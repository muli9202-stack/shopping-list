// Builds the offline study library for the Artifact version: every Bavli tractate with Rashi
// and Tosafot, every Mishnah tractate with Bartenura, the whole Tanakh, and Rashi, Ramban,
// Ibn Ezra and Sforno on the Torah. Source: Sefaria's public bulk export (merged Hebrew text)
// plus each version's license from the Sefaria API. Output: dist-artifact/chavruta-lib/lib/
//   index.json            book metadata (titles, categories, structure, editions, licenses)
//   <Book_Name>.json      the text of one book (plain JSON: Artifacts serve no archives)
// Run: node chavruta/scripts/build-library.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = new URL('../../dist-artifact/chavruta-lib/lib/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const API = 'https://www.sefaria.org/api';
const EXPORT = 'https://storage.googleapis.com/sefaria-export/json';

const lexicon = fs.readFileSync(new URL('../src/core/lexicon.ts', import.meta.url), 'utf8');
const pick = (re) => [...lexicon.matchAll(re)].map((m) => m[1]);
const bavli = pick(/bavli: '([^']+)'/g);
const mishnah = [...lexicon.matchAll(/mishnah: (?:"([^"]+)"|'([^']+)')/g)].map((m) => m[1] ?? m[2]);
const tanakh = pick(/sefaria: '([^']+)'/g);
const torah = tanakh.slice(0, 5);

const books = [
  ...bavli.flatMap((t) => [t, `Rashi on ${t}`, `Tosafot on ${t}`]),
  ...mishnah.flatMap((t) => [t, ...(t.startsWith('Mishnah ') ? [`Bartenura on ${t}`] : [])]),
  ...tanakh,
  ...torah.flatMap((b) => ['Rashi', 'Ramban', 'Ibn Ezra', 'Sforno'].map((c) => `${c} on ${b}`)),
];

async function json(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  return null;
}

/** Keeps only <b>/<strong>/<big> (דיבור המתחיל, opening words); drops footnotes and other markup. */
const cleanText = (t) =>
  Array.isArray(t)
    ? t.map(cleanText)
    : typeof t === 'string'
      ? t
          .replace(/<sup[^>]*>.*?<\/sup>|<i class="footnote">.*?<\/i>/g, '')
          .replace(/<(?!\/?(b|strong|big)>)[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : '';

const slug = (t) => t.replace(/[^A-Za-z0-9]+/g, '_');
const index = {};
const missing = [];
let done = 0;

async function build(title) {
  const meta = await json(`${API}/v2/index/${encodeURIComponent(title)}`);
  if (!meta?.categories) return missing.push(`${title}: no index`);
  const url = `${EXPORT}/${[...meta.categories, title].map(encodeURIComponent).join('/')}/Hebrew/merged.json`;
  const data = await json(url);
  if (!data?.text) return missing.push(`${title}: no export`);
  const versions = (await json(`${API}/texts/versions/${encodeURIComponent(title)}`)) ?? [];
  const used = (data.versions ?? []).map(([vt]) => {
    const v = versions.find((x) => x.versionTitle === vt && x.language === 'he');
    return { title: vt, heTitle: v?.versionTitleInHebrew ?? '', license: v?.license ?? 'unknown' };
  });
  // Books with an introduction come as {Introduction: …, "": main text}: keep the main text.
  const main = Array.isArray(data.text) ? data.text : (data.text[''] ?? Object.values(data.text).find(Array.isArray) ?? []);
  const defaultNode = meta.schema?.nodes?.find((n) => n.default) ?? meta.schema;
  const text = cleanText(main);
  const file = `${slug(title)}.json`;
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(text));
  index[title] = {
    file,
    he: meta.heTitle ?? data.heTitle,
    categories: meta.categories,
    sectionNames: defaultNode?.sectionNames ?? data.sectionNames ?? [],
    base: meta.base_text_titles?.[0]?.en ?? meta.base_text_titles?.[0] ?? null,
    collective: meta.collective_title?.en ?? meta.collective_title ?? null,
    versions: used,
    length: text.length,
  };
  if (++done % 20 === 0) console.log(`${done}/${books.length}`);
}

const queue = [...books];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) await build(queue.shift());
  }),
);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ builtAt: new Date().toISOString(), source: EXPORT, books: index }));
const size = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${Object.keys(index).length} books, ${(size / 1e6).toFixed(1)} MB. Missing: ${missing.length ? missing.join('; ') : 'none'}`);

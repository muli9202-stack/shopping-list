// Downloads the built-in study set from Sefaria's public API into src/data/snapshot.json,
// so the demo works offline and the tests run against real text. Run: node chavruta/scripts/build-snapshot.mjs
import fs from 'node:fs';

const SECTIONS = [
  { ref: 'Berakhot 2a', commentaries: ['Rashi on Berakhot', 'Tosafot on Berakhot'] },
  { ref: 'Berakhot 2b', commentaries: ['Rashi on Berakhot', 'Tosafot on Berakhot'] },
  { ref: 'Berakhot 3a', commentaries: ['Rashi on Berakhot', 'Tosafot on Berakhot'] },
  {
    ref: 'Mishnah Berakhot 1',
    commentaries: ['Bartenura on Mishnah Berakhot', 'Rambam on Mishnah Berakhot', 'Tosafot Yom Tov on Mishnah Berakhot'],
  },
  {
    ref: 'Genesis 1',
    commentaries: ['Rashi on Genesis', 'Ramban on Genesis', 'Ibn Ezra on Genesis', 'Sforno on Genesis'],
  },
];

const api = (ref) => `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew`;

async function getText(ref) {
  const res = await fetch(api(ref));
  if (!res.ok) throw new Error(`${ref}: HTTP ${res.status}`);
  const d = await res.json();
  const v = d.versions?.[0];
  if (!v) throw new Error(`${ref}: no Hebrew version`);
  return {
    ref: d.ref,
    heRef: d.heRef,
    indexTitle: d.indexTitle,
    heIndexTitle: d.heIndexTitle,
    categories: d.categories,
    sectionNames: d.sectionNames,
    next: d.next ?? null,
    prev: d.prev ?? null,
    text: v.text,
    version: {
      title: v.versionTitle,
      heTitle: v.versionTitleInHebrew || '',
      license: v.license,
      source: v.versionSource || '',
    },
  };
}

const out = { fetchedAt: new Date().toISOString(), source: 'https://www.sefaria.org/api/v3/texts', texts: {} };
for (const s of SECTIONS) {
  const base = await getText(s.ref);
  out.texts[base.ref] = base;
  const section = s.ref.replace(/^.*? (?=[^ ]+$)/, ''); // "2a" / "1"
  for (const c of s.commentaries) {
    const ref = `${c} ${section}`;
    try {
      const t = await getText(ref);
      out.texts[t.ref] = t;
    } catch (e) {
      console.warn('skip', ref, e.message);
    }
  }
  console.log('ok', s.ref);
}
const file = new URL('../src/data/snapshot.json', import.meta.url);
fs.writeFileSync(file, JSON.stringify(out));
console.log(Object.keys(out.texts).join('\n'), `\n${(fs.statSync(file).size / 1024).toFixed(0)} KiB`);

// Builds kitchen/src/seedRecipes.json from the built-in videos:
//  1. the video description, when it holds a full recipe (copied verbatim);
//  2. otherwise the chef's own recipe page linked from the description
//     (schema.org Recipe data, copied verbatim; see site_recipes.py);
//  3. otherwise, for channels whose descriptions were read, a "חסר" entry.
import fs from 'node:fs';
import { parseDescription } from '/home/user/shopping-list/kitchen/src/text.ts';
const videos = JSON.parse(fs.readFileSync('/home/user/shopping-list/kitchen/src/seedVideos.json', 'utf8')) as Record<string, [string, string, string, string[]?][]>;
const descs = JSON.parse(fs.readFileSync('/tmp/claude-0/yt/descs.json', 'utf8')) as Record<string, string>;
const site = fs.existsSync('/tmp/claude-0/yt/site.json')
  ? (JSON.parse(fs.readFileSync('/tmp/claude-0/yt/site.json', 'utf8')) as Record<string, { ing: string[]; steps: string[]; url: string } | null>)
  : {};
/** "1. a 2. b" in one line becomes separate steps; the words stay as written. */
function splitNumbered(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const parts = line.split(/(?:^|(?<=[\s.!?:]))(?=\d{1,2}\.\s?(?!\d))/).map((x) => x.trim()).filter(Boolean);
    const numbered = parts.filter((x) => /^\d{1,2}\./.test(x));
    if (numbered.length < 2) {
      out.push(line);
      continue;
    }
    for (const x of parts) out.push(x.replace(/^\d{1,2}\.\s*/, ''));
  }
  return out;
}

const full: unknown[] = [];
const missing: unknown[] = [];
const stat: Record<string, { desc: number; site: number; missing: number }> = {};
for (const [chef, list] of Object.entries(videos)) {
  stat[chef] = { desc: 0, site: 0, missing: 0 };
  for (const [id, title, cat] of list) {
    const d = descs[id];
    const p = d !== undefined ? parseDescription(d.replace(/ /g, ' ')) : null;
    if (p && !p.missing) {
      full.push([id, chef, cat, title, p.ingredients, p.steps]);
      stat[chef].desc++;
    } else if (site[id]) {
      const s = site[id]!;
      full.push([id, chef, cat, title, s.ing, splitNumbered(s.steps), s.url]);
      stat[chef].site++;
    } else if (d !== undefined) {
      missing.push([id, chef, cat, title, [], []]);
      stat[chef].missing++;
    }
  }
}
const rows = [...full, ...missing];
fs.writeFileSync(process.argv[2] ?? '/tmp/claude-0/yt/recipes.json', JSON.stringify(rows));
console.table(stat);
console.log('full', full.length, 'missing', missing.length, (JSON.stringify(rows).length / 1024).toFixed(0), 'KiB');

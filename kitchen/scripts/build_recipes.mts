import fs from 'node:fs';
import { parseDescription } from '/home/user/shopping-list/kitchen/src/text.ts';
const videos = JSON.parse(fs.readFileSync('/home/user/shopping-list/kitchen/src/seedVideos.json', 'utf8')) as Record<string, [string, string, string, string[]?][]>;
const descs = JSON.parse(fs.readFileSync('/tmp/claude-0/yt/descs.json', 'utf8')) as Record<string, string>;
const rows: unknown[] = [];
const missing: unknown[] = [];
const stat: Record<string, [number, number]> = {};
const samples: string[] = [];
for (const [chef, list] of Object.entries(videos)) {
  for (const [id, title, cat] of list) {
    const d = descs[id];
    if (d === undefined) continue;
    const p = parseDescription(d.replace(/ /g, ' '));
    stat[chef] ??= [0, 0];
    stat[chef][0]++;
    if (p.missing) {
      missing.push([id, chef, cat, title, [], []]);
      continue;
    }
    stat[chef][1]++;
    rows.push([id, chef, cat, title, p.ingredients, p.steps]);
    if (samples.length < 6 && Math.random() < 0.05) samples.push(`## ${title}\nING: ${p.ingredients.slice(0, 8).join(' / ')}\nSTEPS: ${p.steps.slice(0, 4).join(' / ')}`);
  }
}
rows.push(...missing);
fs.writeFileSync(process.argv[2] ?? '/tmp/claude-0/yt/recipes.json', JSON.stringify(rows));
console.log(stat);
console.log('recipes', rows.length, (JSON.stringify(rows).length / 1024).toFixed(0), 'KiB');
console.log(samples.join('\n\n'));

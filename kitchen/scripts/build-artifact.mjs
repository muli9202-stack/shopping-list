// Turns the artifact build into one self-contained page body for a claude.ai
// Artifact (the viewer adds <html>/<head>/<body> itself).
import fs from 'node:fs';
import path from 'node:path';

const dir = new URL('../../dist-artifact/', import.meta.url).pathname;
const html = fs.readFileSync(path.join(dir, 'artifact.html'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(dir, rel.replace(/^\.\//, '')), 'utf8');

const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => read(m[1])).join('\n');
const js = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => read(m[1]).replace(/<\/script/gi, '<\\/script')).join('\n');

const page = `<title>המטבח שלי</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap" />
<style>
${css}
</style>
<div id="root" dir="rtl" lang="he"><div class="boot">טוען…</div></div>
<script type="module">
document.documentElement.lang = 'he';
document.documentElement.dir = 'rtl';
${js}
</script>
`;
// The built-in videos and recipes are published next to the page and fetched at run time.
for (const f of ['seed-videos.json', 'seed-recipes.json']) {
  fs.copyFileSync(new URL(`../../public/kitchen/${f}`, import.meta.url), path.join(dir, f));
}
const out = path.join(dir, 'kitchen.html');
fs.writeFileSync(out, page);
console.log(`${out} ${(page.length / 1024).toFixed(0)} KiB`);

// Turns the artifact build into one self-contained page body for a claude.ai Artifact
// (the viewer adds <html>/<head>/<body> itself).
import fs from 'node:fs';
import path from 'node:path';

const dir = new URL('../../dist-artifact/chavruta/', import.meta.url).pathname;
const html = fs.readFileSync(path.join(dir, 'artifact.html'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(dir, rel.replace(/^\.\//, '')), 'utf8');

const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => read(m[1])).join('\n');
const js = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => read(m[1]).replace(/<\/script/gi, '<\\/script')).join('\n');

const page = `<title>החברותא שלי</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&family=Frank+Ruhl+Libre:wght@400;700&display=swap" />
<style>
${css}
</style>
<div id="root" dir="rtl" lang="he"></div>
<script type="module">
document.documentElement.lang = 'he';
document.documentElement.dir = 'rtl';
${js}
</script>
`;
const out = path.join(dir, 'chavruta.html');
fs.writeFileSync(out, page);
console.log(`${out} ${(page.length / 1024).toFixed(0)} KiB`);

// Turns the artifact build into one self-contained page body for a claude.ai
// Artifact (the viewer adds <html>/<head>/<body> itself).
import fs from 'node:fs';
import path from 'node:path';

const dir = new URL('../../dist-artifact/omega/', import.meta.url).pathname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(dir, rel.replace(/^\.\//, '')), 'utf8');

const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => read(m[1])).join('\n');
const js = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => read(m[1]).replace(/<\/script/gi, '<\\/script')).join('\n');
// The title screen markup from index.html's <body>, without its module script.
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');

const page = `<title>פרויקט אומגה</title>
<style>
:root { color-scheme: dark; }
${css}
</style>
${body}
<script type="module">
document.documentElement.lang = 'he';
document.documentElement.dir = 'rtl';
${js}
</script>
`;
const out = path.join(dir, 'omega.html');
fs.writeFileSync(out, page);
console.log(`${out} ${(page.length / 1024).toFixed(0)} KiB`);

// The same page as a complete document: download it and open it in any browser, offline.
const standalone = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
${page}</head>
</html>
`.replace('</title>\n<style>', '</title>\n<style>').replace(/<\/style>\n([\s\S]*)<\/head>/, '</style>\n</head>\n<body>\n$1</body>');
const out2 = path.join(dir, 'omega-game.html');
fs.writeFileSync(out2, standalone);
console.log(`${out2} ${(standalone.length / 1024).toFixed(0)} KiB`);

// Builds the guide into one self-contained HTML file.
//   node guide/build.mjs                -> public/guide.html (full document, served by the app)
//   node guide/build.mjs --fragment OUT -> OUT without <html>/<head>/<body> (for hosts that add their own skeleton)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(dir, f), "utf8");
const chapters = readdirSync(join(dir, "chapters")).filter(f => f.endsWith(".html")).sort().map(f => read("chapters/" + f)).join("\n");

const modules = readdirSync(join(dir, "js")).filter(f => f.endsWith(".js")).sort().map(f => read("js/" + f)).join("\n");

const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Hebrew:wght@400;600;700&family=Secular+One&display=swap">`;

const body = `<header class="topbar">
  <button class="icon-btn menu-btn" id="menu-btn" aria-label="תפריט פרקים">☰ פרקים</button>
  <div class="brand"><span class="logo">&lt;/&gt;</span><b>מאסטר קוד</b><small>המדריך השלם לתכנות, אפליקציות, משחקים ו-AI</small></div>
  <span class="spacer"></span>
  <div class="progress-bar" aria-hidden="true"><i id="progress-fill"></i></div>
  <span class="progress-pill" id="progress-text"></span>
  <button class="icon-btn xp-btn" id="xp-btn" aria-label="הפרופיל שלי: רמה, הישגים והגדרות">רמה 1</button>
</header>
<div class="profile" id="profile" hidden>
  <div class="profile-card" role="dialog" aria-label="הפרופיל שלי">
    <div class="profile-head"><b>הפרופיל שלי</b><button class="icon-btn profile-close" aria-label="סגור">✕</button></div>
    <div class="profile-body"></div>
  </div>
</div>
<div class="shell">
  <nav class="toc" id="toc" aria-label="תוכן העניינים">
    <input class="toc-search" id="toc-filter" type="search" placeholder="חפש פרק..." aria-label="חפש פרק">
    <div id="toc-list"></div>
  </nav>
  <main id="main">
${chapters}
  </main>
</div>
<script>${read("glossary-a.js")}
${read("glossary-b.js")}
${read("glossary-c.js")}
${read("glossary-d.js")}</script>
<script>${modules}</script>
<script>${read("app.js")}</script>`;

const title = "<title>מאסטר קוד</title>";
const args = process.argv.slice(2);
if (args[0] === "--fragment") {
  writeFileSync(args[1], `${title}\n${fonts}\n<style>${read("app.css")}</style>\n${body}\n`);
  console.log("wrote", args[1]);
} else {
  const out = join(dir, "..", "public", "guide.html");
  writeFileSync(out, `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#e2551b">
${title}
${fonts}
<style>${read("app.css")}</style>
</head>
<body>
${body}
</body>
</html>
`);
  console.log("wrote", out);
}

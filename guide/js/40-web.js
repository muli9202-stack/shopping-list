// Demos: CSS flexbox, SQL, Git graph, flashcards, engine picker
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});

  /* ---------------- Flexbox playground ---------------- */
  D.flex = d => {
    const { el, head } = MG;
    head(d, "מעבדה · Flexbox", "סדר קופסאות כמו מקצוען", "שנה את ההגדרות וראה איך הקופסאות זזות. זה הכלי שבעזרתו מסדרים תפריטים, כרטיסים וכפתורים בכל אתר מודרני. מתחת מופיע קוד ה-CSS שמתאים בדיוק למה שאתה רואה.");
    const opts = {
      "flex-direction": ["row", "row-reverse", "column", "column-reverse"],
      "justify-content": ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"],
      "align-items": ["stretch", "flex-start", "center", "flex-end"],
      "flex-wrap": ["nowrap", "wrap"],
      "gap": ["0px", "8px", "16px", "32px"],
    };
    const he = { "flex-direction": "כיוון", "justify-content": "פיזור בציר הראשי", "align-items": "יישור בציר השני", "flex-wrap": "שבירת שורה", "gap": "רווח" };
    const cur = { "flex-direction": "row", "justify-content": "space-between", "align-items": "center", "flex-wrap": "nowrap", gap: "8px" };
    let count = 4;
    const stage = el("div", { class: "flex-stage", style: "direction:ltr" });
    const code = el("pre", {}, el("code"));
    const ctr = el("div", { class: "grid2" });
    Object.entries(opts).forEach(([k, vals]) => {
      const s = el("select", { id: "fx-" + k, "aria-label": k }, ...vals.map(v => el("option", { value: v }, v)));
      s.value = cur[k];
      s.onchange = () => { cur[k] = s.value; draw(); };
      ctr.append(el("label", {}, `${he[k]} (${k})`, s));
    });
    const draw = () => {
      Object.entries(cur).forEach(([k, v]) => stage.style.setProperty(k, v));
      stage.innerHTML = "";
      for (let i = 1; i <= count; i++) stage.append(el("i", { style: `padding:${8 + (i % 3) * 6}px ${12 + (i % 2) * 10}px` }, String(i)));
      code.firstChild.textContent = `.container {\n  display: flex;\n${Object.entries(cur).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`;
    };
    d.append(ctr, el("div", { class: "row", style: "margin-top:8px" }, el("button", { onclick: () => { count = Math.min(12, count + 1); draw(); } }, "+ קופסה"), el("button", { onclick: () => { count = Math.max(1, count - 1); draw(); } }, "− קופסה")), stage, code);
    draw();
  };

  /* ---------------- Mini SQL engine ---------------- */
  const PLAYERS = [
    { id: 1, name: "נועה", age: 14, city: "חיפה", game: "Minecraft", score: 870 },
    { id: 2, name: "איתי", age: 15, city: "תל אביב", game: "Fortnite", score: 1250 },
    { id: 3, name: "מאיה", age: 13, city: "ירושלים", game: "Roblox", score: 640 },
    { id: 4, name: "דניאל", age: 16, city: "חיפה", game: "GTA", score: 1530 },
    { id: 5, name: "יעל", age: 14, city: "באר שבע", game: "Minecraft", score: 990 },
    { id: 6, name: "עומר", age: 12, city: "תל אביב", game: "Roblox", score: 410 },
    { id: 7, name: "תמר", age: 15, city: "ירושלים", game: "Fortnite", score: 1100 },
    { id: 8, name: "אריאל", age: 14, city: "חיפה", game: "GTA", score: 1320 },
    { id: 9, name: "שירה", age: 13, city: "אילת", game: "Minecraft", score: 720 },
    { id: 10, name: "רון", age: 16, city: "באר שבע", game: "Fortnite", score: 1480 },
  ];
  function runSQL(q, rows) {
    const s = q.trim().replace(/;$/, "");
    const m = s.match(/^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(\w+)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?$/i);
    if (!m) throw new Error("לא הבנתי. המבנה: SELECT עמודות FROM players [WHERE תנאי] [ORDER BY עמודה [DESC]] [LIMIT n]");
    const [, colsRaw, table, where, ord, dir, lim] = m;
    if (table.toLowerCase() !== "players") throw new Error(`אין טבלה בשם "${table}". יש רק players.`);
    const cols = Object.keys(rows[0]);
    let out = rows.slice();
    if (where) {
      const conds = where.split(/\s+and\s+/i).map(c => {
        const mm = c.trim().match(/^(\w+)\s*(=|!=|<>|>=|<=|>|<|like)\s*(.+)$/i);
        if (!mm) throw new Error(`תנאי לא תקין: "${c}"`);
        let [, col, op, val] = mm;
        if (!cols.includes(col)) throw new Error(`אין עמודה בשם "${col}". יש: ${cols.join(", ")}`);
        val = val.trim(); const str = /^'.*'$/.test(val) || /^".*"$/.test(val);
        const v = str ? val.slice(1, -1) : Number(val);
        if (!str && isNaN(v)) throw new Error(`ערך טקסט צריך מירכאות: '${val}'`);
        return r => { const x = r[col]; switch (op.toLowerCase()) { case "=": return x == v; case "!=": case "<>": return x != v; case ">": return x > v; case "<": return x < v; case ">=": return x >= v; case "<=": return x <= v; case "like": return String(x).includes(String(v).replace(/%/g, "")); } };
      });
      out = out.filter(r => conds.every(f => f(r)));
    }
    let agg = null;
    const cm = colsRaw.trim().match(/^(count|avg|max|min|sum)\((\*|\w+)\)$/i);
    if (cm) {
      const [, fn, c] = cm, vals = out.map(r => c === "*" ? 1 : r[c]);
      const f = fn.toLowerCase();
      const v = f === "count" ? out.length : f === "sum" ? vals.reduce((a, b) => a + b, 0) : f === "avg" ? Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1) * 10) / 10 : f === "max" ? Math.max(...vals) : Math.min(...vals);
      agg = [{ [colsRaw.trim()]: v }];
    }
    if (ord) { if (!cols.includes(ord)) throw new Error(`אין עמודה "${ord}" למיון`); out.sort((a, b) => (a[ord] > b[ord] ? 1 : a[ord] < b[ord] ? -1 : 0) * (dir && dir.toLowerCase() === "desc" ? -1 : 1)); }
    if (lim) out = out.slice(0, +lim);
    if (agg) return agg;
    const pick = colsRaw.trim() === "*" ? cols : colsRaw.split(",").map(c => c.trim());
    pick.forEach(c => { if (!cols.includes(c)) throw new Error(`אין עמודה בשם "${c}"`); });
    return out.map(r => Object.fromEntries(pick.map(c => [c, r[c]])));
  }
  D.sql = d => {
    const { el, head } = MG;
    head(d, "מעבדה · SQL", "שאל שאלות את מסד הנתונים", "יש כאן טבלה בשם players עם 10 שחקנים. כתוב שאילתה ב-SQL (או לחץ על דוגמה) ולחץ ״הרץ״. מילות המפתח באנגלית: SELECT = בחר, FROM = מתוך, WHERE = איפה, ORDER BY = מיין לפי, DESC = מהגדול לקטן, LIMIT = רק כמה.");
    const ex = [
      "SELECT * FROM players",
      "SELECT name, score FROM players ORDER BY score DESC LIMIT 3",
      "SELECT name, city FROM players WHERE game = 'GTA'",
      "SELECT * FROM players WHERE age >= 14 AND city = 'חיפה'",
      "SELECT COUNT(*) FROM players WHERE game = 'Minecraft'",
      "SELECT AVG(score) FROM players",
      "SELECT name FROM players WHERE name LIKE '%ה%'",
    ];
    const ta = el("textarea", { rows: "2", id: "sql-q", spellcheck: "false", "aria-label": "שאילתה" });
    ta.value = ex[1];
    const out = el("div");
    const run = () => {
      out.innerHTML = "";
      try {
        const r = runSQL(ta.value, PLAYERS);
        if (!r.length) { out.append(el("p", {}, "אין תוצאות.")); return; }
        const cols = Object.keys(r[0]);
        out.append(el("div", { class: "note" }, `${r.length} שורות:`), el("div", { class: "table-wrap" }, el("table", {}, el("tr", {}, ...cols.map(c => el("th", {}, c))), ...r.map(row => el("tr", {}, ...cols.map(c => el("td", {}, String(row[c]))))))));
      } catch (e) { out.append(el("div", { class: "test-row bad", style: "direction:rtl;text-align:right" }, "שגיאה: " + e.message)); }
    };
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } });
    d.append(el("div", { class: "row" }, ...ex.map((q, i) => el("button", { onclick: () => { ta.value = q; run(); } }, "דוגמה " + (i + 1)))), ta,
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: run }, "▶ הרץ שאילתה"), el("span", { class: "note" }, "עמודות: id, name, age, city, game, score · אפשר גם COUNT, AVG, MAX, MIN, SUM")), out);
    run();
  };

  /* ---------------- Git visualizer ---------------- */
  D.git = d => {
    const { el, head } = MG;
    head(d, "מעבדה · Git", "ראה את ההיסטוריה של הקוד", "כל עיגול הוא commit (נקודת שמירה). נסה: צור ענף חדש (branch), עשה בו כמה commits, חזור ל-main (checkout), ואז מזג (merge). כך צוותים של מאות מתכנתים עובדים על אותו משחק בלי לדרוס אחד את השני.");
    const svgNS = "http://www.w3.org/2000/svg";
    const holder = el("div", { style: "background:#05080c;border-radius:8px;overflow-x:auto;direction:ltr" });
    const log = el("div", { class: "out", style: "min-height:0;max-height:140px" });
    const msgs = ["הוספתי שחקן", "תנועה עם חיצים", "קפיצה", "תיקון באג בקפיצה", "אויבים", "צלילים", "תפריט ראשי", "מכוניות", "שיפור ביצועים", "משטרה", "מפה חדשה", "טקסטורות"];
    let commits, branches, headB, lanes, mi;
    const reset = () => {
      commits = [{ id: 0, msg: "התחלה", lane: 0, parents: [] }];
      branches = { main: 0 }; headB = "main"; lanes = { main: 0 }; mi = 0; log.textContent = "git init\ngit commit -m \"התחלה\"";
      draw();
    };
    const add = line => { log.textContent += "\n" + line; log.scrollTop = 1e6; };
    const commit = () => {
      const m = msgs[mi++ % msgs.length];
      const c = { id: commits.length, msg: m, lane: lanes[headB], parents: [branches[headB]] };
      commits.push(c); branches[headB] = c.id;
      add(`git commit -m "${m}"`); draw();
    };
    const branch = () => {
      const names = ["feature/cars", "feature/police", "fix/jump", "feature/map"];
      const name = names.find(n => !(n in branches));
      if (!name) { add("# יש מספיק ענפים לדוגמה הזאת"); return; }
      branches[name] = branches[headB]; lanes[name] = Object.keys(lanes).length; headB = name;
      add(`git checkout -b ${name}`); draw();
    };
    const checkoutMain = () => { headB = "main"; add("git checkout main"); draw(); };
    const merge = () => {
      if (headB !== "main") { add("# קודם עוברים ל-main ואז ממזגים אליו"); return; }
      const anc = new Set(), st = [branches.main];
      while (st.length) { const x = st.pop(); if (anc.has(x)) continue; anc.add(x); commits[x].parents.forEach(p => st.push(p)); }
      const other = Object.keys(branches).find(b => b !== "main" && !anc.has(branches[b]));
      if (!other) { add("# אין ענף עם שינויים חדשים למזג"); return; }
      const c = { id: commits.length, msg: "מיזוג " + other, lane: 0, parents: [branches.main, branches[other]] };
      commits.push(c); branches.main = c.id;
      add(`git merge ${other}`); draw();
    };
    const draw = () => {
      const svg = document.createElementNS(svgNS, "svg");
      const W = Math.max(440, commits.length * 56 + 40), LH = 46, H = Math.max(2, Object.keys(lanes).length) * LH + 30;
      svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const pos = c => [30 + c.id * 56, 26 + c.lane * LH];
      const mk = (tag, attrs) => { const n = document.createElementNS(svgNS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); svg.append(n); return n; };
      const LC = ["#ffb454", "#7fb0ff", "#5fd08f", "#e27bff", "#ff6b6b"];
      commits.forEach(c => c.parents.forEach(p => { const [x1, y1] = pos(commits[p]), [x2, y2] = pos(c); mk("path", { d: `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`, stroke: LC[c.lane % 5], "stroke-width": 3, fill: "none" }); }));
      commits.forEach(c => { const [x, y] = pos(c); mk("circle", { cx: x, cy: y, r: 10, fill: LC[c.lane % 5], stroke: "#05080c", "stroke-width": 3 }); });
      Object.entries(branches).forEach(([b, id]) => { const [x, y] = pos(commits[id]); const t = mk("text", { x: x, y: y + 26, fill: b === headB ? "#fff" : "#7d8fa6", "font-size": 11, "font-family": "monospace", "text-anchor": "middle" }); t.textContent = (b === headB ? "HEAD→" : "") + b; });
      holder.innerHTML = ""; holder.append(svg);
    };
    d.append(holder, el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: commit }, "commit"), el("button", { onclick: branch }, "branch (ענף חדש)"),
      el("button", { onclick: checkoutMain }, "checkout main"), el("button", { onclick: merge }, "merge (מזג ל-main)"), el("button", { onclick: reset }, "התחל מחדש")),
      el("div", { class: "note" }, "הפקודות שהיית מקליד בטרמינל:"), log);
    reset();
  };

  /* ---------------- Flashcards for the glossary (spaced repetition light) ---------------- */
  D.flashcards = d => {
    const { el, head, store, award, GLOSSARY } = MG;
    head(d, "כרטיסיות · חזרה מרווחת", "תלמד את כל המונחים", "רואים מונח באנגלית, מנסים להיזכר מה הוא, ומסובבים. ״ידעתי״ שולח את הכרטיס לחזרה מאוחרת יותר, ״עוד לא״ מחזיר אותו בקרוב. ככה המוח זוכר לטווח ארוך.");
    let box = store.get("cards", {}); // en -> {lvl, due}
    const now = () => Date.now();
    const pick = () => {
      const due = GLOSSARY.filter(g => { const b = box[g.en]; return !b || b.due <= now(); });
      const fresh = due.filter(g => !box[g.en]), review = due.filter(g => box[g.en]);
      const pool = review.length ? review : fresh;
      return pool.length ? pool[(Math.random() * Math.min(pool.length, 12)) | 0] : null;
    };
    let cur = null, flipped = false;
    const card = el("div", { class: "card-q", role: "button", tabindex: "0" });
    const stats = el("div", { class: "note", style: "font-variant-numeric:tabular-nums" });
    const btns = el("div", { class: "row", style: "justify-content:center;margin-top:10px" });
    const draw = () => {
      const learned = Object.values(box).filter(b => b.lvl >= 2).length;
      stats.textContent = `למדת ${learned} מתוך ${GLOSSARY.length} מונחים · בכרטיסיות: ${Object.keys(box).length}`;
      card.innerHTML = ""; btns.innerHTML = "";
      if (!cur) { card.append(el("div", { class: "he" }, "אין כרטיסים לחזרה כרגע. כל הכבוד! חזור מאוחר יותר.")); return; }
      card.append(el("div", { class: "en" }, cur.en));
      if (!flipped) { card.append(el("div", { class: "note" }, "מה זה? נסה להיזכר, ואז לחץ על הכרטיס")); btns.append(el("button", { class: "primary", onclick: flip }, "הפוך כרטיס")); }
      else {
        card.append(el("div", { class: "note" }, "נהגה: " + cur.say), el("div", { class: "he" }, cur.he), el("div", { style: "font-size:15px;line-height:1.6" }, cur.d));
        btns.append(el("button", { onclick: () => grade(false) }, "עוד לא ✕"), el("button", { class: "primary", onclick: () => grade(true) }, "ידעתי ✓"));
      }
    };
    const flip = () => { flipped = true; draw(); };
    const grade = ok => {
      const b = box[cur.en] || { lvl: 0, due: 0 };
      b.lvl = ok ? b.lvl + 1 : 0;
      const mins = [1, 10, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 21][Math.min(5, b.lvl)];
      b.due = now() + mins * 60000;
      box[cur.en] = b; store.set("cards", box);
      if (ok && b.lvl >= 2) award("card:" + cur.en, 2, "למדת מונח");
      cur = pick(); flipped = false; draw();
    };
    card.addEventListener("click", () => { if (cur && !flipped) flip(); });
    card.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && cur && !flipped) { e.preventDefault(); flip(); } });
    d.append(card, btns, stats);
    cur = pick(); draw();
  };

  /* ---------------- Engine picker ---------------- */
  D.enginepick = d => {
    const { el, head } = MG;
    head(d, "מעבדה · בחירת מנוע", "איזה מנוע משחק מתאים לך?", "ענה על 4 שאלות וקבל המלצה עם הסבר.");
    const Q = [
      ["איזה מחשב יש לך?", [["חלש / ישן / Chromebook", { godot: 3, roblox: 2, web: 3 }], ["בינוני", { godot: 2, unity: 2, roblox: 1 }], ["חזק עם כרטיס מסך טוב", { unreal: 3, unity: 2 }]]],
      ["איזה משחק אתה רוצה לבנות קודם?", [["דו-ממדי (פלטפורמה, פיקסל-ארט)", { godot: 3, unity: 1, web: 2 }], ["תלת-ממד מציאותי כמו GTA", { unreal: 3, unity: 1 }], ["משחק רב-משתתפים עם חברים", { roblox: 3, unity: 1 }], ["משחק לטלפון", { unity: 3, godot: 1 }]]],
      ["כמה ניסיון בתכנות יש לך?", [["כמעט אפס", { roblox: 2, godot: 2, web: 1 }], ["קצת JavaScript", { web: 3, godot: 1 }], ["כבר מרגיש בנוח", { unity: 2, unreal: 1 }]]],
      ["מה הכי חשוב לך?", [["ללמוד מהר ולראות תוצאות", { godot: 2, roblox: 2, web: 1 }], ["הכי הרבה מדריכים ועזרה", { unity: 3, unreal: 1 }], ["גרפיקה מדהימה", { unreal: 3 }], ["ששחקנים אמיתיים ישחקו מיד", { roblox: 3, web: 1 }]]],
    ];
    const R = {
      godot: ["Godot", "קל, חינמי לגמרי, קוד פתוח ורץ על כל מחשב. השפה GDScript דומה ל-Python. מעולה לדו-ממד, ומתקדם יפה בתלת-ממד. התחל במדריך הרשמי ״Your first 2D game״."],
      unity: ["Unity", "המנוע עם הכי הרבה מדריכים ביוטיוב ובקורסים. שפה: C#. מצוין לטלפון, ל-VR ולכל סוג משחק. התחל ב-Unity Learn, מסלול ״Unity Essentials״."],
      unreal: ["Unreal Engine", "גרפיקה ברמה של המשחקים הכי גדולים. התחל עם Blueprints (תכנות בקוביות) ולא עם C++. יש תבנית מוכנה לרכב ולדמות גוף שלישי. דורש מחשב חזק."],
      roblox: ["Roblox Studio", "יש לך קהל של מיליוני שחקנים מהיום הראשון, ומולטיפלייר מובנה. שפה: Luau. מקום נהדר להתחיל ואפילו להרוויח (עם הורה)."],
      web: ["JavaScript בדפדפן (Canvas / Phaser / Three.js)", "אתה כבר לומד JavaScript! משחקים בדפדפן רצים בכל מחשב וטלפון, ואפשר לשלוח קישור לחברים. בדיוק כמו המעבדות במדריך."],
    };
    const ans = [];
    const box = el("div");
    const draw = () => {
      box.innerHTML = "";
      if (ans.length < Q.length) {
        const [q, os] = Q[ans.length];
        box.append(el("p", { style: "color:var(--screen-fg);font-weight:700" }, `${ans.length + 1}/${Q.length}. ${q}`), el("div", { class: "row" }, ...os.map(([t, sc]) => el("button", { onclick: () => { ans.push(sc); draw(); } }, t))));
        return;
      }
      const tot = {}; ans.forEach(s => Object.entries(s).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v));
      const sorted = Object.entries(tot).sort((a, b) => b[1] - a[1]);
      const [best, second] = sorted;
      box.append(el("div", { class: "big", style: "font-family:var(--font-display);font-size:30px" }, "ההמלצה: " + R[best[0]][0]), el("p", { style: "color:var(--screen-fg)" }, R[best[0]][1]),
        second ? el("p", {}, "אפשרות שנייה: " + R[second[0]][0]) : null, el("button", { onclick: () => { ans.length = 0; draw(); } }, "התחל מחדש"));
    };
    d.append(box); draw();
  };
})();

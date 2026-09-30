(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem("mg:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("mg:" + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  const chapters = $$(".chapter");
  const toc = $("#toc");
  const tocList = $("#toc-list");
  let done = new Set(store.get("done", []));
  const demoInit = new Set();
  let current = null;

  /* ---------------- Table of contents ---------------- */
  function buildToc() {
    let part = null;
    chapters.forEach((c, i) => {
      if (c.dataset.part && c.dataset.part !== part) {
        part = c.dataset.part;
        tocList.append(el("h4", {}, part));
      }
      const a = el("a", { href: "#" + c.id, "data-id": c.id },
        el("span", { class: "n" }, el("span", {}, String(i).padStart(2, "0"))),
        el("span", {}, c.dataset.title));
      tocList.append(a);
    });
  }
  function refreshProgress() {
    const total = chapters.length;
    const n = chapters.filter(c => done.has(c.id)).length;
    $("#progress-text").textContent = `${n} מתוך ${total} פרקים`;
    $("#progress-fill").style.width = (100 * n / total) + "%";
    $$("#toc-list a").forEach(a => a.classList.toggle("done", done.has(a.dataset.id)));
    chapters.forEach(c => {
      const b = $(".done-btn", c);
      if (!b) return;
      const d = done.has(c.id);
      b.classList.toggle("is-done", d);
      b.textContent = d ? "✓ סיימתי את הפרק" : "סמן: סיימתי את הפרק";
    });
  }
  function addFooters() {
    chapters.forEach((c, i) => {
      const prev = chapters[i - 1], next = chapters[i + 1];
      const foot = el("div", { class: "chapter-foot" },
        prev ? el("button", { onclick: () => go(prev.id) }, "→ " + prev.dataset.title) : el("span"),
        el("button", { class: "done-btn", onclick: () => { done.has(c.id) ? done.delete(c.id) : done.add(c.id); store.set("done", [...done]); refreshProgress(); if (done.has(c.id)) award("done:" + c.id, 50, "סיימת פרק"); } }, ""),
        next ? el("button", { onclick: () => go(next.id) }, next.dataset.title + " ←") : el("span"));
      c.append(foot);
    });
  }
  function show(id) {
    const target = chapters.find(c => c.id === id) || chapters[0];
    chapters.forEach(c => { c.hidden = c !== target; });
    current = target.id;
    $$("#toc-list a").forEach(a => a.classList.toggle("active", a.dataset.id === target.id));
    document.title = target.dataset.title + " · מאסטר קוד";
    store.set("last", target.id);
    initDemos(target);
    toc.classList.remove("open");
  }
  function go(id) {
    if (location.hash !== "#" + id) location.hash = id; else show(id);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => { show(location.hash.slice(1)); window.scrollTo(0, 0); });
  $("#menu-btn").addEventListener("click", () => toc.classList.toggle("open"));
  let textCache = null;
  $("#toc-filter").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if (!textCache) textCache = new Map(chapters.map(c => [c.id, c.textContent.toLowerCase()]));
    $$("#toc-list h4").forEach(h => { h.hidden = !!q; });
    $$("#toc-list a").forEach(a => {
      let badge = $(".hits", a);
      if (!q) { a.hidden = false; if (badge) badge.remove(); return; }
      const txt = textCache.get(a.dataset.id);
      let n = 0, i = txt.indexOf(q);
      while (i !== -1 && n < 99) { n++; i = txt.indexOf(q, i + q.length); }
      a.hidden = n === 0;
      if (!badge) { badge = el("span", { class: "hits" }); a.append(badge); }
      badge.textContent = n;
    });
  });
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href^='#']");
    if (a && chapters.some(c => "#" + c.id === a.getAttribute("href"))) { e.preventDefault(); go(a.getAttribute("href").slice(1)); }
  });

  /* ---------------- Glossary ---------------- */
  const G = window.GLOSSARY || [];
  const gIndex = new Map();
  G.forEach(g => {
    gIndex.set(g.en.toLowerCase(), g);
    (g.alt || []).forEach(a => gIndex.set(a.toLowerCase(), g));
  });
  function renderGlossary() {
    const list = $("#gloss-list");
    if (!list) return;
    const sorted = [...G].sort((a, b) => a.en.localeCompare(b.en, "en", { sensitivity: "base" }));
    const draw = q => {
      list.innerHTML = "";
      q = q.trim().toLowerCase();
      let n = 0;
      for (const g of sorted) {
        const hay = (g.en + " " + g.he + " " + g.say + " " + (g.full || "") + " " + g.d).toLowerCase();
        if (q && !hay.includes(q)) continue;
        n++;
        list.append(el("article", { class: "gloss-item", id: "g-" + g.en.replace(/\W+/g, "-").toLowerCase() },
          el("header", {},
            el("span", { class: "en" }, g.en),
            el("span", { class: "say" }, "נהגה: " + g.say),
            el("span", { class: "he" }, g.he),
            g.full ? el("span", { class: "full" }, g.full) : null),
          el("p", {}, g.d)));
      }
      $("#gloss-count").textContent = `${n} מונחים`;
    };
    $("#gloss-q").addEventListener("input", e => draw(e.target.value));
    draw("");
  }
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener("click", e => {
    const t = e.target.closest(".t");
    if (!t) { if (pop && !e.target.closest(".pop")) closePop(); return; }
    const key = (t.dataset.t || t.textContent).trim().toLowerCase();
    const g = gIndex.get(key);
    closePop();
    if (!g) return;
    pop = el("div", { class: "pop", role: "dialog" },
      el("div", {}, el("span", { class: "en" }, g.en), " · ", el("span", { class: "he" }, g.he)),
      el("div", { class: "say" }, "איך אומרים: " + g.say + (g.full ? " · " + g.full : "")),
      el("p", {}, g.d));
    document.body.append(pop);
    const r = t.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(Math.max(16, r.left + r.width / 2 - pw / 2), innerWidth - pw - 16);
    let top = r.bottom + 8;
    if (top + ph > innerHeight - 10) top = Math.max(10, r.top - ph - 8);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closePop(); });
  window.addEventListener("scroll", closePop, { passive: true });

  /* ---------------- Quizzes ---------------- */
  function buildQuizzes() {
    $$(".quiz").forEach(qz => {
      const data = JSON.parse($("script", qz).textContent);
      const body = el("div");
      let right = 0, answered = 0;
      const score = el("div", { class: "score" }, `ענית על 0 מתוך ${data.length}`);
      const cid = qz.closest(".chapter").id;
      data.forEach((item, qi) => {
        const why = el("div", { class: "why" });
        const opts = el("div", { class: "opts" });
        item.o.forEach((o, i) => {
          const b = el("button", { type: "button" }, o);
          b.addEventListener("click", () => {
            if (opts.dataset.done) return;
            opts.dataset.done = "1";
            answered++;
            if (i === item.a) { right++; b.classList.add("right"); why.textContent = "נכון! " + (item.w || ""); award("quiz:" + cid + ":" + qi, 10, "תשובה נכונה"); }
            else { b.classList.add("wrong"); opts.children[item.a].classList.add("right"); why.textContent = "לא בדיוק. " + (item.w || ""); }
            score.textContent = answered === data.length
              ? `סיימת: ${right} מתוך ${data.length} נכונות${right === data.length ? " — מושלם!" : ""}`
              : `ענית על ${answered} מתוך ${data.length}`;
            if (answered === data.length && right === data.length) award("perfect:" + cid, 25, "בוחן מושלם");
          });
          opts.append(b);
        });
        body.append(el("div", { class: "q" }, el("p", {}, item.q), opts, why));
      });
      qz.append(el("h3", {}, "בוחן קצר"), body, score);
    });
  }

  /* ---------------- Demos ---------------- */
  const demos = window.MG_DEMOS || (window.MG_DEMOS = {});
  function initDemos(root) {
    $$(".demo[data-demo]", root).forEach(d => {
      if (demoInit.has(d)) return;
      demoInit.add(d);
      d.addEventListener("pointerdown", () => award("demo:" + d.dataset.demo, 5, "ניסית מעבדה"), { once: true });
      const fn = demos[d.dataset.demo];
      if (fn) { try { fn(d); } catch (err) { d.append(el("p", {}, "הדמו לא הצליח להיטען: " + err.message)); } }
    });
  }
  const head = (d, tag, title, text) => {
    d.prepend(el("div", { class: "demo-title" }, tag), el("h4", {}, title), text ? el("p", {}, text) : "");
  };
  const visible = d => !d.closest(".chapter").hidden;

  // 1. Binary
  demos.binary = d => {
    head(d, "מעבדה · ביטים", "בנה מספר מאפסים ואחדים", "כל כפתור הוא ביט אחד. לחץ כדי להדליק (1) או לכבות (0). שמונה ביטים ביחד הם בייט אחד.");
    const bits = [0, 1, 0, 0, 0, 0, 0, 1];
    const wrap = el("div", { class: "bits" });
    const out = el("div", { class: "big" });
    const info = el("div", { class: "note" });
    const draw = () => {
      wrap.innerHTML = "";
      bits.forEach((b, i) => {
        const val = 2 ** (7 - i);
        const btn = el("button", { class: b ? "on" : "", "aria-label": "ביט בערך " + val }, String(b));
        btn.onclick = () => { bits[i] ^= 1; draw(); };
        wrap.append(el("div", { class: "bit" }, btn, el("small", {}, String(val))));
      });
      const n = bits.reduce((s, b, i) => s + b * 2 ** (7 - i), 0);
      out.textContent = n;
      const parts = bits.map((b, i) => b ? 2 ** (7 - i) : 0).filter(Boolean);
      const ch = n >= 32 && n < 127 ? `  ·  בטבלת ASCII זה התו "${String.fromCharCode(n)}"` : "";
      info.textContent = (parts.length ? parts.join(" + ") + " = " + n : "הכול כבוי = 0") + ch;
    };
    const inp = el("input", { type: "number", min: "0", max: "255", value: "65", id: "bin-in", "aria-label": "מספר עשרוני" });
    inp.oninput = () => { let v = Math.max(0, Math.min(255, parseInt(inp.value || "0", 10))); for (let i = 0; i < 8; i++) bits[i] = (v >> (7 - i)) & 1; draw(); };
    d.append(wrap, el("div", { class: "row" }, out), info, el("div", { class: "row", style: "margin-top:10px" }, el("span", {}, "או הקלד מספר (0–255):"), inp));
    draw();
  };

  // 2. Logic gates
  demos.gates = d => {
    head(d, "מעבדה · שערים לוגיים", "שני מתגים, ארבעה שערים", "הדלק וכבה את A ואת B וראה אילו נורות נדלקות. ככה עובדים מיליארדי טרנזיסטורים בתוך המעבד.");
    let A = 1, B = 0;
    const btnA = el("button"), btnB = el("button");
    const lamps = el("div", { class: "lamps" });
    const gates = [
      ["AND", "וגם", (a, b) => a && b, "דולק רק אם A וגם B דולקים"],
      ["OR", "או", (a, b) => a || b, "דולק אם לפחות אחד דולק"],
      ["XOR", "או בלעדי", (a, b) => a !== b, "דולק אם בדיוק אחד דולק"],
      ["NOT A", "לא", (a) => !a, "הפוך מ-A"],
    ];
    const draw = () => {
      btnA.textContent = "מתג A = " + A; btnA.className = A ? "on" : "";
      btnB.textContent = "מתג B = " + B; btnB.className = B ? "on" : "";
      lamps.innerHTML = "";
      gates.forEach(([en, he, f, desc]) => {
        const v = f(!!A, !!B) ? 1 : 0;
        lamps.append(el("div", { class: "lamp" + (v ? " lit" : "") }, el("b", {}, en + " = " + v), el("i"), el("div", {}, he), el("div", { class: "note" }, desc)));
      });
    };
    btnA.onclick = () => { A ^= 1; draw(); };
    btnB.onclick = () => { B ^= 1; draw(); };
    d.append(el("div", { class: "row" }, btnA, btnB), lamps);
    draw();
  };

  // 3. Robot (algorithms)
  demos.robot = d => {
    head(d, "מעבדה · אלגוריתם", "תכנת את הרובוט להגיע לכוכב", "הוסף פקודות לתוכנית ולחץ ״הרץ״. לחיצה על פקודה בתוכנית משנה כמה פעמים היא חוזרת (זו לולאה!). לחיצה ארוכה או כפתור ״מחק אחרון״ מוחקים.");
    const levels = [
      { n: 5, start: [0, 4, 0], goal: [4, 4], walls: [] },
      { n: 5, start: [0, 4, 0], goal: [4, 0], walls: [[1, 4], [2, 4], [3, 4], [1, 3]] },
      { n: 6, start: [0, 5, 0], goal: [5, 0], walls: [[1, 5], [1, 4], [1, 3], [3, 0], [3, 1], [3, 2], [4, 4], [5, 4]] },
    ];
    // dir: 0=right,1=up,2=left,3=down ; y grows downward
    const DX = [1, 0, -1, 0], DY = [0, -1, 0, 1], ARROW = ["→", "↑", "←", "↓"];
    let L = 0, prog = [], bot, running = false;
    const grid = el("div", { class: "robot-grid" });
    const progEl = el("div", { class: "prog" });
    const code = el("div", { class: "out" });
    const msg = el("div", { class: "note", style: "min-height:22px" });
    const lvlSel = el("select", { id: "robot-level", "aria-label": "שלב" }, ...levels.map((_, i) => el("option", { value: i }, "שלב " + (i + 1))));
    const reset = () => { const s = levels[L].start; bot = { x: s[0], y: s[1], dir: s[2] }; };
    const isWall = (x, y) => levels[L].walls.some(w => w[0] === x && w[1] === y);
    const drawGrid = (cur = -1) => {
      const lv = levels[L];
      grid.style.gridTemplateColumns = `repeat(${lv.n}, 1fr)`;
      grid.innerHTML = "";
      for (let y = 0; y < lv.n; y++) for (let x = 0; x < lv.n; x++) {
        const c = el("div");
        if (isWall(x, y)) c.className = "wall";
        if (lv.goal[0] === x && lv.goal[1] === y) { c.className = "goal"; c.textContent = "★"; }
        if (bot.x === x && bot.y === y) { c.className = "bot"; c.textContent = ARROW[bot.dir]; }
        grid.append(c);
      }
      progEl.innerHTML = "";
      if (!prog.length) progEl.append(el("span", { class: "note" }, "התוכנית ריקה. הוסף פקודות מלמטה."));
      prog.forEach((p, i) => {
        const b = el("button", { class: i === cur ? "cur" : "" }, p.label + (p.times > 1 ? " ×" + p.times : ""));
        b.onclick = () => { if (running) return; p.times = p.times % 4 + 1; drawGrid(); };
        b.oncontextmenu = e => { e.preventDefault(); if (!running) { prog.splice(i, 1); drawGrid(); } };
        progEl.append(b);
      });
      code.textContent = prog.length ? prog.map(p => p.times > 1 ? `for (let i = 0; i < ${p.times}; i++) {\n  robot.${p.fn}();\n}` : `robot.${p.fn}();`).join("\n") : "// כאן יופיע הקוד האמיתי של התוכנית שלך";
    };
    const cmds = [["קדימה", "forward"], ["פנה שמאלה", "turnLeft"], ["פנה ימינה", "turnRight"]];
    const add = el("div", { class: "row" }, ...cmds.map(([label, fn]) => el("button", { onclick: () => { if (!running) { prog.push({ label, fn, times: 1 }); drawGrid(); } } }, "+ " + label)));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const run = async () => {
      if (running) return;
      running = true; reset(); drawGrid(); msg.textContent = "רץ...";
      for (let i = 0; i < prog.length; i++) {
        for (let t = 0; t < prog[i].times; t++) {
          const f = prog[i].fn;
          if (f === "turnLeft") bot.dir = (bot.dir + 1) % 4;
          else if (f === "turnRight") bot.dir = (bot.dir + 3) % 4;
          else {
            const nx = bot.x + DX[bot.dir], ny = bot.y + DY[bot.dir];
            const n = levels[L].n;
            if (nx < 0 || ny < 0 || nx >= n || ny >= n || isWall(nx, ny)) { msg.textContent = "באג! הרובוט נתקע בקיר בפקודה מספר " + (i + 1) + ". תקן ונסה שוב (זה בדיוק דיבאגינג)."; drawGrid(i); running = false; return; }
            bot.x = nx; bot.y = ny;
          }
          drawGrid(i);
          await sleep(350);
        }
      }
      const g = levels[L].goal;
      msg.textContent = bot.x === g[0] && bot.y === g[1] ? `הצלחת! התוכנית שלך: ${prog.length} פקודות. אפשר לקצר עם לולאות?` : "הרובוט עצר אבל לא על הכוכב. נסה לשנות את התוכנית.";
      running = false;
    };
    lvlSel.onchange = () => { L = +lvlSel.value; prog = []; reset(); drawGrid(); msg.textContent = ""; };
    d.append(el("div", { class: "row" }, lvlSel), grid, add, progEl,
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: run }, "▶ הרץ"), el("button", { onclick: () => { if (!running) { prog.pop(); drawGrid(); } } }, "מחק אחרון"), el("button", { onclick: () => { if (!running) { prog = []; reset(); drawGrid(); msg.textContent = ""; } } }, "נקה")),
      msg, el("div", { class: "note" }, "הקוד שהתוכנית שלך מייצרת (JavaScript):"), code);
    reset(); drawGrid();
  };

  // 4. JS playground (runs in a Web Worker so infinite loops can be stopped)
  const SAMPLES = {
    "שלום עולם": `// כל מה שנכתב אחרי // הוא הערה. המחשב מתעלם ממנו.\nconsole.log("שלום עולם!");\nconsole.log("2 + 3 =", 2 + 3);`,
    "משתנים": `let name = "נועם";      // משתנה מסוג מחרוזת (טקסט)\nlet age = 14;           // משתנה מסוג מספר\nconst isGamer = true;   // בוליאני: אמת או שקר\n\nconsole.log("קוראים לי " + name);\nconsole.log("בעוד 4 שנים אהיה בן", age + 4);\nage = age + 1;           // משנים ערך של משתנה\nconsole.log("שנה הבאה:", age, "גיימר?", isGamer);`,
    "תנאים (if)": `let score = 85;\n\nif (score >= 90) {\n  console.log("מעולה!");\n} else if (score >= 60) {\n  console.log("עברת. ציון:", score);\n} else {\n  console.log("צריך עוד תרגול");\n}\n\n// נסה לשנות את score ל-95 או ל-40 ולהריץ שוב`,
    "לולאות": `// לולאת for: חוזרת 5 פעמים\nfor (let i = 1; i <= 5; i++) {\n  console.log("סיבוב מספר", i);\n}\n\n// לולאת while: רצה כל עוד התנאי נכון\nlet hp = 100;\nwhile (hp > 0) {\n  hp = hp - 30;\n  console.log("השחקן נפגע! חיים:", Math.max(hp, 0));\n}\nconsole.log("Game Over");`,
    "פונקציות": `// פונקציה = מתכון שאפשר להפעיל שוב ושוב\nfunction damage(weapon, distance) {\n  let base = weapon === "רובה" ? 40 : 15;\n  if (distance > 50) base = base / 2;\n  return base;\n}\n\nconsole.log("רובה מקרוב:", damage("רובה", 10));\nconsole.log("רובה מרחוק:", damage("רובה", 80));\nconsole.log("אגרוף:", damage("אגרוף", 1));`,
    "מערכים ואובייקטים": `// מערך = רשימה\nconst cars = ["אינפרנוס", "באנשי", "סנצ'ז"];\ncars.push("פאגי");\nconsole.log("יש", cars.length, "מכוניות:", cars.join(", "));\n\n// אובייקט = דבר עם תכונות\nconst player = { name: "CJ", money: 350, wanted: 2 };\nplayer.money += 100;\nconsole.log(player.name, "עכשיו עם", player.money, "$");\nconsole.log(player);`,
    "משחק קוביות": `// Math.random() מחזיר מספר אקראי בין 0 ל-1\nfunction rollDice() {\n  return Math.floor(Math.random() * 6) + 1;\n}\n\nlet total = 0;\nfor (let turn = 1; turn <= 3; turn++) {\n  const r = rollDice();\n  total += r;\n  console.log("הטלה", turn, "=", r);\n}\nconsole.log("סך הכול:", total, total >= 12 ? "ניצחת!" : "הפסדת, נסה שוב");`,
    "באג לתיקון": `// בקוד הזה יש באג. הרץ, קרא את הודעת השגיאה ותקן!\nconst hero = "מריו";\nconsole.log("הגיבור הוא " + heroo);`,
  };
  demos.playground = d => {
    head(d, "מעבדה · JavaScript", "כתוב קוד והרץ אותו כאן", "בחר דוגמה, שנה משהו, ולחץ ״הרץ״. ההדפסות של console.log יופיעו בחלון השחור. אי אפשר לשבור כלום, אז תתפרע.");
    const sel = el("select", { id: "pg-sample", "aria-label": "דוגמה" }, ...Object.keys(SAMPLES).map(k => el("option", { value: k }, k)));
    const ta = el("textarea", { rows: "12", spellcheck: "false", id: "pg-code", "aria-label": "קוד" });
    const out = el("div", { class: "out", "aria-live": "polite" });
    ta.value = SAMPLES["שלום עולם"];
    sel.onchange = () => { ta.value = SAMPLES[sel.value]; out.innerHTML = ""; };
    ta.addEventListener("keydown", e => {
      if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("  ", s, ta.selectionEnd, "end"); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
    });
    let worker = null, timer = null;
    const line = (t, cls) => out.append(el("div", { class: cls || "" }, t));
    function run() {
      if (worker) worker.terminate();
      out.innerHTML = "";
      const src = `const __f=v=>typeof v==="string"?v:(()=>{try{return JSON.stringify(v)}catch(e){return String(v)}})();
console.log=(...a)=>postMessage({t:"log",s:a.map(__f).join(" ")});
console.error=console.warn=console.log;const alert=console.log;
try{\n${ta.value}\n;postMessage({t:"done"})}catch(e){postMessage({t:"err",s:e.name+": "+e.message})}`;
      let url;
      try {
        url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        worker = new Worker(url);
      } catch (e) { line("הדפדפן לא מרשה להריץ קוד כאן. פתח את הקונסול בדפדפן (F12) ונסה שם.", "err"); return; }
      const t0 = performance.now();
      worker.onmessage = m => {
        if (m.data.t === "log") line(m.data.s);
        else if (m.data.t === "err") { line("שגיאה ← " + m.data.s, "err"); finish(); }
        else { line(`— סיום (${Math.round(performance.now() - t0)} מילישניות)`, "dim"); finish(); }
      };
      worker.onerror = e => { e.preventDefault(); line("שגיאת תחביר ← " + (e.message || "יש טעות בכתיב הקוד"), "err"); finish(); };
      clearTimeout(timer);
      timer = setTimeout(() => { if (worker) { line("עצרתי את הקוד אחרי 3 שניות. אולי יש לולאה אינסופית?", "err"); finish(); } }, 3000);
      function finish() { clearTimeout(timer); if (worker) worker.terminate(); worker = null; URL.revokeObjectURL(url); }
    }
    d.append(el("div", { class: "row" }, el("span", {}, "דוגמה:"), sel), ta,
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: run }, "▶ הרץ"), el("span", { class: "note" }, "קיצור: Ctrl+Enter")), out);
  };

  // 5. HTML/CSS live editor
  demos.htmleditor = d => {
    head(d, "מעבדה · HTML + CSS", "בנה דף אינטרנט בזמן אמת", "כל שינוי בקוד מופיע מיד בתצוגה הלבנה. נסה לשנות צבעים, טקסטים וגדלים.");
    const ta = el("textarea", { rows: "14", spellcheck: "false", id: "html-code", "aria-label": "קוד HTML" });
    ta.value = `<style>
  .card { font-family: sans-serif; direction: rtl; padding: 20px;
          background: linear-gradient(135deg, #ffe29f, #ffa99f); border-radius: 16px; }
  h1 { color: #222; margin: 0 0 8px; }
  button { background: #1e4fd0; color: white; border: 0;
           padding: 10px 18px; border-radius: 10px; font-size: 16px; }
  li { margin: 4px 0; }
</style>

<div class="card">
  <h1>האתר הראשון שלי</h1>
  <p>שלום! אני לומד לתכנת.</p>
  <ul>
    <li>משחק אהוב: GTA</li>
    <li>שפה ראשונה: JavaScript</li>
  </ul>
  <button>לחץ עליי</button>
</div>`;
    const host = el("div", { class: "preview-host" });
    const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    const draw = () => { root.innerHTML = ta.value.replace(/<script[\s\S]*?<\/script>/gi, ""); };
    ta.addEventListener("input", draw);
    d.append(el("div", { class: "grid2" }, el("div", {}, el("div", { class: "note" }, "הקוד (HTML + CSS):"), ta), el("div", {}, el("div", { class: "note" }, "התוצאה:"), host)));
    draw();
  };

  // 6. RGB
  demos.rgb = d => {
    head(d, "מעבדה · פיקסלים", "ערבב צבע כמו מסך", "כל פיקסל במסך מורכב משלוש נורות זעירות: אדום (R), ירוק (G), כחול (B). כל אחת בעוצמה 0 עד 255.");
    const v = { r: 255, g: 140, b: 30 };
    const sw = el("div", { class: "swatch" });
    const txt = el("div", { class: "big ltr", style: "font-size:24px" });
    const sub = el("div", { class: "note ltr" });
    const sliders = ["r", "g", "b"].map(k => {
      const s = el("input", { type: "range", min: "0", max: "255", value: String(v[k]), id: "rgb-" + k, "aria-label": k });
      s.oninput = () => { v[k] = +s.value; draw(); };
      return el("label", {}, { r: "אדום · Red", g: "ירוק · Green", b: "כחול · Blue" }[k], s);
    });
    const hex = n => n.toString(16).padStart(2, "0").toUpperCase();
    const draw = () => {
      sw.style.background = `rgb(${v.r},${v.g},${v.b})`;
      txt.textContent = `#${hex(v.r)}${hex(v.g)}${hex(v.b)}`;
      sub.textContent = `rgb(${v.r}, ${v.g}, ${v.b})  ·  bits: ${[v.r, v.g, v.b].map(n => n.toString(2).padStart(8, "0")).join(" ")}`;
    };
    d.append(el("div", { class: "grid2" }, el("div", {}, ...sliders), el("div", {}, sw, txt, sub)));
    draw();
  };

  // 7. Search engine
  demos.search = d => {
    head(d, "מעבדה · מנוע חיפוש", "גוגל קטנטן שעובד באמת", "יש לנו אינטרנט זעיר של 7 דפים. המנוע בנה אינדקס (כמו אינדקס בסוף ספר), ומדרג לפי: כמה המילים מופיעות, כמה הן נדירות, וכמה דפים אחרים מקשרים לדף (PageRank).");
    const pages = [
      { id: "A", title: "מדריך GTA למתחילים", text: "איך לנהוג מכונית במשחק GTA ואיך לברוח מהמשטרה במשחק", links: ["B", "C"] },
      { id: "B", title: "היסטוריה של משחקי מחשב", text: "משחקי מחשב התחילו בשנות השבעים. היום משחקים בתלת מימד כמו GTA", links: ["C"] },
      { id: "C", title: "איך בונים משחק תלת מימד", text: "מנוע משחק כמו Unity או Unreal עוזר לבנות משחק תלת מימד עם פיזיקה ותאורה", links: ["B"] },
      { id: "D", title: "מתכון לפיצה", text: "בצק רוטב עגבניות גבינה ותנור חם. פיצה טעימה", links: ["E"] },
      { id: "E", title: "פיצה או המבורגר", text: "סקר גדול: מה אוכלים יותר פיצה או המבורגר", links: ["D"] },
      { id: "F", title: "ללמוד לתכנת בגיל 14", text: "אפשר ללמוד לתכנת משחק ראשון עם JavaScript או Python. תכנת כל יום", links: ["C", "B", "G"] },
      { id: "G", title: "מה זה בינה מלאכותית", text: "בינה מלאכותית לומדת מדוגמאות. היא עוזרת לתכנת משחק ולכתוב קוד", links: ["F", "C"] },
    ];
    const tok = s => s.toLowerCase().replace(/[.,:!?]/g, " ").split(/\s+/).filter(Boolean);
    const index = new Map();
    pages.forEach(p => tok(p.title + " " + p.text).forEach(w => { if (!index.has(w)) index.set(w, new Map()); const m = index.get(w); m.set(p.id, (m.get(p.id) || 0) + 1); }));
    // PageRank (20 iterations)
    const pr = {}; pages.forEach(p => pr[p.id] = 1 / pages.length);
    for (let it = 0; it < 20; it++) {
      const next = {}; pages.forEach(p => next[p.id] = 0.15 / pages.length);
      pages.forEach(p => p.links.forEach(t => next[t] += 0.85 * pr[p.id] / p.links.length));
      Object.assign(pr, next);
    }
    const inp = el("input", { type: "text", value: "משחק תלת מימד", id: "search-q", style: "flex:1;min-width:0", "aria-label": "חיפוש" });
    const res = el("div");
    const idx = el("div", { class: "out" });
    const run = () => {
      const q = [...new Set(tok(inp.value))];
      const scores = pages.map(p => {
        let s = 0; const why = [];
        q.forEach(w => {
          const m = index.get(w);
          if (m && m.has(p.id)) { const idf = Math.log(1 + pages.length / m.size); s += m.get(p.id) * idf; why.push(`"${w}"×${m.get(p.id)}`); }
        });
        const bonus = s > 0 ? pr[p.id] * 3 : 0;
        return { p, s: s + bonus, text: s, bonus, why };
      }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
      res.innerHTML = "";
      if (!scores.length) res.append(el("p", {}, "לא נמצאו תוצאות. נסה: פיצה, לתכנת, GTA, בינה"));
      scores.forEach((x, i) => res.append(el("div", { class: "search-result" },
        el("b", {}, (i + 1) + ". " + x.p.title), el("div", {}, x.p.text),
        el("small", {}, `score ${x.s.toFixed(2)} = words ${x.text.toFixed(2)} [${x.why.join(" ")}] + PageRank ${x.bonus.toFixed(2)}`))));
      idx.textContent = q.map(w => `"${w}" → ${index.has(w) ? [...index.get(w).keys()].map(id => "דף " + id).join(", ") : "(לא מופיע באף דף)"}`).join("\n") || "הקלד מילים לחיפוש";
    };
    inp.oninput = run;
    const prTxt = pages.map(p => `דף ${p.id}: ${(pr[p.id] * 100).toFixed(1)}%`).join("   ");
    d.append(el("div", { class: "row" }, inp, el("button", { class: "primary", onclick: run }, "חפש")), res,
      el("div", { class: "note", style: "margin-top:10px" }, "מה המנוע בדק באינדקס:"), idx,
      el("div", { class: "note", style: "margin-top:8px" }, "PageRank של כל דף (כמה ״חשוב״ לפי קישורים): " + prTxt));
    run();
  };

  // 8. Neuron
  demos.neuron = d => {
    head(d, "מעבדה · נוירון מלאכותי", "נוירון אחד מחליט: ללכת לים?", "לנוירון יש קלטים (inputs), לכל קלט יש משקל (weight) שאומר כמה הוא חשוב, ויש סף (bias). הנוירון מחבר הכול ומוציא תשובה בין 0 ל-1. ״אימון״ זה בעצם לשנות את המשקלים עד שהתשובות נכונות.");
    const f = { x1: 1, x2: 0, w1: 3, w2: 2, b: -2 };
    const defs = [
      ["x1", "קלט 1: יש שמש? (0=לא, 1=כן)", 0, 1, 1],
      ["x2", "קלט 2: החברים באים? (0=לא, 1=כן)", 0, 1, 1],
      ["w1", "משקל של שמש", -5, 5, 0.1],
      ["w2", "משקל של חברים", -5, 5, 0.1],
      ["b", "הטיה (bias) — כמה אני עצלן", -5, 5, 0.1],
    ];
    const out = el("div", { class: "big" });
    const formula = el("div", { class: "note ltr" });
    const verdict = el("div", { style: "font-size:18px" });
    const ctr = defs.map(([k, label, min, max, step]) => {
      const val = el("b", { class: "ltr" });
      const s = el("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(f[k]), id: "nn-" + k, "aria-label": label });
      s.oninput = () => { f[k] = +s.value; draw(); };
      val.textContent = f[k];
      s.addEventListener("input", () => { val.textContent = f[k]; });
      return el("label", {}, el("span", {}, label, " = ", val), s);
    });
    const draw = () => {
      const z = f.x1 * f.w1 + f.x2 * f.w2 + f.b;
      const y = 1 / (1 + Math.exp(-z));
      out.textContent = y.toFixed(2);
      formula.textContent = `z = ${f.x1}×${f.w1} + ${f.x2}×${f.w2} + (${f.b}) = ${z.toFixed(2)}   →   sigmoid(z) = ${y.toFixed(2)}`;
      verdict.textContent = y > 0.5 ? "ההחלטה: הולכים לים!" : "ההחלטה: נשארים בבית.";
    };
    d.append(el("div", { class: "grid2" }, el("div", {}, ...ctr), el("div", {}, el("div", { class: "note" }, "פלט (output):"), out, verdict, formula)));
    draw();
  };

  // 9. Next-word predictor (tiny language model)
  demos.nextword = d => {
    head(d, "מעבדה · מודל שפה זעיר", "איך ChatGPT ו-Claude ״מנחשים״ את המילה הבאה", "המודל הזה קרא רק כמה עשרות משפטים וספר איזו מילה באה אחרי איזו. מודל אמיתי קרא טריליוני מילים ומסתכל על כל ההקשר, אבל הרעיון הבסיסי דומה: לחזות את הטוקן הבא.");
    const corpus = `אני אוהב לשחק במחשב. אני אוהב לתכנת משחקים. אני אוהב פיצה עם גבינה. אני לומד לתכנת כל יום.
    המחשב עובד מהר מאוד. המחשב חושב במספרים. המחשב מבין רק אפסים ואחדים.
    המשחק הזה מדהים. המשחק הזה קשה מאוד. המשחק הבא שלי יהיה בתלת מימד.
    הבינה המלאכותית לומדת מדוגמאות. הבינה המלאכותית עוזרת לתכנת. הבינה המלאכותית לפעמים טועה.
    כל יום אני לומד משהו חדש. כל יום אני כותב קוד. לתכנת זה כמו לבנות לגו.
    אני רוצה לבנות משחק כמו GTA. אני רוצה להיות מתכנת. משחק כמו GTA דורש צוות גדול.
    הקוד שלי עובד. הקוד שלי לא עובד ואני מחפש את הבאג. הבאג היה בשורה אחת.`;
    const words = corpus.replace(/\./g, " . ").split(/\s+/).filter(Boolean);
    const next = new Map();
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i] === ".") continue;
      if (!next.has(words[i])) next.set(words[i], new Map());
      const m = next.get(words[i]); m.set(words[i + 1], (m.get(words[i + 1]) || 0) + 1);
    }
    const starts = ["אני", "המחשב", "המשחק", "הבינה", "הקוד", "כל"];
    const inp = el("input", { type: "text", value: "אני אוהב", id: "nw-in", style: "flex:1;min-width:0", "aria-label": "התחלת משפט" });
    const bars = el("div", { class: "bars" });
    const gen = el("div", { class: "out", style: "direction:rtl;text-align:right;font-family:var(--font-body);font-size:17px" });
    const temp = el("input", { type: "range", min: "0.2", max: "2", step: "0.1", value: "1", id: "nw-temp", "aria-label": "טמפרטורה" });
    const tLabel = el("b", {}, "1.0");
    const probs = w => {
      const m = next.get(w); if (!m) return [];
      const tot = [...m.values()].reduce((a, b) => a + b, 0);
      return [...m.entries()].map(([k, c]) => [k, c / tot]).sort((a, b) => b[1] - a[1]);
    };
    const drawBars = () => {
      const ws = inp.value.trim().split(/\s+/);
      const last = ws[ws.length - 1];
      const p = probs(last);
      bars.innerHTML = "";
      if (!p.length) { bars.append(el("div", { class: "note" }, `המודל לא מכיר את "${last}". נסה להתחיל ב: ${starts.join(", ")}`)); return; }
      p.slice(0, 6).forEach(([w, pr]) => bars.append(el("div", { class: "bar-row" }, el("span", {}, w === "." ? "(סוף משפט)" : w), el("div", { class: "track" }, el("i", { style: `width:${pr * 100}%` })), el("span", {}, Math.round(pr * 100) + "%"))));
    };
    const sample = (p, T) => {
      const ws = p.map(([w, pr]) => [w, Math.pow(pr, 1 / T)]);
      const tot = ws.reduce((a, [, x]) => a + x, 0);
      let r = Math.random() * tot;
      for (const [w, x] of ws) { r -= x; if (r <= 0) return w; }
      return ws[0][0];
    };
    const generate = () => {
      const ws = inp.value.trim().split(/\s+/).filter(Boolean);
      const T = +temp.value;
      for (let i = 0; i < 12; i++) {
        const p = probs(ws[ws.length - 1]); if (!p.length) break;
        const w = sample(p, T); if (w === ".") { ws.push("."); break; }
        ws.push(w);
      }
      gen.textContent = ws.join(" ").replace(" .", ".");
    };
    inp.oninput = drawBars;
    temp.oninput = () => { tLabel.textContent = (+temp.value).toFixed(1); };
    d.append(el("div", { class: "row" }, inp, el("button", { class: "primary", onclick: generate }, "המשך את המשפט")),
      el("div", { class: "note" }, "המילים הכי סבירות אחרי המילה האחרונה:"), bars,
      el("label", { style: "margin-top:10px" }, el("span", {}, "טמפרטורה (temperature) = ", tLabel, " · נמוך = צפוי ומשעמם, גבוה = יצירתי ומשוגע"), temp),
      el("div", { class: "note", style: "margin-top:8px" }, "הטקסט שהמודל ייצר:"), gen);
    drawBars();
  };

  // 10. Sorting visualizer
  demos.sort = d => {
    head(d, "מעבדה · אלגוריתם מיון", "מיון בועות מול מיון מהיר", "אלגוריתם הוא דרך לפתור בעיה. לשתי דרכים יכולה להיות אותה תוצאה, אבל מהירות שונה לגמרי. ספור את ההשוואות.");
    let arr = [], busy = false, stop = false;
    const wrap = el("div", { class: "sort-bars" });
    const info = el("div", { class: "note", style: "margin-top:6px;font-variant-numeric:tabular-nums" });
    const N = 32;
    const shuffle = () => { stop = true; arr = Array.from({ length: N }, (_, i) => i + 1).sort(() => Math.random() - .5); draw(); info.textContent = "ערבבתי. בחר אלגוריתם."; };
    const draw = (hl = [], okFrom = N) => {
      wrap.innerHTML = "";
      arr.forEach((v, i) => wrap.append(el("i", { class: hl.includes(i) ? "cmp" : i >= okFrom ? "ok" : "", style: `height:${(v / N) * 100}%` })));
    };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const bubble = async () => {
      if (busy) return; busy = true; stop = false; let cmp = 0;
      for (let i = 0; i < N && !stop; i++) {
        for (let j = 0; j < N - 1 - i && !stop; j++) {
          cmp++;
          if (arr[j] > arr[j + 1]) [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          draw([j, j + 1], N - i); info.textContent = `מיון בועות · השוואות: ${cmp}`;
          await sleep(12);
        }
      }
      if (!stop) { draw([], 0); info.textContent = `מיון בועות סיים אחרי ${cmp} השוואות.`; }
      busy = false;
    };
    const quick = async () => {
      if (busy) return; busy = true; stop = false; let cmp = 0;
      const qs = async (lo, hi) => {
        if (lo >= hi || stop) return;
        const pivot = arr[hi]; let i = lo;
        for (let j = lo; j < hi && !stop; j++) {
          cmp++;
          if (arr[j] < pivot) { [arr[i], arr[j]] = [arr[j], arr[i]]; i++; }
          draw([j, hi]); info.textContent = `מיון מהיר · השוואות: ${cmp}`;
          await sleep(22);
        }
        [arr[i], arr[hi]] = [arr[hi], arr[i]];
        await qs(lo, i - 1); await qs(i + 1, hi);
      };
      await qs(0, N - 1);
      if (!stop) { draw([], 0); info.textContent = `מיון מהיר סיים אחרי ${cmp} השוואות בלבד.`; }
      busy = false;
    };
    d.append(wrap, el("div", { class: "row", style: "margin-top:10px" },
      el("button", { onclick: () => { if (!busy) shuffle(); else stop = true; } }, "ערבב / עצור"),
      el("button", { class: "primary", onclick: bubble }, "מיון בועות (Bubble Sort)"),
      el("button", { class: "primary", onclick: quick }, "מיון מהיר (Quick Sort)")), info);
    shuffle();
  };

  // shared input helper for games
  function makeInput(d) {
    const keys = new Set();
    const map = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
    let active = false;
    window.addEventListener("keydown", e => { if (!active || !visible(d)) return; const k = map[e.code]; if (k) { keys.add(k); e.preventDefault(); } });
    window.addEventListener("keyup", e => { const k = map[e.code]; if (k) keys.delete(k); });
    const pad = el("div", { class: "pad" });
    [["u", "▲"], ["l", "◀"], ["d", "▼"], ["r", "▶"]].forEach(([k, s]) => {
      const b = el("button", { class: k, "aria-label": k }, s);
      const on = e => { e.preventDefault(); keys.add(k); }, off = () => keys.delete(k);
      b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off);
      pad.append(b);
    });
    return { keys, pad, setActive(v) { active = v; if (!v) keys.clear(); } };
  }

  // 11. 2D game: collect cash, escape the police
  demos.game2d = d => {
    head(d, "מעבדה · לולאת משחק", "מיני-GTA דו-ממדי: אסוף כסף, ברח מהמשטרה", "חיצים או WASD במחשב, או הכפתורים בטלפון. הדלק ״מצב מפתח״ כדי לראות מה המשחק מחשב בכל פריים: תיבות התנגשות (hitbox), וקטור התנועה של השוטר ומספר הפריימים בשנייה.");
    const W = 480, H = 300;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "משחק" });
    const ctx = cv.getContext("2d");
    const input = makeInput(d);
    const hud = el("div", { class: "note ltr", style: "font-variant-numeric:tabular-nums" });
    let debug = false, running = false, state;
    const dbgBtn = el("button", { onclick: () => { debug = !debug; dbgBtn.classList.toggle("on", debug); } }, "מצב מפתח (debug)");
    const startBtn = el("button", { class: "primary" }, "▶ התחל");
    const reset = () => {
      state = { p: { x: 60, y: 150, r: 10, v: 170 }, cops: [{ x: 420, y: 60, r: 11, v: 70 }], coins: [], score: 0, t: 0, over: false, fps: 60 };
      for (let i = 0; i < 4; i++) spawnCoin();
    };
    const spawnCoin = () => state.coins.push({ x: 30 + Math.random() * (W - 60), y: 30 + Math.random() * (H - 60), r: 7 });
    const hit = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
    let last = 0;
    const loop = now => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      if (visible(d)) { update(dt); render(); }
      requestAnimationFrame(loop);
    };
    const update = dt => {
      const s = state; if (s.over) return;
      s.t += dt; s.fps = s.fps * 0.95 + (1 / dt) * 0.05;
      let dx = 0, dy = 0; const k = input.keys;
      if (k.has("l")) dx -= 1; if (k.has("r")) dx += 1; if (k.has("u")) dy -= 1; if (k.has("d")) dy += 1;
      const len = Math.hypot(dx, dy) || 1;
      s.p.x = Math.max(s.p.r, Math.min(W - s.p.r, s.p.x + dx / len * s.p.v * dt));
      s.p.y = Math.max(s.p.r, Math.min(H - s.p.r, s.p.y + dy / len * s.p.v * dt));
      s.cops.forEach(c => {
        const vx = s.p.x - c.x, vy = s.p.y - c.y, l = Math.hypot(vx, vy) || 1;
        c.dx = vx / l; c.dy = vy / l;
        c.x += c.dx * c.v * dt; c.y += c.dy * c.v * dt;
        if (hit(c, s.p)) s.over = true;
      });
      s.coins = s.coins.filter(c => { if (hit(c, s.p)) { s.score += 100; return false; } return true; });
      while (s.coins.length < 4) spawnCoin();
      const wanted = Math.min(5, 1 + Math.floor(s.score / 500));
      while (s.cops.length < wanted) s.cops.push({ x: Math.random() < .5 ? 0 : W, y: Math.random() * H, r: 11, v: 65 + s.cops.length * 8 });
      s.cops.forEach(c => c.v = 70 + s.score / 40);
    };
    const render = () => {
      const s = state;
      ctx.fillStyle = "#1b2430"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2c3746";
      for (let x = 0; x < W; x += 120) ctx.fillRect(x + 40, 0, 40, H);
      for (let y = 0; y < H; y += 100) ctx.fillRect(0, y + 35, W, 30);
      ctx.strokeStyle = "#e8d27a"; ctx.setLineDash([10, 10]);
      for (let y = 0; y < H; y += 100) { ctx.beginPath(); ctx.moveTo(0, y + 50); ctx.lineTo(W, y + 50); ctx.stroke(); }
      ctx.setLineDash([]);
      s.coins.forEach(c => { ctx.fillStyle = "#5fd08f"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill(); ctx.fillStyle = "#0a2a17"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText("$", c.x, c.y + 3.5); });
      s.cops.forEach(c => {
        ctx.fillStyle = (s.t * 6 | 0) % 2 ? "#ff5a5a" : "#5a8bff"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
        if (debug) { ctx.strokeStyle = "#ffb454"; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + (c.dx || 0) * 40, c.y + (c.dy || 0) * 40); ctx.stroke(); }
      });
      ctx.fillStyle = "#ffb454"; ctx.beginPath(); ctx.arc(s.p.x, s.p.y, s.p.r, 0, 7); ctx.fill();
      if (debug) {
        ctx.strokeStyle = "#7fb0ff";
        [s.p, ...s.cops, ...s.coins].forEach(o => ctx.strokeRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2));
        ctx.fillStyle = "#d9e6f2"; ctx.font = "12px monospace"; ctx.textAlign = "left";
        ctx.fillText(`FPS ${s.fps.toFixed(0)}  player(${s.p.x.toFixed(0)},${s.p.y.toFixed(0)})  objects ${1 + s.cops.length + s.coins.length}`, 8, H - 8);
      }
      ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = "bold 16px monospace";
      ctx.fillText("$" + s.score, 10, 22);
      ctx.fillStyle = "#ffb454"; ctx.fillText("★".repeat(s.cops.length), W - 16 * s.cops.length - 10, 22);
      if (s.over) {
        ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ff6b6b"; ctx.font = "bold 34px sans-serif"; ctx.textAlign = "center"; ctx.fillText("BUSTED", W / 2, H / 2);
        ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif"; ctx.fillText("נתפסת! ניקוד: " + s.score, W / 2, H / 2 + 30);
        startBtn.textContent = "↻ שחק שוב";
      }
      hud.textContent = `time ${s.t.toFixed(1)}s · wanted ${s.cops.length} · score ${s.score}`;
    };
    startBtn.onclick = () => { reset(); input.setActive(true); startBtn.textContent = "↻ התחל מחדש"; if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } };
    reset(); render();
    d.append(cv, el("div", { class: "row", style: "margin-top:10px;justify-content:space-between" }, el("div", { class: "row" }, startBtn, dbgBtn), input.pad), hud);
  };

  // 12. Software 3D cube (projection math)
  demos.cube = d => {
    head(d, "מעבדה · איך תלת-ממד הופך לתמונה", "קובייה שמצוירת רק עם מתמטיקה", "אין כאן שום מנוע. יש 8 נקודות (vertices), מסובבים אותן עם sin ו-cos, ומטילים על מסך דו-ממדי עם חלוקה במרחק (פרספקטיבה). כך בדיוק עובד כל כרטיס מסך, רק מיליארדי פעמים בשנייה.");
    const W = 480, H = 320;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "קובייה" });
    const ctx = cv.getContext("2d");
    const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7]];
    const COL = [[255, 138, 76], [127, 176, 255], [95, 208, 143], [255, 180, 84], [200, 140, 255], [255, 107, 107]];
    const o = { rx: 0.5, ry: 0.6, dist: 5, fov: 300, spin: true, solid: true, labels: false };
    const sl = (k, label, min, max, step) => {
      const s = el("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(o[k]), id: "cube-" + k, "aria-label": label });
      s.oninput = () => { o[k] = +s.value; };
      return el("label", {}, label, s);
    };
    const tg = (k, label) => { const b = el("button", { class: o[k] ? "on" : "" }, label); b.onclick = () => { o[k] = !o[k]; b.classList.toggle("on", o[k]); }; return b; };
    const draw = () => {
      if (visible(d)) {
        if (o.spin) o.ry += 0.01;
        const cx = Math.cos(o.rx), sx = Math.sin(o.rx), cy = Math.cos(o.ry), sy = Math.sin(o.ry);
        const P = V.map(([x, y, z]) => {
          let x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
          let y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
          const zz = z2 + o.dist;
          return { x: W / 2 + x1 * o.fov / zz, y: H / 2 + y1 * o.fov / zz, z: zz, w: [x1, y1, z2] };
        });
        ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
        const light = [0.4, -0.6, -0.7];
        const faces = F.map((f, i) => {
          const a = P[f[0]].w, b = P[f[1]].w, c = P[f[2]].w;
          const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          const nl = Math.hypot(...n) || 1;
          const bright = Math.max(0.15, -(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / nl);
          return { f, i, z: f.reduce((s, k) => s + P[k].z, 0) / 4, bright };
        }).sort((a, b) => b.z - a.z);
        faces.forEach(({ f, i, bright }) => {
          ctx.beginPath(); f.forEach((k, j) => j ? ctx.lineTo(P[k].x, P[k].y) : ctx.moveTo(P[k].x, P[k].y)); ctx.closePath();
          if (o.solid) { const c = COL[i]; ctx.fillStyle = `rgb(${c.map(x => x * bright | 0).join(",")})`; ctx.fill(); }
          ctx.strokeStyle = o.solid ? "rgba(0,0,0,.4)" : "#7fb0ff"; ctx.lineWidth = 1.5; ctx.stroke();
        });
        ctx.fillStyle = "#ffb454";
        P.forEach((p, k) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill(); if (o.labels) { ctx.font = "11px monospace"; ctx.fillStyle = "#d9e6f2"; ctx.fillText(`v${k}(${V[k].join(",")})`, p.x + 6, p.y - 6); ctx.fillStyle = "#ffb454"; } });
        ctx.fillStyle = "#7d8fa6"; ctx.font = "12px monospace"; ctx.fillText(`8 vertices · 12 edges · 6 faces · screen.x = x × ${o.fov} / z`, 10, H - 10);
      }
      requestAnimationFrame(draw);
    };
    d.append(cv, el("div", { class: "row", style: "margin-top:10px" }, tg("spin", "סיבוב אוטומטי"), tg("solid", "פאות מלאות + תאורה"), tg("labels", "הצג קואורדינטות")),
      el("div", { class: "grid2" }, sl("rx", "זווית X (הטיה)", -3.14, 3.14, 0.01), sl("ry", "זווית Y (סיבוב)", -3.14, 3.14, 0.01), sl("dist", "מרחק מהמצלמה", 2.5, 12, 0.1), sl("fov", "זום (שדה ראייה)", 100, 600, 1)));
    requestAnimationFrame(draw);
  };

  // 13. A* pathfinding
  demos.path = d => {
    head(d, "מעבדה · בינה מלאכותית במשחקים", "איך דמות במשחק מוצאת דרך (A*)", "גרור על הלוח כדי לבנות קירות. לחץ ״מצא דרך״: הריבועים הכהים הם מה שהאלגוריתם בדק, הכתומים הם המסלול הקצר ביותר. ככה הולכי רגל ומכוניות ב-GTA יודעים לאן לנסוע.");
    const C = 20, R = 14;
    let walls = new Set(), S = [1, 7], G = [18, 6];
    [[6, 3], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [12, 2], [12, 3], [12, 4], [12, 5], [12, 6], [12, 7], [12, 8], [12, 9], [12, 10], [12, 11]].forEach(([x, y]) => walls.add(x + "," + y));
    const grid = el("div", { class: "path-grid", style: `grid-template-columns:repeat(${C},1fr)` });
    const cells = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const c = el("div"); c.dataset.x = x; c.dataset.y = y; cells.push(c); grid.append(c); }
    const info = el("div", { class: "note" });
    const paint = (vis = new Set(), path = new Set()) => cells.forEach(c => {
      const k = c.dataset.x + "," + c.dataset.y;
      c.className = k === S.join() ? "s" : k === G.join() ? "g" : walls.has(k) ? "w" : path.has(k) ? "p" : vis.has(k) ? "v" : "";
    });
    let drawMode = null;
    const toggle = c => { const k = c.dataset.x + "," + c.dataset.y; if (k === S.join() || k === G.join()) return; drawMode ? walls.add(k) : walls.delete(k); paint(); };
    grid.addEventListener("pointerdown", e => { const c = e.target.closest("[data-x]"); if (!c) return; e.preventDefault(); drawMode = !walls.has(c.dataset.x + "," + c.dataset.y); toggle(c); });
    grid.addEventListener("pointermove", e => { if (drawMode == null) return; const t = document.elementFromPoint(e.clientX, e.clientY); const c = t && t.closest && t.closest(".path-grid [data-x]"); if (c) toggle(c); });
    window.addEventListener("pointerup", () => { drawMode = null; });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let busy = false;
    const astar = async () => {
      if (busy) return; busy = true;
      const key = p => p.join(), h = p => Math.abs(p[0] - G[0]) + Math.abs(p[1] - G[1]);
      const open = [{ p: S, g: 0, f: h(S) }], came = new Map(), gs = new Map([[key(S), 0]]), vis = new Set();
      let found = false;
      while (open.length) {
        open.sort((a, b) => a.f - b.f);
        const cur = open.shift(), ck = key(cur.p);
        if (vis.has(ck)) continue;
        vis.add(ck);
        if (ck === key(G)) { found = true; break; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = [cur.p[0] + dx, cur.p[1] + dy], nk = key(n);
          if (n[0] < 0 || n[1] < 0 || n[0] >= C || n[1] >= R || walls.has(nk)) continue;
          const g = cur.g + 1;
          if (g < (gs.get(nk) ?? Infinity)) { gs.set(nk, g); came.set(nk, ck); open.push({ p: n, g, f: g + h(n) }); }
        }
        paint(vis); await sleep(8);
      }
      const path = new Set();
      if (found) { let k = key(G); while (k) { path.add(k); k = came.get(k); } }
      paint(vis, path);
      info.textContent = found ? `נמצא מסלול באורך ${path.size - 1} צעדים. האלגוריתם בדק ${vis.size} משבצות מתוך ${C * R}.` : "אין דרך! הקירות חוסמים לגמרי.";
      busy = false;
    };
    d.append(grid, el("div", { class: "row" }, el("button", { class: "primary", onclick: astar }, "מצא דרך (A*)"), el("button", { onclick: () => { if (!busy) { walls.clear(); paint(); info.textContent = ""; } } }, "נקה קירות"), el("span", { class: "note" }, "ירוק = התחלה · אדום = יעד")), info);
    paint();
  };

  // 14. Three.js open city
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = () => res(window.THREE); s.onerror = () => rej(new Error("לא הצלחתי לטעון את Three.js"));
      document.head.append(s);
    });
  }
  demos.city = d => {
    head(d, "מעבדה · עולם פתוח בתלת-ממד", "סע במכונית בעיר תלת-ממדית", "העולם הזה בנוי עם ספריית Three.js: קרקע, עשרות בניינים (mesh), מצלמה שעוקבת אחרי הרכב, אור שמש וצללים, ערפל, והתנגשות פשוטה עם בניינים. חיצים / WASD או הכפתורים. זה GTA בגרסת הגן, אבל העקרונות זהים.");
    const box = el("div", { style: "position:relative" });
    const status = el("p", {}, "לחץ ״טען את העיר״ כדי להתחיל (טוען ספרייה של כ-600KB).");
    const input = makeInput(d);
    const hud = el("div", { class: "note ltr" });
    const loadBtn = el("button", { class: "primary" }, "▶ טען את העיר");
    const nightBtn = el("button", {}, "יום / לילה");
    const camBtn = el("button", {}, "החלף מצלמה");
    d.append(status, box, el("div", { class: "row", style: "margin-top:10px;justify-content:space-between" }, el("div", { class: "row" }, loadBtn, nightBtn, camBtn), input.pad), hud);
    loadBtn.onclick = async () => {
      loadBtn.disabled = true; status.textContent = "טוען...";
      let THREE;
      try { THREE = await loadThree(); } catch (e) { status.textContent = e.message + ". בדוק חיבור לאינטרנט."; loadBtn.disabled = false; return; }
      status.textContent = "";
      loadBtn.remove();
      input.setActive(true);
      const W = box.clientWidth || 480, H = Math.round(W * 0.6);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.domElement.style.borderRadius = "10px";
      box.append(renderer.domElement);
      const scene = new THREE.Scene();
      let night = false;
      const sky = new THREE.Color(0x9cc9ff);
      scene.background = sky; scene.fog = new THREE.Fog(sky, 40, 140);
      const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 400);
      const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.7); scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(40, 80, 20); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80 }); scene.add(sun);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x3a4a3a }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const BLOCK = 24, ROAD = 10, N = 5, blocks = [];
      const roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
      const span = N * (BLOCK + ROAD);
      for (let i = 0; i <= N; i++) {
        const p = -span / 2 + i * (BLOCK + ROAD) - ROAD / 2;
        const r1 = new THREE.Mesh(new THREE.PlaneGeometry(span + ROAD, ROAD), roadMat); r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.02, p); r1.receiveShadow = true; scene.add(r1);
        const r2 = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, span + ROAD), roadMat); r2.rotation.x = -Math.PI / 2; r2.position.set(p, 0.02, 0); r2.receiveShadow = true; scene.add(r2);
      }
      const colors = [0xd9c9a8, 0xa8b8c8, 0xc98f6b, 0x8fa0b0, 0xe0e0e0, 0x7d8a99, 0xb5a07a];
      const winLights = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const cx = -span / 2 + i * (BLOCK + ROAD) + BLOCK / 2, cz = -span / 2 + j * (BLOCK + ROAD) + BLOCK / 2;
        const count = 1 + ((i * 7 + j * 3) % 3);
        for (let k = 0; k < count; k++) {
          const w = count === 1 ? BLOCK - 4 : BLOCK / 2 - 2, dd = count === 3 && k === 2 ? BLOCK / 2 - 2 : count === 1 ? BLOCK - 4 : BLOCK - 4;
          const h = 6 + Math.random() * (i === 2 && j === 2 ? 50 : 26);
          const x = count === 1 ? cx : cx + (k % 2 ? 1 : -1) * (BLOCK / 4), z = cz;
          const mat = new THREE.MeshLambertMaterial({ color: colors[(i + j + k) % colors.length] });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, count === 3 ? BLOCK / 2 - 2 : dd), mat);
          const zz = count === 3 ? cz + (k === 2 ? BLOCK / 4 : -BLOCK / 4) : z;
          const xx = count === 3 && k === 2 ? cx : x;
          b.position.set(xx, h / 2, zz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
          b.geometry.computeBoundingBox();
          const bb = new THREE.Box3().setFromObject(b); blocks.push(bb);
          winLights.push(mat);
        }
      }
      // car
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), new THREE.MeshLambertMaterial({ color: 0xe2551b })); body.position.y = 0.8; body.castShadow = true;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2), new THREE.MeshLambertMaterial({ color: 0x222831 })); cab.position.set(0, 1.5, -0.2); cab.castShadow = true;
      car.add(body, cab);
      const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]].forEach(([x, z]) => { const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(x, 0.4, z); car.add(w); });
      const headL = new THREE.SpotLight(0xfff2cc, 0, 40, 0.5, 0.5); headL.position.set(0, 1, -2); headL.target.position.set(0, 0, -12); car.add(headL, headL.target);
      car.position.set(-span / 2 - ROAD / 2 + 0.5, 0, 0); scene.add(car);
      const phys = { speed: 0, angle: Math.PI, steer: 0 };
      let camMode = 0;
      nightBtn.onclick = () => {
        night = !night;
        const c = new THREE.Color(night ? 0x0b1020 : 0x9cc9ff); scene.background = c; scene.fog.color = c;
        hemi.intensity = night ? 0.15 : 0.7; sun.intensity = night ? 0.05 : 0.9; headL.intensity = night ? 2 : 0;
        winLights.forEach(m => m.emissive = new THREE.Color(night ? 0x2a2210 : 0x000000));
      };
      camBtn.onclick = () => { camMode = (camMode + 1) % 3; };
      const tmpBox = new THREE.Box3();
      let last = performance.now(), fps = 60;
      const tick = now => {
        requestAnimationFrame(tick);
        if (!visible(d)) { last = now; return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now; fps = fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
        const k = input.keys;
        const accel = (k.has("u") ? 18 : 0) - (k.has("d") ? 14 : 0);
        phys.speed += accel * dt; phys.speed *= 1 - 1.2 * dt; phys.speed = Math.max(-8, Math.min(28, phys.speed));
        const turn = (k.has("l") ? 1 : 0) - (k.has("r") ? 1 : 0);
        phys.angle += turn * dt * 1.9 * Math.min(1, Math.abs(phys.speed) / 6) * Math.sign(phys.speed || 1);
        const nx = car.position.x + Math.sin(phys.angle) * phys.speed * dt, nz = car.position.z + Math.cos(phys.angle) * phys.speed * dt;
        tmpBox.setFromCenterAndSize(new THREE.Vector3(nx, 1, nz), new THREE.Vector3(2.2, 2, 2.2));
        if (blocks.some(b => b.intersectsBox(tmpBox)) || Math.abs(nx) > 110 || Math.abs(nz) > 110) phys.speed *= -0.3;
        else car.position.set(nx, 0, nz);
        car.rotation.y = phys.angle + Math.PI;
        const back = camMode === 1 ? 0 : 11, up = camMode === 1 ? 45 : camMode === 2 ? 2.2 : 5;
        const target = new THREE.Vector3(car.position.x - Math.sin(phys.angle) * back, up, car.position.z - Math.cos(phys.angle) * back);
        if (camMode === 2) target.set(car.position.x + Math.sin(phys.angle) * 0.5, 2.2, car.position.z + Math.cos(phys.angle) * 0.5);
        camera.position.lerp(target, camMode === 2 ? 1 : 1 - Math.pow(0.001, dt));
        camera.lookAt(car.position.x + Math.sin(phys.angle) * (camMode === 2 ? 10 : 0), camMode === 2 ? 1.8 : 1, car.position.z + Math.cos(phys.angle) * (camMode === 2 ? 10 : 0));
        renderer.render(scene, camera);
        hud.textContent = `speed ${(Math.abs(phys.speed) * 3.6).toFixed(0)} km/h · FPS ${fps.toFixed(0)} · meshes ${scene.children.length} · triangles ${renderer.info.render.triangles} · camera ${["chase", "top-down", "first person"][camMode]}`;
      };
      requestAnimationFrame(tick);
      window.addEventListener("resize", () => { const w = box.clientWidth; if (!w) return; const h = Math.round(w * 0.6); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); });
    };
  };

  /* ---------------- XP, levels, achievements, settings ---------------- */
  const LEVELS = [[0, "מתחיל"], [150, "חניך"], [400, "מתכנת צעיר"], [800, "בונה"], [1400, "מפתח"], [2200, "מהנדס"], [3200, "ארכיטקט"], [4500, "מאסטר"], [6500, "אגדה"]];
  let xp = store.get("xp", 0);
  const awarded = new Set(store.get("awarded", []));
  const toastBox = el("div", { class: "toasts", "aria-live": "polite" });
  document.body.append(toastBox);
  function toast(msg, cls) {
    const t = el("div", { class: "toast " + (cls || "") }, msg);
    toastBox.append(t);
    setTimeout(() => t.classList.add("out"), 2200);
    setTimeout(() => t.remove(), 2700);
  }
  function levelOf(x) { let i = 0; while (i + 1 < LEVELS.length && x >= LEVELS[i + 1][0]) i++; return i; }
  function award(key, n, label) {
    if (key) { if (awarded.has(key)) return; awarded.add(key); store.set("awarded", [...awarded]); }
    const before = levelOf(xp);
    xp += n; store.set("xp", xp);
    toast(`+${n} XP · ${label}`);
    if (levelOf(xp) > before) toast(`עלית לרמה ${levelOf(xp) + 1}: ${LEVELS[levelOf(xp)][1]}!`, "big");
    refreshXp(); checkAchievements();
  }
  const count = pre => [...awarded].filter(k => k.startsWith(pre)).length;
  const ACH = [
    ["צעד ראשון", "סיימת פרק ראשון", () => done.size >= 1],
    ["קורא מתמיד", "סיימת 10 פרקים", () => done.size >= 10],
    ["חצי דרך", "סיימת חצי מהפרקים", () => done.size >= chapters.length / 2],
    ["סיימתי הכול", "סיימת את כל הפרקים", () => done.size >= chapters.length],
    ["מדען מתחיל", "ניסית מעבדה ראשונה", () => count("demo:") >= 1],
    ["חוקר", "ניסית 15 מעבדות", () => count("demo:") >= 15],
    ["מעבדן על", "ניסית 40 מעבדות", () => count("demo:") >= 40],
    ["תשובה נכונה", "ענית נכון על שאלה", () => count("quiz:") >= 1],
    ["יודע-כל", "50 תשובות נכונות", () => count("quiz:") >= 50],
    ["מושלם", "בוחן אחד בלי טעויות", () => count("perfect:") >= 1],
    ["פרפקציוניסט", "10 בחנים מושלמים", () => count("perfect:") >= 10],
    ["פותר בעיות", "פתרת אתגר קוד ראשון", () => count("challenge:") >= 1],
    ["האקר", "פתרת 10 אתגרי קוד", () => count("challenge:") >= 10],
    ["אלוף האתגרים", "פתרת 25 אתגרי קוד", () => count("challenge:") >= 25],
    ["מילונאי", "למדת 30 מונחים בכרטיסיות", () => count("card:") >= 30],
    ["מאסטר מילים", "למדת 150 מונחים בכרטיסיות", () => count("card:") >= 150],
  ];
  const ach = new Set(store.get("ach", []));
  function checkAchievements() {
    ACH.forEach(([name, desc, test]) => {
      if (!ach.has(name) && test()) { ach.add(name); store.set("ach", [...ach]); toast("הישג חדש: " + name, "big"); }
    });
  }
  function refreshXp() {
    const L = levelOf(xp);
    $("#xp-btn").textContent = `רמה ${L + 1} · ${xp} XP`;
  }
  const panel = $("#profile");
  function openProfile() {
    const L = levelOf(xp), cur = LEVELS[L][0], next = LEVELS[L + 1] ? LEVELS[L + 1][0] : cur;
    const pct = next > cur ? Math.round(100 * (xp - cur) / (next - cur)) : 100;
    const theme = store.get("theme", "system"), fs = store.get("fs", "m");
    const body = $(".profile-body", panel);
    body.innerHTML = "";
    const confirmRow = el("div", { class: "row", hidden: "" },
      el("span", {}, "למחוק את כל ההתקדמות, ה-XP וההישגים?"),
      el("button", { class: "danger", onclick: () => { ["done", "xp", "awarded", "ach", "cards"].forEach(k => store.set(k, null)); location.reload(); } }, "כן, למחוק"),
      el("button", { onclick: () => { confirmRow.hidden = true; } }, "ביטול"));
    body.append(
      el("div", { class: "lvl-name" }, `רמה ${L + 1}: ${LEVELS[L][1]}`),
      el("div", { class: "lvl-bar" }, el("i", { style: `width:${pct}%` })),
      el("div", { class: "muted" }, LEVELS[L + 1] ? `${xp} XP · עוד ${next - xp} XP לרמה ${L + 2} (${LEVELS[L + 1][1]})` : `${xp} XP · הרמה הגבוהה ביותר!`),
      el("div", { class: "stat-grid" },
        ...[["פרקים", done.size + "/" + chapters.length], ["מעבדות שניסית", count("demo:")], ["תשובות נכונות", count("quiz:")], ["אתגרי קוד", count("challenge:")], ["מונחים שלמדת", count("card:")]]
          .map(([k, v]) => el("div", {}, el("b", {}, String(v)), el("span", {}, k)))),
      el("h3", {}, "הישגים"),
      el("div", { class: "ach-grid" }, ...ACH.map(([name, desc]) => el("div", { class: "ach" + (ach.has(name) ? " got" : "") }, el("b", {}, (ach.has(name) ? "★ " : "☆ ") + name), el("span", {}, desc)))),
      el("h3", {}, "הגדרות"),
      el("div", { class: "row" }, el("span", {}, "ערכת צבעים:"),
        ...[["system", "לפי המכשיר"], ["light", "בהיר"], ["dark", "כהה"]].map(([v, t]) => el("button", { class: theme === v ? "on" : "", onclick: () => { store.set("theme", v); applySettings(); openProfile(); } }, t))),
      el("div", { class: "row" }, el("span", {}, "גודל טקסט:"),
        ...[["s", "קטן"], ["m", "רגיל"], ["l", "גדול"], ["xl", "ענק"]].map(([v, t]) => el("button", { class: fs === v ? "on" : "", onclick: () => { store.set("fs", v); applySettings(); openProfile(); } }, t))),
      el("div", { class: "row" }, el("button", { class: "danger", onclick: () => { confirmRow.hidden = false; } }, "איפוס התקדמות")),
      confirmRow);
    panel.hidden = false;
  }
  function applySettings() {
    const theme = store.get("theme", "system");
    if (theme === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.fs = store.get("fs", "m");
  }
  $("#xp-btn").addEventListener("click", openProfile);
  $(".profile-close", panel).addEventListener("click", () => { panel.hidden = true; });
  panel.addEventListener("click", e => { if (e.target === panel) panel.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") panel.hidden = true; });
  applySettings();

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.MG = { $, $$, el, store, head, visible, makeInput, award, toast, sleep, loadThree, GLOSSARY: G };

  /* ---------------- Boot ---------------- */
  chapters.forEach((c, i) => { const e = $(".eyebrow", c); if (e) e.textContent = e.textContent.replace(/^פרק \d+/, "פרק " + i); });
  $$("pre.copy").forEach(pre => {
    const b = el("button", { class: "copy-btn", type: "button" }, "העתק");
    b.addEventListener("click", async () => {
      const txt = pre.querySelector("code").textContent;
      try { await navigator.clipboard.writeText(txt); b.textContent = "הועתק ✓"; }
      catch (e) { const r = document.createRange(); r.selectNodeContents(pre.querySelector("code")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = "סומן, לחץ Ctrl+C"; }
      setTimeout(() => { b.textContent = "העתק"; }, 1800);
    });
    pre.append(b);
  });
  const dc = $("#demo-count"); if (dc) dc.textContent = $$(".demo[data-demo]").length;
  const tc = $("#term-count"); if (tc) tc.textContent = G.length;
  buildToc();
  addFooters();
  buildQuizzes();
  renderGlossary();
  // count reading text only: skip quiz data and demo UI
  let words = 0;
  chapters.forEach(c => {
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest("script, .demo") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    while (w.nextNode()) words += (w.currentNode.nodeValue.match(/[\p{L}\p{N}]\S*/gu) || []).length;
  });
  const wc = $("#word-count"); if (wc) wc.textContent = words.toLocaleString("he-IL");
  refreshProgress();
  refreshXp();
  show(location.hash.slice(1) || store.get("last", chapters[0].id));
  window.scrollTo(0, 0);
  window.addEventListener("load", () => setTimeout(() => window.scrollTo(0, 0), 0));
})();

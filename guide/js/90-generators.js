// Demos: generator galleries — one engine each, many distinct outputs
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});

  /* ---------------- Fractal gallery ---------------- */
  D.fractals = d => {
    const { el, head } = MG;
    head(d, "מחולל · גלריית פרקטלים", "9 פרקטלים ממנוע אחד", "כל פרקטל הוא נוסחה קצרה שחוזרת על עצמה ויוצרת אינסוף פרטים. בחר פרקטל. בפרקטלים מסוג ״בריחה״ (מנדלברוט, ז׳וליה) אפשר ללחוץ כדי להתקרב.");
    const W = 320, H = 260;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "פרקטל", style: "max-width:100%;cursor:zoom-in" });
    const ctx = cv.getContext("2d");
    const info = el("div", { class: "note ltr", style: "min-height:18px" });
    const escape = {
      "מנדלברוט": { cx: -0.6, cy: 0, sc: 3, it: 120, f: (x, y, jx, jy) => { let zx = 0, zy = 0, cxx = x, cyy = y, i = 0; while (zx * zx + zy * zy < 4 && i < 120) { const t = zx * zx - zy * zy + cxx; zy = 2 * zx * zy + cyy; zx = t; i++; } return i; } },
      "ז׳וליה קלאסית": { cx: 0, cy: 0, sc: 3, it: 120, jx: -0.8, jy: 0.156, f: (x, y, jx, jy) => { let zx = x, zy = y, i = 0; while (zx * zx + zy * zy < 4 && i < 120) { const t = zx * zx - zy * zy + jx; zy = 2 * zx * zy + jy; zx = t; i++; } return i; } },
      "ז׳וליה ספירלה": { cx: 0, cy: 0, sc: 3, it: 120, jx: 0.285, jy: 0.01, f: (x, y, jx, jy) => { let zx = x, zy = y, i = 0; while (zx * zx + zy * zy < 4 && i < 120) { const t = zx * zx - zy * zy + jx; zy = 2 * zx * zy + jy; zx = t; i++; } return i; } },
      "ז׳וליה ברק": { cx: 0, cy: 0, sc: 3, it: 120, jx: -0.70176, jy: -0.3842, f: (x, y, jx, jy) => { let zx = x, zy = y, i = 0; while (zx * zx + zy * zy < 4 && i < 120) { const t = zx * zx - zy * zy + jx; zy = 2 * zx * zy + jy; zx = t; i++; } return i; } },
      "ספינת בערה": { cx: -0.5, cy: -0.5, sc: 3, it: 120, f: (x, y) => { let zx = 0, zy = 0, i = 0; while (zx * zx + zy * zy < 4 && i < 120) { const t = zx * zx - zy * zy + x; zy = Math.abs(2 * zx * zy) + y; zx = t; i++; } return i; } },
    };
    const geo = {
      "משולש סירפינסקי": ctx => { let x = 0, y = 0; const V = [[W / 2, 10], [10, H - 10], [W - 10, H - 10]]; for (let i = 0; i < 40000; i++) { const v = V[Math.floor(Math.random() * 3)]; x = (x + v[0]) / 2; y = (y + v[1]) / 2; if (i > 20) { ctx.fillStyle = `hsl(${(x / W) * 120 + 180},80%,60%)`; ctx.fillRect(x, y, 1, 1); } } },
      "שרך ברנסלי": ctx => { let x = 0, y = 0; for (let i = 0; i < 60000; i++) { const r = Math.random(); let nx, ny; if (r < 0.01) { nx = 0; ny = 0.16 * y; } else if (r < 0.86) { nx = 0.85 * x + 0.04 * y; ny = -0.04 * x + 0.85 * y + 1.6; } else if (r < 0.93) { nx = 0.2 * x - 0.26 * y; ny = 0.23 * x + 0.22 * y + 1.6; } else { nx = -0.15 * x + 0.28 * y; ny = 0.26 * x + 0.24 * y + 0.44; } x = nx; y = ny; ctx.fillStyle = "#5fd08f"; ctx.fillRect(W / 2 + x * 26, H - y * 26 - 8, 1, 1); } },
      "פתית קוך": ctx => { const koch = (x1, y1, x2, y2, dep) => { if (dep === 0) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return; } const dx = (x2 - x1) / 3, dy = (y2 - y1) / 3; const xa = x1 + dx, ya = y1 + dy, xb = x1 + 2 * dx, yb = y1 + 2 * dy; const ang = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 3, len = Math.hypot(dx, dy); const xp = xa + Math.cos(ang) * len, yp = ya + Math.sin(ang) * len; koch(x1, y1, xa, ya, dep - 1); koch(xa, ya, xp, yp, dep - 1); koch(xp, yp, xb, yb, dep - 1); koch(xb, yb, x2, y2, dep - 1); }; ctx.strokeStyle = "#7fb0ff"; const cx = W / 2, cy = H / 2 + 30, r = 110; const p = [0, 1, 2].map(i => [cx + r * Math.cos(-Math.PI / 2 + i * 2.094), cy + r * Math.sin(-Math.PI / 2 + i * 2.094)]); koch(p[0][0], p[0][1], p[1][0], p[1][1], 4); koch(p[1][0], p[1][1], p[2][0], p[2][1], 4); koch(p[2][0], p[2][1], p[0][0], p[0][1], 4); },
      "עץ פיתגורס": ctx => { const tree = (x, y, len, ang, dep) => { if (dep === 0 || len < 2) return; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; ctx.strokeStyle = `hsl(${dep * 18 + 20},70%,${30 + dep * 5}%)`; ctx.lineWidth = dep / 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); tree(x2, y2, len * 0.75, ang - 0.5, dep - 1); tree(x2, y2, len * 0.75, ang + 0.5, dep - 1); }; tree(W / 2, H - 10, 55, -Math.PI / 2, 11); ctx.lineWidth = 1; },
      "עקום הדרקון": ctx => { let seq = [1]; for (let i = 0; i < 12; i++) seq = seq.concat([1], seq.slice().reverse().map(v => -v)); let x = W / 2 - 40, y = H / 2 + 20, ang = 0; const step = 4; ctx.strokeStyle = "#ff9a4a"; ctx.beginPath(); ctx.moveTo(x, y); for (const t of seq) { x += Math.cos(ang) * step; y += Math.sin(ang) * step; ctx.lineTo(x, y); ang += t * Math.PI / 2; } ctx.stroke(); },
    };
    const names = [...Object.keys(escape), ...Object.keys(geo)];
    const sel = el("select", { id: "fr-sel", "aria-label": "פרקטל" }, ...names.map(n => el("option", { value: n }, n)));
    let view = null;
    const render = () => {
      const name = sel.value;
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      if (escape[name]) {
        const fr = escape[name]; if (!view || view.name !== name) view = { name, cx: fr.cx, cy: fr.cy, sc: fr.sc };
        const img = ctx.createImageData(W, H);
        for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
          const x = view.cx + (px / W - 0.5) * view.sc, y = view.cy + (py / H - 0.5) * view.sc * H / W;
          const i = fr.f(x, y, fr.jx, fr.jy), k = (py * W + px) * 4;
          if (i >= 120) { img.data[k] = img.data[k + 1] = img.data[k + 2] = 8; } else { const t = i / 120; img.data[k] = 9 + 255 * t; img.data[k + 1] = 40 + 160 * Math.sin(t * 3.1); img.data[k + 2] = 120 + 130 * (1 - t); }
          img.data[k + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        cv.style.cursor = "zoom-in"; info.textContent = "לחץ להתקרב · זום ×" + (escape[name].sc / view.sc).toFixed(1);
      } else { geo[name](ctx); cv.style.cursor = "default"; info.textContent = "פרקטל גיאומטרי (רקורסיה)"; }
    };
    cv.addEventListener("click", e => { const name = sel.value; if (!escape[name]) return; const r = cv.getBoundingClientRect(); view.cx += ((e.clientX - r.left) / r.width - 0.5) * view.sc; view.cy += ((e.clientY - r.top) / r.height - 0.5) * view.sc * H / W; view.sc *= 0.5; render(); });
    sel.onchange = () => { view = null; render(); };
    d.append(el("div", { class: "row" }, el("span", {}, "פרקטל:"), sel, el("button", { onclick: () => { view = null; render(); } }, "אפס")), cv, info);
    render();
  };

  /* ---------------- L-System gallery ---------------- */
  D.lsystem = d => {
    const { el, head } = MG;
    head(d, "מחולל · L-Systems", "צמחים ופרקטלים מחוקים", "צב מדומה הולך לפי מחרוזת פקודות: F=קדימה, +/− =פנייה, [ ]=ענף. כמה חוקים פשוטים, שחוזרים על עצמם, יוצרים עצים, שרכים ופתיתי שלג. בחר צורה.");
    const W = 320, H = 280;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "L-system", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    const P = {
      "עץ פשוט": { axiom: "F", rules: { F: "FF+[+F-F-F]-[-F+F+F]" }, angle: 22, iters: 4, start: -90, col: "#5fd08f" },
      "שיח": { axiom: "F", rules: { F: "FF-[-F+F+F]+[+F-F-F]" }, angle: 25, iters: 4, start: -90, col: "#8fd08f" },
      "שרך": { axiom: "X", rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" }, angle: 25, iters: 5, start: -75, col: "#5fd0a0" },
      "עשב": { axiom: "F", rules: { F: "F[+F]F[-F]F" }, angle: 25, iters: 4, start: -90, col: "#7fd060" },
      "פתית קוך": { axiom: "F++F++F", rules: { F: "F-F++F-F" }, angle: 60, iters: 4, start: 0, col: "#7fb0ff" },
      "משולש סירפינסקי": { axiom: "F-G-G", rules: { F: "F-G+F+G-F", G: "GG" }, angle: 120, iters: 5, start: 0, col: "#c77dff" },
      "עקום הדרקון": { axiom: "F", rules: { F: "F+G", G: "F-G" }, angle: 90, iters: 11, start: 0, col: "#ff9a4a" },
      "עקום גוספר": { axiom: "F", rules: { F: "F-G--G+F++FF+G-", G: "+F-GG--G-F++F+G" }, angle: 60, iters: 3, start: 0, col: "#5fd0d0" },
    };
    const sel = el("select", { id: "ls-sel", "aria-label": "צורה" }, ...Object.keys(P).map(n => el("option", { value: n }, n)));
    const render = () => {
      const p = P[sel.value];
      let s = p.axiom;
      for (let i = 0; i < p.iters; i++) { let n = ""; for (const c of s) n += p.rules[c] || c; s = n; if (s.length > 200000) break; }
      // first pass: bounds
      const run = (cb) => { let x = 0, y = 0, a = p.start * Math.PI / 180; const st = []; const step = 5; for (const c of s) { if (c === "F" || c === "G") { const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step; cb(x, y, nx, ny); x = nx; y = ny; } else if (c === "+") a += p.angle * Math.PI / 180; else if (c === "-") a -= p.angle * Math.PI / 180; else if (c === "[") st.push([x, y, a]); else if (c === "]") [x, y, a] = st.pop(); } };
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      run((x, y, nx, ny) => { minX = Math.min(minX, x, nx); maxX = Math.max(maxX, x, nx); minY = Math.min(minY, y, ny); maxY = Math.max(maxY, y, ny); });
      const scale = Math.min((W - 20) / (maxX - minX || 1), (H - 20) / (maxY - minY || 1));
      const ox = (W - (maxX - minX) * scale) / 2 - minX * scale, oy = (H - (maxY - minY) * scale) / 2 - minY * scale;
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = p.col; ctx.lineWidth = 1; ctx.beginPath();
      run((x, y, nx, ny) => { ctx.moveTo(ox + x * scale, oy + y * scale); ctx.lineTo(ox + nx * scale, oy + ny * scale); });
      ctx.stroke();
    };
    sel.onchange = render;
    d.append(el("div", { class: "row" }, el("span", {}, "צורה:"), sel), cv, el("div", { class: "note" }, "אותו מנוע, שמונה צורות. ההבדל היחיד: החוקים והזווית."));
    render();
  };

  /* ---------------- Strange attractors ---------------- */
  D.attractor = d => {
    const { el, head, visible } = MG;
    head(d, "מחולל · מושכים מוזרים", "כאוס יפהפה מנוסחה", "נקודה קופצת לפי נוסחה, ומשאירה עקבות. היא לעולם לא חוזרת לאותו מקום, אבל תמיד נשארת באותה צורה — ״מושך מוזר״. בחר אחד.");
    const W = 320, H = 280;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "מושך", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    const A = {
      "קליפורד": { step: (x, y) => [Math.sin(-1.4 * y) + 1.6 * Math.cos(-1.4 * x), Math.sin(1.6 * x) + 0.7 * Math.cos(1.6 * y)], sc: 55 },
      "דה-ז׳ונג": { step: (x, y) => [Math.sin(-2.0 * y) - Math.cos(2.0 * x), Math.sin(1.7 * x) - Math.cos(-1.8 * y)], sc: 60 },
      "לורנץ": { lorenz: true },
      "תומאס": { step: (x, y, z) => { const b = 0.19, dt = 0.1; return [x + dt * (Math.sin(y) - b * x), y + dt * (Math.sin(z) - b * y), z + dt * (Math.sin(x) - b * z)]; }, sc: 26, is3: true },
    };
    const sel = el("select", { id: "at-sel", "aria-label": "מושך" }, ...Object.keys(A).map(n => el("option", { value: n }, n)));
    let x = 0.1, y = 0, z = 0, running = true, cur = "קליפורד";
    const reset = () => { x = 0.1; y = 0; z = 0.1; ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H); };
    const loop = () => {
      requestAnimationFrame(loop);
      if (!visible(d) || !running) return;
      const a = A[cur];
      ctx.fillStyle = "rgba(5,8,12,.02)"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 2000; i++) {
        if (a.lorenz) { const dt = 0.008; const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 2.667 * z; x += dx * dt; y += dy * dt; z += dz * dt; const px = W / 2 + x * 5.5, py = H - 20 - z * 5; ctx.fillStyle = `hsl(${180 + z * 4},80%,60%)`; ctx.fillRect(px, py, 1, 1); }
        else if (a.is3) { [x, y, z] = a.step(x, y, z); ctx.fillStyle = `hsl(${200 + z * 20},80%,62%)`; ctx.fillRect(W / 2 + x * a.sc, H / 2 + y * a.sc, 1, 1); }
        else { const [nx, ny] = a.step(x, y); x = nx; y = ny; ctx.fillStyle = `hsla(${(x + 2) * 60},80%,65%,.6)`; ctx.fillRect(W / 2 + x * a.sc, H / 2 + y * a.sc, 1, 1); }
      }
    };
    sel.onchange = () => { cur = sel.value; reset(); };
    d.append(el("div", { class: "row" }, el("span", {}, "מושך:"), sel, el("button", { onclick: () => { running = !running; } }, "עצור / המשך"), el("button", { onclick: reset }, "נקה")), cv);
    reset(); requestAnimationFrame(loop);
  };

  /* ---------------- Math art gallery ---------------- */
  D.mathart = d => {
    const { el, head, visible } = MG;
    head(d, "מחולל · אמנות מתמטית", "עקומות יפות מ-sin ו-cos", "אותם sin ו-cos מפרק המתמטיקה, יוצרים אמנות. בחר סוג ושחק עם המחוונים.");
    const W = 300, H = 300;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "אמנות", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    const p = { a: 3, b: 4, c: 5, d: 2 };
    const sel = el("select", { id: "ma-sel", "aria-label": "סוג" }, ...["ליסז׳ו", "עלי כותרת (Rose)", "ספירוגרף", "פילוטקסיס (חמנייה)", "הרמונוגרף"].map(n => el("option", { value: n }, n)));
    const sliders = ["a", "b", "c", "d"].map(k => { const s = el("input", { type: "range", min: "1", max: "12", step: "1", value: String(p[k]), id: "ma-" + k, "aria-label": k }); s.oninput = () => { p[k] = +s.value; render(); }; return el("label", {}, k, s); });
    let t0 = performance.now();
    const render = () => {
      const cx = W / 2, cy = H / 2, R = 130;
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#7fb0ff"; ctx.lineWidth = 1.5; ctx.beginPath();
      const type = sel.value;
      for (let i = 0; i <= 2000; i++) {
        const t = i / 2000 * Math.PI * 2 * (type === "עלי כותרת (Rose)" ? p.b : 1);
        let x, y;
        if (type === "ליסז׳ו") { x = Math.sin(p.a * t + Math.PI / 2); y = Math.sin(p.b * t); }
        else if (type === "עלי כותרת (Rose)") { const r = Math.cos(p.a / p.c * t); x = r * Math.cos(t); y = r * Math.sin(t); }
        else if (type === "ספירוגרף") { const R1 = p.a, r1 = p.b, dd = p.c; x = ((R1 - r1) * Math.cos(t) + dd * Math.cos((R1 - r1) / r1 * t)) / (R1 + dd); y = ((R1 - r1) * Math.sin(t) - dd * Math.sin((R1 - r1) / r1 * t)) / (R1 + dd); }
        else if (type === "הרמונוגרף") { const e = Math.exp(-t / 15); x = e * Math.sin(p.a * t) * 0.5 + e * Math.sin(p.c * t) * 0.5; y = e * Math.sin(p.b * t + 1) * 0.5 + e * Math.sin(p.d * t) * 0.5; }
        else { x = 0; y = 0; }
        i ? ctx.lineTo(cx + x * R, cy + y * R) : ctx.moveTo(cx + x * R, cy + y * R);
      }
      ctx.stroke();
      if (type === "פילוטקסיס (חמנייה)") { const n = 700, g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const a = i * g, r = Math.sqrt(i / n) * R; ctx.fillStyle = `hsl(${i / n * 60 + 20},80%,60%)`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5, 0, 7); ctx.fill(); } }
    };
    sel.onchange = render;
    d.append(el("div", { class: "row" }, el("span", {}, "סוג:"), sel), cv, el("div", { class: "grid2" }, ...sliders), el("div", { class: "note" }, "כל שינוי במחוונים = צורה חדשה לגמרי. אינסוף אפשרויות ממנוע אחד."));
    render();
  };

  /* ---------------- Double pendulum (chaos) ---------------- */
  D.pendulum = d => {
    const { el, head, visible } = MG;
    head(d, "מחולל · מטוטלת כפולה", "כאוס: תלות ברגישות בתנאי ההתחלה", "שתי מטוטלות זהות כמעט לגמרי, עם הבדל זעיר בהתחלה. תוך שניות הן מתפצלות לגמרי. זו ״תורת הכאוס״: מערכות שבהן שינוי קטן יוצר תוצאה שונה לחלוטין. לחץ ״שחרר״.");
    const W = 320, H = 300;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "מטוטלת", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    const mk = off => ({ a1: Math.PI / 2 + off, a2: Math.PI / 2, v1: 0, v2: 0, trail: [] });
    let pens, running = false;
    const reset = () => { pens = [mk(0), mk(0.01)]; ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H); };
    const stepP = (p, dt) => {
      const g = 1, L = 70, m = 1;
      const { a1, a2, v1, v2 } = p;
      const num1 = -g * (2 * m) * Math.sin(a1) - m * g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(a1 - a2) * m * (v2 * v2 + v1 * v1 * Math.cos(a1 - a2));
      const den = (2 * m - m * Math.cos(2 * a1 - 2 * a2));
      const acc1 = num1 / (L * den);
      const num2 = 2 * Math.sin(a1 - a2) * (v1 * v1 * 2 * m + g * 2 * m * Math.cos(a1) + v2 * v2 * m * Math.cos(a1 - a2));
      const acc2 = num2 / (L * den);
      p.v1 += acc1 * dt; p.v2 += acc2 * dt; p.a1 += p.v1 * dt; p.a2 += p.v2 * dt;
    };
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(2, (now - last) / 16 || 1); last = now;
      if (!visible(d)) return;
      ctx.fillStyle = "rgba(5,8,12,.12)"; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = 110, L = 70;
      const cols = ["#ffb454", "#7fb0ff"];
      pens.forEach((p, idx) => {
        if (running) for (let k = 0; k < 3; k++) stepP(p, 0.28 * dt / 3);
        const x1 = cx + L * Math.sin(p.a1), y1 = cy + L * Math.cos(p.a1);
        const x2 = x1 + L * Math.sin(p.a2), y2 = y1 + L * Math.cos(p.a2);
        p.trail.push([x2, y2]); if (p.trail.length > 120) p.trail.shift();
        ctx.strokeStyle = cols[idx] + "55"; ctx.beginPath(); p.trail.forEach(([tx, ty], i) => i ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty)); ctx.stroke();
        ctx.strokeStyle = cols[idx]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = cols[idx]; ctx.beginPath(); ctx.arc(x2, y2, 5, 0, 7); ctx.fill();
      });
    };
    reset();
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: () => { running = true; } }, "▶ שחרר"), el("button", { onclick: () => { running = false; reset(); } }, "אפס")), el("div", { class: "note" }, "כתום וכחול מתחילים כמעט זהים. שים לב מתי הם מתפצלים."));
    requestAnimationFrame(loop);
  };

  /* ---------------- Wave interference ---------------- */
  D.waves = d => {
    const { el, head, visible } = MG;
    head(d, "מחולל · התאבכות גלים", "איך גלים מתחברים", "שני מקורות גלים (לחץ להזיז). איפה שני גלים נפגשים ב״פסגה״ הם מתחזקים, ואיפה פסגה פוגשת שקע הם מבטלים זה את זה. ככה עובדים קול, אור, ורשתות אלחוטיות.");
    const W = 280, H = 220, SC = 2;
    const cv = el("canvas", { width: String(W * SC), height: String(H * SC), "aria-label": "גלים", style: "max-width:100%;cursor:crosshair" });
    const ctx = cv.getContext("2d");
    let s1 = [W * 0.35, H / 2], s2 = [W * 0.65, H / 2], t = 0, drag = 0;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    cv.addEventListener("pointerdown", e => { const [x, y] = pos(e); drag = Math.hypot(x - s1[0], y - s1[1]) < Math.hypot(x - s2[0], y - s2[1]) ? 1 : 2; });
    cv.addEventListener("pointermove", e => { if (!drag) return; const p = pos(e); if (drag === 1) s1 = p; else s2 = p; });
    cv.addEventListener("pointerup", () => drag = 0);
    const loop = () => {
      requestAnimationFrame(loop);
      if (!visible(d)) return;
      t += 0.15;
      const img = ctx.createImageData(W * SC, H * SC);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d1 = Math.hypot(x - s1[0], y - s1[1]), d2 = Math.hypot(x - s2[0], y - s2[1]);
        const v = Math.sin(d1 * 0.4 - t) + Math.sin(d2 * 0.4 - t);
        const c = 128 + v * 63;
        for (let j = 0; j < SC; j++) for (let i = 0; i < SC; i++) { const k = ((y * SC + j) * W * SC + x * SC + i) * 4; img.data[k] = c * 0.4; img.data[k + 1] = c * 0.7; img.data[k + 2] = c; img.data[k + 3] = 255; }
      }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = "#ff5a5a"; [s1, s2].forEach(s => { ctx.beginPath(); ctx.arc(s[0] * SC, s[1] * SC, 4, 0, 7); ctx.fill(); });
    };
    d.append(cv, el("div", { class: "note", style: "margin-top:6px" }, "גרור את שתי הנקודות האדומות. הפסים הכהים הם ״ביטול״, הבהירים הם ״חיזוק״."));
    requestAnimationFrame(loop);
  };
})();

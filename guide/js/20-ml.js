// Demos: machine learning deep dive
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});
  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // Gradient descent: fit a line
  D.linefit = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · ירידה במורד השיפוע", "מכונה שלומדת לצייר קו", "המודל הכי פשוט: קו ישר y = w·x + b. הוא מתחיל עם ניחוש גרוע, ובכל צעד בודק את הטעות (הקווים האדומים) ומזיז קצת את w ואת b לכיוון שמקטין אותה. לחץ על הגרף כדי להוסיף נקודות.");
    const W = 360, H = 260;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "נתונים וקו" });
    const ls = el("canvas", { width: "150", height: "150", "aria-label": "נוף הטעות", style: "max-width:150px" });
    const ctx = cv.getContext("2d"), lctx = ls.getContext("2d");
    let pts = [], w = -0.8, b = 0.6, running = false, hist = [], trail = [];
    const lr = el("input", { type: "range", min: "0.01", max: "0.6", step: "0.01", value: "0.15", id: "lf-lr", "aria-label": "קצב למידה" });
    const lrL = el("b", {}, "0.15");
    const info = el("div", { class: "note ltr", style: "font-variant-numeric:tabular-nums" });
    const seed = () => { pts = Array.from({ length: 14 }, () => { const x = rand(-1, 1); return [x, 0.6 * x + 0.1 + gauss() * 0.12]; }); };
    const toPx = (x, y) => [(x + 1.1) / 2.2 * W, H - (y + 1.1) / 2.2 * H];
    const loss = (w_, b_) => pts.reduce((s, [x, y]) => s + (w_ * x + b_ - y) ** 2, 0) / Math.max(1, pts.length);
    let landscape = null;
    const buildLandscape = () => {
      const img = lctx.createImageData(150, 150);
      let mx = 0; const vals = [];
      for (let j = 0; j < 150; j++) for (let i = 0; i < 150; i++) { const v = loss(-2 + i / 150 * 4, 2 - j / 150 * 4); vals.push(v); mx = Math.max(mx, v); }
      vals.forEach((v, k) => { const t = Math.sqrt(v / mx); img.data[k * 4] = 20 + 230 * t; img.data[k * 4 + 1] = 40 + 120 * (1 - t); img.data[k * 4 + 2] = 90 + 120 * (1 - t); img.data[k * 4 + 3] = 255; });
      landscape = img;
    };
    const step = () => {
      let gw = 0, gb = 0;
      pts.forEach(([x, y]) => { const e = w * x + b - y; gw += 2 * e * x; gb += 2 * e; });
      const n = Math.max(1, pts.length);
      w -= +lr.value * gw / n; b -= +lr.value * gb / n;
      hist.push(loss(w, b)); if (hist.length > 200) hist.shift();
      trail.push([w, b]); if (trail.length > 300) trail.shift();
    };
    const draw = () => {
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#1f2b3b"; ctx.beginPath(); ctx.moveTo(...toPx(-1.1, 0)); ctx.lineTo(...toPx(1.1, 0)); ctx.moveTo(...toPx(0, -1.1)); ctx.lineTo(...toPx(0, 1.1)); ctx.stroke();
      pts.forEach(([x, y]) => {
        const [px, py] = toPx(x, y), [, qy] = toPx(x, w * x + b);
        ctx.strokeStyle = "rgba(255,107,107,.7)"; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, qy); ctx.stroke();
        ctx.fillStyle = "#7fb0ff"; ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
      });
      ctx.strokeStyle = "#ffb454"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...toPx(-1.1, w * -1.1 + b)); ctx.lineTo(...toPx(1.1, w * 1.1 + b)); ctx.stroke(); ctx.lineWidth = 1;
      if (hist.length > 1) {
        const mx = Math.max(...hist);
        ctx.strokeStyle = "#5fd08f"; ctx.beginPath();
        hist.forEach((v, i) => { const x = W - 130 + i / 200 * 120, y = 60 - v / mx * 45; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.fillStyle = "#7d8fa6"; ctx.font = "11px monospace"; ctx.fillText("loss", W - 130, 12);
      }
      if (landscape) {
        lctx.putImageData(landscape, 0, 0);
        lctx.fillStyle = "#fff";
        trail.forEach(([tw, tb], i) => { if (i % 3) return; lctx.fillRect((tw + 2) / 4 * 150 - 1, (2 - tb) / 4 * 150 - 1, 2, 2); });
        lctx.fillStyle = "#ffb454"; lctx.beginPath(); lctx.arc((w + 2) / 4 * 150, (2 - b) / 4 * 150, 4, 0, 7); lctx.fill();
      }
      info.textContent = `w = ${w.toFixed(3)}   b = ${b.toFixed(3)}   loss (MSE) = ${loss(w, b).toFixed(4)}   steps = ${trail.length}`;
    };
    const loop = () => { requestAnimationFrame(loop); if (!visible(d)) return; if (running) step(); draw(); };
    cv.addEventListener("pointerdown", e => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 2.2 - 1.1, y = (1 - (e.clientY - r.top) / r.height) * 2.2 - 1.1;
      pts.push([x, y]); buildLandscape();
    });
    lr.oninput = () => { lrL.textContent = lr.value; };
    const runBtn = el("button", { class: "primary", onclick: () => { running = !running; runBtn.textContent = running ? "⏸ עצור" : "▶ התחל ללמוד"; } }, "▶ התחל ללמוד");
    d.append(el("div", { class: "grid2" }, cv, el("div", {}, el("div", { class: "note" }, "נוף הטעות: כל נקודה היא w,b אפשרי. כהה = טעות קטנה. הנקודה הכתומה מתגלגלת ״במורד״ אל העמק:"), ls, info)),
      el("div", { class: "row", style: "margin-top:10px" }, runBtn, el("button", { onclick: step }, "צעד אחד"),
        el("button", { onclick: () => { w = rand(-1.8, 1.8); b = rand(-1.5, 1.5); hist = []; trail = []; } }, "ניחוש התחלתי חדש"),
        el("button", { onclick: () => { seed(); buildLandscape(); hist = []; trail = []; } }, "נתונים חדשים"),
        el("button", { onclick: () => { pts = []; buildLandscape(); } }, "נקה נקודות")),
      el("label", {}, el("span", {}, "קצב למידה (learning rate) = ", lrL, " · גבוה מדי = קופץ ולא מתכנס, נמוך מדי = איטי"), lr));
    seed(); buildLandscape(); requestAnimationFrame(loop);
  };

  // Neural network playground
  D.nnplay = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · מגרש משחקים לרשת נוירונים", "תאמן רשת נוירונים אמיתית", "הרשת צריכה ללמוד להפריד בין נקודות כתומות לכחולות. הצבע ברקע הוא מה שהרשת ״חושבת״ על כל מקום. נסה: עיגול בלי שכבה נסתרת לא מצליח; עם 4 נוירונים מצליח. הספירלה קשה במיוחד.");
    const S = 260;
    const cv = el("canvas", { width: String(S), height: String(S), "aria-label": "הרשת והנתונים", style: "max-width:320px" });
    const nc = el("canvas", { width: "320", height: "200", "aria-label": "מבנה הרשת", style: "max-width:320px" });
    const ctx = cv.getContext("2d"), nctx = nc.getContext("2d");
    const ds = el("select", { id: "nn-ds", "aria-label": "נתונים" }, ...[["circle", "עיגול"], ["xor", "XOR (ארבעה רבעים)"], ["blobs", "שני עננים"], ["spiral", "ספירלה"]].map(([v, t]) => el("option", { value: v }, t)));
    const arch = el("select", { id: "nn-arch", "aria-label": "מבנה" }, ...[["0", "בלי שכבה נסתרת"], ["2", "שכבה: 2 נוירונים"], ["4", "שכבה: 4 נוירונים"], ["8", "שכבה: 8 נוירונים"], ["6,6", "2 שכבות: 6+6"], ["8,8,8", "3 שכבות: 8+8+8"]].map(([v, t]) => el("option", { value: v }, t)));
    arch.value = "4";
    const lr = el("input", { type: "range", min: "0.005", max: "0.3", step: "0.005", value: "0.05", id: "nn-lr", "aria-label": "קצב למידה" });
    const info = el("div", { class: "note ltr", style: "font-variant-numeric:tabular-nums" });
    let data = [], net, epoch = 0, running = false, lossHist = [];
    const gen = () => {
      const t = ds.value; data = [];
      for (let i = 0; i < 240; i++) {
        let x, y, l;
        if (t === "circle") { const r = i % 2 ? rand(0, 0.45) : rand(0.65, 0.95), a = rand(0, 7); x = r * Math.cos(a); y = r * Math.sin(a); l = i % 2; }
        else if (t === "xor") { x = rand(-1, 1); y = rand(-1, 1); if (Math.abs(x) < .06 || Math.abs(y) < .06) { i--; continue; } l = x * y > 0 ? 1 : 0; }
        else if (t === "blobs") { l = i % 2; x = (l ? .45 : -.45) + gauss() * .22; y = (l ? .35 : -.35) + gauss() * .22; }
        else { l = i % 2; const k = (i >> 1) / 120, r = k * 0.9, a = k * 3.2 * Math.PI + (l ? Math.PI : 0); x = r * Math.cos(a) + gauss() * .03; y = r * Math.sin(a) + gauss() * .03; }
        data.push([x, y, l]);
      }
    };
    const build = () => {
      const hidden = arch.value === "0" ? [] : arch.value.split(",").map(Number);
      const sizes = [2, ...hidden, 1];
      net = sizes.slice(1).map((n, i) => ({ W: Array.from({ length: n }, () => Array.from({ length: sizes[i] }, () => gauss() * Math.sqrt(1 / sizes[i]))), b: Array(n).fill(0) }));
      epoch = 0; lossHist = [];
    };
    const sig = z => 1 / (1 + Math.exp(-z));
    const forward = x => {
      const acts = [x];
      net.forEach((L, li) => {
        const a = acts[acts.length - 1];
        acts.push(L.W.map((row, j) => { const z = row.reduce((s, w, k) => s + w * a[k], L.b[j]); return li === net.length - 1 ? sig(z) : Math.tanh(z); }));
      });
      return acts;
    };
    const trainEpoch = () => {
      const eta = +lr.value;
      let tot = 0;
      for (let n = 0; n < data.length; n++) {
        const [x, y, l] = data[(Math.random() * data.length) | 0];
        const acts = forward([x, y]);
        const out = acts[acts.length - 1][0];
        tot += -(l * Math.log(out + 1e-9) + (1 - l) * Math.log(1 - out + 1e-9));
        let delta = [out - l];
        for (let li = net.length - 1; li >= 0; li--) {
          const L = net[li], a = acts[li];
          const prev = li > 0 ? a.map((ak, k) => L.W.reduce((s, row, j) => s + row[k] * delta[j], 0) * (1 - ak * ak)) : null;
          L.W.forEach((row, j) => { row.forEach((_, k) => { row[k] -= eta * delta[j] * a[k]; }); L.b[j] -= eta * delta[j]; });
          delta = prev;
        }
      }
      epoch++;
      lossHist.push(tot / data.length); if (lossHist.length > 150) lossHist.shift();
    };
    const acc = () => data.filter(([x, y, l]) => (forward([x, y]).pop()[0] > .5 ? 1 : 0) === l).length / data.length;
    const G = 52;
    const draw = () => {
      const cell = S / G;
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const x = (i + .5) / G * 2 - 1, y = 1 - (j + .5) / G * 2;
        const o = forward([x, y]).pop()[0];
        const t = (o - .5) * 2;
        ctx.fillStyle = t > 0 ? `rgba(255,150,70,${t * .75})` : `rgba(90,150,255,${-t * .75})`;
        ctx.fillRect(i * cell, j * cell, cell + 1, cell + 1);
        ctx.fillStyle = "rgba(5,8,12,.55)"; ctx.fillRect(i * cell, j * cell, cell + 1, cell + 1);
      }
      data.forEach(([x, y, l]) => { ctx.fillStyle = l ? "#ff9a4a" : "#6aa2ff"; ctx.strokeStyle = "#000"; ctx.beginPath(); ctx.arc((x + 1) / 2 * S, (1 - y) / 2 * S, 3.4, 0, 7); ctx.fill(); ctx.stroke(); });
      // network diagram
      nctx.fillStyle = "#05080c"; nctx.fillRect(0, 0, 320, 200);
      const sizes = [2, ...net.map(L => L.b.length)];
      const pos = sizes.map((n, c) => Array.from({ length: n }, (_, r) => [30 + c * (260 / (sizes.length - 1)), 100 + (r - (n - 1) / 2) * Math.min(22, 170 / n)]));
      net.forEach((L, li) => L.W.forEach((row, j) => row.forEach((w, k) => {
        nctx.strokeStyle = w > 0 ? `rgba(255,154,74,${Math.min(1, Math.abs(w) / 2)})` : `rgba(106,162,255,${Math.min(1, Math.abs(w) / 2)})`;
        nctx.lineWidth = Math.min(4, .5 + Math.abs(w)); nctx.beginPath(); nctx.moveTo(...pos[li][k]); nctx.lineTo(...pos[li + 1][j]); nctx.stroke();
      })));
      pos.forEach((col, c) => col.forEach(([x, y]) => { nctx.fillStyle = c === 0 ? "#5fd08f" : c === pos.length - 1 ? "#ffb454" : "#d9e6f2"; nctx.beginPath(); nctx.arc(x, y, 6, 0, 7); nctx.fill(); }));
      nctx.fillStyle = "#7d8fa6"; nctx.font = "11px monospace"; nctx.fillText("x,y", 18, 190); nctx.fillText("out", 280, 190);
      if (lossHist.length > 1) { const mx = Math.max(...lossHist, .01); nctx.strokeStyle = "#5fd08f"; nctx.lineWidth = 1; nctx.beginPath(); lossHist.forEach((v, i) => { const x = 110 + i / 150 * 100, y = 30 - v / mx * 24; i ? nctx.lineTo(x, y) : nctx.moveTo(x, y); }); nctx.stroke(); nctx.fillText("loss", 110, 40); }
      const params = net.reduce((s, L) => s + L.W.length * L.W[0].length + L.b.length, 0);
      info.textContent = `epoch ${epoch} · loss ${(lossHist[lossHist.length - 1] || 0).toFixed(3)} · accuracy ${(acc() * 100).toFixed(0)}% · parameters ${params}`;
    };
    let frame = 0;
    const loop = () => { requestAnimationFrame(loop); if (!visible(d)) return; if (running) { trainEpoch(); if (++frame % 2) return; } else if (frame++ % 10) return; draw(); };
    const runBtn = el("button", { class: "primary", onclick: () => { running = !running; runBtn.textContent = running ? "⏸ עצור" : "▶ אמן"; } }, "▶ אמן");
    ds.onchange = () => { gen(); build(); };
    arch.onchange = build;
    d.append(el("div", { class: "row" }, el("span", {}, "נתונים:"), ds, el("span", {}, "רשת:"), arch),
      el("div", { class: "grid2" }, cv, el("div", {}, nc, el("div", { class: "note" }, "כתום = משקל חיובי, כחול = שלילי, עובי = גודל המשקל. ככה ״רואים״ את מה שהרשת למדה."))),
      el("div", { class: "row", style: "margin-top:10px" }, runBtn, el("button", { onclick: build }, "אתחל משקלים"), el("label", { style: "flex:1;min-width:160px" }, "קצב למידה", lr)), info);
    gen(); build(); requestAnimationFrame(loop);
  };

  // K-means clustering
  D.kmeans = d => {
    const { el, head } = MG;
    head(d, "מעבדה · למידה בלי תשובות", "K-Means: המחשב מוצא קבוצות לבד", "כאן אין תוויות ״נכון/לא נכון״. האלגוריתם מקבל נקודות ומספר קבוצות K, ומחפש לבד את הקבוצות. בכל צעד: (1) כל נקודה מצטרפת למרכז הכי קרוב, (2) כל מרכז זז לאמצע הקבוצה שלו. ככה, למשל, חנויות מחלקות לקוחות לסוגים.");
    const W = 420, H = 280;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "קבוצות" });
    const ctx = cv.getContext("2d");
    const kS = el("input", { type: "range", min: "2", max: "6", value: "3", id: "km-k", "aria-label": "K" });
    const kL = el("b", {}, "3");
    const info = el("div", { class: "note" });
    const COLORS = ["#ff9a4a", "#6aa2ff", "#5fd08f", "#e27bff", "#ffd84a", "#ff6b6b"];
    let pts = [], cents = [], it = 0, phase = 0;
    const gen = () => {
      const n = 2 + Math.floor(Math.random() * 3);
      const cs = Array.from({ length: n }, () => [rand(70, W - 70), rand(60, H - 60)]);
      pts = Array.from({ length: 180 }, (_, i) => { const c = cs[i % n]; return { x: c[0] + gauss() * 32, y: c[1] + gauss() * 32, g: -1 }; });
      reset();
    };
    const reset = () => { cents = Array.from({ length: +kS.value }, () => ({ x: rand(20, W - 20), y: rand(20, H - 20), tr: [] })); pts.forEach(p => p.g = -1); it = 0; phase = 0; draw(); info.textContent = "מרכזים אקראיים. לחץ ״צעד״."; };
    const stepK = () => {
      if (phase === 0) {
        pts.forEach(p => { let best = 0, bd = 1e9; cents.forEach((c, i) => { const dd = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (dd < bd) { bd = dd; best = i; } }); p.g = best; });
        info.textContent = `צעד ${it + 1}א: כל נקודה נצבעה לפי המרכז הקרוב אליה.`;
      } else {
        let moved = 0;
        cents.forEach((c, i) => { const mine = pts.filter(p => p.g === i); if (!mine.length) return; const nx = mine.reduce((s, p) => s + p.x, 0) / mine.length, ny = mine.reduce((s, p) => s + p.y, 0) / mine.length; moved += Math.hypot(nx - c.x, ny - c.y); c.tr.push([c.x, c.y]); c.x = nx; c.y = ny; });
        it++;
        info.textContent = moved < 0.5 ? `התכנס אחרי ${it} סיבובים! המרכזים כבר לא זזים.` : `צעד ${it}ב: כל מרכז זז לממוצע של הנקודות שלו (זז ${moved.toFixed(0)} פיקסלים).`;
      }
      phase ^= 1; draw();
    };
    const draw = () => {
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      pts.forEach(p => { ctx.fillStyle = p.g < 0 ? "#7d8fa6" : COLORS[p.g]; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill(); });
      cents.forEach((c, i) => {
        ctx.strokeStyle = COLORS[i]; ctx.setLineDash([3, 3]); ctx.beginPath(); c.tr.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (c.tr.length) ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = COLORS[i]; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(c.x - 8, c.y - 8, 16, 16); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
      });
    };
    let auto = null;
    kS.oninput = () => { kL.textContent = kS.value; reset(); };
    d.append(cv, el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "primary", onclick: stepK }, "צעד ⏭"),
      el("button", { onclick: () => { clearInterval(auto); let n = 0; auto = setInterval(() => { stepK(); if (++n > 24) clearInterval(auto); }, 350); } }, "▶ הרץ"),
      el("button", { onclick: reset }, "מרכזים חדשים"), el("button", { onclick: gen }, "נתונים חדשים")),
      el("label", {}, el("span", {}, "K (מספר קבוצות) = ", kL), kS), info);
    gen();
  };

  // Image convolution (what a CNN layer does)
  D.conv = d => {
    const { el, head } = MG;
    head(d, "מעבדה · איך AI ״רואה״ תמונות", "פילטרים (קונבולוציה): העין של רשת נוירונים", "צייר בתמונה השמאלית (גרור עם העכבר או האצבע). כל פיקסל בתמונה הימנית מחושב מ-9 הפיקסלים סביבו, כפול המספרים בטבלה (הגרעין, kernel). רשתות לזיהוי תמונות (CNN) לומדות לבד אלפי גרעינים כאלה: שכבה ראשונה מוצאת קצוות, הבאות מוצאות צורות ופרצופים.");
    const N = 48, SC = 5;
    const src = el("canvas", { width: String(N * SC), height: String(N * SC), "aria-label": "תמונה מקורית", style: "max-width:240px;cursor:crosshair" });
    const dst = el("canvas", { width: String(N * SC), height: String(N * SC), "aria-label": "תמונה אחרי פילטר", style: "max-width:240px" });
    const sctx = src.getContext("2d"), dctx = dst.getContext("2d");
    const KS = {
      "בלי פילטר": [0, 0, 0, 0, 1, 0, 0, 0, 0],
      "טשטוש": [1, 1, 1, 1, 1, 1, 1, 1, 1].map(v => v / 9),
      "חידוד": [0, -1, 0, -1, 5, -1, 0, -1, 0],
      "מציאת קצוות": [-1, -1, -1, -1, 8, -1, -1, -1, -1],
      "קווים אנכיים": [-1, 0, 1, -2, 0, 2, -1, 0, 1],
      "קווים אופקיים": [-1, -2, -1, 0, 0, 0, 1, 2, 1],
      "תבליט": [-2, -1, 0, -1, 1, 1, 0, 1, 2],
    };
    const sel = el("select", { id: "cv-k", "aria-label": "פילטר" }, ...Object.keys(KS).map(k => el("option", { value: k }, k)));
    sel.value = "מציאת קצוות";
    const ktab = el("div", { class: "regs", style: "grid-template-columns:repeat(3,60px);direction:ltr" });
    let img = new Float32Array(N * N);
    const init = () => {
      img.fill(0);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x - 24, dy = y - 24, r = Math.hypot(dx, dy);
        if (r < 18 && r > 15) img[y * N + x] = 1;
        if (Math.hypot(x - 17, y - 19) < 3 || Math.hypot(x - 31, y - 19) < 3) img[y * N + x] = 1;
        if (r > 8 && r < 11 && dy > 3) img[y * N + x] = 1;
        if (x > 3 && x < 10 && y > 36 && y < 44) img[y * N + x] = .6;
      }
    };
    const render = () => {
      const k = KS[sel.value];
      ktab.innerHTML = "";
      k.forEach(v => ktab.append(el("div", { class: "reg" }, el("b", { style: "font-size:16px" }, Number.isInteger(v) ? String(v) : v.toFixed(2)))));
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = img[y * N + x];
        sctx.fillStyle = `rgb(${v * 255},${v * 230},${v * 180})`; sctx.fillRect(x * SC, y * SC, SC, SC);
        let s = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = Math.min(N - 1, Math.max(0, x + i)), yy = Math.min(N - 1, Math.max(0, y + j)); s += img[yy * N + xx] * k[(j + 1) * 3 + i + 1]; }
        const o = Math.max(0, Math.min(1, sel.value === "תבליט" ? s * .5 + .5 : Math.abs(s)));
        dctx.fillStyle = `rgb(${o * 255},${o * 230},${o * 180})`; dctx.fillRect(x * SC, y * SC, SC, SC);
      }
    };
    let drawing = false, erase = false;
    const paint = e => {
      const r = src.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < N && yy < N) img[yy * N + xx] = erase ? 0 : 1; }
      render();
    };
    src.addEventListener("pointerdown", e => { drawing = true; src.setPointerCapture(e.pointerId); paint(e); });
    src.addEventListener("pointermove", e => { if (drawing) paint(e); });
    src.addEventListener("pointerup", () => { drawing = false; });
    src.style.touchAction = "none";
    const eraseBtn = el("button", { onclick: () => { erase = !erase; eraseBtn.classList.toggle("on", erase); } }, "מחק");
    sel.onchange = render;
    d.append(el("div", { class: "row" }, el("span", {}, "פילטר:"), sel, eraseBtn, el("button", { onclick: () => { img.fill(0); render(); } }, "נקה הכול"), el("button", { onclick: () => { init(); render(); } }, "ציור לדוגמה")),
      el("div", { class: "grid2" }, el("div", {}, el("div", { class: "note" }, "המקור (צייר כאן):"), src), el("div", {}, el("div", { class: "note" }, "אחרי הפילטר:"), dst)),
      el("div", { class: "note", style: "margin-top:8px" }, "הגרעין (3×3):"), ktab);
    init(); render();
  };

  // Tokenizer
  D.tokenizer = d => {
    const { el, head } = MG;
    head(d, "מעבדה · טוקנים", "איך מודל שפה ״קורא״ טקסט", "מודל שפה לא רואה אותיות. הוא חותך את הטקסט לטוקנים, וכל טוקן הופך למספר (מזהה). מילים נפוצות הן טוקן אחד, מילים נדירות מתפרקות לכמה חלקים. זו הדמיה פשוטה: טוקנייזרים אמיתיים לומדים את החלוקה מהנתונים (בשיטה בשם BPE).");
    const ta = el("textarea", { rows: "3", id: "tk-in", "aria-label": "טקסט", style: "direction:rtl;text-align:right;font-family:var(--font-body)" });
    ta.value = "הבינה המלאכותית לומדת לתכנת משחקים בתלת-ממד. ChatGPT and Claude read tokens!";
    const out = el("div", { class: "chips", style: "direction:rtl" });
    const ids = el("div", { class: "note ltr", style: "word-break:break-all" });
    const stats = el("div", { class: "note" });
    const common = new Set("the and is a to of in for you it that on with are this read learn game code ai אני הוא היא של את על עם זה לא כן גם כל מה יש אין".split(" "));
    const prefixes = ["וה", "שה", "וב", "ול", "ה", "ו", "ב", "ל", "מ", "ש", "כ"];
    const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.codePointAt(0)) % 50257; return h; };
    const tokenize = text => {
      const parts = text.match(/\s+|[A-Za-z]+|[֐-׿]+|\d+|[^\s]/g) || [];
      const toks = [];
      let space = "";
      parts.forEach(p => {
        if (/^\s+$/.test(p)) { space = " "; return; }
        let w = p;
        const chunks = [];
        if (/[֐-׿]/.test(w) && !common.has(w) && w.length > 3) {
          const pre = prefixes.find(x => w.startsWith(x) && w.length - x.length >= 3);
          if (pre) { chunks.push(pre); w = w.slice(pre.length); }
        }
        if (common.has(w.toLowerCase()) || w.length <= 5) chunks.push(w);
        else { for (let i = 0; i < w.length; i += 4) chunks.push(w.slice(i, i + 4)); }
        chunks.forEach((c, i) => toks.push((i === 0 ? space : "") + c));
        space = "";
      });
      return toks;
    };
    const draw = () => {
      const t = tokenize(ta.value);
      out.innerHTML = "";
      t.forEach((tok, i) => out.append(el("span", { class: "chip", style: `background:hsl(${(i * 67) % 360},55%,28%);border-color:transparent;white-space:pre` }, tok.replace(" ", "·"))));
      ids.textContent = "[" + t.map(hash).join(", ") + "]";
      stats.textContent = `${ta.value.length} תווים → ${t.length} טוקנים. (הנקודה · מסמנת רווח שנדבק לטוקן.) מודלים מתומחרים ומוגבלים לפי מספר טוקנים.`;
    };
    ta.addEventListener("input", draw);
    d.append(ta, el("div", { class: "note", style: "margin-top:8px" }, "הטוקנים:"), out, el("div", { class: "note", style: "margin-top:8px" }, "מה המודל באמת מקבל (מזהים):"), ids, stats);
    draw();
  };

  // Attention visualizer
  D.attention = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מנגנון הקשב", "על מי המילה ״הוא״ מסתכלת?", "לחץ על מילה כדי לראות לאילו מילים אחרות המודל ״שם לב״ כשהוא מבין אותה. החלף בין שני המשפטים: מילה אחת בסוף משנה למי ״הוא״ מתייחס. (המשקלים כאן הודגמו ביד כדי להמחיש, מודל אמיתי לומד אותם.)");
    const S = [
      { w: ["הכלב", "לא", "חצה", "את", "הכביש", "כי", "הוא", "היה", "עייף"], focus: 6, to: 0, why: "״עייף״ מתאים לכלב, לא לכביש. לכן ״הוא״ = הכלב." },
      { w: ["הכלב", "לא", "חצה", "את", "הכביש", "כי", "הוא", "היה", "רחב"], focus: 6, to: 4, why: "״רחב״ מתאים לכביש. לכן כאן ״הוא״ = הכביש." },
      { w: ["השחקן", "נכנס", "למכונית", "והתניע", "אותה"], focus: 4, to: 2, why: "״אותה״ בלשון נקבה, ורק ״המכונית״ מתאימה." },
    ];
    let si = 0, sel = 6;
    const row = el("div", { class: "chips", style: "direction:rtl;font-size:18px;gap:8px" });
    const bars = el("div", { class: "bars" });
    const why = el("div", { class: "note" });
    const weights = (s, i) => {
      const n = s.w.length, w = Array(n).fill(0.04);
      w[i] += 0.2; if (i > 0) w[i - 1] += 0.12; if (i < n - 1) w[i + 1] += 0.08;
      if (i === s.focus) { w[s.to] += 0.9; w[n - 1] += 0.25; }
      const t = w.reduce((a, b) => a + b, 0); return w.map(v => v / t);
    };
    const draw = () => {
      const s = S[si], w = weights(s, sel);
      row.innerHTML = ""; bars.innerHTML = "";
      s.w.forEach((word, i) => {
        const b = el("button", { style: `font-size:17px;background:rgba(255,180,84,${i === sel ? 1 : w[i] * 1.6});color:${i === sel || w[i] > .3 ? "#1d1204" : "inherit"}` }, word);
        b.onclick = () => { sel = i; draw(); };
        row.append(b);
        bars.append(el("div", { class: "bar-row" }, el("span", {}, word), el("div", { class: "track" }, el("i", { style: `width:${w[i] * 100}%` })), el("span", {}, Math.round(w[i] * 100) + "%")));
      });
      why.textContent = sel === s.focus ? s.why : "נסה ללחוץ על ״" + s.w[s.focus] + "״.";
    };
    d.append(el("div", { class: "row" }, ...S.map((_, i) => el("button", { onclick: () => { si = i; sel = S[i].focus; draw(); } }, "משפט " + (i + 1)))), row,
      el("div", { class: "note", style: "margin-top:10px" }, "כמה קשב המילה שבחרת נותנת לכל מילה:"), bars, why);
    draw();
  };
})();

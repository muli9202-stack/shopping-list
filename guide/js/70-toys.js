// Demos: computer-science, math and algorithm toys
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});
  const rand = (a, b) => a + Math.random() * (b - a);

  // Number base converter
  D.baseconv = d => {
    const { el, head } = MG;
    head(d, "מעבדה · בסיסי ספירה", "עשרוני, בינארי, הקסדצימלי", "אותו מספר בשלוש שפות. שנה כל אחד וראה את השאר משתנים. הקסדצימלי (בסיס 16) משתמש ב-0-9 ואז A-F, ומתכנתים אוהבים אותו כי כל ספרה = בדיוק 4 ביטים.");
    const mk = (label, base, len) => { const i = el("input", { type: "text", id: "bc-" + base, "aria-label": label, style: "flex:1;min-width:0;font-family:var(--font-mono);direction:ltr;text-align:left" }); return { i, row: el("label", {}, label, i), base }; };
    const dec = mk("עשרוני (בסיס 10)", 10), bin = mk("בינארי (בסיס 2)", 2), hex = mk("הקסדצימלי (בסיס 16)", 16);
    const bits = el("div", { class: "bits" });
    const set = (n) => {
      n = Math.max(0, Math.min(255, n | 0));
      dec.i.value = n; bin.i.value = n.toString(2).padStart(8, "0"); hex.i.value = "0x" + n.toString(16).toUpperCase().padStart(2, "0");
      bits.innerHTML = "";
      for (let k = 7; k >= 0; k--) bits.append(el("div", { class: "bit" }, el("button", { class: (n >> k) & 1 ? "on" : "", onclick: () => set(n ^ (1 << k)) }, String((n >> k) & 1)), el("small", {}, String(1 << k))));
    };
    dec.i.oninput = () => set(parseInt(dec.i.value, 10) || 0);
    bin.i.oninput = () => set(parseInt(bin.i.value.replace(/[^01]/g, "") || "0", 2));
    hex.i.oninput = () => set(parseInt(hex.i.value.replace(/[^0-9a-fA-F]/g, "") || "0", 16));
    d.append(bits, dec.row, bin.row, hex.row, el("div", { class: "note" }, "טווח 0-255 (בייט אחד). לחץ על הביטים למעלה, או הקלד בכל שדה."));
    set(203);
  };

  // ASCII / Unicode explorer
  D.ascii = d => {
    const { el, head } = MG;
    head(d, "מעבדה · תווים ומספרים", "כל אות היא מספר", "הקלד טקסט וראה לאיזה מספר כל תו הופך (Unicode). ככה מחשב שומר טקסט: רק מספרים.");
    const inp = el("input", { type: "text", value: "Hi! שלום 👋", id: "asc-in", style: "flex:1;min-width:0", "aria-label": "טקסט" });
    const out = el("div", { class: "chips", style: "direction:ltr" });
    const draw = () => { out.innerHTML = ""; [...inp.value].forEach(ch => out.append(el("div", { class: "reg", style: "min-width:64px" }, el("b", { style: "font-size:20px" }, ch === " " ? "␣" : ch), el("span", {}, ch.codePointAt(0))))); };
    inp.oninput = draw;
    d.append(el("div", { class: "row" }, inp), out, el("div", { class: "note", style: "margin-top:6px" }, "A=65, a=97, 0=48, א=1488. אימוג׳י תופס מספר גדול (מעל 100,000). המספרים האלה קבועים בעולם כולו, ולכן טקסט עובר בין מכשירים."));
    draw();
  };

  // Two's complement
  D.twoscomp = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מספרים שליליים", "איך המחשב שומר מינוס", "אין למחשב סימן ״−״. הטריק (״משלים ל-2״): הביט השמאלי ביותר שווה מינוס. ככה חיסור הופך לחיבור, והמעגל אותו מעגל.");
    let n = 5;
    const bitsEl = el("div", { class: "bits" });
    const out = el("div", { class: "note ltr", style: "font-variant-numeric:tabular-nums" });
    const val = b => { let v = 0; for (let k = 0; k < 8; k++) v += ((b >> k) & 1) * (k === 7 ? -128 : (1 << k)); return v; };
    const draw = () => {
      bitsEl.innerHTML = "";
      for (let k = 7; k >= 0; k--) bitsEl.append(el("div", { class: "bit" }, el("button", { class: (n >> k) & 1 ? "on" : "", onclick: () => { n ^= (1 << k); draw(); } }, String((n >> k) & 1)), el("small", {}, k === 7 ? "−128" : String(1 << k))));
      out.textContent = `הביטים: ${n.toString(2).padStart(8, "0")}  =  ${val(n)}`;
    };
    const inp = el("input", { type: "number", min: "-128", max: "127", value: "5", id: "tc-in", "aria-label": "מספר" });
    inp.oninput = () => { let v = Math.max(-128, Math.min(127, parseInt(inp.value, 10) || 0)); n = v & 255; draw(); };
    d.append(bitsEl, out, el("div", { class: "row", style: "margin-top:8px" }, el("span", {}, "או הקלד מספר (−128 עד 127):"), inp), el("div", { class: "note" }, "שים לב: הדלק רק את הביט השמאלי → מקבלים −128. זה ה״משלים ל-2״."));
    draw();
  };

  // Regex tester
  D.regex = d => {
    const { el, head } = MG;
    head(d, "מעבדה · ביטויים רגולריים", "חיפוש דפוסים בטקסט", "Regex הוא ״שפה״ קטנה לתיאור דפוסים: כתובות מייל, מספרי טלפון, מילים. הקלד דפוס וראה מה הוא מוצא. נסה: \\d+ (מספרים), [A-Za-z]+ (מילים), \\w+@\\w+ (מייל).");
    const pat = el("input", { type: "text", value: "\\d+", id: "rx-p", style: "flex:1;min-width:0;font-family:var(--font-mono);direction:ltr;text-align:left", "aria-label": "דפוס" });
    const txt = el("textarea", { rows: "4", id: "rx-t", style: "direction:ltr;text-align:left;font-family:var(--font-mono)", "aria-label": "טקסט" });
    txt.value = "צרו קשר: noa@mail.com או בטלפון 054-1234567. גיל 14, מיקוד 3200003.";
    const out = el("div", { class: "out", style: "direction:ltr;text-align:left" });
    const info = el("div", { class: "note" });
    const draw = () => {
      out.innerHTML = "";
      let re; try { re = new RegExp(pat.value, "g"); info.textContent = ""; } catch (e) { info.textContent = "דפוס לא תקין: " + e.message; return; }
      let last = 0, s = txt.value, n = 0, m;
      while ((m = re.exec(s)) && n < 200) {
        if (m.index >= last) out.append(document.createTextNode(s.slice(last, m.index)));
        out.append(el("span", { style: "background:var(--screen-accent);color:#1d1204;border-radius:3px;padding:0 2px" }, m[0] || "∅"));
        last = m.index + m[0].length; n++;
        if (m[0] === "") re.lastIndex++;
      }
      out.append(document.createTextNode(s.slice(last)));
      info.textContent = n + " התאמות";
    };
    [pat, txt].forEach(i => i.addEventListener("input", draw));
    d.append(el("div", { class: "row" }, el("span", { style: "font-family:var(--font-mono)" }, "/"), pat, el("span", { style: "font-family:var(--font-mono)" }, "/g")), txt, el("div", { class: "note", style: "margin-top:6px" }, "מה נמצא:"), out, info);
    draw();
  };

  // Calculator with shunting-yard parser
  D.calc = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מחשבון שמבין סדר פעולות", "איך שפת תכנות מפענחת ביטוי", "הקלד ביטוי כמו 2 + 3 * 4. המחשב לא קורא משמאל לימין! הוא בונה מבנה שמכבד סדר פעולות (כפל לפני חיבור). זה בדיוק מה שקורה כשאתה כותב חישוב בקוד.");
    const inp = el("input", { type: "text", value: "2 + 3 * 4 - (5 - 1) / 2", id: "cl-in", style: "flex:1;min-width:0;font-family:var(--font-mono);direction:ltr;text-align:left", "aria-label": "ביטוי" });
    const rpn = el("div", { class: "note ltr" });
    const res = el("div", { class: "big" });
    const prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
    const draw = () => {
      const toks = inp.value.match(/\d+\.?\d*|[+\-*/()]/g) || [];
      const out = [], ops = [];
      try {
        for (const t of toks) {
          if (/\d/.test(t)) out.push(t);
          else if (t === "(") ops.push(t);
          else if (t === ")") { while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()); ops.pop(); }
          else { while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop()); ops.push(t); }
        }
        while (ops.length) out.push(ops.pop());
        rpn.textContent = "בסדר חישוב (RPN): " + out.join(" ");
        const st = [];
        for (const t of out) { if (/\d/.test(t)) st.push(+t); else { const b = st.pop(), a = st.pop(); st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : a / b); } }
        res.textContent = "= " + (Math.round(st[0] * 1000) / 1000);
      } catch (e) { res.textContent = "= ?"; rpn.textContent = "ביטוי לא תקין"; }
    };
    inp.oninput = draw;
    d.append(el("div", { class: "row" }, inp), rpn, res, el("div", { class: "note" }, "האלגוריתם (״חצר המיון״ של דייקסטרה) הופך את הביטוי לסדר שבו אין צורך בסוגריים. כל מחשבון וכל קומפיילר עושים משהו כזה."));
    draw();
  };

  // Monte Carlo pi
  D.montecarlo = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · אקראיות מחשבת", "לחשב את פאי בעזרת גשם אקראי", "זורקים נקודות אקראיות על ריבוע. היחס של אלה שנפלו בתוך הרבע-עיגול, כפול 4, מתקרב לפאי (3.14159...). ככה מדע נתונים פותר בעיות שקשה לחשב ישירות.");
    const S = 260;
    const cv = el("canvas", { width: String(S), height: String(S), "aria-label": "מונטה קרלו", style: "max-width:300px" });
    const ctx = cv.getContext("2d");
    const out = el("div", { class: "big ltr" });
    let inside = 0, total = 0, running = false;
    ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "#2b3a50"; ctx.beginPath(); ctx.arc(0, S, S, 0, Math.PI * 2); ctx.stroke();
    const step = () => {
      for (let i = 0; i < 200; i++) {
        const x = Math.random(), y = Math.random();
        const hit = x * x + y * y <= 1; if (hit) inside++; total++;
        ctx.fillStyle = hit ? "#5fd08f" : "#ff6b6b"; ctx.fillRect(x * S, S - y * S, 2, 2);
      }
      out.textContent = `π ≈ ${(4 * inside / total).toFixed(4)}   (${total.toLocaleString("en")} נקודות)`;
    };
    const loop = () => { if (!running) return; requestAnimationFrame(loop); if (visible(d) && total < 200000) step(); };
    d.append(cv, out, el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: () => { if (!running) { running = true; loop(); } else running = false; } }, "▶ הפעל / עצור"), el("button", { onclick: () => { inside = total = 0; ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, S, S); ctx.strokeStyle = "#2b3a50"; ctx.beginPath(); ctx.arc(0, S, S, 0, 7); ctx.stroke(); out.textContent = ""; } }, "נקה")));
    step();
  };

  // Dice probability
  D.dice = d => {
    const { el, head } = MG;
    head(d, "מעבדה · הסתברות", "חוק המספרים הגדולים", "מטילים שתי קוביות ומחברים. חלק מהסכומים נפוצים יותר (7 הכי נפוץ, כי יש הכי הרבה דרכים לקבל אותו). ככל שמטילים יותר, הגרף מתקרב לצורה התיאורטית. ככה עובד ״שלל אקראי״ במשחקים.");
    const counts = Array(13).fill(0);
    const bars = el("div", { class: "bars" });
    const info = el("div", { class: "note" });
    let total = 0;
    const roll = n => { for (let i = 0; i < n; i++) { counts[(1 + Math.floor(Math.random() * 6)) + (1 + Math.floor(Math.random() * 6))]++; total++; } draw(); };
    const draw = () => {
      const mx = Math.max(1, ...counts);
      bars.innerHTML = "";
      for (let s = 2; s <= 12; s++) bars.append(el("div", { class: "bar-row" }, el("span", {}, String(s)), el("div", { class: "track" }, el("i", { style: `width:${counts[s] / mx * 100}%`, class: s === 7 ? "" : "" })), el("span", {}, counts[s])));
      info.textContent = total + " הטלות. 7 הוא הנפוץ ביותר: 6 דרכים לקבל אותו (1+6, 2+5, ...), מול דרך אחת ל-2 או ל-12.";
    };
    d.append(bars, info, el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: () => roll(1) }, "הטל פעם אחת"), el("button", { onclick: () => roll(100) }, "×100"), el("button", { onclick: () => roll(5000) }, "×5000"), el("button", { onclick: () => { counts.fill(0); total = 0; draw(); } }, "אפס")));
    draw();
  };

  // Mandelbrot
  D.mandelbrot = d => {
    const { el, head } = MG;
    head(d, "מעבדה · פרקטל מנדלברוט", "אינסוף מנוסחה של שורה אחת", "כל פיקסל בודק: אם מריצים עליו z = z² + c שוב ושוב, האם המספר בורח לאינסוף או נשאר קטן? מזה נוצרת צורה אינסופית של פרטים. לחץ כדי להתקרב.");
    const W = 300, H = 220;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "מנדלברוט", style: "cursor:zoom-in;max-width:100%" });
    const ctx = cv.getContext("2d");
    let cx = -0.6, cy = 0, scale = 3;
    const info = el("div", { class: "note ltr" });
    const draw = () => {
      const img = ctx.createImageData(W, H);
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const x0 = cx + (px / W - 0.5) * scale, y0 = cy + (py / H - 0.5) * scale * H / W;
        let x = 0, y = 0, i = 0;
        while (x * x + y * y <= 4 && i < 100) { const xt = x * x - y * y + x0; y = 2 * x * y + y0; x = xt; i++; }
        const k = (py * W + px) * 4;
        if (i === 100) { img.data[k] = img.data[k + 1] = img.data[k + 2] = 8; }
        else { const t = i / 100; img.data[k] = 9 + 255 * t; img.data[k + 1] = 50 + 150 * Math.sin(t * 3); img.data[k + 2] = 100 + 155 * (1 - t); }
        img.data[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      info.textContent = `מרכז (${cx.toFixed(4)}, ${cy.toFixed(4)})  זום ×${(3 / scale).toFixed(1)}`;
    };
    cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); cx += ((e.clientX - r.left) / r.width - 0.5) * scale; cy += ((e.clientY - r.top) / r.height - 0.5) * scale * H / W; scale *= 0.5; draw(); });
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, el("button", { onclick: () => { cx = -0.6; cy = 0; scale = 3; draw(); } }, "אפס זום")), info);
    draw();
  };

  // Elementary cellular automaton (rule 30 / 110)
  D.rule30 = d => {
    const { el, head } = MG;
    head(d, "מעבדה · אוטומט חד-ממדי", "שורה אחת של חוקים יוצרת עולם", "כל תא בשורה חדשה נקבע לפי 3 התאים שמעליו, לפי ״חוק״ מספרי. חוק 30 יוצר כאוס (שמשמש למחוללי אקראיות!), וחוק 110 מסובך מספיק כדי לחשב הכול. שנה את החוק.");
    const W = 320, H = 180;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "אוטומט", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    const rule = el("input", { type: "number", min: "0", max: "255", value: "30", id: "r30", "aria-label": "חוק" });
    const draw = () => {
      const R = Math.max(0, Math.min(255, +rule.value | 0));
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      let row = Array(W).fill(0); row[W >> 1] = 1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) if (row[x]) { ctx.fillStyle = "#5fd08f"; ctx.fillRect(x, y, 1, 1); }
        const next = Array(W).fill(0);
        for (let x = 0; x < W; x++) { const p = (row[(x - 1 + W) % W] << 2) | (row[x] << 1) | row[(x + 1) % W]; next[x] = (R >> p) & 1; }
        row = next;
      }
    };
    rule.oninput = draw;
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, el("span", {}, "חוק (0-255):"), rule, el("button", { onclick: () => { rule.value = "110"; draw(); } }, "חוק 110"), el("button", { onclick: () => { rule.value = "90"; draw(); } }, "חוק 90 (משולש)"), el("button", { onclick: () => { rule.value = "30"; draw(); } }, "חוק 30")));
    draw();
  };

  // Merge & insertion sort visual
  D.sortgallery = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · עוד אלגוריתמי מיון", "מיון הכנסה מול מיון מיזוג", "מיון הכנסה (Insertion) פשוט אבל איטי — כמו לסדר קלפים ביד. מיון מיזוג (Merge) מחלק לחצאים, ממיין כל חצי, וממזג — מהיר גם עם המון נתונים.");
    let arr = [], busy = false;
    const N = 40;
    const wrap = el("div", { class: "sort-bars" });
    const info = el("div", { class: "note", style: "font-variant-numeric:tabular-nums" });
    const shuffle = () => { arr = Array.from({ length: N }, (_, i) => i + 1).sort(() => Math.random() - .5); draw(); };
    const draw = (hl = [], done = []) => { wrap.innerHTML = ""; arr.forEach((v, i) => wrap.append(el("i", { class: hl.includes(i) ? "cmp" : done.includes(i) ? "ok" : "", style: `height:${v / N * 100}%` }))); };
    const insertion = async () => {
      if (busy) return; busy = true; let ops = 0;
      for (let i = 1; i < N; i++) { let j = i; while (j > 0 && arr[j - 1] > arr[j]) { [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]]; j--; ops++; draw([j, j - 1]); await sleep(15); } info.textContent = "מיון הכנסה · פעולות: " + ops; }
      draw([], arr.map((_, i) => i)); busy = false;
    };
    const merge = async () => {
      if (busy) return; busy = true; let ops = 0;
      const ms = async (lo, hi) => { if (hi - lo < 1) return; const mid = (lo + hi) >> 1; await ms(lo, mid); await ms(mid + 1, hi); const tmp = []; let i = lo, j = mid + 1; while (i <= mid && j <= hi) { ops++; tmp.push(arr[i] <= arr[j] ? arr[i++] : arr[j++]); } while (i <= mid) tmp.push(arr[i++]); while (j <= hi) tmp.push(arr[j++]); for (let k = 0; k < tmp.length; k++) { arr[lo + k] = tmp[k]; draw([lo + k]); await sleep(18); } info.textContent = "מיון מיזוג · פעולות: " + ops; };
      await ms(0, N - 1); draw([], arr.map((_, i) => i)); busy = false;
    };
    d.append(wrap, el("div", { class: "row", style: "margin-top:8px" }, el("button", { onclick: () => !busy && shuffle() }, "ערבב"), el("button", { class: "primary", onclick: insertion }, "מיון הכנסה"), el("button", { class: "primary", onclick: merge }, "מיון מיזוג")), info);
    shuffle();
  };

  // Linked list
  D.linkedlist = d => {
    const { el, head } = MG;
    head(d, "מעבדה · רשימה מקושרת", "כל תא מצביע על הבא", "בניגוד למערך שיושב ברצף בזיכרון, ברשימה מקושרת כל תא (״צומת״) שומר ערך + חץ לתא הבא. הוספה באמצע = רק לשנות חצים, בלי להזיז הכול. לחץ על החצים כדי להוסיף.");
    let list = [10, 25, 40];
    const view = el("div", { style: "display:flex;flex-wrap:wrap;gap:0;align-items:center;direction:ltr;padding:10px;background:#05080c;border-radius:8px;min-height:60px" });
    const draw = () => {
      view.innerHTML = "";
      list.forEach((v, i) => {
        view.append(el("div", { style: "background:var(--screen-ink);color:#06101f;border-radius:8px;padding:8px 12px;font-family:var(--font-mono);font-weight:700" }, String(v)));
        const arrow = el("button", { title: "הוסף כאן", style: "background:none;border:none;color:var(--screen-accent);font-size:18px;cursor:pointer;padding:0 4px", onclick: () => { list.splice(i + 1, 0, Math.floor(rand(1, 99))); draw(); } }, i < list.length - 1 ? "→+" : "→∅");
        view.append(arrow);
      });
      view.append(el("button", { style: "background:none;border:1px dashed #2b3a50;color:var(--screen-dim);border-radius:8px;padding:8px;cursor:pointer", onclick: () => { list.push(Math.floor(rand(1, 99))); draw(); } }, "+ הוסף לסוף"));
    };
    d.append(view, el("div", { class: "row", style: "margin-top:8px" }, el("button", { onclick: () => { if (list.length) list.shift(); draw(); } }, "מחק ראשון"), el("button", { onclick: () => { list = [10, 25, 40]; draw(); } }, "אפס")), el("div", { class: "note", style: "margin-top:6px" }, "∅ (null) מסמן את סוף הרשימה. יתרון: הוספה/מחיקה מהירה. חיסרון: אין קפיצה ישירה לפריט מספר 5 — צריך ללכת צעד-צעד."));
    draw();
  };

  // Binary search tree
  D.bst = d => {
    const { el, head } = MG;
    head(d, "מעבדה · עץ חיפוש בינארי", "מבנה שמחפש מהר", "כל צומת: קטנים ממנו משמאל, גדולים מימין. חיפוש = בכל צעד לפסול חצי מהעץ, בדיוק כמו חיפוש בינארי. הוסף מספרים ותראה את העץ נבנה.");
    const W = 340, H = 220;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "עץ", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    let root = null;
    const insert = (node, v, depth) => { if (!node) return { v, l: null, r: null }; if (v < node.v) node.l = insert(node.l, v, depth + 1); else if (v > node.v) node.r = insert(node.r, v, depth + 1); return node; };
    const inp = el("input", { type: "number", value: "50", id: "bst-in", "aria-label": "ערך", style: "width:90px" });
    const info = el("div", { class: "note" });
    const draw = () => {
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      const rec = (node, x, y, dx) => { if (!node) return; if (node.l) { ctx.strokeStyle = "#2b3a50"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx, y + 44); ctx.stroke(); rec(node.l, x - dx, y + 44, dx / 1.8); } if (node.r) { ctx.strokeStyle = "#2b3a50"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + 44); ctx.stroke(); rec(node.r, x + dx, y + 44, dx / 1.8); } ctx.fillStyle = "#7fb0ff"; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill(); ctx.fillStyle = "#06101f"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.fillText(node.v, x, y + 4); };
      rec(root, W / 2, 24, W / 4.5);
    };
    const add = v => { root = insert(root, v, 0); draw(); };
    [50, 30, 70, 20, 40, 60, 85].forEach(add);
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, el("span", {}, "הוסף:"), inp, el("button", { class: "primary", onclick: () => add(Math.max(1, Math.min(99, +inp.value | 0))) }, "הוסף"), el("button", { onclick: () => add(Math.floor(rand(1, 99))) }, "אקראי"), el("button", { onclick: () => { root = null; draw(); } }, "נקה")), info);
    draw();
  };

  // Dijkstra on a small weighted graph
  D.dijkstra = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · דרך קצרה עם מחירים", "אלגוריתם דייקסטרה (הלב של Waze)", "בגרף הזה לכל כביש יש ״מחיר״ (זמן נסיעה). דייקסטרה מוצא את הדרך הזולה ביותר מ-A ליעד, לא הכי מעטת צמתים אלא הכי מהירה. לחץ על צומת כדי לבחור יעד.");
    const W = 360, H = 240;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "גרף", style: "max-width:100%;cursor:pointer" });
    const ctx = cv.getContext("2d");
    const nodes = { A: [40, 120], B: [130, 40], C: [130, 200], D: [230, 110], E: [320, 50], F: [320, 190] };
    const edges = [["A", "B", 4], ["A", "C", 3], ["B", "D", 5], ["C", "D", 2], ["C", "F", 8], ["D", "E", 3], ["D", "F", 6], ["E", "F", 2]];
    let goal = "F", path = [], dist = {};
    const run = async () => {
      const D2 = {}, prev = {}, Q = new Set(Object.keys(nodes));
      Object.keys(nodes).forEach(n => D2[n] = Infinity); D2.A = 0;
      while (Q.size) {
        let u = null; Q.forEach(n => { if (u === null || D2[n] < D2[u]) u = n; });
        Q.delete(u);
        edges.forEach(([a, b, w]) => { let nb = a === u ? b : b === u ? a : null; if (nb && Q.has(nb) && D2[u] + w < D2[nb]) { D2[nb] = D2[u] + w; prev[nb] = u; } });
        dist = D2; draw(); await sleep(300);
      }
      path = []; let c = goal; while (c) { path.unshift(c); c = prev[c]; } draw();
    };
    const draw = () => {
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      edges.forEach(([a, b, w]) => { const inPath = path.includes(a) && path.includes(b) && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1; ctx.strokeStyle = inPath ? "#ffb454" : "#2b3a50"; ctx.lineWidth = inPath ? 4 : 2; ctx.beginPath(); ctx.moveTo(...nodes[a]); ctx.lineTo(...nodes[b]); ctx.stroke(); const mx = (nodes[a][0] + nodes[b][0]) / 2, my = (nodes[a][1] + nodes[b][1]) / 2; ctx.fillStyle = "#0e1726"; ctx.fillRect(mx - 9, my - 8, 18, 16); ctx.fillStyle = "#d9e6f2"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.fillText(w, mx, my + 4); });
      ctx.lineWidth = 1;
      Object.entries(nodes).forEach(([n, [x, y]]) => { ctx.fillStyle = n === "A" ? "#5fd08f" : n === goal ? "#ff6b6b" : path.includes(n) ? "#ffb454" : "#1b2a40"; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 12px monospace"; ctx.fillText(n, x, y - 2); if (dist[n] !== undefined && dist[n] !== Infinity) { ctx.font = "10px monospace"; ctx.fillText(dist[n], x, y + 10); } });
    };
    cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); const mx = (e.clientX - r.left) / r.width * W, my = (e.clientY - r.top) / r.height * H; for (const [n, [x, y]] of Object.entries(nodes)) if (Math.hypot(mx - x, my - y) < 18 && n !== "A") { goal = n; path = []; dist = {}; draw(); } });
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: run }, "▶ מצא דרך זולה ל-" + goal), el("span", { class: "note" }, "ירוק=התחלה · אדום=יעד · מספר=זמן נסיעה")));
    draw();
  };

  // Tic-tac-toe with unbeatable minimax
  D.tictactoe = d => {
    const { el, head } = MG;
    head(d, "מעבדה · AI שלא מפסיד", "איקס-עיגול עם Minimax", "המחשב בודק את כל העתידים האפשריים ובוחר את המהלך שמבטיח לו את התוצאה הכי טובה, בהנחה שגם אתה תשחק מצוין. אי אפשר לנצח אותו — לכל היותר תיקו. אתה X.");
    let bd = Array(9).fill(""), over = false;
    const wins = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const winner = b => { for (const [a, c, e] of wins) if (b[a] && b[a] === b[c] && b[a] === b[e]) return b[a]; return b.every(x => x) ? "tie" : null; };
    const minimax = (b, me) => {
      const w = winner(b); if (w === "O") return { s: 10 }; if (w === "X") return { s: -10 }; if (w === "tie") return { s: 0 };
      let best = { s: me ? -99 : 99 };
      for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = me ? "O" : "X"; const r = minimax(b, !me).s; b[i] = ""; if (me ? r > best.s : r < best.s) best = { s: r, i }; }
      return best;
    };
    const grid = el("div", { style: "display:grid;grid-template-columns:repeat(3,64px);gap:4px;justify-content:center" });
    const msg = el("div", { style: "font-weight:700;text-align:center;min-height:24px" });
    const draw = () => {
      grid.innerHTML = "";
      bd.forEach((v, i) => grid.append(el("button", { style: `width:64px;height:64px;font-size:30px;background:var(--screen-2);border:1px solid #2b3a50;border-radius:8px;color:${v === "X" ? "#ffb454" : "#7fb0ff"};cursor:pointer`, onclick: () => play(i) }, v)));
      const w = winner(bd);
      msg.textContent = w === "tie" ? "תיקו! (כמו תמיד מול Minimax)" : w === "X" ? "ניצחת?! (יש באג...)" : w === "O" ? "המחשב ניצח." : "תורך (X)";
    };
    const play = i => { if (bd[i] || over) return; bd[i] = "X"; if (winner(bd)) { over = true; return draw(); } const m = minimax(bd.slice(), true); if (m.i !== undefined) bd[m.i] = "O"; if (winner(bd)) over = true; draw(); };
    d.append(grid, msg, el("div", { class: "row", style: "justify-content:center;margin-top:8px" }, el("button", { onclick: () => { bd = Array(9).fill(""); over = false; draw(); } }, "משחק חדש")));
    draw();
  };

  // Genetic algorithm evolving a string
  D.genetic = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · אלגוריתם גנטי", "אבולוציה פותרת בעיה", "מתחילים מ-200 מחרוזות אקראיות. בכל דור: שומרים את הקרובות ביותר למטרה, ״מזווגים״ אותן, ומוסיפים ״מוטציות״ קטנות. תוך דורות ספורים, אקראיות הופכת לתשובה. ככה מתפתחים גם דמויות ורובוטים במשחקים.");
    const target = el("input", { type: "text", value: "GAME OVER", id: "ga-t", style: "flex:1;min-width:0", "aria-label": "מטרה", maxlength: "20" });
    const out = el("div", { class: "big ltr", style: "font-size:22px;word-break:break-all" });
    const info = el("div", { class: "note ltr" });
    let pop = [], gen = 0, running = false, TARGET = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ !?.";
    const rc = () => chars[Math.floor(Math.random() * chars.length)];
    const fit = s => { let f = 0; for (let i = 0; i < TARGET.length; i++) if (s[i] === TARGET[i]) f++; return f; };
    const init = () => { TARGET = target.value.toUpperCase().slice(0, 20); pop = Array.from({ length: 200 }, () => Array.from(TARGET, rc).join("")); gen = 0; };
    const step = () => {
      pop.sort((a, b) => fit(b) - fit(a));
      const best = pop[0];
      out.textContent = best; info.textContent = `דור ${gen} · התאמה ${fit(best)}/${TARGET.length}`;
      if (best === TARGET) { running = false; info.textContent += " · הושג!"; return; }
      const parents = pop.slice(0, 40);
      pop = [best]; while (pop.length < 200) { const a = parents[Math.floor(Math.random() * 40)], b = parents[Math.floor(Math.random() * 40)]; let child = ""; for (let i = 0; i < TARGET.length; i++) child += Math.random() < 0.03 ? rc() : (Math.random() < 0.5 ? a[i] : b[i]); pop.push(child); }
      gen++;
    };
    const loop = () => { if (!running) return; requestAnimationFrame(loop); if (visible(d)) step(); };
    d.append(el("div", { class: "row" }, el("span", {}, "מטרה:"), target, el("button", { class: "primary", onclick: () => { init(); running = true; loop(); } }, "▶ התפתח")), out, info);
  };

  // Q-learning gridworld
  D.qlearn = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · למידת חיזוק", "עכבר שלומד למצוא גבינה", "העכבר לא יודע כלום בהתחלה. הוא מנסה, מקבל פרס (גבינה +1) או עונש (מלכודת −1), וזוכר מה עבד. אחרי אימון, הוא הולך ישר למטרה. זו למידת חיזוק, השיטה שמאחורי AI ששולט במשחקים.");
    const C = 6, R = 5;
    const walls = new Set(["2,1", "2,2", "2,3", "4,2"]);
    const goal = [5, 0], trap = [5, 2], start = [0, 4];
    const Q = {};
    const key = (x, y) => x + "," + y;
    Object.keys({}).forEach(() => { });
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) Q[key(x, y)] = [0, 0, 0, 0];
    const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    const grid = el("div", { class: "robot-grid", style: `grid-template-columns:repeat(${C},1fr);max-width:360px` });
    const info = el("div", { class: "note" });
    let bot = [...start], episodes = 0;
    const valid = (x, y) => x >= 0 && y >= 0 && x < C && y < R && !walls.has(key(x, y));
    const train = async (n) => {
      for (let e = 0; e < n; e++) {
        let [x, y] = start;
        for (let step = 0; step < 60; step++) {
          const s = key(x, y);
          const a = Math.random() < 0.2 ? Math.floor(Math.random() * 4) : Q[s].indexOf(Math.max(...Q[s]));
          let nx = x + DX[a], ny = y + DY[a]; if (!valid(nx, ny)) { nx = x; ny = y; }
          let r = -0.02; let done = false;
          if (nx === goal[0] && ny === goal[1]) { r = 1; done = true; } if (nx === trap[0] && ny === trap[1]) { r = -1; done = true; }
          const ns = key(nx, ny);
          Q[s][a] += 0.3 * (r + 0.9 * Math.max(...Q[ns]) - Q[s][a]);
          x = nx; y = ny; if (done) break;
        }
        episodes++;
      }
      await runGreedy();
    };
    const runGreedy = async () => {
      bot = [...start]; draw();
      for (let step = 0; step < 30; step++) {
        const [x, y] = bot; if (x === goal[0] && y === goal[1]) break;
        const a = Q[key(x, y)].indexOf(Math.max(...Q[key(x, y)]));
        let nx = x + DX[a], ny = y + DY[a]; if (!valid(nx, ny)) break;
        bot = [nx, ny]; draw(); await sleep(150); if (nx === trap[0] && ny === trap[1]) break;
      }
    };
    const draw = () => {
      grid.innerHTML = "";
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
        const c = el("div"); const best = Math.max(...Q[key(x, y)]);
        if (walls.has(key(x, y))) c.className = "wall";
        else if (x === goal[0] && y === goal[1]) { c.className = "goal"; c.textContent = "🧀"; }
        else if (x === trap[0] && y === trap[1]) { c.style.background = "#3a1616"; c.textContent = "⚡"; }
        else if (best > 0.01) c.style.background = `rgba(95,208,143,${Math.min(0.7, best)})`;
        if (bot[0] === x && bot[1] === y) { c.className = "bot"; c.textContent = "🐭"; }
        grid.append(c);
      }
      info.textContent = `אימונים: ${episodes}. ירוק = מקום ״טוב״ שהעכבר למד.`;
    };
    d.append(grid, el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: () => train(1) }, "אימון 1"), el("button", { onclick: () => train(50) }, "×50"), el("button", { onclick: () => train(300) }, "×300"), el("button", { onclick: runGreedy }, "הראה מה למד")), info);
    draw();
  };

  // Naive Bayes spam
  D.spam = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מסווג ספאם", "AI שלומד לזהות הודעות זבל", "אימנו מסווג על הודעות מתויגות. הקלד הודעה, והוא ינחש: ספאם או תקין, לפי כמה ״ספאמיות״ המילים שבה. זו בדיוק השיטה (Naive Bayes) ששימשה שנים לסינון ספאם במייל.");
    const train = [
      ["חינם זכית פרס עכשיו לחץ כאן כסף", 1], ["מבצע בלעדי הנחה ענקית קנה עכשיו", 1], ["דחוף החשבון שלך ננעל אמת פרטים", 1], ["ויאגרה זול משלוח חינם הזמן", 1], ["זכייה מיליון דולר לחץ קישור", 1],
      ["היי מה שלומך נפגש מחר", 0], ["שיעורי בית למתמטיקה לעמוד 42", 0], ["תודה על הארוחה היה טעים", 0], ["הפגישה נדחתה ליום שלישי", 0], ["שלחתי לך את הקובץ תבדוק", 0],
    ];
    const spamW = {}, hamW = {}; let spamN = 0, hamN = 0;
    train.forEach(([t, s]) => t.split(/\s+/).forEach(w => { if (s) { spamW[w] = (spamW[w] || 0) + 1; spamN++; } else { hamW[w] = (hamW[w] || 0) + 1; hamN++; } }));
    const vocab = new Set([...Object.keys(spamW), ...Object.keys(hamW)]).size;
    const inp = el("input", { type: "text", value: "חינם מבצע לחץ כאן", id: "sp-in", style: "flex:1;min-width:0", "aria-label": "הודעה" });
    const out = el("div", { style: "font-weight:700;font-size:18px" });
    const detail = el("div", { class: "note" });
    const draw = () => {
      let ls = Math.log(0.5), lh = Math.log(0.5);
      inp.value.split(/\s+/).filter(Boolean).forEach(w => { ls += Math.log(((spamW[w] || 0) + 1) / (spamN + vocab)); lh += Math.log(((hamW[w] || 0) + 1) / (hamN + vocab)); });
      const p = 1 / (1 + Math.exp(lh - ls));
      out.textContent = p > 0.5 ? `🚫 ספאם (${Math.round(p * 100)}% ביטחון)` : `✓ תקין (${Math.round((1 - p) * 100)}% ביטחון)`;
      out.style.color = p > 0.5 ? "#ff7b7b" : "#5fd08f";
      detail.textContent = "מילים ״ספאמיות״ באימון: חינם, מבצע, זכית, דחוף, לחץ. המסווג מכפיל הסתברויות של כל מילה.";
    };
    inp.oninput = draw;
    d.append(el("div", { class: "row" }, inp), out, detail);
    draw();
  };

  // KNN classifier
  D.knn = d => {
    const { el, head } = MG;
    head(d, "מעבדה · שכן קרוב (KNN)", "סיווג לפי מי שקרוב", "יש נקודות משתי קבוצות. לחץ בכל מקום, וה-AI יסווג את הנקודה החדשה לפי K השכנים הקרובים אליה. אלגוריתם פשוט אבל חזק, בלי ״אימון״ בכלל.");
    const W = 300, H = 240;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "KNN", style: "max-width:100%;cursor:crosshair" });
    const ctx = cv.getContext("2d");
    const pts = []; for (let i = 0; i < 25; i++) pts.push({ x: rand(20, W / 2 - 10), y: rand(20, H - 20), c: 0 }); for (let i = 0; i < 25; i++) pts.push({ x: rand(W / 2 + 10, W - 20), y: rand(20, H - 20), c: 1 });
    const kS = el("input", { type: "range", min: "1", max: "15", step: "2", value: "5", id: "knn-k", "aria-label": "K" });
    const kL = el("b", {}, "5");
    let query = null;
    const COL = ["#ff9a4a", "#6aa2ff"];
    const draw = () => {
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      let near = [];
      if (query) { near = pts.map(p => ({ p, d: Math.hypot(p.x - query.x, p.y - query.y) })).sort((a, b) => a.d - b.d).slice(0, +kS.value); }
      pts.forEach(p => { ctx.fillStyle = COL[p.c]; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill(); });
      if (query) {
        near.forEach(({ p }) => { ctx.strokeStyle = "#556"; ctx.beginPath(); ctx.moveTo(query.x, query.y); ctx.lineTo(p.x, p.y); ctx.stroke(); });
        const votes = near.filter(n => n.p.c === 1).length;
        const cls = votes > +kS.value / 2 ? 1 : 0;
        ctx.fillStyle = COL[cls]; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(query.x, query.y, 9, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
      }
    };
    cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); query = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; draw(); });
    kS.oninput = () => { kL.textContent = kS.value; draw(); };
    d.append(cv, el("label", { style: "margin-top:8px" }, el("span", {}, "K (מספר שכנים) = ", kL), kS), el("div", { class: "note" }, "לחץ על הלוח כדי לסווג נקודה חדשה. הנקודה נצבעת לפי רוב השכנים."));
    draw();
  };

  // Turing machine
  D.turing = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · מכונת טיורינג", "המכונה שהגדירה ״מחשב״", "סרט אינסופי של תאים, ראש שקורא וכותב, וטבלת חוקים. זה המודל התיאורטי של כל מחשב שקיים. התוכנית כאן הופכת סדרת 1-ים לכפול (מוסיפה 0 באמצע). לחץ ״הרץ״.");
    let tape = [], head_ = 0, state = "A", running = false;
    const rules = { "A,1": ["1", 1, "A"], "A,0": ["0", 1, "B"], "A,_": ["_", -1, "H"], "B,0": ["0", 1, "B"], "B,_": ["0", -1, "C"], "C,0": ["0", -1, "C"], "C,1": ["1", -1, "C"], "C,_": ["_", 1, "H"] };
    const disp = el("div", { style: "display:flex;gap:3px;justify-content:center;direction:ltr;flex-wrap:wrap" });
    const info = el("div", { class: "note ltr", style: "text-align:center" });
    const reset = () => { tape = "111".split("").concat("0"); tape = ["1", "1", "1", "0", "_", "_", "_", "_"]; head_ = 0; state = "A"; draw(); };
    const draw = () => {
      disp.innerHTML = "";
      tape.forEach((c, i) => disp.append(el("div", { style: `width:30px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:5px;font-family:var(--font-mono);font-weight:700;background:${i === head_ ? "var(--screen-accent)" : "var(--screen-2)"};color:${i === head_ ? "#1d1204" : "#d9e6f2"}` }, c === "_" ? "␣" : c)));
      info.textContent = state === "H" ? "עצר. הסרט הוכפל." : "מצב: " + state;
    };
    const stepM = () => {
      if (state === "H") return false;
      while (head_ < 0) { tape.unshift("_"); head_++; } while (head_ >= tape.length) tape.push("_");
      const r = rules[state + "," + tape[head_]]; if (!r) { state = "H"; draw(); return false; }
      tape[head_] = r[0]; head_ += r[1]; state = r[2]; draw(); return true;
    };
    const run = async () => { if (running) return; running = true; reset(); await sleep(200); while (stepM()) await sleep(250); running = false; };
    d.append(disp, info, el("div", { class: "row", style: "justify-content:center;margin-top:8px" }, el("button", { class: "primary", onclick: run }, "▶ הרץ"), el("button", { onclick: () => { if (!running) stepM(); } }, "צעד"), el("button", { onclick: () => !running && reset() }, "אפס")), el("div", { class: "note", style: "margin-top:6px" }, "טיורינג הוכיח ב-1936 שמכונה פשוטה כזאת יכולה לחשב כל דבר שמחשב יכול. זה הבסיס התיאורטי של כל המחשוב."));
    reset();
  };

  // Traffic light FSM
  D.trafficlight = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מכונת מצבים", "רמזור: ארבעה מצבים בלולאה", "מכונת מצבים פשוטה: כל מצב יודע מה הצבע ומה המצב הבא. זה בדיוק הכלי שבו בונים AI של דמויות במשחקים.");
    const states = [["אדום", "#ff5a5a", 4], ["אדום+כתום", "#ffb454", 1], ["ירוק", "#5fd08f", 4], ["כתום", "#ffd84a", 1]];
    let i = 0, t = 0, auto = null;
    const lights = el("div", { style: "display:flex;flex-direction:column;gap:6px;width:60px;margin:0 auto;background:#111;padding:10px;border-radius:12px" });
    const info = el("div", { class: "note", style: "text-align:center" });
    const colors = ["#ff5a5a", "#ffd84a", "#5fd08f"];
    const draw = () => {
      const [name, col] = states[i];
      lights.innerHTML = "";
      colors.forEach(c => { const on = (col === c) || (name === "אדום+כתום" && (c === "#ff5a5a" || c === "#ffd84a")); lights.append(el("div", { style: `width:40px;height:40px;border-radius:50%;margin:0 auto;background:${on ? c : "#222"};box-shadow:${on ? "0 0 16px " + c : "none"}` })); });
      info.textContent = "מצב: " + name;
    };
    const next = () => { i = (i + 1) % states.length; draw(); };
    d.append(lights, info, el("div", { class: "row", style: "justify-content:center;margin-top:8px" }, el("button", { class: "primary", onclick: next }, "מצב הבא ⏭"), el("button", { onclick: () => { if (auto) { clearInterval(auto); auto = null; } else auto = setInterval(next, 1200); } }, "אוטומטי")));
    draw();
  };
})();

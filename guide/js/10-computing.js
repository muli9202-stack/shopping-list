// Demos: inside the CPU, networks, security
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});

  // Binary adder: column-by-column addition with carries
  D.adder = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מחבר בינארי", "איך המעבד מחבר שני מספרים", "המעבד מחבר מספרים בדיוק כמו שלמדת בכיתה א׳: עמודה אחרי עמודה, מימין לשמאל, עם ״נשא״ (carry). רק שבבינארי 1+1 = 10, כלומר 0 ונשא 1.");
    const a = el("input", { type: "number", min: "0", max: "255", value: "45", id: "add-a", "aria-label": "מספר ראשון" });
    const b = el("input", { type: "number", min: "0", max: "255", value: "27", id: "add-b", "aria-label": "מספר שני" });
    const out = el("div", { class: "out", style: "font-size:17px;line-height:1.9" });
    const step = el("input", { type: "range", min: "0", max: "9", value: "9", id: "add-step", "aria-label": "שלב" });
    const note = el("div", { class: "note" });
    const draw = () => {
      const x = Math.max(0, Math.min(255, +a.value || 0)), y = Math.max(0, Math.min(255, +b.value || 0));
      const bx = x.toString(2).padStart(9, "0"), by = y.toString(2).padStart(9, "0");
      const cols = +step.value; // how many columns from the right are done
      let carry = 0, sum = Array(9).fill(" "), carries = Array(9).fill(" ");
      for (let i = 8; i >= 0 && 8 - i < cols; i--) {
        const s = (+bx[i]) + (+by[i]) + carry;
        sum[i] = String(s % 2);
        carry = s >> 1;
        if (i > 0) carries[i - 1] = carry ? "1" : " ";
      }
      out.textContent = `נשא   ${carries.join(" ")}\n       ${bx.split("").join(" ")}   (${x})\n    +  ${by.split("").join(" ")}   (${y})\n    ─────────────────────\n       ${sum.join(" ")}   ${cols >= 9 ? "(" + (x + y) + ")" : ""}`;
      note.textContent = cols >= 9 ? `התוצאה: ${x} + ${y} = ${x + y}. כל עמודה היא ״מחבר מלא״ (Full Adder) שבנוי מכמה שערים לוגיים.` : `שלב ${cols} מתוך 9: הזז את המחוון כדי לראות עמודה אחרי עמודה.`;
    };
    [a, b, step].forEach(i => i.addEventListener("input", draw));
    d.append(el("div", { class: "row" }, el("span", {}, "מספר 1:"), a, el("span", {}, "מספר 2:"), b), out,
      el("label", { style: "margin-top:8px" }, "כמה עמודות כבר חיברנו (מימין):", step), note);
    draw();
  };

  // Tiny CPU with assembler
  const PROGS = {
    "ספירה לאחור": `; ספירה לאחור מ-5
SET A 5
loop:
OUT A
SUB A 1
JNZ A loop
HALT`,
    "כפל בעזרת חיבור": `; 6 כפול 4, בלי פקודת כפל!
SET A 0
SET B 6
SET C 4
loop:
ADD A B      ; A = A + B
SUB C 1      ; C = C - 1
JNZ C loop   ; אם C לא 0, חזור
OUT A
HALT`,
    "פיבונאצ׳י": `; 10 מספרי פיבונאצ'י
SET A 0
SET B 1
SET C 10
loop:
OUT A
SET D B
ADD B A
SET A D
SUB C 1
JNZ C loop
HALT`,
  };
  D.cpu = d => {
    const { el, head } = MG;
    head(d, "מעבדה · סימולטור מעבד", "מעבד זעיר עם 4 רגיסטרים", "זו שפת Assembly פשוטה. לחץ ״צעד״ כדי לראות את שלושת השלבים של כל הוראה: הבאה (Fetch), פענוח (Decode) וביצוע (Execute). PC הוא מונה התוכנית: מספר השורה שהמעבד מבצע עכשיו.");
    const sel = el("select", { id: "cpu-prog", "aria-label": "תוכנית" }, ...Object.keys(PROGS).map(k => el("option", { value: k }, k)));
    const ta = el("textarea", { rows: "9", spellcheck: "false", id: "cpu-code", "aria-label": "קוד אסמבלי" });
    const asm = el("div", { class: "asm" });
    const regs = el("div", { class: "regs" });
    const phase = el("div", { class: "out", style: "min-height:80px" });
    const outp = el("div", { class: "chips" });
    const speed = el("input", { type: "range", min: "50", max: "900", value: "400", id: "cpu-speed", "aria-label": "מהירות" });
    let prog = [], labels = {}, st, timer = null;
    const REG = ["A", "B", "C", "D"];
    ta.value = PROGS[sel.value];
    const assemble = () => {
      prog = []; labels = {};
      const lines = ta.value.split("\n");
      const err = [];
      lines.forEach(raw => {
        const line = raw.replace(/;.*/, "").trim();
        if (!line) return;
        if (/^\w+:$/.test(line)) { labels[line.slice(0, -1)] = prog.length; return; }
        const [op, ...args] = line.split(/\s+/);
        const OPS = { SET: 2, ADD: 2, SUB: 2, OUT: 1, JMP: 1, JZ: 2, JNZ: 2, HALT: 0 };
        const up = op.toUpperCase();
        if (!(up in OPS)) err.push(`לא מכיר את הפקודה "${op}"`);
        else if (args.length !== OPS[up]) err.push(`${up} צריכה ${OPS[up]} פרמטרים`);
        prog.push({ op: up, args, text: line });
      });
      prog.forEach(p => { if (/^J/.test(p.op) && !(p.args[p.args.length - 1] in labels)) err.push(`אין תווית בשם "${p.args[p.args.length - 1]}"`); });
      return err;
    };
    const reset = () => {
      clearInterval(timer); timer = null;
      const err = assemble();
      st = { pc: 0, r: { A: 0, B: 0, C: 0, D: 0 }, clock: 0, halted: false, out: [] };
      phase.textContent = err.length ? "שגיאה: " + err.join(" · ") : "מוכן. לחץ ״צעד״ או ״הרץ״.";
      if (err.length) st.halted = true;
      draw();
    };
    const val = x => REG.includes(x.toUpperCase()) ? st.r[x.toUpperCase()] : Number(x);
    const stepOnce = () => {
      if (st.halted) return false;
      if (st.pc >= prog.length) { st.halted = true; phase.textContent = "הגענו לסוף התוכנית."; draw(); return false; }
      const ins = prog[st.pc], [x, y] = ins.args;
      const R = x && x.toUpperCase();
      let exec = "", next = st.pc + 1;
      const names = { SET: "השמה: שים ערך ברגיסטר", ADD: "חיבור", SUB: "חיסור", OUT: "פלט: הדפס ערך", JMP: "קפיצה", JZ: "קפוץ אם אפס", JNZ: "קפוץ אם לא אפס", HALT: "עצור" };
      switch (ins.op) {
        case "SET": st.r[R] = val(y); exec = `${R} ← ${st.r[R]}`; break;
        case "ADD": { const o = st.r[R]; st.r[R] = o + val(y); exec = `${R} ← ${o} + ${val(y)} = ${st.r[R]}`; break; }
        case "SUB": { const o = st.r[R]; st.r[R] = o - val(y); exec = `${R} ← ${o} − ${val(y)} = ${st.r[R]}`; break; }
        case "OUT": st.out.push(val(x)); exec = `הדפסתי ${val(x)}`; break;
        case "JMP": next = labels[x]; exec = `PC ← ${next}`; break;
        case "JZ": if (st.r[R] === 0) { next = labels[y]; exec = `${R} = 0, לכן קופצים לשורה ${next}`; } else exec = `${R} = ${st.r[R]}, לא קופצים`; break;
        case "JNZ": if (st.r[R] !== 0) { next = labels[y]; exec = `${R} = ${st.r[R]}, לכן קופצים ל-${y} (שורה ${next})`; } else exec = `${R} = 0, ממשיכים הלאה`; break;
        case "HALT": st.halted = true; exec = "המעבד עצר."; break;
      }
      phase.textContent = `1. Fetch (הבאה):   PC = ${st.pc} → "${ins.text}"\n2. Decode (פענוח): ${names[ins.op]}\n3. Execute (ביצוע): ${exec}`;
      st.pc = next; st.clock++;
      if (st.clock > 500) { st.halted = true; phase.textContent += "\nעצרתי אחרי 500 מחזורים (לולאה אינסופית?)"; }
      draw();
      return !st.halted;
    };
    const draw = () => {
      asm.innerHTML = "";
      prog.forEach((p, i) => asm.append(el("div", { class: i === st.pc && !st.halted ? "pc" : "" }, el("span", { class: "ln" }, String(i)), p.text)));
      regs.innerHTML = "";
      [...REG.map(r => [r, st.r[r], "רגיסטר"]), ["PC", st.pc, "מונה תוכנית"], ["CLK", st.clock, "מחזורי שעון"]].forEach(([n, v, t]) => regs.append(el("div", { class: "reg" }, el("span", {}, n + " · " + t), el("b", {}, String(v)))));
      outp.innerHTML = "";
      st.out.forEach(v => outp.append(el("span", { class: "chip ok" }, String(v))));
      if (!st.out.length) outp.append(el("span", { class: "note" }, "(עדיין אין פלט)"));
    };
    sel.onchange = () => { ta.value = PROGS[sel.value]; reset(); };
    const run = () => {
      if (timer) { clearInterval(timer); timer = null; return; }
      if (st.halted) reset();
      timer = setInterval(() => { if (!stepOnce()) { clearInterval(timer); timer = null; } }, 950 - +speed.value);
    };
    d.append(el("div", { class: "row" }, el("span", {}, "תוכנית:"), sel),
      el("div", { class: "grid2" },
        el("div", {}, el("div", { class: "note" }, "הקוד (אפשר לערוך):"), ta, el("div", { class: "note ltr" }, "SET R n · ADD R X · SUB R X · OUT R · JMP L · JZ R L · JNZ R L · HALT")),
        el("div", {}, el("div", { class: "note" }, "הזיכרון של התוכנית (הקו הכתום = PC):"), asm)),
      el("div", { class: "row", style: "margin-top:10px" },
        el("button", { class: "primary", onclick: () => { if (!st || st.halted) reset(); stepOnce(); } }, "צעד ⏭"),
        el("button", { class: "primary", onclick: run }, "▶ הרץ / עצור"),
        el("button", { onclick: reset }, "טען מחדש"),
        el("label", { style: "min-width:140px;flex:1" }, "מהירות", speed)),
      phase, el("div", { class: "note", style: "margin-top:8px" }, "רגיסטרים (תאי הזיכרון הכי מהירים, בתוך המעבד):"), regs,
      el("div", { class: "note", style: "margin-top:8px" }, "פלט:"), outp);
    reset();
  };

  // Packets traveling through routers
  D.packets = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · חבילות ברשת", "שלח הודעה דרך האינטרנט", "ההודעה מתחלקת לחבילות ממוספרות. כל חבילה עשויה לעבור בדרך אחרת, להגיע בסדר אחר, או ללכת לאיבוד. ב-TCP המקבל מבקש שוב חבילות חסרות ומסדר לפי המספרים. ב-UDP לא מחכים: מהיר, אבל חלקים יכולים להיעלם (טוב למשחקים ווידאו חי).");
    const W = 520, H = 260;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "רשת" });
    const ctx = cv.getContext("2d");
    const nodes = { S: [30, 130], R1: [140, 50], R2: [140, 210], R3: [260, 130], R4: [370, 45], R5: [370, 215], T: [490, 130] };
    const links = [["S", "R1"], ["S", "R2"], ["R1", "R3"], ["R2", "R3"], ["R1", "R4"], ["R2", "R5"], ["R3", "R4"], ["R3", "R5"], ["R4", "T"], ["R5", "T"]];
    const paths = [["S", "R1", "R4", "T"], ["S", "R2", "R5", "T"], ["S", "R1", "R3", "R5", "T"], ["S", "R2", "R3", "R4", "T"], ["S", "R1", "R3", "R4", "T"]];
    const inp = el("input", { type: "text", value: "HELLO FROM GTA CITY!", id: "pk-msg", style: "flex:1;min-width:0", "aria-label": "הודעה", maxlength: "40" });
    const mode = el("select", { id: "pk-mode", "aria-label": "פרוטוקול" }, el("option", { value: "tcp" }, "TCP (אמין)"), el("option", { value: "udp" }, "UDP (מהיר)"));
    const loss = el("input", { type: "range", min: "0", max: "50", value: "20", id: "pk-loss", "aria-label": "אחוז איבוד" });
    const lossL = el("b", {}, "20%");
    const recv = el("div", { class: "chips" });
    const log = el("div", { class: "note", style: "min-height:20px" });
    let packets = [], slots = [], running = false;
    const send = () => {
      const msg = inp.value || " ";
      const chunks = msg.match(/.{1,4}/g);
      slots = chunks.map(() => null);
      packets = chunks.map((c, i) => newPacket(i, c, i * 0.35));
      running = true; log.textContent = `נשלחו ${chunks.length} חבילות.`;
      drawRecv();
    };
    const newPacket = (i, data, delay) => {
      const path = paths[Math.floor(Math.random() * paths.length)];
      const lostAt = Math.random() * 100 < +loss.value ? 1 + Math.floor(Math.random() * (path.length - 2)) : -1;
      return { i, data, path, seg: 0, t: -delay, speed: 0.9 + Math.random() * 0.8, lostAt, dead: false, done: false, retries: 0 };
    };
    const drawRecv = () => {
      recv.innerHTML = "";
      slots.forEach((s, i) => recv.append(el("span", { class: "chip " + (s == null ? "" : "ok"), title: "חבילה " + i }, s == null ? `#${i} ▢` : `#${i} ${s}`)));
    };
    let last = 0;
    const tick = now => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#2b3a50"; ctx.lineWidth = 2;
      links.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...nodes[a]); ctx.lineTo(...nodes[b]); ctx.stroke(); });
      Object.entries(nodes).forEach(([n, [x, y]]) => {
        ctx.fillStyle = n === "S" || n === "T" ? "#ffb454" : "#1b2a40";
        ctx.beginPath(); ctx.arc(x, y, n === "S" || n === "T" ? 20 : 16, 0, 7); ctx.fill();
        ctx.fillStyle = n === "S" || n === "T" ? "#1d1204" : "#d9e6f2"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
        ctx.fillText(n === "S" ? "אתה" : n === "T" ? "שרת" : n, x, y + 4);
      });
      if (!running) { ctx.fillStyle = "#7d8fa6"; ctx.font = "13px sans-serif"; ctx.fillText("לחץ ״שלח״", W / 2, H - 10); return; }
      let active = 0;
      packets.forEach(p => {
        if (p.done || p.dead) return;
        active++;
        p.t += dt * p.speed;
        if (p.t < 0) return;
        if (p.t >= 1) { p.t = 0; p.seg++; if (p.seg === p.lostAt) { p.dead = true; p.deadPos = nodes[p.path[p.seg]]; log.textContent = `חבילה #${p.i} אבדה בנתב ${p.path[p.seg]}!`; } }
        if (p.seg >= p.path.length - 1) { p.done = true; slots[p.i] = p.data; drawRecv(); return; }
        const [ax, ay] = nodes[p.path[p.seg]], [bx, by] = nodes[p.path[p.seg + 1]];
        const x = ax + (bx - ax) * p.t, y = ay + (by - ay) * p.t;
        ctx.fillStyle = `hsl(${p.i * 47 % 360},80%,65%)`; ctx.fillRect(x - 11, y - 8, 22, 16);
        ctx.fillStyle = "#06101f"; ctx.font = "bold 10px monospace"; ctx.fillText("#" + p.i, x, y + 4);
      });
      packets.filter(p => p.dead).forEach(p => { ctx.fillStyle = "#ff6b6b"; ctx.font = "bold 18px sans-serif"; ctx.fillText("✕", p.deadPos[0] + 18, p.deadPos[1] - 14); });
      if (active === 0) {
        const missing = slots.map((s, i) => s == null ? i : -1).filter(i => i >= 0);
        if (missing.length && mode.value === "tcp") {
          log.textContent = `TCP: חסרות חבילות ${missing.map(i => "#" + i).join(", ")}. המקבל מבקש לשלוח שוב (retransmit).`;
          packets = packets.filter(p => !p.dead).concat(missing.map((i, k) => newPacket(i, packets.find(p => p.i === i).data, k * 0.3)));
        } else {
          running = false;
          log.textContent = missing.length ? `UDP: ${missing.length} חבילות לא הגיעו, וההודעה נשארה עם חורים. במשחק זה ״לאג״ קטן, לא אסון.` : `כל החבילות הגיעו! ההודעה הורכבה לפי המספרים: "${slots.join("")}"`;
        }
      }
    };
    loss.oninput = () => { lossL.textContent = loss.value + "%"; };
    d.append(cv, el("div", { class: "row", style: "margin-top:10px" }, inp, mode, el("button", { class: "primary", onclick: send }, "שלח ▶")),
      el("label", {}, el("span", {}, "סיכוי שחבילה תלך לאיבוד: ", lossL), loss),
      el("div", { class: "note", style: "margin-top:8px" }, "מה הגיע לשרת (לפי מספר חבילה):"), recv, log);
    requestAnimationFrame(tick);
  };

  // Journey of a web request (stepper)
  D.journey = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מסע של בקשה", "מה קורה ב-0.3 השניות אחרי שאתה לוחץ Enter", "לחץ ״הבא״ כדי לעבור שלב אחרי שלב על מה שקורה כשאתה כותב youtube.com בדפדפן.");
    const steps = [
      ["⌨️ הקלדה", "אתה כותב youtube.com ולוחץ Enter. הדפדפן בודק: האם זה חיפוש או כתובת? זו כתובת."],
      ["📒 מטמון (Cache)", "הדפדפן בודק אם הוא כבר זוכר את כתובת ה-IP מביקור קודם. אם כן, מדלגים על ה-DNS."],
      ["❓ שאלה ל-DNS", "המחשב שואל שרת DNS (בדרך כלל של ספק האינטרנט): ״מה ה-IP של youtube.com?״"],
      ["🌳 שרשרת ה-DNS", "אם שרת ה-DNS לא יודע, הוא שואל את שרתי השורש (root), הם מפנים לשרתי .com, והם מפנים לשרתים של יוטיוב. התשובה: כתובת כמו 142.250.x.x."],
      ["🤝 לחיצת יד TCP", "הדפדפן פותח חיבור לשרת בשלוש הודעות: SYN (״היי?״), SYN-ACK (״היי, שומע!״), ACK (״מעולה, מתחילים״)."],
      ["🔐 הצפנה TLS", "הדפדפן והשרת מחליפים מפתחות הצפנה. השרת מציג ״תעודה״ שמוכיחה שהוא באמת יוטיוב ולא מתחזה. מכאן הכול מוצפן (HTTPS)."],
      ["📨 בקשת HTTP", "הדפדפן שולח: GET / HTTP/2 ״תן לי בבקשה את הדף הראשי״, יחד עם עוגיות (cookies) שמזהות שאתה מחובר."],
      ["🏭 השרת עובד", "בחוות שרתים, תוכנת ה-Backend בודקת מי אתה, שולפת ממסד הנתונים סרטונים מומלצים בשבילך (בעזרת AI), ובונה תשובה."],
      ["📦 תשובה בחבילות", "השרת שולח HTML, CSS, JavaScript ותמונות, מחולקים לאלפי חבילות. הרבה מהקבצים מגיעים מ-CDN: שרת קרוב אליך גיאוגרפית, אולי בתל אביב."],
      ["🎨 הדפדפן מצייר", "הדפדפן בונה את ה-DOM מה-HTML, מחיל את ה-CSS, מריץ JavaScript, ומצייר פיקסלים על המסך. אחר כך הוא ממשיך להוריד את הסרטון בהזרמה (streaming)."],
    ];
    let i = 0;
    const list = el("div", { class: "steps" });
    const draw = () => {
      list.innerHTML = "";
      steps.forEach(([t, x], k) => list.append(el("div", { class: k === i ? "on" : k < i ? "past" : "" }, el("b", {}, `${k + 1}. ${t}`), k <= i ? el("div", {}, x) : null)));
    };
    let auto = null;
    d.append(el("div", { class: "row" },
      el("button", { onclick: () => { i = Math.max(0, i - 1); draw(); } }, "→ הקודם"),
      el("button", { class: "primary", onclick: () => { i = Math.min(steps.length - 1, i + 1); draw(); } }, "הבא ←"),
      el("button", { onclick: () => { clearInterval(auto); i = 0; draw(); auto = setInterval(() => { if (i >= steps.length - 1) clearInterval(auto); else { i++; draw(); } }, 1600); } }, "▶ הפעל אוטומטית")), list);
    draw();
  };

  // Caesar cipher
  D.caesar = d => {
    const { el, head } = MG;
    head(d, "מעבדה · הצפנה", "צופן קיסר: ההצפנה הכי עתיקה", "יוליוס קיסר הצפין הודעות על ידי הזזת כל אות כמה מקומות באלף-בית. בחר הזזה והקלד הודעה. אחר כך נסה ״לפרוץ״ אותה: יש רק 25 אפשרויות, אז מחשב פורץ את זה במיקרו-שנייה.");
    const EN = "abcdefghijklmnopqrstuvwxyz", HE = "אבגדהוזחטיכלמנסעפצקרשת";
    const shiftCh = (c, k) => {
      const lower = c.toLowerCase();
      let i = EN.indexOf(lower);
      if (i >= 0) { const r = EN[(i + k % 26 + 26) % 26]; return c === lower ? r : r.toUpperCase(); }
      i = HE.indexOf(c);
      if (i >= 0) return HE[(i + k % 22 + 22) % 22];
      return c;
    };
    const enc = (s, k) => [...s].map(c => shiftCh(c, k)).join("");
    const inp = el("input", { type: "text", value: "פגישה סודית ליד המזרקה", id: "cz-in", style: "flex:1;min-width:0", "aria-label": "הודעה" });
    const k = el("input", { type: "range", min: "1", max: "25", value: "3", id: "cz-k", "aria-label": "הזזה" });
    const kL = el("b", {}, "3");
    const out = el("div", { class: "big", style: "font-size:22px;font-family:var(--font-body)" });
    const map = el("div", { class: "note", style: "direction:rtl;font-family:var(--font-mono)" });
    const brute = el("div", { class: "out", style: "direction:rtl;text-align:right;font-family:var(--font-body)" });
    const draw = () => {
      kL.textContent = k.value;
      out.textContent = enc(inp.value, +k.value);
      map.textContent = [...HE].slice(0, 11).map(c => c + "→" + shiftCh(c, +k.value)).join("  ") + " ...";
    };
    [inp, k].forEach(x => x.addEventListener("input", draw));
    d.append(el("div", { class: "row" }, inp), el("label", {}, el("span", {}, "הזזה (המפתח הסודי) = ", kL), k),
      el("div", { class: "note" }, "ההודעה המוצפנת:"), out, map,
      el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "primary", onclick: () => {
        const c = out.textContent;
        brute.textContent = Array.from({ length: 21 }, (_, i) => `הזזה ${String(i + 1).padStart(2, " ")}: ${enc(c, -(i + 1))}`).join("\n");
      } }, "פרוץ בכוח (Brute Force)")), brute);
    draw();
  };

  // Key exchange by mixing colors (Diffie–Hellman analogy)
  D.keyexchange = d => {
    const { el, head } = MG;
    head(d, "מעבדה · החלפת מפתחות", "איך שני אנשים מסכימים על סוד מול כולם", "זה הטריק שמאחורי HTTPS, מוסבר עם צבעים. ערבוב צבעים קל, אבל להפריד צבע מעורבב בחזרה לרכיבים שלו כמעט בלתי אפשרי. במחשב משתמשים במתמטיקה שעובדת באותו אופן.");
    const pub = "#f2d33a";
    const A = el("input", { type: "color", value: "#d6336c", id: "kx-a", "aria-label": "הצבע הסודי של נועה" });
    const B = el("input", { type: "color", value: "#1c7ed6", id: "kx-b", "aria-label": "הצבע הסודי של דן" });
    const hex2 = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
    const mix = (...cs) => { const rgb = cs.map(hex2); return "#" + [0, 1, 2].map(i => Math.round(rgb.reduce((s, c) => s + c[i], 0) / rgb.length).toString(16).padStart(2, "0")).join(""); };
    const sw = (c, t, sub) => el("div", { style: "text-align:center;min-width:0" }, el("div", { class: "swatch", style: `height:60px;background:${c}` }), el("b", { style: "font-size:13px" }, t), sub ? el("div", { class: "note" }, sub) : null);
    const box = el("div");
    const draw = () => {
      const a = A.value, b = B.value;
      const pa = mix(pub, a), pb = mix(pub, b);
      const sa = mix(pub, a, b), sb = mix(pub, b, a);
      const eve = mix(pa, pb);
      box.innerHTML = "";
      box.append(
        el("div", { class: "note" }, "1. צבע ציבורי שכולם רואים:"), el("div", { style: "display:grid;grid-template-columns:repeat(3,1fr);gap:8px" }, sw(pub, "צבע ציבורי")),
        el("div", { class: "note", style: "margin-top:10px" }, "2. כל אחד מערבב את הציבורי עם הסוד שלו, ושולח את התוצאה בגלוי:"),
        el("div", { style: "display:grid;grid-template-columns:repeat(2,1fr);gap:8px" }, sw(pa, "נועה שולחת", "ציבורי + סוד של נועה"), sw(pb, "דן שולח", "ציבורי + סוד של דן")),
        el("div", { class: "note", style: "margin-top:10px" }, "3. כל אחד מוסיף את הסוד שלו למה שקיבל. יוצא אותו צבע בדיוק = מפתח משותף!"),
        el("div", { style: "display:grid;grid-template-columns:repeat(3,1fr);gap:8px" }, sw(sa, "המפתח של נועה", sa), sw(sb, "המפתח של דן", sb), sw(eve, "ניחוש של ערן המצותת", "ערבב את מה שראה: " + (eve === sa ? "הצליח?!" : "נכשל"))));
    };
    [A, B].forEach(x => x.addEventListener("input", draw));
    d.append(el("div", { class: "row" }, el("span", {}, "הסוד של נועה:"), A, el("span", {}, "הסוד של דן:"), B), box);
    draw();
  };

  // SHA-256 (compact implementation so it also works without crypto.subtle)
  function sha256(ascii) {
    const bytes = new TextEncoder().encode(ascii);
    const K = [], H = [];
    let n = 2, c = 0;
    const frac = x => ((x - Math.floor(x)) * 4294967296) | 0;
    while (c < 64) { let p = true; for (let f = 2; f * f <= n; f++) if (n % f === 0) { p = false; break; } if (p) { if (c < 8) H[c] = frac(Math.pow(n, 1 / 2)); K[c] = frac(Math.pow(n, 1 / 3)); c++; } n++; }
    const l = bytes.length, withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    withPad.set(bytes); withPad[l] = 0x80;
    const bits = l * 8, dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 4, bits >>> 0); dv.setUint32(withPad.length - 8, Math.floor(bits / 4294967296));
    const w = new Int32Array(64), rotr = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < withPad.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, cc, dd, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
        h = g; g = f; f = e; e = (dd + t1) | 0; dd = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + dd) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  window.MG_SHA256 = sha256;
  D.hash = d => {
    const { el, head } = MG;
    head(d, "מעבדה · גיבוב (Hash)", "טביעת אצבע דיגיטלית", "פונקציית גיבוב SHA-256 הופכת כל טקסט ל-64 תווים. אותו קלט תמיד נותן אותה תוצאה, אבל שינוי של אות אחת משנה הכול (״אפקט המפולת״). ואי אפשר לחזור מהתוצאה לטקסט. ככה אתרים שומרים סיסמאות.");
    const a = el("input", { type: "text", value: "GTA", id: "hs-a", style: "flex:1;min-width:0", "aria-label": "טקסט 1" });
    const b = el("input", { type: "text", value: "GTB", id: "hs-b", style: "flex:1;min-width:0", "aria-label": "טקסט 2" });
    const ha = el("div", { class: "out", style: "min-height:0;word-break:break-all" }), hb = el("div", { class: "out", style: "min-height:0;word-break:break-all" });
    const diff = el("div", { class: "note" });
    const draw = () => {
      const x = sha256(a.value), y = sha256(b.value);
      ha.textContent = x; hb.innerHTML = "";
      [...y].forEach((ch, i) => hb.append(el("span", { style: ch !== x[i] ? "color:#ffb454" : "" }, ch)));
      let bitsDiff = 0;
      for (let i = 0; i < 64; i++) { let v = parseInt(x[i], 16) ^ parseInt(y[i], 16); while (v) { bitsDiff += v & 1; v >>= 1; } }
      diff.textContent = `${bitsDiff} מתוך 256 ביטים שונים (${Math.round(bitsDiff / 2.56)}%). התווים הכתומים שונים.`;
    };
    [a, b].forEach(x => x.addEventListener("input", draw));
    // login simulation
    const pw = el("input", { type: "text", value: "Pizza#2026", id: "hs-pw", "aria-label": "סיסמה להרשמה" });
    const login = el("input", { type: "text", value: "pizza#2026", id: "hs-login", "aria-label": "סיסמה להתחברות" });
    const db = el("div", { class: "out", style: "min-height:0;word-break:break-all" });
    const res = el("div", { style: "font-weight:700;margin-top:6px" });
    let stored = null;
    d.append(el("div", { class: "row" }, a), ha, el("div", { class: "row", style: "margin-top:8px" }, b), hb, diff,
      el("h4", { style: "margin-top:16px" }, "סימולציה: איך אתר בודק סיסמה בלי לשמור אותה"),
      el("div", { class: "row" }, el("span", {}, "הרשמה, סיסמה:"), pw, el("button", { class: "primary", onclick: () => { stored = sha256(pw.value); db.textContent = "במסד הנתונים נשמר רק: " + stored; res.textContent = ""; } }, "הירשם")), db,
      el("div", { class: "row", style: "margin-top:8px" }, el("span", {}, "התחברות, סיסמה:"), login, el("button", { class: "primary", onclick: () => {
        if (!stored) { res.textContent = "קודם צריך להירשם."; return; }
        const ok = sha256(login.value) === stored;
        res.textContent = ok ? "✓ הגיבוב זהה: נכנסת!" : "✕ הגיבוב שונה: סיסמה שגויה (שים לב לאותיות גדולות/קטנות)";
        res.style.color = ok ? "#5fd08f" : "#ff7b7b";
      } }, "התחבר")), res);
    draw();
  };

  // Password strength
  D.password = d => {
    const { el, head } = MG;
    head(d, "מעבדה · חוזק סיסמה", "כמה זמן ייקח לפרוץ את הסיסמה?", "הערכה לפי מחשב שמנסה 10 מיליארד ניחושים בשנייה. אל תקליד כאן סיסמה אמיתית שלך! המציא דוגמאות.");
    const inp = el("input", { type: "text", value: "dragon", id: "pw-in", style: "flex:1;min-width:0", "aria-label": "סיסמה לדוגמה", autocomplete: "off" });
    const bar = el("div", { class: "track", style: "height:14px;background:var(--screen-2);border-radius:7px;overflow:hidden" }, el("i", { style: "display:block;height:100%" }));
    const verdict = el("div", { class: "big", style: "font-size:24px;font-family:var(--font-body)" });
    const why = el("div", { class: "note" });
    const COMMON = ["123456", "password", "12345678", "qwerty", "111111", "abc123", "iloveyou", "admin", "123123", "dragon", "football", "letmein", "monkey", "000000", "1234", "password1", "minecraft", "fortnite"];
    const human = s => {
      const units = [[31536000 * 1e9, "מיליארד שנים"], [31536000 * 1e6, "מיליון שנים"], [31536000 * 1000, "אלף שנים"], [31536000, "שנים"], [86400, "ימים"], [3600, "שעות"], [60, "דקות"], [1, "שניות"]];
      if (s < 1) return "פחות משנייה";
      for (const [u, n] of units) if (s >= u) { const v = s / u; return (v > 1000 ? "יותר מ-1000" : v.toFixed(v < 10 ? 1 : 0)) + " " + n; }
    };
    const draw = () => {
      const p = inp.value;
      let set = 0; const parts = [];
      if (/[a-z]/.test(p)) { set += 26; parts.push("אותיות קטנות"); }
      if (/[A-Z]/.test(p)) { set += 26; parts.push("אותיות גדולות"); }
      if (/[0-9]/.test(p)) { set += 10; parts.push("ספרות"); }
      if (/[א-ת]/.test(p)) { set += 27; parts.push("עברית"); }
      if (/[^a-zA-Z0-9א-ת]/.test(p)) { set += 33; parts.push("סימנים"); }
      const bits = p.length * Math.log2(Math.max(set, 1));
      let secs = Math.pow(2, bits) / 2 / 1e10;
      const common = COMMON.includes(p.toLowerCase());
      if (common) secs = 0.0001;
      const score = common ? 0 : Math.min(1, bits / 90);
      bar.firstChild.style.width = Math.max(4, score * 100) + "%";
      bar.firstChild.style.background = score < .35 ? "#ff6b6b" : score < .65 ? "#ffb454" : "#5fd08f";
      verdict.textContent = p ? "זמן פריצה: " + human(secs) : "";
      why.textContent = common ? "זו אחת הסיסמאות הנפוצות בעולם. פורצים מנסים אותן ראשונות, תוך שנייה." :
        `${p.length} תווים · סוגים: ${parts.join(", ") || "אין"} · ${Math.round(bits)} ביטים של אקראיות. טיפ: משפט ארוך כמו ״פיל-כחול-אוכל-פלאפל-7״ חזק יותר מ-״P@ss1״.`;
    };
    inp.addEventListener("input", draw);
    d.append(el("div", { class: "row" }, inp), bar, verdict, why);
    draw();
  };
})();

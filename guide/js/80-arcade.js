// Demos: arcade — mini-games and graphics toys, all playable
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});
  const key = (d, map) => { window.addEventListener("keydown", e => { if (d.closest(".chapter").hidden) return; if (map[e.key]) { map[e.key](); e.preventDefault(); } }); };

  // Tetris
  D.tetris = d => {
    const { el, head, visible, makeInput } = MG;
    head(d, "מעבדה · טטריס", "המשחק שכולם מכירים", "חיצים או הכפתורים: ◀ ▶ להזיז, ▲ לסובב, ▼ להאיץ. שורה מלאה נמחקת. זה משחק שלם ב-100 שורות קוד, עם רשת, התנגשויות וסיבוב חלקים.");
    const C = 10, R = 18, S = 20;
    const cv = el("canvas", { width: String(C * S), height: String(R * S), "aria-label": "טטריס" });
    const ctx = cv.getContext("2d");
    const input = makeInput(d);
    const SHAPES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]]];
    const COL = ["#5fd0d0", "#ffd84a", "#c77dff", "#6aa2ff", "#ffb454", "#5fd08f", "#ff6b6b"];
    let grid, piece, px, py, pc, score, over, acc, drop, running = false;
    const reset = () => { grid = Array.from({ length: R }, () => Array(C).fill(-1)); score = 0; over = false; acc = 0; drop = 0.5; spawn(); };
    const spawn = () => { pc = Math.floor(Math.random() * 7); piece = SHAPES[pc].map(r => r.slice()); px = 3; py = 0; if (hit(px, py, piece)) over = true; };
    const hit = (x, y, p) => p.some((row, dy) => row.some((v, dx) => v && (x + dx < 0 || x + dx >= C || y + dy >= R || (y + dy >= 0 && grid[y + dy][x + dx] >= 0))));
    const merge = () => { piece.forEach((row, dy) => row.forEach((v, dx) => { if (v && py + dy >= 0) grid[py + dy][px + dx] = pc; })); let lines = 0; for (let y = R - 1; y >= 0; y--) if (grid[y].every(c => c >= 0)) { grid.splice(y, 1); grid.unshift(Array(C).fill(-1)); lines++; y++; } score += [0, 100, 300, 500, 800][lines]; drop = Math.max(0.08, 0.5 - score / 6000); spawn(); };
    const rotate = () => { const r = piece[0].map((_, i) => piece.map(row => row[i]).reverse()); if (!hit(px, py, r)) piece = r; };
    const move = dx => { if (!hit(px + dx, py, piece)) px += dx; };
    const down = () => { if (!hit(px, py + 1, piece)) py++; else merge(); };
    let held = {};
    const press = k => { if (over) return; if (k === "l") move(-1); if (k === "r") move(1); if (k === "u") rotate(); if (k === "d") down(); };
    ["l", "r", "u", "d"].forEach(k => { });
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.1, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      if (running && !over) { acc += dt; const spd = input.keys.has("d") ? 0.05 : drop; if (acc > spd) { acc = 0; down(); } for (const k of ["l", "r", "u"]) { if (input.keys.has(k) && !held[k]) press(k); held[k] = input.keys.has(k); } }
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, C * S, R * S);
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (grid[y][x] >= 0) { ctx.fillStyle = COL[grid[y][x]]; ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2); }
      if (!over) piece.forEach((row, dy) => row.forEach((v, dx) => { if (v) { ctx.fillStyle = COL[pc]; ctx.fillRect((px + dx) * S + 1, (py + dy) * S + 1, S - 2, S - 2); } }));
      ctx.fillStyle = "#fff"; ctx.font = "bold 14px monospace"; ctx.fillText(score, 8, 20);
      if (over) { ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(0, 0, C * S, R * S); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 22px sans-serif"; ctx.fillText("Game Over", C * S / 2, R * S / 2); ctx.textAlign = "left"; }
    };
    reset();
    d.append(cv, el("div", { class: "row", style: "margin-top:8px;justify-content:space-between" }, el("button", { class: "primary", onclick: () => { reset(); running = true; input.setActive(true); } }, "▶ שחק"), input.pad));
    requestAnimationFrame(loop);
  };

  // Minesweeper
  D.minesweeper = d => {
    const { el, head } = MG;
    head(d, "מעבדה · שולה מוקשים", "היגיון, לא מזל", "לחץ לחשוף תא. מספר = כמה מוקשים גובלים בו. לחיצה ארוכה (או כפתור הדגל) מסמנת מוקש. גלה את כל התאים הבטוחים. זה תרגיל קלאסי בהיגיון ובאלגוריתם ״הצפה״.");
    const C = 10, R = 10, MINES = 15;
    let mines, revealed, flags, over, won, flagMode = false, first;
    const grid = el("div", { style: `display:grid;grid-template-columns:repeat(${C},28px);gap:2px;justify-content:center` });
    const msg = el("div", { style: "text-align:center;font-weight:700;min-height:24px" });
    const reset = () => { mines = Array.from({ length: R }, () => Array(C).fill(false)); revealed = Array.from({ length: R }, () => Array(C).fill(false)); flags = Array.from({ length: R }, () => Array(C).fill(false)); over = won = false; first = true; draw(); };
    const place = (sx, sy) => { let n = 0; while (n < MINES) { const x = Math.floor(Math.random() * C), y = Math.floor(Math.random() * R); if (!mines[y][x] && !(Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1)) { mines[y][x] = true; n++; } } };
    const count = (x, y) => { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const nx = x + i, ny = y + j; if (nx >= 0 && ny >= 0 && nx < C && ny < R && mines[ny][nx]) n++; } return n; };
    const reveal = (x, y) => { if (x < 0 || y < 0 || x >= C || y >= R || revealed[y][x] || flags[y][x]) return; revealed[y][x] = true; if (mines[y][x]) { over = true; return; } if (count(x, y) === 0) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) reveal(x + i, y + j); };
    const checkWin = () => { let safe = 0; for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (revealed[y][x] && !mines[y][x]) safe++; if (safe === C * R - MINES) won = true; };
    const draw = () => {
      grid.innerHTML = "";
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
        const rev = revealed[y][x], c = rev ? count(x, y) : 0;
        const b = el("button", { style: `width:28px;height:28px;border-radius:4px;font-weight:700;font-family:var(--font-mono);cursor:pointer;border:1px solid #2b3a50;background:${rev ? "#0e1726" : "var(--screen-2)"};color:${["", "#6aa2ff", "#5fd08f", "#ff6b6b", "#c77dff", "#ffb454", "#5fd0d0", "#fff", "#f88"][c]}` },
          over && mines[y][x] ? "💣" : flags[y][x] ? "🚩" : rev && c ? String(c) : "");
        const act = () => { if (over || won) return; if (flagMode) { flags[y][x] = !flags[y][x]; } else { if (first) { place(x, y); first = false; } reveal(x, y); checkWin(); } draw(); };
        b.onclick = act;
        b.oncontextmenu = e => { e.preventDefault(); if (!over && !won) { flags[y][x] = !flags[y][x]; draw(); } };
        grid.append(b);
      }
      msg.textContent = over ? "💥 נגעת במוקש!" : won ? "🎉 ניצחת!" : `מוקשים: ${MINES}`;
    };
    const fmBtn = el("button", { onclick: () => { flagMode = !flagMode; fmBtn.classList.toggle("on", flagMode); } }, "🚩 מצב דגל");
    d.append(grid, msg, el("div", { class: "row", style: "justify-content:center;margin-top:8px" }, fmBtn, el("button", { class: "primary", onclick: reset }, "משחק חדש")));
    reset();
  };

  // 2048
  D.g2048 = d => {
    const { el, head, makeInput } = MG;
    head(d, "מעבדה · 2048", "מזג מספרים עד 2048", "חיצים או הכפתורים מזיזים את כל האריחים. שני אריחים זהים נדבקים ומתחברים. ניהול לוגי של רשת, עם אנימציית מיזוג.");
    let g, score, over;
    const board = el("div", { style: "display:grid;grid-template-columns:repeat(4,64px);gap:6px;justify-content:center;background:#1a2330;padding:6px;border-radius:8px" });
    const msg = el("div", { style: "text-align:center;font-weight:700;min-height:24px" });
    const input = makeInput(d);
    const COL = { 2: "#3a4659", 4: "#4a5870", 8: "#ffb454", 16: "#ff9a4a", 32: "#ff6b6b", 64: "#ff5a5a", 128: "#5fd08f", 256: "#5fd0d0", 512: "#6aa2ff", 1024: "#c77dff", 2048: "#ffd84a" };
    const add = () => { const empty = []; g.forEach((r, y) => r.forEach((v, x) => { if (!v) empty.push([x, y]); })); if (empty.length) { const [x, y] = empty[Math.floor(Math.random() * empty.length)]; g[y][x] = Math.random() < 0.9 ? 2 : 4; } };
    const reset = () => { g = Array.from({ length: 4 }, () => Array(4).fill(0)); score = 0; over = false; add(); add(); draw(); };
    const slide = row => { let a = row.filter(v => v); for (let i = 0; i < a.length - 1; i++) if (a[i] === a[i + 1]) { a[i] *= 2; score += a[i]; a.splice(i + 1, 1); } while (a.length < 4) a.push(0); return a; };
    const move = dir => {
      if (over) return;
      const before = JSON.stringify(g);
      const rot = (m, n) => { for (let k = 0; k < n; k++) m = m[0].map((_, i) => m.map(r => r[i]).reverse()); return m; };
      let m = rot(g, dir); m = m.map(slide); g = rot(m, (4 - dir) % 4);
      if (JSON.stringify(g) !== before) add();
      if (!g.flat().includes(0) && !canMove()) over = true;
      draw();
    };
    const canMove = () => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { if (!g[y][x]) return true; if (x < 3 && g[y][x] === g[y][x + 1]) return true; if (y < 3 && g[y][x] === g[y + 1][x]) return true; } return false; };
    const draw = () => {
      board.innerHTML = "";
      g.forEach(r => r.forEach(v => board.append(el("div", { style: `width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-weight:700;font-size:${v > 512 ? 20 : 26}px;background:${v ? COL[v] || "#ffd84a" : "#0e1726"};color:${v > 4 ? "#1d1204" : "#d9e6f2"}` }, v ? String(v) : ""))));
      msg.textContent = over ? "אין מהלכים · ניקוד " + score : "ניקוד: " + score;
    };
    let held = {};
    const dirMap = { u: 3, d: 1, l: 0, r: 2 };
    setInterval(() => { if (d.closest(".chapter").hidden) return; for (const k in dirMap) { if (input.keys.has(k) && !held[k]) move(dirMap[k]); held[k] = input.keys.has(k); } }, 90);
    input.setActive(true);
    d.append(board, msg, el("div", { class: "row", style: "justify-content:space-between;margin-top:8px" }, el("button", { class: "primary", onclick: reset }, "משחק חדש"), input.pad));
    reset();
  };

  // Breakout
  D.breakout = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · שובר לבנים", "פונג עם לבנים", "הזז את המחבת עם העכבר או האצבע. הכדור מקפיץ, שובר לבנים, וההתנגשות משנה את הכיוון. פיזיקה פשוטה, כיף גדול.");
    const W = 360, H = 260;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "שובר לבנים", style: "max-width:100%;touch-action:none" });
    const ctx = cv.getContext("2d");
    let ball, paddle, bricks, score, lives, running = false;
    const reset = () => { ball = { x: W / 2, y: H - 40, vx: 130, vy: -170, r: 6 }; paddle = W / 2; score = 0; lives = 3; bricks = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) bricks.push({ x: 8 + x * 44, y: 24 + y * 20, w: 40, h: 14, c: `hsl(${y * 40 + 10},70%,60%)` }); };
    cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); paddle = Math.max(30, Math.min(W - 30, (e.clientX - r.left) / r.width * W)); });
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.03, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      if (running) {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < ball.r || ball.x > W - ball.r) ball.vx *= -1;
        if (ball.y < ball.r) ball.vy *= -1;
        if (ball.y > H - 20 && ball.y < H - 12 && Math.abs(ball.x - paddle) < 34 && ball.vy > 0) { ball.vy *= -1; ball.vx += (ball.x - paddle) * 3; }
        if (ball.y > H) { lives--; ball.x = W / 2; ball.y = H - 40; ball.vx = 130; ball.vy = -170; if (lives <= 0) { running = false; reset(); } }
        bricks = bricks.filter(b => { if (ball.x > b.x && ball.x < b.x + b.w && ball.y > b.y && ball.y < b.y + b.h) { ball.vy *= -1; score += 10; return false; } return true; });
        if (!bricks.length) running = false;
      }
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      bricks.forEach(b => { ctx.fillStyle = b.c; ctx.fillRect(b.x, b.y, b.w, b.h); });
      ctx.fillStyle = "#ffb454"; ctx.fillRect(paddle - 32, H - 16, 64, 8);
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.font = "13px monospace"; ctx.fillText("ניקוד " + score + "  חיים " + lives, 8, 16);
      if (!running) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(bricks.length ? "לחץ ״שחק״" : "ניצחת! 🎉", W / 2, H / 2); ctx.textAlign = "left"; }
    };
    reset();
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: () => { if (!bricks.length) reset(); running = true; } }, "▶ שחק")));
    requestAnimationFrame(loop);
  };

  // Pong vs AI
  D.pong = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · פונג", "המשחק הראשון, מול AI", "הזז את המחבת שלך (משמאל) עם העכבר. המחשב (מימין) עוקב אחרי הכדור, אבל לא מושלם, אז אפשר לנצח. זה המשחק המסחרי הראשון בהיסטוריה (1972).");
    const W = 380, H = 240;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "פונג", style: "max-width:100%;touch-action:none" });
    const ctx = cv.getContext("2d");
    let ball, p1 = H / 2, p2 = H / 2, s1 = 0, s2 = 0;
    const reset = b => { ball = { x: W / 2, y: H / 2, vx: b ? 180 : -180, vy: (Math.random() - .5) * 160, r: 6 }; };
    cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); p1 = (e.clientY - r.top) / r.height * H; });
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.03, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y < ball.r || ball.y > H - ball.r) ball.vy *= -1;
      p2 += Math.max(-160, Math.min(160, (ball.y - p2))) * dt * 3.2;
      if (ball.x < 20 && Math.abs(ball.y - p1) < 32 && ball.vx < 0) { ball.vx *= -1.05; ball.vy += (ball.y - p1) * 2; }
      if (ball.x > W - 20 && Math.abs(ball.y - p2) < 32 && ball.vx > 0) { ball.vx *= -1.05; ball.vy += (ball.y - p2) * 2; }
      if (ball.x < 0) { s2++; reset(true); } if (ball.x > W) { s1++; reset(false); }
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#2b3a50"; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#ffb454"; ctx.fillRect(8, p1 - 30, 8, 60); ctx.fillStyle = "#7fb0ff"; ctx.fillRect(W - 16, p2 - 30, 8, 60);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fill();
      ctx.font = "bold 24px monospace"; ctx.textAlign = "center"; ctx.fillText(s1, W / 2 - 30, 30); ctx.fillText(s2, W / 2 + 30, 30); ctx.textAlign = "left";
    };
    reset(true);
    d.append(cv, el("div", { class: "note", style: "margin-top:6px" }, "אתה כתום (שמאל), המחשב כחול (ימין)."));
    requestAnimationFrame(loop);
  };

  // Connect Four vs AI
  D.connect4 = d => {
    const { el, head } = MG;
    head(d, "מעבדה · ארבע בשורה", "מול AI שחושב קדימה", "הפל דיסק לעמודה. חבר ארבעה ברצף (אופקי, אנכי או אלכסוני) לפני המחשב. ה-AI בודק כמה מהלכים קדימה (Minimax).");
    const C = 7, R = 6;
    let bd, over;
    const board = el("div", { style: `display:grid;grid-template-columns:repeat(${C},40px);gap:4px;justify-content:center;background:#1c3a6e;padding:8px;border-radius:10px` });
    const msg = el("div", { style: "text-align:center;font-weight:700;min-height:24px" });
    const reset = () => { bd = Array.from({ length: R }, () => Array(C).fill(0)); over = false; draw(); };
    const drop = (b, col, pl) => { for (let y = R - 1; y >= 0; y--) if (!b[y][col]) { b[y][col] = pl; return y; } return -1; };
    const win = b => { for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const p = b[y][x]; if (!p) continue; for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { let n = 1; for (let k = 1; k < 4; k++) { const nx = x + dx * k, ny = y + dy * k; if (nx >= 0 && ny >= 0 && nx < C && ny < R && b[ny][nx] === p) n++; else break; } if (n >= 4) return p; } } return 0; };
    const score = b => { const w = win(b); return w === 2 ? 1000 : w === 1 ? -1000 : 0; };
    const minimax = (b, depth, me, alpha, beta) => {
      const s = score(b); if (Math.abs(s) === 1000 || depth === 0 || b[0].every(c => c)) return s - (me ? depth : -depth);
      let best = me ? -1e9 : 1e9;
      for (let c = 0; c < C; c++) { if (b[0][c]) continue; const nb = b.map(r => r.slice()); drop(nb, c, me ? 2 : 1); const v = minimax(nb, depth - 1, !me, alpha, beta); if (me) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); } if (beta <= alpha) break; } return best;
    };
    const aiMove = () => { let bestC = 0, bestV = -1e9; for (let c = 0; c < C; c++) { if (bd[0][c]) continue; const nb = bd.map(r => r.slice()); drop(nb, c, 2); const v = minimax(nb, 4, false, -1e9, 1e9); if (v > bestV) { bestV = v; bestC = c; } } drop(bd, bestC, 2); };
    const play = col => { if (over || bd[0][col]) return; drop(bd, col, 1); if (win(bd)) { over = true; draw(); return; } if (bd[0].every(c => c)) { over = true; draw(); return; } aiMove(); if (win(bd)) over = true; draw(); };
    const draw = () => {
      board.innerHTML = "";
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const v = bd[y][x]; board.append(el("div", { style: `width:40px;height:40px;border-radius:50%;cursor:pointer;background:${v === 1 ? "#ffb454" : v === 2 ? "#ff5a5a" : "#0e1726"}`, onclick: () => play(x) })); }
      const w = win(bd); msg.textContent = w === 1 ? "🎉 ניצחת!" : w === 2 ? "המחשב ניצח" : bd[0].every(c => c) ? "תיקו" : "תורך (כתום)";
    };
    d.append(board, msg, el("div", { class: "row", style: "justify-content:center;margin-top:8px" }, el("button", { class: "primary", onclick: reset }, "משחק חדש")));
    reset();
  };

  // Memory match
  D.memory = d => {
    const { el, head } = MG;
    head(d, "מעבדה · משחק זיכרון", "מצא את הזוגות", "הפוך שני קלפים. אם הם זהים, הם נשארים. מצא את כל הזוגות בכמה שפחות מהלכים. ניהול מצב פשוט ונחמד.");
    const emojis = ["🎮", "🚗", "🍕", "👾", "🎧", "🌟", "🔥", "⚡"];
    let cards, flipped, matched, moves, lock;
    const grid = el("div", { style: "display:grid;grid-template-columns:repeat(4,60px);gap:6px;justify-content:center" });
    const msg = el("div", { style: "text-align:center;min-height:24px" });
    const reset = () => { cards = [...emojis, ...emojis].sort(() => Math.random() - .5); flipped = []; matched = []; moves = 0; lock = false; draw(); };
    const flip = i => {
      if (lock || flipped.includes(i) || matched.includes(i)) return;
      flipped.push(i); draw();
      if (flipped.length === 2) {
        moves++; lock = true;
        setTimeout(() => { if (cards[flipped[0]] === cards[flipped[1]]) matched.push(...flipped); flipped = []; lock = false; draw(); }, 700);
      }
    };
    const draw = () => {
      grid.innerHTML = "";
      cards.forEach((c, i) => { const show = flipped.includes(i) || matched.includes(i); grid.append(el("button", { style: `width:60px;height:60px;font-size:30px;border-radius:8px;cursor:pointer;border:1px solid #2b3a50;background:${matched.includes(i) ? "#15301f" : show ? "var(--screen-2)" : "var(--screen-ink)"}`, onclick: () => flip(i) }, show ? c : "")); });
      msg.textContent = matched.length === 16 ? `🎉 ניצחת ב-${moves} מהלכים!` : `מהלכים: ${moves}`;
    };
    d.append(grid, msg, el("div", { class: "row", style: "justify-content:center;margin-top:8px" }, el("button", { class: "primary", onclick: reset }, "משחק חדש")));
    reset();
  };

  // Flappy
  D.flappy = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · פלאפי", "לחיצה = קפיצה", "לחץ על המסך (או רווח) כדי לעוף. עבור בין הצינורות. כוח משיכה קבוע מושך למטה, כל לחיצה נותנת דחיפה למעלה. משחק פשוט שהפך לתופעה.");
    const W = 300, H = 300;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "פלאפי", style: "max-width:100%;cursor:pointer" });
    const ctx = cv.getContext("2d");
    let y, vy, pipes, score, over, running = false;
    const reset = () => { y = H / 2; vy = 0; pipes = [{ x: W, gap: 120 + Math.random() * 80 }]; score = 0; over = false; };
    const flap = () => { if (over) { reset(); running = true; } else vy = -240; };
    cv.addEventListener("pointerdown", flap);
    key(d, { " ": flap });
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.03, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      if (running && !over) {
        vy += 700 * dt; y += vy * dt;
        pipes.forEach(p => p.x -= 120 * dt);
        if (pipes[pipes.length - 1].x < W - 160) pipes.push({ x: W, gap: 90 + Math.random() * 100 });
        pipes = pipes.filter(p => p.x > -50);
        pipes.forEach(p => { if (!p.passed && p.x < 60) { p.passed = true; score++; } if (p.x < 80 && p.x > 20 && (y < p.gap - 45 || y > p.gap + 45)) over = true; });
        if (y > H - 10 || y < 0) over = true;
      }
      ctx.fillStyle = "#1b2d4f"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#5fd08f"; pipes.forEach(p => { ctx.fillRect(p.x, 0, 40, p.gap - 45); ctx.fillRect(p.x, p.gap + 45, 40, H); });
      ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(50, y, 12, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 24px monospace"; ctx.textAlign = "center"; ctx.fillText(score, W / 2, 36);
      if (!running || over) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif"; ctx.fillText(over ? "לחץ לשחק שוב" : "לחץ כדי להתחיל", W / 2, H / 2); } ctx.textAlign = "left";
    };
    reset();
    d.append(cv, el("div", { class: "note", style: "margin-top:6px" }, "לחץ על המסך או על רווח."));
    requestAnimationFrame(loop);
  };

  // Lights Out
  D.lightsout = d => {
    const { el, head } = MG;
    head(d, "מעבדה · Lights Out", "כבה את כל האורות", "לחיצה על תא הופכת אותו ואת השכנים שלו. כבה את כל האורות. חידה שמאחוריה מסתתרת אלגברה (ואפשר לפתור אותה במטריצות!).");
    const N = 5;
    let g;
    const grid = el("div", { style: `display:grid;grid-template-columns:repeat(${N},48px);gap:4px;justify-content:center` });
    const msg = el("div", { style: "text-align:center;min-height:24px;font-weight:700" });
    const toggle = (x, y) => { [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N) g[ny][nx] ^= 1; }); };
    const reset = () => { g = Array.from({ length: N }, () => Array(N).fill(0)); for (let i = 0; i < 8; i++) toggle(Math.floor(Math.random() * N), Math.floor(Math.random() * N)); draw(); };
    const draw = () => {
      grid.innerHTML = "";
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) grid.append(el("button", { style: `width:48px;height:48px;border-radius:8px;cursor:pointer;border:1px solid #2b3a50;background:${g[y][x] ? "#ffd84a" : "#1a2330"};box-shadow:${g[y][x] ? "0 0 12px #ffd84a" : "none"}`, onclick: () => { toggle(x, y); draw(); } }));
      msg.textContent = g.flat().some(v => v) ? "אורות דולקים: " + g.flat().filter(v => v).length : "🎉 כל האורות כבויים!";
    };
    d.append(grid, msg, el("div", { class: "row", style: "justify-content:center;margin-top:8px" }, el("button", { class: "primary", onclick: reset }, "חידה חדשה")));
    reset();
  };

  // Simon
  D.simon = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · סיימון", "חזור על הרצף", "המשחק מראה רצף צבעים, ואתה חוזר עליו. בכל סבב הרצף מתארך. עד לאן הזיכרון שלך מגיע?");
    const colors = [["#ff5a5a", 0], ["#5fd08f", 1], ["#6aa2ff", 2], ["#ffd84a", 3]];
    let seq, idx, playing, best = 0;
    const pads = el("div", { style: "display:grid;grid-template-columns:repeat(2,80px);gap:8px;justify-content:center" });
    const msg = el("div", { style: "text-align:center;min-height:24px;font-weight:700" });
    const btns = [];
    const flash = async i => { btns[i].style.opacity = "1"; btns[i].style.boxShadow = "0 0 20px " + colors[i][0]; await sleep(350); btns[i].style.opacity = ".45"; btns[i].style.boxShadow = "none"; await sleep(150); };
    const show = async () => { playing = false; msg.textContent = "צפה..."; for (const i of seq) await flash(i); playing = true; idx = 0; msg.textContent = "תורך! (רצף באורך " + seq.length + ")"; };
    const start = () => { seq = [Math.floor(Math.random() * 4)]; show(); };
    const press = async i => { if (!playing) return; await flash(i); if (i === seq[idx]) { idx++; if (idx === seq.length) { best = Math.max(best, seq.length); seq.push(Math.floor(Math.random() * 4)); msg.textContent = "יפה! ממשיכים..."; setTimeout(show, 600); } } else { playing = false; msg.textContent = `טעות! הגעת לרצף ${seq.length - 1}. שיא: ${best}`; } };
    colors.forEach(([c, i]) => { const b = el("button", { style: `width:80px;height:80px;border-radius:12px;background:${c};opacity:.45;border:none;cursor:pointer`, "aria-label": "צבע " + i, onclick: () => press(i) }); btns[i] = b; pads.append(b); });
    d.append(pads, msg, el("div", { class: "row", style: "justify-content:center;margin-top:8px" }, el("button", { class: "primary", onclick: start }, "התחל")));
  };

  // Starfield
  D.starfield = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · שדה כוכבים", "אשליית עומק מפרספקטיבה", "כוכבים ״טסים״ לעברך. כל כוכב הוא נקודה תלת-ממדית שמוטלת על המסך עם חלוקה ב-z, בדיוק כמו בפרק התלת-ממד. ככל שכוכב קרוב, הוא מהיר וגדול יותר.");
    const W = 360, H = 240;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "כוכבים", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    const speed = el("input", { type: "range", min: "1", max: "12", value: "4", id: "sf-s", "aria-label": "מהירות" });
    const stars = Array.from({ length: 320 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    const loop = () => {
      requestAnimationFrame(loop);
      if (!visible(d)) return;
      ctx.fillStyle = "rgba(5,8,12,.35)"; ctx.fillRect(0, 0, W, H);
      stars.forEach(s => {
        s.z -= +speed.value / 1000; if (s.z <= 0.01) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; }
        const sx = W / 2 + s.x / s.z * W / 2, sy = H / 2 + s.y / s.z * H / 2, r = (1 - s.z) * 2.5;
        ctx.fillStyle = "#fff"; ctx.globalAlpha = 1 - s.z; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    d.append(cv, el("label", { style: "margin-top:8px" }, "מהירות (מהירות אור)", speed));
    requestAnimationFrame(loop);
  };

  // Matrix rain
  D.matrix = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · ״גשם״ של קוד", "האפקט מהסרט Matrix", "עמודות של תווים שנופלים. אפקט קלאסי שנבנה בכמה שורות: לכל עמודה יש ״טיפה״ שיורדת, ומאחוריה שובל דוהה.");
    const W = 360, H = 240, FS = 14, cols = Math.floor(W / FS);
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "מטריקס", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    const drops = Array(cols).fill(0);
    const chars = "アイウエオカ01ﾊﾐﾋｰｳ日本語ABCDEF<>{}/*-+";
    let t = 0;
    const loop = () => {
      requestAnimationFrame(loop);
      if (!visible(d)) return;
      t++; if (t % 2) return;
      ctx.fillStyle = "rgba(5,8,12,.08)"; ctx.fillRect(0, 0, W, H);
      ctx.font = FS + "px monospace";
      drops.forEach((y, i) => { const ch = chars[Math.floor(Math.random() * chars.length)]; ctx.fillStyle = "#c8ffd0"; ctx.fillText(ch, i * FS, y * FS); ctx.fillStyle = "#2ecc71"; ctx.fillText(ch, i * FS, (y - 1) * FS); if (y * FS > H && Math.random() > 0.975) drops[i] = 0; drops[i]++; });
    };
    d.append(cv, el("div", { class: "note", style: "margin-top:6px" }, "כל עמודה עצמאית. ה״ראש״ הבהיר, השובל ירוק כהה, והרקע דוהה לאט."));
    requestAnimationFrame(loop);
  };

  // Mode 7 pseudo-3D road
  D.mode7 = d => {
    const { el, head, visible, makeInput } = MG;
    head(d, "מעבדה · כביש בפרספקטיבה", "התלת-ממד של מרוצים ישנים (Mode 7)", "◀ ▶ לנהוג. אין כאן תלת-ממד אמיתי: כל שורת פיקסלים על המסך מייצגת מרחק, ונמתחת לפי פרספקטיבה. ככה נראו מרוצים על סופר-נינטנדו.");
    const W = 340, H = 200;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "כביש", style: "max-width:100%" });
    const ctx = cv.getContext("2d");
    const input = makeInput(d); input.setActive(true);
    let pos = 0, curve = 0, targetCurve = 0, last = 0, seg = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      pos += 90 * dt; seg += dt;
      if (seg > 2) { seg = 0; targetCurve = (Math.random() - .5) * 3; }
      curve += (targetCurve - curve) * dt;
      const steer = ((input.keys.has("r") ? 1 : 0) - (input.keys.has("l") ? 1 : 0));
      const img = ctx.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        if (y < H / 2) { // sky
          for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; img.data[k] = 30 + y; img.data[k + 1] = 60 + y; img.data[k + 2] = 110 + y; img.data[k + 3] = 255; }
          continue;
        }
        const p = (y - H / 2) / (H / 2);
        const z = 1 / p, world = pos + z * 40;
        const shade = (Math.floor(world / 20) % 2) ? 1 : 0.85;
        const roadCenter = W / 2 + Math.sin(world / 60) * curve * 40 * p - steer * 40 * p;
        const roadW = 40 + p * 220;
        for (let x = 0; x < W; x++) {
          const k = (y * W + x) * 4;
          let r, g, bl;
          if (Math.abs(x - roadCenter) < roadW / 2) { const stripe = Math.abs(x - roadCenter) < 4 && (Math.floor(world / 10) % 2); r = stripe ? 240 : 60 * shade; g = stripe ? 240 : 60 * shade; bl = stripe ? 240 : 65 * shade; }
          else { r = 30 * shade; g = 110 * shade; bl = 40 * shade; }
          img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = bl; img.data[k + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = "#ff5a5a"; ctx.fillRect(W / 2 - 16, H - 30, 32, 18);
    };
    d.append(cv, el("div", { class: "row", style: "margin-top:8px;justify-content:flex-end" }, input.pad));
    requestAnimationFrame(loop);
  };

  // Analog clock
  D.clock = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · שעון אנלוגי", "sin ו-cos בפעולה", "כל מחוג הוא sin/cos של הזווית המתאימה לזמן. תזכורת יפה לפרק המתמטיקה: כל דבר שמסתובב בנוי מ-sin ו-cos.");
    const S = 200;
    const cv = el("canvas", { width: String(S), height: String(S), "aria-label": "שעון" });
    const ctx = cv.getContext("2d");
    const loop = () => {
      requestAnimationFrame(loop);
      if (!visible(d)) return;
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, S, S);
      const cx = S / 2, cy = S / 2, R = 85;
      ctx.strokeStyle = "#2b3a50"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * 7 - Math.PI / 2; ctx.fillStyle = "#7d8fa6"; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10), 2, 0, 7); ctx.fill(); }
      const now = new Date(), ms = now.getMilliseconds() / 1000;
      const hand = (frac, len, w, col) => { const a = frac * Math.PI * 2 - Math.PI / 2; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke(); };
      hand((now.getHours() % 12 + now.getMinutes() / 60) / 12, 45, 5, "#d9e6f2");
      hand((now.getMinutes() + now.getSeconds() / 60) / 60, 65, 3, "#7fb0ff");
      hand((now.getSeconds() + ms) / 60, 72, 1.5, "#ff5a5a");
      ctx.fillStyle = "#ffb454"; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
    };
    d.append(cv);
    requestAnimationFrame(loop);
  };

  // Fireworks
  D.fireworks = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · זיקוקים", "לחץ לירות", "לחץ בכל מקום כדי לשגר זיקוק. כל פיצוץ הוא עשרות חלקיקים עם מהירות, כוח משיכה וצבע דוהה. תרגיל נחמד במערכת חלקיקים.");
    const W = 360, H = 260;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "זיקוקים", style: "max-width:100%;cursor:pointer" });
    const ctx = cv.getContext("2d");
    let parts = [], rockets = [];
    const launch = (tx, ty) => rockets.push({ x: tx, y: H, ty, vy: -Math.sqrt((H - ty) * 2 * 300) / 10 });
    cv.addEventListener("pointerdown", e => { const r = cv.getBoundingClientRect(); launch((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); });
    const burst = (x, y) => { const hue = Math.random() * 360; for (let i = 0; i < 60; i++) { const a = Math.random() * 7, s = Math.random() * 120 + 20; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: `hsl(${hue},90%,${50 + Math.random() * 30}%)` }); } };
    let last = 0, t = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.04, (now - last) / 1000 || 0); last = now; t += dt;
      if (!visible(d)) return;
      if (t > 1.1) { t = 0; launch(Math.random() * W, Math.random() * H / 2 + 30); }
      ctx.fillStyle = "rgba(5,8,12,.25)"; ctx.fillRect(0, 0, W, H);
      rockets = rockets.filter(r => { r.vy += 300 * dt; r.y += r.vy * dt; ctx.fillStyle = "#ffd84a"; ctx.fillRect(r.x, r.y, 2, 4); if (r.y <= r.ty || r.vy >= 0) { burst(r.x, r.y); return false; } return true; });
      parts = parts.filter(p => { p.life -= dt * 0.9; p.vy += 90 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) return false; ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); return true; });
      ctx.globalAlpha = 1;
    };
    d.append(cv, el("div", { class: "note", style: "margin-top:6px" }, "לחץ על המסך לשגר זיקוק משלך."));
    requestAnimationFrame(loop);
  };
})();

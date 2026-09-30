// Demos: game physics, game feel, sound, AI for NPCs, procedural worlds, raycasting, shaders, open-world tech
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- Projectile ---------------- */
  D.projectile = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · זריקה בליסטית", "קלע למטרה (כמו Angry Birds)", "כוון את הזווית והכוח ולחץ ״ירה״. בכל פריים: המהירות האופקית נשארת (חוץ מרוח), והמהירות האנכית יורדת בגלל כוח המשיכה. נסה על הירח או על צדק!");
    const W = 480, H = 280, G0 = 250, SC = 0.8;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "זריקה" });
    const ctx = cv.getContext("2d");
    const ang = el("input", { type: "range", min: "5", max: "85", value: "45", id: "pj-a", "aria-label": "זווית" });
    const pow = el("input", { type: "range", min: "10", max: "75", value: "45", id: "pj-p", "aria-label": "כוח" });
    const wind = el("input", { type: "range", min: "-6", max: "6", step: "0.5", value: "0", id: "pj-w", "aria-label": "רוח" });
    const grav = el("select", { id: "pj-g", "aria-label": "כוכב" }, ...[["9.8", "כדור הארץ (9.8)"], ["1.6", "הירח (1.6)"], ["3.7", "מאדים (3.7)"], ["24.8", "צדק (24.8)"]].map(([v, t]) => el("option", { value: v }, t)));
    const lab = el("div", { class: "note ltr", style: "font-variant-numeric:tabular-nums" });
    const msg = el("div", { style: "font-weight:700;min-height:24px" });
    let shot = null, trails = [], target = rand(220, 440), hits = 0, shots = 0;
    const fire = () => {
      const a = +ang.value * Math.PI / 180, v = +pow.value;
      shot = { x: 0, y: 0, vx: v * Math.cos(a), vy: v * Math.sin(a), t: 0, path: [] };
      shots++; msg.textContent = "";
    };
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000 || 0) * 2; last = now;
      if (!visible(d)) return;
      if (shot) {
        const g = +grav.value;
        for (let k = 0; k < 4; k++) {
          const h = dt / 4;
          shot.vx += +wind.value * h; shot.vy -= g * h;
          shot.x += shot.vx * h; shot.y += shot.vy * h; shot.t += h;
          shot.path.push([shot.x, shot.y]);
          if (shot.y < 0) {
            const px = 40 + shot.x * SC;
            const hit = px > target - 18 && px < target + 18;
            msg.textContent = hit ? `פגיעה! 🎯 טווח ${shot.x.toFixed(0)} מ׳, זמן באוויר ${shot.t.toFixed(1)} שנ׳` : `פספסת ב-${Math.abs(px - target).toFixed(0)} פיקסלים ${px < target ? "(קצר מדי)" : "(ארוך מדי)"}`;
            if (hit) { hits++; target = rand(160, 450); }
            trails.push(shot.path); if (trails.length > 4) trails.shift();
            shot = null; break;
          }
        }
      }
      ctx.fillStyle = "#0b1422"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#1c2b1c"; ctx.fillRect(0, G0, W, H - G0);
      ctx.fillStyle = "#ff6b6b"; ctx.fillRect(target - 18, G0 - 6, 36, 6); ctx.fillStyle = "#fff"; ctx.fillRect(target - 6, G0 - 6, 12, 6);
      const a = +ang.value * Math.PI / 180;
      ctx.strokeStyle = "#ffb454"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(40, G0); ctx.lineTo(40 + Math.cos(a) * 30, G0 - Math.sin(a) * 30); ctx.stroke(); ctx.lineWidth = 1;
      trails.forEach((p, i) => { ctx.strokeStyle = `rgba(127,176,255,${.15 + i * .1})`; ctx.beginPath(); p.forEach(([x, y], k) => k ? ctx.lineTo(40 + x * SC, G0 - y * SC) : ctx.moveTo(40 + x * SC, G0 - y * SC)); ctx.stroke(); });
      if (shot) {
        ctx.strokeStyle = "#7fb0ff"; ctx.beginPath(); shot.path.forEach(([x, y], k) => k ? ctx.lineTo(40 + x * SC, G0 - y * SC) : ctx.moveTo(40 + x * SC, G0 - y * SC)); ctx.stroke();
        const px = 40 + shot.x * SC, py = G0 - shot.y * SC;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
        ctx.strokeStyle = "#5fd08f"; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + shot.vx * .6, py); ctx.stroke();
        ctx.strokeStyle = "#ff6b6b"; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - shot.vy * .6); ctx.stroke();
        lab.textContent = `vx = ${shot.vx.toFixed(1)} m/s   vy = ${shot.vy.toFixed(1)} m/s   x = ${shot.x.toFixed(0)} m   y = ${shot.y.toFixed(0)} m   t = ${shot.t.toFixed(2)} s`;
      } else lab.textContent = `angle ${ang.value}°  power ${pow.value} m/s  gravity ${grav.value} m/s²  wind ${wind.value}   ·   hits ${hits}/${shots}`;
      if (+wind.value) { ctx.fillStyle = "#7d8fa6"; ctx.font = "12px monospace"; ctx.fillText((+wind.value > 0 ? "רוח →" : "← רוח") + " " + Math.abs(+wind.value), W - 80, 20); }
    };
    d.append(cv, el("div", { class: "grid2", style: "margin-top:8px" }, el("label", {}, "זווית", ang), el("label", {}, "כוח (מהירות התחלתית)", pow), el("label", {}, "רוח", wind), el("label", {}, "כוח משיכה", grav)),
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: fire }, "🚀 ירה"), msg), lab,
      el("div", { class: "note" }, "ירוק = מהירות אופקית, אדום = מהירות אנכית. שים לב שהאדום מתכווץ, מתהפך וגדל כלפי מטה."));
    requestAnimationFrame(loop);
  };

  /* ---------------- Bouncing balls ---------------- */
  D.balls = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · מנוע פיזיקה קטן", "כדורים שקופצים ומתנגשים", "לחץ על הקנבס כדי להוסיף כדורים. שנה את כוח המשיכה, את הקפיציות ואת החיכוך. זה מנוע פיזיקה אמיתי בקטן: בכל פריים מזיזים, בודקים התנגשויות עם קירות ובין כדורים, ומחשבים את ההתנגשות לפי שימור תנע.");
    const W = 480, H = 280;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "כדורים" });
    const ctx = cv.getContext("2d");
    const g = el("input", { type: "range", min: "0", max: "1500", value: "600", id: "bl-g", "aria-label": "כוח משיכה" });
    const e = el("input", { type: "range", min: "0.1", max: "1", step: "0.05", value: "0.8", id: "bl-e", "aria-label": "קפיציות" });
    const f = el("input", { type: "range", min: "0", max: "2", step: "0.05", value: "0.1", id: "bl-f", "aria-label": "חיכוך אוויר" });
    const info = el("div", { class: "note ltr" });
    let balls = [];
    const add = (x, y) => { const r = rand(8, 22); balls.push({ x, y, vx: rand(-200, 200), vy: rand(-250, 0), r, m: r * r, c: `hsl(${rand(0, 360)},75%,62%)` }); };
    for (let i = 0; i < 12; i++) add(rand(40, W - 40), rand(30, 150));
    cv.addEventListener("pointerdown", ev => { const r = cv.getBoundingClientRect(); add((ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H); });
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.03, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      const E = +e.value, F = +f.value;
      balls.forEach(b => {
        b.vy += +g.value * dt; b.vx *= 1 - F * dt; b.vy *= 1 - F * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * E; } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * E; }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * E; } if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * E; b.vx *= 1 - .6 * dt; }
      });
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), min = a.r + b.r;
        if (dist > 0 && dist < min) {
          const nx = dx / dist, ny = dy / dist, over = (min - dist) / 2;
          a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) { const imp = -(1 + E) * rel / (1 / a.m + 1 / b.m); a.vx -= imp / a.m * nx; a.vy -= imp / a.m * ny; b.vx += imp / b.m * nx; b.vy += imp / b.m * ny; }
        }
      }
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      let ke = 0;
      balls.forEach(b => { ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ke += .5 * b.m * (b.vx ** 2 + b.vy ** 2); });
      info.textContent = `balls ${balls.length}   collision checks per frame ${balls.length * (balls.length - 1) / 2}   kinetic energy ${(ke / 1e6).toFixed(1)}M`;
    };
    d.append(cv, el("div", { class: "grid2", style: "margin-top:8px" }, el("label", {}, "כוח משיכה", g), el("label", {}, "קפיציות (restitution)", e), el("label", {}, "התנגדות אוויר", f)),
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { onclick: () => { for (let i = 0; i < 10; i++) add(rand(40, W - 40), rand(20, 80)); } }, "+10 כדורים"), el("button", { onclick: () => { balls = []; } }, "נקה"),
        el("button", { onclick: () => balls.forEach(b => { b.vy -= rand(300, 700); b.vx += rand(-200, 200); }) }, "💥 פיצוץ")), info);
    requestAnimationFrame(loop);
  };

  /* ---------------- Platformer: game feel lab ---------------- */
  D.platformer = d => {
    const { el, head, visible, makeInput } = MG;
    head(d, "מעבדה · תחושת משחק", "בנה את הקפיצה המושלמת", "חיצים או הכפתורים: ◀ ▶ לרוץ, ▲ לקפוץ. שחק עם ההגדרות וכבה/הדלק את ״הטריקים הסודיים״ שמשחקים כמו Celeste משתמשים בהם. תרגיש כמה הם משנים.");
    const T = 16, CW = 30, CH = 15, W = CW * T, H = CH * T;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "משחק פלטפורמה" });
    const ctx = cv.getContext("2d");
    const input = makeInput(d);
    const map = Array.from({ length: CH }, () => Array(CW).fill(0));
    for (let x = 0; x < CW; x++) { map[CH - 1][x] = (x >= 9 && x <= 10) || (x >= 20 && x <= 22) ? 0 : 1; map[CH - 2][x] = map[CH - 1][x]; }
    for (let y = 0; y < CH; y++) { map[y][0] = 1; map[y][CW - 1] = 1; }
    [[4, 10, 4], [11, 8, 4], [17, 6, 3], [23, 9, 4], [13, 11, 2], [26, 5, 2]].forEach(([x, y, w]) => { for (let i = 0; i < w; i++) map[y][x + i] = 1; });
    const coinsInit = [[5.5, 9], [12.5, 7], [18, 5], [24.5, 8], [27, 4], [9.5, 11]];
    const S = { g: 1400, jump: 430, speed: 170, accel: 1800, coyote: true, buffer: true, varjump: true, parts: true, shake: true, squash: true };
    const sliders = [["g", "כוח משיכה", 400, 3000, 50], ["jump", "כוח קפיצה", 200, 700, 10], ["speed", "מהירות ריצה", 60, 320, 5], ["accel", "תאוצה (אחיזה)", 200, 5000, 50]].map(([k, t, mn, mx, st]) => {
      const s = el("input", { type: "range", min: String(mn), max: String(mx), step: String(st), value: String(S[k]), id: "pf-" + k, "aria-label": t });
      s.oninput = () => { S[k] = +s.value; };
      return el("label", {}, t, s);
    });
    const toggles = [["coyote", "זמן קויוטי"], ["buffer", "זיכרון קפיצה"], ["varjump", "קפיצה לפי לחיצה"], ["parts", "חלקיקים"], ["shake", "רעידת מסך"], ["squash", "מעיכה ומתיחה"]].map(([k, t]) => {
      const b = el("button", { class: S[k] ? "on" : "" }, t);
      b.onclick = () => { S[k] = !S[k]; b.classList.toggle("on", S[k]); };
      return b;
    });
    const hud = el("div", { class: "note ltr" });
    let P, coins, parts = [], shake = 0, prevU = false, lastGround = 0, lastJumpPress = -1, t = 0, cut = false, started = false;
    const reset = () => { P = { x: 40, y: 150, w: 12, h: 16, vx: 0, vy: 0, ground: false, sx: 1, sy: 1 }; coins = coinsInit.map(c => ({ x: c[0] * T, y: c[1] * T, got: false })); };
    const solid = (px, py) => { const tx = Math.floor(px / T), ty = Math.floor(py / T); return ty >= 0 && ty < CH && tx >= 0 && tx < CW && map[ty][tx] === 1; };
    const burst = (x, y, n, c) => { if (!S.parts) return; for (let i = 0; i < n; i++) parts.push({ x, y, vx: rand(-80, 80), vy: rand(-120, -10), life: rand(.25, .5), c }); };
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      t += dt;
      const k = input.keys;
      const dir = (k.has("r") ? 1 : 0) - (k.has("l") ? 1 : 0);
      const target = dir * S.speed, a = (P.ground ? S.accel : S.accel * .6) * dt;
      P.vx = P.vx < target ? Math.min(target, P.vx + a) : Math.max(target, P.vx - a);
      const u = k.has("u");
      if (u && !prevU) { lastJumpPress = t; cut = false; }
      if (!u && prevU && S.varjump && P.vy < 0 && !cut) { P.vy *= .45; cut = true; }
      prevU = u;
      const canJump = P.ground || (S.coyote && t - lastGround < .11);
      const wants = lastJumpPress >= 0 && (S.buffer ? t - lastJumpPress < .13 : t - lastJumpPress < dt * 1.5);
      if (canJump && wants) { P.vy = -S.jump; P.ground = false; lastGround = -1; lastJumpPress = -1; burst(P.x + P.w / 2, P.y + P.h, 8, "#d9e6f2"); if (S.squash) { P.sx = .7; P.sy = 1.35; } }
      P.vy = Math.min(900, P.vy + S.g * dt);
      // x
      P.x += P.vx * dt;
      if (P.vx > 0 && (solid(P.x + P.w, P.y + 1) || solid(P.x + P.w, P.y + P.h - 1))) { P.x = Math.floor((P.x + P.w) / T) * T - P.w - .01; P.vx = 0; }
      if (P.vx < 0 && (solid(P.x, P.y + 1) || solid(P.x, P.y + P.h - 1))) { P.x = Math.floor(P.x / T + 1) * T + .01; P.vx = 0; }
      // y
      const wasGround = P.ground, vyBefore = P.vy;
      P.y += P.vy * dt; P.ground = false;
      if (P.vy > 0 && (solid(P.x + 1, P.y + P.h) || solid(P.x + P.w - 1, P.y + P.h))) { P.y = Math.floor((P.y + P.h) / T) * T - P.h; P.vy = 0; P.ground = true; }
      if (P.vy < 0 && (solid(P.x + 1, P.y) || solid(P.x + P.w - 1, P.y))) { P.y = Math.floor(P.y / T + 1) * T; P.vy = 0; }
      if (P.ground) lastGround = t;
      if (P.ground && !wasGround) { if (vyBefore > 500) { burst(P.x + P.w / 2, P.y + P.h, 10, "#d9e6f2"); if (S.shake) shake = Math.min(8, vyBefore / 120); } if (S.squash) { P.sx = 1.35; P.sy = .7; } }
      if (P.y > H + 40) reset();
      P.sx += (1 - P.sx) * Math.min(1, dt * 12); P.sy += (1 - P.sy) * Math.min(1, dt * 12);
      coins.forEach(c => { if (!c.got && Math.abs(P.x + P.w / 2 - c.x) < 12 && Math.abs(P.y + P.h / 2 - c.y) < 14) { c.got = true; burst(c.x, c.y, 14, "#ffd84a"); } });
      parts = parts.filter(p => (p.life -= dt) > 0); parts.forEach(p => { p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
      shake *= Math.pow(.02, dt);
      // draw
      ctx.save();
      ctx.fillStyle = "#0e1726"; ctx.fillRect(0, 0, W, H);
      if (shake > .2) ctx.translate(rand(-shake, shake), rand(-shake, shake));
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (map[y][x]) { ctx.fillStyle = y > 0 && map[y - 1][x] ? "#3a2f28" : "#4f7a3a"; ctx.fillRect(x * T, y * T, T, T); if (!(y > 0 && map[y - 1][x])) { ctx.fillStyle = "#3a2f28"; ctx.fillRect(x * T, y * T + 5, T, T - 5); } }
      coins.forEach(c => { if (c.got) return; ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.ellipse(c.x, c.y + Math.sin(t * 4 + c.x) * 2, 4 + Math.abs(Math.sin(t * 3)) * 2, 6, 0, 0, 7); ctx.fill(); });
      parts.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.c; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }); ctx.globalAlpha = 1;
      const cw = P.w * P.sx, ch = P.h * P.sy;
      ctx.fillStyle = "#ffb454"; ctx.fillRect(P.x + P.w / 2 - cw / 2, P.y + P.h - ch, cw, ch);
      ctx.fillStyle = "#1d1204"; const fx = P.vx >= 0 ? 3 : -3; ctx.fillRect(P.x + P.w / 2 + fx - 1, P.y + P.h - ch + 4, 3, 3);
      ctx.restore();
      if (!started) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("לחץ ״▶ שחק״ כדי להתחיל", W / 2, H / 2); ctx.textAlign = "left"; }
      hud.textContent = `vx ${P.vx.toFixed(0)}  vy ${P.vy.toFixed(0)}  grounded ${P.ground}  coins ${coins.filter(c => c.got).length}/${coins.length}`;
    };
    reset();
    d.append(cv, el("div", { class: "row", style: "margin-top:8px;justify-content:space-between" }, el("div", { class: "row" }, el("button", { class: "primary", onclick: () => { started = true; input.setActive(true); reset(); } }, "▶ שחק"), el("button", { onclick: reset }, "↻ התחל שוב")), input.pad),
      el("div", { class: "grid2" }, ...sliders), el("div", { class: "note", style: "margin-top:6px" }, "הטריקים הסודיים (לחץ כדי לכבות ולהדליק):"), el("div", { class: "row" }, ...toggles), hud);
    requestAnimationFrame(loop);
  };

  /* ---------------- Snake (guided project) ---------------- */
  D.snake = d => {
    const { el, head, visible, makeInput, store } = MG;
    head(d, "פרויקט · סנייק", "המשחק שתבנה בעצמך", "חיצים, WASD או הכפתורים. אכול את התפוחים, אל תתנגש בעצמך ובקירות. זה המשחק המלא שהקוד שלו מוסבר בפרק, צעד אחרי צעד.");
    const C = 24, R = 16, S = 20;
    const cv = el("canvas", { width: String(C * S), height: String(R * S), "aria-label": "סנייק" });
    const ctx = cv.getContext("2d");
    const input = makeInput(d);
    const hud = el("div", { class: "note ltr" });
    let snake, dirQ, dir, food, score, over, running = false, acc = 0, best = store.get("snakeBest", 0);
    const reset = () => { snake = [[8, 8], [7, 8], [6, 8]]; dir = [1, 0]; dirQ = []; score = 0; over = false; placeFood(); };
    const placeFood = () => { do { food = [(Math.random() * C) | 0, (Math.random() * R) | 0]; } while (snake.some(([x, y]) => x === food[0] && y === food[1])); };
    const map = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
    let prevKeys = new Set();
    const tick = () => {
      if (dirQ.length) dir = dirQ.shift();
      const h = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= C || h[1] >= R || snake.some(([x, y]) => x === h[0] && y === h[1])) { over = true; running = false; if (score > best) { best = score; store.set("snakeBest", best); } return; }
      snake.unshift(h);
      if (h[0] === food[0] && h[1] === food[1]) { score++; placeFood(); } else snake.pop();
    };
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.1, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      input.keys.forEach(k => { if (!prevKeys.has(k)) { const nd = map[k], ld = dirQ.length ? dirQ[dirQ.length - 1] : dir; if (nd && !(nd[0] === -ld[0] && nd[1] === -ld[1]) && dirQ.length < 3) dirQ.push(nd); } });
      prevKeys = new Set(input.keys);
      if (running) { acc += dt; const step = Math.max(.055, .14 - score * .004); while (acc > step) { acc -= step; tick(); } }
      ctx.fillStyle = "#0b1a10"; ctx.fillRect(0, 0, C * S, R * S);
      ctx.fillStyle = "#0f2216"; for (let y = 0; y < R; y++) for (let x = (y % 2); x < C; x += 2) ctx.fillRect(x * S, y * S, S, S);
      ctx.fillStyle = "#ff5a5a"; ctx.beginPath(); ctx.arc(food[0] * S + S / 2, food[1] * S + S / 2, S / 2 - 3, 0, 7); ctx.fill();
      snake.forEach(([x, y], i) => { ctx.fillStyle = i ? `hsl(140,60%,${55 - i * 1.2}%)` : "#8ff0b5"; ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2); });
      if (!running) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, 0, C * S, R * S); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 22px sans-serif"; ctx.fillText(over ? "Game Over · " + score : "סנייק", C * S / 2, R * S / 2 - 6); ctx.font = "14px sans-serif"; ctx.fillText("לחץ ״▶ שחק״", C * S / 2, R * S / 2 + 18); ctx.textAlign = "left"; }
      hud.textContent = `score ${score}   length ${snake.length}   best ${best}`;
    };
    reset();
    d.append(cv, el("div", { class: "row", style: "margin-top:8px;justify-content:space-between" }, el("button", { class: "primary", onclick: () => { reset(); running = true; input.setActive(true); } }, "▶ שחק"), input.pad), hud);
    requestAnimationFrame(loop);
  };

  /* ---------------- Particle system ---------------- */
  D.particles = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · מערכת חלקיקים", "אש, עשן, פיצוצים וקסמים", "כל אפקט כזה במשחק הוא מאות נקודות קטנות: לכל אחת מיקום, מהירות, זמן חיים, גודל וצבע שמשתנים. גרור על הקנבס כדי להזיז את המקור, ובחר אפקט או שחק עם המספרים.");
    const W = 480, H = 280;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "חלקיקים" });
    const ctx = cv.getContext("2d");
    const PRE = {
      "אש": { rate: 180, speed: 70, spread: 25, dir: -90, grav: -60, life: 1.1, size: 14, c1: [255, 200, 60], c2: [200, 30, 10], add: true },
      "עשן": { rate: 40, speed: 40, spread: 30, dir: -90, grav: -20, life: 3, size: 26, c1: [120, 120, 130], c2: [40, 40, 50], add: false },
      "ניצוצות": { rate: 120, speed: 260, spread: 70, dir: -90, grav: 500, life: 1.2, size: 3, c1: [255, 240, 150], c2: [255, 100, 0], add: true },
      "קסם": { rate: 90, speed: 60, spread: 180, dir: -90, grav: -30, life: 1.6, size: 6, c1: [140, 200, 255], c2: [200, 80, 255], add: true },
      "גשם": { rate: 300, speed: 500, spread: 4, dir: 100, grav: 300, life: 1, size: 2, c1: [160, 190, 255], c2: [120, 150, 220], add: false, wide: true },
    };
    let P = { ...PRE["אש"] }, parts = [], src = [W / 2, H - 40], acc = 0;
    const sel = el("select", { id: "pt-pre", "aria-label": "אפקט" }, ...Object.keys(PRE).map(k => el("option", { value: k }, k)));
    const sl = [["rate", "כמות לשנייה", 0, 500, 5], ["speed", "מהירות", 0, 600, 5], ["spread", "פיזור (מעלות)", 0, 180, 1], ["grav", "כוח משיכה", -300, 800, 10], ["life", "זמן חיים", .2, 4, .1], ["size", "גודל", 1, 40, 1]];
    const sliders = sl.map(([k, t, mn, mx, st]) => { const s = el("input", { type: "range", min: String(mn), max: String(mx), step: String(st), value: String(P[k]), id: "pt-" + k, "aria-label": t }); s.oninput = () => { P[k] = +s.value; }; return [k, s, el("label", {}, t, s)]; });
    sel.onchange = () => { P = { ...PRE[sel.value] }; sliders.forEach(([k, s]) => { s.value = String(P[k]); }); };
    const spawn = (n, burst) => {
      for (let i = 0; i < n; i++) {
        const a = (P.dir + rand(-P.spread, P.spread)) * Math.PI / 180, sp = burst ? rand(100, 420) : P.speed * rand(.6, 1.2);
        parts.push({ x: P.wide ? rand(0, W) : src[0] + rand(-4, 4), y: P.wide ? -10 : src[1], vx: Math.cos(burst ? rand(0, 7) : a) * sp, vy: Math.sin(burst ? rand(0, 7) : a) * sp, life: 0, max: P.life * rand(.7, 1.1) });
      }
    };
    let drag = false;
    const pos = e => { const r = cv.getBoundingClientRect(); src = [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", e => { drag = true; cv.setPointerCapture(e.pointerId); pos(e); });
    cv.addEventListener("pointermove", e => { if (drag) pos(e); });
    cv.addEventListener("pointerup", () => { drag = false; });
    const info = el("div", { class: "note ltr" });
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      acc += P.rate * dt; const n = Math.floor(acc); acc -= n; spawn(n);
      parts = parts.filter(p => (p.life += dt) < p.max);
      if (parts.length > 3000) parts.splice(0, parts.length - 3000);
      ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = P.add ? "lighter" : "source-over";
      parts.forEach(p => {
        p.vy += P.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const t = p.life / p.max, c = P.c1.map((v, i) => Math.round(v + (P.c2[i] - v) * t));
        ctx.fillStyle = `rgba(${c.join(",")},${(1 - t) * (P.add ? .45 : .35)})`;
        const s = P.size * (P.add ? 1 - t * .6 : .5 + t);
        ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, 7); ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
      info.textContent = `particles alive: ${parts.length}`;
    };
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, el("span", {}, "אפקט:"), sel, el("button", { class: "primary", onclick: () => spawn(250, true) }, "💥 פיצוץ")),
      el("div", { class: "grid2" }, ...sliders.map(s => s[2])), info);
    requestAnimationFrame(loop);
  };

  /* ---------------- Sprite sheet animation ---------------- */
  D.sprite = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · ספרייטים", "איך דמות דו-ממדית הולכת", "למעלה: גיליון ספרייטים (Sprite Sheet) עם 8 פריימים של הליכה. המשחק מציג פריים אחד בכל פעם, מהר, כמו דפדפת. שנה את מהירות האנימציה וראה מתי זה מתחיל להיראות ״חלק״.");
    const FW = 48, FH = 64, N = 8;
    const sheet = el("canvas", { width: String(FW * N), height: String(FH), "aria-label": "גיליון ספרייטים", style: "max-width:384px" });
    const view = el("canvas", { width: "240", height: "160", "aria-label": "אנימציה", style: "max-width:240px" });
    const sctx = sheet.getContext("2d"), vctx = view.getContext("2d");
    const fps = el("input", { type: "range", min: "1", max: "30", value: "10", id: "sp-fps", "aria-label": "פריימים לשנייה" });
    const fL = el("b", {}, "10");
    const drawFig = (c, ox, ph) => {
      const hip = [ox + FW / 2, 36], a = Math.sin(ph) * .6;
      c.strokeStyle = "#ffb454"; c.lineWidth = 4; c.lineCap = "round";
      const limb = (x, y, ang, len) => { const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len; c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke(); return [ex, ey]; };
      const k1 = limb(...hip, a, 12); limb(...k1, a - Math.max(0, -Math.sin(ph)) * .8, 12);
      const k2 = limb(...hip, -a, 12); limb(...k2, -a - Math.max(0, Math.sin(ph)) * .8, 12);
      const bob = Math.abs(Math.cos(ph)) * 2;
      const sh = [hip[0], 20 - bob];
      c.beginPath(); c.moveTo(hip[0], hip[1] - bob); c.lineTo(...sh); c.stroke();
      c.strokeStyle = "#7fb0ff"; limb(...sh, -a * .8, 13); limb(...sh, a * .8, 13);
      c.fillStyle = "#ffd6a0"; c.beginPath(); c.arc(sh[0], sh[1] - 8, 7, 0, 7); c.fill();
    };
    sctx.fillStyle = "#05080c"; sctx.fillRect(0, 0, FW * N, FH);
    for (let i = 0; i < N; i++) { drawFig(sctx, i * FW, i / N * Math.PI * 2); sctx.strokeStyle = "#2b3a50"; sctx.lineWidth = 1; sctx.strokeRect(i * FW + .5, .5, FW - 1, FH - 1); }
    const clean = sctx.getImageData(0, 0, FW * N, FH);
    let f = 0, acc = 0, x = 0, last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.1, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      acc += dt; if (acc > 1 / +fps.value) { acc = 0; f = (f + 1) % N; }
      x = (x + dt * 60) % 280;
      sctx.putImageData(clean, 0, 0); sctx.strokeStyle = "#ffb454"; sctx.lineWidth = 3; sctx.strokeRect(f * FW + 1.5, 1.5, FW - 3, FH - 3);
      vctx.fillStyle = "#0e1726"; vctx.fillRect(0, 0, 240, 160); vctx.fillStyle = "#4f7a3a"; vctx.fillRect(0, 130, 240, 30);
      vctx.drawImage(sheet, f * FW, 0, FW, FH, x - 40, 130 - FH * 1.5 + 6, FW * 1.5, FH * 1.5);
      vctx.fillStyle = "#7d8fa6"; vctx.font = "12px monospace"; vctx.fillText("frame " + f, 8, 16);
    };
    fps.oninput = () => { fL.textContent = fps.value; };
    d.append(sheet, el("div", { class: "grid2", style: "margin-top:10px" }, view, el("label", {}, el("span", {}, "פריימים לשנייה: ", fL), fps)));
    requestAnimationFrame(loop);
  };

  /* ---------------- Synthesizer + sound effects ---------------- */
  D.synth = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · סינתיסייזר", "צליל הוא גל, וגל הוא מספרים", "לחץ על המקשים (או על המקלדת: A S D F G H J K לשורה הלבנה, W E T Y U לשחורים). שנה את צורת הגל ותשמע ותראה את ההבדל. למטה: אפקטים קוליים של משחקי רטרו, שנוצרים מקוד בלבד, בלי קובצי שמע.");
    let ac = null, an = null, master = null;
    const ensure = () => {
      if (ac) return ac;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = .25; an = ac.createAnalyser(); an.fftSize = 1024; master.connect(an); an.connect(ac.destination);
      return ac;
    };
    const wave = el("select", { id: "sy-w", "aria-label": "צורת גל" }, ...[["sine", "סינוס (רך)"], ["square", "ריבוע (8-ביט)"], ["sawtooth", "משור (חד)"], ["triangle", "משולש"]].map(([v, t]) => el("option", { value: v }, t)));
    wave.value = "square";
    const oct = el("select", { id: "sy-o", "aria-label": "אוקטבה" }, ...[3, 4, 5].map(o => el("option", { value: o }, "אוקטבה " + o)));
    oct.value = "4";
    const vol = el("input", { type: "range", min: "0", max: "0.6", step: "0.01", value: "0.25", id: "sy-v", "aria-label": "עוצמה" });
    vol.oninput = () => { if (master) master.gain.value = +vol.value; };
    const freqL = el("div", { class: "note ltr" }, "לחץ על מקש");
    const scope = el("canvas", { width: "480", height: "120", "aria-label": "אוסילוסקופ" });
    const sctx = scope.getContext("2d");
    const NOTES = [["C", 0, "A"], ["C#", 1, "W"], ["D", 2, "S"], ["D#", 3, "E"], ["E", 4, "D"], ["F", 5, "F"], ["F#", 6, "T"], ["G", 7, "G"], ["G#", 8, "Y"], ["A", 9, "H"], ["A#", 10, "U"], ["B", 11, "J"], ["C", 12, "K"]];
    const HEN = { C: "דו", D: "רה", E: "מי", F: "פה", G: "סול", A: "לה", B: "סי" };
    const playing = new Map();
    const start = (i, btn) => {
      if (!ensure()) { freqL.textContent = "הדפדפן לא תומך בשמע."; return; }
      if (ac.state === "suspended") ac.resume();
      if (playing.has(i)) return;
      const midi = 12 * (+oct.value + 1) + NOTES[i][1], f = 440 * Math.pow(2, (midi - 69) / 12);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = wave.value; o.frequency.value = f; g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(.8, ac.currentTime + .015);
      o.connect(g); g.connect(master); o.start();
      playing.set(i, { o, g, btn }); btn && btn.classList.add("down");
      freqL.textContent = `${NOTES[i][0]}${+oct.value + (i === 12 ? 1 : 0)} (${HEN[NOTES[i][0][0]]}${NOTES[i][0].length > 1 ? " דיאז" : ""}) = ${f.toFixed(1)} Hz · הרמקול זז הלוך-חזור ${Math.round(f)} פעמים בשנייה`;
    };
    const stop = i => { const p = playing.get(i); if (!p) return; p.g.gain.cancelScheduledValues(ac.currentTime); p.g.gain.setValueAtTime(p.g.gain.value, ac.currentTime); p.g.gain.linearRampToValueAtTime(0, ac.currentTime + .12); p.o.stop(ac.currentTime + .13); p.btn && p.btn.classList.remove("down"); playing.delete(i); };
    const keys = el("div", { class: "keys" });
    NOTES.forEach(([n, , k], i) => {
      const b = el("button", { class: n.includes("#") ? "black" : "", "aria-label": n }, k);
      b.addEventListener("pointerdown", e => { e.preventDefault(); b.setPointerCapture(e.pointerId); start(i, b); });
      b.addEventListener("pointerup", () => stop(i)); b.addEventListener("pointercancel", () => stop(i));
      keys.append(b);
    });
    window.addEventListener("keydown", e => { if (!visible(d) || e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; const i = NOTES.findIndex(x => x[2] === e.key.toUpperCase()); if (i >= 0) start(i, keys.children[i]); });
    window.addEventListener("keyup", e => { const i = NOTES.findIndex(x => x[2] === e.key.toUpperCase()); if (i >= 0 && ac) stop(i); });
    const sfx = {
      "מטבע": () => { tone("square", 988, .08, 0); tone("square", 1319, .25, .08); },
      "קפיצה": () => slide("square", 300, 900, .22),
      "לייזר": () => slide("sawtooth", 1400, 150, .25),
      "פיצוץ": () => noise(.8),
      "שדרוג": () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone("triangle", f, .12, i * .07)),
      "נפגעת": () => { slide("square", 400, 90, .3); noise(.15); },
    };
    const tone = (type, f, dur, delay) => { if (!ensure()) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(.6, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); };
    const slide = (type, f1, f2, dur) => { if (!ensure()) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); };
    const noise = dur => { if (!ensure()) return; const t = ac.currentTime, buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), data = buf.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2; const s = ac.createBufferSource(), f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(100, t + dur); s.buffer = buf; s.connect(f); f.connect(master); s.start(t); };
    const loop = () => {
      requestAnimationFrame(loop);
      if (!visible(d)) return;
      sctx.fillStyle = "#05080c"; sctx.fillRect(0, 0, 480, 120);
      sctx.strokeStyle = "#1f2b3b"; sctx.beginPath(); sctx.moveTo(0, 60); sctx.lineTo(480, 60); sctx.stroke();
      if (!an) { sctx.fillStyle = "#7d8fa6"; sctx.font = "13px sans-serif"; sctx.fillText("כאן תראה את גל הקול", 180, 50); return; }
      const buf = new Uint8Array(an.fftSize); an.getByteTimeDomainData(buf);
      let s = 0; for (let i = 1; i < buf.length / 2; i++) if (buf[i - 1] < 128 && buf[i] >= 128) { s = i; break; }
      sctx.strokeStyle = "#5fd08f"; sctx.lineWidth = 2; sctx.beginPath();
      for (let i = 0; i < 480; i++) { const v = buf[s + i] / 128 - 1; i ? sctx.lineTo(i, 60 - v * 55) : sctx.moveTo(i, 60 - v * 55); }
      sctx.stroke(); sctx.lineWidth = 1;
    };
    d.append(el("div", { class: "row" }, wave, oct, el("label", { style: "flex:1;min-width:120px" }, "עוצמה", vol)), keys, freqL, scope,
      el("div", { class: "note", style: "margin-top:8px" }, "אפקטים קוליים שנוצרים מקוד (כמו הכלי jsfxr):"), el("div", { class: "row" }, ...Object.entries(sfx).map(([n, fn]) => el("button", { onclick: () => { ensure(); if (ac && ac.state === "suspended") ac.resume(); fn(); } }, n))));
    requestAnimationFrame(loop);
  };

  /* ---------------- Guard NPC state machine ---------------- */
  D.fsm = d => {
    const { el, head, visible, makeInput } = MG;
    head(d, "מעבדה · מכונת מצבים", "שומר עם מוח: סיור, חשד, מרדף, חיפוש", "אתה העיגול הכתום (חיצים או הכפתורים). השומר רואה רק בתוך חרוט הראייה שלו, ולא דרך קירות. תסתכל איך המצב שלו משתנה בדיאגרמה למטה, ונסה להתגנב מאחוריו אל הכספת (הריבוע הירוק).");
    const W = 480, H = 300;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "שומר" });
    const ctx = cv.getContext("2d");
    const input = makeInput(d);
    const walls = [[150, 60, 30, 120], [300, 140, 30, 130], [60, 220, 120, 24], [360, 50, 90, 22]];
    const wp = [[80, 40], [420, 110], [420, 270], [230, 270], [230, 30]];
    const STATES = [["PATROL", "סיור"], ["SUSPICIOUS", "חשד"], ["CHASE", "מרדף"], ["SEARCH", "חיפוש"], ["RETURN", "חזרה"]];
    const diag = el("div", { class: "chips", style: "direction:rtl" });
    const why = el("div", { class: "note", style: "min-height:40px" });
    let P, G, vault, msg, caught, won;
    const reset = () => {
      P = { x: 30, y: 280, r: 8 }; G = { x: 80, y: 40, a: 0, state: "PATROL", wp: 1, sus: 0, t: 0, last: null, look: 0 }; vault = [440, 10, 30, 26]; caught = false; won = false;
      why.textContent = "השומר מסייר בין נקודות קבועות.";
    };
    const inWall = (x, y) => walls.some(([wx, wy, ww, wh]) => x > wx && x < wx + ww && y > wy && y < wy + wh);
    const los = (a, b) => { const n = Math.hypot(b.x - a.x, b.y - a.y) / 5; for (let i = 1; i < n; i++) if (inWall(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false; return true; };
    const sees = () => {
      const dx = P.x - G.x, dy = P.y - G.y, dist = Math.hypot(dx, dy);
      if (dist > 150) return false;
      const dot = (dx * Math.cos(G.a) + dy * Math.sin(G.a)) / (dist || 1);
      return dot > Math.cos(35 * Math.PI / 180) && los(G, P);
    };
    const moveTo = (tx, ty, sp, dt) => {
      const dx = tx - G.x, dy = ty - G.y, dist = Math.hypot(dx, dy);
      const ta = Math.atan2(dy, dx); let da = ta - G.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      G.a += clamp(da, -4 * dt, 4 * dt);
      if (dist > 2) { const nx = G.x + dx / dist * sp * dt, ny = G.y + dy / dist * sp * dt; if (!inWall(nx, ny)) { G.x = nx; G.y = ny; } else { G.x += -dy / dist * sp * dt; G.y += dx / dist * sp * dt; } }
      return dist < 6;
    };
    const setState = (s, text) => { if (G.state !== s) { G.state = s; G.t = 0; why.textContent = text; } };
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      if (!caught && !won) {
        const k = input.keys; let mx = (k.has("r") ? 1 : 0) - (k.has("l") ? 1 : 0), my = (k.has("d") ? 1 : 0) - (k.has("u") ? 1 : 0); const l = Math.hypot(mx, my) || 1;
        const nx = clamp(P.x + mx / l * 95 * dt, 8, W - 8), ny = clamp(P.y + my / l * 95 * dt, 8, H - 8);
        if (!inWall(nx, P.y)) P.x = nx; if (!inWall(P.x, ny)) P.y = ny;
        const see = sees(); G.t += dt;
        switch (G.state) {
          case "PATROL": if (moveTo(...wp[G.wp], 55, dt)) G.wp = (G.wp + 1) % wp.length; if (see) setState("SUSPICIOUS", "ראה משהו! נעצר ומסתכל. אם ימשיך לראות אותך, המד יתמלא."); break;
          case "SUSPICIOUS": moveTo(P.x, P.y, 0, dt); G.sus += (see ? 1.4 : -1) * dt; if (G.sus >= 1) { G.sus = 1; setState("CHASE", "בטוח שזה אתה! רודף במהירות."); } if (G.sus <= 0) { G.sus = 0; setState("PATROL", "כנראה נדמה לו. חוזר לסייר."); } break;
          case "CHASE": if (see) G.last = { x: P.x, y: P.y }; moveTo(P.x, P.y, 105, dt); if (!see && G.t > .3) setState("SEARCH", "איבד קשר עין. הולך למקום האחרון שראה אותך ומחפש."); break;
          case "SEARCH": if (G.last && !moveTo(G.last.x, G.last.y, 70, dt)) {} else { G.a += dt * 2.2; } if (see) setState("CHASE", "מצא אותך שוב!"); if (G.t > 5) { G.sus = 0; setState("RETURN", "ויתר. חוזר למסלול הסיור."); } break;
          case "RETURN": if (moveTo(...wp[G.wp], 55, dt)) setState("PATROL", "חזר לסייר."); if (see) setState("SUSPICIOUS", "רגע, מה זה?"); break;
        }
        if (G.state === "CHASE" && Math.hypot(P.x - G.x, P.y - G.y) < 16) { caught = true; why.textContent = "נתפסת! לחץ ״התחל מחדש״."; }
        if (P.x > vault[0] && P.x < vault[0] + vault[2] && P.y > vault[1] && P.y < vault[1] + vault[3]) { won = true; why.textContent = "הגעת לכספת בלי להיתפס! 💰"; }
      }
      ctx.fillStyle = "#0e1520"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#1f3a28"; ctx.fillRect(...vault);
      ctx.strokeStyle = "#20304a"; ctx.setLineDash([3, 5]); ctx.beginPath(); wp.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      const col = { PATROL: "127,176,255", SUSPICIOUS: "255,216,74", CHASE: "255,90,90", SEARCH: "226,123,255", RETURN: "127,176,255" }[G.state];
      ctx.fillStyle = `rgba(${col},.18)`; ctx.beginPath(); ctx.moveTo(G.x, G.y);
      for (let a = -35; a <= 35; a += 5) { const ang = G.a + a * Math.PI / 180; let r = 0; while (r < 150 && !inWall(G.x + Math.cos(ang) * r, G.y + Math.sin(ang) * r)) r += 4; ctx.lineTo(G.x + Math.cos(ang) * r, G.y + Math.sin(ang) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a4659"; walls.forEach(w => ctx.fillRect(...w));
      ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(G.x, G.y, 10, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(G.x, G.y); ctx.lineTo(G.x + Math.cos(G.a) * 14, G.y + Math.sin(G.a) * 14); ctx.stroke();
      if (G.state === "SUSPICIOUS" || G.sus > 0) { ctx.fillStyle = "#333"; ctx.fillRect(G.x - 12, G.y - 22, 24, 4); ctx.fillStyle = "#ffd84a"; ctx.fillRect(G.x - 12, G.y - 22, 24 * G.sus, 4); }
      ctx.fillStyle = "#ffb454"; ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, 7); ctx.fill();
      if (G.last && G.state === "SEARCH") { ctx.strokeStyle = "#e27bff"; ctx.beginPath(); ctx.arc(G.last.x, G.last.y, 6, 0, 7); ctx.stroke(); }
      diag.innerHTML = ""; STATES.forEach(([s, he], i) => { diag.append(el("span", { class: "chip" + (G.state === s ? " hl" : "") }, `${he} (${s})`)); if (i < STATES.length - 1) diag.append(el("span", { style: "opacity:.4" }, "·")); });
    };
    reset();
    d.append(cv, el("div", { class: "row", style: "margin-top:8px;justify-content:space-between" }, el("div", { class: "row" }, el("button", { class: "primary", onclick: () => { reset(); input.setActive(true); } }, "▶ שחק / התחל מחדש")), input.pad),
      el("div", { class: "note" }, "המצב של השומר עכשיו:"), diag, why);
    requestAnimationFrame(loop);
  };

  /* ---------------- Boids flocking ---------------- */
  D.boids = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · התנהגות להקה", "Boids: להקות, המונים ותנועה", "כל ציפור מצייתת רק ל-3 חוקים פשוטים: (1) הפרדה: אל תתנגש בשכנים, (2) יישור: טוס לכיוון שהשכנים טסים, (3) לכידות: התקרב למרכז הקבוצה. מזה נוצרת התנהגות מורכבת של להקה. משחקים משתמשים בזה להמונים, דגים ולהקות. הזז את העכבר מעל הקנבס כדי להיות טורף.");
    const W = 480, H = 300;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "להקה" });
    const ctx = cv.getContext("2d");
    const P = { sep: 1.6, ali: 1, coh: .8, rad: 45 };
    const sl = [["sep", "הפרדה", 0, 4], ["ali", "יישור", 0, 3], ["coh", "לכידות", 0, 3], ["rad", "רדיוס ראייה", 10, 100]].map(([k, t, a, b]) => { const s = el("input", { type: "range", min: String(a), max: String(b), step: "0.1", value: String(P[k]), id: "bd-" + k, "aria-label": t }); s.oninput = () => { P[k] = +s.value; }; return el("label", {}, t, s); });
    const B = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(-60, 60), vy: rand(-60, 60) }));
    let pred = null;
    cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); pred = [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; });
    cv.addEventListener("pointerleave", () => { pred = null; });
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      B.forEach(b => {
        let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
        B.forEach(o => { if (o === b) return; const dx = o.x - b.x, dy = o.y - b.y, dd = Math.hypot(dx, dy); if (dd < P.rad) { n++; ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; if (dd < P.rad * .45) { sx -= dx / (dd * dd + .1) * 60; sy -= dy / (dd * dd + .1) * 60; } } });
        if (n) { b.vx += (sx * P.sep * 40 + (ax / n - b.vx) * P.ali + (cx / n - b.x) * P.coh) * dt; b.vy += (sy * P.sep * 40 + (ay / n - b.vy) * P.ali + (cy / n - b.y) * P.coh) * dt; }
        if (pred) { const dx = b.x - pred[0], dy = b.y - pred[1], dd = Math.hypot(dx, dy); if (dd < 80) { b.vx += dx / dd * 600 * dt; b.vy += dy / dd * 600 * dt; } }
        const sp = Math.hypot(b.vx, b.vy), mx = 130, mn = 50; if (sp > mx) { b.vx *= mx / sp; b.vy *= mx / sp; } if (sp < mn) { b.vx *= mn / (sp || 1); b.vy *= mn / (sp || 1); }
        b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H;
      });
      ctx.fillStyle = "rgba(5,8,12,.35)"; ctx.fillRect(0, 0, W, H);
      B.forEach(b => { const a = Math.atan2(b.vy, b.vx); ctx.fillStyle = "#7fb0ff"; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * 7, b.y + Math.sin(a) * 7); ctx.lineTo(b.x + Math.cos(a + 2.5) * 5, b.y + Math.sin(a + 2.5) * 5); ctx.lineTo(b.x + Math.cos(a - 2.5) * 5, b.y + Math.sin(a - 2.5) * 5); ctx.fill(); });
      if (pred) { ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.arc(...pred, 8, 0, 7); ctx.fill(); }
    };
    d.append(cv, el("div", { class: "grid2", style: "margin-top:8px" }, ...sl));
    requestAnimationFrame(loop);
  };

  /* ---------------- Procedural terrain ---------------- */
  D.terrain = d => {
    const { el, head } = MG;
    head(d, "מעבדה · יצירה פרוצדורלית", "מחולל עולמות (כמו Minecraft)", "המפה נוצרת ממספר אחד בלבד: ה-Seed (זרע). פונקציית ״רעש״ יוצרת גבעות חלקות, ומחברים כמה שכבות (אוקטבות) של רעש בגדלים שונים כדי לקבל גם הרים גדולים וגם פרטים קטנים. אותו seed = תמיד אותו עולם.");
    const W = 240, H = 150, SC = 2;
    const cv = el("canvas", { width: String(W * SC), height: String(H * SC), "aria-label": "מפה" });
    const ctx = cv.getContext("2d");
    const seed = el("input", { type: "number", value: "1337", id: "tr-seed", "aria-label": "seed", style: "width:110px" });
    const oct = el("input", { type: "range", min: "1", max: "7", value: "5", id: "tr-oct", "aria-label": "אוקטבות" });
    const zoom = el("input", { type: "range", min: "20", max: "140", value: "60", id: "tr-zoom", "aria-label": "זום" });
    const water = el("input", { type: "range", min: "0.2", max: "0.7", step: "0.01", value: "0.42", id: "tr-water", "aria-label": "גובה המים" });
    let heightOnly = false;
    const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const smooth = t => t * t * (3 - 2 * t);
    const noise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), e = hash(xi + 1, yi + 1, s); return a + (b - a) * xf + (c - a) * yf + (a - b - c + e) * xf * yf; };
    const draw = () => {
      const S = +seed.value | 0, O = +oct.value, Z = +zoom.value, WL = +water.value;
      const img = ctx.createImageData(W * SC, H * SC);
      const hm = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let v = 0, amp = 1, fr = 1 / Z, tot = 0;
        for (let o = 0; o < O; o++) { v += noise(x * fr, y * fr, S + o * 17) * amp; tot += amp; amp *= .5; fr *= 2; }
        hm[y * W + x] = v / tot;
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const h = hm[y * W + x], sh = x > 0 && y > 0 ? (h - hm[(y - 1) * W + x - 1]) * 6 : 0;
        let c;
        if (heightOnly) c = [h * 255, h * 255, h * 255];
        else if (h < WL - .08) c = [20, 50, 110]; else if (h < WL) c = [40, 90, 170]; else if (h < WL + .03) c = [214, 200, 140]; else if (h < WL + .15) c = [80, 150, 60]; else if (h < WL + .25) c = [40, 100, 45]; else if (h < WL + .33) c = [120, 110, 100]; else c = [240, 240, 245];
        if (!heightOnly && h >= WL) c = c.map(v => clamp(v * (1 + sh), 0, 255));
        for (let j = 0; j < SC; j++) for (let i = 0; i < SC; i++) { const k = ((y * SC + j) * W * SC + x * SC + i) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255; }
      }
      ctx.putImageData(img, 0, 0);
    };
    [seed, oct, zoom, water].forEach(i => i.addEventListener("input", draw));
    const hb = el("button", { onclick: () => { heightOnly = !heightOnly; hb.classList.toggle("on", heightOnly); draw(); } }, "הצג רק מפת גובה");
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, el("span", {}, "Seed:"), seed, el("button", { class: "primary", onclick: () => { seed.value = String((Math.random() * 99999) | 0); draw(); } }, "🎲 עולם חדש"), hb),
      el("div", { class: "grid2" }, el("label", {}, "אוקטבות (שכבות פרטים)", oct), el("label", {}, "גודל היבשות", zoom), el("label", {}, "גובה פני הים", water)));
    draw();
  };

  /* ---------------- Game of Life ---------------- */
  D.life = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · אוטומט תאי", "משחק החיים של קונוויי", "כל משבצת חיה או מתה. בכל דור: משבצת חיה עם 2 או 3 שכנים שורדת, משבצת מתה עם בדיוק 3 שכנים נולדת, וכל השאר מתות. ארבעה חוקים, ומהם נוצרים ״יצורים״ שזזים, מתרבים ואפילו מחשבים. צייר עם העכבר או בחר תבנית.");
    const C = 64, R = 40, S = 7;
    const cv = el("canvas", { width: String(C * S), height: String(R * S), "aria-label": "משחק החיים", style: "cursor:crosshair;touch-action:none" });
    const ctx = cv.getContext("2d");
    let g = new Uint8Array(C * R), run = false, gen = 0, acc = 0;
    const info = el("div", { class: "note ltr" });
    const PAT = {
      "רחפן (Glider)": [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
      "חללית": [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
      "פולסר": (() => { const p = []; [0, 5, 7, 12].forEach(r => [2, 3, 4, 8, 9, 10].forEach(c => { p.push([c, r]); p.push([r, c]); })); return p; })(),
      "תותח רחפנים (Gosper)": [[24, 0], [22, 1], [24, 1], [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2], [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3], [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4], [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5], [10, 6], [16, 6], [24, 6], [11, 7], [15, 7], [12, 8], [13, 8]],
    };
    const put = (pat, ox, oy) => pat.forEach(([x, y]) => { const xx = ox + x, yy = oy + y; if (xx >= 0 && yy >= 0 && xx < C && yy < R) g[yy * C + xx] = 1; });
    const step = () => {
      const n = new Uint8Array(C * R);
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
        let c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) c += g[((y + j + R) % R) * C + (x + i + C) % C];
        const a = g[y * C + x]; n[y * C + x] = (a && (c === 2 || c === 3)) || (!a && c === 3) ? 1 : 0;
      }
      g = n; gen++;
    };
    const draw = () => {
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, C * S, R * S);
      ctx.fillStyle = "#5fd08f"; let alive = 0;
      for (let k = 0; k < C * R; k++) if (g[k]) { alive++; ctx.fillRect((k % C) * S, ((k / C) | 0) * S, S - 1, S - 1); }
      info.textContent = `generation ${gen}   alive ${alive}`;
    };
    let painting = -1;
    const cell = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * C), Math.floor((e.clientY - r.top) / r.height * R)]; };
    cv.addEventListener("pointerdown", e => { const [x, y] = cell(e); painting = g[y * C + x] ? 0 : 1; g[y * C + x] = painting; cv.setPointerCapture(e.pointerId); draw(); });
    cv.addEventListener("pointermove", e => { if (painting < 0) return; const [x, y] = cell(e); if (x >= 0 && y >= 0 && x < C && y < R) { g[y * C + x] = painting; draw(); } });
    cv.addEventListener("pointerup", () => { painting = -1; });
    const sp = el("input", { type: "range", min: "1", max: "40", value: "12", id: "lf-sp", "aria-label": "מהירות" });
    const sel = el("select", { id: "lf-p", "aria-label": "תבנית" }, ...Object.keys(PAT).map(k => el("option", { value: k }, k)));
    const runB = el("button", { class: "primary", onclick: () => { run = !run; runB.textContent = run ? "⏸ עצור" : "▶ הפעל"; } }, "▶ הפעל");
    let last = 0;
    const loop = now => { requestAnimationFrame(loop); const dt = Math.min(.1, (now - last) / 1000 || 0); last = now; if (!visible(d) || !run) return; acc += dt; if (acc > 1 / +sp.value) { acc = 0; step(); draw(); } };
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, runB, el("button", { onclick: () => { step(); draw(); } }, "דור אחד"),
      el("button", { onclick: () => { g = g.map(() => Math.random() < .22 ? 1 : 0); gen = 0; draw(); } }, "אקראי"), el("button", { onclick: () => { g.fill(0); gen = 0; draw(); } }, "נקה"),
      sel, el("button", { onclick: () => { put(PAT[sel.value], sel.value.includes("Gosper") ? 4 : 26, sel.value.includes("Gosper") ? 4 : 14); draw(); } }, "הוסף תבנית")),
      el("label", {}, "מהירות", sp), info);
    put(PAT["תותח רחפנים (Gosper)"], 4, 4); draw(); requestAnimationFrame(loop);
  };

  /* ---------------- Raycaster (Wolfenstein-style) ---------------- */
  D.raycast = d => {
    const { el, head, visible, makeInput } = MG;
    head(d, "מעבדה · Raycasting", "תלת-ממד מזויף, כמו Wolfenstein 3D (1992)", "המפה היא בעצם דו-ממדית (ראה מפה קטנה בפינה). לכל עמודה במסך שולחים קרן אחת, מודדים כמה רחוק הקיר, ומציירים קו אנכי: קיר קרוב = קו גבוה. ▲▼ ללכת, ◀ ▶ להסתובב. כבה את ״תיקון עין-דג״ כדי לראות באג מפורסם.");
    const MAP = [
      "1111111111111111",
      "1000000000000001",
      "1022200000330001",
      "1020000000030001",
      "1020000000000001",
      "1000004440000001",
      "1000004040000001",
      "1000000000055501",
      "1000000000050001",
      "1033300000050001",
      "1000000000000001",
      "1000200000200001",
      "1000000000000001",
      "1000000660000001",
      "1000000000000001",
      "1111111111111111",
    ].map(r => [...r].map(Number));
    const COL = [null, [180, 180, 190], [220, 90, 70], [80, 150, 220], [90, 190, 110], [230, 190, 70], [190, 110, 220]];
    const W = 480, H = 270;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "raycaster" });
    const ctx = cv.getContext("2d");
    const input = makeInput(d);
    let px = 2.5, py = 13.5, pa = -Math.PI / 2, fish = true, started = false;
    const fb = el("button", { class: "on", onclick: () => { fish = !fish; fb.classList.toggle("on", fish); } }, "תיקון עין-דג");
    const info = el("div", { class: "note ltr" });
    let last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      const k = input.keys;
      pa += ((k.has("r") ? 1 : 0) - (k.has("l") ? 1 : 0)) * 2.4 * dt;
      const mv = ((k.has("u") ? 1 : 0) - (k.has("d") ? 1 : 0)) * 2.6 * dt;
      const nx = px + Math.cos(pa) * mv, ny = py + Math.sin(pa) * mv;
      if (!MAP[Math.floor(py)][Math.floor(nx + Math.sign(Math.cos(pa) * mv) * .2)]) px = nx;
      if (!MAP[Math.floor(ny + Math.sign(Math.sin(pa) * mv) * .2)][Math.floor(px)]) py = ny;
      const sky = ctx.createLinearGradient(0, 0, 0, H / 2); sky.addColorStop(0, "#1b2d4f"); sky.addColorStop(1, "#5a7cae");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H / 2); ctx.fillStyle = "#2a2724"; ctx.fillRect(0, H / 2, W, H / 2);
      const FOV = Math.PI / 3, COLS = 240, cw = W / COLS, rays = [];
      for (let c = 0; c < COLS; c++) {
        const ra = pa - FOV / 2 + FOV * c / COLS, dx = Math.cos(ra), dy = Math.sin(ra);
        let mx = Math.floor(px), my = Math.floor(py);
        const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
        let sx, sy, sdx, sdy;
        if (dx < 0) { sx = -1; sdx = (px - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - px) * ddx; }
        if (dy < 0) { sy = -1; sdy = (py - my) * ddy; } else { sy = 1; sdy = (my + 1 - py) * ddy; }
        let side = 0, hit = 0, n = 0;
        while (!hit && n++ < 64) { if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; } hit = MAP[my][mx]; }
        let dist = side === 0 ? sdx - ddx : sdy - ddy;
        rays.push([dist, ra]);
        if (fish) dist *= Math.cos(ra - pa);
        const h = Math.min(H * 2, H / (dist || .01));
        const shade = (side ? .7 : 1) * clamp(1.4 - dist / 12, .15, 1);
        ctx.fillStyle = `rgb(${COL[hit].map(v => v * shade | 0).join(",")})`;
        ctx.fillRect(c * cw, H / 2 - h / 2, cw + 1, h);
      }
      const ms = 6; ctx.globalAlpha = .85; ctx.fillStyle = "#05080c"; ctx.fillRect(4, 4, 16 * ms, 16 * ms);
      MAP.forEach((r, y) => r.forEach((v, x) => { if (v) { ctx.fillStyle = `rgb(${COL[v].join(",")})`; ctx.fillRect(4 + x * ms, 4 + y * ms, ms, ms); } }));
      ctx.strokeStyle = "rgba(255,216,74,.35)";
      rays.forEach(([dd, ra], i) => { if (i % 8) return; ctx.beginPath(); ctx.moveTo(4 + px * ms, 4 + py * ms); ctx.lineTo(4 + (px + Math.cos(ra) * dd) * ms, 4 + (py + Math.sin(ra) * dd) * ms); ctx.stroke(); });
      ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.arc(4 + px * ms, 4 + py * ms, 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      if (!started) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "16px sans-serif"; ctx.fillText("לחץ ״▶ היכנס למבוך״", W / 2, H / 2); ctx.textAlign = "left"; }
      info.textContent = `rays per frame: ${COLS}   position (${px.toFixed(1)}, ${py.toFixed(1)})   angle ${((pa * 180 / Math.PI) % 360).toFixed(0)}°`;
    };
    d.append(cv, el("div", { class: "row", style: "margin-top:8px;justify-content:space-between" }, el("div", { class: "row" }, el("button", { class: "primary", onclick: () => { started = true; input.setActive(true); } }, "▶ היכנס למבוך"), fb), input.pad), info);
    requestAnimationFrame(loop);
  };

  /* ---------------- GLSL shader playground ---------------- */
  const SHADERS = {
    "מעבר צבעים": `// כל פיקסל מקבל צבע לפי המיקום שלו (uv) והזמן
void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;   // 0..1
  vec3 col = vec3(uv.x, uv.y, 0.5 + 0.5 * sin(iTime));
  gl_FragColor = vec4(col, 1.0);
}`,
    "עיגול פועם": `void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  float r = 0.25 + 0.05 * sin(iTime * 3.0);
  float d = length(uv);                          // מרחק מהמרכז
  float circle = smoothstep(r, r - 0.01, d);     // 1 בפנים, 0 בחוץ
  vec3 col = mix(vec3(0.05, 0.07, 0.12), vec3(1.0, 0.6, 0.2), circle);
  col += 0.02 / abs(d - r);                      // זוהר סביב השפה
  gl_FragColor = vec4(col, 1.0);
}`,
    "פלזמה": `void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.y * 4.0;
  float t = iTime;
  float v = sin(uv.x + t) + sin(uv.y + t * 1.3) + sin(uv.x + uv.y + t * 0.7)
          + sin(length(uv - 2.0) * 3.0 - t * 2.0);
  vec3 col = 0.5 + 0.5 * cos(v + vec3(0.0, 2.0, 4.0));
  gl_FragColor = vec4(col, 1.0);
}`,
    "שקיעה רטרו": `void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec3 col = mix(vec3(0.1, 0.0, 0.2), vec3(1.0, 0.3, 0.5), uv.y + 0.5);
  float sun = smoothstep(0.3, 0.29, length(uv - vec2(0.0, 0.08)));
  float stripes = step(0.5, fract((uv.y - iTime * 0.05) * 18.0)) + step(0.12, uv.y);
  col = mix(col, vec3(1.0, 0.8, 0.2), sun * min(stripes, 1.0));
  if (uv.y < -0.05) {                            // רצפת הרשת
    vec2 g = vec2(uv.x / (-uv.y), 1.0 / (-uv.y) + iTime);
    float line = max(step(0.95, fract(g.x * 2.0)), step(0.9, fract(g.y)));
    col = mix(vec3(0.05, 0.0, 0.1), vec3(1.0, 0.2, 0.8), line * (-uv.y) * 3.0);
  }
  gl_FragColor = vec4(col, 1.0);
}`,
    "מנהרה": `void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  vec2 t = vec2(a / 3.14159, 0.3 / r + iTime * 0.8);
  float check = mod(floor(t.x * 8.0) + floor(t.y * 4.0), 2.0);
  vec3 col = mix(vec3(0.1, 0.2, 0.5), vec3(0.4, 0.9, 1.0), check) * r * 2.0;
  gl_FragColor = vec4(col, 1.0);
}`,
    "כדור תלת-ממדי (Raymarching)": `// מצלמה שולחת קרן לכל פיקסל, ו"צועדת" לאורכה עד שהיא פוגעת בכדור
float scene(vec3 p) {
  float sphere = length(p - vec3(0.0, 0.0, 3.0)) - 1.0;
  float floor_ = p.y + 1.0;
  return min(sphere, floor_);
}
vec3 normal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(scene(p + e.xyy) - scene(p - e.xyy),
                        scene(p + e.yxy) - scene(p - e.yxy),
                        scene(p + e.yyx) - scene(p - e.yyx)));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0, 0.0, 0.0), rd = normalize(vec3(uv, 1.0));
  float t = 0.0;
  for (int i = 0; i < 80; i++) { float d = scene(ro + rd * t); if (d < 0.001 || t > 20.0) break; t += d; }
  vec3 col = vec3(0.4, 0.6, 0.9) - uv.y * 0.3;
  if (t < 20.0) {
    vec3 p = ro + rd * t, n = normal(p);
    vec3 light = normalize(vec3(sin(iTime), 1.0, cos(iTime) - 1.0));
    float diff = max(dot(n, light), 0.0);
    vec3 base = p.y < -0.99 ? vec3(0.3) + 0.2 * mod(floor(p.x) + floor(p.z), 2.0) : vec3(1.0, 0.5, 0.2);
    col = base * (0.15 + diff);
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  };
  D.shader = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · שיידרים (GLSL)", "תוכנית שרצה על כל פיקסל, במקביל, על ה-GPU", "הקוד הזה רץ בנפרד עבור כל פיקסל בקנבס (עשרות אלפי פעמים בכל פריים!) ומחליט את הצבע שלו. בחר דוגמה ושנה מספרים. יש לך: gl_FragCoord (מיקום הפיקסל), iResolution (גודל המסך), iTime (זמן בשניות).");
    const cv = el("canvas", { width: "480", height: "270", "aria-label": "שיידר" });
    const gl = cv.getContext("webgl");
    const sel = el("select", { id: "sh-p", "aria-label": "דוגמה" }, ...Object.keys(SHADERS).map(k => el("option", { value: k }, k)));
    const ta = el("textarea", { rows: "14", spellcheck: "false", id: "sh-code", "aria-label": "קוד GLSL" });
    const err = el("div", { class: "out", style: "min-height:0" });
    if (!gl) { d.append(el("p", {}, "הדפדפן הזה לא תומך ב-WebGL.")); return; }
    const vsSrc = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    let prog = null, uT, uR;
    const compile = () => {
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      try {
        const clean = ta.value.replace(/\/\/.*$/gm, "").replace(/[^\x00-\x7F]/g, " ");   // some mobile GPUs reject non-ASCII, even in comments
        const fs = mk(gl.FRAGMENT_SHADER, "precision mediump float;\nuniform float iTime;\nuniform vec2 iResolution;\n" + clean);
        const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(p, fs); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        prog = p; gl.useProgram(p);
        const loc = gl.getAttribLocation(p, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        uT = gl.getUniformLocation(p, "iTime"); uR = gl.getUniformLocation(p, "iResolution");
        err.textContent = "✓ התקמפל בהצלחה (" + (cv.width * cv.height).toLocaleString("en") + " פיקסלים בכל פריים)";
        err.style.color = "#8ff0b5";
      } catch (e) { err.textContent = "שגיאה: " + e.message.replace(/ERROR: 0:(\d+)/g, (m, n) => "שורה " + (n - 3)); err.style.color = "#ff8b8b"; }
    };
    let deb = null;
    ta.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(compile, 400); });
    ta.addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("  ", s, ta.selectionEnd, "end"); } });
    sel.onchange = () => { ta.value = SHADERS[sel.value]; compile(); };
    const t0 = performance.now();
    const loop = now => {
      requestAnimationFrame(loop);
      if (!visible(d) || !prog) return;
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform1f(uT, (now - t0) / 1000); gl.uniform2f(uR, cv.width, cv.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    d.append(el("div", { class: "row" }, el("span", {}, "דוגמה:"), sel), el("div", { class: "grid2" }, cv, ta), err);
    ta.value = SHADERS[sel.value]; compile(); requestAnimationFrame(loop);
  };

  /* ---------------- Culling + LOD ---------------- */
  D.lod = d => {
    const { el, head } = MG;
    head(d, "מעבדה · Culling ו-LOD", "איך GTA חוסך 95% מהעבודה", "מבט מלמעלה על עיר. המצלמה (המשולש הלבן) רואה רק בתוך חרוט. גרור את המצלמה וסובב אותה. בניינים מחוץ לחרוט לא מצוירים בכלל (Culling), ובניינים רחוקים מצוירים בגרסה פשוטה (LOD). תסתכל על מספר המשולשים!");
    const W = 480, H = 300;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "עיר מלמעלה", style: "touch-action:none" });
    const ctx = cv.getContext("2d");
    const B = [];
    for (let y = 20; y < H; y += 26) for (let x = 14; x < W; x += 26) if (Math.random() < .8) B.push([x + rand(-4, 4), y + rand(-4, 4)]);
    let cam = [W / 2, H - 20], ang = -90;
    const angS = el("input", { type: "range", min: "-180", max: "180", value: "-90", id: "ld-a", "aria-label": "כיוון מצלמה" });
    const fov = el("input", { type: "range", min: "30", max: "120", value: "70", id: "ld-f", "aria-label": "שדה ראייה" });
    const far = el("input", { type: "range", min: "80", max: "450", value: "260", id: "ld-d", "aria-label": "מרחק ציור" });
    let culling = true, lod = true;
    const cb = el("button", { class: "on", onclick: () => { culling = !culling; cb.classList.toggle("on", culling); draw(); } }, "Culling");
    const lb = el("button", { class: "on", onclick: () => { lod = !lod; lb.classList.toggle("on", lod); draw(); } }, "LOD");
    const out = el("div", { class: "out", style: "min-height:0" });
    const TRI = [20000, 4000, 400];
    const draw = () => {
      ang = +angS.value;
      const a = ang * Math.PI / 180, half = +fov.value / 2 * Math.PI / 180, F = +far.value;
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,216,74,.08)"; ctx.beginPath(); ctx.moveTo(...cam); ctx.arc(cam[0], cam[1], F, a - half, a + half); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,216,74,.25)"; ctx.beginPath(); ctx.arc(cam[0], cam[1], F / 3, a - half, a + half); ctx.stroke(); ctx.beginPath(); ctx.arc(cam[0], cam[1], F * 2 / 3, a - half, a + half); ctx.stroke();
      let tris = 0, drawn = 0; const all = B.length * TRI[0];
      B.forEach(([x, y]) => {
        const dx = x - cam[0], dy = y - cam[1], dist = Math.hypot(dx, dy);
        let da = Math.atan2(dy, dx) - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const vis = Math.abs(da) < half + .05 && dist < F;
        if (culling && !vis) { ctx.strokeStyle = "#1f2b3b"; ctx.strokeRect(x - 7, y - 7, 14, 14); return; }
        const L = !lod ? 0 : dist < F / 3 ? 0 : dist < F * 2 / 3 ? 1 : 2;
        tris += TRI[L]; drawn++;
        ctx.fillStyle = ["#ff6b6b", "#ffb454", "#ffd84a"][L]; const s = [13, 11, 8][L]; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      });
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(cam[0] + Math.cos(a) * 12, cam[1] + Math.sin(a) * 12); ctx.lineTo(cam[0] + Math.cos(a + 2.4) * 9, cam[1] + Math.sin(a + 2.4) * 9); ctx.lineTo(cam[0] + Math.cos(a - 2.4) * 9, cam[1] + Math.sin(a - 2.4) * 9); ctx.fill();
      out.textContent = `buildings ${B.length}   drawn ${drawn}   culled ${B.length - drawn}\ntriangles this frame: ${tris.toLocaleString("en")}   (without tricks: ${all.toLocaleString("en")})\nsaved: ${(100 - tris / all * 100).toFixed(1)}%    red = LOD0 (20k)  orange = LOD1 (4k)  yellow = LOD2 (400)`;
    };
    let dragging = false;
    cv.addEventListener("pointerdown", e => { dragging = true; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => { if (!dragging) return; const r = cv.getBoundingClientRect(); cam = [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; draw(); });
    cv.addEventListener("pointerup", () => { dragging = false; });
    [angS, fov, far].forEach(s => s.addEventListener("input", draw));
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, cb, lb), el("div", { class: "grid2" }, el("label", {}, "כיוון המצלמה", angS), el("label", {}, "שדה ראייה (FOV)", fov), el("label", {}, "מרחק ציור", far)), out);
    draw();
  };

  /* ---------------- World streaming ---------------- */
  D.streaming = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · הזרמת עולם", "טעינת העיר תוך כדי נסיעה", "העולם מחולק למשבצות (chunks). המשחק טוען רק משבצות ברדיוס מסוים סביב השחקן, ומשחרר את הרחוקות כדי לפנות זיכרון. טעינה לוקחת זמן (הדיסק איטי). נסה לנסוע מהר מאוד, או להקטין את הרדיוס, ותראה ״pop-in״: בניינים שמופיעים פתאום.");
    const C = 16, R = 10, S = 30;
    const cv = el("canvas", { width: String(C * S), height: String(R * S), "aria-label": "משבצות עולם" });
    const ctx = cv.getContext("2d");
    const sp = el("input", { type: "range", min: "0.3", max: "8", step: "0.1", value: "1.5", id: "st-s", "aria-label": "מהירות" });
    const rad = el("input", { type: "range", min: "1", max: "4", step: "0.5", value: "2", id: "st-r", "aria-label": "רדיוס" });
    const disk = el("select", { id: "st-d", "aria-label": "סוג דיסק" }, el("option", { value: "1.2" }, "HDD ישן (איטי)"), el("option", { value: "0.35" }, "SSD"), el("option", { value: "0.1" }, "SSD של PS5 (מהיר מאוד)"));
    disk.value = "0.35";
    const out = el("div", { class: "out", style: "min-height:0" });
    const st = Array(C * R).fill(0), prog = Array(C * R).fill(0);
    let t = 0, pop = 0, flash = 0, last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      t += dt * +sp.value * .25;
      const px = C / 2 + Math.sin(t) * (C / 2 - 1.2), py = R / 2 + Math.sin(t * 2) * (R / 2 - 1.2);
      const r = +rad.value, ld = +disk.value;
      let loading = 0;
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
        const k = y * C + x, dist = Math.hypot(x + .5 - px, y + .5 - py);
        if (dist <= r) { if (st[k] === 0) { st[k] = 1; prog[k] = 0; } }
        else if (dist > r + 1) st[k] = 0;
        if (st[k] === 1) { loading++; if (loading <= 2) prog[k] += dt / ld; if (prog[k] >= 1) st[k] = 2; }
      }
      const pk = Math.floor(py) * C + Math.floor(px);
      if (st[pk] !== 2) { flash = .6; pop++; }
      flash = Math.max(0, flash - dt);
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, C * S, R * S);
      let loaded = 0;
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
        const k = y * C + x;
        if (st[k] === 2) { loaded++; ctx.fillStyle = "#1f4a2e"; ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2); ctx.fillStyle = "#5fd08f"; for (let i = 0; i < 3; i++) ctx.fillRect(x * S + 5 + i * 8, y * S + 8 + (i % 2) * 6, 5, 12 - (i % 2) * 5); }
        else if (st[k] === 1) { ctx.fillStyle = "#3b2d12"; ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2); ctx.fillStyle = "#ffb454"; ctx.fillRect(x * S + 3, y * S + S - 7, (S - 6) * prog[k], 4); }
        else { ctx.strokeStyle = "#141d2a"; ctx.strokeRect(x * S + .5, y * S + .5, S - 1, S - 1); }
      }
      ctx.strokeStyle = "rgba(127,176,255,.5)"; ctx.beginPath(); ctx.arc(px * S, py * S, r * S, 0, 7); ctx.stroke();
      ctx.fillStyle = flash > 0 ? "#ff5a5a" : "#fff"; ctx.beginPath(); ctx.arc(px * S, py * S, 6, 0, 7); ctx.fill();
      if (flash > 0) { ctx.fillStyle = "#ff5a5a"; ctx.font = "bold 14px sans-serif"; ctx.fillText("POP-IN! המשבצת לא נטענה בזמן", 10, 20); }
      out.textContent = `chunks loaded ${loaded}/${C * R}   loading ${loading}   memory ${loaded * 64} MB (without streaming: ${C * R * 64} MB)   pop-in frames ${pop}`;
    };
    d.append(cv, el("div", { class: "grid2", style: "margin-top:8px" }, el("label", {}, "מהירות נסיעה", sp), el("label", {}, "רדיוס טעינה", rad), el("label", {}, "סוג דיסק", disk)), out);
    requestAnimationFrame(loop);
  };
})();

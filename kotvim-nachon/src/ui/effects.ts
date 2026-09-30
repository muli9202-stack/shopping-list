/** Confetti, stars and flying points – plain canvas/DOM so they work over any screen. */

const COLORS = ['#ffb703', '#fb8500', '#ff5d8f', '#8338ec', '#3a86ff', '#2ec27e', '#ef476f'];

export function confetti(amount = 120, origin?: { x: number; y: number }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const ox = origin?.x ?? window.innerWidth / 2;
  const oy = origin?.y ?? window.innerHeight / 3;
  const parts = Array.from({ length: amount }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 9;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 6,
      r: 4 + Math.random() * 6,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      star: Math.random() < 0.3,
    };
  });
  let frame = 0;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28;
      p.vx *= 0.99;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - frame / 110);
      if (p.star) drawStar(ctx, p.r * 1.4);
      else ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    }
    if (frame < 110) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r / 2.2 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function flyPoints(pts: number, at?: { x: number; y: number }) {
  const el = document.createElement('div');
  el.className = 'float-points';
  el.textContent = `+${pts} ⭐`;
  el.style.left = `${(at?.x ?? window.innerWidth / 2) - 40}px`;
  el.style.top = `${(at?.y ?? window.innerHeight / 2) - 20}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

let audioCtx: AudioContext | null = null;
/** Tiny synthesized sound effects (no audio files needed). */
export function sfx(kind: 'good' | 'bad' | 'pop' | 'win' | 'coin') {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const notes: Record<typeof kind, number[]> = {
      good: [660, 880],
      bad: [300, 220],
      pop: [520],
      win: [523, 659, 784, 1046],
      coin: [988, 1319],
    };
    notes[kind].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'bad' ? 'triangle' : 'sine';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.2);
    });
  } catch {
    // no audio – fine
  }
}

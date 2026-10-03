// Small math helpers shared by every system. The world is laid out on the
// XZ plane (Y is up); headings are radians where 0 faces +Z.

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const randInt = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;

/** Shortest signed difference b - a, wrapped to [-PI, PI]. */
export function angleDiff(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const headingTo = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(tx - fx, tz - fz);
export const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(bx - ax, bz - az);

/** Exponential smoothing that is frame-rate independent. */
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));

/** Minimal typed event bus used to broadcast world events (shots, crimes, explosions). */
export class Bus<E extends Record<string, unknown>> {
  private handlers: { [K in keyof E]?: ((e: E[K]) => void)[] } = {};
  on<K extends keyof E>(type: K, fn: (e: E[K]) => void) {
    (this.handlers[type] ??= []).push(fn);
  }
  emit<K extends keyof E>(type: K, e: E[K]) {
    this.handlers[type]?.forEach((fn) => fn(e));
  }
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function fmtMoney(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

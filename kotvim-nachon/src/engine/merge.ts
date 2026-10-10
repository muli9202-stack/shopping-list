import type { Child, DayStat, MistakeRecord, SkillId, SkillProgress, WritingRecord } from '../types';

/**
 * Merging two copies of the same child (two devices, or offline edits).
 * Nothing the child earned or practised on either device is lost:
 *  - points are a per-device wallet (earned/spent counters), so both devices' points add up
 *  - practice statistics are merged per day, mistakes and writings are unioned
 *  - profile fields (name, grade, room layout) come from the most recently edited copy
 */

let deviceIdCache: string | null = null;
export function deviceId(): string {
  if (deviceIdCache) return deviceIdCache;
  try {
    deviceIdCache = localStorage.getItem('kn-device') ?? '';
    if (!deviceIdCache) {
      deviceIdCache = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('kn-device', deviceIdCache);
    }
  } catch {
    deviceIdCache ??= `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }
  return deviceIdCache;
}

export const START_POINTS = 100;
type Wallet = Record<string, { e: number; s: number }>;

/** Older saves have only `points`; move them into a wallet entry. */
function walletOf(c: Child): Wallet {
  if (c.wallet) return c.wallet;
  const d = c.points - START_POINTS;
  return { legacy: { e: Math.max(0, d), s: Math.max(0, -d) } };
}

export function pointsOf(wallet: Wallet): number {
  return START_POINTS + Object.values(wallet).reduce((a, w) => a + w.e - w.s, 0);
}

/** Add (positive) or spend (negative) points on this device's counter. */
export function changePoints(c: Child, delta: number, dev = deviceId()): Child {
  const wallet = { ...walletOf(c) };
  const mine = { ...(wallet[dev] ?? { e: 0, s: 0 }) };
  if (delta >= 0) mine.e += delta;
  else mine.s += -delta;
  wallet[dev] = mine;
  return { ...c, wallet, points: pointsOf(wallet), totalEarned: c.totalEarned + Math.max(0, delta), updatedAt: Date.now() };
}

/** Gold coins 🪙: the same per-device wallet as points, so coins from every device add up. */
export function coinsOf(c: Child): number {
  return Object.values(c.coinWallet ?? {}).reduce((a, w) => a + w.e - w.s, 0);
}

export function changeCoins(c: Child, delta: number, dev = deviceId()): Child {
  const wallet = { ...(c.coinWallet ?? {}) };
  const mine = { ...(wallet[dev] ?? { e: 0, s: 0 }) };
  if (delta >= 0) mine.e += delta;
  else mine.s += -delta;
  wallet[dev] = mine;
  return { ...c, coinWallet: wallet, updatedAt: Date.now() };
}

function mergeWallet(a: Wallet, b: Wallet): Wallet {
  const out: Wallet = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = { e: Math.max(a[k]?.e ?? 0, b[k]?.e ?? 0), s: Math.max(a[k]?.s ?? 0, b[k]?.s ?? 0) };
  return out;
}

function mergeArcade(a: NonNullable<Child['arcade']>, b: NonNullable<Child['arcade']>): NonNullable<Child['arcade']> {
  const out = { ...a };
  // per business: the copy that got further (level, then customers served)
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (!cur || v.level > cur.level || (v.level === cur.level && v.served > cur.served)) out[k] = v;
  }
  return out;
}

function mergeDays(a: DayStat[], b: DayStat[]): DayStat[] {
  const m = new Map<string, DayStat>();
  for (const d of [...a, ...b]) {
    const o = m.get(d.d);
    m.set(d.d, o ? { d: d.d, a: Math.max(o.a, d.a), c: Math.max(o.c, d.c) } : d);
  }
  return [...m.values()].sort((x, y) => x.d.localeCompare(y.d)).slice(-120);
}

function mergeSkill(a?: SkillProgress, b?: SkillProgress): SkillProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  const main = a.attempts >= b.attempts ? a : b;
  return { ...main, attempts: Math.max(a.attempts, b.attempts), correct: Math.max(a.correct, b.correct), days: mergeDays(a.days, b.days) };
}

function union<T>(a: T[], b: T[], key: (x: T) => string, sort: (x: T) => number, cap: number): T[] {
  const m = new Map<string, T>();
  for (const x of [...a, ...b]) m.set(key(x), x);
  return [...m.entries()]
    .sort((x, y) => sort(x[1]) - sort(y[1]) || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .map(([, v]) => v)
    .slice(-cap);
}

function mergeUnitTests(a: NonNullable<Child['unitTests']>, b: NonNullable<Child['unitTests']>): NonNullable<Child['unitTests']> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    out[k] = cur ? { topic: cur.topic, pre: cur.pre ?? v.pre, post: Math.max(cur.post ?? -1, v.post ?? -1) < 0 ? undefined : Math.max(cur.post ?? -1, v.post ?? -1) } : v;
    if (out[k].post === undefined) delete out[k].post;
    if (out[k].pre === undefined) delete out[k].pre;
  }
  return out;
}

function mergeMax(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

function mergeReview(a: NonNullable<Child['review']>, b: NonNullable<Child['review']>): NonNullable<Child['review']> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const o = out[k];
    // the lower box wins: a recent mistake on either device means the word needs more practice
    if (!o || v.box < o.box || (v.box === o.box && v.due < o.due)) out[k] = v;
  }
  return out;
}

function countMap(list: string[]): Map<string, number> {
  const m = new Map<string, number>();
  list.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return m;
}

export function mergeChild(a: Child, b: Child): Child {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const wa = walletOf(a);
  const wb = walletOf(b);
  const wallet: Wallet = {};
  for (const k of new Set([...Object.keys(wa), ...Object.keys(wb)]))
    wallet[k] = { e: Math.max(wa[k]?.e ?? 0, wb[k]?.e ?? 0), s: Math.max(wa[k]?.s ?? 0, wb[k]?.s ?? 0) };

  const skills: Partial<Record<SkillId, SkillProgress>> = {};
  for (const k of new Set([...Object.keys(a.skills), ...Object.keys(b.skills)]) as Set<SkillId>) skills[k] = mergeSkill(a.skills[k], b.skills[k]);

  const pairs: Record<string, number> = { ...a.pairs };
  for (const [k, v] of Object.entries(b.pairs)) pairs[k] = Math.max(pairs[k] ?? 0, v);

  // owned items: keep every purchase made on either device (max count per item)
  const ca = countMap(a.room.owned);
  const cb = countMap(b.room.owned);
  const owned: string[] = [];
  for (const k of [...new Set([...ca.keys(), ...cb.keys()])].sort()) for (let i = 0; i < Math.max(ca.get(k) ?? 0, cb.get(k) ?? 0); i++) owned.push(k);

  const wa2 = a.worlds;
  const wb2 = b.worlds;
  const progress = (w: Child['worlds']) => w.length * 10 + (w[w.length - 1]?.done ?? 0);
  const worlds = progress(wa2) >= progress(wb2) ? wa2 : wb2;

  const lastDay = a.lastActiveDay >= b.lastActiveDay ? a : b;

  return {
    ...newer,
    wallet,
    points: pointsOf(wallet),
    totalEarned: Math.max(a.totalEarned, b.totalEarned),
    skills,
    pairs,
    mistakes: union<MistakeRecord>(a.mistakes, b.mistakes, (m) => `${m.t}|${m.expected}|${m.typed}`, (m) => m.t, 300),
    writings: union<WritingRecord>(a.writings, b.writings, (w) => String(w.t), (w) => w.t, 60),
    seenTricks: [...new Set([...a.seenTricks, ...b.seenTricks])].sort(),
    gameStars: mergeMax(a.gameStars ?? {}, b.gameStars ?? {}),
    seenTips: [...new Set([...(a.seenTips ?? []), ...(b.seenTips ?? [])])].sort(),
    review: mergeReview(a.review ?? {}, b.review ?? {}),
    learnedWords: Math.max(a.learnedWords ?? 0, b.learnedWords ?? 0),
    diagnosed: a.diagnosed || b.diagnosed,
    worlds,
    ...(a.path || b.path
      ? { path: { level: Math.max(a.path?.level ?? 1, b.path?.level ?? 1), stars: mergeMax(a.path?.stars ?? {}, b.path?.stars ?? {}) } }
      : {}),
    ...(a.daily || b.daily ? { daily: mergeMax(a.daily ?? {}, b.daily ?? {}) } : {}),
    ...(a.unitTests || b.unitTests ? { unitTests: mergeUnitTests(a.unitTests ?? {}, b.unitTests ?? {}) } : {}),
    ...(a.weekDone || b.weekDone ? { weekDone: (a.weekDone ?? '') > (b.weekDone ?? '') ? a.weekDone : b.weekDone } : {}),
    ...(a.coinWallet || b.coinWallet ? { coinWallet: mergeWallet(a.coinWallet ?? {}, b.coinWallet ?? {}) } : {}),
    ...(a.arcade || b.arcade ? { arcade: mergeArcade(a.arcade ?? {}, b.arcade ?? {}) } : {}),
    streak: lastDay.streak,
    lastActiveDay: lastDay.lastActiveDay,
    room: { ...newer.room, owned },
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/** JSON with sorted object keys, so two equal children compare equal whatever order their keys were written in. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  return v;
}

/** Same content, ignoring the edit timestamp. */
export function sameChild(a: Child, b: Child): boolean {
  return JSON.stringify(canonical({ ...a, updatedAt: 0 })) === JSON.stringify(canonical({ ...b, updatedAt: 0 }));
}

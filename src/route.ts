import { isCatKey, catIdOf } from './listView';
import type { Category, MapCell, Product, StoreMap } from './types';

// Walking route through a store map. The map is a grid seen from above;
// shelves are not walkable, and an item is picked up from a walkable cell
// next to its shelf.

export type Pt = [number, number];
const key = (r: number, c: number) => `${r},${c}`;
const DIRS: Pt[] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

export const cellOf = (map: StoreMap, r: number, c: number): MapCell => map.cells[key(r, c)] ?? { kind: 'floor' };
const inside = (map: StoreMap, r: number, c: number) => r >= 0 && c >= 0 && r < map.rows && c < map.cols;
export const walkable = (map: StoreMap, r: number, c: number) => inside(map, r, c) && ['floor', 'entrance', 'checkout'].includes(cellOf(map, r, c).kind);

function findKind(map: StoreMap, kind: MapCell['kind']): Pt[] {
  const out: Pt[] = [];
  for (const [k, cell] of Object.entries(map.cells)) {
    if (cell.kind !== kind) continue;
    const [r, c] = k.split(',').map(Number);
    if (inside(map, r, c)) out.push([r, c]);
  }
  return out.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
}

/** Where shopping starts: the entrance, or failing that the bottom-right walkable cell. */
export function startPoint(map: StoreMap): Pt | null {
  const e = findKind(map, 'entrance')[0];
  if (e) return e;
  for (let r = map.rows - 1; r >= 0; r--) for (let c = map.cols - 1; c >= 0; c--) if (walkable(map, r, c)) return [r, c];
  return null;
}
export const endPoint = (map: StoreMap): Pt | null => findKind(map, 'checkout')[0] ?? null;

interface Bfs {
  dist: Map<string, number>;
  prev: Map<string, string>;
}
function bfs(map: StoreMap, from: Pt): Bfs {
  const dist = new Map([[key(...from), 0]]);
  const prev = new Map<string, string>();
  const queue: Pt[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const [r, c] = queue[i];
    const d = dist.get(key(r, c))!;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      const k = key(nr, nc);
      if (!walkable(map, nr, nc) || dist.has(k)) continue;
      dist.set(k, d + 1);
      prev.set(k, key(r, c));
      queue.push([nr, nc]);
    }
  }
  return { dist, prev };
}
function pathTo(b: Bfs, to: Pt): Pt[] {
  const out: Pt[] = [];
  let k: string | undefined = key(...to);
  while (k) {
    out.push(k.split(',').map(Number) as Pt);
    k = b.prev.get(k);
  }
  return out.reverse();
}

/** Shelf cells that hold a product: its own placement, else its category's (nearest ancestor wins). */
export function shelvesFor(map: StoreMap, listKey: string, products: Product[], categories: Category[]): Pt[] {
  const shelves = Object.entries(map.cells).filter(([, c]) => c.kind === 'shelf');
  const at = (pred: (c: MapCell) => boolean) => shelves.filter(([, c]) => pred(c)).map(([k]) => k.split(',').map(Number) as Pt);
  let catId: string | null;
  if (isCatKey(listKey)) {
    catId = catIdOf(listKey);
    // A whole category: its own shelves, else any shelf holding one of its subcategories.
    const own = at((c) => !!c.catIds?.includes(catId!));
    if (own.length) return own;
    const subs = new Set(categories.filter((c) => c.parentId === catId).map((c) => c.id));
    const sub = at((c) => !!c.catIds?.some((id) => subs.has(id)));
    if (sub.length) return sub;
  } else {
    const direct = at((c) => !!c.productIds?.includes(listKey));
    if (direct.length) return direct;
    catId = products.find((p) => p.id === listKey)?.categoryId ?? null;
  }
  for (let id = catId; id; id = categories.find((c) => c.id === id)?.parentId ?? null) {
    const found = at((c) => !!c.catIds?.includes(id!));
    if (found.length) return found;
  }
  return [];
}

export interface Stop {
  keys: string[];
  /** Where to stand. */
  point: Pt;
  /** The shelf being faced. */
  shelf: Pt;
  /** Path from the previous stop (or the entrance) to here, inclusive. */
  leg: Pt[];
}

export interface Route {
  start: Pt;
  stops: Stop[];
  /** Path from the last stop to the checkout, if there is one. */
  exit: Pt[];
  unplaced: string[];
  /** Total walking length in cells. */
  length: number;
}

export function planRoute(map: StoreMap, keys: string[], products: Product[], categories: Category[]): Route | null {
  const start = startPoint(map);
  if (!start) return null;
  const end = endPoint(map);

  // Candidate standing points for every item.
  const candidates = new Map<string, { point: Pt; shelf: Pt }[]>();
  const unplaced: string[] = [];
  for (const k of keys) {
    const opts: { point: Pt; shelf: Pt }[] = [];
    for (const shelf of shelvesFor(map, k, products, categories)) {
      for (const [dr, dc] of DIRS) {
        const p: Pt = [shelf[0] + dr, shelf[1] + dc];
        if (walkable(map, ...p)) opts.push({ point: p, shelf });
      }
    }
    if (opts.length) candidates.set(k, opts);
    else unplaced.push(k);
  }

  const cache = new Map<string, Bfs>();
  const from = (p: Pt) => {
    const k = key(...p);
    if (!cache.has(k)) cache.set(k, bfs(map, p));
    return cache.get(k)!;
  };
  const d = (a: Pt, b: Pt) => from(a).dist.get(key(...b)) ?? Infinity;

  // Greedy nearest-neighbour: always walk to the closest remaining item.
  const remaining = new Set(candidates.keys());
  const seq: { keys: string[]; point: Pt; shelf: Pt }[] = [];
  let cur = start;
  while (remaining.size) {
    let best: { k: string; point: Pt; shelf: Pt; dist: number } | null = null;
    for (const k of remaining) {
      for (const o of candidates.get(k)!) {
        const dist = d(cur, o.point);
        if (!best || dist < best.dist) best = { k, ...o, dist };
      }
    }
    if (!best || best.dist === Infinity) {
      // Shelf not reachable from here (walled off): treat as unplaced.
      for (const k of remaining) unplaced.push(k);
      break;
    }
    remaining.delete(best.k);
    const last = seq[seq.length - 1];
    if (last && last.point[0] === best.point[0] && last.point[1] === best.point[1]) last.keys.push(best.k);
    else seq.push({ keys: [best.k], point: best.point, shelf: best.shelf });
    cur = best.point;
  }

  // 2-opt: reverse segments while that shortens the walk (start fixed, checkout as the end if any).
  const cost = (order: typeof seq) => {
    let total = 0;
    let p = start;
    for (const s of order) {
      total += d(p, s.point);
      p = s.point;
    }
    return total + (end ? d(p, end) : 0);
  };
  let improved = true;
  let bestCost = cost(seq);
  for (let pass = 0; improved && pass < 30; pass++) {
    improved = false;
    for (let i = 0; i < seq.length - 1; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        const trial = [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)];
        const c = cost(trial);
        if (c < bestCost) {
          seq.splice(0, seq.length, ...trial);
          bestCost = c;
          improved = true;
        }
      }
    }
  }

  const stops: Stop[] = [];
  let p = start;
  for (const s of seq) {
    stops.push({ ...s, leg: pathTo(from(p), s.point) });
    p = s.point;
  }
  const exit = end ? pathTo(from(p), end) : [];
  return { start, stops, exit, unplaced, length: bestCost };
}

// ---------- turn-by-turn ----------

const headingOf = (a: Pt, b: Pt) => DIRS.findIndex(([dr, dc]) => b[0] - a[0] === dr && b[1] - a[1] === dc);

export interface Instruction {
  text: string;
  /** 'straight' | 'left' | 'right' | 'back' | 'here' – for the arrow icon. */
  icon: 'straight' | 'left' | 'right' | 'back' | 'here';
}

/** "Walk 4 steps, then turn right" style guidance for one leg, plus which side the shelf is on. */
export function describeLeg(leg: Pt[], shelf: Pt, arrivingHeading: number | null): Instruction[] {
  const out: Instruction[] = [];
  let heading = arrivingHeading;
  let run = 0;
  for (let i = 1; i < leg.length; i++) {
    const h = headingOf(leg[i - 1], leg[i]);
    if (heading === null || h === heading) {
      run++;
      heading = h;
      continue;
    }
    const turn = (h - heading + 4) % 4;
    if (run) out.push({ text: `ישר ${run} ${run === 1 ? 'צעד' : 'צעדים'}`, icon: 'straight' });
    out.push(turn === 1 ? { text: 'פנה ימינה', icon: 'right' } : turn === 3 ? { text: 'פנה שמאלה', icon: 'left' } : { text: 'הסתובב אחורה', icon: 'back' });
    heading = h;
    run = 1;
  }
  if (run) out.push({ text: `ישר ${run} ${run === 1 ? 'צעד' : 'צעדים'}`, icon: 'straight' });
  const standing = leg[leg.length - 1];
  const side = heading === null ? null : (headingOf(standing, shelf) - heading + 4) % 4;
  out.push({
    text: side === 1 ? 'המדף מימינך' : side === 3 ? 'המדף משמאלך' : side === 0 ? 'המדף מולך' : 'המדף מאחוריך',
    icon: 'here',
  });
  return out;
}

export function finalHeading(leg: Pt[]): number | null {
  return leg.length > 1 ? headingOf(leg[leg.length - 2], leg[leg.length - 1]) : null;
}

/** Sample store: aisles of shelves between a back wall and the checkouts, entrance bottom-right. */
export function sampleMap(topCategoryIds: string[]): StoreMap {
  const rows = 14;
  const cols = 11;
  const cells: Record<string, MapCell> = {};
  const put = (r: number, c: number, cell: MapCell) => (cells[key(r, c)] = cell);
  for (let c = 0; c < cols; c++) put(0, c, { kind: 'shelf' }); // back wall shelves (fridges)
  const aisleCols = [2, 5, 8];
  for (const c of aisleCols) {
    for (let r = 2; r <= 9; r++) {
      put(r, c, { kind: 'shelf' });
      put(r, c + 1, { kind: 'shelf' });
    }
  }
  put(rows - 1, cols - 1, { kind: 'entrance' });
  for (let c = 0; c <= 3; c++) put(rows - 2, c, { kind: 'checkout' });
  // Assign categories to shelf runs in walking order from the entrance side.
  const runs: Pt[][] = [];
  for (const c of [...aisleCols].reverse()) {
    runs.push([2, 3, 4, 5].map((r) => [r, c + 1] as Pt), [6, 7, 8, 9].map((r) => [r, c + 1] as Pt));
    runs.push([2, 3, 4, 5].map((r) => [r, c] as Pt), [6, 7, 8, 9].map((r) => [r, c] as Pt));
  }
  runs.push(Array.from({ length: cols }, (_, c) => [0, c] as Pt));
  topCategoryIds.forEach((id, i) => {
    const run = runs[i % runs.length];
    for (const [r, c] of run) {
      const cell = cells[key(r, c)];
      cell.catIds = [...(cell.catIds ?? []), id];
    }
  });
  aisleCols.forEach((c, i) => {
    cells[key(2, c)].label = `מעבר ${aisleCols.length - i}`;
  });
  return { rows, cols, cells };
}

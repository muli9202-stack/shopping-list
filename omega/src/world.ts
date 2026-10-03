import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, pick, rand, randInt } from './util';

// ---------------------------------------------------------------------------
// City layout. An 8x8 grid of blocks separated by roads; the airport lies to
// the west, the beach and the sea to the east. Everything else in the game
// (traffic, pedestrians, police, the minimap) reads the layout from here.
// ---------------------------------------------------------------------------

export const GRID = 8;
export const BLOCK = 64;
export const ROAD = 18;
export const CELL = BLOCK + ROAD;
export const HALF = (GRID * CELL) / 2;
export const roadLine = (k: number) => -HALF + k * CELL;
export const BEACH_X = HALF + ROAD / 2;
export const SEA_X = HALF + 70;
export const AIRPORT = { minX: -HALF - 300, maxX: -HALF - 30, minZ: -230, maxZ: 230 };
export const BOUNDS = { minX: -HALF - 330, maxX: HALF + 430, minZ: -HALF - 70, maxZ: HALF + 70 };

export type Surface = 'asphalt' | 'dirt' | 'sand' | 'grass' | 'water';
export type BlockKind = 'downtown' | 'mid' | 'residential' | 'park' | 'hill' | 'construction';

export interface Box {
  id: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y0: number;
  h: number;
  kind: 'building' | 'hill' | 'roof';
}

export interface Place {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: 'police' | 'hospital' | 'garage' | 'gunshop' | 'business' | 'docks' | 'helipad' | 'safehouse';
}

export const V_STREETS = ['שדרות הים', 'רחוב האורן', 'רחוב הנמל', 'רחוב התעשייה', 'שדרות המרכז', 'רחוב הגפן', 'רחוב החשמל', 'רחוב המגדלור', 'טיילת החוף'];
export const H_STREETS = ['דרך הצפון', 'רחוב הברזל', 'רחוב השוק', 'רחוב המנהרה', 'שדרות העירייה', 'רחוב הכנסייה', 'רחוב הפועלים', 'רחוב הארבה', 'דרך הדרום'];

/** The road segment that runs under the hill (the tunnel). */
export const TUNNEL = { minX: roadLine(4) - ROAD / 2, maxX: roadLine(4) + ROAD / 2, minZ: roadLine(2) + ROAD / 2, maxZ: roadLine(3) - ROAD / 2, roof: 9 };

export const blockMin = (i: number) => roadLine(i) + ROAD / 2;
export const blockMax = (i: number) => roadLine(i + 1) - ROAD / 2;
export const blockCenter = (i: number) => (blockMin(i) + blockMax(i)) / 2;

export function blockIndexAt(x: number, z: number): [number, number] | null {
  const i = Math.floor((x + HALF) / CELL);
  const j = Math.floor((z + HALF) / CELL);
  if (i < 0 || j < 0 || i >= GRID || j >= GRID) return null;
  if (x < blockMin(i) || x > blockMax(i) || z < blockMin(j) || z > blockMax(j)) return null;
  return [i, j];
}

export function inTunnel(x: number, z: number) {
  return x > TUNNEL.minX && x < TUNNEL.maxX && z > TUNNEL.minZ && z < TUNNEL.maxZ;
}

export function waveHeight(x: number, z: number, t: number) {
  return 0.35 * Math.sin(0.15 * x + 1.3 * t) + 0.25 * Math.sin(0.21 * z + 0.9 * t) + 0.12 * Math.sin(0.5 * (x + z) + 2.1 * t);
}

/** Nearest road centre line to a point: returns the axis and the index of the line. */
export function nearestRoad(x: number, z: number) {
  const kx = clamp(Math.round((x + HALF) / CELL), 0, GRID);
  const kz = clamp(Math.round((z + HALF) / CELL), 0, GRID);
  const dx = Math.abs(x - roadLine(kx));
  const dz = Math.abs(z - roadLine(kz));
  return { kx, kz, dx, dz };
}

export function streetName(x: number, z: number) {
  if (x > BEACH_X + 10) return x > SEA_X ? 'הים הפתוח' : 'חוף הים';
  if (x < AIRPORT.maxX + 10 && z > AIRPORT.minZ && z < AIRPORT.maxZ) return 'נמל התעופה';
  if (inTunnel(x, z)) return 'מנהרת הגבעה';
  const { kx, kz, dx, dz } = nearestRoad(x, z);
  if (dx < ROAD && dz < ROAD) return `${V_STREETS[kx]} פינת ${H_STREETS[kz]}`;
  return dx < dz ? V_STREETS[kx] : H_STREETS[kz];
}

export class World {
  boxes: Box[] = [];
  places: Place[] = [];
  kinds: BlockKind[][] = [];
  private hash = new Map<number, number[]>();
  private stamp = 0;
  private marks: number[] = [];
  readonly cellSize = 32;
  constructionBox!: Box;
  constructionMesh!: THREE.Mesh;
  smoke: { x: number; y: number; z: number; r: number; until: number }[] = [];
  group = new THREE.Group();
  waterMesh!: THREE.Mesh;
  roadMat!: THREE.MeshStandardMaterial;
  windowMat!: THREE.MeshStandardMaterial;
  lampMat!: THREE.MeshStandardMaterial;
  trees: { x: number; z: number }[] = [];

  constructor() {
    for (let i = 0; i < GRID; i++) {
      this.kinds[i] = [];
      for (let j = 0; j < GRID; j++) {
        const c = Math.max(Math.abs(i - 3.5), Math.abs(j - 3.5));
        let k: BlockKind = c < 1.6 ? 'downtown' : c < 2.6 ? 'mid' : 'residential';
        this.kinds[i][j] = k;
      }
    }
    this.kinds[3][2] = 'hill';
    this.kinds[4][2] = 'hill';
    this.kinds[1][5] = 'park';
    this.kinds[6][6] = 'park';
    this.kinds[5][1] = 'construction';
    this.layout();
  }

  // ---- layout -------------------------------------------------------------

  private addBox(minX: number, maxX: number, minZ: number, maxZ: number, h: number, kind: Box['kind'] = 'building', y0 = 0) {
    const b: Box = { id: this.boxes.length, minX, maxX, minZ, maxZ, h, y0, kind };
    this.boxes.push(b);
    this.marks.push(0);
    const s = this.cellSize;
    for (let cx = Math.floor(minX / s); cx <= Math.floor(maxX / s); cx++)
      for (let cz = Math.floor(minZ / s); cz <= Math.floor(maxZ / s); cz++) {
        const key = this.key(cx, cz);
        let list = this.hash.get(key);
        if (!list) this.hash.set(key, (list = []));
        list.push(b.id);
      }
    return b;
  }

  private key(cx: number, cz: number) {
    return (cx + 1000) * 4096 + (cz + 1000);
  }

  private layout() {
    for (let i = 0; i < GRID; i++)
      for (let j = 0; j < GRID; j++) {
        const kind = this.kinds[i][j];
        const x0 = blockMin(i) + 5, x1 = blockMax(i) - 5, z0 = blockMin(j) + 5, z1 = blockMax(j) - 5;
        if (kind === 'park') {
          for (let n = 0; n < 22; n++) this.trees.push({ x: rand(x0, x1), z: rand(z0, z1) });
          continue;
        }
        if (kind === 'hill') {
          // The hill covers the block; the tunnel road between the two hill blocks stays open.
          this.addBox(blockMin(i) + 2, blockMax(i) - 2, blockMin(j) + 2, blockMax(j) - 2, 16, 'hill');
          continue;
        }
        if (kind === 'construction') {
          this.constructionBox = this.addBox(x0 + 10, x1 - 10, z0 + 10, z1 - 10, 4);
          continue;
        }
        const n = kind === 'downtown' ? 2 : 3;
        const gap = 4; // alleys between buildings
        const w = (x1 - x0 - gap * (n - 1)) / n;
        const d = (z1 - z0 - gap * (n - 1)) / n;
        for (let a = 0; a < n; a++)
          for (let b = 0; b < n; b++) {
            if (kind === 'residential' && Math.random() < 0.18) continue; // empty lot
            const bx = x0 + a * (w + gap), bz = z0 + b * (d + gap);
            const h = kind === 'downtown' ? rand(45, 120) : kind === 'mid' ? rand(14, 38) : rand(6, 13);
            const inset = kind === 'residential' ? rand(0, 2) : 0;
            this.addBox(bx + inset, bx + w - inset, bz + inset, bz + d - inset, h);
          }
      }
    // Airport hangars and terminal
    this.addBox(AIRPORT.minX + 20, AIRPORT.minX + 70, -200, -150, 18);
    this.addBox(AIRPORT.minX + 20, AIRPORT.minX + 70, 150, 200, 18);
    this.addBox(AIRPORT.minX + 15, AIRPORT.minX + 45, -60, 60, 14);
    // Tunnel roof: only aircraft collide with it.
    this.addBox(TUNNEL.minX, TUNNEL.maxX, TUNNEL.minZ, TUNNEL.maxZ, 16, 'roof', TUNNEL.roof);

    const front = (i: number, j: number) => ({ x: blockCenter(i), z: blockMin(j) + 2.5 });
    const place = (id: string, name: string, kind: Place['kind'], i: number, j: number) => this.places.push({ id, name, kind, ...front(i, j) });
    place('police', 'תחנת משטרה', 'police', 2, 3);
    place('hospital', 'בית חולים', 'hospital', 5, 5);
    place('garage', 'מוסך שיפורים', 'garage', 1, 1);
    place('gunshop', 'חנות נשק', 'gunshop', 6, 3);
    place('safehouse', 'דירת מסתור', 'safehouse', 2, 6);
    place('club', 'מועדון לילה "נאון"', 'business', 3, 6);
    place('taxi', 'חברת מוניות "צהוב"', 'business', 0, 4);
    place('build', 'אתר בנייה', 'business', 5, 1);
    place('carwash', 'שטיפת מכוניות', 'business', 7, 2);
    place('ammo', 'חנות הנשק (בעלות)', 'business', 6, 4);
    this.places.push({ id: 'docks', name: 'רציף הנמל', kind: 'docks', x: SEA_X - 6, z: 40 });
  }

  // ---- queries ------------------------------------------------------------

  boxesIn(minX: number, maxX: number, minZ: number, maxZ: number, out: Box[] = []) {
    out.length = 0;
    const s = this.cellSize;
    const st = ++this.stamp;
    for (let cx = Math.floor(minX / s); cx <= Math.floor(maxX / s); cx++)
      for (let cz = Math.floor(minZ / s); cz <= Math.floor(maxZ / s); cz++) {
        const list = this.hash.get(this.key(cx, cz));
        if (!list) continue;
        for (const id of list) {
          if (this.marks[id] === st) continue;
          this.marks[id] = st;
          out.push(this.boxes[id]);
        }
      }
    return out;
  }

  private tmp: Box[] = [];

  /** Push a circle at height y out of every building it overlaps. Returns the collision normal and depth, if any. */
  collideCircle(x: number, z: number, r: number, y = 1) {
    let px = x, pz = z, hit = false, nx = 0, nz = 0, depth = 0;
    for (const b of this.boxesIn(x - r, x + r, z - r, z + r, this.tmp)) {
      if (y < b.y0 || y > b.h) continue;
      const cx = clamp(px, b.minX, b.maxX), cz = clamp(pz, b.minZ, b.maxZ);
      let dx = px - cx, dz = pz - cz;
      let d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-4) {
        // Centre inside the box: push out along the shortest axis.
        const opts = [
          [px - b.minX, -1, 0],
          [b.maxX - px, 1, 0],
          [pz - b.minZ, 0, -1],
          [b.maxZ - pz, 0, 1],
        ];
        opts.sort((a, c) => a[0] - c[0]);
        dx = opts[0][1];
        dz = opts[0][2];
        d = -opts[0][0];
      } else {
        dx /= d;
        dz /= d;
      }
      const pen = r - d;
      px += dx * pen;
      pz += dz * pen;
      if (pen > depth) {
        depth = pen;
        nx = dx;
        nz = dz;
      }
      hit = true;
    }
    return { x: px, z: pz, hit, nx, nz, depth };
  }

  /** Height of the tallest building under a point (0 for open ground). */
  groundHeight(x: number, z: number) {
    let h = 0;
    for (const b of this.boxesIn(x, x, z, z, this.tmp)) if (b.kind !== 'roof' && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) h = Math.max(h, b.h);
    return h;
  }

  /**
   * First intersection of a 3D segment with the city geometry, as a fraction t
   * of the segment (null when clear). `skipBoxes` lets anti-materiel rounds
   * pass through walls; `smoke` makes smoke clouds opaque (AI vision).
   */
  raycast(ax: number, ay: number, az: number, bx: number, by: number, bz: number, opts: { skipBoxes?: number; smoke?: boolean; now?: number } = {}) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    let best: { t: number; box: Box | null; nx: number; ny: number; nz: number } | null = null;
    const cands = this.boxesIn(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), this.tmp);
    const hits: { t: number; box: Box; nx: number; ny: number; nz: number }[] = [];
    for (const b of cands) {
      let tmin = 0, tmax = 1, nx = 0, ny = 0, nz = 0;
      const axes: [number, number, number, number, number][] = [
        [ax, dx, b.minX, b.maxX, 0],
        [ay, dy, b.y0, b.h, 1],
        [az, dz, b.minZ, b.maxZ, 2],
      ];
      let ok = true;
      for (const [o, d, lo, hi, ax3] of axes) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) { ok = false; break; }
          continue;
        }
        let t1 = (lo - o) / d, t2 = (hi - o) / d, sign = -1;
        if (t1 > t2) { [t1, t2] = [t2, t1]; sign = 1; }
        if (t1 > tmin) {
          tmin = t1;
          nx = ax3 === 0 ? sign : 0;
          ny = ax3 === 1 ? sign : 0;
          nz = ax3 === 2 ? sign : 0;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
      if (ok) hits.push({ t: tmin, box: b, nx, ny, nz });
    }
    hits.sort((a, b) => a.t - b.t);
    const skip = opts.skipBoxes ?? 0;
    if (hits.length > skip) best = hits[skip];
    if (opts.smoke && opts.now !== undefined) {
      const len = Math.hypot(dx, dy, dz) || 1;
      for (const s of this.smoke) {
        if (s.until < opts.now) continue;
        // closest approach of the segment to the smoke centre
        const t = clamp(((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / (len * len), 0, 1);
        const d = Math.hypot(ax + dx * t - s.x, ay + dy * t - s.y, az + dz * t - s.z);
        if (d < s.r && (!best || t < best.t)) best = { t, box: null, nx: 0, ny: 0, nz: 0 };
      }
    }
    return best;
  }

  surfaceAt(x: number, z: number): Surface {
    if (x > SEA_X) return 'water';
    if (x > BEACH_X + 6) return 'sand';
    if (x < AIRPORT.maxX && x > AIRPORT.minX && z > AIRPORT.minZ && z < AIRPORT.maxZ) return 'asphalt';
    const { kx, kz, dx, dz } = nearestRoad(x, z);
    void kx;
    void kz;
    const inGrid = x > -HALF - ROAD && x < HALF + ROAD && z > -HALF - ROAD && z < HALF + ROAD;
    if (dz < ROAD / 2 && x < HALF + ROAD) return 'asphalt'; // east-west roads run to the airport
    if (inGrid && dx < ROAD / 2) return 'asphalt';
    const blk = blockIndexAt(x, z);
    if (blk) {
      const k = this.kinds[blk[0]][blk[1]];
      return k === 'park' || k === 'construction' ? 'dirt' : 'asphalt';
    }
    return 'grass';
  }

  /** Random point on a sidewalk (the 4 m strip inside each block's edge). */
  randomSidewalk(near?: { x: number; z: number }, radius = 140) {
    for (let tries = 0; tries < 30; tries++) {
      let i: number, j: number;
      if (near) {
        i = clamp(Math.floor((near.x + rand(-radius, radius) + HALF) / CELL), 0, GRID - 1);
        j = clamp(Math.floor((near.z + rand(-radius, radius) + HALF) / CELL), 0, GRID - 1);
      } else {
        i = randInt(0, GRID - 1);
        j = randInt(0, GRID - 1);
      }
      if (this.kinds[i][j] === 'hill') continue;
      return { ...this.sidewalkPoint(i, j, Math.random()), i, j };
    }
    return { x: blockMin(0) + 2, z: blockMin(0) + 2, i: 0, j: 0 };
  }

  /** Point at fraction f (0..1) around the sidewalk ring of block (i, j). */
  sidewalkPoint(i: number, j: number, f: number) {
    const x0 = blockMin(i) + 2.2, x1 = blockMax(i) - 2.2, z0 = blockMin(j) + 2.2, z1 = blockMax(j) - 2.2;
    const w = x1 - x0, d = z1 - z0, per = 2 * (w + d);
    let s = ((f % 1) + 1) % 1 * per;
    if (s < w) return { x: x0 + s, z: z0 };
    s -= w;
    if (s < d) return { x: x1, z: z0 + s };
    s -= d;
    if (s < w) return { x: x1 - s, z: z1 };
    s -= w;
    return { x: x0, z: z1 - s };
  }

  /** Road position in a lane: the node (kx, kz) is an intersection. */
  nodePos(kx: number, kz: number) {
    return { x: roadLine(kx), z: roadLine(kz) };
  }

  randomRoadPointNear(x: number, z: number, minD: number, maxD: number) {
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = rand(minD, maxD);
      let px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      const { kx, kz, dx, dz } = nearestRoad(px, pz);
      if (dx < dz) px = roadLine(kx);
      else pz = roadLine(kz);
      if (Math.abs(px) > HALF + 1 || Math.abs(pz) > HALF + 1) continue;
      if (inTunnel(px, pz)) continue;
      return { x: px, z: pz, alongX: dx >= dz };
    }
    return null;
  }

  // ---- rendering ----------------------------------------------------------

  build(scene: THREE.Scene, quality: 'low' | 'high') {
    scene.add(this.group);
    const g = this.group;
    const shadows = quality === 'high';

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX + 600, BOUNDS.maxZ - BOUNDS.minZ + 600), new THREE.MeshStandardMaterial({ color: 0x5d7a46, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((BOUNDS.minX + BOUNDS.maxX) / 2, -0.05, 0);
    ground.receiveShadow = shadows;
    g.add(ground);

    this.roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.92, metalness: 0 });
    const roadW = GRID * CELL + ROAD;
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(roadW, roadW), this.roadMat);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = shadows;
    g.add(asphalt);
    // East-west roads continue west to the airport.
    for (let k = 0; k <= GRID; k++) {
      const len = HALF - AIRPORT.maxX;
      const r = new THREE.Mesh(new THREE.PlaneGeometry(len, ROAD), this.roadMat);
      r.rotation.x = -Math.PI / 2;
      r.position.set(AIRPORT.maxX + len / 2 - HALF, 0.01, roadLine(k));
      if (k % 2 === 0) g.add(r);
    }
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(AIRPORT.maxX - AIRPORT.minX, AIRPORT.maxZ - AIRPORT.minZ), this.roadMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set((AIRPORT.minX + AIRPORT.maxX) / 2, 0.01, 0);
    g.add(apron);

    // Lane markings
    const dashGeo: THREE.BufferGeometry[] = [];
    for (let k = 0; k <= GRID; k++)
      for (let s = -HALF; s < HALF; s += 8) {
        if (Math.abs(((s + HALF) % CELL) - 0) < ROAD) continue;
        const a = new THREE.PlaneGeometry(0.3, 3.5);
        a.rotateX(-Math.PI / 2);
        a.translate(roadLine(k), 0.03, s);
        dashGeo.push(a);
        const b = new THREE.PlaneGeometry(3.5, 0.3);
        b.rotateX(-Math.PI / 2);
        b.translate(s, 0.03, roadLine(k));
        dashGeo.push(b);
      }
    for (let s = AIRPORT.minZ + 20; s < AIRPORT.maxZ - 20; s += 20) {
      const a = new THREE.PlaneGeometry(1, 10);
      a.rotateX(-Math.PI / 2);
      a.translate(AIRPORT.maxX - 60, 0.03, s);
      dashGeo.push(a);
    }
    g.add(new THREE.Mesh(mergeGeometries(dashGeo), new THREE.MeshBasicMaterial({ color: 0xd8d2b0 })));

    // Sidewalks (blocks)
    const walkGeo: THREE.BufferGeometry[] = [];
    const parkGeo: THREE.BufferGeometry[] = [];
    for (let i = 0; i < GRID; i++)
      for (let j = 0; j < GRID; j++) {
        const w = BLOCK, k = this.kinds[i][j];
        const geo = new THREE.BoxGeometry(w, 0.2, w);
        geo.translate(blockCenter(i), 0.1, blockCenter(j));
        (k === 'park' || k === 'construction' ? parkGeo : walkGeo).push(geo);
      }
    g.add(new THREE.Mesh(mergeGeometries(walkGeo), new THREE.MeshStandardMaterial({ color: 0x8d8c88, roughness: 0.95 })));
    g.add(new THREE.Mesh(mergeGeometries(parkGeo), new THREE.MeshStandardMaterial({ color: 0x6f5a3e, roughness: 1 })));

    // Beach and sea
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(SEA_X - BEACH_X + 40, BOUNDS.maxZ - BOUNDS.minZ + 400), new THREE.MeshStandardMaterial({ color: 0xd9c38f, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set((BEACH_X + SEA_X) / 2 + 10, 0.0, 0);
    g.add(sand);
    const seaGeo = new THREE.PlaneGeometry(700, 1100, 70, 110);
    seaGeo.rotateX(-Math.PI / 2);
    seaGeo.translate(SEA_X + 350, 0, 0);
    this.waterMesh = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x1f6f8b, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92, flatShading: true }));
    this.waterMesh.position.y = -0.3;
    g.add(this.waterMesh);
    // Pier
    const pier = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x6b4f35 }));
    pier.position.set(SEA_X + 10, 0.4, 40);
    g.add(pier);

    // Buildings: one merged mesh with tiled window UVs.
    const tex = makeWindowTexture(false);
    const emissive = makeWindowTexture(true);
    this.windowMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: emissive, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.55, metalness: 0.1, vertexColors: true });
    const geos: THREE.BufferGeometry[] = [];
    const hillGeos: THREE.BufferGeometry[] = [];
    const palette = [0xb7b1a6, 0x8f9aa6, 0xc9b49a, 0x7d8a8f, 0xa59a8c, 0x9ab0c0, 0xd1c7b8, 0x6f7c88];
    for (const b of this.boxes) {
      if (b === this.constructionBox) continue;
      const w = b.maxX - b.minX, d = b.maxZ - b.minZ, h = b.h - b.y0;
      const geo = new THREE.BoxGeometry(w, h, d);
      if (b.kind === 'building') tileUVs(geo, w, h, d);
      geo.translate((b.minX + b.maxX) / 2, b.y0 + h / 2, (b.minZ + b.maxZ) / 2);
      if (b.kind === 'building') {
        const c = new THREE.Color(pick(palette));
        const n = geo.attributes.position.count;
        const col = new Float32Array(n * 3);
        for (let v = 0; v < n; v++) c.toArray(col, v * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geos.push(geo);
      } else hillGeos.push(geo);
    }
    const city = new THREE.Mesh(mergeGeometries(geos), this.windowMat);
    city.castShadow = shadows;
    city.receiveShadow = shadows;
    g.add(city);
    const hill = new THREE.Mesh(mergeGeometries(hillGeos.map((h) => h.toNonIndexed())), new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 }));
    hill.castShadow = shadows;
    g.add(hill);
    // Tunnel lights
    for (let z = TUNNEL.minZ + 4; z < TUNNEL.maxZ; z += 8) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(ROAD - 2, 0.15, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
      l.position.set(roadLine(4), TUNNEL.roof - 0.1, z);
      g.add(l);
    }

    // Construction site: the building grows as days pass, plus a crane.
    const cb = this.constructionBox;
    this.constructionMesh = new THREE.Mesh(new THREE.BoxGeometry(cb.maxX - cb.minX, 1, cb.maxZ - cb.minZ), new THREE.MeshStandardMaterial({ color: 0x9c9a92, roughness: 0.9, wireframe: false }));
    this.constructionMesh.position.set((cb.minX + cb.maxX) / 2, 0, (cb.minZ + cb.maxZ) / 2);
    g.add(this.constructionMesh);
    const crane = new THREE.Group();
    const yellow = new THREE.MeshStandardMaterial({ color: 0xe0b020 });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 70, 2), yellow);
    mast.position.y = 35;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(50, 1.5, 1.5), yellow);
    jib.position.set(15, 70, 0);
    crane.add(mast, jib);
    crane.position.set(cb.maxX + 4, 0, cb.minZ - 2);
    g.add(crane);

    // Trees
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 6);
    const crownGeo = new THREE.ConeGeometry(2.4, 6, 7);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5a3d26 }), this.trees.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0x2f6b32 }), this.trees.length);
    const m = new THREE.Matrix4();
    this.trees.forEach((t, n) => {
      m.makeTranslation(t.x, 1.5, t.z);
      trunks.setMatrixAt(n, m);
      m.makeTranslation(t.x, 5.5, t.z);
      crowns.setMatrixAt(n, m);
    });
    crowns.castShadow = shadows;
    g.add(trunks, crowns);

    // Street lamps at every intersection corner
    const lamps: { x: number; z: number }[] = [];
    for (let kx = 0; kx <= GRID; kx++)
      for (let kz = 0; kz <= GRID; kz++) lamps.push({ x: roadLine(kx) + ROAD / 2 + 1, z: roadLine(kz) + ROAD / 2 + 1 });
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 5), new THREE.MeshStandardMaterial({ color: 0x333333 }), lamps.length);
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0xffd28a, emissiveIntensity: 0 });
    const bulb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), this.lampMat, lamps.length);
    lamps.forEach((l, n) => {
      m.makeTranslation(l.x, 3.5, l.z);
      pole.setMatrixAt(n, m);
      m.makeTranslation(l.x, 7, l.z);
      bulb.setMatrixAt(n, m);
    });
    g.add(pole, bulb);

    // Runway
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(40, AIRPORT.maxZ - AIRPORT.minZ - 20), new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.9 }));
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(AIRPORT.maxX - 60, 0.02, 0);
    g.add(runway);
  }

  /** Called every frame: animates water and expires smoke clouds. */
  update(t: number, now: number, days: number) {
    const pos = this.waterMesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let n = 0; n < pos.count; n++) pos.setY(n, waveHeight(pos.getX(n), pos.getZ(n), t));
    pos.needsUpdate = true; // flat shading derives normals on the GPU
    this.smoke = this.smoke.filter((s) => s.until > now);
    // The construction project rises ~6 m per game day, up to 70 m.
    const cb = this.constructionBox;
    const h = Math.min(70, 4 + days * 6);
    if (Math.abs(cb.h - h) > 0.01) {
      cb.h = h;
      this.constructionMesh.scale.y = h;
      this.constructionMesh.position.y = h / 2;
    }
  }
}

function tileUVs(geo: THREE.BoxGeometry, w: number, h: number, d: number) {
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const faces = [
    [d, h],
    [d, h],
    [0, 0],
    [0, 0],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const idx = f * 4 + v;
      const [fw, fh] = faces[f];
      if (fw === 0) uv.setXY(idx, 0.02, 0.02);
      else uv.setXY(idx, uv.getX(idx) * Math.max(1, Math.round(fw / 12)), uv.getY(idx) * Math.max(1, Math.round(fh / 9)));
    }
}

function makeWindowTexture(emissive: boolean) {
  // 2x2 windows per tile; at night a random subset of them is lit.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = emissive ? '#000' : '#ddd';
  ctx.fillRect(0, 0, 128, 128);
  for (let a = 0; a < 2; a++)
    for (let b = 0; b < 2; b++) {
      if (emissive) ctx.fillStyle = Math.random() < 0.45 ? '#fff' : '#000';
      else ctx.fillStyle = '#62788f';
      ctx.fillRect(a * 64 + 14, b * 64 + 14, 36, 34);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = emissive ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

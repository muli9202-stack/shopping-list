import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Small low-poly models for the tycoon games, built from primitives (no files to download). */

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number | string, rough = 0.55, metal = 0): THREE.MeshStandardMaterial {
  const k = `${color}|${rough}|${metal}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    matCache.set(k, m);
  }
  return m;
}

export function rbox(w: number, h: number, d: number, color: number | string, x = 0, y = 0, z = 0, r = 0.04) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 3)), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function cyl(rt: number, rb: number, h: number, color: number | string, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
export function sph(r: number, color: number | string, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
export function cone(r: number, h: number, color: number | string, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
export function group(...c: THREE.Object3D[]) {
  const g = new THREE.Group();
  c.forEach((o) => g.add(o));
  return g;
}

export type ProductKind =
  | 'burger' | 'pizza' | 'coffee' | 'icecream' | 'donut' | 'cake' | 'juice' | 'bread' | 'salad' | 'sushi'
  | 'hotdog' | 'popcorn' | 'candy' | 'apple' | 'fish' | 'flower' | 'book' | 'gift' | 'ball' | 'shirt'
  | 'shoe' | 'medicine' | 'bandage' | 'paint' | 'fuel' | 'tire' | 'phone' | 'gem' | 'plant' | 'soap'
  | 'flour' | 'fruit' | 'dough' | 'cloth' | 'seed' | 'beans' | 'milk' | 'wood' | 'toy' | 'bone';

/** One product item, about 0.3 m. */
export function product(kind: ProductKind): THREE.Group {
  switch (kind) {
    case 'burger':
      return group(cyl(0.16, 0.15, 0.06, 0xf4a259, 0, 0.03), cyl(0.165, 0.165, 0.04, 0x6d3b1e, 0, 0.08), cyl(0.17, 0.17, 0.015, 0x51cf66, 0, 0.105), cyl(0.165, 0.165, 0.02, 0xffd43b, 0, 0.12), half(0.16, 0xf08c00, 0.13));
    case 'pizza':
      return group(cyl(0.2, 0.2, 0.03, 0xf4a259, 0, 0.015), cyl(0.18, 0.18, 0.012, 0xe03131, 0, 0.035), sph(0.03, 0xc92a2a, 0.07, 0.045, 0.03), sph(0.03, 0xc92a2a, -0.06, 0.045, -0.05), sph(0.03, 0xc92a2a, -0.02, 0.045, 0.08));
    case 'coffee':
      return group(cyl(0.09, 0.07, 0.2, 0xffffff, 0, 0.1), cyl(0.092, 0.092, 0.05, 0x8d5a2b, 0, 0.12), cyl(0.095, 0.095, 0.02, 0x495057, 0, 0.21));
    case 'icecream':
      return group(cone(0.08, 0.22, 0xe0a96d, 0, 0.11).rotateX(Math.PI), sph(0.09, 0xffc9de, 0, 0.25), sph(0.07, 0xb2f2bb, 0, 0.33));
    case 'donut': {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.05, 12, 24), mat(0xf783ac));
      m.rotation.x = Math.PI / 2;
      m.position.y = 0.05;
      m.castShadow = true;
      return group(m);
    }
    case 'cake':
      return group(cyl(0.15, 0.15, 0.14, 0xfff0f6, 0, 0.07), cyl(0.152, 0.152, 0.03, 0xf06595, 0, 0.13), sph(0.03, 0xe03131, 0, 0.17));
    case 'juice':
      return group(cyl(0.08, 0.07, 0.24, 0xffa94d, 0, 0.12), cyl(0.082, 0.082, 0.02, 0xffffff, 0, 0.25), cyl(0.008, 0.008, 0.12, 0xf06595, 0.03, 0.3));
    case 'bread':
      return group(rbox(0.3, 0.12, 0.16, 0xd9480f, 0, 0.06, 0, 0.06), rbox(0.26, 0.04, 0.12, 0xf4a259, 0, 0.12, 0, 0.02));
    case 'salad':
      return group(cyl(0.16, 0.1, 0.08, 0xffffff, 0, 0.04), sph(0.1, 0x51cf66, 0, 0.09), sph(0.035, 0xe03131, 0.06, 0.13, 0.02));
    case 'sushi':
      return group(cyl(0.08, 0.08, 0.08, 0x212529, 0, 0.04), cyl(0.07, 0.07, 0.082, 0xffffff, 0, 0.04), cyl(0.03, 0.03, 0.084, 0xff922b, 0, 0.04));
    case 'hotdog':
      return group(rbox(0.3, 0.07, 0.11, 0xf4a259, 0, 0.035, 0, 0.04), rbox(0.32, 0.05, 0.05, 0xc92a2a, 0, 0.08, 0, 0.025));
    case 'popcorn':
      return group(cyl(0.09, 0.07, 0.2, 0xe03131, 0, 0.1), sph(0.09, 0xfff3bf, 0, 0.21));
    case 'candy':
      return group(sph(0.08, 0xcc5de8, 0, 0.08), cone(0.05, 0.08, 0xcc5de8, 0.1, 0.08).rotateZ(Math.PI / 2), cone(0.05, 0.08, 0xcc5de8, -0.1, 0.08).rotateZ(-Math.PI / 2));
    case 'apple':
    case 'fruit':
      return group(sph(0.1, kind === 'apple' ? 0xe03131 : 0xff922b, 0, 0.1), cyl(0.01, 0.01, 0.06, 0x6d3b1e, 0, 0.21));
    case 'fish': {
      const body = sph(0.1, 0x74c0fc, 0, 0.08);
      body.scale.set(1.8, 0.7, 0.6);
      return group(body, cone(0.07, 0.1, 0x4dabf7, -0.22, 0.08).rotateZ(Math.PI / 2));
    }
    case 'flower':
      return group(cyl(0.08, 0.06, 0.12, 0xe8590c, 0, 0.06), cyl(0.01, 0.01, 0.16, 0x2f9e44, 0, 0.18), sph(0.06, 0xf783ac, 0, 0.27), sph(0.025, 0xffd43b, 0, 0.3));
    case 'book':
      return group(rbox(0.22, 0.05, 0.3, 0x1c7ed6, 0, 0.025), rbox(0.2, 0.04, 0.28, 0xffffff, 0.012, 0.03));
    case 'gift':
      return group(rbox(0.22, 0.18, 0.22, 0xf03e3e, 0, 0.09), rbox(0.05, 0.19, 0.23, 0xffd43b, 0, 0.09), rbox(0.23, 0.19, 0.05, 0xffd43b, 0, 0.09));
    case 'ball':
      return group(sph(0.12, 0xffffff, 0, 0.12), sph(0.05, 0x212529, 0, 0.2, 0.08));
    case 'toy':
      return group(rbox(0.2, 0.2, 0.2, 0x4dabf7, 0, 0.1), rbox(0.1, 0.1, 0.1, 0xffd43b, 0, 0.25));
    case 'shirt':
    case 'cloth':
      return group(rbox(0.28, 0.06, 0.24, kind === 'shirt' ? 0x4dabf7 : 0xadb5bd, 0, 0.03, 0, 0.03));
    case 'shoe':
      return group(rbox(0.28, 0.08, 0.12, 0xe8590c, 0, 0.04), rbox(0.12, 0.08, 0.12, 0xe8590c, -0.08, 0.12));
    case 'medicine':
      return group(cyl(0.07, 0.07, 0.18, 0xffffff, 0, 0.09), cyl(0.072, 0.072, 0.06, 0x51cf66, 0, 0.2));
    case 'bandage':
      return group(rbox(0.22, 0.12, 0.16, 0xffffff, 0, 0.06), rbox(0.05, 0.13, 0.12, 0xe03131, 0, 0.06), rbox(0.14, 0.13, 0.04, 0xe03131, 0, 0.06));
    case 'paint':
      return group(cyl(0.11, 0.1, 0.18, 0xdee2e6, 0, 0.09), cyl(0.105, 0.105, 0.02, 0x7950f2, 0, 0.185));
    case 'fuel':
      return group(rbox(0.18, 0.24, 0.1, 0xe03131, 0, 0.12), rbox(0.04, 0.06, 0.04, 0x212529, 0.05, 0.27));
    case 'tire': {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 10, 22), mat(0x212529, 0.8));
      m.position.y = 0.17;
      m.castShadow = true;
      return group(m);
    }
    case 'phone':
      return group(rbox(0.14, 0.26, 0.03, 0x212529, 0, 0.13), rbox(0.12, 0.22, 0.005, 0x4dabf7, 0, 0.13, 0.016));
    case 'gem': {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), mat(0x22b8cf, 0.15, 0.3));
      m.position.y = 0.12;
      m.castShadow = true;
      return group(m);
    }
    case 'plant':
    case 'seed':
      return group(cyl(0.08, 0.06, 0.1, 0x8d5a2b, 0, 0.05), sph(0.09, kind === 'plant' ? 0x40c057 : 0x94d82d, 0, 0.16));
    case 'soap':
      return group(rbox(0.18, 0.08, 0.12, 0xe599f7, 0, 0.04, 0, 0.04), sph(0.03, 0xffffff, 0.04, 0.1, 0));
    case 'flour':
      return group(rbox(0.2, 0.24, 0.12, 0xf8f9fa, 0, 0.12, 0, 0.05), rbox(0.12, 0.08, 0.125, 0x74c0fc, 0, 0.12));
    case 'dough':
      return group(half(0.12, 0xffe8cc, 0));
    case 'beans':
      return group(rbox(0.2, 0.22, 0.12, 0x8d5a2b, 0, 0.11, 0, 0.05));
    case 'milk':
      return group(rbox(0.12, 0.24, 0.12, 0xffffff, 0, 0.12), rbox(0.12, 0.06, 0.12, 0x4dabf7, 0, 0.27));
    case 'wood':
      return group(cyl(0.05, 0.05, 0.3, 0x8d5a2b, 0, 0.05).rotateZ(Math.PI / 2), cyl(0.05, 0.05, 0.3, 0xa0522d, 0, 0.13).rotateZ(Math.PI / 2));
    case 'bone':
      return group(rbox(0.26, 0.05, 0.05, 0xf8f9fa, 0, 0.05), sph(0.04, 0xf8f9fa, 0.14, 0.05, 0.02), sph(0.04, 0xf8f9fa, -0.14, 0.05, 0.02));
  }
}

/** Half sphere (bun tops, dough). */
function half(r: number, color: number | string, y: number) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
  m.position.y = y;
  m.castShadow = true;
  return m;
}

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0xff6b6b, 0x4dabf7, 0x51cf66, 0xfcc419, 0xcc5de8, 0xff922b, 0x20c997, 0x495057];

export interface Character {
  root: THREE.Group;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  /** where carried items stack */
  hands: THREE.Group;
}

/** A friendly low-poly person: rounded body, head, hair, arms and legs that swing when walking. */
export function person(seed: number, shirt?: number, hat?: number): Character {
  const root = new THREE.Group();
  const skin = SKIN[seed % SKIN.length];
  const top = shirt ?? SHIRTS[(seed * 7) % SHIRTS.length];
  const body = rbox(0.42, 0.5, 0.3, top, 0, 0.72, 0, 0.12);
  const head = sph(0.2, skin, 0, 1.18);
  const hair = sph(0.205, [0x343a40, 0x8d5a2b, 0xf08c00, 0x212529][seed % 4], 0, 1.24, -0.03);
  hair.scale.set(1, 0.7, 1);
  const eyes = group(sph(0.025, 0x212529, -0.07, 1.2, 0.18), sph(0.025, 0x212529, 0.07, 1.2, 0.18));
  root.add(body, head, hair, eyes);
  if (hat !== undefined) root.add(cyl(0.21, 0.23, 0.12, hat, 0, 1.36), cyl(0.28, 0.28, 0.02, hat, 0, 1.3));
  const legs = [-0.1, 0.1].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.48, 0);
    pivot.add(rbox(0.14, 0.46, 0.16, 0x343a40, 0, -0.23, 0, 0.05));
    root.add(pivot);
    return pivot;
  });
  const arms = [-0.27, 0.27].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.92, 0);
    pivot.add(rbox(0.11, 0.4, 0.12, top, 0, -0.18, 0, 0.05));
    root.add(pivot);
    return pivot;
  });
  const hands = new THREE.Group();
  hands.position.set(0, 0.78, 0.32);
  root.add(hands);
  return { root, legs, arms, hands };
}

/** A small car (gas station, car wash customers). */
export function car(seed: number): Character {
  const root = new THREE.Group();
  const color = SHIRTS[(seed * 3) % SHIRTS.length];
  root.add(rbox(1.0, 0.32, 0.55, color, 0, 0.32, 0, 0.12), rbox(0.55, 0.28, 0.5, color, -0.05, 0.6, 0, 0.1), rbox(0.5, 0.2, 0.52, 0xa5d8ff, -0.05, 0.62, 0, 0.05));
  const legs = [-0.32, 0.32].flatMap((x) =>
    [-0.28, 0.28].map((z) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16), mat(0x212529, 0.8));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.14, z);
      root.add(w);
      return w;
    }),
  );
  const hands = new THREE.Group();
  hands.position.set(0, 0.9, 0);
  root.add(hands);
  return { root, legs, arms: [], hands };
}

/** Walk animation: swing legs and arms by phase t (0 = standing). */
export function animateWalk(c: Character, t: number, moving: boolean, carrying: boolean) {
  const a = moving ? Math.sin(t * 10) * 0.6 : 0;
  if (c.arms.length) {
    c.legs[0].rotation.x = a;
    c.legs[1].rotation.x = -a;
    const armBase = carrying ? -1.2 : 0;
    c.arms[0].rotation.x = armBase + (carrying ? 0 : -a);
    c.arms[1].rotation.x = armBase + (carrying ? 0 : a);
  } else if (moving) for (const w of c.legs) w.rotation.y += 0.3;
}

/** A sprite with Hebrew text (station names, prices). */
export function label(text: string, color = '#212529', bg = 'rgba(255,255,255,.92)', scale = 1): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 44px Rubik, Arial, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w;
  c.height = 72;
  ctx.font = 'bold 44px Rubik, Arial, sans-serif';
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 72, 30);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText(text, w / 2, 38);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set((w / 72) * 0.42 * scale, 0.42 * scale, 1);
  s.renderOrder = 10;
  return s;
}

/** A bundle of cash (green bills). */
export function cashBundle(): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.07, 0.2, 2, 0.02), mat(0x51cf66, 0.6));
  m.castShadow = true;
  return m;
}

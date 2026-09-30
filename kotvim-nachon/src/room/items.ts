import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type ItemCat = 'furniture' | 'animals' | 'toys' | 'decor' | 'sport';

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  cat: ItemCat;
  build: () => THREE.Group;
}

const mat = (color: number | string, rough = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: rough });

/** Furniture parts have softly rounded edges, like real furniture. */
function box(w: number, h: number, d: number, color: number | string, x = 0, y = 0, z = 0) {
  const r = Math.min(0.05, Math.min(w, h, d) / 3);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function ball(r: number, color: number | string, x = 0, y = 0, z = 0, rough = 0.5) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat(color, rough));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function cyl(rt: number, rb: number, h: number, color: number | string, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}
/** Attach an idle animation to an item. */
function animate(g: THREE.Group, fn: (g: THREE.Group, t: number) => void) {
  g.userData.anim = fn;
  return g;
}

function eyes(y: number, z: number, spread: number, r = 0.05) {
  return group(ball(r, 0x222222, -spread, y, z, 0.2), ball(r, 0x222222, spread, y, z, 0.2));
}

export const ITEMS: ShopItem[] = [
  // ---------- furniture ----------
  { id: 'bed', name: 'מיטה', emoji: '🛏️', price: 0, cat: 'furniture', build: () => group(box(1.2, 0.3, 2, 0x8d5a2b, 0, 0.25, 0), box(1.1, 0.2, 1.9, 0xffffff, 0, 0.5, 0), box(1.1, 0.12, 1.2, 0x74c0fc, 0, 0.63, 0.3), box(0.8, 0.15, 0.35, 0xffffff, 0, 0.66, -0.7), box(1.2, 0.8, 0.1, 0x8d5a2b, 0, 0.5, -1)) },
  { id: 'rug_round', name: 'שטיח עגול', emoji: '🟠', price: 0, cat: 'decor', build: () => group(cyl(1.2, 1.2, 0.03, 0xffa94d, 0, 0.02, 0), cyl(0.8, 0.8, 0.035, 0xffd43b, 0, 0.025, 0)) },
  { id: 'desk', name: 'שולחן כתיבה', emoji: '🪑', price: 150, cat: 'furniture', build: () => group(box(1.4, 0.08, 0.7, 0xdeb887, 0, 0.75, 0), ...[-0.6, 0.6].flatMap((x) => [box(0.08, 0.75, 0.08, 0xa0522d, x, 0.37, -0.28), box(0.08, 0.75, 0.08, 0xa0522d, x, 0.37, 0.28)]), box(0.3, 0.02, 0.4, 0xffffff, 0.2, 0.8, 0), box(0.1, 0.3, 0.1, 0xff6b6b, -0.4, 0.94, 0)) },
  { id: 'chair', name: 'כיסא', emoji: '💺', price: 80, cat: 'furniture', build: () => group(box(0.5, 0.06, 0.5, 0x4dabf7, 0, 0.45, 0), box(0.5, 0.5, 0.06, 0x4dabf7, 0, 0.72, -0.22), ...[-0.2, 0.2].flatMap((x) => [cyl(0.03, 0.03, 0.45, 0x333333, x, 0.22, -0.2), cyl(0.03, 0.03, 0.45, 0x333333, x, 0.22, 0.2)])) },
  { id: 'bookshelf', name: 'ספרייה', emoji: '📚', price: 180, cat: 'furniture', build: () => { const g = group(box(1, 1.6, 0.35, 0x8d5a2b, 0, 0.8, 0)); const colors = [0xff6b6b, 0x4dabf7, 0x51cf66, 0xffd43b, 0xcc5de8]; for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) g.add(box(0.1, 0.35, 0.25, colors[(r + k) % 5], -0.38 + k * 0.15, 0.35 + r * 0.5, 0.03)); return g; } },
  { id: 'sofa', name: 'ספה', emoji: '🛋️', price: 250, cat: 'furniture', build: () => group(box(1.8, 0.4, 0.8, 0xe64980, 0, 0.3, 0), box(1.8, 0.6, 0.2, 0xe64980, 0, 0.6, -0.35), box(0.2, 0.5, 0.8, 0xc2255c, -0.9, 0.45, 0), box(0.2, 0.5, 0.8, 0xc2255c, 0.9, 0.45, 0), box(0.5, 0.3, 0.1, 0xffd43b, -0.4, 0.65, -0.2)) },
  { id: 'lamp', name: 'מנורה', emoji: '💡', price: 90, cat: 'furniture', build: () => { const bulb = new THREE.PointLight(0xffe066, 1.2, 3); bulb.position.y = 1.3; return group(cyl(0.2, 0.25, 0.05, 0x333333, 0, 0.03, 0), cyl(0.03, 0.03, 1.2, 0x555555, 0, 0.6, 0), cyl(0.15, 0.3, 0.3, 0xffe066, 0, 1.3, 0), bulb); } },
  { id: 'wardrobe', name: 'ארון', emoji: '🚪', price: 220, cat: 'furniture', build: () => group(box(1.2, 2, 0.6, 0xf4a261, 0, 1, 0), box(0.02, 1.8, 0.02, 0x8d5a2b, 0, 1, 0.31), ball(0.04, 0xffd43b, -0.1, 1, 0.32), ball(0.04, 0xffd43b, 0.1, 1, 0.32)) },
  { id: 'beanbag', name: 'פוף', emoji: '🟣', price: 140, cat: 'furniture', build: () => { const b = ball(0.5, 0x9775fa); b.scale.set(1, 0.7, 1); b.position.y = 0.35; return group(b); } },
  { id: 'tv', name: 'טלוויזיה', emoji: '📺', price: 300, cat: 'furniture', build: () => { const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshBasicMaterial({ color: 0x74c0fc })); screen.position.set(0, 0.95, 0.04); const g = group(box(1.4, 0.4, 0.5, 0x495057, 0, 0.2, 0), box(1.2, 0.7, 0.06, 0x212529, 0, 0.95, 0), screen); return animate(g, (_, t) => (screen.material as THREE.MeshBasicMaterial).color.setHSL((t * 0.1) % 1, 0.7, 0.6)); } },
  // ---------- animals ----------
  { id: 'dog', name: 'כלבלב', emoji: '🐶', price: 350, cat: 'animals', build: () => { const tail = cyl(0.03, 0.05, 0.3, 0xc68642, 0, 0.45, -0.35); tail.rotation.x = -0.8; const body = box(0.4, 0.3, 0.6, 0xc68642, 0, 0.35, 0); const head = group(box(0.32, 0.3, 0.3, 0xc68642, 0, 0, 0), box(0.12, 0.2, 0.08, 0x8d5a2b, -0.17, 0.08, 0), box(0.12, 0.2, 0.08, 0x8d5a2b, 0.17, 0.08, 0), eyes(0.05, 0.16, 0.07), ball(0.04, 0x222222, 0, -0.04, 0.18)); head.position.set(0, 0.6, 0.35); const legs = [-0.12, 0.12].flatMap((x) => [box(0.08, 0.2, 0.08, 0xc68642, x, 0.1, 0.2), box(0.08, 0.2, 0.08, 0xc68642, x, 0.1, -0.2)]); const g = group(body, head, tail, ...legs); return animate(g, (_, t) => { tail.rotation.z = Math.sin(t * 12) * 0.6; head.rotation.y = Math.sin(t * 0.8) * 0.3; }); } },
  { id: 'cat', name: 'חתלתול', emoji: '🐱', price: 300, cat: 'animals', build: () => { const body = ball(0.25, 0xadb5bd); body.scale.set(1, 0.9, 1.4); body.position.y = 0.3; const head = group(ball(0.2, 0xadb5bd), new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.15, 4), mat(0x868e96)), eyes(0.03, 0.17, 0.07, 0.035)); (head.children[1] as THREE.Mesh).position.set(-0.1, 0.2, 0); const ear2 = (head.children[1] as THREE.Mesh).clone(); ear2.position.x = 0.1; head.add(ear2); head.position.set(0, 0.55, 0.3); const tail = cyl(0.03, 0.03, 0.5, 0xadb5bd, 0, 0.45, -0.35); const g = group(body, head, tail); return animate(g, (_, t) => { tail.rotation.x = -0.5 + Math.sin(t * 2) * 0.3; body.scale.y = 0.9 + Math.sin(t * 2) * 0.03; }); } },
  { id: 'bunny', name: 'ארנבון', emoji: '🐰', price: 250, cat: 'animals', build: () => { const g = group(ball(0.22, 0xffffff, 0, 0.25, 0), ball(0.15, 0xffffff, 0, 0.5, 0.12), box(0.06, 0.25, 0.04, 0xffc9c9, -0.06, 0.72, 0.1), box(0.06, 0.25, 0.04, 0xffc9c9, 0.06, 0.72, 0.1), eyes(0.52, 0.25, 0.05, 0.03), ball(0.07, 0xffffff, 0, 0.2, -0.22)); return animate(g, (gg, t) => { gg.position.y = Math.abs(Math.sin(t * 3)) * 0.15; }); } },
  { id: 'fish', name: 'אקווריום', emoji: '🐠', price: 200, cat: 'animals', build: () => { const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.45), new THREE.MeshStandardMaterial({ color: 0x74c0fc, transparent: true, opacity: 0.35 })); glass.position.y = 0.95; const fish = [ball(0.06, 0xff922b), ball(0.05, 0xffd43b), ball(0.05, 0xf06595)]; fish.forEach((f) => (f.position.y = 0.95)); const g = group(box(0.9, 0.7, 0.45, 0x495057, 0, 0.35, 0), glass, ...fish); return animate(g, (_, t) => fish.forEach((f, k) => { f.position.x = Math.sin(t * (0.8 + k * 0.3) + k) * 0.35; f.position.z = Math.cos(t * (0.6 + k * 0.2)) * 0.12; f.position.y = 0.9 + k * 0.08; })); } },
  { id: 'parrot', name: 'תוכי', emoji: '🦜', price: 280, cat: 'animals', build: () => { const bird = group(ball(0.13, 0x51cf66, 0, 0, 0), ball(0.09, 0xff6b6b, 0, 0.15, 0.03), new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), mat(0xffd43b)), eyes(0.17, 0.1, 0.04, 0.02)); (bird.children[2] as THREE.Mesh).position.set(0, 0.13, 0.13); (bird.children[2] as THREE.Mesh).rotation.x = Math.PI / 2; bird.position.y = 1.35; const g = group(cyl(0.2, 0.25, 0.05, 0x8d5a2b, 0, 0.03, 0), cyl(0.03, 0.03, 1.2, 0x8d5a2b, 0, 0.6, 0), box(0.5, 0.04, 0.04, 0x8d5a2b, 0, 1.2, 0), bird); return animate(g, (_, t) => { bird.rotation.y = Math.sin(t) * 0.8; bird.position.y = 1.35 + Math.abs(Math.sin(t * 4)) * 0.05; }); } },
  { id: 'turtle', name: 'צב', emoji: '🐢', price: 150, cat: 'animals', build: () => { const shell = ball(0.25, 0x2f9e44); shell.scale.y = 0.55; shell.position.y = 0.15; const head = ball(0.08, 0x8ce99a, 0, 0.12, 0.3); const g = group(shell, head); return animate(g, (_, t) => { head.position.z = 0.28 + Math.sin(t) * 0.04; }); } },
  { id: 'unicorn', name: 'חד-קרן', emoji: '🦄', price: 800, cat: 'animals', build: () => { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.25, 12), mat(0xffd43b, 0.2)); horn.position.set(0, 1.05, 0.45); horn.rotation.x = 0.5; const g = group(box(0.4, 0.35, 0.8, 0xffffff, 0, 0.55, 0), box(0.25, 0.4, 0.3, 0xffffff, 0, 0.85, 0.4), horn, box(0.08, 0.35, 0.3, 0xcc5de8, 0, 0.95, 0.25), ...[-0.13, 0.13].flatMap((x) => [box(0.08, 0.4, 0.08, 0xffffff, x, 0.2, 0.3), box(0.08, 0.4, 0.08, 0xffffff, x, 0.2, -0.3)]), eyes(0.9, 0.56, 0.08, 0.03)); return animate(g, (gg, t) => { gg.position.y = Math.sin(t * 2) * 0.05 + 0.05; }); } },
  // ---------- toys ----------
  { id: 'ball', name: 'כדור', emoji: '⚽', price: 40, cat: 'toys', build: () => { const stripe = ball(0.185, 0xff6b6b, 0, 0.18, 0); stripe.scale.set(1, 0.25, 1); return group(ball(0.18, 0xffffff, 0, 0.18, 0), stripe); } },
  { id: 'teddy', name: 'דובי', emoji: '🧸', price: 90, cat: 'toys', build: () => group(ball(0.22, 0xc68642, 0, 0.22, 0), ball(0.16, 0xc68642, 0, 0.52, 0), ball(0.06, 0xc68642, -0.12, 0.65, 0), ball(0.06, 0xc68642, 0.12, 0.65, 0), eyes(0.55, 0.14, 0.05, 0.025), ball(0.05, 0xf4a261, 0, 0.48, 0.14)) },
  { id: 'rocket', name: 'חללית', emoji: '🚀', price: 200, cat: 'toys', build: () => { const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 16), mat(0xff6b6b)); nose.position.y = 1.05; const g = group(cyl(0.2, 0.2, 0.7, 0xf1f3f5, 0, 0.7, 0), nose, ball(0.08, 0x74c0fc, 0, 0.8, 0.17), box(0.05, 0.3, 0.3, 0xff6b6b, 0, 0.35, 0), box(0.3, 0.3, 0.05, 0xff6b6b, 0, 0.35, 0)); return animate(g, (gg, t) => { gg.position.y = 0.05 + Math.sin(t * 1.5) * 0.08; gg.rotation.y = t * 0.5; }); } },
  { id: 'blocks', name: 'קוביות', emoji: '🧱', price: 60, cat: 'toys', build: () => group(box(0.25, 0.25, 0.25, 0xff6b6b, 0, 0.12, 0), box(0.25, 0.25, 0.25, 0x4dabf7, 0.27, 0.12, 0), box(0.25, 0.25, 0.25, 0xffd43b, 0.13, 0.37, 0)) },
  { id: 'robot', name: 'רובוט', emoji: '🤖', price: 260, cat: 'toys', build: () => { const head = group(box(0.3, 0.25, 0.25, 0xadb5bd), ball(0.04, 0x51cf66, -0.07, 0, 0.13), ball(0.04, 0x51cf66, 0.07, 0, 0.13), cyl(0.01, 0.01, 0.15, 0x333333, 0, 0.18, 0), ball(0.03, 0xff6b6b, 0, 0.27, 0)); head.position.y = 0.75; const g = group(box(0.4, 0.4, 0.3, 0x868e96, 0, 0.42, 0), head, box(0.1, 0.2, 0.1, 0x495057, -0.1, 0.1, 0), box(0.1, 0.2, 0.1, 0x495057, 0.1, 0.1, 0)); return animate(g, (_, t) => { head.rotation.y = Math.sin(t * 2) * 0.6; }); } },
  { id: 'guitar', name: 'גיטרה', emoji: '🎸', price: 200, cat: 'toys', build: () => { const g = group(ball(0.22, 0xe8590c, 0, 0.3, 0), ball(0.16, 0xe8590c, 0, 0.6, 0), box(0.06, 0.6, 0.04, 0x8d5a2b, 0, 0.95, 0), ball(0.06, 0x222222, 0, 0.38, 0.2)); g.children.slice(0, 2).forEach((c) => c.scale.set(1, 1, 0.35)); g.rotation.x = -0.2; return g; } },
  // ---------- decor ----------
  { id: 'plant', name: 'עציץ', emoji: '🪴', price: 70, cat: 'decor', build: () => group(cyl(0.2, 0.15, 0.35, 0xe8590c, 0, 0.17, 0), ball(0.25, 0x40c057, 0, 0.55, 0), ball(0.18, 0x51cf66, 0.12, 0.7, 0.05), ball(0.15, 0x2f9e44, -0.12, 0.72, 0)) },
  { id: 'rug_star', name: 'שטיח כוכב', emoji: '⭐', price: 120, cat: 'decor', build: () => { const shape = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.45 : 1; const a = (k * Math.PI) / 5; if (k === 0) shape.moveTo(Math.sin(a) * r, Math.cos(a) * r); else shape.lineTo(Math.sin(a) * r, Math.cos(a) * r); } const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0xffd43b)); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.receiveShadow = true; return group(m); } },
  { id: 'balloons', name: 'בלונים', emoji: '🎈', price: 60, cat: 'decor', build: () => { const bs = [0xff6b6b, 0x4dabf7, 0xffd43b].map((c, k) => ball(0.18, c, (k - 1) * 0.2, 1.4 + (k % 2) * 0.2, 0, 0.3)); const g = group(...bs, cyl(0.01, 0.01, 1.3, 0x888888, 0, 0.65, 0)); return animate(g, (_, t) => bs.forEach((b, k) => (b.position.y = 1.4 + (k % 2) * 0.2 + Math.sin(t * 2 + k) * 0.05))); } },
  { id: 'trophy', name: 'גביע אלופים', emoji: '🏆', price: 400, cat: 'decor', build: () => { const cup = cyl(0.25, 0.1, 0.35, 0xfcc419, 0, 0.75, 0); (cup.material as THREE.MeshStandardMaterial).metalness = 0.8; (cup.material as THREE.MeshStandardMaterial).roughness = 0.2; const g = group(box(0.4, 0.4, 0.4, 0x495057, 0, 0.2, 0), cyl(0.04, 0.04, 0.2, 0xfcc419, 0, 0.5, 0), cup); return animate(g, (_, t) => { cup.rotation.y = t; }); } },
  { id: 'globe', name: 'גלובוס', emoji: '🌍', price: 120, cat: 'decor', build: () => { const earth = ball(0.22, 0x4dabf7, 0, 0.55, 0); earth.add(ball(0.1, 0x51cf66, 0.14, 0.05, 0.1)); earth.add(ball(0.08, 0x51cf66, -0.12, -0.08, 0.12)); const g = group(cyl(0.15, 0.2, 0.06, 0x8d5a2b, 0, 0.03, 0), cyl(0.02, 0.02, 0.3, 0x8d5a2b, 0, 0.2, 0), earth); return animate(g, (_, t) => { earth.rotation.y = t * 0.6; }); } },
  { id: 'starlamp', name: 'מנורת כוכבים', emoji: '🌟', price: 160, cat: 'decor', build: () => { const light = new THREE.PointLight(0xb197fc, 1.5, 3); light.position.y = 0.5; const orb = ball(0.2, 0xd0bfff, 0, 0.35, 0, 0.1); (orb.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x7950f2); const g = group(cyl(0.15, 0.2, 0.15, 0x343a40, 0, 0.07, 0), orb, light); return animate(g, (_, t) => { light.intensity = 1.2 + Math.sin(t * 3) * 0.5; orb.rotation.y = t; }); } },
  // ---------- sport corner ----------
  { id: 'trampoline', name: 'טרמפולינה', emoji: '🤸', price: 350, cat: 'sport', build: () => { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 12, 48), mat(0x1c7ed6, 0.4)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.45; const pad = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), mat(0x212529, 0.8)); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.44; const kid = ball(0.14, 0xff922b, 0, 0.7, 0); const legs = [0, 1, 2, 3, 4, 5].map((k) => cyl(0.03, 0.03, 0.45, 0x495057, Math.cos((k * Math.PI) / 3) * 0.82, 0.22, Math.sin((k * Math.PI) / 3) * 0.82)); const g = group(ring, pad, kid, ...legs); return animate(g, (_, t) => { const h = Math.abs(Math.sin(t * 3)); kid.position.y = 0.6 + h * 0.6; pad.position.y = 0.44 - (1 - h) * 0.05; }); } },
  { id: 'hoop', name: 'סל כדורסל', emoji: '🏀', price: 300, cat: 'sport', build: () => { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 10, 32), mat(0xf76707, 0.3)); rim.rotation.x = Math.PI / 2; rim.position.set(0, 2.05, 0.3); const net = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.15, 0.3, 16, 3, true), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true })); net.position.set(0, 1.9, 0.3); const bb = ball(0.12, 0xe8590c, 0.4, 0.12, 0.5, 0.7); const g = group(box(0.5, 0.06, 0.5, 0x343a40, 0, 0.03, -0.1), cyl(0.05, 0.05, 2.3, 0x868e96, 0, 1.15, -0.1), box(0.9, 0.6, 0.04, 0xffffff, 0, 2.3, 0.05), box(0.3, 0.22, 0.045, 0xe03131, 0, 2.2, 0.06), rim, net, bb); return animate(g, (_, t) => { bb.position.y = 0.12 + Math.abs(Math.sin(t * 4)) * 0.4; }); } },
  { id: 'climb', name: 'קיר טיפוס', emoji: '🧗', price: 420, cat: 'sport', build: () => { const g = group(box(1.6, 2.6, 0.12, 0xdee2e6, 0, 1.3, 0)); const cs = [0xff6b6b, 0x51cf66, 0xffd43b, 0x4dabf7, 0xcc5de8]; for (let k = 0; k < 16; k++) g.add(ball(0.06 + (k % 3) * 0.015, cs[k % 5], -0.65 + ((k * 37) % 13) / 10, 0.3 + ((k * 23) % 22) / 10, 0.08, 0.8)); g.add(box(1.8, 0.12, 1, 0x1971c2, 0, 0.06, 0.6)); return g; } },
  { id: 'slide', name: 'מגלשה', emoji: '🛝', price: 380, cat: 'sport', build: () => { const ramp = box(0.5, 0.05, 1.9, 0xfab005, 0, 0.75, 0.55); ramp.rotation.x = 0.62; const g = group(box(0.6, 0.06, 0.6, 0x4dabf7, 0, 1.3, -0.6), ...[-0.27, 0.27].flatMap((x) => [cyl(0.03, 0.03, 1.3, 0x1c7ed6, x, 0.65, -0.87), cyl(0.03, 0.03, 1.3, 0x1c7ed6, x, 0.65, -0.33)]), ...[0.3, 0.6, 0.9].map((y) => box(0.54, 0.04, 0.05, 0x1c7ed6, 0, y, -0.9)), ramp); return g; } },
  { id: 'bike', name: 'אופני כושר', emoji: '🚴', price: 320, cat: 'sport', build: () => { const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 10, 32), mat(0x343a40, 0.4)); wheel.rotation.y = Math.PI / 2; wheel.position.set(0, 0.4, 0.4); const spokes = box(0.02, 0.5, 0.02, 0xadb5bd, 0, 0.4, 0.4); const g = group(box(0.5, 0.06, 1.1, 0x495057, 0, 0.03, 0), box(0.08, 0.8, 0.08, 0xe03131, 0, 0.45, -0.25), box(0.3, 0.08, 0.35, 0x212529, 0, 0.88, -0.28), box(0.08, 0.9, 0.08, 0xe03131, 0, 0.5, 0.35), box(0.5, 0.05, 0.05, 0x212529, 0, 1, 0.4), wheel, spokes); return animate(g, (_, t) => { spokes.rotation.x = t * 5; }); } },
  { id: 'punchbag', name: 'שק אגרוף', emoji: '🥊', price: 260, cat: 'sport', build: () => { const bag = group(cyl(0.2, 0.2, 0.9, 0xc92a2a, 0, -0.65, 0)); bag.position.y = 1.9; const g = group(box(0.5, 0.06, 0.5, 0x343a40, 0, 0.03, -0.4), cyl(0.04, 0.04, 2.1, 0x868e96, 0, 1.05, -0.4), box(0.06, 0.06, 0.45, 0x868e96, 0, 2.08, -0.2), bag); return animate(g, (_, t) => { bag.rotation.x = Math.sin(t * 2.2) * 0.12; }); } },
  { id: 'goal', name: 'שער כדורגל', emoji: '🥅', price: 240, cat: 'sport', build: () => { const net = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.6, 8, 5, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true })); net.position.set(0, 0.45, -0.3); return group(cyl(0.035, 0.035, 0.9, 0xffffff, -0.8, 0.45, 0), cyl(0.035, 0.035, 0.9, 0xffffff, 0.8, 0.45, 0), box(1.66, 0.07, 0.07, 0xffffff, 0, 0.9, 0), net, ball(0.14, 0xffffff, 0.3, 0.14, 0.5)); } },
  { id: 'gymmat', name: 'מזרן התעמלות', emoji: '🟦', price: 90, cat: 'sport', build: () => group(box(1.8, 0.08, 0.9, 0x339af0, 0, 0.04, 0), box(0.3, 0.1, 0.12, 0x495057, 0.6, 0.13, 0), cyl(0.07, 0.07, 0.1, 0x212529, 0.45, 0.13, 0), cyl(0.07, 0.07, 0.1, 0x212529, 0.75, 0.13, 0)) },
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<string, ShopItem>;

export const WALL_COLORS = ['#ffe8cc', '#d0ebff', '#e5dbff', '#d3f9d8', '#ffdeeb', '#fff3bf', '#c5f6fa'];
export const FLOOR_COLORS = ['#e6c9a8', '#ced4da', '#b2f2bb', '#ffc9c9', '#a5d8ff'];
export const COLOR_PRICE = 50;

export const CATS: { id: ItemCat | 'colors'; name: string; emoji: string }[] = [
  { id: 'furniture', name: 'רהיטים', emoji: '🛋️' },
  { id: 'animals', name: 'חיות', emoji: '🐶' },
  { id: 'toys', name: 'צעצועים', emoji: '🧸' },
  { id: 'decor', name: 'קישוטים', emoji: '🪴' },
  { id: 'sport', name: 'פינת כושר', emoji: '🏀' },
  { id: 'colors', name: 'צבעים', emoji: '🎨' },
];

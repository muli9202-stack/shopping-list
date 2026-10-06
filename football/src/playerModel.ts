import * as THREE from 'three';
import { BOOT_COLORS, HAIR_COLORS, SKIN_TONES, type Kit, type PlayerData } from './data';

// A jointed humanoid built from capsules, animated procedurally. Each frame the
// match computes a target pose (22 joint values) from the player's state; the model
// eases toward it so actions blend instead of snapping. The final joint values are
// what the replay system records.

export const J = {
  rootY: 0, rootRX: 1, rootRZ: 2, pelvisDrop: 3,
  torsoX: 4, torsoZ: 5, torsoY: 6, headX: 7,
  lArmX: 8, lArmZ: 9, lForeX: 10, rArmX: 11, rArmZ: 12, rForeX: 13,
  lThighX: 14, lThighZ: 15, lShinX: 16, rThighX: 17, rThighZ: 18, rShinX: 19, lFootX: 20, rFootX: 21,
} as const;
export const JOINTS = 22;

export type ActionKind =
  | 'kick' | 'lob' | 'header' | 'tackle' | 'slide' | 'dive' | 'catch' | 'throw' | 'gkKick'
  | 'celebrate' | 'fallen' | 'trap' | 'chest' | 'wallJump' | 'skill' | 'roulette';

export interface PoseState {
  speed: number;
  phase: number;
  turn: number; // rad/s
  accel: number; // m/s^2 along facing
  action: ActionKind | null;
  actionT: number;
  actionDur: number;
  contact: number; // fraction of actionDur when the foot meets the ball
  leftFoot: boolean;
  diveSide: number; // -1 dive to the player's right, 1 to the left
  diveHigh: number; // 0 low .. 1 top corner
  jockey: boolean;
  isGK: boolean;
  gkReady: boolean;
  time: number;
  celebrateStyle: number;
  touch?: number; // 0..1 progress of a dribble touch, < 0 none
  touchLeft?: boolean;
}

const lerpKeys = (u: number, keys: number[][]): number => {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) {
      const [u0, v0] = keys[i - 1];
      const [u1, v1] = keys[i];
      const f = (u - u0) / (u1 - u0);
      const s = f * f * (3 - 2 * f);
      return v0 + (v1 - v0) * s;
    }
  }
  return keys[keys.length - 1][1];
};

export function computePose(o: Float32Array, s: PoseState) {
  o.fill(0);
  const a = Math.min(1, s.speed / 9);
  const ph = s.phase;
  // ---- locomotion base ----
  if (s.jockey) {
    o[J.pelvisDrop] = 0.1;
    o[J.torsoX] = 0.22;
    const sw = Math.sin(ph) * Math.min(1, s.speed / 3) * 0.3;
    o[J.lThighX] = -0.35 + sw * 0.4;
    o[J.rThighX] = -0.35 - sw * 0.4;
    o[J.lThighZ] = 0.12 + sw;
    o[J.rThighZ] = 0.12 - sw;
    o[J.lShinX] = 0.75;
    o[J.rShinX] = 0.75;
    o[J.lArmZ] = 0.45;
    o[J.rArmZ] = 0.45;
    o[J.lForeX] = -0.6;
    o[J.rForeX] = -0.6;
  } else if (s.speed > 0.15) {
    const A = 0.18 + 0.72 * a;
    o[J.lThighX] = -Math.sin(ph) * A - 0.05 * a;
    o[J.rThighX] = Math.sin(ph) * A - 0.05 * a;
    o[J.lShinX] = 0.12 + (0.25 + 1.5 * a) * Math.max(0, Math.cos(ph - 0.3));
    o[J.rShinX] = 0.12 + (0.25 + 1.5 * a) * Math.max(0, -Math.cos(ph - 0.3));
    o[J.lFootX] = -0.2 * a * Math.cos(ph);
    o[J.rFootX] = 0.2 * a * Math.cos(ph);
    o[J.lArmX] = Math.sin(ph) * (0.25 + 0.75 * a);
    o[J.rArmX] = -Math.sin(ph) * (0.25 + 0.75 * a);
    o[J.lArmZ] = 0.1;
    o[J.rArmZ] = 0.1;
    o[J.lForeX] = -(0.35 + 1.05 * a);
    o[J.rForeX] = -(0.35 + 1.05 * a);
    o[J.rootY] = -0.035 * a * Math.cos(2 * ph) + 0.02 * a;
    o[J.torsoX] = 0.06 + 0.2 * a + Math.max(-0.1, Math.min(0.2, s.accel * 0.03));
    o[J.torsoY] = Math.sin(ph) * 0.12 * a;
    o[J.rootRZ] = Math.max(-0.35, Math.min(0.35, -s.turn * s.speed * 0.035));
    o[J.headX] = -o[J.torsoX] * 0.6;
  } else {
    // idle: breathing and a slight bounce on the toes
    const b = Math.sin(s.time * 2.2);
    o[J.torsoX] = 0.04 + b * 0.012;
    o[J.lArmZ] = 0.12;
    o[J.rArmZ] = 0.12;
    o[J.lForeX] = -0.25;
    o[J.rForeX] = -0.25;
    o[J.lThighZ] = 0.05;
    o[J.rThighZ] = 0.05;
    o[J.lShinX] = 0.08;
    o[J.rShinX] = 0.08;
    if (s.isGK && s.gkReady) {
      o[J.pelvisDrop] = 0.14;
      o[J.torsoX] = 0.35;
      o[J.lThighX] = -0.45;
      o[J.rThighX] = -0.45;
      o[J.lThighZ] = 0.22;
      o[J.rThighZ] = 0.22;
      o[J.lShinX] = 0.85;
      o[J.rShinX] = 0.85;
      o[J.lArmX] = -0.5;
      o[J.rArmX] = -0.5;
      o[J.lArmZ] = 0.5;
      o[J.rArmZ] = 0.5;
      o[J.lForeX] = -0.5;
      o[J.rForeX] = -0.5;
      o[J.headX] = -0.3;
    }
  }

  if (!s.action && s.touch !== undefined && s.touch >= 0) {
    // a dribble touch: the near foot reaches out and pushes the ball on
    const k = Math.sin(Math.PI * s.touch);
    const th = s.touchLeft ? J.lThighX : J.rThighX;
    const sh = s.touchLeft ? J.lShinX : J.rShinX;
    o[th] = o[th] * (1 - k) - 0.55 * k;
    o[sh] = o[sh] * (1 - k) + 0.25 * k;
  }
  if (!s.action) return;
  const u = Math.min(1, s.actionT / Math.max(0.01, s.actionDur));
  const c = s.contact;
  const kL = s.leftFoot;
  const set = (left: number, right: number, kick: number, support: number) => {
    o[kL ? left : right] = kick;
    o[kL ? right : left] = support;
  };
  switch (s.action) {
    case 'kick':
    case 'lob':
    case 'gkKick': {
      const lob = s.action !== 'kick';
      const thigh = lerpKeys(u, [[0, 0], [c - 0.32, 0.75], [c, -0.6], [c + 0.18, lob ? -1.6 : -1.25], [1, -0.2]]);
      const shin = lerpKeys(u, [[0, 0.3], [c - 0.3, 1.7], [c - 0.02, 0.15], [c + 0.2, 0.25], [1, 0.4]]);
      set(J.lThighX, J.rThighX, thigh, -0.2);
      set(J.lShinX, J.rShinX, shin, 0.35);
      set(J.lThighZ, J.rThighZ, 0.05, 0.08);
      // balance arms: opposite arm swings across, same-side arm out
      o[kL ? J.rArmX : J.lArmX] = lerpKeys(u, [[0, 0], [c, -0.7], [1, -0.2]]);
      o[kL ? J.rArmZ : J.lArmZ] = lerpKeys(u, [[0, 0.1], [c, 0.9], [1, 0.3]]);
      o[kL ? J.lArmZ : J.rArmZ] = lerpKeys(u, [[0, 0.1], [c, 0.6], [1, 0.2]]);
      o[kL ? J.lArmX : J.rArmX] = 0.4;
      o[J.lForeX] = -0.5;
      o[J.rForeX] = -0.5;
      o[J.torsoX] = lob ? lerpKeys(u, [[0, 0.1], [c, -0.18], [1, 0]]) : lerpKeys(u, [[0, 0.15], [c, 0.3], [1, 0.1]]);
      o[J.torsoY] = (kL ? -1 : 1) * lerpKeys(u, [[0, 0], [c - 0.2, 0.3], [c + 0.1, -0.25], [1, 0]]);
      o[J.rootY] = lerpKeys(u, [[0, 0], [c + 0.1, 0.05], [1, 0]]);
      o[J.rootRZ] *= 0.3;
      break;
    }
    case 'header': {
      const jump = Math.sin(Math.PI * u);
      o[J.rootY] = jump * 0.55;
      o[J.torsoX] = lerpKeys(u, [[0, 0], [0.4, -0.45], [0.6, 0.5], [1, 0.1]]);
      o[J.headX] = lerpKeys(u, [[0, 0], [0.45, -0.4], [0.6, 0.45], [1, 0]]);
      o[J.lArmX] = -0.8;
      o[J.rArmX] = -0.8;
      o[J.lArmZ] = 0.9;
      o[J.rArmZ] = 0.9;
      o[J.lThighX] = -0.4 * jump;
      o[J.rThighX] = 0.2 * jump;
      o[J.lShinX] = 1.0 * jump;
      o[J.rShinX] = 1.3 * jump;
      break;
    }
    case 'chest': {
      o[J.torsoX] = lerpKeys(u, [[0, 0], [0.4, -0.45], [1, 0]]);
      o[J.lArmZ] = 0.8;
      o[J.rArmZ] = 0.8;
      o[J.lForeX] = -0.4;
      o[J.rForeX] = -0.4;
      o[J.headX] = 0.3;
      break;
    }
    case 'trap': {
      set(J.lThighX, J.rThighX, lerpKeys(u, [[0, 0], [0.4, -0.55], [1, 0]]), -0.1);
      set(J.lShinX, J.rShinX, lerpKeys(u, [[0, 0.2], [0.4, 0.5], [1, 0.2]]), 0.3);
      o[J.lArmZ] = 0.5;
      o[J.rArmZ] = 0.5;
      o[J.torsoX] = 0.2;
      o[J.headX] = 0.4;
      break;
    }
    case 'tackle': {
      const lunge = lerpKeys(u, [[0, 0], [0.3, 1], [0.7, 1], [1, 0]]);
      set(J.lThighX, J.rThighX, -1.05 * lunge, 0.35 * lunge);
      set(J.lShinX, J.rShinX, 0.15, 0.9 * lunge);
      o[J.pelvisDrop] = 0.2 * lunge;
      o[J.torsoX] = 0.35 * lunge;
      o[J.lArmZ] = 0.6 * lunge;
      o[J.rArmZ] = 0.6 * lunge;
      break;
    }
    case 'slide': {
      const down = lerpKeys(u, [[0, 0], [0.15, 1], [0.75, 1], [1, 0.3]]);
      o[J.pelvisDrop] = 0.72 * down;
      o[J.rootRX] = -0.35 * down;
      o[J.torsoX] = -0.55 * down;
      set(J.lThighX, J.rThighX, -1.35 * down, -0.4 * down);
      set(J.lShinX, J.rShinX, 0.05, 1.4 * down);
      o[J.lArmZ] = 0.9 * down;
      o[J.rArmZ] = 0.9 * down;
      o[J.lArmX] = 0.3 * down;
      o[J.rArmX] = 0.3 * down;
      o[J.headX] = 0.5 * down;
      break;
    }
    case 'dive': {
      // the match moves the keeper; the model rolls sideways and stretches
      const air = lerpKeys(u, [[0, 0], [0.2, 1], [0.7, 1], [1, 1]]);
      const side = s.diveSide;
      o[J.rootRZ] = side * 1.35 * air;
      o[J.rootY] = (0.25 + 0.7 * s.diveHigh) * Math.sin(Math.min(1, u * 1.6) * Math.PI) * 1.0;
      o[J.pelvisDrop] = 0.5 * lerpKeys(u, [[0, 0], [0.6, 0.3], [1, 0.75]]);
      o[J.lArmZ] = 2.6 * air;
      o[J.rArmZ] = 2.6 * air;
      o[J.lArmX] = -0.3;
      o[J.rArmX] = -0.3;
      o[J.lForeX] = -0.1;
      o[J.rForeX] = -0.1;
      o[J.lThighZ] = 0.25 * air;
      o[J.rThighZ] = 0.25 * air;
      o[J.lShinX] = 0.4;
      o[J.rShinX] = 0.4;
      break;
    }
    case 'catch': {
      o[J.lArmX] = -1.2;
      o[J.rArmX] = -1.2;
      o[J.lArmZ] = 0.15;
      o[J.rArmZ] = 0.15;
      o[J.lForeX] = -1.1;
      o[J.rForeX] = -1.1;
      o[J.torsoX] = 0.25;
      break;
    }
    case 'throw': {
      const arms = lerpKeys(u, [[0, -2.9], [0.45, -3.3], [0.7, -1.6], [1, -0.6]]);
      o[J.lArmX] = arms;
      o[J.rArmX] = arms;
      o[J.lForeX] = lerpKeys(u, [[0, -1.2], [0.5, -1.4], [0.75, -0.2], [1, -0.2]]);
      o[J.rForeX] = o[J.lForeX];
      o[J.torsoX] = lerpKeys(u, [[0, 0], [0.45, -0.35], [0.75, 0.3], [1, 0.1]]);
      break;
    }
    case 'celebrate': {
      const st = s.celebrateStyle;
      if (st === 0) {
        // airplane
        o[J.lArmZ] = 1.5;
        o[J.rArmZ] = 1.5;
        o[J.lForeX] = 0;
        o[J.rForeX] = 0;
        o[J.lArmX] = 0;
        o[J.rArmX] = 0;
        o[J.rootRZ] = Math.sin(s.time * 2) * 0.3;
      } else if (st === 1) {
        // fists up
        o[J.lArmX] = -2.8;
        o[J.rArmX] = -2.8;
        o[J.lForeX] = -0.6;
        o[J.rForeX] = -0.6;
        o[J.lArmZ] = 0.35;
        o[J.rArmZ] = 0.35;
        o[J.torsoX] = -0.2;
        o[J.headX] = -0.4;
      } else {
        // knee slide
        const down = lerpKeys(u, [[0, 0], [0.2, 1], [1, 1]]);
        o[J.pelvisDrop] = 0.45 * down;
        o[J.lThighX] = 0.1 * down;
        o[J.rThighX] = 0.1 * down;
        o[J.lShinX] = 1.7 * down;
        o[J.rShinX] = 1.7 * down;
        o[J.torsoX] = -0.45 * down;
        o[J.lArmX] = -2.6 * down;
        o[J.rArmX] = -2.6 * down;
        o[J.lArmZ] = 0.6;
        o[J.rArmZ] = 0.6;
        o[J.headX] = -0.5 * down;
      }
      break;
    }
    case 'fallen': {
      const down = lerpKeys(u, [[0, 0], [0.12, 1], [0.8, 1], [1, 0]]);
      o[J.rootRX] = -1.45 * down;
      o[J.pelvisDrop] = 0.78 * down;
      o[J.lArmZ] = 0.9 * down;
      o[J.rArmZ] = 1.2 * down;
      o[J.lThighX] = -0.3 * down;
      o[J.rShinX] = 0.9 * down;
      o[J.rThighX] = -0.6 * down;
      break;
    }
    case 'wallJump': {
      const jump = Math.sin(Math.PI * u);
      o[J.rootY] = jump * 0.45;
      o[J.lArmX] = 0;
      o[J.rArmX] = 0;
      o[J.lArmZ] = 0.05;
      o[J.rArmZ] = 0.05;
      o[J.lShinX] = 0.6 * jump;
      o[J.rShinX] = 0.6 * jump;
      break;
    }
    case 'skill': {
      // step-over: the leg circles around the ball
      set(J.lThighX, J.rThighX, lerpKeys(u, [[0, 0], [0.5, -0.6], [1, 0]]), -0.1);
      set(J.lThighZ, J.rThighZ, lerpKeys(u, [[0, 0], [0.3, -0.5], [0.7, 0.6], [1, 0]]), 0.1);
      set(J.lShinX, J.rShinX, 0.6, 0.3);
      o[J.torsoZ] = (kL ? 1 : -1) * lerpKeys(u, [[0, 0], [0.5, 0.35], [1, 0]]);
      o[J.lArmZ] = 0.6;
      o[J.rArmZ] = 0.6;
      break;
    }
    case 'roulette': {
      o[J.lArmZ] = 0.7;
      o[J.rArmZ] = 0.7;
      o[J.torsoX] = 0.15;
      set(J.lThighX, J.rThighX, -0.3, 0.1);
      set(J.lShinX, J.rShinX, 0.5, 0.3);
      break;
    }
  }
}

// ---------- geometry & materials ----------
const geoCache = new Map<string, THREE.BufferGeometry>();
const geo = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
};
const cap = (r: number, l: number) => geo(`c${r}-${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
// Body parts turned on a lathe from [radius, y] profiles: tapered, muscular limbs.
const lathe = (key: string, pts: number[][], seg = 16) =>
  geo(`l-${key}`, () => {
    // lathe faces point outwards when the profile runs bottom-to-top
    const ordered = pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts;
    const g = new THREE.LatheGeometry(ordered.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), seg);
    g.computeVertexNormals();
    return g;
  });
const PROFILES = {
  torso: [[0, -0.04], [0.125, -0.03], [0.13, 0.05], [0.138, 0.14], [0.152, 0.26], [0.165, 0.37], [0.163, 0.46], [0.14, 0.53], [0.09, 0.58], [0, 0.6]],
  thigh: [[0, 0.03], [0.07, 0.01], [0.082, -0.07], [0.08, -0.17], [0.07, -0.29], [0.056, -0.4], [0.047, -0.45], [0, -0.47]],
  shortLeg: [[0, 0.04], [0.088, 0.02], [0.094, -0.06], [0.092, -0.15], [0, -0.152]],
  knee: [[0, 0.03], [0.047, 0.02], [0.05, -0.03], [0.05, -0.08], [0, -0.081]],
  calf: [[0, -0.05], [0.05, -0.055], [0.058, -0.12], [0.06, -0.17], [0.052, -0.26], [0.04, -0.36], [0.034, -0.41], [0, -0.42]],
  upperArm: [[0, 0.03], [0.05, 0.01], [0.052, -0.06], [0.047, -0.16], [0.04, -0.27], [0, -0.29]],
  sleeve: [[0, 0.05], [0.064, 0.03], [0.064, -0.05], [0.06, -0.12], [0, -0.121]],
  foreArm: [[0, 0.01], [0.038, 0], [0.042, -0.06], [0.034, -0.17], [0.027, -0.23], [0, -0.24]],
};
const sph = (r: number) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 18, 14));

const matCache = new Map<string, THREE.Material>();
export function stdMat(color: string, rough = 0.75, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const key = `${color}|${rough}|${JSON.stringify(extra ?? {})}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
    matCache.set(key, m);
  }
  return m;
}

function shirtMaterial(kit: Kit): THREE.Material {
  const key = `shirt|${kit.shirt}|${kit.stripes ?? ''}`;
  let m = matCache.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = kit.shirt;
  g.fillRect(0, 0, 128, 64);
  if (kit.stripes) {
    g.fillStyle = kit.stripes;
    for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 8, 64);
  }
  // subtle fabric weave
  g.globalAlpha = 0.06;
  for (let i = 0; i < 400; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
    g.fillRect(Math.random() * 128, Math.random() * 64, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82 });
  matCache.set(key, m);
  return m;
}

function numberMaterial(num: number, kit: Kit, name: string): THREE.Material {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = kit.number;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 22px Heebo, Arial, sans-serif';
  g.direction = 'rtl';
  const last = name.split(' ').slice(-1)[0];
  g.fillText(last, 64, 20);
  g.font = '800 96px Heebo, Arial, sans-serif';
  g.direction = 'ltr';
  g.fillText(String(num), 64, 96);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  m.userData.own = true;
  return m;
}

export class PlayerModel {
  root = new THREE.Group();
  private body = new THREE.Group();
  private pelvis = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private lArm = new THREE.Group();
  private rArm = new THREE.Group();
  private lFore = new THREE.Group();
  private rFore = new THREE.Group();
  private lThigh = new THREE.Group();
  private rThigh = new THREE.Group();
  private lShin = new THREE.Group();
  private rShin = new THREE.Group();
  private lFoot = new THREE.Group();
  private rFoot = new THREE.Group();
  joints = new Float32Array(JOINTS);
  private target = new Float32Array(JOINTS);
  heightScale: number;

  constructor(p: PlayerData, kit: Kit, isGK: boolean) {
    const skin = stdMat(SKIN_TONES[p.skin] ?? SKIN_TONES[1], 0.68);
    const hairM = stdMat(HAIR_COLORS[p.hairColor] ?? HAIR_COLORS[0], 0.9);
    const shirt = shirtMaterial(kit);
    const sleeve = stdMat(kit.sleeve, 0.82);
    const shorts = stdMat(kit.shorts, 0.8);
    const socks = stdMat(kit.socks, 0.85);
    const boot = stdMat(BOOT_COLORS[p.boots] ?? '#111', 0.35);
    const glove = stdMat(isGK ? '#f4f4f5' : SKIN_TONES[p.skin], isGK ? 0.7 : 0.6);
    const dark = stdMat('#1a1a1a', 0.4);

    this.heightScale = p.height / 182;
    const bulk = Math.max(0.9, Math.min(1.18, p.weight / (p.height - 106)));
    this.root.add(this.body);
    this.root.rotation.order = 'YXZ';
    this.body.scale.set(this.heightScale * bulk, this.heightScale, this.heightScale * bulk);

    const add = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      // tiny face details don't need to cast shadows (saves draw calls)
      mesh.castShadow = parent !== this.head || g === geoCache.get('s0.105');
      mesh.receiveShadow = false;
      parent.add(mesh);
      return mesh;
    };

    this.body.add(this.pelvis);
    this.pelvis.position.y = 0.94;
    add(this.pelvis, cap(0.15, 0.08), shorts, 0, 0.02, 0, 1.18, 1, 0.82);

    this.pelvis.add(this.torso);
    this.torso.position.y = 0.05;
    add(this.torso, lathe('torso', PROFILES.torso, 20), shirt, 0, 0, 0, 1.3, 1, 0.74);
    add(this.torso, sph(0.07), sleeve, 0.19, 0.5, 0, 1, 0.9, 1); // shoulders
    add(this.torso, sph(0.07), sleeve, -0.19, 0.5, 0, 1, 0.9, 1);
    add(this.torso, cap(0.05, 0.05), skin, 0, 0.6, 0); // neck
    const back = new THREE.Mesh(geo('plane-num', () => new THREE.PlaneGeometry(0.26, 0.32)), numberMaterial(p.num, kit, p.name));
    back.position.set(0, 0.3, -0.122);
    back.rotation.y = Math.PI;
    this.torso.add(back);
    // small crest on the chest
    add(this.torso, geo('crest', () => new THREE.CircleGeometry(0.03, 12)), stdMat(kit.number, 0.6), 0.07, 0.4, 0.122);

    this.torso.add(this.head);
    this.head.position.y = 0.72;
    add(this.head, sph(0.105), skin, 0, 0, 0, 0.92, 1.12, 1);
    add(this.head, sph(0.08), skin, 0, -0.045, 0.022, 0.92, 0.9, 1); // jaw
    add(this.head, sph(0.022), skin, 0.1, 0, -0.005, 0.6, 1.1, 1); // ears
    add(this.head, sph(0.022), skin, -0.1, 0, -0.005, 0.6, 1.1, 1);
    add(this.head, sph(0.019), skin, 0, -0.005, 0.105, 0.8, 1, 1); // nose
    add(this.head, sph(0.012), dark, 0.036, 0.025, 0.093); // eyes
    add(this.head, sph(0.012), dark, -0.036, 0.025, 0.093);
    add(this.head, geo('brow', () => new THREE.BoxGeometry(0.035, 0.008, 0.01)), hairM, 0.036, 0.048, 0.098);
    add(this.head, geo('brow', () => new THREE.BoxGeometry(0.035, 0.008, 0.01)), hairM, -0.036, 0.048, 0.098);
    this.addHair(p.hair, hairM, add);

    const arm = (g: THREE.Group, fore: THREE.Group, side: number) => {
      this.torso.add(g);
      g.position.set(0.2 * side, 0.5, 0);
      add(g, lathe('sleeve', PROFILES.sleeve), sleeve, 0, 0, 0);
      add(g, lathe('upperArm', PROFILES.upperArm), skin, 0, 0, 0);
      g.add(fore);
      fore.position.y = -0.29;
      add(fore, sph(0.043), isGK ? sleeve : skin, 0, 0, 0); // elbow
      add(fore, lathe('foreArm', PROFILES.foreArm), isGK ? sleeve : skin, 0, 0, 0);
      add(fore, sph(isGK ? 0.06 : 0.045), glove, 0, -0.27, 0.01, 0.8, 1.1, 0.6);
    };
    arm(this.lArm, this.lFore, 1);
    arm(this.rArm, this.rFore, -1);

    const leg = (thigh: THREE.Group, shin: THREE.Group, foot: THREE.Group, side: number) => {
      this.pelvis.add(thigh);
      thigh.position.set(0.095 * side, -0.02, 0);
      add(thigh, lathe('shortLeg', PROFILES.shortLeg), shorts, 0, 0, 0);
      add(thigh, lathe('thigh', PROFILES.thigh), skin, 0, 0, 0);
      thigh.add(shin);
      shin.position.y = -0.45;
      add(shin, lathe('knee', PROFILES.knee), skin, 0, 0, 0.004);
      add(shin, lathe('calf', PROFILES.calf), socks, 0, 0, -0.006);
      shin.add(foot);
      foot.position.y = -0.42;
      add(foot, geo('boot', () => new THREE.CapsuleGeometry(0.045, 0.15, 4, 10).rotateX(Math.PI / 2)), boot, 0, -0.012, 0.055, 1.05, 0.75, 1);
    };
    leg(this.lThigh, this.lShin, this.lFoot, 1);
    leg(this.rThigh, this.rShin, this.rFoot, -1);
  }

  private addHair(style: number, m: THREE.Material, add: (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x?: number, y?: number, z?: number, sx?: number, sy?: number, sz?: number) => THREE.Mesh) {
    const capG = (r: number, theta: number) => geo(`hair${r}-${theta}`, () => new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, theta));
    switch (style % 6) {
      case 0:
        add(this.head, capG(0.112, 1.45), m, 0, 0.012, -0.008, 0.95, 1.12, 1.05);
        break;
      case 1:
        add(this.head, capG(0.108, 1.6), m, 0, 0.005, -0.006, 0.94, 1.12, 1.02);
        break;
      case 2:
        add(this.head, capG(0.115, 1.55), m, 0, 0.012, -0.01, 0.97, 1.12, 1.06);
        add(this.head, cap(0.085, 0.1), m, 0, -0.07, -0.05, 1.1, 1, 0.6);
        break;
      case 3:
        break; // shaved
      case 4:
        add(this.head, sph(0.14), m, 0, 0.05, -0.02, 1, 0.9, 1);
        break;
      case 5:
        add(this.head, capG(0.109, 1.5), m, 0, 0.006, -0.006, 0.94, 1.12, 1.03);
        add(this.head, geo('quiff', () => new THREE.BoxGeometry(0.05, 0.05, 0.16)), m, 0, 0.12, 0.01);
        break;
    }
  }

  private bandageMesh: THREE.Mesh | null = null;
  // White head bandage after a head knock.
  bandage(on: boolean) {
    if (on && !this.bandageMesh) {
      this.bandageMesh = new THREE.Mesh(geo('bandage', () => new THREE.TorusGeometry(0.108, 0.022, 8, 24)), stdMat('#f4f4f5', 0.9));
      this.bandageMesh.rotation.x = Math.PI / 2;
      this.bandageMesh.position.y = 0.045;
      this.head.add(this.bandageMesh);
    }
    if (this.bandageMesh) this.bandageMesh.visible = on;
  }

  // World position of a boot (for exact foot-to-ball contact).
  footWorld(left: boolean, out: THREE.Vector3) {
    const f = left ? this.lFoot : this.rFoot;
    f.updateWorldMatrix(true, false);
    return out.set(0, -0.012, 0.09).applyMatrix4(f.matrixWorld);
  }

  setTarget(s: PoseState) {
    computePose(this.target, s);
  }

  // Eases joints toward the target pose. Fast actions use a higher rate.
  blend(dt: number, rate = 14) {
    const f = 1 - Math.exp(-rate * dt);
    for (let i = 0; i < JOINTS; i++) this.joints[i] += (this.target[i] - this.joints[i]) * f;
    this.apply();
  }

  snap() {
    this.joints.set(this.target);
    this.apply();
  }

  apply(j: Float32Array = this.joints) {
    this.body.position.y = j[J.rootY];
    this.body.rotation.set(j[J.rootRX], 0, j[J.rootRZ]);
    this.pelvis.position.y = 0.94 - j[J.pelvisDrop];
    this.torso.rotation.set(j[J.torsoX], j[J.torsoY], j[J.torsoZ]);
    this.head.rotation.x = j[J.headX];
    this.lArm.rotation.set(j[J.lArmX], 0, j[J.lArmZ]);
    this.rArm.rotation.set(j[J.rArmX], 0, -j[J.rArmZ]);
    this.lFore.rotation.x = j[J.lForeX];
    this.rFore.rotation.x = j[J.rForeX];
    this.lThigh.rotation.set(j[J.lThighX], 0, j[J.lThighZ]);
    this.rThigh.rotation.set(j[J.rThighX], 0, -j[J.rThighZ]);
    this.lShin.rotation.x = j[J.lShinX];
    this.rShin.rotation.x = j[J.rShinX];
    this.lFoot.rotation.x = j[J.lFootX];
    this.rFoot.rotation.x = j[J.rFootX];
  }
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { Kit } from './data';

// Optional custom character: a rigged GLB the player loads from their own device
// (stored only in this browser's IndexedDB, never uploaded). The procedural body in
// playerModel.ts keeps running as an invisible "driver" skeleton; every frame each
// mapped bone of the custom mesh copies its driver limb's rotation, so all the
// existing animation (running, kicks, dives, celebrations, replays) drives it.

export type Part =
  | 'pelvis' | 'spine' | 'head'
  | 'lArm' | 'lFore' | 'rArm' | 'rFore'
  | 'lThigh' | 'lShin' | 'lFoot' | 'rThigh' | 'rShin' | 'rFoot';

// Hierarchy order: parents are always solved before their children.
export const PARTS: Part[] = ['pelvis', 'spine', 'head', 'lArm', 'lFore', 'rArm', 'rFore', 'lThigh', 'lShin', 'lFoot', 'rThigh', 'rShin', 'rFoot'];

// Bone-name patterns for the common rigs (Valve biped, Mixamo, Blender/Rigify-style .L/.R).
const side = (s: 'l' | 'r', names: string[]) => {
  const w = s === 'l' ? 'left' : 'right';
  return names.flatMap((n) => [new RegExp(`(^|[_:.\\s])${s}[_.\\s]?${n}$`, 'i'), new RegExp(`${w}${n}$`, 'i'), new RegExp(`${n}[_.]?${s}$`, 'i')]);
};
const PATTERNS: Record<Part, RegExp[]> = {
  pelvis: [/pelvis$/i, /hips?$/i],
  spine: [/(^|[_:.\s])spine$/i, /spine[_.]?0?1?$/i],
  head: [/head1?$/i],
  lArm: side('l', ['upperarm', 'arm']),
  lFore: side('l', ['forearm', 'lowerarm']),
  rArm: side('r', ['upperarm', 'arm']),
  rFore: side('r', ['forearm', 'lowerarm']),
  lThigh: side('l', ['thigh', 'upleg', 'upperleg']),
  lShin: side('l', ['calf', 'shin', 'leg', 'lowerleg']),
  lFoot: side('l', ['foot']),
  rThigh: side('r', ['thigh', 'upleg', 'upperleg']),
  rShin: side('r', ['calf', 'shin', 'leg', 'lowerleg']),
  rFoot: side('r', ['foot']),
};

const clean = (name: string) => name.replace(/_\d+$/, '');

function findBones(root: THREE.Object3D): Partial<Record<Part, THREE.Bone>> {
  const bones: THREE.Bone[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
  });
  const out: Partial<Record<Part, THREE.Bone>> = {};
  for (const part of PARTS) {
    for (const re of PATTERNS[part]) {
      const b = bones.find((x) => re.test(clean(x.name)) && !Object.values(out).includes(x));
      if (b) {
        out[part] = b;
        break;
      }
    }
  }
  return out;
}

export interface Rig {
  template: THREE.Group; // normalised: faces +z, feet on y=0, 1.83 m tall, left side on +x
  name: string;
}

let rig: Rig | null = null;
let scope: 'off' | 'mine' | 'all' = 'mine';

export const customRig = () => rig;
export function setCustomScope(s: 'off' | 'mine' | 'all') {
  scope = s;
}
export const wantsCustom = (mine: boolean) => !!rig && (scope === 'all' || (scope === 'mine' && mine));

const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

async function parseRig(buf: ArrayBuffer, name: string): Promise<Rig> {
  const gltf = await new GLTFLoader().parseAsync(buf, '');
  const scene = gltf.scene;
  const bones = findBones(scene);
  const need: Part[] = ['pelvis', 'head', 'lThigh', 'rThigh', 'lShin', 'rShin', 'lFoot', 'rFoot'];
  const missing = need.filter((p) => !bones[p]);
  if (missing.length) throw new Error(`לא נמצא שלד אנושי מתאים במודל (חסר: ${missing.join(', ')})`);
  let skinned = false;
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
  });
  if (!skinned) throw new Error('המודל לא מכיל רשת עם שלד (skinned mesh)');

  // Orient: up = feet → head, left = right thigh → left thigh, forward = left × up.
  scene.updateMatrixWorld(true);
  const feet = worldPos(bones.lFoot!).add(worldPos(bones.rFoot!)).multiplyScalar(0.5);
  const up = worldPos(bones.head!).sub(feet).normalize();
  const left = worldPos(bones.lThigh!).sub(worldPos(bones.rThigh!));
  left.addScaledVector(up, -left.dot(up)).normalize();
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
  const basis = new THREE.Matrix4().makeBasis(left, up, fwd);
  const holder = new THREE.Group();
  holder.add(scene);
  scene.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(basis).invert());
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder, true);
  const h = box.max.y - box.min.y;
  if (!(h > 0)) throw new Error('גובה המודל לא תקין');
  const s = 1.83 / h;
  scene.scale.multiplyScalar(s);
  scene.position.multiplyScalar(s);
  holder.updateMatrixWorld(true);
  box.setFromObject(holder, true);
  scene.position.x -= (box.min.x + box.max.x) / 2;
  scene.position.z -= (box.min.z + box.max.z) / 2;
  scene.position.y -= box.min.y;

  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = false;
    m.frustumCulled = false; // skinned bounds don't follow the animation
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      if (mat.transparent || mat.alphaTest > 0) {
        // hair cards: alpha-test instead of blending avoids sorting artefacts
        mat.transparent = false;
        mat.alphaTest = 0.45;
        mat.depthWrite = true;
        mat.side = THREE.DoubleSide;
      }
      if ('roughness' in mat) mat.roughness = Math.max(mat.roughness, 0.55);
      if ('metalness' in mat) mat.metalness = 0;
    }
  });
  return { template: holder, name };
}

const KEY = 'fb-custom-model';
export async function loadCustomModel(file: File) {
  const buf = await file.arrayBuffer();
  const r = await parseRig(buf, file.name);
  rig = r;
  try {
    await idbSet(KEY, { buf, name: file.name });
  } catch {
    // storage blocked (private window / sandbox): keep it for this session only
  }
  return r;
}
export async function restoreCustomModel() {
  try {
    const v = await idbGet<{ buf: ArrayBuffer; name: string }>(KEY);
    if (v) rig = await parseRig(v.buf, v.name);
  } catch (e) {
    console.warn('custom model', e);
  }
  return rig;
}
export async function clearCustomModel() {
  rig = null;
  await idbDel(KEY).catch(() => {});
}

// ---------------------------------------------------------------- kit recolouring
type Slot = 'shirt' | 'shorts' | 'socks' | 'boots' | 'gloves';
const SLOT_RE: [Slot, RegExp][] = [
  ['shirt', /shirt|jersey|kit|top|torso_cloth|uniform/i],
  ['shorts', /short|pants|trouser/i],
  ['socks', /sock/i],
  ['boots', /boot|shoe|cleat/i],
  ['gloves', /glove/i],
];
const kitMats = new Map<string, THREE.Material>();
function kitMaterial(orig: THREE.Material, color: string) {
  const key = `${orig.uuid}|${color}`;
  let m = kitMats.get(key);
  if (!m) {
    const o = orig as THREE.MeshStandardMaterial;
    // Plain team colour (the original print may carry real sponsors/badges), keeping
    // any normal map so the fabric folds still read.
    m = new THREE.MeshStandardMaterial({ name: o.name, color, roughness: 0.8, metalness: 0, normalMap: o.normalMap ?? null, side: o.side });
    kitMats.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------- per-player instance
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();

// Rotation of `o` relative to `stop` (exclusive), from local quaternions only.
function chainQuat(o: THREE.Object3D, stop: THREE.Object3D, out: THREE.Quaternion) {
  out.identity();
  for (let n: THREE.Object3D | null = o; n && n !== stop; n = n.parent) out.premultiply(n.quaternion);
  return out;
}

export class CustomBody {
  root: THREE.Group;
  private bones: Partial<Record<Part, THREE.Bone>>;
  private rest = new Map<Part, THREE.Quaternion>(); // bone rest rotation (player space) pre-aligned to the driver's rest

  constructor(r: Rig, kit: Kit, boots: string, isGK: boolean, owner: THREE.Object3D, backNumber?: THREE.Mesh, scale = 1) {
    this.root = cloneSkinned(r.template) as THREE.Group;
    this.root.scale.setScalar(scale);
    this.bones = findBones(this.root);
    const colours: Record<Slot, string> = { shirt: kit.shirt, shorts: kit.shorts, socks: kit.socks, boots, gloves: isGK ? '#f4f4f5' : kit.shirt };
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const swap = (mat: THREE.Material) => {
        const slot = SLOT_RE.find(([, re]) => re.test(mat.name) || re.test(m.name));
        return slot ? kitMaterial(mat, colours[slot[0]]) : mat;
      };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    });
    owner.add(this.root);
    // Rest alignment: the driver's rest pose has arms and legs hanging straight down
    // and feet pointing +z. Rotate each limb bone's rest so it matches, whatever the
    // model's bind pose (T-pose, A-pose, splayed feet).
    this.root.updateMatrixWorld(true);
    const ownerInv = new THREE.Matrix4().copy(owner.matrixWorld).invert();
    const pos = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(ownerInv);
    const childOf = (p: Part): THREE.Object3D | undefined => {
      const next: Partial<Record<Part, Part>> = { lArm: 'lFore', rArm: 'rFore', lThigh: 'lShin', rThigh: 'rShin', lShin: 'lFoot', rShin: 'rFoot' };
      const n = next[p];
      if (n && this.bones[n]) return this.bones[n];
      return this.bones[p]?.children.find((c) => (c as THREE.Bone).isBone);
    };
    for (const p of PARTS) {
      const b = this.bones[p];
      if (!b) continue;
      const q = chainQuat(b, owner, new THREE.Quaternion());
      const c = childOf(p);
      if (c && p !== 'pelvis' && p !== 'spine' && p !== 'head') {
        const d = pos(c).sub(pos(b));
        let target = new THREE.Vector3(0, -1, 0);
        if (p === 'lFoot' || p === 'rFoot') {
          d.y = 0;
          target = new THREE.Vector3(0, 0, 1);
        }
        if (d.lengthSq() > 1e-8) q.premultiply(new THREE.Quaternion().setFromUnitVectors(d.normalize(), target));
      }
      this.rest.set(p, q);
    }
    if (backNumber) this.placeNumber(backNumber, owner);
  }

  // Sticks the name/number decal onto the back of the shirt: cast a ray from behind
  // at chest height onto the shirt mesh, then parent the decal to the chest bone.
  private placeNumber(plane: THREE.Mesh, owner: THREE.Object3D) {
    let chest: THREE.Bone | undefined;
    this.root.traverse((o) => {
      if (!chest && (o as THREE.Bone).isBone && /(spine2|spine4|upperchest|chest)$/i.test(clean(o.name))) chest = o as THREE.Bone;
    });
    chest ??= this.bones.spine ?? this.bones.pelvis;
    const shirts: THREE.Object3D[] = [];
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && SLOT_RE[0][1].test(`${(m.material as THREE.Material).name} ${m.name}`)) shirts.push(m);
    });
    if (!chest || !shirts.length) return;
    const hs = this.root.scale.x;
    const y = 1.3 * hs;
    const from = new THREE.Vector3(0, y, -2).applyMatrix4(owner.matrixWorld);
    const dir = new THREE.Vector3(0, 0, 1).transformDirection(owner.matrixWorld);
    const hit = new THREE.Raycaster(from, dir, 0, 4).intersectObjects(shirts, false)[0];
    if (!hit) return;
    owner.add(plane);
    const local = hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(owner.matrixWorld).invert());
    plane.position.set(0, y, local.z - 0.012);
    plane.rotation.set(0, Math.PI, 0);
    plane.scale.setScalar(hs * 0.9);
    owner.updateMatrixWorld(true);
    chest.attach(plane);
  }

  // drivers: the procedural limb groups; owner: the player root both hang from.
  update(drivers: Record<Part, THREE.Object3D>, owner: THREE.Object3D, offset: THREE.Vector3) {
    this.root.position.copy(offset);
    for (const p of PARTS) {
      const b = this.bones[p];
      if (!b) continue;
      chainQuat(drivers[p], owner, tmpQ).multiply(this.rest.get(p)!); // target, player space
      chainQuat(b.parent!, owner, tmpQ2).invert();
      b.quaternion.copy(tmpQ2.multiply(tmpQ));
    }
  }
}

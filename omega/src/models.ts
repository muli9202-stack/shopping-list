import * as THREE from 'three';

// Low-poly procedural models. Every model is a THREE.Group whose origin sits
// on the ground at the object's centre, facing +Z.

const matCache = new Map<string, THREE.Material>();
export function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts })));
  return m;
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export interface PedModel {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  head: THREE.Mesh;
  phone: THREE.Mesh;
  hand: THREE.Object3D;
  torso: THREE.Mesh;
}

export function pedModel(shirt: number, pants: number, skin: number, extra?: 'helmet' | 'cap' | 'robe' | 'hardhat' | 'beret') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const sm = mat(shirt), pm = mat(pants), km = mat(skin);
  const torso = box(0.55, 0.65, 0.3, sm, 0, 1.25, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), km);
  head.position.y = 1.75;
  head.castShadow = true;
  const mkLeg = (x: number) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(x, 0.92, 0);
    pivot.add(box(0.2, 0.9, 0.22, extra === 'robe' ? sm : pm, 0, -0.45, 0));
    return pivot;
  };
  const mkArm = (x: number) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(x, 1.52, 0);
    pivot.add(box(0.15, 0.62, 0.16, sm, 0, -0.3, 0));
    const hand = box(0.12, 0.12, 0.12, km, 0, -0.64, 0);
    pivot.add(hand);
    return pivot;
  };
  const legL = mkLeg(-0.14), legR = mkLeg(0.14), armL = mkArm(-0.36), armR = mkArm(0.36);
  const hand = new THREE.Object3D();
  hand.position.set(0, -0.62, 0.05);
  armR.add(hand);
  const phone = box(0.08, 0.16, 0.02, mat(0x111111, { emissive: 0x3366ff, emissiveIntensity: 0.6 }), 0, -0.55, 0.12);
  phone.visible = false;
  armL.add(phone);
  body.add(torso, head, legL, legR, armL, armR);
  if (extra === 'helmet') body.add(box(0.4, 0.2, 0.42, mat(0x1a1a1a), 0, 1.88, 0));
  if (extra === 'cap') body.add(box(0.36, 0.1, 0.4, mat(0x1d3a8a), 0, 1.9, 0.05));
  if (extra === 'hardhat') body.add(box(0.38, 0.14, 0.38, mat(0xf2c200), 0, 1.9, 0));
  if (extra === 'beret') body.add(box(0.36, 0.08, 0.36, mat(0x3f4f2a), 0, 1.9, 0));
  if (extra === 'robe') body.add(box(0.6, 0.9, 0.36, sm, 0, 0.75, 0));
  return { root, body, legL, legR, armL, armR, head, phone, hand, torso } as PedModel;
}

export function gunModel(kind: string) {
  const g = new THREE.Group();
  const dark = mat(0x1b1b1b, { metalness: 0.6, roughness: 0.4 });
  const wood = mat(0x6b4226);
  switch (kind) {
    case 'pistol':
      g.add(box(0.05, 0.12, 0.22, dark, 0, 0.02, 0.08));
      break;
    case 'smg':
      g.add(box(0.06, 0.14, 0.42, dark, 0, 0.02, 0.15));
      break;
    case 'rifle':
      g.add(box(0.06, 0.12, 0.85, dark, 0, 0.02, 0.3), box(0.05, 0.18, 0.06, dark, 0, -0.08, 0.2));
      break;
    case 'sniper':
      g.add(box(0.07, 0.12, 1.25, dark, 0, 0.02, 0.45), box(0.06, 0.08, 0.3, dark, 0, 0.12, 0.3));
      break;
    case 'shotgun':
      g.add(box(0.07, 0.1, 0.9, dark, 0, 0.02, 0.3), box(0.07, 0.1, 0.3, wood, 0, -0.03, -0.05));
      break;
    case 'heavy':
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8).rotateX(Math.PI / 2).translate(0, 0.05, 0.3), mat(0x3d4a2a)));
      break;
    case 'minigun':
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 8).rotateX(Math.PI / 2).translate(0, 0, 0.35), dark));
      break;
    case 'knife':
      g.add(box(0.02, 0.03, 0.25, mat(0xcccccc, { metalness: 0.9 }), 0, 0, 0.12));
      break;
    case 'bat':
      g.add(box(0.06, 0.06, 0.85, wood, 0, 0, 0.4));
      break;
  }
  return g;
}

export interface VehicleModel {
  root: THREE.Group;
  body: THREE.Group;
  glass: THREE.Mesh | null;
  wheels: THREE.Object3D[];
  rotor?: THREE.Object3D;
  tailRotor?: THREE.Object3D;
  lightBar?: THREE.Mesh[];
  turret?: THREE.Object3D;
  headlights?: THREE.Mesh;
  paintMats: THREE.MeshStandardMaterial[];
}

export function vehicleModel(kind: string, w: number, h: number, l: number, color: number, variant = ''): VehicleModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
  const dark = mat(0x151515);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2a36, roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.85 });
  const wheels: THREE.Object3D[] = [];
  let glass: THREE.Mesh | null = null;
  const m: VehicleModel = { root, body, glass, wheels, paintMats: [paint] };
  const wheel = (x: number, z: number, r: number, wd = 0.3) => {
    const p = new THREE.Object3D();
    p.position.set(x, r, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wd, 12).rotateZ(Math.PI / 2), dark);
    t.castShadow = true;
    p.add(t);
    root.add(p);
    wheels.push(p);
  };

  if (kind === 'car' || kind === 'truck' || kind === 'tank' || kind === 'apc') {
    const r = kind === 'tank' ? 0.6 : kind === 'car' ? 0.38 : 0.55;
    const clearance = r * 1.2;
    body.add(box(w, h * 0.45, l, paint, 0, clearance + h * 0.22, 0));
    if (kind === 'car') {
      glass = box(w * 0.86, h * 0.38, l * 0.48, glassMat, 0, clearance + h * 0.45 + h * 0.18, -l * 0.04);
      body.add(glass);
      body.add(box(w * 0.88, 0.06, l * 0.5, paint, 0, clearance + h * 0.45 + h * 0.38, -l * 0.04));
    } else if (kind === 'truck') {
      body.add(box(w, h * 0.5, l * 0.3, paint, 0, clearance + h * 0.7, l * 0.33));
      glass = box(w * 0.9, h * 0.25, 0.1, glassMat, 0, clearance + h * 0.75, l * 0.48);
      body.add(glass);
      body.add(box(w, h * 0.55, l * 0.62, mat(0x4a5a3a), 0, clearance + h * 0.72, -l * 0.17));
    } else if (kind === 'apc') {
      body.add(box(w * 0.9, h * 0.4, l * 0.8, paint, 0, clearance + h * 0.62, -l * 0.05));
      const turret = new THREE.Group();
      turret.add(box(1.2, 0.5, 1.2, paint), box(0.12, 0.12, 1.6, dark, 0, 0, 0.9));
      turret.position.set(0, clearance + h * 0.95, 0);
      body.add(turret);
      m.turret = turret;
    } else {
      const turret = new THREE.Group();
      turret.add(box(w * 0.6, h * 0.35, l * 0.45, paint), box(0.25, 0.25, l * 0.6, paint, 0, 0, l * 0.45));
      turret.position.set(0, clearance + h * 0.6, -l * 0.05);
      body.add(turret);
      m.turret = turret;
      body.add(box(0.5, r * 2, l, dark, -w / 2 + 0.25, r, 0), box(0.5, r * 2, l, dark, w / 2 - 0.25, r, 0));
    }
    if (kind !== 'tank') {
      const axle = l * 0.34;
      wheel(-w / 2 + 0.1, axle, r);
      wheel(w / 2 - 0.1, axle, r);
      wheel(-w / 2 + 0.1, -axle, r);
      wheel(w / 2 - 0.1, -axle, r);
      if (kind !== 'car') {
        wheel(-w / 2 + 0.1, 0, r);
        wheel(w / 2 - 0.1, 0, r);
      }
    }
    const hl = box(w * 0.8, 0.14, 0.05, mat(0xfff6d8, { emissive: 0xfff2c0, emissiveIntensity: 0.3 }), 0, clearance + h * 0.32, l / 2 + 0.02);
    body.add(hl, box(w * 0.8, 0.12, 0.05, mat(0x550000, { emissive: 0xff0000, emissiveIntensity: 0.5 }), 0, clearance + h * 0.32, -l / 2 - 0.02));
    m.headlights = hl;
    if (variant === 'police' || variant === 'swat') {
      const red = box(w * 0.35, 0.12, 0.3, mat(0x550000, { emissive: 0xff0000, emissiveIntensity: 0 }).clone(), -w * 0.2, clearance + h * 0.95, 0);
      const blue = box(w * 0.35, 0.12, 0.3, mat(0x000055, { emissive: 0x0044ff, emissiveIntensity: 0 }).clone(), w * 0.2, clearance + h * 0.95, 0);
      body.add(red, blue);
      m.lightBar = [red, blue];
      if (variant === 'police') body.add(box(w + 0.02, h * 0.18, l * 0.5, mat(0xf2f2f2), 0, clearance + h * 0.25, 0));
    }
    if (variant === 'taxi') body.add(box(0.6, 0.18, 0.25, mat(0xffffff, { emissive: 0xffee88, emissiveIntensity: 0.6 }), 0, clearance + h * 0.95, -l * 0.04));
  } else if (kind === 'bike') {
    body.add(box(0.3, 0.45, l * 0.75, paint, 0, 0.75, 0), box(0.35, 0.18, 0.6, dark, 0, 0.98, -0.15));
    body.add(box(0.3, 0.3, 0.4, paint, 0, 1.0, l * 0.3));
    wheel(0, l * 0.38, 0.33, 0.14);
    wheel(0, -l * 0.38, 0.33, 0.18);
  } else if (kind === 'heli') {
    body.add(box(w, h * 0.55, l * 0.45, paint, 0, h * 0.5, l * 0.08));
    glass = box(w * 0.92, h * 0.4, l * 0.18, glassMat, 0, h * 0.55, l * 0.32);
    body.add(glass);
    body.add(box(0.4, 0.4, l * 0.55, paint, 0, h * 0.6, -l * 0.42));
    body.add(box(0.1, 1.0, 0.8, paint, 0, h * 0.9, -l * 0.68));
    body.add(box(0.1, 0.1, l * 0.5, dark, -w * 0.45, 0.1, 0.1), box(0.1, 0.1, l * 0.5, dark, w * 0.45, 0.1, 0.1));
    const rotor = new THREE.Group();
    rotor.add(box(l * 1.05, 0.05, 0.3, dark), box(0.3, 0.05, l * 1.05, dark));
    rotor.position.y = h * 0.95;
    body.add(rotor);
    const tail = new THREE.Group();
    tail.add(box(0.05, 1.4, 0.15, dark));
    tail.position.set(0.15, h * 0.85, -l * 0.68);
    body.add(tail);
    m.rotor = rotor;
    m.tailRotor = tail;
    if (variant === 'police') {
      const red = box(0.3, 0.1, 0.3, mat(0x550000, { emissive: 0xff0000, emissiveIntensity: 0 }).clone(), 0, h * 0.25, -0.4);
      body.add(red);
      m.lightBar = [red];
    }
  } else if (kind === 'plane' || kind === 'jet') {
    body.add(box(w * 0.14, h * 0.4, l, paint, 0, h * 0.45, 0));
    body.add(box(w, 0.12, l * (kind === 'jet' ? 0.35 : 0.16), paint, 0, kind === 'jet' ? h * 0.4 : h * 0.75, kind === 'jet' ? -l * 0.05 : l * 0.08));
    body.add(box(w * 0.35, 0.08, l * 0.1, paint, 0, h * 0.55, -l * 0.45), box(0.08, h * 0.45, l * 0.12, paint, 0, h * 0.8, -l * 0.45));
    glass = box(w * 0.12, h * 0.18, l * 0.15, glassMat, 0, h * 0.68, l * 0.18);
    body.add(glass);
    if (kind === 'plane') {
      const prop = new THREE.Group();
      prop.add(box(0.1, 1.8, 0.05, dark));
      prop.position.set(0, h * 0.45, l / 2 + 0.05);
      body.add(prop);
      m.rotor = prop;
      wheel(-0.9, l * 0.05, 0.25, 0.12);
      wheel(0.9, l * 0.05, 0.25, 0.12);
      wheel(0, l * 0.4, 0.2, 0.1);
    }
  } else if (kind === 'boat') {
    body.add(box(w, h * 0.5, l, paint, 0, h * 0.25, 0), box(w * 0.7, h * 0.3, l * 0.25, paint, 0, h * 0.25, l * 0.5));
    if (l > 8) {
      body.add(box(w * 0.75, h * 0.5, l * 0.5, mat(0xf4f4f4), 0, h * 0.75, -l * 0.05), box(w * 0.55, h * 0.35, l * 0.25, mat(0xf4f4f4), 0, h * 1.15, -l * 0.08));
      glass = box(w * 0.76, h * 0.2, l * 0.3, glassMat, 0, h * 0.85, l * 0.1);
      body.add(glass);
    } else body.add(box(0.4, 0.5, 0.3, dark, 0, h * 0.7, l * 0.1));
  }
  m.glass = glass;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return m;
}

/** Shared particle pool for smoke, sparks, debris, glass and rain splashes. */
export class Particles {
  mesh: THREE.InstancedMesh;
  private items: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; grav: number; color: THREE.Color }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  constructor(scene: THREE.Scene, private cap = 900) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grow = 0, grav = 0) {
    if (this.items.length >= this.cap) this.items.shift();
    this.items.push({ x, y, z, vx, vy, vz, life, max: life, size, grow, grav, color: new THREE.Color(color) });
  }
  burst(x: number, y: number, z: number, n: number, speed: number, life: number, size: number, color: number, grav = 9.8) {
    for (let i = 0; i < n; i++) this.spawn(x, y, z, (Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed, life * (0.5 + Math.random()), size, color, 0, grav);
  }
  update(dt: number) {
    let n = 0;
    this.items = this.items.filter((p) => (p.life -= dt) > 0);
    for (const p of this.items) {
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05 && p.grav > 0) {
        p.y = 0.05;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      const k = p.size + p.grow * (p.max - p.life);
      this.s.set(k, k, k);
      this.p.set(p.x, p.y, p.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

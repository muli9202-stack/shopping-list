import * as THREE from 'three';
import type { Game } from './game';
import type { Ped } from './actors';
import { vehicleModel, type VehicleModel } from './models';
import { angleDiff, clamp, damp, rand } from './util';
import { CELL, GRID, HALF, SEA_X, roadLine, waveHeight, type Surface } from './world';

// ---------------------------------------------------------------------------
// Vehicle fleet and physics. Cars use a planar model with separate longitudinal
// and lateral tyre forces: grip comes from the surface, the weather, the tyre
// type and the drive layout (RWD loses rear grip under power and drifts).
// Bikes add wheelies and rider ejection, aircraft and boats have their own
// models. Damage is progressive: radiator, doors, glass, wheels, engine.
// ---------------------------------------------------------------------------

export type VKind = 'car' | 'bike' | 'heli' | 'plane' | 'boat' | 'truck' | 'tank' | 'apc' | 'jet';
export type Drive = 'FWD' | 'RWD' | 'AWD' | '4WD';
export type Tyres = 'road' | 'offroad' | 'race';

export interface VehicleSpec {
  id: string;
  name: string;
  cls: string;
  kind: VKind;
  w: number;
  h: number;
  l: number;
  mass: number;
  accel: number;
  top: number;
  brake: number;
  grip: number;
  drive: Drive;
  /** Centre-of-mass height: high values roll over in hard, fast turns. */
  com: number;
  steer: number;
  health: number;
  color: number;
  price: number;
  tyres: Tyres;
  engine: 'v8' | 'v12' | 'i4' | 'twin' | 'diesel' | 'rotor' | 'prop' | 'jet' | 'outboard';
  armor?: number;
  seats?: number;
  desc?: string;
}

export const FLEET: VehicleSpec[] = [
  { id: 'muscle', name: 'Vortex Stallion V8', cls: 'מכונית שריר', kind: 'car', w: 2.0, h: 1.35, l: 4.9, mass: 1700, accel: 11, top: 62, brake: 11, grip: 0.95, drive: 'RWD', com: 0.52, steer: 0.6, health: 1000, color: 0xb31b1b, price: 42000, tyres: 'road', engine: 'v8', desc: 'מנוע V8 קדמי, הנעה אחורית. מחליקה בפניות.' },
  { id: 'super', name: 'Furia Aventa', cls: 'מכונית על', kind: 'car', w: 2.05, h: 1.15, l: 4.8, mass: 1550, accel: 15, top: 88, brake: 14, grip: 1.35, drive: 'AWD', com: 0.38, steer: 0.62, health: 800, color: 0xe7b416, price: 380000, tyres: 'race', engine: 'v12', desc: 'הנעה כפולה, אחיזה אבסולוטית. תיקון יקר.' },
  { id: 'jeep', name: 'Ranger 4x4', cls: 'רכב שטח', kind: 'car', w: 2.0, h: 1.9, l: 4.3, mass: 1900, accel: 8, top: 46, brake: 9, grip: 0.9, drive: '4WD', com: 1.05, steer: 0.62, health: 1300, color: 0x3d5a3a, price: 36000, tyres: 'offroad', engine: 'i4', desc: 'מתלים ארוכים, נוטה להתהפך במהירות.' },
  { id: 'sedan', name: 'Civica', cls: 'סדאן', kind: 'car', w: 1.85, h: 1.45, l: 4.5, mass: 1300, accel: 7, top: 46, brake: 10, grip: 1.0, drive: 'FWD', com: 0.55, steer: 0.62, health: 900, color: 0x6d7f91, price: 18000, tyres: 'road', engine: 'i4' },
  { id: 'taxi', name: 'מונית', cls: 'סדאן', kind: 'car', w: 1.85, h: 1.45, l: 4.6, mass: 1350, accel: 7, top: 46, brake: 10, grip: 1.0, drive: 'FWD', com: 0.55, steer: 0.62, health: 900, color: 0xf2c200, price: 18000, tyres: 'road', engine: 'i4' },
  { id: 'police', name: 'ניידת סיור', cls: 'משטרה', kind: 'car', w: 1.95, h: 1.45, l: 4.9, mass: 1700, accel: 11, top: 64, brake: 12, grip: 1.1, drive: 'RWD', com: 0.5, steer: 0.62, health: 1200, color: 0x15192b, price: 0, tyres: 'road', engine: 'v8' },
  { id: 'swatvan', name: 'ואן מיוחד', cls: 'משטרה', kind: 'truck', w: 2.4, h: 2.6, l: 6, mass: 4200, accel: 7, top: 48, brake: 9, grip: 1.0, drive: 'AWD', com: 1.0, steer: 0.5, health: 2600, color: 0x1a1a1a, price: 0, tyres: 'road', engine: 'diesel', armor: 0.5 },
  { id: 'mtruck', name: 'משאית צבאית', cls: 'צבא', kind: 'truck', w: 2.6, h: 3, l: 7.5, mass: 9000, accel: 5, top: 40, brake: 7, grip: 0.95, drive: '4WD', com: 1.2, steer: 0.45, health: 3500, color: 0x4b5a35, price: 0, tyres: 'offroad', engine: 'diesel', armor: 0.4 },
  { id: 'apc', name: 'נגמ"ש', cls: 'צבא', kind: 'apc', w: 2.8, h: 2.4, l: 7, mass: 14000, accel: 4.5, top: 34, brake: 7, grip: 1.0, drive: '4WD', com: 0.9, steer: 0.4, health: 6000, color: 0x55613d, price: 0, tyres: 'offroad', engine: 'diesel', armor: 0.75 },
  { id: 'tank', name: 'טנק', cls: 'צבא', kind: 'tank', w: 3.6, h: 2.4, l: 7.5, mass: 60000, accel: 3.5, top: 22, brake: 8, grip: 1.6, drive: '4WD', com: 0.8, steer: 0.5, health: 14000, color: 0x5a6340, price: 0, tyres: 'offroad', engine: 'diesel', armor: 0.92 },
  { id: 'bike', name: 'Ducato Panigo', cls: 'אופנוע', kind: 'bike', w: 0.8, h: 1.2, l: 2.1, mass: 200, accel: 17, top: 82, brake: 13, grip: 1.15, drive: 'RWD', com: 0.6, steer: 0.75, health: 400, color: 0xc0151b, price: 28000, tyres: 'race', engine: 'twin', desc: 'יחס משקל-הספק קיצוני, ווילי בהאצה.' },
  { id: 'cessna', name: 'Skylark 172', cls: 'מטוס קל', kind: 'plane', w: 11, h: 2.7, l: 8.3, mass: 1100, accel: 7, top: 62, brake: 6, grip: 1, drive: 'FWD', com: 0.5, steer: 0.5, health: 700, color: 0xf2f2f2, price: 160000, tyres: 'road', engine: 'prop', desc: 'נחיתה גם על כבישים מהירים.' },
  { id: 'heli', name: 'Huey UH-1', cls: 'מסוק', kind: 'heli', w: 2.6, h: 3, l: 12, mass: 2400, accel: 14, top: 58, brake: 8, grip: 1, drive: 'AWD', com: 0.8, steer: 1.4, health: 1200, color: 0x4c5a3a, price: 450000, tyres: 'road', engine: 'rotor', desc: 'המראה אנכית. ▲/▼ או רווח/Shift.' },
  { id: 'polheli', name: 'מסוק משטרה', cls: 'משטרה', kind: 'heli', w: 2.4, h: 2.8, l: 11, mass: 2200, accel: 14, top: 58, brake: 8, grip: 1, drive: 'AWD', com: 0.8, steer: 1.4, health: 1500, color: 0x1a2440, price: 0, tyres: 'road', engine: 'rotor' },
  { id: 'jet', name: 'מטוס קרב', cls: 'צבא', kind: 'jet', w: 10, h: 3, l: 15, mass: 9000, accel: 30, top: 140, brake: 6, grip: 1, drive: 'AWD', com: 0.5, steer: 0.5, health: 2500, color: 0x6c747c, price: 0, tyres: 'road', engine: 'jet' },
  { id: 'jetski', name: 'Wave-Runner', cls: 'אופנוע ים', kind: 'boat', w: 1.2, h: 1, l: 3.2, mass: 350, accel: 13, top: 34, brake: 4, grip: 0.7, drive: 'RWD', com: 0.4, steer: 0.9, health: 400, color: 0x14b0c8, price: 16000, tyres: 'road', engine: 'outboard', desc: 'זריז, קופץ על הגלים.' },
  { id: 'yacht', name: 'יאכטה "אומגה"', cls: 'יאכטה', kind: 'boat', w: 6, h: 3.4, l: 22, mass: 60000, accel: 1.6, top: 16, brake: 1.2, grip: 0.4, drive: 'RWD', com: 1, steer: 0.18, health: 6000, color: 0xffffff, price: 1500000, tyres: 'road', engine: 'diesel', desc: 'בסיס צף נייד. פיזיקת מים כבדה.' },
];

export const specById = (id: string) => FLEET.find((f) => f.id === id)!;

const SURFACE_MU: Record<Surface, number> = { asphalt: 1, dirt: 0.68, sand: 0.5, grass: 0.62, water: 0 };
const TYRE_MU: Record<Tyres, Partial<Record<Surface, number>>> = {
  road: { asphalt: 1, dirt: 0.85, sand: 0.75, grass: 0.85 },
  offroad: { asphalt: 0.9, dirt: 1.25, sand: 1.45, grass: 1.25 },
  race: { asphalt: 1.18, dirt: 0.7, sand: 0.55, grass: 0.7 },
};

export interface Mods {
  engine: number;
  suspension: number;
  armor: number;
  paint: 'gloss' | 'matte' | 'chrome' | 'pearl';
  color: number;
  tyres: Tyres;
  ram: boolean;
  spoiler: boolean;
  rims: number;
}

export type VRole = 'parked' | 'traffic' | 'police' | 'player' | 'abandoned' | 'military' | 'air-support' | 'roadblock';

export class Vehicle {
  model: VehicleModel;
  x: number;
  z: number;
  y = 0;
  heading: number;
  vx = 0;
  vz = 0;
  vy = 0;
  yawRate = 0;
  pitch = 0;
  roll = 0;
  health: number;
  engine = 100;
  radiator = 100;
  glassBroken = false;
  doorsDent = 0;
  wheelsLost = 0;
  flipped = false;
  destroyed = false;
  sunk = false;
  onFire = 0;
  driver: Ped | null = null;
  passengers: Ped[] = [];
  role: VRole;
  mods: Mods;
  /** Traffic AI state */
  ai = { node: [0, 0] as [number, number], target: [0, 0] as [number, number], speed: 14, honk: 0, stuck: 0, mode: 'cruise' as 'cruise' | 'chase' | 'park' | 'flee', reverseUntil: 0, wait: 0 };
  throttle = 0;
  steerIn = 0;
  handbrake = false;
  sirenOn = false;
  rpm = 0;
  wheelSpin = 0;
  airborne = false;
  altitude = 0;
  lastHitBy: Ped | null = null;
  owner: string | null = null;
  company: string | null = null;
  smokeT = 0;
  lastSeen = 0;
  turretYaw = 0;
  stability = 1;
  nextGun = 0;

  constructor(private g: Game, public spec: VehicleSpec, x: number, z: number, heading: number, role: VRole, variant = '') {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.role = role;
    this.health = spec.health;
    this.mods = { engine: 0, suspension: 0, armor: 0, paint: 'gloss', color: spec.color, tyres: spec.tyres, ram: false, spoiler: false, rims: 0 };
    this.model = vehicleModel(spec.kind, spec.w, spec.h, spec.l, spec.color, variant);
    g.scene.add(this.model.root);
    if (spec.kind === 'boat') this.y = 0;
    this.sync();
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }
  get forwardSpeed() {
    return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
  }
  get isAir() {
    return this.spec.kind === 'heli' || this.spec.kind === 'plane' || this.spec.kind === 'jet';
  }
  get isBoat() {
    return this.spec.kind === 'boat';
  }
  get radius() {
    return Math.max(this.spec.w, this.spec.l) * 0.45;
  }

  remove() {
    this.g.scene.remove(this.model.root);
  }

  // ---- damage -------------------------------------------------------------

  private armorMul() {
    return 1 - Math.min(0.95, (this.spec.armor ?? 0) + this.mods.armor * 0.15);
  }

  bulletHit(dmg: number, zone: 'front' | 'rear' | 'side' | 'wheel' | 'glass', engineDmg: number, by: Ped | null, at: THREE.Vector3) {
    if (this.destroyed) return;
    const a = this.armorMul();
    this.health -= dmg * a;
    this.lastHitBy = by ?? this.lastHitBy;
    if (zone === 'front') {
      this.engine -= engineDmg * a;
      this.radiator -= engineDmg * 0.5 * a;
    }
    if (zone === 'glass') this.shatterGlass();
    if (zone === 'wheel' && this.spec.kind === 'car' && Math.random() < 0.35 && this.wheelsLost < 2) this.loseWheel();
    if (this.engine <= 0 && engineDmg >= 150) this.explode(by);
    // Bullets that pass the glass hit whoever is inside.
    if ((zone === 'glass' || zone === 'side') && this.driver && Math.random() < (this.glassBroken ? 0.5 : 0.25) * (1 - (this.spec.armor ?? 0))) {
      this.driver.damage(dmg * 0.6, by, { dir: new THREE.Vector3(), knockback: 0, zone: 'body' });
    }
    void at;
    if (this.health <= 0) this.explode(by);
  }

  shatterGlass() {
    if (this.glassBroken || !this.model.glass) return;
    this.glassBroken = true;
    this.model.glass.visible = false;
    this.g.particles.burst(this.x, this.y + this.spec.h * 0.8, this.z, 22, 4, 1.2, 0.06, 0xbfe6ff);
    this.g.audio.glass(this.x, this.y + 1, this.z);
  }

  loseWheel() {
    const w = this.model.wheels[this.wheelsLost];
    if (!w) return;
    this.wheelsLost++;
    w.visible = false;
    this.g.particles.burst(w.position.x + this.x, 0.4, w.position.z + this.z, 6, 4, 1, 0.3, 0x111111);
  }

  impact(speed: number, nx: number, nz: number, by: Ped | null) {
    if (speed < 3 || this.destroyed) return;
    // Which side took the hit (vehicle frame)?
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const along = -(nx * fx + nz * fz); // >0: hit on the front
    const dmg = (speed * speed * 0.9 * (this.spec.kind === 'bike' ? 0.6 : 1)) * this.armorMul() * (this.mods.ram && along > 0.5 ? 0.35 : 1);
    this.health -= dmg;
    this.lastHitBy = by ?? this.lastHitBy;
    if (along > 0.5) {
      this.radiator -= dmg * 0.25;
      this.engine -= dmg * 0.08;
    } else if (Math.abs(along) < 0.5) {
      this.doorsDent = Math.min(1, this.doorsDent + dmg / 700);
    }
    if (speed > 14 && Math.random() < 0.5) this.shatterGlass();
    if (speed > 22 && this.spec.kind === 'car' && Math.random() < 0.25) this.loseWheel();
    this.g.audio.crash(this.x, this.y + 0.5, this.z, Math.min(1, speed / 25));
    this.g.particles.burst(this.x - nx * this.spec.l * 0.4, 0.6, this.z - nz * this.spec.l * 0.4, Math.min(20, speed), 4, 0.6, 0.12, 0xffc040);
    if (this.health <= 0) this.explode(by);
  }

  explode(by: Ped | null) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.health = 0;
    this.engine = 0;
    this.g.explode(this.x, this.y + 1, this.z, 7, 260, by ?? this.lastHitBy, this);
    this.model.paintMats.forEach((m) => m.color.setHex(0x1d1b1a));
    this.shatterGlass();
    this.onFire = 10;
    this.g.bus.emit('vehicleDestroyed', { v: this, by: by ?? this.lastHitBy });
    if (this.driver) this.driver.damage(999, by, { dir: new THREE.Vector3(0, 1, 0), knockback: 0, zone: 'body' });
    for (const p of this.passengers) p.damage(999, by, { dir: new THREE.Vector3(0, 1, 0), knockback: 0, zone: 'body' });
    if (this.isAir && this.y > 2) this.vy = -2;
  }

  repairCost() {
    const lost = 1 - this.health / this.spec.health;
    return Math.round(lost * Math.max(400, this.spec.price * 0.05) + this.wheelsLost * 300 + (this.glassBroken ? 250 : 0));
  }

  repair() {
    this.health = this.spec.health;
    this.engine = this.radiator = 100;
    this.wheelsLost = 0;
    this.glassBroken = false;
    this.doorsDent = 0;
    this.flipped = false;
    this.onFire = 0;
    this.model.wheels.forEach((w) => (w.visible = true));
    if (this.model.glass) this.model.glass.visible = true;
  }

  applyPaint() {
    const m = this.model.paintMats[0];
    m.color.setHex(this.mods.color);
    const p = this.mods.paint;
    m.metalness = p === 'chrome' ? 1 : p === 'pearl' ? 0.6 : p === 'matte' ? 0 : 0.4;
    m.roughness = p === 'chrome' ? 0.05 : p === 'pearl' ? 0.2 : p === 'matte' ? 0.9 : 0.35;
    if (p === 'pearl') m.emissive.setHex(0x111122);
    else m.emissive.setHex(0);
  }

  /** Ray (unit dir) vs this vehicle's oriented box; returns distance and hit zone. */
  rayHit(o: THREE.Vector3, d: THREE.Vector3, maxT: number): { t: number; zone: 'front' | 'rear' | 'side' | 'wheel' | 'glass' } | null {
    const s = this.spec, c = Math.cos(this.heading), sn = Math.sin(this.heading);
    // world -> local (local +z = forward)
    const ox = o.x - this.x, oz = o.z - this.z, oy = o.y - this.y;
    const lx = ox * c - oz * sn, lz = ox * sn + oz * c;
    const dx = d.x * c - d.z * sn, dz = d.x * sn + d.z * c;
    const isFlat = this.spec.kind === 'plane' || this.spec.kind === 'jet';
    const hw = isFlat ? s.w * 0.25 : s.w / 2, hl = s.l / 2, hh = s.h;
    let t0 = 0, t1 = maxT;
    const slab = (oo: number, dd: number, lo: number, hi: number) => {
      if (Math.abs(dd) < 1e-9) return oo >= lo && oo <= hi;
      let a = (lo - oo) / dd, b = (hi - oo) / dd;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      return t0 <= t1;
    };
    if (!slab(lx, dx, -hw, hw) || !slab(oy, d.y, 0, hh) || !slab(lz, dz, -hl, hl)) return null;
    const hy = oy + d.y * t0, hz = lz + dz * t0;
    let zone: 'front' | 'rear' | 'side' | 'wheel' | 'glass' = 'side';
    if (hy > s.h * 0.6 && s.kind === 'car') zone = 'glass';
    else if (hz > hl * 0.6) zone = 'front';
    else if (hz < -hl * 0.6) zone = 'rear';
    if (hy < 0.6 && Math.abs(Math.abs(hz) - hl * 0.68) < 0.5) zone = 'wheel';
    return { t: t0, zone };
  }

  // ---- physics ------------------------------------------------------------

  /** Combined grip coefficient at the current position. */
  mu() {
    const surf = this.g.world.surfaceAt(this.x, this.z);
    const tyre = TYRE_MU[this.mods.tyres][surf] ?? 1;
    const wet = this.g.env.wetness;
    const weather = surf === 'asphalt' ? 1 - 0.48 * wet : 1 - 0.25 * wet;
    return SURFACE_MU[surf] * tyre * weather;
  }

  update(dt: number) {
    if (this.sunk) return;
    if (this.onFire > 0) {
      this.onFire -= dt;
      this.g.particles.spawn(this.x + rand(-1, 1), this.y + 1.2, this.z + rand(-1, 1), 0, rand(2, 4), 0, 1, 0.5, Math.random() < 0.5 ? 0xff6a00 : 0x222222, 1.2);
    }
    // Radiator / engine smoke
    this.smokeT -= dt;
    if (!this.destroyed && (this.radiator < 50 || this.health < this.spec.health * 0.35) && this.smokeT <= 0) {
      this.smokeT = 0.08;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const dark = this.health < this.spec.health * 0.2;
      this.g.particles.spawn(this.x + fx * this.spec.l * 0.4, this.y + this.spec.h * 0.7, this.z + fz * this.spec.l * 0.4, rand(-0.3, 0.3), rand(1.5, 2.5), rand(-0.3, 0.3), 1.6, 0.35, dark ? 0x2a2a2a : 0xd8d8d8, 0.9);
      if (this.health < this.spec.health * 0.12 && Math.random() < dt * 0.4) this.explode(this.lastHitBy);
    }

    switch (this.spec.kind) {
      case 'heli':
        this.updateHeli(dt);
        break;
      case 'plane':
      case 'jet':
        this.updatePlane(dt);
        break;
      case 'boat':
        this.updateBoat(dt);
        break;
      default:
        this.updateGround(dt);
    }
    this.sync(dt);
  }

  private updateGround(dt: number) {
    const s = this.spec;
    if (this.flipped || this.destroyed) {
      this.vx = damp(this.vx, 0, 2, dt);
      this.vz = damp(this.vz, 0, 2, dt);
      this.integrateGround(dt);
      return;
    }
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    let vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;
    const mu = this.mu();
    const surface = this.g.world.surfaceAt(this.x, this.z);
    if (surface === 'water' && !this.isBoat) {
      // Cars sink in the sea.
      this.vx *= 0.9;
      this.vz *= 0.9;
      this.y -= dt * 0.8;
      if (this.y < -2.5) {
        this.sunk = true;
        this.model.root.visible = false;
        this.g.bus.emit('vehicleDestroyed', { v: this, by: this.lastHitBy });
      }
      if (this.driver?.isPlayer) this.g.hud.toast('הרכב שוקע! צא מהרכב (F)');
      this.integrateGround(dt);
      return;
    }
    const enginePower = this.engine <= 0 ? 0 : clamp(this.engine / 60, 0.3, 1);
    const tuned = 1 + this.mods.engine * 0.12;
    const top = s.top * tuned * (this.wheelsLost ? 0.55 : 1);
    const t = this.throttle;
    let longF = 0;
    if (t > 0) {
      if (vF < -0.5) longF = s.brake * mu * 1.2;
      else longF = s.accel * tuned * enginePower * t * clamp(1 - vF / top, 0, 1) * Math.min(1, mu + 0.25);
    } else if (t < 0) {
      if (vF > 0.5) longF = -s.brake * mu * 1.15 * -t;
      else longF = s.accel * 0.45 * t * clamp(1 + vF / (top * 0.3), 0, 1);
    }
    // Rolling resistance and drag
    longF -= vF * 0.04 + vF * Math.abs(vF) * 0.0009 * (this.isBoat ? 3 : 1);
    if (this.handbrake) longF -= Math.sign(vF) * Math.min(Math.abs(vF) / dt, 6 * mu);
    vF += longF * dt;

    // Lateral grip: the tyres try to cancel sideways velocity.
    let grip = s.grip * mu * (1 + this.mods.suspension * 0.05);
    const powerRatio = clamp(t, 0, 1) * clamp(1 - Math.abs(vF) / (top * 0.9), 0.15, 1);
    if (s.drive === 'RWD') grip *= 1 - 0.55 * powerRatio * (s.accel > 10 ? 1 : 0.4); // power oversteer
    if (s.drive === 'AWD' || s.drive === '4WD') grip *= 1.08;
    if (this.handbrake) grip *= 0.28;
    if (this.wheelsLost) grip *= 0.6;
    const maxLat = grip * 9.81 * 1.25 * dt;
    const latCorr = clamp(-vR, -maxLat, maxLat);
    vR += latCorr;
    const sliding = Math.abs(vR) > 2.2;

    // Steering: yaw rate follows speed; at high speed the steering angle shrinks.
    const steerAngle = this.steerIn * s.steer * clamp(1.15 - Math.abs(vF) / (top * 1.4), 0.35, 1);
    const wheelbase = s.l * 0.6;
    let targetYaw = (vF / wheelbase) * Math.tan(steerAngle);
    if (sliding && s.drive === 'RWD') targetYaw += this.steerIn * 0.3 * clamp(Math.abs(vF) / 20, 0, 1);
    if (this.wheelsLost) targetYaw += 0.15 * Math.sign(vF);
    this.yawRate = damp(this.yawRate, targetYaw, sliding ? 3 : 9 * Math.min(1, mu + 0.3), dt);
    this.heading += this.yawRate * dt;

    // Rollover: the lateral acceleration the tyres actually deliver (capped by
    // grip) times centre-of-mass height. Only tall vehicles exceed the limit.
    const latAcc = Math.abs(latCorr) / dt;
    const susp = 1 + this.mods.suspension * 0.12;
    if (s.kind === 'car' && latAcc * s.com > 8.5 * susp && Math.abs(vF) > 14 && Math.abs(this.steerIn) > 0.6) this.flip();

    this.vx = fx * vF + rx * vR;
    this.vz = fz * vF + rz * vR;
    // Tyre smoke and skid
    if ((sliding || (this.handbrake && Math.abs(vF) > 6)) && Math.random() < 0.6 && surface === 'asphalt') this.g.particles.spawn(this.x - fx * s.l * 0.35, 0.2, this.z - fz * s.l * 0.35, rand(-0.5, 0.5), 0.6, rand(-0.5, 0.5), 0.9, 0.4, 0xcfcfcf, 1.2);
    if (surface !== 'asphalt' && Math.abs(vF) > 6 && Math.random() < 0.5) this.g.particles.spawn(this.x - fx * s.l * 0.4, 0.3, this.z - fz * s.l * 0.4, rand(-1, 1), 1, rand(-1, 1), 0.8, 0.45, surface === 'sand' ? 0xd9c38f : 0x7b6347, 1);
    this.stability = sliding ? 0.5 : 1;

    // Motorbike wheelie: big throttle at low speed lifts the front wheel.
    if (s.kind === 'bike') {
      const wheelie = t > 0.8 && vF > 2 && vF < top * 0.45 ? 0.35 : 0;
      this.pitch = damp(this.pitch, -wheelie, 4, dt);
      this.roll = damp(this.roll, -this.steerIn * clamp(Math.abs(vF) / 25, 0, 0.6), 6, dt);
    } else {
      this.pitch = damp(this.pitch, -clamp(longF / 40, -0.06, 0.06), 6, dt);
      this.roll = damp(this.roll, clamp(vF * this.yawRate / 60, -0.08, 0.08) * (s.com * 1.5), 6, dt);
    }
    this.rpm = damp(this.rpm, clamp(Math.abs(vF) / top + Math.abs(t) * 0.25, 0, 1.2), 5, dt);
    this.integrateGround(dt);
  }

  private flip() {
    this.flipped = true;
    this.roll = Math.PI * 0.5 * Math.sign(this.yawRate || 1);
    this.g.audio.crash(this.x, 1, this.z, 1);
    this.health -= this.spec.health * 0.3;
    if (this.driver?.isPlayer) this.g.hud.toast('הרכב התהפך! (F ליציאה)');
  }

  private integrateGround(dt: number) {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    if (!this.isBoat && this.y > 0 && !this.sunk && this.g.world.surfaceAt(this.x, this.z) !== 'water') this.y = Math.max(0, this.y - 9 * dt);
    this.collideWorld();
  }

  private collideWorld() {
    const s = this.spec;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const r = s.w * 0.5;
    // Two circles along the length approximate the box.
    for (const off of [s.l * 0.3, -s.l * 0.3]) {
      const cx = this.x + fx * off, cz = this.z + fz * off;
      const res = this.g.world.collideCircle(cx, cz, r, this.y + 0.8);
      if (res.hit) {
        this.x += res.x - cx;
        this.z += res.z - cz;
        const vn = this.vx * res.nx + this.vz * res.nz;
        if (vn < 0) {
          this.impact(-vn, res.nx, res.nz, null);
          this.vx -= vn * res.nx * 1.35;
          this.vz -= vn * res.nz * 1.35;
          this.vx *= 0.85;
          this.vz *= 0.85;
          if (this.driver?.isPlayer) this.g.camShake(Math.min(1, -vn / 20));
          if (this.spec.kind === 'bike' && -vn > 7 && this.driver) this.g.ejectRider(this);
        }
      }
    }
    const b = this.g.bounds;
    this.x = clamp(this.x, b.minX, b.maxX);
    this.z = clamp(this.z, b.minZ, b.maxZ);
  }

  private updateHeli(dt: number) {
    const s = this.spec;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    const alive = !this.destroyed && this.engine > 0;
    const lift = alive ? this.altitude : -1;
    this.vy = damp(this.vy, lift * 10, 2, dt) - (alive ? 0 : 9.8 * dt);
    if (alive && this.y < 0.1 && this.altitude <= 0) this.vy = Math.max(0, this.vy);
    const flying = this.y > 0.5;
    const ctrl = flying ? 1 : 0;
    const vF = this.vx * fx + this.vz * fz;
    const vR = this.vx * rx + this.vz * rz;
    const nF = damp(vF, this.throttle * s.top * ctrl, 0.8, dt);
    const nR = damp(vR, 0, 1.2, dt);
    this.yawRate = damp(this.yawRate, this.steerIn * s.steer * (flying ? 1 : 0.3), 3, dt);
    this.heading += this.yawRate * dt;
    this.vx = fx * nF + rx * nR;
    this.vz = fz * nF + rz * nR;
    this.pitch = damp(this.pitch, this.throttle * 0.25 * ctrl, 3, dt);
    this.roll = damp(this.roll, this.yawRate * 0.15, 3, dt);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y <= 0 && !alive && !this.destroyed) this.explode(this.lastHitBy);
    if (this.y <= 0 && this.destroyed && Math.abs(this.vy) > 3) {
      this.vy = 0;
      this.vx *= 0.3;
      this.vz *= 0.3;
    }
    this.rpm = damp(this.rpm, alive ? 0.6 + Math.abs(this.altitude) * 0.3 + Math.abs(this.throttle) * 0.2 : 0, 2, dt);
    if (this.model.rotor) this.model.rotor.rotation.y += this.rpm * dt * 40;
    if (this.model.tailRotor) this.model.tailRotor.rotation.x += this.rpm * dt * 50;
    this.collideAir();
  }

  private updatePlane(dt: number) {
    const s = this.spec;
    const alive = !this.destroyed && this.engine > 0;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let v = this.speed;
    const target = alive ? clamp(this.throttle, -0.3, 1) * s.top : 0;
    v = damp(v, Math.max(0, target), this.throttle > 0 ? 0.25 : 0.4, dt);
    const takeoff = s.top * 0.45;
    const onGround = this.y < 0.3;
    if (onGround) {
      const surf = this.g.world.surfaceAt(this.x, this.z);
      if (surf === 'water' || surf === 'sand') v *= 0.98;
      this.yawRate = damp(this.yawRate, this.steerIn * 0.6 * clamp(v / 10, 0, 1), 4, dt);
      if (v > takeoff && this.altitude > 0) this.vy = 3;
      else this.vy = Math.min(this.vy, 0);
    } else {
      // Lift: below stall speed the plane sinks.
      const stall = v < takeoff * 0.75;
      this.yawRate = damp(this.yawRate, this.steerIn * 0.65, 2, dt);
      this.vy = damp(this.vy, stall ? -8 : this.altitude * 9, 1.4, dt);
      if (this.y < 1.5 && this.vy < -4.5) {
        this.explode(this.lastHitBy);
      }
    }
    this.heading += this.yawRate * dt;
    this.vx = fx * v;
    this.vz = fz * v;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    this.pitch = damp(this.pitch, -clamp(this.vy / 20, -0.4, 0.4), 3, dt);
    this.roll = damp(this.roll, onGround ? 0 : this.yawRate * 1.2, 3, dt);
    this.rpm = damp(this.rpm, alive ? 0.4 + Math.max(0, this.throttle) * 0.8 : 0, 2, dt);
    if (this.model.rotor) this.model.rotor.rotation.z += this.rpm * dt * 60;
    this.collideAir();
  }

  private collideAir() {
    // Aircraft hit buildings only when below the roof line.
    const res = this.g.world.collideCircle(this.x, this.z, this.spec.kind === 'heli' ? 4 : 3, this.y + 1);
    if (res.hit && this.speed + Math.abs(this.vy) > 6 && !this.destroyed) this.explode(this.lastHitBy);
    else if (res.hit) {
      this.x = res.x;
      this.z = res.z;
    }
    const b = this.g.bounds;
    this.x = clamp(this.x, b.minX - 200, b.maxX + 200);
    this.z = clamp(this.z, b.minZ - 200, b.maxZ + 200);
    this.y = Math.min(this.y, 400);
  }

  private updateBoat(dt: number) {
    const s = this.spec;
    const inWater = this.x > SEA_X - 2;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    let vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;
    if (inWater && !this.destroyed) {
      const t = this.throttle;
      vF += (t > 0 ? s.accel * t * clamp(1 - vF / s.top, 0, 1) : s.accel * 0.4 * t) * dt;
      vF -= vF * 0.18 * dt;
      vR = damp(vR, 0, s.grip * 1.2, dt);
      this.yawRate = damp(this.yawRate, this.steerIn * s.steer * clamp(Math.abs(vF) / 6, 0.15, 1.6) * Math.sign(vF || 1), 2.5, dt);
      this.heading += this.yawRate * dt;
    } else {
      vF *= 0.8;
      vR *= 0.8;
    }
    this.vx = fx * vF + rx * vR;
    this.vz = fz * vF + rz * vR;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    if (this.x < SEA_X - 3) {
      this.x = SEA_X - 3;
      this.vx = Math.max(0, this.vx);
    }
    const wave = waveHeight(this.x, this.z, this.g.time) - 0.3;
    const front = waveHeight(this.x + fx * 2, this.z + fz * 2, this.g.time);
    // Light boats jump off wave crests; heavy ones follow the swell.
    const light = s.mass < 1000;
    if (light) {
      this.vy -= 9.8 * dt;
      this.y += this.vy * dt;
      if (this.y < wave) {
        this.vy = Math.max(0, (front - wave) * Math.abs(vF) * 0.8);
        this.y = wave;
      }
    } else this.y = damp(this.y, wave * 0.5, 2, dt);
    this.pitch = damp(this.pitch, -(front - wave) * (light ? 0.25 : 0.05) - (light && this.y > wave + 0.2 ? 0.15 : 0), 4, dt);
    this.roll = damp(this.roll, -this.steerIn * clamp(vF / 25, 0, 0.35), 3, dt);
    this.rpm = damp(this.rpm, Math.abs(this.throttle) * 0.8 + 0.1, 3, dt);
    if (Math.abs(vF) > 4 && Math.random() < 0.6) this.g.particles.spawn(this.x - fx * s.l * 0.5, 0.2, this.z - fz * s.l * 0.5, rand(-1, 1), rand(1, 2), rand(-1, 1), 0.7, 0.3, 0xe8f6ff, 0.5, 6);
  }

  private sync(dt = 0) {
    const r = this.model.root;
    r.position.set(this.x, this.y, this.z);
    r.rotation.set(0, this.heading, 0);
    this.model.body.rotation.set(this.pitch, 0, this.roll);
    if (this.flipped) this.model.body.position.y = this.spec.w * 0.35;
    this.model.body.scale.x = 1 - this.doorsDent * 0.12;
    const spin = this.forwardSpeed * dt * 2.5;
    this.model.wheels.forEach((w, i) => {
      w.children[0].rotation.x += spin;
      if (i < 2 && this.spec.kind === 'car') w.rotation.y = this.steerIn * 0.45;
    });
    if (this.model.lightBar && this.sirenOn) {
      const on = Math.floor(this.g.time * 6) % 2 === 0;
      (this.model.lightBar[0].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 3 : 0;
      if (this.model.lightBar[1]) (this.model.lightBar[1].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0 : 3;
    } else if (this.model.lightBar) this.model.lightBar.forEach((l) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = 0));
    if (this.model.headlights) (this.model.headlights.material as THREE.MeshStandardMaterial).emissiveIntensity = this.g.env.night > 0.4 && !this.destroyed ? 2.5 : 0.3;
    if (this.model.turret) this.model.turret.rotation.y = this.turretYaw;
  }

  // ---- AI driving -----------------------------------------------------------

  /** Steer towards a point; returns distance to it. */
  driveTo(tx: number, tz: number, speed: number, dt: number) {
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const diff = angleDiff(this.heading, want);
    const vF = this.forwardSpeed;
    if (this.g.time < this.ai.reverseUntil) {
      this.throttle = -0.7;
      this.steerIn = -Math.sign(diff);
      return d;
    }
    this.steerIn = clamp(diff * 2.2, -1, 1);
    const turnSlow = 1 - Math.min(0.7, Math.abs(diff) * 0.9);
    const target = speed * turnSlow;
    this.throttle = vF < target ? clamp((target - vF) / 4, 0.25, 1) : vF > target + 2 ? -0.6 : 0;
    // Unstick: if pressing on but not moving, reverse for a moment.
    if (Math.abs(vF) < 0.8 && Math.abs(this.throttle) > 0.2) this.ai.stuck += dt;
    else this.ai.stuck = Math.max(0, this.ai.stuck - dt);
    if (this.ai.stuck > 1.6) {
      this.ai.stuck = 0;
      this.ai.reverseUntil = this.g.time + 1.3;
    }
    return d;
  }

  /** Cruise along the road grid, keeping to the right-hand lane. */
  cruise(dt: number) {
    const ai = this.ai;
    const [tx, tz] = ai.target;
    const nx = roadLine(tx), nz = roadLine(tz);
    // Lane offset: 4 m to the right of the travel direction.
    const [fx0, fz0] = ai.node;
    const dirX = Math.sign(tx - fx0), dirZ = Math.sign(tz - fz0);
    // Keep right: the right of a +Z heading is -X.
    const px = nx - dirZ * 4, pz = nz + dirX * 4;
    const wet = this.g.env.wetness;
    let speed = ai.speed * (1 - 0.35 * wet) * (this.g.env.night > 0.6 ? 0.9 : 1);
    // Brake for anything ahead in the lane.
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let block = 99;
    const check = (ox: number, oz: number, r: number) => {
      const dx = ox - this.x, dz = oz - this.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > 22) return;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < r + 1.4) block = Math.min(block, along);
    };
    for (const v of this.g.vehicles) if (v !== this && !v.isAir && Math.abs(v.x - this.x) < 25 && Math.abs(v.z - this.z) < 25) check(v.x, v.z, v.spec.w / 2);
    for (const p of this.g.peds) if (p.alive && !p.vehicle && Math.abs(p.x - this.x) < 22 && Math.abs(p.z - this.z) < 22) check(p.x, p.z, 0.4);
    if (block < 22) {
      speed = Math.min(speed, Math.max(0, (block - 6) * 0.8));
      if (block < 9 && this.g.time > ai.honk) {
        ai.honk = this.g.time + rand(2, 5);
        this.g.audio.horn(this.x, this.z);
      }
    }
    const d = this.driveTo(px, pz, speed, dt);
    if (d < 6) this.pickNext();
    else if (block < 7) {
      this.throttle = this.forwardSpeed > 0.5 ? -1 : 0;
    }
  }

  pickNext() {
    const ai = this.ai;
    const [cx, cz] = ai.target;
    const [px, pz] = ai.node;
    const opts: [number, number][] = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx > GRID || nz > GRID) continue;
      if (nx === px && nz === pz) continue;
      opts.push([nx, nz]);
    }
    if (!opts.length) opts.push([px, pz]);
    ai.node = [cx, cz];
    ai.target = opts[Math.floor(Math.random() * opts.length)];
  }

  /** Place on the nearest road node pair heading in a valid direction. */
  snapToGrid() {
    const kx = clamp(Math.round((this.x + HALF) / CELL), 0, GRID);
    const kz = clamp(Math.round((this.z + HALF) / CELL), 0, GRID);
    this.ai.node = [kx, kz];
    this.ai.target = [kx, kz];
    this.pickNext();
  }
}

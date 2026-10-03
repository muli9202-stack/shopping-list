import * as THREE from 'three';
import type { Game } from './game';
import type { Ped } from './actors';
import type { Vehicle } from './vehicles';
import { clamp, rand } from './util';

// ---------------------------------------------------------------------------
// Arsenal. Every weapon is data: damage, fire rate, magazine, recoil curve,
// weight (slows the carrier) and special behaviour flags.
// ---------------------------------------------------------------------------

export type WeaponCat = 'melee' | 'pistol' | 'smg' | 'rifle' | 'sniper' | 'shotgun' | 'heavy';
export type Attachment = 'suppressor' | 'flashlight' | 'holo' | 'scope' | 'grip' | 'laser';

export interface WeaponSpec {
  id: string;
  name: string;
  cat: WeaponCat;
  model: string;
  dmg: number;
  rpm: number;
  mag: number;
  reload: number;
  spread: number;
  pellets: number;
  range: number;
  /** Camera kick per shot: vertical, horizontal (radians). */
  recoil: [number, number];
  /** How fast the aim settles after a shot (per second). */
  recovery: number;
  auto: boolean;
  weight: number;
  price: number;
  /** Seconds to spin up before the first round (minigun). */
  spinUp?: number;
  rocket?: boolean;
  blast?: number;
  /** Buildings a round passes through. */
  pierce?: number;
  knockback?: number;
  engineDmg?: number;
  /** Accuracy falls off sharply beyond this many metres. */
  falloff?: number;
  scope?: number;
  bipod?: boolean;
  burst?: number;
  stealthKill?: boolean;
  smashGlass?: boolean;
  attachments?: Attachment[];
  desc: string;
}

export const WEAPONS: WeaponSpec[] = [
  { id: 'fists', name: 'אגרופים', cat: 'melee', model: '', dmg: 10, rpm: 150, mag: 0, reload: 0, spread: 0, pellets: 1, range: 1.6, recoil: [0, 0], recovery: 10, auto: false, weight: 0, price: 0, desc: 'משולבים עם התחמקות (Q).' },
  { id: 'knuckles', name: 'אגרופן ברזל', cat: 'melee', model: '', dmg: 20, rpm: 150, mag: 0, reload: 0, spread: 0, pellets: 1, range: 1.6, recoil: [0, 0], recovery: 10, auto: false, weight: 0.2, price: 150, desc: 'מכפיל את נזק האגרוף.' },
  { id: 'knife', name: 'סכין קומבט', cat: 'melee', model: 'knife', dmg: 45, rpm: 120, mag: 0, reload: 0, spread: 0, pellets: 1, range: 1.7, recoil: [0, 0], recovery: 10, auto: false, weight: 0.3, price: 300, stealthKill: true, desc: 'התנקשות שקטה מאחור.' },
  { id: 'bat', name: 'מחבט בייסבול', cat: 'melee', model: 'bat', dmg: 30, rpm: 80, mag: 0, reload: 0, spread: 0, pellets: 1, range: 2.1, recoil: [0, 0], recovery: 10, auto: false, weight: 0.8, price: 200, smashGlass: true, desc: 'מנפץ שמשות רכבים.' },
  { id: 'glock', name: 'Glock 19', cat: 'pistol', model: 'pistol', dmg: 24, rpm: 420, mag: 15, reload: 1.3, spread: 0.012, pellets: 1, range: 120, recoil: [0.025, 0.008], recovery: 9, auto: false, weight: 0.6, price: 500, attachments: ['suppressor', 'flashlight'], desc: '9mm. אמין, 15 כדורים.' },
  { id: 'deagle', name: 'Desert Eagle', cat: 'pistol', model: 'pistol', dmg: 75, rpm: 110, mag: 7, reload: 1.8, spread: 0.01, pellets: 1, range: 150, recoil: [0.14, 0.03], recovery: 2.5, auto: false, weight: 1.4, price: 2400, engineDmg: 34, desc: '.50 AE. רתע אדיר, משבית מנוע ב-3 פגיעות.' },
  { id: 'm1911', name: 'M1911', cat: 'pistol', model: 'pistol', dmg: 36, rpm: 260, mag: 7, reload: 1.5, spread: 0.011, pellets: 1, range: 120, recoil: [0.05, 0.012], recovery: 6, auto: false, weight: 1.1, price: 900, desc: '.45 ACP קלאסי.' },
  { id: 'mp5', name: 'MP5', cat: 'smg', model: 'smg', dmg: 20, rpm: 800, mag: 30, reload: 2, spread: 0.028, pellets: 1, range: 90, recoil: [0.012, 0.006], recovery: 10, auto: true, weight: 2.5, price: 3200, desc: 'יציב גם בירי מתוך רכב.' },
  { id: 'uzi', name: 'Uzi', cat: 'smg', model: 'smg', dmg: 17, rpm: 1000, mag: 32, reload: 1.8, spread: 0.05, pellets: 1, range: 60, recoil: [0.016, 0.014], recovery: 8, auto: true, weight: 1.8, price: 2200, falloff: 15, desc: 'קצב אש מסחרר, לא מדויק מעבר ל-15 מ\'.' },
  { id: 'm4', name: 'M4A1', cat: 'rifle', model: 'rifle', dmg: 30, rpm: 750, mag: 30, reload: 2.2, spread: 0.012, pellets: 1, range: 220, recoil: [0.018, 0.008], recovery: 8, auto: true, weight: 3.4, price: 6500, attachments: ['holo', 'scope', 'grip', 'laser'], desc: 'מאוזן ומודולרי.' },
  { id: 'ak', name: 'AK-47', cat: 'rifle', model: 'rifle', dmg: 38, rpm: 600, mag: 30, reload: 2.4, spread: 0.018, pellets: 1, range: 200, recoil: [0.03, 0.02], recovery: 6, auto: true, weight: 4.3, price: 5200, desc: 'נזק גבוה, רתע חזק.' },
  { id: 'barrett', name: 'Barrett M82A1', cat: 'sniper', model: 'sniper', dmg: 260, rpm: 45, mag: 10, reload: 3.4, spread: 0.002, pellets: 1, range: 600, recoil: [0.2, 0.04], recovery: 2, auto: false, weight: 14, price: 18000, pierce: 1, scope: 6, bipod: true, engineDmg: 200, desc: 'חודר בטון. ירייה למנוע = פיצוץ. דורש רגליות (C).' },
  { id: 'svd', name: 'SVD Dragunov', cat: 'sniper', model: 'sniper', dmg: 95, rpm: 220, mag: 10, reload: 2.6, spread: 0.003, pellets: 1, range: 450, recoil: [0.07, 0.015], recovery: 4, auto: false, weight: 4.3, price: 9000, scope: 4, desc: 'חצי-אוטומטי, ירי עוקב מהיר.' },
  { id: 'pump', name: 'רובה ציד Pump', cat: 'shotgun', model: 'shotgun', dmg: 14, rpm: 70, mag: 8, reload: 3, spread: 0.07, pellets: 9, range: 40, recoil: [0.09, 0.02], recovery: 4, auto: false, weight: 3.6, price: 2800, knockback: 9, desc: '9 כדורי עופרת, הדף אדיר.' },
  { id: 'sawed', name: 'דו-קני נסור', cat: 'shotgun', model: 'shotgun', dmg: 15, rpm: 90, mag: 2, reload: 2.2, spread: 0.14, pellets: 18, range: 25, recoil: [0.16, 0.04], recovery: 3, auto: false, weight: 2.6, price: 1800, knockback: 13, burst: 2, desc: 'שני הקנים יורים יחד.' },
  { id: 'rpg', name: 'RPG-7', cat: 'heavy', model: 'heavy', dmg: 320, rpm: 30, mag: 1, reload: 2.8, spread: 0.004, pellets: 1, range: 400, recoil: [0.08, 0.01], recovery: 3, auto: false, weight: 7, price: 25000, rocket: true, blast: 10, desc: 'רקטה במסלול ישר, הדף אזורי.' },
  { id: 'minigun', name: 'Minigun M134', cat: 'heavy', model: 'minigun', dmg: 22, rpm: 4000, mag: 600, reload: 5, spread: 0.035, pellets: 1, range: 160, recoil: [0.004, 0.006], recovery: 12, auto: true, weight: 18, price: 50000, spinUp: 0.6, desc: '4000 כד\'/דקה, דורש האצת קנים.' },
];

export const weaponById = (id: string) => WEAPONS.find((w) => w.id === id)!;

export class WeaponState {
  ammo: number;
  reserve: number;
  attachments = new Set<Attachment>();
  nextShot = 0;
  reloadUntil = 0;
  spin = 0;
  constructor(public spec: WeaponSpec, reserve = spec.mag * 4) {
    this.ammo = spec.mag;
    this.reserve = reserve;
  }
}

interface Rocket {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  owner: Ped | Vehicle | null;
  team: string;
  life: number;
  dmg: number;
  blast: number;
  kind: 'rocket' | 'shell' | 'bomb' | 'smoke' | 'flash';
}

export interface Hit {
  t: number;
  point: THREE.Vector3;
  ped?: Ped;
  zone?: 'head' | 'body' | 'legs';
  vehicle?: Vehicle;
  vZone?: 'front' | 'rear' | 'side' | 'wheel' | 'glass';
  wall?: boolean;
}

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

export class Weapons {
  rockets: Rocket[] = [];
  private tracerGeo = new THREE.BufferGeometry();
  private tracerPos = new Float32Array(6 * 200);
  private tracerLife: number[] = [];
  private tracerCount = 0;
  tracers: THREE.LineSegments;
  flash: THREE.PointLight;
  private flashUntil = 0;

  constructor(private g: Game) {
    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    this.tracers = new THREE.LineSegments(this.tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.8 }));
    this.tracers.frustumCulled = false;
    g.scene.add(this.tracers);
    this.flash = new THREE.PointLight(0xffc070, 0, 14, 2);
    g.scene.add(this.flash);
  }

  /** Raycast bullets against buildings, vehicles and people. */
  trace(origin: THREE.Vector3, dir: THREE.Vector3, range: number, ignore: (Ped | Vehicle | null)[], pierce = 0): Hit | null {
    const end = _v.copy(dir).multiplyScalar(range).add(origin);
    let best: Hit | null = null;
    const wall = this.g.world.raycast(origin.x, origin.y, origin.z, end.x, end.y, end.z, { skipBoxes: pierce });
    if (wall) best = { t: wall.t * range, point: new THREE.Vector3().copy(dir).multiplyScalar(wall.t * range).add(origin), wall: true };
    // Vehicles: test the ray in each vehicle's local frame against its box.
    for (const v of this.g.vehicles) {
      if (ignore.includes(v) || v.sunk) continue;
      const dx = v.x - origin.x, dz = v.z - origin.z;
      if (dx * dx + dz * dz > (range + 20) ** 2) continue;
      const t = v.rayHit(origin, dir, best ? best.t : range);
      if (t !== null && (!best || t.t < best.t)) best = { t: t.t, point: new THREE.Vector3().copy(dir).multiplyScalar(t.t).add(origin), vehicle: v, vZone: t.zone };
    }
    // People: three spheres (legs, torso, head).
    for (const p of this.g.peds) {
      if (!p.alive || ignore.includes(p) || p.vehicle) continue;
      const dx = p.x - origin.x, dz = p.z - origin.z;
      if (dx * dx + dz * dz > (range + 2) ** 2) continue;
      const hgt = p.crouch ? 0.62 : 1;
      const parts: [number, number, Hit['zone']][] = [
        [0.55 * hgt, 0.32, 'legs'],
        [1.25 * hgt, 0.34, 'body'],
        [1.72 * hgt, 0.2, 'head'],
      ];
      for (const [hy, r, zone] of parts) {
        _d.set(p.x - origin.x, p.y + hy - origin.y, p.z - origin.z);
        const proj = _d.dot(dir);
        if (proj < 0 || proj > (best ? best.t : range)) continue;
        const d2 = _d.lengthSq() - proj * proj;
        if (d2 < r * r) {
          const t = proj - Math.sqrt(r * r - d2);
          if (!best || t < best.t) best = { t, point: new THREE.Vector3().copy(dir).multiplyScalar(t).add(origin), ped: p, zone };
        }
      }
    }
    return best;
  }

  addTracer(a: THREE.Vector3, b: THREE.Vector3) {
    const i = this.tracerCount % 200;
    this.tracerPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    this.tracerLife[i] = 0.05;
    this.tracerCount++;
  }

  muzzleFlash(p: THREE.Vector3, suppressed = false) {
    if (suppressed) return;
    this.flash.position.copy(p);
    this.flash.intensity = 30;
    this.flashUntil = this.g.time + 0.05;
  }

  /**
   * Fire one trigger pull. `aimDir` is normalised; `spreadMul` combines stance,
   * attachments, vehicle stability etc. Returns false if it could not fire.
   */
  fire(shooter: Ped, ws: WeaponState, origin: THREE.Vector3, aimDir: THREE.Vector3, spreadMul = 1): boolean {
    const s = ws.spec, now = this.g.time;
    if (now < ws.nextShot || now < ws.reloadUntil) return false;
    if (s.cat === 'melee') {
      ws.nextShot = now + 60 / s.rpm;
      this.melee(shooter, ws);
      return true;
    }
    if (ws.ammo <= 0) {
      this.reload(ws);
      if (shooter.isPlayer) this.g.audio.click();
      return false;
    }
    if (s.spinUp && ws.spin < s.spinUp) return false;
    ws.nextShot = now + 60 / s.rpm;
    const rounds = s.burst ? Math.min(s.burst, ws.ammo) : 1;
    ws.ammo -= rounds;
    const suppressed = ws.attachments.has('suppressor');
    const muzzle = _v.copy(aimDir).multiplyScalar(0.8).add(origin).clone();
    this.muzzleFlash(muzzle, suppressed);
    this.g.audio.gunshot(s, muzzle.x, muzzle.y, muzzle.z, suppressed);
    this.g.bus.emit('shot', { x: origin.x, z: origin.z, by: shooter, loud: !suppressed, weapon: s });

    if (s.rocket) {
      this.launch('rocket', muzzle, aimDir.clone().multiplyScalar(65), shooter, shooter.team, s.dmg, s.blast ?? 8);
      return true;
    }
    const pellets = s.pellets * rounds;
    for (let n = 0; n < pellets; n++) {
      const sp = s.spread * spreadMul;
      const dir = aimDir.clone();
      dir.x += rand(-sp, sp);
      dir.y += rand(-sp, sp) * 0.7;
      dir.z += rand(-sp, sp);
      dir.normalize();
      const hit = this.trace(origin, dir, s.range, [shooter, shooter.vehicle], s.pierce ?? 0);
      const end = hit ? hit.point : dir.clone().multiplyScalar(s.range).add(origin);
      if (n < 3 || Math.random() < 0.3) this.addTracer(muzzle, end);
      if (!hit) continue;
      let dmg = s.dmg;
      if (s.falloff && hit.t > s.falloff) dmg *= clamp(1 - (hit.t - s.falloff) / 25, 0.15, 1);
      if (s.cat === 'shotgun' && hit.t > 10) dmg *= clamp(1 - (hit.t - 10) / s.range, 0.1, 1);
      this.applyHit(hit, dmg, dir, shooter, s);
    }
    return true;
  }

  applyHit(hit: Hit, dmg: number, dir: THREE.Vector3, shooter: Ped | null, s: WeaponSpec | null) {
    const fx = this.g.particles;
    if (hit.ped) {
      const zoneMul = hit.zone === 'head' ? 2.2 : hit.zone === 'legs' ? 0.6 : 1;
      hit.ped.damage(dmg * zoneMul, shooter, { dir, knockback: s?.knockback ?? (s && s.dmg > 60 ? 4 : 0.8), zone: hit.zone });
      fx.burst(hit.point.x, hit.point.y, hit.point.z, 5, 3, 0.4, 0.07, 0x8a0000);
      if (shooter?.isPlayer) this.g.ability.onHit(hit.zone === 'head');
    } else if (hit.vehicle) {
      const v = hit.vehicle;
      v.bulletHit(dmg, hit.vZone ?? 'side', s?.engineDmg ?? dmg * 0.25, shooter, hit.point);
      fx.burst(hit.point.x, hit.point.y, hit.point.z, 4, 4, 0.25, 0.05, 0xffd070);
    } else {
      fx.burst(hit.point.x, hit.point.y, hit.point.z, 4, 3, 0.4, 0.08, 0x9a958c);
    }
  }

  reload(ws: WeaponState) {
    if (ws.spec.cat === 'melee' || ws.ammo === ws.spec.mag || ws.reserve <= 0 || this.g.time < ws.reloadUntil) return;
    ws.reloadUntil = this.g.time + ws.spec.reload;
    const n = Math.min(ws.spec.mag - ws.ammo, ws.reserve);
    ws.reserve -= n;
    ws.ammo += n;
    this.g.audio.reload();
  }

  private melee(attacker: Ped, ws: WeaponState) {
    const s = ws.spec;
    attacker.swing = 0.3;
    const fx = Math.sin(attacker.heading), fz = Math.cos(attacker.heading);
    let target: Ped | null = null, bestD = s.range;
    for (const p of this.g.peds) {
      if (p === attacker || !p.alive || p.vehicle) continue;
      const dx = p.x - attacker.x, dz = p.z - attacker.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || (dx * fx + dz * fz) / (d || 1) < 0.5) continue;
      target = p;
      bestD = d;
    }
    const dir = new THREE.Vector3(fx, 0, fz);
    if (target) {
      let dmg = s.dmg * (attacker.isPlayer ? this.g.ability.meleeMul() : 1);
      // Stealth takedown: target unaware and attacked from behind.
      const behind = Math.sin(target.heading) * fx + Math.cos(target.heading) * fz > 0.5;
      if (s.stealthKill && behind && !target.alert) {
        dmg = 999;
        this.g.hud.toast('התנקשות שקטה');
      }
      target.damage(dmg, attacker, { dir, knockback: s.id === 'bat' ? 4 : 1.5, zone: 'body', melee: true });
      this.g.audio.punch();
      if (attacker.isPlayer) this.g.bus.emit('assault', { x: attacker.x, z: attacker.z, victim: target, by: attacker });
      return;
    }
    // Hitting a vehicle with a bat smashes its glass.
    for (const v of this.g.vehicles) {
      if (Math.hypot(v.x - attacker.x, v.z - attacker.z) < v.spec.l / 2 + s.range && v !== attacker.vehicle) {
        if (s.smashGlass) v.shatterGlass();
        v.health -= s.dmg * 0.2;
        this.g.audio.punch();
        if (attacker.isPlayer && v.driver) this.g.bus.emit('assault', { x: v.x, z: v.z, victim: v.driver, by: attacker });
        return;
      }
    }
  }

  launch(kind: Rocket['kind'], pos: THREE.Vector3, vel: THREE.Vector3, owner: Ped | Vehicle | null, team: string, dmg: number, blast: number) {
    const size = kind === 'rocket' || kind === 'shell' ? 0.25 : kind === 'bomb' ? 0.5 : 0.15;
    const color = kind === 'smoke' ? 0x5a6a50 : kind === 'flash' ? 0x333333 : 0x444444;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size * (kind === 'rocket' ? 4 : 1.5)), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(pos);
    this.g.scene.add(mesh);
    this.rockets.push({ mesh, pos: pos.clone(), vel, owner, team, life: kind === 'smoke' || kind === 'flash' ? 2 : 8, dmg, blast, kind });
  }

  update(dt: number) {
    const now = this.g.time;
    if (now > this.flashUntil) this.flash.intensity = 0;
    for (let i = 0; i < 200; i++) {
      if (this.tracerLife[i] === undefined) continue;
      this.tracerLife[i] -= dt;
      if (this.tracerLife[i] <= 0) {
        this.tracerPos.fill(0, i * 6, i * 6 + 6);
        delete this.tracerLife[i];
      }
    }
    this.tracerGeo.attributes.position.needsUpdate = true;

    for (const r of this.rockets) {
      const grav = r.kind === 'rocket' ? 1.5 : r.kind === 'shell' ? 2 : 9.8;
      r.vel.y -= grav * dt;
      const next = r.pos.clone().addScaledVector(r.vel, dt);
      r.life -= dt;
      if (r.kind === 'rocket') this.g.particles.spawn(r.pos.x, r.pos.y, r.pos.z, rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5), 0.8, 0.3, 0xbbbbbb, 1.2);
      if (r.kind === 'smoke' || r.kind === 'flash') {
        if (next.y < 0.1) {
          next.y = 0.1;
          r.vel.multiplyScalar(0.4);
          r.vel.y = Math.abs(r.vel.y) * 0.3;
        }
        if (r.life <= 0) this.detonateUtility(r);
      } else {
        const dir = next.clone().sub(r.pos);
        const len = dir.length();
        dir.normalize();
        const ign: (Ped | Vehicle | null)[] = [r.owner];
        if (r.owner && 'vehicle' in r.owner) ign.push((r.owner as Ped).vehicle);
        const hit = len > 0 ? this.trace(r.pos, dir, len, ign) : null;
        if (hit || next.y < 0 || r.life <= 0) {
          const p = hit ? hit.point : next;
          this.g.explode(p.x, Math.max(0.3, p.y), p.z, r.blast, r.dmg, r.owner && 'isPlayer' in r.owner ? (r.owner as Ped) : null);
          r.life = -1;
        }
      }
      r.pos.copy(next);
      r.mesh.position.copy(next);
      r.mesh.lookAt(next.clone().add(r.vel));
    }
    this.rockets = this.rockets.filter((r) => {
      if (r.life > 0) return true;
      this.g.scene.remove(r.mesh);
      return false;
    });
  }

  private detonateUtility(r: Rocket) {
    if (r.kind === 'smoke') {
      this.g.world.smoke.push({ x: r.pos.x, y: 1.5, z: r.pos.z, r: 6, until: this.g.time + 16 });
      for (let i = 0; i < 70; i++) this.g.particles.spawn(r.pos.x + rand(-4, 4), rand(0.5, 4), r.pos.z + rand(-4, 4), rand(-0.3, 0.3), rand(0, 0.2), rand(-0.3, 0.3), rand(10, 16), rand(2.5, 4), 0xc8ccc4, 0.15);
      this.g.audio.thud(r.pos.x, r.pos.y, r.pos.z);
    } else {
      // Flashbang: blinds and deafens the player if close and facing it.
      this.g.particles.burst(r.pos.x, 1, r.pos.z, 12, 8, 0.2, 0.15, 0xffffff, 0);
      this.g.audio.bang(r.pos.x, r.pos.y, r.pos.z);
      const pl = this.g.player.ped;
      const d = Math.hypot(pl.x - r.pos.x, pl.z - r.pos.z);
      if (d < 12) this.g.hud.flashbang(clamp(1.4 - d / 12, 0.3, 1));
      for (const p of this.g.peds) if (p.alive && p.team !== r.team && Math.hypot(p.x - r.pos.x, p.z - r.pos.z) < 8) p.stunUntil = this.g.time + 3;
    }
  }
}

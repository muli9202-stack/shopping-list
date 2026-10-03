import * as THREE from 'three';
import type { Game } from './game';
import { Ped } from './actors';
import type { Vehicle } from './vehicles';
import { angleDiff, clamp, damp, dist, rand } from './util';
import { inTunnel } from './world';

// ---------------------------------------------------------------------------
// Player control: third-person on foot (aim, recoil, cover-crouch, dodge),
// driving/flying/sailing, drive-by fire, the chase camera, and the three
// playable characters with their special abilities.
// ---------------------------------------------------------------------------

export type AbilityKind = 'marksman' | 'brute' | 'driver';

export interface Character {
  name: string;
  ability: AbilityKind;
  abilityName: string;
  desc: string;
  ped: Ped | null;
  x: number;
  z: number;
  meter: number;
  shirt: number;
}

export class Ability {
  active = false;
  constructor(private g: Game) {}
  get char() {
    return this.g.player.char;
  }
  get kind() {
    return this.char.ability;
  }
  onHit(head: boolean) {
    if (this.kind === 'marksman' && !this.active) this.char.meter = Math.min(100, this.char.meter + (head ? 10 : 3));
  }
  onDamaged(amount: number) {
    if (this.kind === 'brute' && !this.active) this.char.meter = Math.min(100, this.char.meter + amount * 0.6);
  }
  meleeMul() {
    return this.active && this.kind === 'brute' ? 2.5 : 1;
  }
  damageTakenMul() {
    return this.active && this.kind === 'brute' ? 0.45 : 1;
  }
  /** World time multiplier: marksman and driver slow time down. */
  timeScale() {
    if (!this.active) return 1;
    return this.kind === 'brute' ? 1 : this.kind === 'driver' ? 0.5 : 0.35;
  }
  toggle() {
    if (this.active) {
      this.active = false;
      return;
    }
    if (this.char.meter < 15) {
      this.g.hud.toast('מד היכולת ריק', 1);
      return;
    }
    if (this.kind === 'driver' && !this.g.player.ped.vehicle) {
      this.g.hud.toast('היכולת של נועה פועלת רק בנהיגה', 1.2);
      return;
    }
    this.active = true;
    this.g.hud.toast(this.char.abilityName, 1.2);
  }
  update(realDt: number) {
    const c = this.char, p = this.g.player;
    if (this.active) {
      c.meter -= realDt * 11;
      if (c.meter <= 0 || (this.kind === 'driver' && !p.ped.vehicle)) {
        c.meter = Math.max(0, c.meter);
        this.active = false;
      }
    } else if (this.kind === 'driver' && p.ped.vehicle && !p.ped.vehicle.isAir) {
      // Dangerous driving fills Noa's meter: high speed and near misses.
      const v = p.ped.vehicle;
      if (v.speed > 28) c.meter = Math.min(100, c.meter + realDt * 2.5);
      for (const o of this.g.vehicles) if (o !== v && o.role === 'traffic' && v.speed > 18 && dist(o.x, o.z, v.x, v.z) < 3.6) c.meter = Math.min(100, c.meter + realDt * 25);
    }
  }
}

export class Player {
  chars: Character[] = [
    { name: 'אדם', ability: 'marksman', abilityName: 'זמן קליע', desc: 'צלף לשעבר. היכולת מאטה את הזמן בזמן כיוון. ממלא ביריות מדויקות.', ped: null, x: 0, z: 0, meter: 40, shirt: 0x2f4f4f },
    { name: 'בוריס', ability: 'brute', abilityName: 'זעם', desc: 'פסיכופת בלתי צפוי. סופג פחות נזק ומכה כפליים. ממלא בספיגת נזק.', ped: null, x: 0, z: 0, meter: 40, shirt: 0x7a3b1f },
    { name: 'נועה', ability: 'driver', abilityName: 'ריכוז נהיגה', desc: 'נהגת מילוט. מאטה את הזמן בנהיגה. ממלאת בנהיגה מסוכנת.', ped: null, x: 0, z: 0, meter: 40, shirt: 0x5b2a86 },
  ];
  charIdx = 0;
  ped!: Ped;
  camYaw = 0;
  camPitch = -0.15;
  vx = 0;
  vz = 0;
  vy = 0;
  aiming = false;
  dodgeUntil = 0;
  recoilP = 0;
  recoilY = 0;
  camDist = 4.4;
  camMode = 0;
  private lookIdle = 0;
  private shake = 0;
  private grounded = true;
  aimPoint = new THREE.Vector3();
  bipod = false;
  scoped = false;
  enterCooldown = 0;

  constructor(private g: Game) {}

  get char() {
    return this.chars[this.charIdx];
  }
  get pitch() {
    return this.camPitch + this.recoilP;
  }

  spawnChars() {
    const places = ['safehouse', 'docks', 'garage'].map((id) => this.g.world.places.find((p) => p.id === id)!);
    this.chars.forEach((c, i) => {
      c.x = places[i].x + (i === 1 ? -14 : 0);
      c.z = places[i].z - 3;
    });
    this.activate(0);
  }

  private makePed(c: Character) {
    const p = new Ped(this.g, 'player', 'player', c.x, c.z);
    p.isPlayer = true;
    p.model.torso.material = new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.6 });
    p.give('fists', 0);
    p.give('knife', 0);
    p.give('bat', 0);
    p.give('glock', 75);
    if (c.ability === 'marksman') p.give('svd', 30);
    if (c.ability === 'brute') {
      p.give('sawed', 24);
      p.give('rpg', 3);
    }
    if (c.ability === 'driver') p.give('mp5', 120);
    p.give('m4', 90);
    p.armor = 50;
    p.equip(3);
    return p;
  }

  activate(i: number) {
    const c = this.chars[i];
    this.charIdx = i;
    if (!c.ped) c.ped = this.makePed(c);
    else {
      this.g.scene.add(c.ped.model.root);
      c.ped.x = c.x;
      c.ped.z = c.z;
    }
    this.ped = c.ped;
    // Face away from the building the character starts next to.
    this.camYaw = Math.PI;
    this.ped.heading = Math.PI;
    if (!this.g.peds.includes(this.ped)) this.g.peds.push(this.ped);
  }

  switchChar() {
    const g = this.g;
    if (g.police.stars > 0) {
      g.hud.toast('אי אפשר להחליף דמות כשמבוקשים', 1.5);
      return;
    }
    if (this.ped.vehicle) this.exitVehicle(true);
    const cur = this.char;
    cur.x = this.ped.x;
    cur.z = this.ped.z;
    g.peds = g.peds.filter((p) => p !== this.ped);
    g.scene.remove(this.ped.model.root);
    g.ability.active = false;
    const next = (this.charIdx + 1) % this.chars.length;
    g.hud.switchCinematic(this.chars[next].name, () => {
      this.activate(next);
      g.hud.toast(`${this.char.name}: ${this.char.desc}`, 4);
    });
  }

  camShake(a: number) {
    this.shake = Math.max(this.shake, a);
  }

  // ---- update ----------------------------------------------------------------

  update(dt: number, realDt: number) {
    const g = this.g, inp = g.input, p = this.ped;
    if (!p.alive) return;
    this.camYaw -= inp.lookDX;
    this.camPitch = clamp(this.camPitch - inp.lookDY, -1.2, 0.9);
    if (inp.lookDX || inp.lookDY) this.lookIdle = 0;
    else this.lookIdle += realDt;
    this.enterCooldown -= dt;

    if (inp.pressed('ability')) g.ability.toggle();
    if (inp.pressed('switch')) this.switchChar();
    if (inp.pressed('camera')) this.camMode = (this.camMode + 1) % 3;
    if (inp.pressed('enter') && this.enterCooldown <= 0) {
      this.enterCooldown = 0.5;
      if (p.vehicle) this.exitVehicle();
      else this.tryEnter();
    }
    this.weaponSelect();
    if (p.vehicle) this.drive(dt);
    else this.onFoot(dt);
    this.shooting(dt);
    // Recoil recovery
    const rec = p.weapon?.spec.recovery ?? 8;
    this.recoilP = damp(this.recoilP, 0, rec, realDt);
    this.recoilY = damp(this.recoilY, 0, rec, realDt);
    this.updateCamera(realDt);
  }

  private weaponSelect() {
    const inp = this.g.input, p = this.ped;
    const keys = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w0'] as const;
    keys.forEach((k, i) => {
      if (inp.pressed(k) && p.weapons[i]) p.equip(i);
    });
    if (inp.pressed('next')) p.equip((p.weaponIdx + 1) % p.weapons.length);
    if (inp.pressed('prev')) p.equip((p.weaponIdx - 1 + p.weapons.length) % p.weapons.length);
    if (inp.pressed('reload') && p.weapon) this.g.weapons.reload(p.weapon);
  }

  private onFoot(dt: number) {
    const g = this.g, inp = g.input, p = this.ped;
    const now = g.time;
    if (p.ragdoll > 0) return;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const rx = -fz, rz = fx;
    let mx = fx * inp.moveY + rx * inp.moveX, mz = fz * inp.moveY + rz * inp.moveX;
    const mag = Math.min(1, Math.hypot(mx, mz));
    if (mag > 0.01) {
      const l = Math.hypot(mx, mz);
      mx /= l;
      mz /= l;
    }
    if (inp.pressed('crouch')) p.crouch = !p.crouch;
    this.aiming = inp.isHeld('aim') || (inp.touch && inp.isHeld('fire') && p.armed);
    const weight = p.weapon?.spec.weight ?? 0;
    const sprint = inp.isHeld('sprint') && !this.aiming;
    let speed = (mag < 0.6 && inp.touch ? 2.4 : sprint ? 7.6 : 5.2) * (1 - weight * 0.024) * (p.crouch ? 0.45 : 1) * (this.aiming ? 0.55 : 1);
    if (now < this.dodgeUntil) speed = 9;
    else if (inp.pressed('dodge') && mag > 0.1 && this.grounded) {
      this.dodgeUntil = now + 0.38;
      p.crouch = false;
    }
    this.vx = damp(this.vx, mx * speed * mag, 12, dt);
    this.vz = damp(this.vz, mz * speed * mag, 12, dt);
    p.x += this.vx * dt;
    p.z += this.vz * dt;
    if (inp.pressed('jump') && this.grounded && !p.crouch) {
      this.vy = 5.2;
      this.grounded = false;
    }
    this.vy -= 15 * dt;
    p.y += this.vy * dt;
    const floor = this.floorAt(p.x, p.z, p.y);
    if (p.y <= floor) {
      p.y = floor;
      this.vy = 0;
      this.grounded = true;
    }
    const res = g.world.collideCircle(p.x, p.z, 0.35, p.y + 0.5);
    p.x = res.x;
    p.z = res.z;
    // Light push against people and parked cars.
    for (const v of g.vehicles) {
      if (v.isAir && v.y > 1) continue;
      const d = dist(v.x, v.z, p.x, p.z), r = v.spec.w * 0.55 + 0.35;
      if (d < r && d > 0.01) {
        p.x = v.x + ((p.x - v.x) / d) * r;
        p.z = v.z + ((p.z - v.z) / d) * r;
      }
    }
    p.speed = Math.hypot(this.vx, this.vz);
    if (this.aiming || inp.isHeld('fire')) p.heading = this.camYaw;
    else if (mag > 0.1) p.heading += angleDiff(p.heading, Math.atan2(mx, mz)) * Math.min(1, dt * 12);
    this.bipod = p.crouch && p.speed < 0.3 && !!p.weapon?.spec.bipod;
    p.sync(dt);
    if (now < this.dodgeUntil) p.model.body.rotation.x = ((this.dodgeUntil - now) / 0.38) * Math.PI * 2;
    else p.model.body.rotation.x = 0;
    // Swimming
    if (g.world.surfaceAt(p.x, p.z) === 'water') {
      p.y = -1.1;
      this.grounded = true;
    }
  }

  private floorAt(x: number, z: number, y: number) {
    // Stand on rooftops you are above (dropped there by helicopter, etc.)
    const h = this.g.world.groundHeight(x, z);
    return y >= h - 0.3 ? h : 0;
  }

  private tryEnter() {
    const g = this.g, p = this.ped;
    let best: Vehicle | null = null, bd = 6;
    for (const v of g.vehicles) {
      if (v.destroyed || v.sunk || v.role === 'air-support') continue;
      const d = dist(v.x, v.z, p.x, p.z) - v.spec.w / 2;
      if (d < bd && Math.abs(v.y - p.y) < 3) {
        bd = d;
        best = v;
      }
    }
    if (!best) return;
    const v = best;
    if (v.driver && v.driver.alive && !v.driver.isPlayer) {
      // Carjacking: pull the driver out.
      const d = v.driver;
      d.vehicle = null;
      d.x = v.x + Math.cos(v.heading) * 2.2;
      d.z = v.z - Math.sin(v.heading) * 2.2;
      d.startRagdoll(Math.cos(v.heading) * 3, 2, -Math.sin(v.heading) * 3);
      if (d.team === 'civ') {
        d.state = d.psych.aggression > 70 ? 'attack' : 'flee';
        d.stateUntil = g.time + 10;
        d.say(d.psych.aggression > 70 ? '!תחזיר לי את האוטו' : '!הצילו, גונבים לי את הרכב');
        d.route.i = Math.max(0, Math.min(7, Math.floor((d.x + 328) / 82)));
      } else g.police.units.push(d);
      g.police.commitCrime('carjack', v.x, v.z, false, 30);
      g.bus.emit('crime', { x: v.x, z: v.z, kind: 'carjack', by: p });
    } else if (v.role === 'parked' || v.role === 'abandoned') {
      g.police.commitCrime('theft', v.x, v.z, false, 4);
    } else if (v.role === 'police' || v.role === 'roadblock') g.police.commitCrime('carjack', v.x, v.z, false, 40);
    for (const q of v.passengers) {
      q.vehicle = null;
      q.x = v.x - Math.cos(v.heading) * 2.2;
      q.z = v.z + Math.sin(v.heading) * 2.2;
      if (q.team === 'civ') q.setState('flee', 8);
      else g.police.units.push(q);
    }
    v.passengers = [];
    v.driver = p;
    p.vehicle = v;
    if (v.role !== 'military' && v.role !== 'air-support') v.role = 'player';
    v.sirenOn = false;
    g.removeFromCrews(v);
    this.camYaw = v.heading;
    g.input.setVehicleMode(v.isAir ? 'air' : 'car');
    const s = v.spec;
    g.hud.toast(`${s.name} · ${s.cls}${s.desc ? ' · ' + s.desc : ''}`, 3);
    if (g.audio.station < 0 && !v.isAir) g.hud.toast(`📻 ${g.audio.cycleStation()} (Z להחלפה)`, 2);
  }

  exitVehicle(force = false) {
    const g = this.g, p = this.ped, v = p.vehicle;
    if (!v) return;
    if (v.isAir && v.y > 3 && !force) {
      // Bail out of an aircraft: fall (no parachute in this prototype, so mind the height).
      g.hud.toast('קפצת מכלי הטיס!', 1.5);
    }
    v.driver = null;
    v.throttle = 0;
    v.steerIn = 0;
    v.handbrake = true;
    v.role = 'abandoned';
    p.vehicle = null;
    p.x = v.x + Math.cos(v.heading) * (v.spec.w / 2 + 0.9);
    p.z = v.z - Math.sin(v.heading) * (v.spec.w / 2 + 0.9);
    p.y = v.y;
    this.vy = 0;
    this.vx = v.vx * 0.5;
    this.vz = v.vz * 0.5;
    if (v.speed > 9 && !force) p.startRagdoll(v.vx * 0.6, 2, v.vz * 0.6);
    g.input.setVehicleMode('foot');
  }

  private drive(dt: number) {
    const g = this.g, inp = g.input, v = this.ped.vehicle!;
    void dt;
    if (v.destroyed) {
      this.exitVehicle(true);
      return;
    }
    v.throttle = inp.moveY;
    v.steerIn = -inp.moveX;
    v.handbrake = inp.isHeld('jump') && !v.isAir;
    if (v.isAir) v.altitude = (inp.isHeld('jump') ? 1 : 0) - (inp.isHeld('sprint') || inp.isHeld('down') ? 1 : 0);
    if (inp.pressed('horn')) g.audio.horn(v.x, v.z);
    if (inp.pressed('radio')) g.hud.toast('📻 ' + g.audio.cycleStation(), 1.5);
    // Hitting people
    if (!v.isAir && v.speed > 4) {
      for (const q of g.peds) {
        if (q === this.ped || !q.alive || q.vehicle) continue;
        if (dist(q.x, q.z, v.x, v.z) < v.spec.w * 0.6 + 0.4) {
          const dir = new THREE.Vector3(v.vx, 0, v.vz).normalize();
          q.damage(v.speed * 5, this.ped, { dir, knockback: v.speed * 0.6 });
          g.police.commitCrime('hitPed', q.x, q.z, false, 10);
          g.bus.emit('crime', { x: q.x, z: q.z, kind: 'hitPed', by: this.ped });
        }
      }
    }
  }

  private shooting(dt: number) {
    const g = this.g, inp = g.input, p = this.ped, now = g.time;
    const v = p.vehicle;
    const ws = p.weapon;
    // Vehicle-mounted weapons: tank cannon, APC/police helicopter machine gun.
    if (v && (v.spec.kind === 'tank' || v.spec.id === 'apc' || v.spec.id === 'polheli')) {
      v.turretYaw = this.camYaw - v.heading;
      if (inp.isHeld('fire') && now > v.nextGun) {
        const dir = this.aimDir();
        const o = new THREE.Vector3(v.x, v.y + (v.isAir ? -0.5 : 2.4), v.z).addScaledVector(dir, 4);
        if (v.spec.kind === 'tank') {
          v.nextGun = now + 2.5;
          g.weapons.launch('shell', o, dir.clone().multiplyScalar(110), v, 'player', 450, 9);
          g.audio.cannon(o.x, o.y, o.z);
          this.camShake(0.6);
        } else {
          v.nextGun = now + 0.08;
          const gun = p.give('minigun', 0);
          gun.ammo = 10;
          gun.nextShot = 0;
          gun.spin = 9;
          g.weapons.fire(p, gun, o, dir, 0.6);
        }
      }
      return;
    }
    if (!ws) return;
    // Drive-by: only one-handed weapons from vehicles.
    if (v && !(ws.spec.cat === 'pistol' || ws.spec.cat === 'smg')) return;
    if (v && v.isAir) return;
    const firing = inp.isHeld('fire');
    if (ws.spec.spinUp) ws.spin = firing ? Math.min(ws.spec.spinUp, ws.spin + dt) : Math.max(0, ws.spin - dt);
    this.scoped = !v && this.aiming && (!!ws.spec.scope || ws.attachments.has('scope'));
    const want = ws.spec.auto ? firing : inp.pressed('fire') || (inp.touch && firing && now > ws.nextShot + 0.15);
    if (!want) return;
    const dir = this.aimDir();
    const origin = v ? new THREE.Vector3(v.x, v.y + 1.3, v.z).addScaledVector(dir, 1.2) : new THREE.Vector3(p.x + Math.cos(p.heading) * -0.3, p.y + (p.crouch ? 1.0 : 1.45), p.z + Math.sin(p.heading) * 0.3);
    if (!v && ws.spec.cat !== 'melee') {
      // Aim from the gun to the point under the crosshair.
      dir.copy(this.aimPoint).sub(origin).normalize();
    }
    let spread = 1;
    if (!v) {
      if (p.speed > 0.5) spread *= 1.7;
      if (p.crouch) spread *= 0.7;
      if (this.aiming) spread *= 0.6;
      if (ws.attachments.has('laser')) spread *= 0.75;
      if (ws.attachments.has('holo')) spread *= 0.85;
      if (ws.spec.bipod && !this.bipod) spread *= 14;
    } else spread *= ws.spec.id === 'mp5' ? 0.7 : 1.6 / v.stability;
    const fired = g.weapons.fire(p, ws, origin, dir, spread);
    if (fired && ws.spec.cat !== 'melee') {
      const [rv, rh] = ws.spec.recoil;
      const grip = ws.attachments.has('grip') ? 0.7 : 1;
      const bip = this.bipod ? 0.25 : 1;
      this.recoilP += rv * grip * bip;
      this.recoilY += rand(-rh, rh) * grip * bip;
      this.camShake(Math.min(0.5, rv * 2));
    }
  }

  /** Direction from the camera through the crosshair; on touch screens it snaps to a nearby target. */
  aimDir() {
    const g = this.g;
    const dir = new THREE.Vector3();
    g.camera.getWorldDirection(dir);
    const cam = g.camera.position;
    if (g.input.touch) {
      let best: Ped | null = null, ba = 0.2;
      for (const q of g.peds) {
        if (!q.alive || q.isPlayer || q.vehicle || (!q.isArmedUnit && !q.alert && g.police.stars === 0 && q.team === 'civ' && !g.input.isHeld('aim'))) continue;
        const to = new THREE.Vector3(q.x - cam.x, q.y + 1.2 - cam.y, q.z - cam.z);
        const d = to.length();
        if (d > 70) continue;
        const a = to.normalize().angleTo(dir);
        if (a < ba && !g.world.raycast(cam.x, cam.y, cam.z, q.x, q.y + 1.2, q.z)) {
          ba = a;
          best = q;
        }
      }
      if (best) dir.set(best.x - cam.x, best.y + (best.crouch ? 0.8 : 1.25) - cam.y, best.z - cam.z).normalize();
    }
    // Where does the crosshair ray land?
    const hit = g.weapons.trace(cam, dir, 400, [this.ped, this.ped.vehicle]);
    this.aimPoint.copy(hit ? hit.point : dir.clone().multiplyScalar(400).add(cam));
    return dir;
  }

  private updateCamera(dt: number) {
    const g = this.g, cam = g.camera, p = this.ped, v = p.vehicle;
    const yaw = this.camYaw + this.recoilY;
    const pitch = this.camPitch + this.recoilP;
    let pivot: THREE.Vector3, distc: number, fov = 70;
    if (v) {
      // Chase camera: swing behind the vehicle when the player isn't looking around.
      if (this.lookIdle > 1.2 && v.speed > 3) this.camYaw += angleDiff(this.camYaw, Math.atan2(v.vx, v.vz)) * Math.min(1, dt * 2.5);
      const size = Math.max(v.spec.l, v.isAir ? 10 : 0);
      pivot = new THREE.Vector3(v.x, v.y + v.spec.h + 0.6, v.z);
      distc = size * 1.25 + 3 + [0, 4, -2][this.camMode];
      fov = 70 + clamp(v.speed / 4, 0, 18);
    } else {
      const shoulder = this.aiming ? 0.75 : 0.45;
      pivot = new THREE.Vector3(p.x - Math.cos(yaw) * shoulder, p.y + (p.crouch ? 1.2 : 1.65), p.z + Math.sin(yaw) * shoulder);
      distc = this.aiming ? 2.1 : [4.4, 7, 2.8][this.camMode];
      if (this.scoped) {
        distc = 0.2;
        const z = p.weapon?.spec.scope ?? 3;
        fov = 70 / z;
      } else if (this.aiming) fov = 55;
    }
    const back = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    let want = pivot.clone().addScaledVector(back, distc);
    // Keep the camera out of walls.
    const hit = g.world.raycast(pivot.x, pivot.y, pivot.z, want.x, want.y, want.z);
    if (hit) want = pivot.clone().addScaledVector(back, Math.max(0.3, distc * hit.t - 0.3));
    want.y = Math.max(want.y, inTunnel(pivot.x, pivot.z) ? 0.5 : 0.4);
    if (inTunnel(pivot.x, pivot.z)) want.y = Math.min(want.y, 8.2);
    cam.position.lerp(want, v ? 1 - Math.exp(-dt * 10) : 1);
    if (this.shake > 0) {
      cam.position.x += rand(-1, 1) * this.shake * 0.15;
      cam.position.y += rand(-1, 1) * this.shake * 0.15;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    cam.lookAt(pivot.clone().addScaledVector(back, -10));
    cam.fov = damp(cam.fov, fov, 10, dt);
    cam.updateProjectionMatrix();
  }
}

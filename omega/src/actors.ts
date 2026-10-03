import * as THREE from 'three';
import type { Game } from './game';
import type { Vehicle } from './vehicles';
import { gunModel, pedModel, type PedModel } from './models';
import { WeaponState, weaponById } from './weapons';
import { angleDiff, chance, clamp, damp, dist, pick, rand, randInt } from './util';
import { CELL, GRID, HALF, ROAD, blockIndexAt, blockMax, blockMin, nearestRoad, roadLine } from './world';

// ---------------------------------------------------------------------------
// People. One class drives the player's body, civilians and every armed unit.
// Civilians carry a psychological profile (courage, panic, aggression) that
// picks their reaction to danger; armed units run a small tactics tree (cover,
// peeking, flanking, grenades, coordinated radio reports).
// ---------------------------------------------------------------------------

export type Team = 'player' | 'civ' | 'police' | 'military';
export type Role = 'player' | 'walker' | 'worker' | 'homeless' | 'monk' | 'business' | 'driver' | 'cop' | 'swat' | 'soldier' | 'sniper';
export type State =
  | 'idle' | 'walk' | 'flee' | 'hide' | 'film' | 'attack' | 'gather' | 'cower' | 'confront' | 'call'
  | 'patrol' | 'pursue' | 'combat' | 'arrest' | 'search' | 'drive' | 'dead';

export interface DamageInfo {
  dir: THREE.Vector3;
  knockback: number;
  zone?: 'head' | 'body' | 'legs';
  melee?: boolean;
  explosion?: boolean;
}

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4423];
const SHIRTS = [0xb03a2e, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xecf0f1, 0x34495e, 0xe67e22, 0x16a085, 0x222222];
const PANTS = [0x1c2833, 0x34495e, 0x5d6d7e, 0x7b5e3c, 0x212f3d, 0x4a4a4a];

export const CURSES = ['!מה אתה עושה, משוגע', '!תסתכל לאן אתה נוסע', '!אני אקרא למשטרה', '!אתה תשלם על זה', '?יש לך בעיה', '!ראית מה עשית לאוטו שלי'];
const SCREAMS = ['!הצילו', '!הוא חמוש', '!תברחו', '!אלוהים', '!משטרה'];
const GATHER = ['?מה קרה פה', '!מישהו יתקשר לאמבולנס', '...ראיתי הכל', '!תצלם, תצלם'];

export class Ped {
  model: PedModel;
  x: number;
  z: number;
  y = 0;
  heading = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  health = 100;
  maxHealth = 100;
  armor = 0;
  alive = true;
  isPlayer = false;
  vehicle: Vehicle | null = null;
  crouch = false;
  alert = false;
  swing = 0;
  stunUntil = 0;
  speed = 0;
  walkPhase = Math.random() * 10;
  state: State = 'idle';
  stateUntil = 0;
  tx = 0;
  tz = 0;
  moveSpeed = 1.4;
  psych = { courage: randInt(1, 100), panic: randInt(1, 100), aggression: randInt(1, 100) };
  fear = 0;
  weapons: WeaponState[] = [];
  weaponIdx = 0;
  gunMesh: THREE.Object3D | null = null;
  ragdoll = 0;
  ragSpin = new THREE.Vector3();
  deadAt = 0;
  sayCooldown = 0;
  threat: { x: number; z: number } | null = null;
  dropItem = true;
  /** routine / walking */
  route = { i: 0, j: 0, f: Math.random(), dir: chance(0.5) ? 1 : -1 };
  leader: Ped | null = null;
  /** combat */
  awareness = 0;
  seesPlayer = false;
  lastSeen = -99;
  cover: { x: number; z: number } | null = null;
  coverUntil = 0;
  peek = 0;
  peekUntil = 0;
  flankSide = 0;
  squad = 0;
  nextThink = Math.random() * 0.3;
  path: { x: number; z: number }[] = [];
  pathAt = -99;
  arrestT = 0;
  laserUntil = 0;
  homeBlock: [number, number] = [0, 0];
  vehicleOwned: Vehicle | null = null;
  witnessed: { crime: string; heat: number; x: number; z: number } | null = null;
  reportAt = 0;
  burstLeft = 0;
  accuracy = 1;
  dropMoney = 0;
  /** Residents (site workers, the homeless) are never despawned. */
  persistent = false;

  constructor(private g: Game, public role: Role, public team: Team, x: number, z: number) {
    this.x = this.tx = x;
    this.z = this.tz = z;
    let shirt = pick(SHIRTS), pants = pick(PANTS), extra: Parameters<typeof pedModel>[3];
    switch (role) {
      case 'cop':
        shirt = 0x1d3a8a;
        pants = 0x10183a;
        extra = 'cap';
        this.health = this.maxHealth = 120;
        this.armor = 30;
        break;
      case 'swat':
        shirt = 0x222428;
        pants = 0x1a1a1a;
        extra = 'helmet';
        this.health = this.maxHealth = 150;
        this.armor = 100;
        break;
      case 'soldier':
      case 'sniper':
        shirt = 0x4b5a35;
        pants = 0x3e4a2c;
        extra = 'beret';
        this.health = this.maxHealth = 160;
        this.armor = 100;
        break;
      case 'monk':
        shirt = 0xe07b00;
        extra = 'robe';
        break;
      case 'worker':
        shirt = 0xff8c00;
        pants = 0x2e4053;
        extra = 'hardhat';
        break;
      case 'business':
        shirt = pick([0x1c1c1c, 0x2c3e50, 0x34495e]);
        pants = shirt;
        break;
      case 'homeless':
        shirt = pick([0x5d4e37, 0x4a4a3a]);
        pants = 0x3d3428;
        this.psych.courage = randInt(1, 35);
        break;
    }
    if (role === 'player') {
      shirt = 0x2f4f4f;
      pants = 0x1b2631;
    }
    this.model = pedModel(shirt, pants, pick(SKIN), extra);
    g.scene.add(this.model.root);
    this.sync(0);
  }

  get weapon() {
    return this.weapons[this.weaponIdx] ?? null;
  }
  get armed() {
    const w = this.weapon;
    return !!w && w.spec.cat !== 'melee';
  }
  get isArmedUnit() {
    return this.team === 'police' || this.team === 'military';
  }

  give(id: string, reserve?: number) {
    let ws = this.weapons.find((w) => w.spec.id === id);
    if (ws) {
      ws.reserve += reserve ?? ws.spec.mag * 2;
      return ws;
    }
    ws = new WeaponState(weaponById(id), reserve);
    this.weapons.push(ws);
    return ws;
  }

  equip(i: number) {
    if (!this.weapons[i]) return;
    this.weaponIdx = i;
    if (this.gunMesh) this.model.hand.remove(this.gunMesh);
    const spec = this.weapon.spec;
    this.gunMesh = spec.model ? gunModel(spec.model) : null;
    if (this.gunMesh) {
      this.gunMesh.rotation.x = Math.PI / 2;
      this.model.hand.add(this.gunMesh);
    }
  }

  remove() {
    this.g.scene.remove(this.model.root);
  }

  say(text: string, dur = 2.2) {
    if (this.sayCooldown > this.g.time) return;
    this.sayCooldown = this.g.time + dur + 1;
    this.g.hud.say(this, text, dur);
  }

  // ---- damage ---------------------------------------------------------------

  damage(amount: number, by: Ped | null, info: DamageInfo) {
    if (!this.alive) return;
    if (this.isPlayer) amount *= this.g.ability.damageTakenMul() * this.g.difficultyDmg;
    if (this.isPlayer && this.g.player.dodgeUntil > this.g.time && !info.explosion) return;
    if (this.armor > 0 && info.zone !== 'head') {
      const absorbed = Math.min(this.armor, amount * 0.66);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    this.alert = true;
    if (this.isPlayer) {
      this.g.hud.damageFlash(amount);
      this.g.ability.onDamaged(amount);
    }
    if (by && !this.isPlayer && !this.isArmedUnit) this.threat = { x: by.x, z: by.z };
    if (info.knockback > 3.5 || info.explosion) {
      this.startRagdoll(info.dir.x * info.knockback, info.explosion ? 6 : 2, info.dir.z * info.knockback);
    }
    if (this.health <= 0) this.die(by, info);
    else if (!this.isPlayer && this.team === 'civ') {
      this.fear = 1;
      if (this.psych.aggression > 80 && this.psych.courage > 60 && by && info.melee) this.setState('attack', 12);
      else this.setState('flee', rand(8, 14));
      this.say(pick(SCREAMS));
      this.g.audio.scream(this.x, this.z);
    }
  }

  startRagdoll(vx: number, vy: number, vz: number) {
    if (this.vehicle) return;
    this.ragdoll = 2.2;
    this.vx = vx;
    this.vz = vz;
    this.vy = vy;
    this.ragSpin.set(rand(-6, 6), rand(-3, 3), rand(-6, 6));
  }

  die(by: Ped | null, info?: DamageInfo) {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.state = 'dead';
    this.deadAt = this.g.time;
    this.model.phone.visible = false;
    if (!this.ragdoll) this.startRagdoll((info?.dir.x ?? 0) * 2, 1.5, (info?.dir.z ?? 0) * 2);
    this.g.bus.emit('death', { ped: this, by });
  }

  // ---- per-frame ----------------------------------------------------------

  update(dt: number) {
    if (this.vehicle) {
      this.x = this.vehicle.x;
      this.z = this.vehicle.z;
      this.y = this.vehicle.y;
      this.model.root.visible = false;
      return;
    }
    this.model.root.visible = true;
    if (this.ragdoll > 0 || !this.alive) {
      this.updateRagdoll(dt);
      return;
    }
    if (!this.isPlayer) {
      this.nextThink -= dt;
      if (this.nextThink <= 0) {
        this.nextThink = this.isArmedUnit ? 0.15 : 0.3;
        if (this.stunUntil > this.g.time) this.speed = 0;
        else if (this.isArmedUnit) this.thinkCombat();
        else this.thinkCivilian();
      }
      if (this.isArmedUnit && this.stunUntil < this.g.time) this.combatFrame(dt);
      this.moveTowards(dt);
    }
    this.sync(dt);
  }

  private updateRagdoll(dt: number) {
    this.ragdoll -= dt;
    this.vy -= 9.8 * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    const res = this.g.world.collideCircle(this.x, this.z, 0.35, this.y + 0.5);
    if (res.hit) {
      this.x = res.x;
      this.z = res.z;
      this.vx *= -0.3;
      this.vz *= -0.3;
    }
    if (this.y <= 0) {
      this.vx = damp(this.vx, 0, 4, dt);
      this.vz = damp(this.vz, 0, 4, dt);
      this.ragSpin.multiplyScalar(0.9);
    }
    const b = this.model.body;
    if (this.alive) {
      b.rotation.x += this.ragSpin.x * dt;
      b.rotation.z += this.ragSpin.z * dt;
      if (this.ragdoll <= 0) {
        b.rotation.set(0, 0, 0);
        this.vx = this.vz = this.vy = 0;
      }
    } else {
      // Settle lying on the ground.
      b.rotation.x = damp(b.rotation.x, -Math.PI / 2, 5, dt);
      b.rotation.z = damp(b.rotation.z, 0, 5, dt);
      b.position.y = damp(b.position.y, 0.2, 5, dt);
    }
    this.model.root.position.set(this.x, this.y, this.z);
  }

  setState(s: State, dur = 0) {
    this.state = s;
    this.stateUntil = this.g.time + dur;
  }

  /** Walk/run towards (tx, tz), sliding along walls. */
  moveTowards(dt: number) {
    let tx = this.tx, tz = this.tz;
    if (this.path.length) {
      const p = this.path[0];
      if (dist(this.x, this.z, p.x, p.z) < 2) this.path.shift();
      if (this.path.length) {
        tx = this.path[0].x;
        tz = this.path[0].z;
      }
    }
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const sp = d > 0.4 ? this.moveSpeed * (this.crouch ? 0.5 : 1) : 0;
    this.speed = damp(this.speed, sp, 8, dt);
    if (d > 0.4) {
      const want = Math.atan2(dx, dz);
      if (!this.facingLocked()) this.heading += angleDiff(this.heading, want) * Math.min(1, dt * 8);
      this.x += (dx / d) * this.speed * dt;
      this.z += (dz / d) * this.speed * dt;
    }
    const res = this.g.world.collideCircle(this.x, this.z, 0.35, this.y + 1);
    this.x = res.x;
    this.z = res.z;
  }

  facingLocked() {
    return this.isArmedUnit && this.seesPlayer && (this.state === 'combat' || this.state === 'arrest');
  }

  sync(dt: number) {
    const m = this.model;
    m.root.position.set(this.x, this.y, this.z);
    m.root.rotation.y = this.heading;
    this.walkPhase += dt * this.speed * 2.6;
    const sw = Math.sin(this.walkPhase) * clamp(this.speed / 3, 0, 1) * 0.8;
    m.legL.rotation.x = sw;
    m.legR.rotation.x = -sw;
    const aiming = (this.isArmedUnit || this.isPlayer) && this.armed && (this.state === 'combat' || this.isPlayer);
    if (this.swing > 0) {
      this.swing -= dt;
      m.armR.rotation.x = -1.5 + this.swing * 4;
    } else if (aiming) {
      m.armR.rotation.x = -Math.PI / 2 + (this.isPlayer ? this.g.player.pitch * 0.8 : 0);
      m.armL.rotation.x = -Math.PI / 2.4;
    } else {
      m.armR.rotation.x = -sw * 0.8;
      m.armL.rotation.x = this.model.phone.visible ? -1.9 : sw * 0.8;
    }
    if (this.state === 'cower' || (this.state === 'hide' && this.crouch)) {
      m.armL.rotation.x = m.armR.rotation.x = -2.6;
    }
    m.body.position.y = this.crouch ? -0.45 : 0;
    m.legL.rotation.x += this.crouch ? -1.2 : 0;
    m.legR.rotation.x += this.crouch ? -1.2 : 0;
  }

  // ---- civilians ----------------------------------------------------------

  private stimuli() {
    // Nearest recent threat the civilian noticed.
    let best: { x: number; z: number; sev: number; kind: string; by: Ped | null } | null = null;
    let bestScore = 0;
    for (const e of this.g.stimuli) {
      const age = this.g.time - e.t;
      if (age > 6) continue;
      const d = dist(this.x, this.z, e.x, e.z);
      if (d > e.r) continue;
      const score = e.sev * (1 - d / e.r);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    // A drawn gun nearby is a threat too.
    const p = this.g.player;
    if (p.ped.alive && p.ped.armed && !p.ped.vehicle) {
      const d = dist(this.x, this.z, p.ped.x, p.ped.z);
      if (d < 18 && 0.5 > bestScore) best = { x: p.ped.x, z: p.ped.z, sev: 0.5, kind: 'weapon', by: p.ped };
    }
    return best;
  }

  private thinkCivilian() {
    const g = this.g, now = g.time;
    this.model.phone.visible = this.state === 'film' || this.state === 'call' || (this.role === 'business' && this.state === 'idle');
    const threat = this.stimuli();
    const panicky = this.psych.panic / 100;
    if (threat && this.state !== 'attack' && this.state !== 'confront') {
      this.fear = clamp(this.fear + threat.sev * (0.4 + panicky), 0, 1);
      this.threat = { x: threat.x, z: threat.z };
      this.alert = true;
      // Witnesses of a crime may phone it in.
      if (threat.kind !== 'weapon' && !this.witnessed && this.psych.courage > 30 && threat.by?.isPlayer) {
        this.witnessed = { crime: threat.kind, heat: 0, x: threat.x, z: threat.z };
        this.reportAt = now + rand(5, 10);
      }
      if (this.state !== 'flee' && this.state !== 'hide' && this.state !== 'film' && this.state !== 'cower' && this.state !== 'call') this.react(threat);
    } else this.fear = Math.max(0, this.fear - 0.02);

    if (this.witnessed && now > this.reportAt && this.state !== 'flee') {
      this.setState('call', 4);
      this.say('...הלו, משטרה? יש פה');
      g.police.civilianReport(this.witnessed.crime, this.witnessed.x, this.witnessed.z);
      this.witnessed = null;
      this.reportAt = Infinity;
    }

    if (this.stateUntil && now > this.stateUntil && this.state !== 'idle' && this.state !== 'walk') {
      this.crouch = false;
      this.state = 'walk';
      this.moveSpeed = 1.4;
      this.routineTarget();
    }
    switch (this.state) {
      case 'flee': {
        const t = this.threat ?? g.player.ped;
        const ax = this.x - t.x, az = this.z - t.z, d = Math.hypot(ax, az) || 1;
        this.tx = this.x + (ax / d) * 12 + rand(-3, 3);
        this.tz = this.z + (az / d) * 12 + rand(-3, 3);
        this.moveSpeed = 5.5 + panicky;
        if (chance(0.04)) this.say(pick(SCREAMS), 1.5);
        break;
      }
      case 'hide':
      case 'cower':
        if (dist(this.x, this.z, this.tx, this.tz) < 1) this.crouch = true;
        break;
      case 'film': {
        const p = g.player.ped;
        const d = dist(this.x, this.z, p.x, p.z);
        this.heading = Math.atan2(p.x - this.x, p.z - this.z);
        if (d < 12) {
          this.tx = this.x + (this.x - p.x) * 0.5;
          this.tz = this.z + (this.z - p.z) * 0.5;
        } else {
          this.tx = this.x;
          this.tz = this.z;
        }
        break;
      }
      case 'attack': {
        const p = g.player.ped;
        if (!p.alive || p.vehicle) {
          this.setState('walk');
          break;
        }
        this.tx = p.x;
        this.tz = p.z;
        this.moveSpeed = 5;
        if (dist(this.x, this.z, p.x, p.z) < 1.5 && now > this.peekUntil) {
          this.peekUntil = now + 0.9;
          this.swing = 0.3;
          p.damage(6, this, { dir: new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)), knockback: 1, melee: true });
          g.audio.punch();
        }
        break;
      }
      case 'confront': {
        const p = g.player.ped;
        const d = dist(this.x, this.z, p.x, p.z);
        this.tx = p.x;
        this.tz = p.z;
        this.moveSpeed = 2.2;
        if (d < 3) {
          this.tx = this.x;
          this.tz = this.z;
          this.say(pick(CURSES));
          if (this.psych.aggression > 75 && chance(0.15)) this.setState('attack', 10);
        }
        break;
      }
      case 'gather': {
        if (this.g.police.anyUnitNear(this.x, this.z, 25)) {
          this.setState('flee', 4);
          this.say('!משטרה, זזים');
        } else if (chance(0.03)) this.say(pick(GATHER));
        break;
      }
      case 'call':
        this.tx = this.x;
        this.tz = this.z;
        break;
      case 'idle':
      case 'walk':
        this.routine();
        break;
    }
  }

  private react(threat: { x: number; z: number; sev: number; kind: string; by: Ped | null }) {
    const c = this.psych.courage, a = this.psych.aggression, now = this.g.time;
    const p = this.g.player.ped;
    if (threat.kind === 'crash' && threat.by?.isPlayer && this.vehicleOwned) return; // handled by driver logic
    if (c < 40 || this.fear > 0.85) {
      this.setState('flee', rand(8, 15));
      this.say(pick(SCREAMS));
      this.g.audio.scream(this.x, this.z);
      if (this.dropItem) {
        this.dropItem = false;
        this.g.dropProp(this.x, this.z);
      }
      return;
    }
    if (a > 78 && c > 65 && threat.kind !== 'explosion' && !p.vehicle && dist(this.x, this.z, p.x, p.z) < 15) {
      this.setState('attack', 14);
      this.say('!אני אראה לך');
      return;
    }
    if (c > 62 && threat.kind !== 'explosion') {
      this.setState('film', rand(6, 14));
      this.model.phone.visible = true;
      this.g.bus.emit('filmed', { ped: this });
      return;
    }
    // Hide: behind the nearest vehicle, on the side away from the threat.
    let best: Vehicle | null = null, bd = 16;
    for (const v of this.g.vehicles) {
      if (v.isAir || v.isBoat) continue;
      const d = dist(this.x, this.z, v.x, v.z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (best) {
      const ax = best.x - threat.x, az = best.z - threat.z, d = Math.hypot(ax, az) || 1;
      this.tx = best.x + (ax / d) * (best.spec.w / 2 + 1);
      this.tz = best.z + (az / d) * (best.spec.w / 2 + 1);
      this.setState('hide', rand(8, 14));
    } else {
      this.tx = this.x;
      this.tz = this.z;
      this.setState('cower', rand(6, 10));
    }
    this.moveSpeed = 4.5;
    void now;
  }

  /** Daily routines: go to work in the morning, home in the evening. */
  private routine() {
    const hour = this.g.env.hour;
    if (this.leader) {
      // Monks walk in a column behind their leader.
      const l = this.leader;
      const off = (this.squad + 1) * 1.4;
      this.tx = l.x - Math.sin(l.heading) * off;
      this.tz = l.z - Math.cos(l.heading) * off;
      this.moveSpeed = l.alive ? 1.3 : 0;
      if (!l.alive || l.state === 'flee') this.leader = null;
      return;
    }
    switch (this.role) {
      case 'homeless':
        this.crouch = true;
        return;
      case 'worker': {
        const site = this.g.world.places.find((p) => p.id === 'build')!;
        if (hour > 6 && hour < 18) {
          if (dist(this.x, this.z, this.tx, this.tz) < 1 || chance(0.02)) {
            const [i, j] = [5, 1];
            this.tx = rand(blockMin(i) + 6, blockMax(i) - 6);
            this.tz = rand(blockMin(j) + 6, blockMax(j) - 6);
            const ok = this.g.world.collideCircle(this.tx, this.tz, 0.5, 1);
            this.tx = ok.x;
            this.tz = ok.z;
          }
          void site;
          return;
        }
        break;
      }
      case 'business':
        if (hour > 11 && hour < 15 && this.state === 'idle') return; // lunch at the restaurant
        break;
    }
    if (this.state !== 'walk') this.state = 'walk';
    this.moveSpeed = this.role === 'business' ? 1.6 : 1.35;
    if (dist(this.x, this.z, this.tx, this.tz) < 1.2) this.routineTarget();
  }

  routineTarget() {
    const r = this.route;
    // Occasionally cross the street to a neighbouring block.
    if (chance(0.12)) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => {
        const ni = r.i + di, nj = r.j + dj;
        return ni >= 0 && nj >= 0 && ni < GRID && nj < GRID && this.g.world.kinds[ni][nj] !== 'hill';
      });
      if (dirs.length) {
        const [di, dj] = pick(dirs);
        r.i += di;
        r.j += dj;
        // Find the point on the new block's ring closest to us.
        let bf = 0, bd = Infinity;
        for (let f = 0; f < 1; f += 0.02) {
          const p = this.g.world.sidewalkPoint(r.i, r.j, f);
          const d = dist(p.x, p.z, this.x, this.z);
          if (d < bd) {
            bd = d;
            bf = f;
          }
        }
        r.f = bf;
      }
    }
    r.f += r.dir * rand(0.04, 0.12);
    const p = this.g.world.sidewalkPoint(r.i, r.j, r.f);
    this.tx = p.x;
    this.tz = p.z;
  }

  // ---- combat AI -------------------------------------------------------------

  private viewRange() {
    return this.role === 'sniper' ? 260 : this.role === 'soldier' ? 70 : this.role === 'swat' ? 60 : 48;
  }

  /** Vision cone + line of sight (smoke blocks it, just like for the player). */
  canSee(tx: number, ty: number, tz: number) {
    const d = dist(this.x, this.z, tx, tz);
    if (d > this.viewRange()) return false;
    const ang = Math.abs(angleDiff(this.heading, Math.atan2(tx - this.x, tz - this.z)));
    if (d > 7 && ang > (this.awareness >= 1 ? 1.4 : 0.95)) return false;
    const hit = this.g.world.raycast(this.x, this.y + 1.6, this.z, tx, ty, tz, { smoke: true, now: this.g.time });
    return !hit;
  }

  private thinkCombat() {
    const g = this.g, pl = g.player.ped, now = g.time;
    const target = pl.vehicle ?? pl;
    const ty = (pl.vehicle ? pl.vehicle.y : pl.y) + 1;
    const wanted = g.police.stars;
    const sees = pl.alive && this.canSee(target.x, ty, target.z);
    const wasSeeing = this.seesPlayer;
    this.seesPlayer = sees;
    if (sees) {
      this.lastSeen = now;
      if (wanted > 0) {
        this.awareness = 1;
        g.police.spotted(this, !wasSeeing);
      } else if (this.team === 'police' && pl.armed && !pl.vehicle) {
        // A drawn weapon makes an officer suspicious; keep it out and it's a crime.
        this.awareness = Math.min(1.5, this.awareness + 0.12);
        if (this.awareness > 0.5 && this.awareness < 0.65) this.say('!הנח את הנשק');
        if (this.awareness >= 1.5) g.police.commitCrime('brandish', pl.x, pl.z, true);
      }
    } else if (wanted === 0) this.awareness = Math.max(0, this.awareness - 0.05);
    if (g.police.stars === 0) {
      if (this.state !== 'patrol' && this.state !== 'walk') this.setState('patrol');
      this.crouch = false;
      this.patrol();
      return;
    }
    this.alert = true;
    this.awareness = Math.max(this.awareness, sees ? 1 : 0.6);

    if (this.role === 'sniper') {
      this.state = 'combat';
      return;
    }

    // Officers at one star try to arrest a player on foot who isn't fighting back.
    const arrestable = wanted === 1 && this.role === 'cop' && !pl.vehicle && !g.police.playerHostile();
    if (arrestable && sees) {
      this.state = 'arrest';
      this.path = [];
      this.tx = pl.x;
      this.tz = pl.z;
      this.moveSpeed = 4.5;
      this.crouch = false;
      if (chance(0.1)) this.say(pick(['!משטרה! לא לזוז', '!ידיים למעלה', '!לשכב על הרצפה']));
      return;
    }
    if (sees) {
      this.state = 'combat';
      this.chooseCover();
      return;
    }
    // Lost sight: move to the last reported position (shared over the radio).
    this.state = now - g.police.lastKnownAt < 30 ? 'pursue' : 'search';
    this.crouch = false;
    const lk = g.police.lastKnown;
    const gx = this.state === 'pursue' ? lk.x : lk.x + rand(-25, 25);
    const gz = this.state === 'pursue' ? lk.z : lk.z + rand(-25, 25);
    if (this.flankSide && this.state === 'pursue') {
      // Flankers circle wide of the last known position.
      const ax = lk.x - this.x, az = lk.z - this.z, d = Math.hypot(ax, az) || 1;
      this.navigate(lk.x + (-az / d) * 16 * this.flankSide, lk.z + (ax / d) * 16 * this.flankSide);
    } else this.navigate(gx, gz);
    this.moveSpeed = 5;
  }

  private patrol() {
    this.moveSpeed = 1.5;
    if (dist(this.x, this.z, this.tx, this.tz) < 1.2) this.routineTarget();
  }

  /** Pick a covered spot: a building corner or the far side of a car, still with a view of the target. */
  private chooseCover() {
    const g = this.g, now = g.time, pl = g.player.ped;
    const target = pl.vehicle ?? pl;
    if (this.cover && now < this.coverUntil) {
      this.tx = this.cover.x;
      this.tz = this.cover.z;
      this.path = [];
      return;
    }
    const dToT = dist(this.x, this.z, target.x, target.z);
    let ideal = { x: this.x, z: this.z };
    if (this.flankSide) {
      // Flank: work round to the player's side.
      const ax = target.x - this.x, az = target.z - this.z, d = Math.hypot(ax, az) || 1;
      const sideX = (-az / d) * this.flankSide, sideZ = (ax / d) * this.flankSide;
      ideal = { x: target.x + sideX * 18 - (ax / d) * 8, z: target.z + sideZ * 18 - (az / d) * 8 };
    } else if (dToT > 30) {
      const ax = target.x - this.x, az = target.z - this.z, d = Math.hypot(ax, az) || 1;
      ideal = { x: this.x + (ax / d) * 12, z: this.z + (az / d) * 12 };
    }
    let best: { x: number; z: number } | null = null, bestScore = -Infinity;
    const consider = (cx: number, cz: number) => {
      const res = g.world.collideCircle(cx, cz, 0.5, 1);
      if (res.hit) return;
      const dt = dist(cx, cz, target.x, target.z);
      if (dt < 6 || dt > this.viewRange() * 0.85) return;
      let s = -dist(cx, cz, ideal.x, ideal.z) - dist(cx, cz, this.x, this.z) * 0.4;
      // Must be able to peek at the target from here.
      if (g.world.raycast(cx, 1.6, cz, target.x, 1, target.z, { smoke: true, now })) s -= 40;
      if (s > bestScore) {
        bestScore = s;
        best = { x: cx, z: cz };
      }
    };
    for (const b of g.world.boxesIn(this.x - 25, this.x + 25, this.z - 25, this.z + 25)) {
      if (b.kind === 'roof') continue;
      for (const [cx, cz, ox, oz] of [[b.minX, b.minZ, -1, -1], [b.maxX, b.minZ, 1, -1], [b.minX, b.maxZ, -1, 1], [b.maxX, b.maxZ, 1, 1]])
        consider(cx + ox * 0.9, cz + oz * 0.9);
    }
    for (const v of g.vehicles) {
      if (v.isAir || v === pl.vehicle || dist(v.x, v.z, this.x, this.z) > 25) continue;
      const ax = v.x - target.x, az = v.z - target.z, d = Math.hypot(ax, az) || 1;
      consider(v.x + (ax / d) * (v.spec.w / 2 + 0.8), v.z + (az / d) * (v.spec.w / 2 + 0.8));
    }
    this.cover = best ?? ideal;
    this.coverUntil = now + rand(4, 7);
    this.tx = this.cover.x;
    this.tz = this.cover.z;
    this.path = [];
    this.moveSpeed = 5;
  }

  /** Per-frame part of combat: aiming, peeking and shooting. */
  private combatFrame(dt: number) {
    const g = this.g, now = g.time, pl = g.player.ped;
    const target = pl.vehicle ?? pl;
    if (!pl.alive || !this.weapon) return;
    if (this.state === 'arrest') {
      this.heading += angleDiff(this.heading, Math.atan2(pl.x - this.x, pl.z - this.z)) * Math.min(1, dt * 6);
      if (dist(this.x, this.z, pl.x, pl.z) < 1.8) {
        this.tx = this.x;
        this.tz = this.z;
        this.arrestT += dt;
        if (this.arrestT > 1.6) g.busted();
      } else this.arrestT = Math.max(0, this.arrestT - dt);
      if (!g.police.playerHostile()) return;
    }
    if (this.state !== 'combat' || !this.seesPlayer) {
      this.weapon.spin = Math.max(0, this.weapon.spin - dt);
      return;
    }
    this.heading += angleDiff(this.heading, Math.atan2(target.x - this.x, target.z - this.z)) * Math.min(1, dt * 7);
    const atCover = this.cover && dist(this.x, this.z, this.cover.x, this.cover.z) < 1.2;
    // Peek cycle: hide crouched, then pop up and fire a burst.
    if (atCover && this.role !== 'sniper') {
      if (now > this.peekUntil) {
        this.peek = this.peek ? 0 : 1;
        this.peekUntil = now + (this.peek ? rand(1.2, 2.2) : rand(1, 2.4));
        if (this.peek) this.burstLeft = randInt(3, 8);
      }
      this.crouch = !this.peek;
      if (!this.peek) return;
    } else this.crouch = false;

    // Grenades: SWAT throw flashbangs, soldiers throw smoke before advancing.
    const d = dist(this.x, this.z, target.x, target.z);
    if (this.role === 'swat' && g.police.stars >= 3 && d < 22 && d > 6 && g.police.grenadeReady('flash')) {
      this.say('!רימון הלם');
      this.throwGrenade('flash', target.x, target.z);
      return;
    }
    if (this.role === 'soldier' && g.police.stars >= 4 && d > 20 && d < 45 && g.police.grenadeReady('smoke')) {
      this.say('!עשן, להתקדם');
      this.throwGrenade('smoke', (this.x + target.x) / 2, (this.z + target.z) / 2);
      return;
    }

    // Snipers paint the target with a laser before firing.
    if (this.role === 'sniper') {
      if (this.laserUntil === 0) this.laserUntil = now + 1.2;
      g.hud.laser(this, target);
      if (now < this.laserUntil) return;
      this.laserUntil = 0;
    }
    const ws = this.weapon;
    if (ws.spec.spinUp) ws.spin = Math.min(ws.spec.spinUp, ws.spin + dt);
    if (ws.ammo <= 0) {
      ws.reserve = 999;
      g.weapons.reload(ws);
      return;
    }
    if (now < ws.nextShot) return;
    if (!ws.spec.auto) ws.nextShot = now + rand(0.35, 0.8);
    else if (this.burstLeft-- <= 0) {
      ws.nextShot = now + rand(0.5, 1.1);
      this.burstLeft = randInt(3, 7);
      return;
    }
    const origin = new THREE.Vector3(this.x + Math.sin(this.heading) * 0.4, this.y + (this.crouch ? 1 : 1.45), this.z + Math.cos(this.heading) * 0.4);
    // Aim: one-star cops go for the legs; moving and distant targets are harder to hit.
    const legShot = g.police.stars <= 1 && this.team === 'police';
    const aimY = pl.vehicle ? pl.vehicle.y + 0.9 : pl.y + (legShot ? 0.5 : pl.crouch ? 0.8 : 1.25);
    const dir = new THREE.Vector3(target.x - origin.x, aimY - origin.y, target.z - origin.z).normalize();
    const moving = Math.hypot(pl.vehicle?.vx ?? g.player.vx, pl.vehicle?.vz ?? g.player.vz);
    const base = this.role === 'sniper' ? 0.006 : this.role === 'cop' ? 0.05 : 0.035;
    const spread = ((base + d * 0.0009 + moving * 0.004) / this.accuracy) * g.difficultyAim;
    g.weapons.fire(this, ws, origin, dir, spread / Math.max(0.002, ws.spec.spread));
  }

  private throwGrenade(kind: 'flash' | 'smoke', tx: number, tz: number) {
    const o = new THREE.Vector3(this.x, this.y + 1.6, this.z);
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    const t = clamp(d / 14, 0.6, 1.8);
    const vel = new THREE.Vector3(dx / t, 4.9 * t, dz / t);
    this.swing = 0.4;
    this.g.weapons.launch(kind, o, vel, this, this.team, 0, 0);
  }

  /** Grid A* over road intersections, so units find their way round blocks. */
  navigate(gx: number, gz: number) {
    const g = this.g, now = g.time;
    this.tx = gx;
    this.tz = gz;
    if (now - this.pathAt < 1.5 && this.path.length) return;
    this.pathAt = now;
    this.path = [];
    if (!g.world.raycast(this.x, 1, this.z, gx, 1, gz)) return;
    const start = nearestNode(this.x, this.z), goal = nearestNode(gx, gz);
    const key = (a: number, b: number) => a * 100 + b;
    const open: [number, number][] = [start];
    const came = new Map<number, number>();
    const cost = new Map<number, number>([[key(...start), 0]]);
    let found = false;
    while (open.length) {
      open.sort((a, b) => (cost.get(key(...a))! + Math.abs(a[0] - goal[0]) + Math.abs(a[1] - goal[1])) - (cost.get(key(...b))! + Math.abs(b[0] - goal[0]) + Math.abs(b[1] - goal[1])));
      const cur = open.shift()!;
      if (cur[0] === goal[0] && cur[1] === goal[1]) {
        found = true;
        break;
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n: [number, number] = [cur[0] + dx, cur[1] + dz];
        if (n[0] < 0 || n[1] < 0 || n[0] > GRID || n[1] > GRID) continue;
        const c = cost.get(key(...cur))! + 1;
        if (c < (cost.get(key(...n)) ?? Infinity)) {
          cost.set(key(...n), c);
          came.set(key(...n), key(...cur));
          open.push(n);
        }
      }
    }
    if (!found) return;
    const nodes: { x: number; z: number }[] = [];
    let k: number | undefined = key(...goal);
    while (k !== undefined) {
      nodes.unshift({ x: roadLine(Math.floor(k / 100)), z: roadLine(k % 100) });
      k = came.get(k);
    }
    // Leave alleys via the nearest road first.
    const nr = nearestRoad(this.x, this.z);
    if (nr.dx > ROAD / 2 && nr.dz > ROAD / 2) nodes.unshift(nr.dx < nr.dz ? { x: roadLine(nr.kx), z: this.z } : { x: this.x, z: roadLine(nr.kz) });
    this.path = nodes;
  }
}

function nearestNode(x: number, z: number): [number, number] {
  return [clamp(Math.round((x + HALF) / CELL), 0, GRID), clamp(Math.round((z + HALF) / CELL), 0, GRID)];
}

/** Spawns and despawns civilians around the player according to the hour. */
export class Population {
  constructor(private g: Game) {}

  targetCount() {
    const h = this.g.env.hour;
    const rush = (h > 7 && h < 9.5) || (h > 16.5 && h < 19) ? 1.25 : 1;
    const night = h < 5.5 || h > 22.5 ? 0.35 : h < 7 || h > 20.5 ? 0.6 : 1;
    return Math.round((this.g.quality === 'high' ? 70 : 42) * rush * night * (1 - 0.35 * this.g.env.wetness));
  }

  update() {
    const g = this.g, pl = g.player.ped;
    const civs = g.peds.filter((p) => p.team === 'civ');
    // Despawn far away (and long-dead) people.
    for (const p of civs) {
      const d = dist(p.x, p.z, pl.x, pl.z);
      if ((d > 190 && !p.vehicle && !p.persistent) || (!p.alive && g.time - p.deadAt > 50 && d > 40)) g.removePed(p);
    }
    const alive = civs.filter((p) => p.alive && !p.vehicle).length;
    const want = this.targetCount();
    for (let n = alive; n < want && n < alive + 4; n++) this.spawnCivilian();
  }

  spawnCivilian(near = true) {
    const g = this.g, pl = g.player.ped;
    const pt = g.world.randomSidewalk(near ? pl : undefined, 150);
    if (near && dist(pt.x, pt.z, pl.x, pl.z) < 45) return;
    const h = g.env.hour;
    let role: Role = 'walker';
    const r = Math.random();
    const blk = blockIndexAt(pt.x, pt.z);
    const kind = blk ? g.world.kinds[blk[0]][blk[1]] : 'mid';
    if (kind === 'downtown' && r < 0.35 && h > 7 && h < 20) role = 'business';
    else if (r < 0.06) role = 'homeless';
    else if (r < 0.1 && h > 7 && h < 18) {
      this.spawnMonks(pt);
      return;
    }
    const p = new Ped(g, role, 'civ', pt.x, pt.z);
    p.route.i = pt.i;
    p.route.j = pt.j;
    p.homeBlock = [pt.i, pt.j];
    p.routineTarget();
    g.peds.push(p);
    return p;
  }

  private spawnMonks(pt: { x: number; z: number; i: number; j: number }) {
    const lead = new Ped(this.g, 'monk', 'civ', pt.x, pt.z);
    lead.route.i = pt.i;
    lead.route.j = pt.j;
    lead.routineTarget();
    lead.psych.aggression = 1;
    this.g.peds.push(lead);
    for (let n = 0; n < 3; n++) {
      const m = new Ped(this.g, 'monk', 'civ', pt.x + rand(-1, 1), pt.z + rand(-1, 1));
      m.leader = lead;
      m.squad = n;
      m.psych.aggression = 1;
      this.g.peds.push(m);
    }
  }

  /** Fixed characters: workers on the building site and the homeless by the tunnel. */
  spawnResidents() {
    const g = this.g;
    for (let n = 0; n < 6; n++) {
      const p = new Ped(g, 'worker', 'civ', rand(blockMin(5) + 6, blockMax(5) - 6), rand(blockMin(1) + 4, blockMin(1) + 8));
      p.route = { i: 5, j: 1, f: Math.random(), dir: 1 };
      p.persistent = true;
      g.peds.push(p);
    }
    for (const z of [roadLine(2) + ROAD / 2 + 2, roadLine(3) - ROAD / 2 - 2]) {
      const p = new Ped(g, 'homeless', 'civ', roadLine(4) + ROAD / 2 - 1.2, z);
      p.persistent = true;
      g.peds.push(p);
    }
  }
}

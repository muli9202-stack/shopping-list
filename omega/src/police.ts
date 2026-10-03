import * as THREE from 'three';
import type { Game } from './game';
import { Ped } from './actors';
import { Vehicle, specById } from './vehicles';
import { chance, clamp, dist, pick, rand } from './util';
import { CELL, GRID, HALF, inTunnel, nearestRoad, roadLine, streetName } from './world';

// ---------------------------------------------------------------------------
// Wanted system. Crimes add "heat" only when someone saw or heard them; heat
// maps to stars, and stars decide what the dispatcher sends:
//   1 patrol car, arrest attempt, leg shots only if attacked
//   2 three cars, drive-by fire, roadblocks
//   3 SWAT van with flashbangs, rooftop snipers, helicopter with searchlight
//   4 military trucks and APCs, flanking soldiers with smoke
//   5 martial law: tanks shelling buildings, bombing runs, troops dropped on roofs
// Lose them by breaking line of sight and leaving the search area.
// ---------------------------------------------------------------------------

export type Crime = 'carjack' | 'theft' | 'assault' | 'hitPed' | 'shooting' | 'brandish' | 'murder' | 'assaultCop' | 'killCop' | 'explosion' | 'copCar' | 'killSoldier' | 'military';

const HEAT: Record<Crime, number> = { theft: 6, carjack: 12, assault: 10, hitPed: 10, brandish: 10, shooting: 22, murder: 26, assaultCop: 32, explosion: 40, killCop: 45, copCar: 45, killSoldier: 60, military: 80 };
const CRIME_NAME: Record<Crime, string> = { theft: 'גניבת רכב', carjack: 'חטיפת רכב', assault: 'תקיפה', hitPed: 'פגע וברח', brandish: 'נשיאת נשק בפומבי', shooting: 'ירי', murder: 'רצח', assaultCop: 'תקיפת שוטר', explosion: 'פיצוץ', killCop: 'הרג שוטר', copCar: 'השמדת ניידת', killSoldier: 'הרג חייל', military: 'השמדת כלי צבאי' };
const STAR_HEAT = [10, 30, 70, 150, 300];

interface Crew {
  v: Vehicle;
  crew: Ped[];
  kind: 'car' | 'swat' | 'truck' | 'apc' | 'tank' | 'heli' | 'jet' | 'dropship' | 'patrol';
  path: { x: number; z: number }[];
  pathAt: number;
  unloaded: boolean;
  nextShot: number;
  orbit: number;
  until?: number;
  dropDone?: boolean;
  target?: { x: number; z: number };
  bombs?: number;
}

export class Police {
  heat = 0;
  stars = 0;
  lastKnown = { x: 0, z: 0 };
  lastKnownAt = -99;
  seenNow = false;
  evade = 0;
  units: Ped[] = [];
  crews: Crew[] = [];
  private hostileAt = -99;
  private grenadeCd = { flash: 0, smoke: 0 };
  private nextRadio = 0;
  private unitNo = 10;
  private nextRoadblock = 0;
  private nextJet = 0;
  private nextDrop = 0;
  private dispatchAt = 0;
  private squad = 0;
  spot!: THREE.SpotLight;
  private spotCone!: THREE.Mesh;
  maxStars = 0;

  constructor(private g: Game) {
    this.spot = new THREE.SpotLight(0xffffff, 0, 120, 0.22, 0.5, 1);
    g.scene.add(this.spot, this.spot.target);
    this.spotCone = new THREE.Mesh(new THREE.ConeGeometry(5, 45, 16, 1, true).translate(0, -22.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffee, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
    this.spotCone.visible = false;
    g.scene.add(this.spotCone);
    g.bus.on('death', ({ ped, by }) => {
      if (!by?.isPlayer) {
        if (ped.isArmedUnit) this.units = this.units.filter((u) => u !== ped);
        return;
      }
      if (ped.team === 'police') this.commitCrime('killCop', ped.x, ped.z);
      else if (ped.team === 'military') this.commitCrime('killSoldier', ped.x, ped.z);
      else this.commitCrime('murder', ped.x, ped.z);
      if (ped.isArmedUnit) this.units = this.units.filter((u) => u !== ped);
    });
    g.bus.on('assault', ({ x, z, victim }) => {
      if (victim.isArmedUnit) {
        this.hostileAt = g.time;
        this.commitCrime('assaultCop', x, z);
      } else this.commitCrime('assault', x, z);
    });
    g.bus.on('shot', ({ x, z, by, loud }) => {
      if (!by.isPlayer) return;
      if (this.anyUnitNear(x, z, 45)) this.hostileAt = g.time;
      this.commitCrime('shooting', x, z, false, loud ? 70 : 12);
    });
    g.bus.on('vehicleDestroyed', ({ v, by }) => {
      if (!by?.isPlayer) return;
      if (v.role === 'police' || v.role === 'roadblock') this.commitCrime('copCar', v.x, v.z);
      else if (v.role === 'military' || v.role === 'air-support') this.commitCrime('military', v.x, v.z);
      else this.commitCrime('explosion', v.x, v.z);
    });
  }

  starsFor(heat: number) {
    let s = 0;
    for (const h of STAR_HEAT) if (heat >= h) s++;
    return s;
  }

  playerHostile() {
    return this.stars >= 2 || this.g.time - this.hostileAt < 20;
  }

  anyUnitNear(x: number, z: number, r: number) {
    return this.units.some((u) => u.alive && dist(u.x, u.z, x, z) < r) || this.crews.some((c) => !c.v.destroyed && dist(c.v.x, c.v.z, x, z) < r);
  }

  grenadeReady(kind: 'flash' | 'smoke') {
    if (this.g.time < this.grenadeCd[kind]) return false;
    this.grenadeCd[kind] = this.g.time + (kind === 'flash' ? 14 : 18);
    return true;
  }

  /** Can any police/military unit see or hear this spot? */
  private witnessed(x: number, z: number, hearing: number) {
    for (const u of this.units) {
      if (!u.alive) continue;
      const d = dist(u.x, u.z, x, z);
      if (d < hearing || (d < 50 && u.canSee(x, 1, z))) return true;
    }
    for (const c of this.crews) {
      if (c.v.destroyed) continue;
      const d = dist(c.v.x, c.v.z, x, z);
      if (d < Math.max(hearing, 35) && !this.g.world.raycast(c.v.x, c.v.y + 1.5, c.v.z, x, 1, z)) return true;
    }
    return false;
  }

  commitCrime(c: Crime, x: number, z: number, seen = false, hearing = 8) {
    if (this.g.cheats.noPolice) return;
    const wit = seen || this.stars > 0 || this.witnessed(x, z, hearing);
    if (!wit) return;
    this.addHeat(c, x, z);
  }

  private lastReport = { x: 0, z: 0, t: -99 };

  civilianReport(c: string, x: number, z: number) {
    const crime = (c in HEAT ? c : c === 'weapon' ? 'brandish' : c === 'explosion' ? 'explosion' : 'shooting') as Crime;
    // Many witnesses phoning in the same incident count once.
    const r = this.lastReport;
    if (this.g.time - r.t < 30 && dist(r.x, r.z, x, z) < 50) return;
    this.lastReport = { x, z, t: this.g.time };
    if (this.stars === 0) this.radio(`מוקד: אזרח מדווח על ${CRIME_NAME[crime]} ב${streetName(x, z)}. ניידות קרובות, לבדוק.`);
    this.addHeat(crime, x, z, true);
  }

  private addHeat(c: Crime, x: number, z: number, report = false) {
    const before = this.stars;
    this.heat = Math.min(600, this.heat + HEAT[c] * (report ? 0.7 : 1));
    this.stars = Math.max(this.stars, this.starsFor(this.heat));
    this.maxStars = Math.max(this.maxStars, this.stars);
    if (before === 0 && this.stars > 0) {
      this.lastKnown = { x, z };
      this.lastKnownAt = this.g.time;
      this.evade = 0;
    }
    if (this.stars > before) this.onEscalate(before);
    this.g.news.crime(c, x, z, this.stars);
  }

  private onEscalate(before: number) {
    const g = this.g;
    g.audio.wantedUp(this.stars);
    g.hud.starPulse();
    const msg = [
      '',
      'מוקד: כל הניידות, חשוד בעבירה. יחידת סיור בדרך.',
      'מוקד: החשוד מתנגד למעצר. אישור לירי. תגבור של שלוש ניידות.',
      'מוקד: שוטרים נפגעו! מזניקים יחידת מיוחדת, צלפים ומסוק.',
      'מוקד: מצב חירום. המשמר הלאומי הוזעק לעיר.',
      'מוקד: הוכרז מצב צבאי. כל היציאות מהעיר חסומות.',
    ][this.stars];
    this.radio(msg);
    if (this.stars >= 5) g.hud.toast('מצב צבאי: כל היציאות מהעיר חסומות', 4);
    void before;
    this.dispatchAt = 0;
  }

  radio(text: string) {
    this.g.hud.ticker(text, 'police');
    this.g.audio.radioBlip();
  }

  /** A unit sees the player: update the shared last-known position and maybe call it in. */
  spotted(u: Ped, newly: boolean) {
    const g = this.g, pl = g.player.ped;
    this.lastKnown = { x: pl.x, z: pl.z };
    this.lastKnownAt = g.time;
    this.seenNow = true;
    if (newly && g.time > this.nextRadio) {
      this.nextRadio = g.time + 6;
      const vx = pl.vehicle ? pl.vehicle.vx : g.player.vx, vz = pl.vehicle ? pl.vehicle.vz : g.player.vz;
      const moving = Math.hypot(vx, vz) > 1.5;
      const dir = Math.abs(vx) > Math.abs(vz) ? (vx > 0 ? 'מזרחה' : 'מערבה') : vz > 0 ? 'דרומה' : 'צפונה';
      const how = pl.vehicle ? (moving ? `נוסע ${dir}` : 'ברכב עומד') : moving ? `רץ ${dir}` : 'רגלי';
      const who = u.role === 'soldier' ? 'כוח' : u.role === 'sniper' ? 'צלף' : 'יחידה';
      this.radio(`${who} ${this.unitNo++ % 40 + 1}: החשוד נראה ב${streetName(pl.x, pl.z)}, ${how}!`);
    }
  }

  // ---- per frame --------------------------------------------------------------

  update(dt: number) {
    const g = this.g, pl = g.player.ped, now = g.time;
    // Air support and vehicle crews also spot the player.
    for (const c of this.crews) {
      if (c.v.destroyed || this.stars === 0) continue;
      const d = dist(c.v.x, c.v.z, pl.x, pl.z);
      const range = c.kind === 'heli' ? 90 : 45;
      if (inTunnel(pl.x, pl.z) && c.kind === 'heli') continue; // the tunnel hides you from the helicopter
      if (d < range && !g.world.raycast(c.v.x, c.v.y + 1.8, c.v.z, pl.x, pl.y + 1, pl.z, { smoke: true, now })) {
        this.lastKnown = { x: pl.x, z: pl.z };
        this.lastKnownAt = now;
        this.seenNow = true;
      }
    }
    if (this.stars > 0) {
      const seen = now - this.lastKnownAt < 0.6;
      const searchR = this.searchRadius();
      const outside = dist(pl.x, pl.z, this.lastKnown.x, this.lastKnown.z) > searchR;
      if (!seen && outside) this.evade += dt;
      else if (seen) this.evade = 0;
      const need = 6 + this.stars * 4;
      if (this.evade > need) this.clear('evaded');
      if (pl.alive && now > this.dispatchAt) {
        this.dispatchAt = now + 2.5;
        this.dispatch();
      }
      if (this.stars >= 2 && now > this.nextRoadblock) {
        this.nextRoadblock = now + rand(22, 34);
        this.roadblock();
      }
      if (this.stars >= 5 && now > this.nextJet) {
        this.nextJet = now + rand(18, 26);
        this.bombingRun();
      }
      if (this.stars >= 5 && now > this.nextDrop) {
        this.nextDrop = now + rand(28, 40);
        this.troopDrop();
      }
      if (this.stars >= 5) {
        const b = g.bounds;
        if (pl.x < b.minX + 40 || pl.x > b.maxX - 40 || pl.z < b.minZ + 30 || pl.z > b.maxZ - 30) g.hud.toast('היציאה מהעיר חסומה!', 1);
      }
    } else this.patrols();
    this.seenNow = false;
    for (const c of this.crews) this.driveCrew(c, dt);
    // Clean up
    this.crews = this.crews.filter((c) => {
      const d = dist(c.v.x, c.v.z, pl.x, pl.z);
      const gone = (c.until !== undefined && now > c.until) || d > 330 || (c.v.destroyed && now - c.v.lastSeen > 40) || (this.stars === 0 && d > 140 && c.kind !== 'patrol');
      if (gone) {
        for (const p of c.crew) if (p.vehicle === c.v) g.removePed(p);
        if (c.v.driver?.isPlayer) return true;
        g.removeVehicle(c.v);
      }
      if (c.v.destroyed && !c.v.lastSeen) c.v.lastSeen = now;
      return !gone;
    });
    for (const u of this.units) {
      if (dist(u.x, u.z, pl.x, pl.z) > (this.stars === 0 ? 150 : 300) && u.role !== 'cop') g.removePed(u);
      else if (this.stars === 0 && dist(u.x, u.z, pl.x, pl.z) > 160) g.removePed(u);
    }
    this.units = this.units.filter((u) => g.peds.includes(u));
    this.updateSpotlight();
  }

  searchRadius() {
    return 35 + this.stars * 22;
  }

  clear(why: 'evaded' | 'busted' | 'wasted' | 'cheat') {
    if (this.stars > 0 && why === 'evaded') {
      this.radio('מוקד: איבדנו את החשוד. כל היחידות, חזרה לסיור.');
      this.g.hud.toast('התחמקת מהמשטרה', 2.5);
      this.g.audio.evaded();
    }
    this.stars = 0;
    this.heat = 0;
    this.evade = 0;
    this.hostileAt = -99;
    for (const c of this.crews) {
      c.v.sirenOn = false;
      if (c.kind === 'car') {
        c.kind = 'patrol';
        c.v.snapToGrid();
      }
    }
    for (const u of this.units) {
      u.awareness = 0;
      u.state = 'patrol';
      u.crouch = false;
    }
  }

  // ---- dispatch ---------------------------------------------------------------

  private count(kind: Crew['kind']) {
    return this.crews.filter((c) => c.kind === kind && !c.v.destroyed).length;
  }

  private dispatch() {
    const s = this.stars;
    const footCap = this.g.quality === 'high' ? 26 : 18;
    if (this.units.length > footCap) return;
    const want: [Crew['kind'], number][] = [
      ['car', [0, 1, 3, 3, 3, 3][s]],
      ['swat', s >= 3 ? (s >= 4 ? 2 : 1) : 0],
      ['heli', s >= 3 ? 1 : 0],
      ['truck', s >= 4 ? 2 : 0],
      ['apc', s >= 4 ? 1 : 0],
      ['tank', s >= 5 ? 2 : 0],
    ];
    for (const [kind, n] of want) if (this.count(kind) < n) {
      this.spawnCrew(kind);
      return; // one per tick keeps arrivals staggered
    }
    if (s >= 3 && this.units.filter((u) => u.role === 'sniper' && u.alive).length < 2) this.spawnSniper();
  }

  private crewRole(kind: Crew['kind']): [string, string, number, string[]] {
    switch (kind) {
      case 'swat':
        return ['swatvan', 'swat', 4, ['mp5', 'm4', 'pump', 'm4']];
      case 'truck':
        return ['mtruck', 'soldier', 4, ['m4', 'ak', 'm4', 'ak']];
      case 'apc':
        return ['apc', 'soldier', 2, ['m4', 'm4']];
      case 'tank':
        return ['tank', 'soldier', 0, []];
      case 'heli':
        return ['polheli', 'cop', 1, ['mp5']];
      default:
        return ['police', 'cop', 2, this.stars >= 2 ? ['glock', 'pump'] : ['glock', 'glock']];
    }
  }

  spawnCrew(kind: Crew['kind'], at?: { x: number; z: number; alongX: boolean }) {
    const g = this.g, pl = g.player.ped;
    const pt = at ?? g.world.randomRoadPointNear(pl.x, pl.z, 110, 170);
    if (!pt) return null;
    const [vid, role, n, guns] = this.crewRole(kind);
    const spec = specById(vid);
    const variant = kind === 'car' || kind === 'patrol' ? 'police' : kind === 'swat' ? 'swat' : kind === 'heli' ? 'police' : '';
    const heading = Math.atan2(pl.x - pt.x, pl.z - pt.z);
    const v = new Vehicle(g, spec, pt.x, pt.z, pt.alongX ? (Math.sin(heading) > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.cos(heading) > 0 ? 0 : Math.PI, kind === 'truck' || kind === 'apc' || kind === 'tank' ? 'military' : 'police', variant);
    if (kind === 'heli') {
      let roofs = 0;
      for (const b of g.world.boxesIn(pt.x - 30, pt.x + 30, pt.z - 30, pt.z + 30)) roofs = Math.max(roofs, b.h);
      v.y = Math.max(50, roofs + 20);
      v.altitude = 0;
    }
    v.sirenOn = kind !== 'patrol';
    g.vehicles.push(v);
    const team = role === 'soldier' ? 'military' : 'police';
    const crew: Ped[] = [];
    for (let i = 0; i < n; i++) {
      const p = new Ped(g, role as Ped['role'], team, v.x, v.z);
      p.give(guns[i % guns.length], 200);
      p.equip(0);
      p.vehicle = v;
      p.squad = this.squad;
      p.flankSide = role !== 'cop' ? [0, 1, 0, -1][i % 4] : 0;
      p.accuracy = role === 'soldier' ? 1.3 : role === 'swat' ? 1.15 : 1;
      if (i === 0) v.driver = p;
      else v.passengers.push(p);
      crew.push(p);
      g.peds.push(p);
    }
    this.squad++;
    const c: Crew = { v, crew, kind, path: [], pathAt: -99, unloaded: false, nextShot: 0, orbit: Math.random() * 6 };
    this.crews.push(c);
    if (kind === 'heli') this.radio('מסוק משטרה באוויר, מפעיל זרקור.');
    if (kind === 'tank') this.radio('טנק נכנס לעיר. אישור לירי לתוך מבנים.');
    return c;
  }

  private spawnSniper() {
    const g = this.g, pl = g.player.ped;
    const roofs = g.world.boxesIn(pl.x - 90, pl.x + 90, pl.z - 90, pl.z + 90).filter((b) => b.kind === 'building' && b.h > 12 && b.h < 70 && dist((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, pl.x, pl.z) > 35);
    if (!roofs.length) return;
    const b = pick(roofs);
    const cx = clamp(pl.x, b.minX + 1, b.maxX - 1), cz = clamp(pl.z, b.minZ + 1, b.maxZ - 1);
    const p = new Ped(g, 'sniper', this.stars >= 4 ? 'military' : 'police', cx, cz);
    p.y = b.h;
    p.give(this.stars >= 5 ? 'barrett' : 'svd', 100);
    p.equip(0);
    p.accuracy = 1;
    p.tx = cx;
    p.tz = cz;
    g.peds.push(p);
    this.units.push(p);
    this.radio(`צלף ממוקם על גג ב${streetName(cx, cz)}.`);
  }

  private roadblock() {
    const g = this.g, pl = g.player.ped;
    const vx = pl.vehicle ? pl.vehicle.vx : g.player.vx, vz = pl.vehicle ? pl.vehicle.vz : g.player.vz;
    const sp = Math.hypot(vx, vz);
    if (sp < 4) return;
    // Ahead of the player, at the next-but-one intersection on their road.
    const ax = pl.x + (vx / sp) * 130, az = pl.z + (vz / sp) * 130;
    const kx = clamp(Math.round((ax + HALF) / CELL), 0, GRID), kz = clamp(Math.round((az + HALF) / CELL), 0, GRID);
    const along = Math.abs(vx) > Math.abs(vz);
    const cx = along ? roadLine(kx) : pl.x, cz = along ? pl.z : roadLine(kz);
    const nr = nearestRoad(cx, cz);
    const bx = along ? roadLine(kx) : roadLine(nr.kx), bz = along ? roadLine(nr.kz) : roadLine(kz);
    if (dist(bx, bz, pl.x, pl.z) < 60) return;
    const heavy = this.stars >= 4;
    for (const off of [-4.5, 4.5]) {
      const v = new Vehicle(g, specById(heavy ? 'mtruck' : 'police'), bx + (along ? 0 : off), bz + (along ? off : 0), along ? 0 : Math.PI / 2, 'roadblock', heavy ? '' : 'police');
      v.sirenOn = true;
      g.vehicles.push(v);
      const crew: Ped[] = [];
      for (let i = 0; i < 2; i++) {
        const p = new Ped(g, heavy ? 'soldier' : 'cop', heavy ? 'military' : 'police', v.x - (along ? 3 : 0) * Math.sign(vx), v.z - (along ? 0 : 3) * Math.sign(vz));
        p.give(heavy ? 'm4' : 'pump', 200);
        p.equip(0);
        g.peds.push(p);
        this.units.push(p);
        crew.push(p);
      }
      this.crews.push({ v, crew, kind: 'car', path: [], pathAt: -99, unloaded: true, nextShot: 0, orbit: 0, until: g.time + 70 });
    }
    this.radio(`מחסום כביש הוצב ב${streetName(bx, bz)}.`);
  }

  private bombingRun() {
    const g = this.g, pl = g.player.ped;
    const a = Math.random() * Math.PI * 2;
    const sx = pl.x - Math.sin(a) * 300, sz = pl.z - Math.cos(a) * 300;
    const v = new Vehicle(g, specById('jet'), sx, sz, a, 'air-support');
    v.y = 70;
    g.vehicles.push(v);
    this.crews.push({ v, crew: [], kind: 'jet', path: [], pathAt: 0, unloaded: true, nextShot: 0, orbit: 0, until: g.time + 9, target: { x: pl.x, z: pl.z }, bombs: 6 });
    g.hud.toast('!מטוס קרב בגיחת הפצצה', 2.5);
    g.audio.jet();
  }

  private troopDrop() {
    const g = this.g, pl = g.player.ped;
    const roofs = g.world.boxesIn(pl.x - 70, pl.x + 70, pl.z - 70, pl.z + 70).filter((b) => b.kind === 'building' && b.h < 50 && b.maxX - b.minX > 10);
    if (!roofs.length) return;
    const b = pick(roofs);
    const c = this.spawnCrew('heli');
    if (!c) return;
    c.kind = 'dropship';
    c.v.sirenOn = false;
    c.target = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
    c.until = g.time + 60;
    this.radio('מסוק סער מנחית כוחות מיוחדים על הגגות.');
  }

  /** Zero stars: keep a couple of patrol cars and foot officers about. */
  private patrols() {
    const g = this.g, pl = g.player.ped;
    if (this.count('patrol') < 2 && chance(0.02)) {
      const c = this.spawnCrew('patrol');
      if (c) {
        c.v.sirenOn = false;
        c.v.snapToGrid();
      }
    }
    if (this.units.filter((u) => u.role === 'cop').length < 3 && chance(0.02)) {
      const pt = g.world.randomSidewalk(pl, 120);
      if (dist(pt.x, pt.z, pl.x, pl.z) < 50) return;
      const p = new Ped(g, 'cop', 'police', pt.x, pt.z);
      p.route.i = pt.i;
      p.route.j = pt.j;
      p.give('glock', 60);
      p.equip(0);
      p.state = 'patrol';
      p.routineTarget();
      g.peds.push(p);
      this.units.push(p);
    }
  }

  // ---- vehicle AI -------------------------------------------------------------

  private unload(c: Crew) {
    if (c.unloaded) return;
    c.unloaded = true;
    const v = c.v;
    for (const [i, p] of c.crew.entries()) {
      if (!p.alive || p.vehicle !== v) continue;
      p.vehicle = null;
      const side = i % 2 ? 1 : -1;
      p.x = v.x + Math.cos(v.heading) * side * (v.spec.w / 2 + 0.8);
      p.z = v.z - Math.sin(v.heading) * side * (v.spec.w / 2 + 0.8);
      p.y = c.kind === 'dropship' ? this.g.world.groundHeight(p.x, p.z) : 0;
      p.tx = p.x;
      p.tz = p.z;
      this.units.push(p);
    }
    v.driver = null;
    v.passengers = [];
  }

  private driveCrew(c: Crew, dt: number) {
    const g = this.g, v = c.v, pl = g.player.ped, now = g.time;
    if (v.destroyed) return;
    if (c.kind === 'patrol' || (this.stars === 0 && c.kind === 'car')) {
      if (v.driver?.alive) v.cruise(dt);
      else {
        v.throttle = 0;
        v.handbrake = true;
      }
      return;
    }
    const target = pl.vehicle ?? pl;
    if (c.kind === 'jet') {
      // Straight pass over the target, releasing bombs near it.
      v.throttle = 1;
      v.vx = Math.sin(v.heading) * 90;
      v.vz = Math.cos(v.heading) * 90;
      v.x += v.vx * dt;
      v.z += v.vz * dt;
      const t = c.target!;
      if (c.bombs && dist(v.x, v.z, t.x, t.z) < 40 && now > c.nextShot) {
        c.nextShot = now + 0.18;
        c.bombs--;
        g.weapons.launch('bomb', new THREE.Vector3(v.x, v.y - 1, v.z), new THREE.Vector3(v.vx * 0.5, -5, v.vz * 0.5), v, 'military', 420, 11);
      }
      return;
    }
    if (c.kind === 'heli' || c.kind === 'dropship') {
      const goal = c.kind === 'dropship' && !c.dropDone ? c.target! : { x: target.x, z: target.z };
      c.orbit += dt * 0.25;
      const r = c.kind === 'heli' ? 32 : 0;
      const gx = goal.x + Math.sin(c.orbit) * r, gz = goal.z + Math.cos(c.orbit) * r;
      const ground = c.kind === 'dropship' && !c.dropDone ? g.world.groundHeight(gx, gz) : 0;
      // Clear the rooftops around and ahead of the aircraft.
      let roofs = 0;
      const ax = v.x + v.vx * 2.5, az = v.z + v.vz * 2.5;
      for (const b of g.world.boxesIn(Math.min(v.x, ax) - 25, Math.max(v.x, ax) + 25, Math.min(v.z, az) - 25, Math.max(v.z, az) + 25)) roofs = Math.max(roofs, b.h);
      const landing = c.kind === 'dropship' && !c.dropDone && dist(v.x, v.z, gx, gz) < 8;
      const alt = landing ? ground + 3 : Math.max(45, roofs + 18, ground + 15);
      const d = Math.hypot(gx - v.x, gz - v.z);
      const want = Math.atan2(gx - v.x, gz - v.z);
      v.steerIn = clamp(Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading)) * 1.5, -1, 1);
      v.throttle = clamp(d / 40, 0, 1) * (Math.abs(v.steerIn) > 0.8 ? 0.3 : 1) * (v.y < alt - 6 ? 0 : 1);
      v.altitude = clamp((alt - v.y) / 10, -1, 1);
      if (c.kind === 'dropship' && !c.dropDone && d < 8 && Math.abs(v.y - (ground + 3)) < 2) {
        // Fast-rope four soldiers onto the roof.
        c.dropDone = true;
        for (let i = 0; i < 4; i++) {
          const p = new Ped(g, 'soldier', 'military', v.x + rand(-3, 3), v.z + rand(-3, 3));
          p.y = ground;
          p.give(pick(['m4', 'ak']), 200);
          p.equip(0);
          p.flankSide = 0;
          p.accuracy = 1.3;
          p.tx = p.x;
          p.tz = p.z;
          g.peds.push(p);
          this.units.push(p);
        }
        c.until = now + 12;
      }
      // Door gunner at three stars and up.
      if (c.kind === 'heli' && this.stars >= 3 && now > c.nextShot && dist(v.x, v.z, target.x, target.z) < 80 && c.crew[0]?.weapon) {
        c.nextShot = now + 0.12;
        const o = new THREE.Vector3(v.x, v.y - 0.5, v.z);
        const dir = new THREE.Vector3(target.x - o.x, (pl.vehicle ? pl.vehicle.y : pl.y) + 1 - o.y, target.z - o.z).normalize();
        if (!g.world.raycast(o.x, o.y, o.z, target.x, 1, target.z)) {
          const ws = c.crew[0].weapon!;
          ws.ammo = Math.max(ws.ammo, 1);
          ws.nextShot = 0;
          g.weapons.fire(c.crew[0], ws, o, dir, 3.5 * g.difficultyAim);
        }
      }
      return;
    }
    if (c.unloaded && c.kind !== 'tank' && c.kind !== 'apc') {
      v.throttle = 0;
      v.handbrake = true;
      v.steerIn = 0;
      return;
    }
    const d = dist(v.x, v.z, target.x, target.z);
    const seen = now - this.lastKnownAt < 3;
    const goal = seen ? { x: target.x, z: target.z } : this.lastKnown;
    // Unload when close and the target is on foot or stopped.
    const stopDist = c.kind === 'truck' ? 30 : c.kind === 'swat' ? 22 : 15;
    const targetSlow = !pl.vehicle || pl.vehicle.speed < 4;
    if (c.kind !== 'tank' && c.kind !== 'apc' && d < stopDist && targetSlow) {
      v.throttle = v.forwardSpeed > 1 ? -1 : 0;
      if (v.speed < 2) this.unload(c);
      return;
    }
    // Road-following path unless the target is in direct view.
    if (!g.world.raycast(v.x, 1, v.z, goal.x, 1, goal.z) && dist(v.x, v.z, goal.x, goal.z) < 120) {
      c.path = [];
      const ram = c.kind === 'car' && pl.vehicle && this.stars >= 2;
      v.driveTo(goal.x, goal.z, c.kind === 'tank' ? 12 : ram ? 34 : Math.min(30, d * 0.9), dt);
      if (c.kind === 'tank' && d < 25) v.throttle = 0;
    } else {
      if (now - c.pathAt > 2 || !c.path.length) {
        c.pathAt = now;
        c.path = this.roadPath(v.x, v.z, goal.x, goal.z);
      }
      const p = c.path[0] ?? goal;
      if (dist(v.x, v.z, p.x, p.z) < 10) c.path.shift();
      v.driveTo(p.x, p.z, c.kind === 'tank' ? 12 : 26 * (1 - 0.3 * g.env.wetness), dt);
    }
    // Drive-by fire, turret fire and tank shells.
    if (this.stars >= 2 && now > c.nextShot && d < (c.kind === 'tank' ? 120 : 40)) {
      const o = new THREE.Vector3(v.x, v.y + (c.kind === 'tank' ? 2.4 : 1.4), v.z);
      const los = !g.world.raycast(o.x, o.y, o.z, target.x, 1, target.z, { smoke: true, now });
      const want = Math.atan2(target.x - v.x, target.z - v.z) - v.heading;
      v.turretYaw = want;
      if (c.kind === 'tank') {
        if (now > c.nextShot) {
          c.nextShot = now + rand(4, 6);
          // No line of sight? Shell the building in the way.
          const dir = new THREE.Vector3(target.x - o.x, 1 - o.y, target.z - o.z).normalize();
          g.weapons.launch('shell', o.clone().addScaledVector(dir, 4), dir.multiplyScalar(110), v, 'military', 400, 9);
          g.audio.cannon(o.x, o.y, o.z);
          if (!los) g.hud.toast('הטנק יורה פגזים לתוך הבניין!', 1.5);
        }
      } else if (los) {
        const shooter = c.crew.find((p) => p.alive && p.vehicle === v && p.weapon);
        if (shooter) {
          c.nextShot = now + (c.kind === 'apc' ? 0.1 : rand(0.4, 0.8));
          const ws = shooter.weapon!;
          ws.ammo = Math.max(ws.ammo, 1);
          ws.nextShot = 0;
          const dir = new THREE.Vector3(target.x - o.x, (pl.vehicle ? 0.9 : 1.2) - o.y, target.z - o.z).normalize();
          g.weapons.fire(shooter, ws, o, dir, (c.kind === 'apc' ? 4 : 6) * g.difficultyAim);
        }
      }
    }
  }

  /** Route along the road grid from (x, z) to the intersection nearest the goal. */
  roadPath(x: number, z: number, gx: number, gz: number) {
    const sx = clamp(Math.round((x + HALF) / CELL), 0, GRID), sz = clamp(Math.round((z + HALF) / CELL), 0, GRID);
    const ex = clamp(Math.round((gx + HALF) / CELL), 0, GRID), ez = clamp(Math.round((gz + HALF) / CELL), 0, GRID);
    const path: { x: number; z: number }[] = [];
    let cx = sx, cz = sz;
    path.push({ x: roadLine(cx), z: roadLine(cz) });
    // Manhattan route: alternate axes so cars don't hug the city edge.
    let guard = 40;
    while ((cx !== ex || cz !== ez) && guard--) {
      if (cx !== ex && (cz === ez || Math.abs(ex - cx) >= Math.abs(ez - cz))) cx += Math.sign(ex - cx);
      else cz += Math.sign(ez - cz);
      path.push({ x: roadLine(cx), z: roadLine(cz) });
    }
    path.push({ x: gx, z: gz });
    return path;
  }

  private updateSpotlight() {
    const heli = this.crews.find((c) => c.kind === 'heli' && !c.v.destroyed);
    const pl = this.g.player.ped;
    if (!heli || this.stars === 0) {
      this.spot.intensity = 0;
      this.spotCone.visible = false;
      return;
    }
    const v = heli.v;
    const night = this.g.env.night;
    this.spot.position.set(v.x, v.y - 1, v.z);
    // The beam sweeps around the last known position.
    const lk = this.g.time - this.lastKnownAt < 1 ? pl : { x: this.lastKnown.x + Math.sin(this.g.time) * 8, z: this.lastKnown.z + Math.cos(this.g.time * 0.7) * 8 };
    this.spot.target.position.set(lk.x, 0, lk.z);
    this.spot.intensity = 2000 * (0.3 + night);
    this.spotCone.visible = night > 0.3;
    this.spotCone.position.set(v.x, v.y - 1, v.z);
    this.spotCone.lookAt(lk.x, 0, lk.z);
    this.spotCone.rotateX(-Math.PI / 2);
    const len = Math.hypot(lk.x - v.x, v.y, lk.z - v.z);
    this.spotCone.scale.set(1, len / 45, 1);
  }
}

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { Ped, Population } from './actors';
import { Audio } from './audio';
import { Businesses, Market, News } from './economy';
import { Env } from './env';
import { Hud } from './hud';
import { Input } from './input';
import { Particles } from './models';
import { Player, Ability } from './player';
import { Police } from './police';
import { Vehicle, specById, FLEET } from './vehicles';
import { Weapons, WEAPONS, type WeaponSpec, type Attachment } from './weapons';
import { Bus, chance, clamp, dist, fmtMoney, isTouch, pick, rand } from './util';
import { AIRPORT, BOUNDS, ROAD, SEA_X, World, inTunnel, roadLine, streetName } from './world';

type Events = {
  shot: { x: number; z: number; by: Ped; loud: boolean; weapon: WeaponSpec };
  explosion: { x: number; z: number; by: Ped | null };
  death: { ped: Ped; by: Ped | null };
  vehicleDestroyed: { v: Vehicle; by: Ped | null };
  assault: { x: number; z: number; victim: Ped; by: Ped };
  crime: { x: number; z: number; kind: string; by: Ped };
  filmed: { ped: Ped };
};

export interface Stimulus {
  x: number;
  z: number;
  t: number;
  r: number;
  sev: number;
  kind: string;
  by: Ped | null;
}

interface Pickup {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  kind: 'weapon' | 'money' | 'health' | 'armor';
  weapon?: string;
  amount: number;
  until: number;
}

const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.1 }, uVig: { value: 0.35 }, uSlow: { value: 0 }, uWarm: { value: 0.05 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uVig; uniform float uSlow; uniform float uWarm; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat * (1.0 - uSlow * 0.6));
      // Teal shadows, warm highlights
      c.rgb += vec3(uWarm, uWarm * 0.4, -uWarm) * smoothstep(0.4, 1.0, l) + vec3(-uWarm, 0.0, uWarm) * (1.0 - smoothstep(0.0, 0.4, l)) * 0.6;
      c.rgb = (c.rgb - 0.5) * 1.06 + 0.5;
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - smoothstep(0.45, 0.85, d) * uVig;
      c.rgb = mix(c.rgb, c.rgb * vec3(0.8, 0.9, 1.15), uSlow);
      gl_FragColor = c;
    }`,
};

/** localStorage can throw (private windows, sandboxed frames). */
function readSetting(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1600);
  quality: 'low' | 'high';
  composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  private bokeh: BokehPass | null = null;
  bus = new Bus<Events>();
  world = new World();
  input: Input;
  env!: Env;
  audio: Audio;
  weapons!: Weapons;
  particles!: Particles;
  police!: Police;
  market!: Market;
  businesses!: Businesses;
  news!: News;
  hud!: Hud;
  player!: Player;
  ability!: Ability;
  population!: Population;
  peds: Ped[] = [];
  vehicles: Vehicle[] = [];
  stimuli: Stimulus[] = [];
  pickups: Pickup[] = [];
  private props: { mesh: THREE.Mesh; until: number }[] = [];
  private bodies: { ped: Ped; t: number; done: boolean }[] = [];
  time = 0;
  money = 25000;
  paused = false;
  timeScaleGame = 1;
  bounds = BOUNDS;
  difficulty = 1;
  cheats = { noPolice: false };
  private respawnAt = 0;
  private respawnKind: 'wasted' | 'busted' | null = null;
  private lastFrame = performance.now();
  private acc = 0;
  private fps = 60;
  private trafficTick = 0;
  private persistent = new Set<Vehicle>();
  private explosionLight: THREE.PointLight;
  private explosionLightT = 0;

  constructor(private host: HTMLElement) {
    this.quality = (readSetting('omega-quality') as 'low' | 'high' | null) ?? (isTouch() || (navigator.hardwareConcurrency ?? 4) < 6 ? 'low' : 'high');
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality === 'high', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === 'high' ? 1.75 : 1.25));
    this.renderer.shadowMap.enabled = this.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'view';
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    host.appendChild(overlay);
    this.input = new Input(this.renderer.domElement, overlay);
    this.audio = new Audio(this);
    this.explosionLight = new THREE.PointLight(0xff8a30, 0, 60, 1.5);
    this.scene.add(this.explosionLight);
    this.difficulty = Number(readSetting('omega-difficulty') ?? (isTouch() ? 0 : 1));
  }

  init() {
    this.world.build(this.scene, this.quality);
    this.particles = new Particles(this.scene, this.quality === 'high' ? 1400 : 700);
    this.hud = new Hud(this, this.host);
    this.player = new Player(this);
    this.ability = new Ability(this);
    this.player.spawnChars();
    this.env = new Env(this);
    this.weapons = new Weapons(this);
    this.police = new Police(this);
    this.news = new News(this);
    this.market = new Market(this);
    this.businesses = new Businesses(this);
    this.population = new Population(this);
    this.population.spawnResidents();
    for (let i = 0; i < 25; i++) this.population.spawnCivilian(true);
    this.spawnFixedVehicles();
    this.setupPost();
    this.wireEvents();
    this.load();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private setupPost() {
    if (this.quality !== 'high') return;
    const c = new EffectComposer(this.renderer);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.85);
    c.addPass(this.bloom);
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 30, aperture: 0.00002, maxblur: 0.008 });
    this.bokeh.enabled = false;
    c.addPass(this.bokeh);
    this.grade = new ShaderPass(GRADE_SHADER);
    c.addPass(this.grade);
    c.addPass(new OutputPass());
    this.composer = c;
  }

  private resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private wireEvents() {
    const b = this.bus;
    b.on('shot', ({ x, z, by, loud }) => this.stimulus(x, z, loud ? 55 : 8, 0.8, 'shooting', by));
    b.on('explosion', ({ x, z, by }) => this.stimulus(x, z, 110, 1, 'explosion', by));
    b.on('assault', ({ x, z, by }) => this.stimulus(x, z, 16, 0.5, 'assault', by));
    b.on('crime', ({ x, z, kind, by }) => this.stimulus(x, z, 25, 0.6, kind, by));
    b.on('death', ({ ped, by }) => {
      this.stimulus(ped.x, ped.z, 30, 0.7, by?.isPlayer ? 'murder' : 'death', by);
      if (ped.isPlayer) this.wasted();
      else {
        this.bodies.push({ ped, t: this.time, done: false });
        if (ped.isArmedUnit && ped.weapon && ped.weapon.spec.cat !== 'melee') this.dropPickup(ped.x, ped.z, 'weapon', ped.weapon.spec.id, ped.weapon.spec.mag * 2);
        else if (chance(0.5)) this.dropPickup(ped.x, ped.z, 'money', undefined, Math.round(rand(20, 250)));
      }
    });
  }

  stimulus(x: number, z: number, r: number, sev: number, kind: string, by: Ped | null) {
    this.stimuli.push({ x, z, r, sev, kind, by, t: this.time });
  }

  get difficultyDmg() {
    return [0.55, 1, 1.4][this.difficulty];
  }
  get difficultyAim() {
    return [1.6, 1, 0.75][this.difficulty];
  }
  difficultyName() {
    return ['קל', 'רגיל', 'קשה'][this.difficulty];
  }
  cycleDifficulty() {
    this.difficulty = (this.difficulty + 1) % 3;
    try {
      localStorage.setItem('omega-difficulty', String(this.difficulty));
    } catch {
      /* storage unavailable */
    }
  }

  setQuality(q: 'low' | 'high') {
    try {
      localStorage.setItem('omega-quality', q);
    } catch {
      /* storage unavailable */
    }
    this.save(true);
    location.reload();
  }

  streetName() {
    const p = this.player.ped;
    return streetName(p.x, p.z);
  }

  pay(n: number) {
    if (this.money < n) return false;
    this.money -= n;
    return true;
  }

  // ---- vehicles ----------------------------------------------------------------

  private spawnFixedVehicles() {
    const add = (id: string, x: number, z: number, h: number, company: string | null = null, color?: number) => {
      const v = new Vehicle(this, specById(id), x, z, h, 'parked');
      if (color !== undefined) {
        v.mods.color = color;
        v.applyPaint();
      }
      v.company = company;
      this.vehicles.push(v);
      this.persistent.add(v);
      return v;
    };
    // Airport: light aircraft, a helicopter and the airlines' fleets.
    const rx = AIRPORT.maxX - 60;
    add('cessna', rx - 40, -120, 0);
    add('cessna', rx - 40, -95, 0, null, 0xd04040);
    add('heli', rx - 40, 30, Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const sky = i < 2;
      const v = add('cessna', AIRPORT.minX + 110 + (i % 2) * 40, sky ? -60 + i * 5 : 60 + (i - 2) * 5, Math.PI / 2, sky ? 'SKYN' : 'AERX', sky ? 0x2b6cff : 0xc0392b);
      v.model.root.scale.setScalar(2.4);
    }
    // Docks
    add('jetski', SEA_X + 8, 30, Math.PI / 2);
    add('jetski', SEA_X + 8, 50, Math.PI / 2, null, 0xff6a00);
    const yacht = add('yacht', SEA_X + 40, 80, 0);
    yacht.y = 0;
    // Showcase cars around the safehouse and garage
    const safe = this.world.places.find((p) => p.id === 'safehouse')!;
    add('super', safe.x + 8, safe.z - 6, Math.PI / 2);
    add('muscle', safe.x - 8, safe.z - 6, Math.PI / 2);
    const garage = this.world.places.find((p) => p.id === 'garage')!;
    add('bike', garage.x + 6, garage.z - 6, Math.PI / 2);
    add('jeep', garage.x - 6, garage.z - 6, Math.PI / 2);
    const docks = this.world.places.find((p) => p.id === 'docks')!;
    add('jeep', docks.x - 20, docks.z - 10, 0);
    add('tank', roadLine(1), roadLine(8) + 30, 0).role = 'military';
  }

  spawnVehicleNearPlayer(id: string) {
    const p = this.player.ped;
    let x = p.x + Math.sin(p.heading) * 5, z = p.z + Math.cos(p.heading) * 5;
    const spec = specById(id);
    if (spec.kind === 'boat') {
      x = Math.max(x, SEA_X + 12);
      if (Math.abs(p.x - x) > 30) this.hud.toast('כלי השיט ממתין ברציף', 2);
    }
    const res = this.world.collideCircle(x, z, spec.w, 1);
    const v = new Vehicle(this, spec, res.x, res.z, p.heading, 'parked');
    this.vehicles.push(v);
    this.persistent.add(v);
    this.hud.closeMenu();
  }

  removeVehicle(v: Vehicle) {
    v.remove();
    this.vehicles = this.vehicles.filter((o) => o !== v);
    this.persistent.delete(v);
  }

  removeFromCrews(v: Vehicle) {
    this.police.crews = this.police.crews.filter((c) => c.v !== v);
  }

  removePed(p: Ped) {
    if (p.isPlayer) return;
    p.remove();
    this.peds = this.peds.filter((o) => o !== p);
    if (p.vehicle) {
      if (p.vehicle.driver === p) p.vehicle.driver = null;
      p.vehicle.passengers = p.vehicle.passengers.filter((o) => o !== p);
    }
  }

  ejectRider(v: Vehicle) {
    const d = v.driver;
    if (!d) return;
    v.driver = null;
    d.vehicle = null;
    d.y = 1;
    d.startRagdoll(v.vx * 0.7, 4, v.vz * 0.7);
    d.damage(15, null, { dir: new THREE.Vector3(v.vx, 0, v.vz).normalize(), knockback: 0 });
    if (d.isPlayer) {
      this.input.setVehicleMode('foot');
      this.hud.toast('עפת מהאופנוע!', 1.5);
    }
  }

  camShake(a: number) {
    this.player.camShake(a);
  }

  /** Keep traffic and parked cars around the player. */
  private traffic() {
    const p = this.player.ped;
    const h = this.env.hour;
    const factor = h < 5 || h > 23 ? 0.4 : (h > 7 && h < 9.5) || (h > 16.5 && h < 19) ? 1.3 : 1;
    const want = Math.round((this.quality === 'high' ? 24 : 14) * factor);
    for (const v of this.vehicles) {
      if (this.persistent.has(v) || v.driver?.isPlayer || v.role === 'police' || v.role === 'military' || v.role === 'roadblock' || v.role === 'air-support') continue;
      if (dist(v.x, v.z, p.x, p.z) > 230) {
        v.driver && this.removePed(v.driver);
        this.removeVehicle(v);
      }
    }
    const traffic = this.vehicles.filter((v) => v.role === 'traffic').length;
    if (traffic < want) this.spawnTraffic();
    const parked = this.vehicles.filter((v) => v.role === 'parked' && !this.persistent.has(v)).length;
    if (parked < 10) this.spawnParked();
  }

  private pickCarSpec() {
    const r = Math.random();
    return r < 0.4 ? 'sedan' : r < 0.53 ? 'taxi' : r < 0.65 ? 'muscle' : r < 0.77 ? 'jeep' : r < 0.87 ? 'bike' : r < 0.92 ? 'super' : 'sedan';
  }

  private spawnTraffic() {
    const p = this.player.ped;
    const pt = this.world.randomRoadPointNear(p.x, p.z, 90, 180);
    if (!pt) return;
    const id = this.pickCarSpec();
    const v = new Vehicle(this, specById(id), pt.x, pt.z, 0, 'traffic', id === 'taxi' ? 'taxi' : '');
    v.company = id === 'super' ? 'FURI' : id === 'muscle' || id === 'sedan' ? 'VRTX' : null;
    if (id !== 'taxi') {
      v.mods.color = pick([0x6d7f91, 0x1c1c1c, 0xe5e5e5, 0x8b1e1e, 0x1f4fa8, 0x2e7d32, 0x9a9a9a, 0xd4a017, 0x4a235a]);
      v.applyPaint();
    }
    v.snapToGrid();
    const [kx, kz] = v.ai.node;
    v.x = roadLine(kx);
    v.z = roadLine(kz);
    const [tx, tz] = v.ai.target;
    v.heading = Math.atan2(roadLine(tx) - v.x, roadLine(tz) - v.z);
    v.ai.speed = rand(11, 16);
    if (dist(v.x, v.z, p.x, p.z) < 70) {
      v.remove();
      return;
    }
    const d = new Ped(this, 'driver', 'civ', v.x, v.z);
    d.vehicle = v;
    d.vehicleOwned = v;
    v.driver = d;
    this.peds.push(d);
    this.vehicles.push(v);
  }

  private spawnParked() {
    const p = this.player.ped;
    const pt = this.world.randomRoadPointNear(p.x, p.z, 60, 160);
    if (!pt || inTunnel(pt.x, pt.z)) return;
    // Park against the kerb.
    const off = (ROAD / 2 - 1.4) * (chance(0.5) ? 1 : -1);
    const x = pt.alongX ? pt.x : pt.x + off, z = pt.alongX ? pt.z + off : pt.z;
    const id = this.pickCarSpec();
    const v = new Vehicle(this, specById(id), x, z, pt.alongX ? Math.PI / 2 : 0, 'parked', id === 'taxi' ? 'taxi' : '');
    v.company = id === 'super' ? 'FURI' : 'VRTX';
    this.vehicles.push(v);
  }

  private vehicleCollisions() {
    const vs = this.vehicles;
    for (let i = 0; i < vs.length; i++) {
      const a = vs[i];
      if (a.sunk || (a.isAir && a.y > 1)) continue;
      for (let j = i + 1; j < vs.length; j++) {
        const b = vs[j];
        if (b.sunk || (b.isAir && b.y > 1) || a.isBoat !== b.isBoat) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const r = a.radius + b.radius - 0.4;
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
        const pen = r - d;
        const ma = a.spec.mass, mb = b.spec.mass, tot = ma + mb;
        a.x -= nx * pen * (mb / tot);
        a.z -= nz * pen * (mb / tot);
        b.x += nx * pen * (ma / tot);
        b.z += nz * pen * (ma / tot);
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel >= 0) continue;
        const imp = (-1.3 * rel) / (1 / ma + 1 / mb);
        a.vx -= (imp / ma) * nx;
        a.vz -= (imp / ma) * nz;
        b.vx += (imp / mb) * nx;
        b.vz += (imp / mb) * nz;
        const speed = -rel;
        const byA = a.driver?.isPlayer ? a.driver : null, byB = b.driver?.isPlayer ? b.driver : null;
        a.impact(speed * (mb / tot) * 1.6, nx, nz, byB);
        b.impact(speed * (ma / tot) * 1.6, -nx, -nz, byA);
        if (byA) this.ramReaction(b, speed);
        if (byB) this.ramReaction(a, speed);
        if (a.driver?.isPlayer || b.driver?.isPlayer) this.camShake(Math.min(1, speed / 15));
      }
    }
  }

  /** A civilian whose car you hit may get out and have a go at you. */
  private ramReaction(v: Vehicle, speed: number) {
    const d = v.driver;
    if (speed < 3 || !d || d.team !== 'civ' || !d.alive) {
      if (v.role === 'police' || v.role === 'roadblock') this.police.commitCrime('assaultCop', v.x, v.z, true);
      return;
    }
    if (d.psych.aggression > 55 && d.psych.courage > 35) {
      d.vehicle = null;
      v.driver = null;
      v.role = 'abandoned';
      v.throttle = 0;
      v.handbrake = true;
      d.x = v.x + Math.cos(v.heading) * 2;
      d.z = v.z - Math.sin(v.heading) * 2;
      d.setState('confront', 12);
      d.say(pick(['!היי! מה אתה עושה', '!ראית מה עשית לאוטו שלי', '!צא מהאוטו, אני אראה לך']));
    } else this.audio.horn(v.x, v.z);
  }

  // ---- explosions, pickups, props ------------------------------------------------

  explode(x: number, y: number, z: number, r: number, dmg: number, by: Ped | null, source?: Vehicle) {
    const fx = this.particles;
    for (let i = 0; i < 28; i++) fx.spawn(x + rand(-1, 1), y + rand(0, 1), z + rand(-1, 1), rand(-8, 8), rand(2, 12), rand(-8, 8), rand(0.4, 0.9), rand(0.5, 1.2), pick([0xffd040, 0xff7a10, 0xff4400]), 1.5, 2);
    for (let i = 0; i < 26; i++) fx.spawn(x + rand(-2, 2), y + rand(0, 2), z + rand(-2, 2), rand(-1.5, 1.5), rand(2, 5), rand(-1.5, 1.5), rand(2, 4), rand(1, 2), pick([0x2a2a2a, 0x444444, 0x666666]), 1.4);
    fx.burst(x, y, z, 16, 18, 1.4, 0.18, 0x3a3a3a);
    this.explosionLight.position.set(x, y + 2, z);
    this.explosionLight.intensity = 400;
    this.explosionLightT = 0.35;
    this.audio.explosion(x, y, z, r / 8);
    const pd = dist(x, z, this.camera.position.x, this.camera.position.z);
    this.camShake(clamp(1.2 - pd / 80, 0, 1));
    this.bus.emit('explosion', { x, z, by });
    for (const p of this.peds) {
      if (!p.alive || p.vehicle) continue;
      const d = Math.hypot(p.x - x, p.y - y + 1, p.z - z);
      if (d > r) continue;
      const k = 1 - d / r;
      const dir = new THREE.Vector3(p.x - x, 0.5, p.z - z).normalize();
      p.damage(dmg * k, by, { dir, knockback: 10 * k, explosion: true });
    }
    for (const v of this.vehicles) {
      if (v === source || v.destroyed || v.sunk) continue;
      const d = Math.hypot(v.x - x, v.y - y, v.z - z);
      if (d > r + v.radius) continue;
      const k = clamp(1 - d / (r + v.radius), 0.1, 1);
      v.health -= dmg * k * 4 * (1 - (v.spec.armor ?? 0) * 0.8);
      v.lastHitBy = by ?? v.lastHitBy;
      v.vx += ((v.x - x) / (d || 1)) * k * 8 * (2000 / v.spec.mass);
      v.vz += ((v.z - z) / (d || 1)) * k * 8 * (2000 / v.spec.mass);
      v.shatterGlass();
      if (v.health <= 0) v.explode(by);
    }
  }

  dropPickup(x: number, z: number, kind: Pickup['kind'], weapon: string | undefined, amount: number) {
    const color = kind === 'money' ? 0x30c050 : kind === 'weapon' ? 0x40a0ff : 0xffffff;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
    mesh.position.set(x, 0.4, z);
    this.scene.add(mesh);
    this.pickups.push({ mesh, x, z, kind, weapon, amount, until: this.time + 60 });
  }

  dropProp(x: number, z: number) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(rand(0.2, 0.4), 0.15, rand(0.15, 0.3)), new THREE.MeshStandardMaterial({ color: pick([0x5a3a20, 0x222222, 0xa04060, 0x2050a0]) }));
    mesh.position.set(x + rand(-0.5, 0.5), 0.08, z + rand(-0.5, 0.5));
    mesh.rotation.y = rand(0, 6);
    this.scene.add(mesh);
    this.props.push({ mesh, until: this.time + 40 });
  }

  private updatePickups() {
    const p = this.player.ped;
    this.pickups = this.pickups.filter((k) => {
      k.mesh.rotation.y += 0.05;
      k.mesh.position.y = 0.4 + Math.sin(this.time * 3) * 0.1;
      if (p.alive && !p.vehicle && dist(k.x, k.z, p.x, p.z) < 1.4) {
        if (k.kind === 'money') {
          this.money += k.amount;
          this.hud.toast(`+${fmtMoney(k.amount)}`, 1);
        } else if (k.weapon) {
          const had = p.weapons.some((w) => w.spec.id === k.weapon);
          p.give(k.weapon, k.amount);
          this.hud.toast(had ? `תחמושת: ${WEAPONS.find((w) => w.id === k.weapon)!.name}` : `נשק חדש: ${WEAPONS.find((w) => w.id === k.weapon)!.name}`, 1.5);
        }
        this.audio.checkpoint();
        this.scene.remove(k.mesh);
        return false;
      }
      if (this.time > k.until) {
        this.scene.remove(k.mesh);
        return false;
      }
      return true;
    });
    this.props = this.props.filter((pr) => {
      if (this.time < pr.until) return true;
      this.scene.remove(pr.mesh);
      return false;
    });
  }

  /** Bystanders gather round a body once things calm down, filming and chattering. */
  private crimeScenes() {
    for (const b of this.bodies) {
      if (b.done || this.time - b.t < 8) continue;
      b.done = true;
      const recentShots = this.stimuli.some((s) => s.kind === 'shooting' && this.time - s.t < 6 && dist(s.x, s.z, b.ped.x, b.ped.z) < 60);
      if (recentShots) continue;
      let n = 0;
      for (const p of this.peds) {
        if (p.team !== 'civ' || !p.alive || p.vehicle || p.persistent || n > 6) continue;
        if (p.psych.courage < 45 || p.state === 'flee' || p.state === 'attack' || p.state === 'call' || p.state === 'confront') continue;
        if (dist(p.x, p.z, b.ped.x, b.ped.z) > 50) continue;
        const a = rand(0, Math.PI * 2), r = rand(2.5, 5);
        p.tx = b.ped.x + Math.sin(a) * r;
        p.tz = b.ped.z + Math.cos(a) * r;
        p.moveSpeed = 1.6;
        p.setState('gather', rand(20, 35));
        p.model.phone.visible = chance(0.6);
        n++;
      }
    }
    this.bodies = this.bodies.filter((b) => this.time - b.t < 60);
  }

  // ---- interactions ----------------------------------------------------------

  private nearPlace() {
    const p = this.player.ped;
    return this.world.places.find((pl) => dist(pl.x, pl.z, p.x, p.z) < 6);
  }

  interactionHint() {
    if (this.hud.menuOpen || !this.player.ped.alive) return '';
    const p = this.player.ped;
    const pl = this.nearPlace();
    const key = this.input.touch ? 'E' : 'E';
    if (pl) {
      if (pl.kind === 'garage') return p.vehicle ? `${key} · מוסך שיפורים` : 'הכנס עם רכב למוסך';
      if (pl.kind === 'gunshop') return `${key} · חנות נשק`;
      if (pl.kind === 'business') return `${key} · ${pl.name}`;
      if (pl.kind === 'safehouse') return `${key} · לישון ולשמור`;
      if (pl.kind === 'hospital') return `${key} · טיפול רפואי ($200)`;
    }
    if (!p.vehicle) {
      for (const v of this.vehicles) {
        if (v.destroyed || v.role === 'air-support') continue;
        if (dist(v.x, v.z, p.x, p.z) - v.spec.w / 2 < 4.5) return `F · ${v.driver && !v.driver.isPlayer ? 'חטיפת' : 'כניסה ל'}${v.spec.name}`;
      }
    }
    return '';
  }

  private interact() {
    const pl = this.nearPlace();
    if (!pl) return;
    const p = this.player.ped;
    if (pl.kind === 'gunshop') this.hud.gunShop();
    else if (pl.kind === 'garage' && p.vehicle) this.hud.garage(p.vehicle);
    else if (pl.kind === 'business') this.hud.businessMenu(pl.id);
    else if (pl.kind === 'safehouse') {
      if (this.police.stars > 0) return this.hud.toast('אי אפשר לישון כשמבוקשים', 1.5);
      this.env.minutes += 8 * 60;
      this.heal();
      this.save();
      this.hud.toast('ישנת 8 שעות. המשחק נשמר.', 2.5);
    } else if (pl.kind === 'hospital' && this.pay(200)) this.heal();
  }

  heal() {
    const p = this.player.ped;
    p.health = p.maxHealth;
    p.armor = Math.max(p.armor, 100);
  }

  giveAll() {
    const p = this.player.ped;
    for (const w of WEAPONS) {
      const ws = p.give(w.id, w.mag * 6);
      for (const a of w.attachments ?? []) ws.attachments.add(a as Attachment);
    }
    this.hud.toast('כל הנשקים נוספו (1-0 / גלגלת להחלפה)', 2);
  }

  setWanted(s: number) {
    const p = this.player.ped;
    this.police.heat = [0, 10, 30, 70, 150, 300][s];
    this.police.stars = 0;
    this.police.commitCrime('brandish', p.x, p.z, true);
    this.police.heat = [0, 10, 30, 70, 150, 300][s];
    this.police.stars = s;
    this.police.lastKnown = { x: p.x, z: p.z };
    this.police.lastKnownAt = this.time;
    this.hud.closeMenu();
  }

  // ---- death and arrest ------------------------------------------------------

  wasted() {
    if (this.respawnKind) return;
    this.respawnKind = 'wasted';
    this.respawnAt = this.time + 4;
    this.hud.big('חוסלת', 'מתעורר בבית החולים…');
    this.audio.wasted();
    const p = this.player.ped;
    if (p.vehicle) {
      p.vehicle.driver = null;
      p.vehicle = null;
    }
  }

  busted() {
    if (this.respawnKind) return;
    this.respawnKind = 'busted';
    this.respawnAt = this.time + 3.5;
    this.hud.big('נעצרת', 'שוחררת בערבות מתחנת המשטרה…');
    this.audio.wasted();
    this.player.ped.alive = false;
  }

  private respawn() {
    const kind = this.respawnKind!;
    this.respawnKind = null;
    const place = this.world.places.find((pl) => pl.id === (kind === 'wasted' ? 'hospital' : 'police'))!;
    const p = this.player.ped;
    p.alive = true;
    p.health = p.maxHealth;
    p.armor = kind === 'busted' ? p.armor : 0;
    p.ragdoll = 0;
    p.state = 'idle';
    p.vx = p.vz = p.vy = 0;
    p.y = 0;
    p.model.body.rotation.set(0, 0, 0);
    p.model.body.position.set(0, 0, 0);
    p.x = place.x;
    p.z = place.z - 3;
    p.vehicle = null;
    this.input.setVehicleMode('foot');
    const fee = kind === 'wasted' ? Math.min(this.money, 1500) : Math.min(this.money, 500);
    this.money -= fee;
    if (kind === 'busted') for (const w of p.weapons) w.reserve = Math.floor(w.reserve / 2);
    this.police.clear(kind);
    this.businesses.mission = null;
    this.hud.big('');
    this.hud.toast(kind === 'wasted' ? `חשבון בית החולים: ${fmtMoney(fee)}` : `ערבות: ${fmtMoney(fee)}, חצי מהתחמושת הוחרמה`, 3);
    // Clear the police presence around the respawn.
    for (const u of [...this.police.units]) if (dist(u.x, u.z, p.x, p.z) < 60) this.removePed(u);
  }

  // ---- save -----------------------------------------------------------------

  save(silent = false) {
    const pl = this.player;
    pl.char.x = pl.ped.x;
    pl.char.z = pl.ped.z;
    const data = {
      money: this.money,
      minutes: this.env.minutes,
      shares: this.market.shares,
      basis: this.market.costBasis,
      biz: this.businesses.list.filter((b) => b.owned).map((b) => b.id),
      charIdx: pl.charIdx,
      chars: pl.chars.map((c) => ({ x: c.ped ? c.ped.x : c.x, z: c.ped ? c.ped.z : c.z, meter: c.meter, weapons: c.ped?.weapons.map((w) => ({ id: w.spec.id, reserve: w.reserve, ammo: w.ammo, att: [...w.attachments] })) })),
    };
    try {
      localStorage.setItem('omega-save', JSON.stringify(data));
      if (!silent) this.hud.toast('המשחק נשמר', 1.5);
    } catch {
      if (!silent) this.hud.toast('השמירה לא זמינה בדפדפן הזה', 2);
    }
  }

  private load() {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem('omega-save');
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      this.money = d.money;
      this.env.minutes = d.minutes;
      this.market.shares = d.shares ?? {};
      this.market.costBasis = d.basis ?? {};
      for (const id of d.biz ?? []) {
        const b = this.businesses.byId(id);
        if (b) b.owned = true;
      }
      const pl = this.player;
      d.chars?.forEach((c: { x: number; z: number; meter: number; weapons?: { id: string; reserve: number; ammo: number; att: Attachment[] }[] }, i: number) => {
        const ch = pl.chars[i];
        ch.x = c.x;
        ch.z = c.z;
        ch.meter = c.meter;
        if (i === pl.charIdx && ch.ped) {
          ch.ped.x = c.x;
          ch.ped.z = c.z;
          for (const w of c.weapons ?? []) {
            const ws = ch.ped.give(w.id, 0);
            ws.reserve = w.reserve;
            ws.ammo = w.ammo;
            w.att.forEach((a) => ws.attachments.add(a));
          }
        }
      });
      this.hud.toast('המשחק השמור נטען', 2);
    } catch {
      /* corrupt save: start fresh */
    }
  }

  // ---- loop -----------------------------------------------------------------

  private frame() {
    const now = performance.now();
    const realDt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.fps = this.fps * 0.95 + (1 / Math.max(realDt, 1e-3)) * 0.05;
    this.input.update();
    if (this.input.pressed('help')) this.hud.menuOpen ? this.hud.closeMenu() : this.hud.help();
    if (this.input.pressed('phone')) this.hud.menuOpen ? this.hud.closeMenu() : this.hud.phone();
    if (this.input.pressed('pause') && this.hud.menuOpen) this.hud.closeMenu();
    if (!this.paused) {
      const scale = this.ability.timeScale();
      this.acc += realDt * scale;
      const step = 1 / 60;
      let n = 0;
      // Input-driven actions run once per rendered frame; the simulation in fixed steps.
      if (this.input.pressed('interact')) this.interact();
      if (this.input.pressed('weather')) this.env.cycleWeather();
      this.player.update(realDt * scale, realDt);
      while (this.acc >= step && n++ < 5) {
        this.step(step);
        this.acc -= step;
      }
      if (n >= 5) this.acc = 0;
      this.ability.update(realDt);
    }
    this.hud.update(realDt);
    this.audio.update(realDt);
    this.render(realDt);
    this.input.endFrame();
  }

  private step(dt: number) {
    this.time += dt;
    this.env.update(dt);
    this.world.update(this.time, this.time, this.env.days);
    for (const v of this.vehicles) {
      // Traffic AI drives before the physics step.
      if (v.role === 'traffic' && v.driver?.alive && !v.destroyed) v.cruise(dt);
      else if (!v.driver && !this.police.crews.some((c) => c.v === v)) {
        v.throttle = 0;
        v.handbrake = !v.isAir;
        if (v.isAir) v.altitude = v.y > 0.5 ? -0.6 : 0;
      }
      v.update(dt);
    }
    this.vehicleCollisions();
    for (const p of this.peds) p.update(dt);
    this.police.update(dt);
    this.weapons.update(dt);
    this.particles.update(dt);
    this.market.update();
    this.businesses.update();
    this.news.update();
    if (this.time > this.trafficTick) {
      this.trafficTick = this.time + 0.5;
      this.traffic();
      this.population.update();
      this.crimeScenes();
    }
    this.updatePickups();
    this.stimuli = this.stimuli.filter((s) => this.time - s.t < 8);
    if (this.explosionLightT > 0) {
      this.explosionLightT -= dt;
      this.explosionLight.intensity = Math.max(0, this.explosionLightT / 0.35) * 400;
    }
    if (this.respawnKind && this.time > this.respawnAt) this.respawn();
    // Destroyed vehicles burn out and are cleared after a while.
    for (const v of this.vehicles) if (v.destroyed && v.lastSeen && this.time - v.lastSeen > 45 && !this.persistent.has(v) && dist(v.x, v.z, this.player.ped.x, this.player.ped.z) > 60) this.removeVehicle(v);
    for (const v of this.vehicles) if (v.destroyed && !v.lastSeen) v.lastSeen = this.time;
  }

  private render(dt: number) {
    if (this.composer && this.bloom && this.grade) {
      this.bloom.strength = 0.25 + this.env.night * 0.6;
      const u = this.grade.uniforms;
      u.uSlow.value += ((this.ability.active && this.ability.timeScale() < 1 ? 1 : 0) - u.uSlow.value) * Math.min(1, dt * 6);
      u.uWarm.value = 0.05 * (1 - this.env.night) * (1 - this.env.rain);
      u.uSat.value = 1.1 - this.env.rain * 0.25;
      if (this.bokeh) {
        // Depth of field while looking down a scope: focus on the target.
        this.bokeh.enabled = this.player.scoped;
        if (this.player.scoped) (this.bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = this.camera.position.distanceTo(this.player.aimPoint);
      }
      this.composer.render(dt);
    } else this.renderer.render(this.scene, this.camera);
  }
}

export { FLEET };

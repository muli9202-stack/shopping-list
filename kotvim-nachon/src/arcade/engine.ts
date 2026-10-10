import * as THREE from 'three';
import type { Theme } from './themes';
import { animateWalk, car, cashBundle, cyl, group, label, mat, person, product, rbox, sph, type Character, type ProductKind } from './models';

/**
 * The tycoon engine behind all 30 business games (isometric 3D, like the popular idle games):
 * walk with a finger-joystick, pick up products at a station, bring them to the counter or to the
 * waiting customers, collect the cash and step on upgrade pads to grow the business. Every few
 * customers a "special order" asks a spelling question (handled by the screen) for a big tip.
 */
export interface ArcadeSave {
  level: number;
  cash: number;
  served: number;
  bought: string[];
}

export interface Hud {
  cash: number;
  carrying: number;
  capacity: number;
  progress: number;
  level: number;
  served: number;
}

export interface EngineEvents {
  hud: (h: Hud) => void;
  special: (answer: (correct: boolean) => void) => void;
  toast: (text: string) => void;
  levelUp: (level: number) => void;
}

interface Station {
  pos: THREE.Vector3;
  pick: THREE.Vector3;
  makes: ProductKind;
  /** a machine that turns raw material into the product */
  needs?: ProductKind;
  input: number;
  out: THREE.Object3D[];
  cap: number;
  timer: number;
  root: THREE.Group;
}

interface Seat {
  pos: THREE.Vector3;
  customer: Customer | null;
  cash: number;
  cashMeshes: THREE.Object3D[];
}

interface Customer {
  c: Character;
  state: 'in' | 'wait' | 'pay' | 'out';
  target: THREE.Vector3;
  want: number;
  got: number;
  special: boolean;
  seat?: Seat;
  bubble: THREE.Sprite;
  timer: number;
  held: THREE.Object3D[];
}

interface Pad {
  id: string;
  title: string;
  pos: THREE.Vector3;
  cost: number;
  paid: number;
  root: THREE.Group;
  text: THREE.Sprite;
}

const PAD_ORDER = ['station2', 'speed', 'carry', 'helper', 'decor', 'more'] as const;
const PAD_TITLE: Record<(typeof PAD_ORDER)[number], string> = {
  station2: 'עמדה נוספת',
  speed: 'מכונה מהירה',
  carry: 'ידיים חזקות',
  helper: 'עובד עוזר',
  decor: 'קישוטים',
  more: 'עוד לקוחות',
};

export class TycoonEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private raf = 0;
  private last = 0;
  private clock = 0;
  private paused = false;
  private disposed = false;

  private player: Character;
  private pPos = new THREE.Vector3(0, 0, -1.4);
  private carry: { kind: ProductKind | null; items: THREE.Object3D[] } = { kind: null, items: [] };
  private capacity = 3;
  private speed = 3.6;
  private moving = false;

  private stations: Station[] = [];
  private seats: Seat[] = [];
  private customers: Customer[] = [];
  private counter: { pos: THREE.Vector3; drop: THREE.Vector3; items: THREE.Object3D[] } | null = null;
  private cashPad = { pos: new THREE.Vector3(3.2, 0, -1.5), amount: 0, meshes: [] as THREE.Object3D[] };
  private pad: Pad | null = null;
  private helper: { c: Character; pos: THREE.Vector3; carry: THREE.Object3D[]; kind: ProductKind | null; state: 'get' | 'give' } | null = null;

  private spawnTimer = 1;
  private spawnEvery = 5;
  private interval = 2.2;
  private tipMult = 1;
  private actTimer = 0;
  private customerCount = 0;
  private joy = { active: false, x0: 0, y0: 0, dx: 0, dy: 0 };
  private keys = new Set<string>();
  private joyEl: HTMLDivElement;
  private knobEl: HTMLDivElement;
  private door = new THREE.Vector3(7.2, 0, 1.2);
  private save: ArcadeSave;

  constructor(
    private container: HTMLElement,
    private theme: Theme,
    save: ArcadeSave,
    private ev: EngineEvents,
  ) {
    this.save = { ...save, bought: [...save.bought] };
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);

    this.buildWorld();
    this.player = person(3, new THREE.Color(theme.accent).getHex(), 0xffffff);
    this.scene.add(this.player.root);
    for (const id of this.save.bought) this.apply(id as (typeof PAD_ORDER)[number], true);
    this.nextPad();

    // finger joystick
    this.joyEl = document.createElement('div');
    this.knobEl = document.createElement('div');
    Object.assign(this.joyEl.style, { position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', background: 'rgba(255,255,255,.35)', border: '3px solid rgba(255,255,255,.8)', display: 'none', pointerEvents: 'none', transform: 'translate(-50%,-50%)' });
    Object.assign(this.knobEl.style, { position: 'absolute', width: '46px', height: '46px', borderRadius: '50%', background: 'rgba(255,255,255,.95)', left: '32px', top: '32px', boxShadow: '0 3px 8px rgba(0,0,0,.25)' });
    this.joyEl.appendChild(this.knobEl);
    container.appendChild(this.joyEl);
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.emitHud();
  }

  // ---------- world ----------
  private buildWorld() {
    const t = this.theme;
    this.scene.background = new THREE.Color('#cfe8ff');
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8d7a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
    sun.position.set(6, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // tiled floor
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = t.floor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillRect(64, 64, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 6);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(15, 0.2, 11), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // outside ground and walls (back and left), like a cut-away building
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat(0x8ce99a, 1));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.21;
    this.scene.add(ground);
    this.scene.add(rbox(15.2, 2.2, 0.3, t.wall, 0, 1.1, -5.65, 0.05), rbox(0.3, 2.2, 11.3, t.wall, -7.65, 1.1, 0, 0.05));
    this.scene.add(rbox(15.2, 0.25, 0.32, '#ffffff', 0, 2.3, -5.65, 0.05), rbox(0.32, 0.25, 11.3, '#ffffff', -7.65, 2.3, 0, 0.05));
    const sign = label(`${t.emoji} ${t.name}`, '#ffffff', t.accent, 1.6);
    sign.position.set(0, 3, -5.5);
    this.scene.add(sign);
    // entrance mat
    this.scene.add(rbox(1.4, 0.03, 1.8, t.accent, 6.8, 0.02, this.door.z, 0.01));

    if (t.kind === 'line') {
      this.addStation(new THREE.Vector3(-5.2, 0, -4.1), t.raw!, t.rawStation!);
      this.addStation(new THREE.Vector3(-2.4, 0, -4.1), t.product, t.station, t.raw);
    } else this.addStation(new THREE.Vector3(-4.2, 0, -4.1), t.product, t.station);

    if (t.kind === 'seats') {
      for (const x of [-4.6, -2.2, 0.2]) this.addSeat(x);
      this.cashPad.pos.set(99, 0, 99);
    } else {
      const pos = new THREE.Vector3(1.6, 0, -0.4);
      const ctr = group(rbox(2.2, 0.9, 0.7, t.accent, 0, 0.45, 0, 0.06), rbox(2.3, 0.08, 0.8, '#ffffff', 0, 0.92, 0, 0.03));
      ctr.position.copy(pos);
      this.scene.add(ctr);
      const reg = group(rbox(0.4, 0.3, 0.3, 0x343a40, 0, 1.1, 0), rbox(0.34, 0.2, 0.03, 0x74c0fc, 0, 1.2, 0.16));
      reg.position.set(pos.x + 0.8, 0, pos.z);
      this.scene.add(reg);
      this.counter = { pos, drop: new THREE.Vector3(pos.x - 0.4, 0, pos.z - 1.0), items: [] };
      this.ring(this.counter.drop, 0.55, '#ffffff');
      this.ring(this.cashPad.pos, 0.55, '#b2f2bb');
    }
    // some furniture to make the place feel alive
    for (const [x, z] of [
      [-6.4, 3.8],
      [6.4, -4.4],
    ])
      this.scene.add(group(cyl(0.25, 0.2, 0.4, 0x8d5a2b, x, 0.2, z), sph(0.38, 0x40c057, x, 0.7, z)));
  }

  private ring(pos: THREE.Vector3, r: number, color: string) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.02, pos.z);
    this.scene.add(m);
    return m;
  }

  private addStation(pos: THREE.Vector3, makes: ProductKind, name: string, needs?: ProductKind) {
    const t = this.theme;
    const root = group(rbox(1.5, 1.0, 0.9, '#f1f3f5', 0, 0.5, 0, 0.08), rbox(1.56, 0.1, 0.96, t.accent, 0, 1.02, 0, 0.04), rbox(1.2, 0.5, 0.06, '#495057', 0, 0.6, 0.46, 0.03));
    const icon = product(makes);
    icon.scale.setScalar(1.6);
    icon.position.set(0, 1.1, -0.15);
    root.add(icon);
    const tag = label(name, '#212529', 'rgba(255,255,255,.95)', 0.85);
    tag.position.set(0, 2.0, 0);
    root.add(tag);
    root.position.copy(pos);
    this.scene.add(root);
    const pick = new THREE.Vector3(pos.x, 0, pos.z + 1.05);
    this.ring(pick, 0.55, needs ? '#ffe066' : '#ffffff');
    this.stations.push({ pos, pick, makes, needs, input: 0, out: [], cap: 8, timer: 0, root });
  }

  private addSeat(x: number) {
    const t = this.theme;
    const pos = new THREE.Vector3(x, 0, 2.7);
    const base = t.customer === 'car' ? group(rbox(1.6, 0.04, 2.2, '#ffffff', 0, 0.02, 0, 0.01), rbox(0.3, 1.2, 0.3, t.accent, -1.0, 0.6, -0.6)) : group(rbox(0.9, 0.45, 1.6, '#ffffff', 0, 0.22, 0, 0.08), rbox(0.92, 0.12, 0.5, t.accent, 0, 0.5, -0.55, 0.05));
    base.position.copy(pos);
    this.scene.add(base);
    const tag = label(t.seat ?? '', '#495057', 'rgba(255,255,255,.85)', 0.6);
    tag.position.set(x, 1.6, pos.z - 0.9);
    this.scene.add(tag);
    this.seats.push({ pos, customer: null, cash: 0, cashMeshes: [] });
  }

  // ---------- upgrades ----------
  private padCost(i: number) {
    return Math.round((25 + i * 22) * (1 + this.save.level * 0.7));
  }

  private nextPad() {
    if (this.pad) {
      this.scene.remove(this.pad.root);
      this.pad = null;
    }
    const i = PAD_ORDER.findIndex((id) => !this.save.bought.includes(id));
    if (i < 0) return this.levelUp();
    const id = PAD_ORDER[i];
    const spots: Record<string, [number, number]> = { station2: [-1.0, -3.0], speed: [-5.6, -1.4], carry: [-1.2, 0.4], helper: [4.8, -3.6], decor: [-5.6, 0.6], more: [4.6, 3.6] };
    const [x, z] = spots[id];
    const pos = new THREE.Vector3(x, 0, z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 32), new THREE.MeshStandardMaterial({ color: '#ffd43b', emissive: '#ffd43b', emissiveIntensity: 0.25 }));
    disc.position.y = 0.03;
    const cost = this.padCost(i);
    const text = label(`${PAD_TITLE[id]} · ${cost}💵`, '#212529', 'rgba(255,255,255,.95)', 0.75);
    text.position.y = 0.9;
    const root = group(disc, text);
    root.position.copy(pos);
    this.scene.add(root);
    this.pad = { id, title: PAD_TITLE[id], pos, cost, paid: 0, root, text };
  }

  private apply(id: (typeof PAD_ORDER)[number], silent = false) {
    const t = this.theme;
    if (id === 'station2') {
      if (t.kind === 'line') this.addStation(new THREE.Vector3(0.4, 0, -4.1), t.product, t.station, t.raw);
      else this.addStation(new THREE.Vector3(-1.6, 0, -4.1), t.product, t.station);
      if (t.kind === 'seats') for (const x of [2.6, 5.0]) this.addSeat(x);
    } else if (id === 'speed') this.interval = 1.4;
    else if (id === 'carry') this.capacity = 5;
    else if (id === 'helper') {
      const c = person(11, 0x868e96, new THREE.Color(t.accent).getHex());
      const pos = new THREE.Vector3(-3, 0, -2);
      c.root.position.copy(pos);
      this.scene.add(c.root);
      this.helper = { c, pos, carry: [], kind: null, state: 'get' };
    } else if (id === 'decor') {
      this.tipMult = 1.3;
      for (const [x, z] of [
        [-6.6, -1],
        [-6.6, 1.6],
        [5.4, -4.6],
      ])
        this.scene.add(group(cyl(0.2, 0.16, 0.35, t.accent, x, 0.17, z), sph(0.32, 0xf783ac, x, 0.6, z), sph(0.18, 0xffd43b, x + 0.15, 0.75, z)));
    } else if (id === 'more') this.spawnEvery = 3.2;
    if (!silent) this.ev.toast(`✨ ${PAD_TITLE[id]}!`);
  }

  private levelUp() {
    this.save.level += 1;
    this.save.bought = [];
    this.ev.levelUp(this.save.level);
    this.nextPad();
    this.emitHud();
  }

  // ---------- input ----------
  private onDown = (e: PointerEvent) => {
    this.joy = { active: true, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    const r = this.container.getBoundingClientRect();
    Object.assign(this.joyEl.style, { display: 'block', left: `${e.clientX - r.left}px`, top: `${e.clientY - r.top}px` });
    this.knobEl.style.transform = 'translate(0,0)';
  };
  private onMove = (e: PointerEvent) => {
    if (!this.joy.active) return;
    let dx = e.clientX - this.joy.x0;
    let dy = e.clientY - this.joy.y0;
    const len = Math.hypot(dx, dy);
    const max = 40;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.joy.dx = dx / max;
    this.joy.dy = dy / max;
    this.knobEl.style.transform = `translate(${dx}px,${dy}px)`;
  };
  private onUp = () => {
    this.joy.active = false;
    this.joy.dx = this.joy.dy = 0;
    this.joyEl.style.display = 'none';
  };
  private onKey = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      this.keys.add(e.key);
      e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key);

  private resize = () => {
    const w = this.container.clientWidth || 360;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    const view = 7.2;
    const aspect = w / h;
    Object.assign(this.camera, { left: -view * aspect, right: view * aspect, top: view, bottom: -view });
    this.camera.updateProjectionMatrix();
  };

  // ---------- loop ----------
  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause(p: boolean) {
    this.paused = p;
  }

  getSave(): ArcadeSave {
    return { ...this.save, bought: [...this.save.bought] };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.joyEl.remove();
  }

  private emitHud() {
    const i = PAD_ORDER.findIndex((id) => !this.save.bought.includes(id));
    this.ev.hud({ cash: Math.floor(this.save.cash), carrying: this.carry.items.length, capacity: this.capacity, progress: (i < 0 ? PAD_ORDER.length : i) / PAD_ORDER.length, level: this.save.level, served: this.save.served });
  }

  private update(dt: number) {
    this.clock += dt;
    this.actTimer -= dt;
    this.movePlayer(dt);
    this.produce(dt);
    this.spawn(dt);
    this.updateCustomers(dt);
    if (this.helper) this.updateHelper(dt);
    if (this.actTimer <= 0) this.interact();
    // camera follows the player
    const target = new THREE.Vector3(this.pPos.x * 0.6, 0, this.pPos.z * 0.6);
    const camPos = target.clone().add(new THREE.Vector3(10, 12, 10));
    this.camera.position.lerp(camPos, 0.08);
    this.camera.lookAt(this.camera.position.clone().sub(new THREE.Vector3(10, 12, 10)));
  }

  private movePlayer(dt: number) {
    let dx = this.joy.dx;
    let dy = this.joy.dy;
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) dx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('d')) dx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('w')) dy -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('s')) dy += 1;
    const len = Math.hypot(dx, dy);
    this.moving = len > 0.15;
    if (this.moving) {
      // screen right = world (1,0,-1), screen up = world (-1,0,-1); joystick dy is screen-down
      const wx = (dx + dy) / Math.SQRT2;
      const wz = (-dx + dy) / Math.SQRT2;
      const n = Math.min(1, len);
      const l = Math.hypot(wx, wz);
      this.pPos.x = THREE.MathUtils.clamp(this.pPos.x + (wx / l) * this.speed * n * dt, -7.1, 7.1);
      this.pPos.z = THREE.MathUtils.clamp(this.pPos.z + (wz / l) * this.speed * n * dt, -4.9, 5.1);
      this.player.root.rotation.y = Math.atan2(wx, wz);
    }
    this.player.root.position.copy(this.pPos);
    animateWalk(this.player, this.clock, this.moving, this.carry.items.length > 0);
  }

  private produce(dt: number) {
    for (const s of this.stations) {
      if (s.out.length >= s.cap) continue;
      if (s.needs && s.input <= 0) continue;
      s.timer += dt;
      if (s.timer < (s.needs ? this.interval * 0.8 : this.interval)) continue;
      s.timer = 0;
      if (s.needs) s.input -= 1;
      const item = product(s.makes);
      const k = s.out.length;
      item.position.set(s.pos.x + ((k % 2) - 0.5) * 0.4, 1.12 + Math.floor(k / 2) * 0.28, s.pos.z + 0.28);
      item.scale.setScalar(0.01);
      this.scene.add(item);
      s.out.push(item);
    }
    // pop-in animation
    for (const s of this.stations) for (const it of s.out) if (it.scale.x < 1) it.scale.setScalar(Math.min(1, it.scale.x + dt * 5));
  }

  private spawn(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.spawnEvery * (0.8 + Math.random() * 0.4);
    const t = this.theme;
    let seat: Seat | undefined;
    if (t.kind === 'seats') {
      seat = this.seats.find((s) => !s.customer);
      if (!seat) return;
    } else if (this.customers.filter((c) => c.state !== 'out').length >= 6) return;
    this.customerCount += 1;
    const c = t.customer === 'car' ? car(this.customerCount) : person(this.customerCount);
    c.root.position.copy(this.door);
    this.scene.add(c.root);
    const special = this.customerCount % 4 === 0;
    const want = 1 + Math.floor(Math.random() * Math.min(3, 1 + this.save.level + (this.save.bought.length > 2 ? 1 : 0)));
    const bubble = label(`${special ? '✨ ' : ''}${t.emoji} ×${want}`, '#212529', special ? '#fff3bf' : 'rgba(255,255,255,.95)', 0.8);
    bubble.position.y = t.customer === 'car' ? 1.6 : 1.85;
    bubble.visible = false;
    c.root.add(bubble);
    const cust: Customer = { c, state: 'in', target: new THREE.Vector3(), want, got: 0, special, seat, bubble, timer: 0, held: [] };
    if (seat) {
      seat.customer = cust;
      cust.target.copy(seat.pos);
    }
    this.customers.push(cust);
    this.layoutQueue();
  }

  /** Queue places in front of the counter, towards the door. */
  private layoutQueue() {
    if (!this.counter) return;
    const q = this.customers.filter((c) => c.state === 'in' || c.state === 'wait');
    q.forEach((c, k) => c.target.set(this.counter!.pos.x - 0.2 + k * 0.95, 0, this.counter!.pos.z + 1.0 + (k > 4 ? 0.9 : 0)));
  }

  private walk(c: Character, pos: THREE.Vector3, target: THREE.Vector3, speed: number, dt: number): boolean {
    const d = target.clone().sub(pos);
    d.y = 0;
    const l = d.length();
    if (l < 0.05) {
      animateWalk(c, this.clock, false, false);
      return true;
    }
    pos.add(d.multiplyScalar(Math.min(l, speed * dt) / l));
    c.root.position.copy(pos);
    c.root.rotation.y = Math.atan2(target.x - pos.x, target.z - pos.z);
    animateWalk(c, this.clock, true, false);
    return false;
  }

  private updateCustomers(dt: number) {
    const front = this.customers.find((c) => c.state === 'wait' && !c.seat);
    for (const cu of [...this.customers]) {
      const pos = cu.c.root.position;
      if (cu.state === 'in') {
        if (this.walk(cu.c, pos, cu.target, 2.2, dt)) {
          cu.state = 'wait';
          cu.bubble.visible = true;
          cu.c.root.rotation.y = Math.PI;
          // patients lie down on the bed
          if (cu.seat && this.theme.seat === 'מיטה') {
            cu.c.root.rotation.set(-Math.PI / 2, 0, 0);
            pos.y = 0.5;
            pos.z += 0.5;
            cu.bubble.position.set(0, 0.2, 1.4);
          }
        }
      } else if (cu.state === 'wait') {
        this.walk(cu.c, pos, cu.target, 2.2, dt);
        // counter customers take products from the counter, one at a time
        if (!cu.seat && cu === front && this.counter && this.counter.items.length) {
          cu.timer -= dt;
          if (cu.timer <= 0) {
            cu.timer = 0.3;
            const it = this.counter.items.pop()!;
            this.scene.remove(it);
            this.give(cu);
          }
        }
      } else if (cu.state === 'out') {
        if (pos.y > 0) {
          pos.y = 0;
          cu.c.root.rotation.set(0, 0, 0);
        }
        if (this.walk(cu.c, pos, this.door, 2.6, dt)) {
          this.scene.remove(cu.c.root);
          this.customers.splice(this.customers.indexOf(cu), 1);
        }
      }
    }
  }

  /** One product handed to a customer; when the order is complete they pay (special: a spelling question first). */
  private give(cu: Customer) {
    cu.got += 1;
    const held = product(this.theme.product);
    held.position.y = cu.held.length * 0.25;
    cu.c.hands.add(held);
    cu.held.push(held);
    cu.bubble.visible = cu.got < cu.want;
    if (cu.got < cu.want) return;
    cu.state = 'pay';
    const pay = (mult: number) => {
      const amount = Math.round(this.theme.price * cu.want * this.tipMult * mult * (1 + this.save.level * 0.25));
      if (cu.seat) {
        cu.seat.cash += amount;
        this.stackCash(cu.seat.cashMeshes, new THREE.Vector3(cu.seat.pos.x + 0.9, 0, cu.seat.pos.z + 0.6), amount);
        cu.seat.customer = null;
      } else {
        this.cashPad.amount += amount;
        this.stackCash(this.cashPad.meshes, this.cashPad.pos, amount);
      }
      this.save.served += 1;
      cu.state = 'out';
      this.layoutQueue();
      this.emitHud();
    };
    if (cu.special) {
      this.paused = true;
      this.ev.special((correct) => {
        this.paused = false;
        if (correct) this.ev.toast('✨ טיפ ענק ×3!');
        pay(correct ? 3 : 1);
      });
    } else pay(1);
  }

  private stackCash(list: THREE.Object3D[], at: THREE.Vector3, amount: number) {
    const n = Math.min(3, Math.ceil(amount / 10));
    for (let i = 0; i < n && list.length < 24; i++) {
      const m = cashBundle();
      const k = list.length;
      m.position.set(at.x + ((k % 2) - 0.5) * 0.4, 0.05 + Math.floor(k / 2) * 0.075, at.z);
      this.scene.add(m);
      list.push(m);
    }
  }

  private near(p: THREE.Vector3, r = 0.85) {
    return Math.hypot(this.pPos.x - p.x, this.pPos.z - p.z) < r;
  }

  private hold(item: THREE.Object3D) {
    item.position.set(0, this.carry.items.length * 0.26, 0);
    item.scale.setScalar(1);
    this.player.hands.add(item);
    this.carry.items.push(item);
  }

  private interact() {
    let acted = false;
    // stations: put raw material in, take products out
    for (const s of this.stations) {
      if (!this.near(s.pick)) continue;
      if (s.needs && this.carry.kind === s.needs && this.carry.items.length) {
        this.player.hands.remove(this.carry.items.pop()!);
        if (!this.carry.items.length) this.carry.kind = null;
        s.input += 1;
        acted = true;
      } else if (s.out.length && this.carry.items.length < this.capacity && (this.carry.kind === null || this.carry.kind === s.makes)) {
        const it = s.out.pop()!;
        this.scene.remove(it);
        this.carry.kind = s.makes;
        this.hold(it);
        acted = true;
      }
    }
    const isProduct = this.carry.kind === this.theme.product;
    // counter: drop the products
    if (this.counter && isProduct && this.carry.items.length && this.near(this.counter.drop, 1.0) && this.counter.items.length < 12) {
      const it = this.carry.items.pop()!;
      this.player.hands.remove(it);
      const k = this.counter.items.length;
      it.position.set(this.counter.pos.x - 0.7 + (k % 4) * 0.35, 0.98 + Math.floor(k / 4) * 0.25, this.counter.pos.z);
      this.scene.add(it);
      this.counter.items.push(it);
      if (!this.carry.items.length) this.carry.kind = null;
      acted = true;
    }
    // seats: hand the product to the waiting customer
    for (const seat of this.seats) {
      const cu = seat.customer;
      if (cu && cu.state === 'wait' && isProduct && this.carry.items.length && this.near(seat.pos, 1.5)) {
        this.player.hands.remove(this.carry.items.pop()!);
        if (!this.carry.items.length) this.carry.kind = null;
        this.give(cu);
        acted = true;
        break;
      }
      if (seat.cash > 0 && this.near(new THREE.Vector3(seat.pos.x + 0.9, 0, seat.pos.z + 0.6), 1.0)) {
        this.collect(seat.cash, seat.cashMeshes);
        seat.cash = 0;
      }
    }
    // cash
    if (this.cashPad.amount > 0 && this.near(this.cashPad.pos, 1.0)) {
      this.collect(this.cashPad.amount, this.cashPad.meshes);
      this.cashPad.amount = 0;
    }
    // upgrade pad: pay little by little while standing on it
    if (this.pad && this.save.cash > 0 && this.near(this.pad.pos, 0.8)) {
      const step = Math.min(this.save.cash, Math.max(1, Math.ceil(this.pad.cost / 25)), this.pad.cost - this.pad.paid);
      this.save.cash -= step;
      this.pad.paid += step;
      const left = this.pad.cost - this.pad.paid;
      this.pad.root.remove(this.pad.text);
      this.pad.text = label(left > 0 ? `${this.pad.title} · ${left}💵` : '✔', '#212529', 'rgba(255,255,255,.95)', 0.75);
      this.pad.text.position.y = 0.9;
      this.pad.root.add(this.pad.text);
      if (left <= 0) {
        const id = this.pad.id as (typeof PAD_ORDER)[number];
        this.save.bought.push(id);
        this.apply(id);
        this.nextPad();
      }
      this.emitHud();
      this.actTimer = 0.05;
      return;
    }
    if (acted) {
      this.actTimer = 0.15;
      this.emitHud();
    }
  }

  private collect(amount: number, meshes: THREE.Object3D[]) {
    this.save.cash += amount;
    for (const m of meshes) this.scene.remove(m);
    meshes.length = 0;
    this.ev.toast(`+${amount}💵`);
    this.emitHud();
  }

  /** The helper carries products from the stations to the counter (or the seats) on their own. */
  private updateHelper(dt: number) {
    const h = this.helper!;
    if (h.state === 'get') {
      const s = this.stations.find((x) => x.makes === this.theme.product && x.out.length);
      if (!s) return animateWalk(h.c, this.clock, false, false);
      if (this.walk(h.c, h.pos, s.pick, 2.0, dt)) {
        while (s.out.length && h.carry.length < 2) {
          const it = s.out.pop()!;
          this.scene.remove(it);
          it.position.set(0, h.carry.length * 0.26, 0);
          h.c.hands.add(it);
          h.carry.push(it);
        }
        h.state = 'give';
      }
    } else {
      const seat = this.seats.find((x) => x.customer?.state === 'wait');
      const target = this.counter ? this.counter.drop : seat ? seat.pos.clone().add(new THREE.Vector3(0.9, 0, -0.6)) : null;
      if (!target) return animateWalk(h.c, this.clock, false, true);
      if (this.walk(h.c, h.pos, target, 2.0, dt)) {
        while (h.carry.length) {
          const it = h.carry.pop()!;
          h.c.hands.remove(it);
          if (this.counter && this.counter.items.length < 12) {
            const k = this.counter.items.length;
            it.position.set(this.counter.pos.x - 0.7 + (k % 4) * 0.35, 0.98 + Math.floor(k / 4) * 0.25, this.counter.pos.z);
            this.scene.add(it);
            this.counter.items.push(it);
          } else if (seat?.customer && seat.customer.state === 'wait') this.give(seat.customer);
        }
        h.state = 'get';
      }
    }
  }
}

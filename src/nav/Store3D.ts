import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Route, Pt } from '../route';
import type { StoreMap } from '../types';

// Three.js view of a store map with a Waze-style route.
// Grid (row, col) maps to world (x = col, z = row); one cell = one unit.

export type CameraMode = 'follow' | 'overview';

export interface ShelfLabel {
  text: string;
  hue: number | null;
  cells: Pt[];
}

const ROUTE_BLUE = 0x2f7ff5;
const ROUTE_DONE = 0x9aa4b2;
const PIN_NEXT = 0xff5a36;
const PIN_TODO = 0x2f7ff5;
const PIN_DONE = 0x22a060;

function textSprite(text: string, opts: { bg: string; fg: string; size?: number }) {
  const scale = 2;
  const font = `700 ${28 * scale}px Heebo, Arial, sans-serif`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 36 * scale;
  const h = 48 * scale;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = opts.bg;
  const r = h / 2;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  ctx.fillStyle = opts.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const size = opts.size ?? 0.5;
  sprite.scale.set((size * w) / h, size, 1);
  sprite.renderOrder = 10;
  return sprite;
}

const toWorld = ([r, c]: Pt, y = 0) => new THREE.Vector3(c, y, r);

export class Store3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private frame = 0;
  private routeGroup = new THREE.Group();
  private pins: { group: THREE.Group; next: boolean }[] = [];
  private walker: THREE.Mesh;
  private walkerCurve: THREE.CatmullRomCurve3 | null = null;
  private mode: CameraMode = 'follow';
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private resizeObs: ResizeObserver;
  private clock = new THREE.Clock();

  constructor(
    private host: HTMLElement,
    private map: StoreMap,
    private route: Route,
    labels: ShelfLabel[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xe9eef5);
    this.scene.fog = new THREE.Fog(0xe9eef5, 18, 45);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 40;
    this.controls.enabled = false;

    this.buildStore(labels);
    this.scene.add(this.routeGroup);

    const walkerGeo = new THREE.ConeGeometry(0.28, 0.6, 3);
    walkerGeo.rotateX(Math.PI / 2);
    this.walker = new THREE.Mesh(walkerGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: ROUTE_BLUE, emissiveIntensity: 0.6 }));
    this.walker.position.y = 0.35;
    this.scene.add(this.walker);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.resize();
    this.loop();
  }

  private buildStore(labels: ShelfLabel[]) {
    const { rows, cols } = this.map;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c3d0, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(cols * 0.3, 18, rows * 0.2);
    sun.target.position.set(cols / 2, 0, rows / 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = Math.max(rows, cols);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
    this.scene.add(sun, sun.target);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols + 2, rows + 2), new THREE.MeshStandardMaterial({ color: 0xf7f8fa }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((cols - 1) / 2, 0, (rows - 1) / 2);
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(Math.max(rows, cols) + 2, Math.max(rows, cols) + 2, 0xdfe4ea, 0xe7ebf0);
    grid.position.set((cols - 1) / 2, 0.002, (rows - 1) / 2);
    this.scene.add(grid);

    const hueOf = new Map<string, number | null>();
    for (const l of labels) for (const [r, c] of l.cells) hueOf.set(`${r},${c}`, l.hue);
    const box = new THREE.BoxGeometry(0.94, 1, 0.94);
    for (const [k, cell] of Object.entries(this.map.cells)) {
      const [r, c] = k.split(',').map(Number);
      if (r >= rows || c >= cols) continue;
      if (cell.kind === 'shelf') {
        const hue = hueOf.get(k);
        const color = hue === null || hue === undefined ? new THREE.Color(0xc9b79c) : new THREE.Color().setHSL(hue / 360, 0.5, 0.68);
        const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
        m.scale.y = 1.3;
        m.position.set(c, 0.65, r);
        m.castShadow = m.receiveShadow = true;
        this.scene.add(m);
      } else if (cell.kind === 'wall') {
        const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x4b5563 }));
        m.scale.y = 1.8;
        m.position.set(c, 0.9, r);
        m.castShadow = true;
        this.scene.add(m);
      } else if (cell.kind === 'checkout') {
        const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xf6c343 }));
        m.scale.set(0.9, 0.8, 0.5);
        m.position.set(c, 0.4, r);
        m.castShadow = true;
        this.scene.add(m);
      } else if (cell.kind === 'entrance') {
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshStandardMaterial({ color: 0x34c77b }));
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(c, 0.01, r);
        this.scene.add(tile);
        const sign = textSprite('🚪 כניסה', { bg: '#1f9d5c', fg: '#fff', size: 0.45 });
        sign.position.set(c, 1.2, r);
        this.scene.add(sign);
      }
    }
    const checkout = Object.entries(this.map.cells).find(([, c]) => c.kind === 'checkout');
    if (checkout) {
      const [r, c] = checkout[0].split(',').map(Number);
      const sign = textSprite('💳 קופות', { bg: '#b7791f', fg: '#fff', size: 0.45 });
      sign.position.set(c, 1.4, r);
      this.scene.add(sign);
    }
    for (const l of labels) {
      if (!l.cells.length) continue;
      const cx = l.cells.reduce((a, [, c]) => a + c, 0) / l.cells.length;
      const cz = l.cells.reduce((a, [r]) => a + r, 0) / l.cells.length;
      const color = l.hue === null ? '#6b5b45' : `hsl(${l.hue} 45% 32%)`;
      const sprite = textSprite(l.text, { bg: 'rgba(255,255,255,0.92)', fg: color, size: 0.34 });
      sprite.position.set(cx, 1.75, cz);
      this.scene.add(sprite);
    }
  }

  /** Redraws the route: legs before `current` greyed out, the current leg bold. */
  setProgress(current: number, doneStops: Set<number>) {
    this.routeGroup.clear();
    this.pins = [];
    const legs = this.route.stops.map((s) => s.leg);
    const drawLeg = (pts: Pt[], color: number, radius: number) => {
      if (pts.length < 2) return null;
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => toWorld(p, 0.06)), false, 'catmullrom', 0.1);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 8, radius, 8, false), new THREE.MeshBasicMaterial({ color }));
      this.routeGroup.add(tube);
      return curve;
    };
    legs.forEach((leg, i) => {
      if (i === current) return;
      drawLeg(leg, i < current ? ROUTE_DONE : ROUTE_BLUE, i < current ? 0.05 : 0.08);
    });
    const exitCurrent = current >= legs.length;
    if (!exitCurrent) this.walkerCurve = drawLeg(legs[current], ROUTE_BLUE, 0.14);
    if (this.route.exit.length > 1) {
      const c = drawLeg(this.route.exit, exitCurrent ? ROUTE_BLUE : 0x7fb0ff, exitCurrent ? 0.14 : 0.06);
      if (exitCurrent) this.walkerCurve = c;
    } else if (exitCurrent) this.walkerCurve = null;

    this.route.stops.forEach((stop, i) => {
      const g = new THREE.Group();
      const isNext = i === current;
      const done = doneStops.has(i);
      const color = isNext ? PIN_NEXT : done ? PIN_DONE : PIN_TODO;
      const head = new THREE.Mesh(new THREE.SphereGeometry(isNext ? 0.26 : 0.18, 20, 16), new THREE.MeshStandardMaterial({ color }));
      head.position.y = isNext ? 1.1 : 0.8;
      const stem = new THREE.Mesh(new THREE.ConeGeometry(isNext ? 0.15 : 0.1, isNext ? 0.6 : 0.45, 16), new THREE.MeshStandardMaterial({ color }));
      stem.rotation.x = Math.PI;
      stem.position.y = isNext ? 0.72 : 0.55;
      g.add(head, stem);
      const tag = textSprite(done ? '✓' : String(i + 1), { bg: done ? '#22a060' : isNext ? '#ff5a36' : '#2f7ff5', fg: '#fff', size: isNext ? 0.4 : 0.3 });
      tag.position.y = isNext ? 1.6 : 1.2;
      g.add(tag);
      // Stand the pin between the walkway and the shelf so it reads as "on this shelf".
      const p = toWorld(stop.point).lerp(toWorld(stop.shelf), 0.35);
      g.position.set(p.x, 0, p.z);
      this.routeGroup.add(g);
      this.pins.push({ group: g, next: isNext });
    });
    this.aimCamera(current);
  }

  private aimCamera(current: number) {
    const stops = this.route.stops;
    const from = current === 0 ? this.route.start : current <= stops.length ? stops[current - 1].point : this.route.start;
    const to = current < stops.length ? stops[current].point : this.route.exit[this.route.exit.length - 1] ?? from;
    const a = toWorld(from);
    const b = toWorld(to);
    const dir = b.clone().sub(a);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
    dir.normalize();
    this.camTarget.copy(a.clone().lerp(b, 0.55));
    // Behind and above the walker, looking along the leg (Waze-style chase view).
    const dist = Math.max(8.5, a.distanceTo(b) * 0.8 + 6);
    this.camPos.copy(a).addScaledVector(dir, -dist * 0.55).add(new THREE.Vector3(0, dist * 0.9, 0));
    this.walker.position.set(a.x, 0.35, a.z);
    this.walker.lookAt(b.x, 0.35, b.z);
  }

  setCameraMode(mode: CameraMode) {
    this.mode = mode;
    this.controls.enabled = mode === 'overview';
    if (mode === 'overview') {
      const { rows, cols } = this.map;
      this.controls.target.set((cols - 1) / 2, 0, (rows - 1) / 2);
      this.camera.position.set((cols - 1) / 2, Math.max(rows, cols) * 1.15, rows * 1.05);
    }
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    if (this.mode === 'follow') {
      this.camera.position.lerp(this.camPos, 0.06);
      this.lookAt.lerp(this.camTarget, 0.08);
      this.camera.lookAt(this.lookAt);
    } else {
      this.controls.update();
    }
    // Pulse the next pin and glide the walker along the current leg.
    for (const { group, next } of this.pins) group.position.y = next ? Math.abs(Math.sin(t * 3)) * 0.18 : 0;
    if (this.walkerCurve) {
      const u = (t * 0.35) % 1;
      const p = this.walkerCurve.getPointAt(u);
      const q = this.walkerCurve.getPointAt(Math.min(1, u + 0.02));
      this.walker.position.set(p.x, 0.35, p.z);
      this.walker.lookAt(q.x, 0.35, q.z);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
        (x as THREE.SpriteMaterial).map?.dispose();
        x.dispose();
      });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { FIELD, type PitchEnv } from './physics';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow';
export type TimeOfDay = 'day' | 'dusk' | 'night';

export interface StadiumOptions {
  weather: Weather;
  time: TimeOfDay;
  homeColors: string[];
  awayColors: string[];
  quality: 'high' | 'low';
  name: string;
  turf?: 'hybrid' | 'old' | 'normal'; // old pitches cut up quickly, hybrid grass barely marks
}

const AREA_L = 122; // grass area incl. surround
const AREA_W = 84;

interface Puddle {
  x: number;
  z: number;
  r: number;
}

export class Stadium {
  group = new THREE.Group();
  env: PitchEnv;
  sun: THREE.DirectionalLight;
  private wearCanvas: HTMLCanvasElement;
  private wearCtx: CanvasRenderingContext2D;
  private wearTex: THREE.CanvasTexture;
  private wearDirty = false;
  private wearTimer = 0;
  private puddles: Puddle[] = [];
  private crowdMats: THREE.Material[] = [];
  private crowdUniforms = { uTime: { value: 0 }, uExcite: { value: 0.2 } };
  private nets: { side: number; geo: THREE.BufferGeometry; base: Float32Array; hits: { z: number; y: number; a: number; t: number }[] }[] = [];
  private flags: THREE.Mesh[] = [];
  private adTextures: THREE.Texture[] = [];
  private precip: THREE.LineSegments | THREE.Points | null = null;
  private precipVel = new THREE.Vector3();
  private time = 0;
  readonly opts: StadiumOptions;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, opts: StadiumOptions) {
    this.opts = opts;
    const wet = opts.weather === 'rain';
    const snow = opts.weather === 'snow';
    this.env = {
      rollMu: wet ? 0.045 : snow ? 0.11 : 0.065,
      grassDrag: wet ? 0.1 : snow ? 0.22 : 0.14,
      bounce: wet ? 0.5 : snow ? 0.38 : 0.62,
      bounceFriction: wet ? 0.12 : snow ? 0.35 : 0.28,
      puddle: (x, z) => {
        for (const p of this.puddles) if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) return 3.2;
        return 0;
      },
    };
    if (wet) {
      const r = mulberry(77);
      for (let i = 0; i < 9; i++) {
        this.puddles.push({ x: (r() - 0.5) * 90, z: (r() - 0.5) * 55, r: 1 + r() * 1.8 });
      }
    }

    this.sun = this.buildLightsAndSky();
    this.buildPitch();
    const { canvas, ctx, tex } = this.buildWear();
    this.wearCanvas = canvas;
    this.wearCtx = ctx;
    this.wearTex = tex;
    this.buildGoal(1);
    this.buildGoal(-1);
    this.buildFlagsAndBoards();
    this.buildStands();
    this.buildFloodlights();
    this.buildWeather();
    scene.add(this.group);
  }

  // ---------------- sky & lights ----------------
  private buildLightsAndSky(): THREE.DirectionalLight {
    const { time, weather } = this.opts;
    const scene = this.scene;
    const cloudy = weather !== 'clear';
    const sky = new Sky();
    sky.scale.setScalar(4000);
    const u = sky.material.uniforms;
    u.turbidity.value = cloudy ? 14 : 6;
    u.rayleigh.value = time === 'dusk' ? 3 : cloudy ? 0.6 : 1.4;
    u.mieCoefficient.value = cloudy ? 0.02 : 0.005;
    u.mieDirectionalG.value = 0.85;
    const elev = time === 'day' ? 52 : time === 'dusk' ? 3.5 : -6;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(time === 'dusk' ? 250 : 210));
    u.sunPosition.value.copy(sunDir);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    if (time === 'night') {
      scene.background = new THREE.Color(cloudy ? 0x0b0e14 : 0x050913);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x1a2233);
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      scene.environmentIntensity = 1;
      // stars
      if (!cloudy) {
        const g = new THREE.BufferGeometry();
        const pos = new Float32Array(1500 * 3);
        for (let i = 0; i < 1500; i++) {
          const v = new THREE.Vector3().setFromSphericalCoords(1500, Math.random() * 1.3, Math.random() * Math.PI * 2);
          pos.set([v.x, Math.abs(v.y) + 100, v.z], i * 3);
        }
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })));
      }
    } else {
      const envScene = new THREE.Scene();
      envScene.add(sky.clone());
      scene.environment = pmrem.fromScene(envScene, 0.02).texture;
      // the sky shader is HDR-bright: keep its reflections subtle
      scene.environmentIntensity = time === 'dusk' ? 0.35 : 0.22;
      this.group.add(sky);
    }
    pmrem.dispose();
    const fogColor = time === 'night' ? 0x0a0f18 : time === 'dusk' ? 0x9a7a6a : cloudy ? 0x9aa3ad : 0xbfd4e6;
    scene.fog = new THREE.Fog(fogColor, weather === 'rain' || weather === 'snow' ? 140 : 260, weather === 'snow' ? 420 : 900);

    const hemi = new THREE.HemisphereLight(
      time === 'night' ? 0x8fa3c8 : time === 'dusk' ? 0xffc79a : 0xcfe6ff,
      time === 'night' ? 0x1b2a14 : 0x3a5a2a,
      time === 'night' ? 0.55 : time === 'dusk' ? 0.55 : cloudy ? 0.85 : 0.6,
    );
    this.group.add(hemi);

    const sun = new THREE.DirectionalLight(
      time === 'night' ? 0xeef3ff : time === 'dusk' ? 0xffb070 : 0xfff4e0,
      time === 'night' ? 2.4 : time === 'dusk' ? 1.8 : cloudy ? 1.2 : 2.3,
    );
    const lightDir = time === 'night' ? new THREE.Vector3(0.25, 1, 0.35) : time === 'dusk' ? new THREE.Vector3(sunDir.x, 0.35, sunDir.z) : sunDir.clone();
    sun.position.copy(lightDir.normalize().multiplyScalar(120));
    sun.castShadow = true;
    const sz = this.opts.quality === 'high' ? 4096 : 2048;
    sun.shadow.mapSize.set(sz, sz);
    const cam = sun.shadow.camera;
    cam.left = -75;
    cam.right = 75;
    cam.top = 60;
    cam.bottom = -60;
    cam.near = 10;
    cam.far = 320;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = cloudy ? 6 : 2;
    this.group.add(sun);
    this.group.add(sun.target);
    if (time !== 'day') {
      // floodlight fill from the other corners: soft, without shadows
      for (const [x, z] of [[-1, -1], [1, 1], [-1, 1]]) {
        const l = new THREE.DirectionalLight(0xeef3ff, time === 'night' ? 0.55 : 0.35);
        l.position.set(x * 80, 60, z * 60);
        this.group.add(l);
      }
    }
    return sun;
  }

  // ---------------- pitch ----------------
  private buildPitch() {
    const { weather, quality } = this.opts;
    const scale = quality === 'high' ? 28 : 14; // px per metre
    const c = document.createElement('canvas');
    c.width = Math.round(AREA_L * scale);
    c.height = Math.round(AREA_W * scale);
    const g = c.getContext('2d')!;
    const wet = weather === 'rain';
    const snow = weather === 'snow';
    const base = wet ? [46, 104, 42] : [58, 128, 50];
    const fill = (rgb: number[], k: number) => `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
    g.fillStyle = fill(base, 0.92);
    g.fillRect(0, 0, c.width, c.height);
    // mowing stripes: 20 bands across the pitch length, plus a faint cross pattern
    const px = (x: number) => (x + AREA_L / 2) * scale;
    const pz = (z: number) => (z + AREA_W / 2) * scale;
    const band = FIELD.L / 20;
    for (let i = -2; i < 22; i++) {
      g.fillStyle = fill(base, i % 2 ? 0.86 : 1.02);
      g.fillRect(px(-FIELD.HL + i * band), 0, band * scale + 1, c.height);
    }
    g.globalAlpha = 0.05;
    for (let i = 0; i < 14; i++) {
      g.fillStyle = i % 2 ? '#000' : '#fff';
      g.fillRect(0, pz(-FIELD.HW + i * (FIELD.W / 13)), c.width, (FIELD.W / 13) * scale);
    }
    // grass speckle and the darker worn goalmouths
    g.globalAlpha = 1;
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    let seed = 1;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const n = (seed / 2147483647 - 0.5) * 22;
      d[i] = Math.max(0, d[i] + n * 0.6);
      d[i + 1] = Math.max(0, d[i + 1] + n);
      d[i + 2] = Math.max(0, d[i + 2] + n * 0.4);
    }
    g.putImageData(img, 0, 0);
    for (const side of [-1, 1]) {
      const grd = g.createRadialGradient(px(side * (FIELD.HL - 3)), pz(0), 0, px(side * (FIELD.HL - 3)), pz(0), 7 * scale);
      grd.addColorStop(0, 'rgba(110,95,60,0.35)');
      grd.addColorStop(1, 'rgba(110,95,60,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, c.width, c.height);
    }
    // markings (blue in snow, as on real snowy pitches)
    g.strokeStyle = snow ? '#1f5fd6' : 'rgba(250,250,250,0.93)';
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 0.12 * scale;
    this.drawLines(g, px, pz, scale);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;

    // fine grass detail as a tiled bump map
    const bc = document.createElement('canvas');
    bc.width = bc.height = 256;
    const bg = bc.getContext('2d')!;
    const bimg = bg.createImageData(256, 256);
    for (let i = 0; i < bimg.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 255;
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = v;
      bimg.data[i + 3] = 255;
    }
    bg.putImageData(bimg, 0, 0);
    const bump = new THREE.CanvasTexture(bc);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(AREA_L * 1.5, AREA_W * 1.5);

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: bump,
      bumpScale: 0.6,
      roughness: wet ? 0.42 : 0.92,
      metalness: 0,
      envMapIntensity: wet ? 1.0 : 0.35,
    });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(AREA_L, AREA_W), mat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.group.add(pitch);

    // track / concrete around the grass
    const around = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 200),
      new THREE.MeshStandardMaterial({ color: snow ? 0xdfe4ea : 0x3b4148, roughness: 0.95 }),
    );
    around.rotation.x = -Math.PI / 2;
    around.position.y = -0.02;
    around.receiveShadow = true;
    this.group.add(around);
  }

  private drawLines(g: CanvasRenderingContext2D, px: (x: number) => number, pz: (z: number) => number, scale: number) {
    const { HL, HW, BOX_D, BOX_HW, SIX_D, SIX_HW, PEN_D } = FIELD;
    const rect = (x0: number, z0: number, x1: number, z1: number) => {
      g.strokeRect(px(Math.min(x0, x1)), pz(Math.min(z0, z1)), Math.abs(x1 - x0) * scale, Math.abs(z1 - z0) * scale);
    };
    rect(-HL, -HW, HL, HW);
    g.beginPath();
    g.moveTo(px(0), pz(-HW));
    g.lineTo(px(0), pz(HW));
    g.stroke();
    g.beginPath();
    g.arc(px(0), pz(0), 9.15 * scale, 0, Math.PI * 2);
    g.stroke();
    const spot = (x: number, z: number, r = 0.15) => {
      g.beginPath();
      g.arc(px(x), pz(z), r * scale, 0, Math.PI * 2);
      g.fill();
    };
    spot(0, 0);
    for (const s of [-1, 1]) {
      rect(s * HL, -BOX_HW, s * (HL - BOX_D), BOX_HW);
      rect(s * HL, -SIX_HW, s * (HL - SIX_D), SIX_HW);
      spot(s * (HL - PEN_D), 0);
      // penalty arc: the part of the 9.15 m circle outside the box
      const a = Math.acos((BOX_D - PEN_D) / 9.15);
      g.beginPath();
      if (s > 0) g.arc(px(s * (HL - PEN_D)), pz(0), 9.15 * scale, Math.PI - a, Math.PI + a);
      else g.arc(px(s * (HL - PEN_D)), pz(0), 9.15 * scale, -a, a);
      g.stroke();
      for (const t of [-1, 1]) {
        g.beginPath();
        const cx = px(s * HL);
        const cz = pz(t * HW);
        const start = s > 0 ? (t > 0 ? Math.PI : Math.PI / 2) : t > 0 ? -Math.PI / 2 : 0;
        g.arc(cx, cz, 1 * scale, start, start + Math.PI / 2);
        g.stroke();
      }
    }
  }

  // ---------------- wear overlay ----------------
  private buildWear() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round((1024 * AREA_W) / AREA_L);
    const ctx = canvas.getContext('2d')!;
    const sx = canvas.width / AREA_L;
    if (this.opts.weather === 'snow') {
      ctx.fillStyle = 'rgba(236,241,247,0.62)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // ground staff cleared the lines
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#000';
      ctx.lineWidth = 0.5 * sx;
      this.drawLines(ctx, (x) => (x + AREA_L / 2) * sx, (z) => (z + AREA_W / 2) * sx, sx);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const p of this.puddles) {
      const grd = ctx.createRadialGradient((p.x + AREA_L / 2) * sx, (p.z + AREA_W / 2) * sx, 0, (p.x + AREA_L / 2) * sx, (p.z + AREA_W / 2) * sx, p.r * sx);
      grd.addColorStop(0, 'rgba(70,85,90,0.75)');
      grd.addColorStop(0.8, 'rgba(70,85,90,0.55)');
      grd.addColorStop(1, 'rgba(70,85,90,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse((p.x + AREA_L / 2) * sx, (p.z + AREA_W / 2) * sx, p.r * sx, p.r * sx * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      roughness: this.opts.weather === 'rain' ? 0.15 : 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(AREA_L, AREA_W), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.005;
    m.receiveShadow = true;
    this.group.add(m);
    return { canvas, ctx, tex };
  }

  // Scuffs the turf where players sprint, turn and slide (or clears snow).
  wear(x: number, z: number, r: number, amount: number) {
    const turf = this.opts.turf ?? 'normal';
    amount *= turf === 'old' ? 1.7 : turf === 'hybrid' ? 0.45 : 1;
    const ctx = this.wearCtx;
    const sx = this.wearCanvas.width / AREA_L;
    const cx = (x + AREA_L / 2) * sx;
    const cz = (z + AREA_W / 2) * sx;
    if (this.opts.weather === 'snow') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, amount * 2.5)})`;
    } else {
      const mud = this.opts.weather === 'rain' ? '78,58,34' : '112,96,62';
      ctx.fillStyle = `rgba(${mud},${Math.min(0.5, amount)})`;
    }
    ctx.beginPath();
    ctx.ellipse(cx, cz, r * sx, r * sx * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    this.wearDirty = true;
  }

  // ---------------- goals ----------------
  private netTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 32);
    g.lineTo(32, 0);
    g.lineTo(64, 32);
    g.lineTo(32, 64);
    g.closePath();
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  private buildGoal(side: number) {
    const { HL, GOAL_HW, GOAL_H, GOAL_D } = FIELD;
    const x = side * HL;
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6 });
    const post = new THREE.CylinderGeometry(0.06, 0.06, GOAL_H + 0.06, 16);
    for (const z of [-1, 1]) {
      const m = new THREE.Mesh(post, white);
      m.position.set(x + side * 0.06, (GOAL_H + 0.06) / 2, z * (GOAL_HW + 0.06));
      m.castShadow = true;
      this.group.add(m);
      // back support: from the top of the post, back and down
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), dark);
      sup.position.set(x + side * (GOAL_D * 0.5 + 0.06), 1.7, z * (GOAL_HW + 0.06));
      sup.rotation.z = side * -1.0;
      this.group.add(sup);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), dark);
      back.position.set(x + side * GOAL_D, 0.5, z * GOAL_HW);
      this.group.add(back);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_HW * 2 + 0.24, 16), white);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(x + side * 0.06, GOAL_H + 0.06, 0);
    bar.castShadow = true;
    this.group.add(bar);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, GOAL_HW * 2, 6), dark);
    ground.rotation.x = Math.PI / 2;
    ground.position.set(x + side * GOAL_D, 0.02, 0);
    this.group.add(ground);

    // net: back, roof and sides
    const tex = this.netTexture();
    const netMat = new THREE.MeshStandardMaterial({ map: tex, alphaMap: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1, color: 0xf2f2f2 });
    const mk = (geo: THREE.BufferGeometry, rx: number, ry: number) => {
      const t = tex.clone();
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      const mat = netMat.clone();
      mat.map = t;
      mat.alphaMap = t;
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      this.group.add(m);
      return m;
    };
    // back (deformable)
    const backGeo = new THREE.PlaneGeometry(GOAL_HW * 2, 1.0, 24, 6);
    backGeo.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    backGeo.translate(x + side * GOAL_D, 0.5, 0);
    mk(backGeo, 30, 4);
    // roof sloping from crossbar to back
    const roofGeo = new THREE.BufferGeometry();
    const roofW = GOAL_HW;
    const roofVerts = new Float32Array([
      x, GOAL_H, -roofW, x, GOAL_H, roofW, x + side * GOAL_D, 1.0, roofW,
      x, GOAL_H, -roofW, x + side * GOAL_D, 1.0, roofW, x + side * GOAL_D, 1.0, -roofW,
    ]);
    roofGeo.setAttribute('position', new THREE.BufferAttribute(roofVerts, 3));
    roofGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2));
    roofGeo.computeVertexNormals();
    mk(roofGeo, 30, 10);
    for (const zs of [-1, 1]) {
      const sg = new THREE.BufferGeometry();
      const z = zs * GOAL_HW;
      sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        x, 0, z, x + side * GOAL_D, 0, z, x + side * GOAL_D, 1.0, z,
        x, 0, z, x + side * GOAL_D, 1.0, z, x, GOAL_H, z,
      ]), 3));
      sg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 0.4, 0, 0, 1, 0.4, 0, 1]), 2));
      sg.computeVertexNormals();
      mk(sg, 9, 10);
    }
    this.nets.push({ side, geo: backGeo, base: (backGeo.attributes.position.array as Float32Array).slice(), hits: [] });
  }

  netImpact(side: number, z: number, y: number, strength: number) {
    const n = this.nets.find((q) => q.side === side);
    if (!n) return;
    n.hits.push({ z, y, a: Math.min(0.9, strength * 0.05), t: 0 });
    if (n.hits.length > 3) n.hits.shift();
  }

  // ---------------- flags & boards ----------------
  private buildFlagsAndBoards() {
    const { HL, HW } = FIELD;
    const pole = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const flagMat = new THREE.MeshStandardMaterial({ color: this.opts.homeColors[0], side: THREE.DoubleSide, roughness: 0.9 });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(pole, poleMat);
        p.position.set(sx * HL, 0.75, sz * HW);
        p.castShadow = true;
        this.group.add(p);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3, 6, 1), flagMat);
        f.geometry.translate(0.2, 0, 0);
        f.position.set(sx * HL, 1.35, sz * HW);
        this.group.add(f);
        this.flags.push(f);
      }

    const sponsors = ['כדורגל 3D', 'GOAL TV', 'המטבח שלי', 'ספורט+', 'רשימת קניות', 'KICK & RUN', this.opts.name, 'מונדיאל הבית'];
    const c = document.createElement('canvas');
    c.width = 2048;
    c.height = 64;
    const g = c.getContext('2d')!;
    const colors = ['#0b3d91', '#c81d25', '#111827', '#0f766e', '#7c3aed', '#ea580c', '#1f2937', '#be123c'];
    const seg = c.width / sponsors.length;
    sponsors.forEach((s, i) => {
      g.fillStyle = colors[i % colors.length];
      g.fillRect(i * seg, 0, seg, 64);
      g.fillStyle = '#fff';
      g.font = '800 38px Heebo, Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s, i * seg + seg / 2, 34);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    this.adTextures.push(tex);
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.5 });
    const backMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
    const mkBoard = (len: number, x: number, z: number, rotY: number, rep: number) => {
      const t = tex.clone();
      t.repeat.set(rep, 1);
      t.needsUpdate = true;
      this.adTextures.push(t);
      const m = boardMat.clone();
      m.map = t;
      m.emissiveMap = t;
      const box = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.12), [backMat, backMat, backMat, backMat, m, backMat]);
      box.position.set(x, 0.45, z);
      box.rotation.y = rotY;
      box.castShadow = true;
      this.group.add(box);
    };
    mkBoard(110, 0, -(HW + 4), 0, 4);
    mkBoard(110, 0, HW + 4, Math.PI, 4);
    for (const s of [-1, 1]) {
      mkBoard(30, s * (HL + 4.5), -22, (-s * Math.PI) / 2, 1);
      mkBoard(30, s * (HL + 4.5), 22, (-s * Math.PI) / 2, 1);
    }
    // dugouts on the far side from the main camera
    const dug = new THREE.MeshPhysicalMaterial({ color: 0x9ccaf0, transmission: 0.6, transparent: true, opacity: 0.5, roughness: 0.1 });
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 9, 16, 1, true, 0, Math.PI), dug);
      d.rotation.z = Math.PI / 2;
      d.rotation.y = Math.PI / 2;
      d.position.set(s * 12, 0.2, -(HW + 6.5));
      this.group.add(d);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: s > 0 ? this.opts.awayColors[0] : this.opts.homeColors[0] }));
      bench.position.set(s * 12, 0.45, -(HW + 7.2));
      this.group.add(bench);
    }
  }

  // ---------------- stands & crowd ----------------
  private buildStands() {
    const { HL, HW } = FIELD;
    const high = this.opts.quality === 'high';
    const rows = high ? 24 : 16;
    const rowD = 0.85;
    const rowH = 0.45;
    const concrete = new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.9 });
    const seatsMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.opts.homeColors[0]).multiplyScalar(0.55), roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
    const seatSpacing = high ? 0.72 : 1.0;

    type StandDef = { len: number; dist: number; rotY: number; dir: THREE.Vector3; center: THREE.Vector3; away: boolean };
    const stands: StandDef[] = [
      { len: 128, dist: HW + 9, rotY: 0, dir: new THREE.Vector3(0, 0, -1), center: new THREE.Vector3(0, 0, -(HW + 9)), away: false },
      { len: 128, dist: HW + 9, rotY: Math.PI, dir: new THREE.Vector3(0, 0, 1), center: new THREE.Vector3(0, 0, HW + 9), away: false },
      { len: 92, dist: HL + 10, rotY: Math.PI / 2, dir: new THREE.Vector3(-1, 0, 0), center: new THREE.Vector3(-(HL + 10), 0, 0), away: false },
      { len: 92, dist: HL + 10, rotY: -Math.PI / 2, dir: new THREE.Vector3(1, 0, 0), center: new THREE.Vector3(HL + 10, 0, 0), away: true },
    ];
    const bodyMatrices: THREE.Matrix4[] = [];
    const bodyColors: THREE.Color[] = [];
    const headColors: THREE.Color[] = [];
    const skin = ['#f2d0b5', '#e0ac89', '#c68a62', '#8d5a3c', '#5a3423'].map((s) => new THREE.Color(s));
    const neutral = ['#2b2f36', '#e5e7eb', '#334155', '#7f1d1d', '#1e3a8a', '#4b5563'].map((s) => new THREE.Color(s));
    const home = this.opts.homeColors.map((s) => new THREE.Color(s));
    const away = this.opts.awayColors.map((s) => new THREE.Color(s));
    const r = mulberry(9);

    for (const s of stands) {
      // stepped concrete bowl, built in local space: x along the stand, -z towards the back
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      for (let i = 0; i < rows; i++) {
        shape.lineTo(i * rowD, 1.2 + i * rowH);
        shape.lineTo((i + 1) * rowD, 1.2 + i * rowH);
      }
      shape.lineTo(rows * rowD, 0);
      shape.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: s.len, bevelEnabled: false });
      geo.rotateY(Math.PI / 2); // profile x -> -z (back), extrusion z -> x
      geo.translate(-s.len / 2, 0, 0);
      const m = new THREE.Mesh(geo, concrete);
      m.receiveShadow = true;
      m.castShadow = high;
      const holder = new THREE.Group();
      holder.add(m);
      // seat rows
      for (let i = 0; i < rows; i++) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(s.len, 0.12, 0.35), seatsMat);
        seat.position.set(0, 1.2 + i * rowH + 0.06, -(i * rowD + 0.55));
        holder.add(seat);
      }
      // back wall & roof
      const backH = 1.2 + rows * rowH + 9;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(s.len, backH, 0.5), concrete);
      wall.position.set(0, backH / 2, -(rows * rowD + 0.4));
      holder.add(wall);
      const roofDepth = rows * rowD + 6;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(s.len + 2, 0.4, roofDepth), roofMat);
      roof.position.set(0, backH + 0.5, -(rows * rowD) + roofDepth / 2 - 4);
      roof.rotation.x = -0.08;
      roof.castShadow = true;
      holder.add(roof);
      // roof light strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry(s.len, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: this.opts.time === 'day' ? 0xdddddd : 0xffffff }));
      strip.position.set(0, backH + 0.2, -(rows * rowD) + roofDepth - 4.2);
      holder.add(strip);
      // a big supporters' banner across the lower tier
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(40, s.len * 0.4), 2.2), this.bannerMaterial(s.away ? this.opts.awayColors : this.opts.homeColors, s.away));
      banner.position.set(0, 0.9, 0.02);
      holder.add(banner);

      holder.rotation.y = s.rotY;
      holder.position.copy(s.center);
      this.group.add(holder);
      holder.updateMatrixWorld(true);

      // fans
      const fillRate = high ? 0.9 : 0.7;
      const seats = Math.floor(s.len / seatSpacing);
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rotY);
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < seats; j++) {
          if (r() > fillRate) continue;
          pos.set(-s.len / 2 + (j + 0.5) * seatSpacing + (r() - 0.5) * 0.15, 1.2 + i * rowH + 0.12, -(i * rowD + 0.45));
          pos.applyMatrix4(holder.matrixWorld);
          const sc = 0.9 + r() * 0.2;
          bodyMatrices.push(new THREE.Matrix4().compose(pos.clone(), quat, new THREE.Vector3(sc, sc, sc)));
          // away fans sit behind one goal and in a corner of the main stand
          const isAway = s.away || (s.rotY === 0 && j > seats * 0.82);
          const q = r();
          const col = q < 0.62 ? (isAway ? away : home)[Math.floor(r() * 2) % (isAway ? away : home).length] : neutral[Math.floor(r() * neutral.length)];
          bodyColors.push(col.clone().multiplyScalar(0.75 + r() * 0.35));
          headColors.push(skin[Math.floor(r() * skin.length)]);
        }
    }

    const bodyGeo = new THREE.BoxGeometry(0.46, 0.62, 0.3);
    bodyGeo.translate(0, 0.31, 0);
    const headGeo = new THREE.IcosahedronGeometry(0.12, high ? 1 : 0);
    headGeo.translate(0, 0.76, 0.02);
    const mk = (g: THREE.BufferGeometry, colors: THREE.Color[]) => {
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.crowdUniforms.uTime;
        sh.uniforms.uExcite = this.crowdUniforms.uExcite;
        sh.vertexShader = 'uniform float uTime;\nuniform float uExcite;\n' + sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float fid = float(gl_InstanceID);
          float rr = fract(sin(fid * 12.9898) * 43758.5453);
          float jumper = step(0.45, rr);
          float bob = max(0.0, sin(uTime * (5.0 + 3.0 * rr) + rr * 40.0));
          transformed.y += (0.025 + uExcite * 0.32 * jumper) * bob;
          transformed.x += sin(uTime * 1.3 + rr * 20.0) * 0.03;`,
        );
      };
      this.crowdMats.push(mat);
      const im = new THREE.InstancedMesh(g, mat, bodyMatrices.length);
      bodyMatrices.forEach((m4, i) => {
        im.setMatrixAt(i, m4);
        im.setColorAt(i, colors[i]);
      });
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      this.group.add(im);
    };
    mk(bodyGeo, bodyColors);
    mk(headGeo, headColors);

    // fill the four corners with plain concrete so the bowl looks closed
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const corner = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 22), concrete);
        corner.position.set(sx * (HL + 17), 7, sz * (HW + 17));
        corner.rotation.y = Math.PI / 4;
        this.group.add(corner);
      }
  }

  private bannerMaterial(colors: string[], away: boolean) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = colors[i % colors.length];
      g.fillRect(i * 64, 0, 64, 64);
    }
    g.fillStyle = '#fff';
    g.strokeStyle = '#000';
    g.lineWidth = 3;
    g.font = '900 40px Heebo, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const t = away ? 'באנו לנצח!' : 'רק ביחד • עד הסוף';
    g.strokeText(t, 256, 34);
    g.fillText(t, 256, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 });
  }

  private buildFloodlights() {
    const { HL, HW } = FIELD;
    const on = this.opts.time !== 'day' || this.opts.weather !== 'clear';
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.4 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: on ? 0xffffff : 0x222222, emissiveIntensity: on ? 3 : 0.2 });
    const glowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.25, 'rgba(255,250,235,0.45)');
      grd.addColorStop(1, 'rgba(255,250,235,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = sx * (HL + 24);
        const z = sz * (HW + 24);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 44, 10), poleMat);
        pole.position.set(x, 22, z);
        this.group.add(pole);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.8), panelMat);
        panel.position.set(x, 46, z);
        panel.lookAt(0, 0, 0);
        this.group.add(panel);
        if (on) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: this.opts.time === 'night' ? 0.95 : 0.55 }));
          sp.scale.set(30, 30, 1);
          sp.position.copy(panel.position).multiplyScalar(0.985);
          this.group.add(sp);
        }
      }
  }

  // ---------------- weather ----------------
  private buildWeather() {
    const { weather } = this.opts;
    if (weather === 'rain') {
      const n = this.opts.quality === 'high' ? 9000 : 4000;
      const pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * 140;
        const y = Math.random() * 40;
        const z = (Math.random() - 0.5) * 100;
        pos.set([x, y, z, x + 0.05, y + 0.6, z + 0.02], i * 6);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.precip = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.45 }));
      this.precipVel.set(-0.8, -26, -0.3);
    } else if (weather === 'snow') {
      const n = this.opts.quality === 'high' ? 7000 : 3000;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 140, Math.random() * 40, (Math.random() - 0.5) * 100], i * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const cg = c.getContext('2d')!;
      const grd = cg.createRadialGradient(16, 16, 0, 16, 16, 16);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      cg.fillStyle = grd;
      cg.fillRect(0, 0, 32, 32);
      this.precip = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
      this.precipVel.set(0.4, -1.4, 0.2);
    }
    if (this.precip) {
      this.precip.frustumCulled = false;
      this.group.add(this.precip);
    }
  }

  // Flares and smoke in the stands (0 = home end, 1 = away end).
  private flares: { sprites: THREE.Sprite[]; smoke: THREE.Sprite[]; t: number }[] = [];
  pyro(side: number) {
    const tex = (inner: string, outer: string) => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, inner);
      grd.addColorStop(1, outer);
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    };
    const fire = tex('rgba(255,240,200,1)', 'rgba(255,40,0,0)');
    const smokeT = tex('rgba(200,200,200,0.7)', 'rgba(200,200,200,0)');
    const x = (side === 0 ? -1 : 1) * (FIELD.HL + 13);
    const sprites: THREE.Sprite[] = [];
    const smoke: THREE.Sprite[] = [];
    for (let i = 0; i < 10; i++) {
      const pos = new THREE.Vector3(x + (Math.random() - 0.5) * 8, 3 + Math.random() * 6, (Math.random() - 0.5) * 50);
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: fire, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: Math.random() < 0.7 ? 0xff3b1f : 0xffd166 }));
      f.position.copy(pos);
      f.scale.setScalar(1.6);
      this.group.add(f);
      sprites.push(f);
      for (let k = 0; k < 3; k++) {
        const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false, opacity: 0, color: side === 0 ? 0xffb4a8 : 0xd0d8ff }));
        sm.position.copy(pos);
        sm.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6);
        sm.userData.delay = k * 1.4 + Math.random();
        this.group.add(sm);
        smoke.push(sm);
      }
    }
    this.flares.push({ sprites, smoke, t: 0 });
  }

  update(dt: number, excitement: number) {
    this.time += dt;
    for (const fl of this.flares) {
      fl.t += dt;
      const life = Math.max(0, 1 - fl.t / 10);
      for (const f of fl.sprites) {
        f.scale.setScalar((1.2 + Math.random() * 0.9) * life);
        (f.material as THREE.SpriteMaterial).opacity = life;
      }
      for (const sm of fl.smoke) {
        const t = fl.t - (sm.userData.delay as number);
        if (t < 0) continue;
        sm.position.addScaledVector(sm.userData.v as THREE.Vector3, dt);
        sm.scale.setScalar(2 + t * 2.2);
        (sm.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.5 * (1 - fl.t / 12));
      }
    }
    const dead = this.flares.filter((f) => f.t > 12);
    for (const f of dead) for (const o of [...f.sprites, ...f.smoke]) {
      this.group.remove(o);
      o.material.map?.dispose();
      o.material.dispose();
    }
    this.flares = this.flares.filter((f) => f.t <= 12);
    this.crowdUniforms.uTime.value = this.time;
    this.crowdUniforms.uExcite.value += (excitement - this.crowdUniforms.uExcite.value) * Math.min(1, dt * 2);
    for (const f of this.flags) f.rotation.y = Math.sin(this.time * 3 + f.position.x) * 0.5;
    for (const t of this.adTextures) t.offset.x = (t.offset.x + dt * 0.02) % 1;

    // wear texture upload is throttled
    this.wearTimer -= dt;
    if (this.wearDirty && this.wearTimer <= 0) {
      this.wearTex.needsUpdate = true;
      this.wearDirty = false;
      this.wearTimer = 0.5;
    }

    for (const n of this.nets) {
      if (!n.hits.length) continue;
      const pos = n.geo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        let off = 0;
        const z = n.base[i * 3 + 2];
        const y = n.base[i * 3 + 1];
        for (const h of n.hits) {
          const fall = Math.exp(-((z - h.z) ** 2 + (y - h.y) ** 2) / 1.2);
          off += h.a * fall * Math.exp(-h.t * 3) * Math.cos(h.t * 14);
        }
        arr[i * 3] = n.base[i * 3] + n.side * Math.max(-0.1, off);
      }
      pos.needsUpdate = true;
      for (const h of n.hits) h.t += dt;
      n.hits = n.hits.filter((h) => h.t < 2);
      if (!n.hits.length) {
        arr.set(n.base);
        pos.needsUpdate = true;
      }
    }

    if (this.precip) {
      const pos = this.precip.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const v = this.precipVel;
      const stride = this.precip instanceof THREE.LineSegments ? 6 : 3;
      const sway = stride === 3 ? Math.sin(this.time) * 0.6 : 0;
      for (let i = 0; i < arr.length; i += stride) {
        arr[i] += (v.x + sway) * dt;
        arr[i + 1] += v.y * dt;
        arr[i + 2] += v.z * dt;
        if (stride === 6) {
          arr[i + 3] += v.x * dt;
          arr[i + 4] += v.y * dt;
          arr[i + 5] += v.z * dt;
        }
        if (arr[i + 1] < 0) {
          const x = (Math.random() - 0.5) * 140;
          const z = (Math.random() - 0.5) * 100;
          arr[i] = x;
          arr[i + 1] = 40;
          arr[i + 2] = z;
          if (stride === 6) {
            arr[i + 3] = x + 0.05;
            arr[i + 4] = 40.6;
            arr[i + 5] = z + 0.02;
          }
        }
      }
      pos.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.scene.environment = null;
    this.scene.fog = null;
  }
}

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import * as THREE from 'three';
import type { Game } from './game';
import { clamp, damp, lerp, pick, rand } from './util';
import { BEACH_X, HALF, SEA_X } from './world';

// ---------------------------------------------------------------------------
// Environment: day/night cycle (1 real second = 1 game minute), weather that
// changes road friction and AI behaviour, rain and lightning, and the bird
// ecosystem (flocks that scatter at gunfire).
// ---------------------------------------------------------------------------

export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
const WEATHER_NAME: Record<Weather, string> = { clear: 'בהיר', cloudy: 'מעונן', rain: 'גשום', storm: 'סערה', fog: 'ערפל' };

export class Env {
  minutes = 8 * 60;
  weather: Weather = 'clear';
  rain = 0;
  wetness = 0;
  fogAmt = 0;
  night = 0;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  private nextWeather = 240;
  private rainMesh: THREE.LineSegments;
  private rainPos: Float32Array;
  private lightning = 0;
  private sky = new THREE.Color();
  birds: Birds;

  constructor(private g: Game) {
    const s = g.scene;
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5040, 1.2);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    if (g.quality === 'high') {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const c = this.sun.shadow.camera;
      c.left = c.bottom = -90;
      c.right = c.top = 90;
      c.near = 1;
      c.far = 400;
      this.sun.shadow.bias = -0.0005;
    }
    s.add(this.sun, this.sun.target);
    s.fog = new THREE.Fog(0xb8cde0, 150, 700);
    s.background = this.sky;

    const N = g.quality === 'high' ? 2600 : 1200;
    this.rainPos = new Float32Array(N * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.45 }));
    this.rainMesh.frustumCulled = false;
    s.add(this.rainMesh);
    for (let i = 0; i < N; i++) this.resetDrop(i, new THREE.Vector3(), true);
    this.birds = new Birds(g);
  }

  get hour() {
    return (this.minutes / 60) % 24;
  }
  get days() {
    return this.minutes / 1440;
  }
  clock() {
    const h = Math.floor(this.hour), m = Math.floor(this.minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  setWeather(w: Weather) {
    this.weather = w;
    this.nextWeather = this.minutes + rand(180, 420);
    this.g.hud.toast(`מזג האוויר: ${WEATHER_NAME[w]}`, 2);
  }

  cycleWeather() {
    const order: Weather[] = ['clear', 'cloudy', 'rain', 'storm', 'fog'];
    this.setWeather(order[(order.indexOf(this.weather) + 1) % order.length]);
  }

  forecast() {
    return `כרגע ${WEATHER_NAME[this.weather]}. ${this.rain > 0.2 ? 'הכבישים חלקלקים, סעו בזהירות: מרחק הבלימה כפול.' : 'תנאי נהיגה טובים.'}`;
  }

  private resetDrop(i: number, c: THREE.Vector3, initial = false) {
    const x = c.x + rand(-45, 45), z = c.z + rand(-45, 45), y = initial ? rand(0, 40) : 40 + rand(0, 6);
    this.rainPos.set([x, y, z, x + 0.1, y - 0.9, z + 0.05], i * 6);
  }

  update(dt: number) {
    const g = this.g;
    this.minutes += dt * g.timeScaleGame;
    if (this.minutes > this.nextWeather) {
      const w: Weather = pick(['clear', 'clear', 'cloudy', 'rain', 'rain', 'storm', 'fog']);
      this.setWeather(w);
    }
    const targetRain = this.weather === 'rain' ? 0.75 : this.weather === 'storm' ? 1 : 0;
    this.rain = damp(this.rain, targetRain, 0.3, dt);
    // Roads get wet quickly and dry slowly.
    this.wetness = damp(this.wetness, targetRain > 0 ? 1 : 0, targetRain > 0 ? 0.25 : 0.03, dt);
    this.fogAmt = damp(this.fogAmt, this.weather === 'fog' ? 1 : this.weather === 'storm' ? 0.5 : this.weather === 'rain' ? 0.3 : this.weather === 'cloudy' ? 0.1 : 0, 0.3, dt);

    // Sun path
    const h = this.hour;
    const ang = ((h - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    this.night = clamp(1 - (elev + 0.15) * 3, 0, 1);
    const cam = g.camera.position;
    const p = g.player.ped;
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.8, Math.max(0.15, elev), 0.45).normalize();
    this.sun.position.set(p.x + sunDir.x * 200, sunDir.y * 200, p.z + sunDir.z * 200);
    this.sun.target.position.set(p.x, 0, p.z);
    const overcast = Math.max(this.rain, this.fogAmt * 0.6, this.weather === 'cloudy' ? 0.4 : 0);
    const day = 1 - this.night;
    this.sun.intensity = 2.8 * day * (1 - overcast * 0.7);
    const dusk = clamp(1 - Math.abs(elev) * 4, 0, 1) * day;
    this.sun.color.setRGB(1, lerp(0.95, 0.6, dusk), lerp(0.85, 0.4, dusk));
    this.hemi.intensity = lerp(0.25, 1.7, day) * (1 - overcast * 0.35);

    // Sky colour
    const daySky = new THREE.Color(0x87b5e0).lerp(new THREE.Color(0x8a939c), overcast);
    const duskSky = new THREE.Color(0xe08a5a);
    const nightSky = new THREE.Color(0x0a1020);
    this.sky.copy(daySky).lerp(duskSky, dusk * 0.7).lerp(nightSky, this.night);
    // Lightning
    if (this.weather === 'storm' && Math.random() < dt * 0.12) {
      this.lightning = 0.25;
      setTimeout(() => g.audio.thunder(), rand(300, 2000));
    }
    if (this.lightning > 0) {
      this.lightning -= dt;
      this.sky.setRGB(0.85, 0.88, 1);
      this.hemi.intensity += 2;
    }
    const fog = g.scene.fog as THREE.Fog;
    fog.color.copy(this.sky);
    fog.near = lerp(180, 20, this.fogAmt);
    fog.far = lerp(800, 160, this.fogAmt);

    // City lights at night
    g.world.windowMat.emissiveIntensity = this.night * 1.4;
    g.world.lampMat.emissiveIntensity = this.night * 3;
    g.world.roadMat.roughness = lerp(0.92, 0.25, this.wetness);
    g.world.roadMat.metalness = lerp(0, 0.35, this.wetness);
    g.world.roadMat.color.setHex(this.wetness > 0.3 ? 0x202226 : 0x2b2d31);

    // Rain follows the camera.
    this.rainMesh.visible = this.rain > 0.02;
    if (this.rainMesh.visible) {
      const n = this.rainPos.length / 6;
      const active = Math.floor(n * this.rain);
      const fall = 28 * dt;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        if (i >= active) {
          this.rainPos[o + 1] = this.rainPos[o + 4] = -10;
          continue;
        }
        this.rainPos[o + 1] -= fall;
        this.rainPos[o + 4] -= fall;
        if (this.rainPos[o + 4] < 0 || Math.abs(this.rainPos[o] - cam.x) > 50 || Math.abs(this.rainPos[o + 2] - cam.z) > 50) this.resetDrop(i, cam);
      }
      this.rainMesh.geometry.attributes.position.needsUpdate = true;
    }
    this.birds.update(dt);
  }
}

/** Flocks of birds: pigeons over the city, gulls over the beach. */
class Birds {
  private mesh: THREE.InstancedMesh;
  private flocks: { cx: number; cz: number; y: number; ang: number; r: number; scared: number; vx: number; vz: number; vy: number; gull: boolean }[] = [];
  private birds: { flock: number; ox: number; oy: number; oz: number; phase: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private g: Game) {
    const geo = new THREE.ConeGeometry(0.25, 0.9, 3).rotateX(Math.PI / 2);
    const total = 5 * 14;
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x2a2a2a }), total);
    this.mesh.frustumCulled = false;
    g.scene.add(this.mesh);
    for (let f = 0; f < 5; f++) {
      const gull = f >= 3;
      this.flocks.push({ cx: gull ? rand(BEACH_X, SEA_X + 100) : rand(-HALF, HALF), cz: rand(-HALF, HALF), y: rand(18, 40), ang: rand(0, 6), r: rand(25, 60), scared: 0, vx: 0, vz: 0, vy: 0, gull });
      for (let b = 0; b < 14; b++) this.birds.push({ flock: f, ox: rand(-5, 5), oy: rand(-2, 2), oz: rand(-5, 5), phase: rand(0, 6) });
    }
    g.bus.on('shot', ({ x, z, loud }) => loud && this.scare(x, z, 70));
    g.bus.on('explosion', ({ x, z }) => this.scare(x, z, 140));
  }

  private scare(x: number, z: number, r: number) {
    for (const f of this.flocks) {
      const fx = f.cx + Math.sin(f.ang) * f.r, fz = f.cz + Math.cos(f.ang) * f.r;
      const d = Math.hypot(fx - x, fz - z);
      if (d < r) {
        f.scared = 6;
        f.vx = ((fx - x) / (d || 1)) * 14;
        f.vz = ((fz - z) / (d || 1)) * 14;
        f.vy = 6;
      }
    }
  }

  update(dt: number) {
    const t = this.g.time;
    for (const f of this.flocks) {
      f.ang += dt * (f.scared > 0 ? 0 : 0.18);
      if (f.scared > 0) {
        f.scared -= dt;
        f.cx += f.vx * dt;
        f.cz += f.vz * dt;
        f.y = Math.min(90, f.y + f.vy * dt);
      } else f.y = damp(f.y, f.gull ? 16 : 28, 0.2, dt);
    }
    this.birds.forEach((b, i) => {
      const f = this.flocks[b.flock];
      const fx = f.cx + Math.sin(f.ang) * f.r, fz = f.cz + Math.cos(f.ang) * f.r;
      const wob = Math.sin(t * 1.3 + b.phase);
      this.p.set(fx + b.ox + wob, f.y + b.oy + Math.sin(t * 2 + b.phase) * 0.5, fz + b.oz + Math.cos(t * 1.1 + b.phase));
      this.e.set(0, f.ang + Math.PI / 2 + (f.scared > 0 ? Math.atan2(f.vx, f.vz) : 0), 0);
      this.q.setFromEuler(this.e);
      const flap = 0.6 + Math.abs(Math.sin(t * (f.scared > 0 ? 18 : 9) + b.phase)) * 0.9;
      this.s.set(flap * (f.gull ? 1.4 : 1), 0.3, 1);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    (this.mesh.material as THREE.MeshBasicMaterial).color.setHex(this.g.env.night > 0.6 ? 0x111111 : 0x2a2a2a);
  }
}

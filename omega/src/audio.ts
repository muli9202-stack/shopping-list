import type { Game } from './game';
import type { WeaponSpec } from './weapons';
import { clamp, rand } from './util';
import { inTunnel } from './world';

// ---------------------------------------------------------------------------
// Spatial audio, all synthesised with WebAudio (no sample files). Gunshots
// are sent to a reverb whose size depends on the surroundings: a tunnel rings
// for seconds, an alley echoes, open ground is dry. Rain drums harder on the
// car roof as speed rises. Three procedural radio stations play in vehicles.
// ---------------------------------------------------------------------------

type Station = { name: string; bpm: number; kind: 'rock' | 'synth' | 'talk' };
export const STATIONS: Station[] = [
  { name: 'Omega Rock 101.4', bpm: 128, kind: 'rock' },
  { name: 'Neon Synth FM', bpm: 104, kind: 'synth' },
  { name: 'רדיו אומגה - חדשות ושיחות', bpm: 0, kind: 'talk' },
];

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private verbShort!: ConvolverNode;
  private verbLong!: ConvolverNode;
  private shortSend!: GainNode;
  private longSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private engine: { osc1: OscillatorNode; osc2: OscillatorNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private rainNode: { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private siren: { osc: OscillatorNode; gain: GainNode } | null = null;
  private tinnitus: { osc: OscillatorNode; gain: GainNode } | null = null;
  private heartAt = 0;
  station = -1;
  private nextBeat = 0;
  private beat = 0;
  speech = false;
  muted = false;

  constructor(private g: Game) {
    const start = () => {
      this.init();
      removeEventListener('pointerdown', start);
      removeEventListener('keydown', start);
      removeEventListener('touchstart', start);
    };
    addEventListener('pointerdown', start);
    addEventListener('keydown', start);
    addEventListener('touchstart', start);
  }

  private init() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.22;
    this.music.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.verbShort = ctx.createConvolver();
    this.verbShort.buffer = this.impulse(0.7, 3);
    this.verbLong = ctx.createConvolver();
    this.verbLong.buffer = this.impulse(3.2, 1.6);
    this.shortSend = ctx.createGain();
    this.longSend = ctx.createGain();
    this.shortSend.connect(this.verbShort).connect(this.sfx);
    this.longSend.connect(this.verbLong).connect(this.sfx);
    // Continuous layers
    const rs = ctx.createBufferSource();
    rs.buffer = this.noiseBuf;
    rs.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'bandpass';
    rf.frequency.value = 2500;
    rf.Q.value = 0.4;
    const rg = ctx.createGain();
    rg.gain.value = 0;
    rs.connect(rf).connect(rg).connect(this.sfx);
    rs.start();
    this.rainNode = { src: rs, filt: rf, gain: rg };
    const so = ctx.createOscillator();
    so.type = 'square';
    const sg = ctx.createGain();
    sg.gain.value = 0;
    const sf = ctx.createBiquadFilter();
    sf.frequency.value = 1800;
    so.connect(sf).connect(sg).connect(this.sfx);
    so.start();
    this.siren = { osc: so, gain: sg };
    const to = ctx.createOscillator();
    to.frequency.value = 4200;
    const tg = ctx.createGain();
    tg.gain.value = 0;
    to.connect(tg).connect(this.master);
    to.start();
    this.tinnitus = { osc: to, gain: tg };
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** Distance attenuation and stereo pan relative to the camera. */
  private place(x: number, y: number, z: number, range = 120) {
    const cam = this.g.camera;
    const dx = x - cam.position.x, dy = y - cam.position.y, dz = z - cam.position.z;
    const d = Math.hypot(dx, dy, dz);
    const vol = clamp(1 - d / range, 0, 1) ** 1.6;
    const yaw = this.g.player.camYaw;
    // Right of a camera facing (sin yaw, cos yaw) is (-cos yaw, sin yaw).
    const pan = d > 0.1 ? clamp((-dx * Math.cos(yaw) + dz * Math.sin(yaw)) / d, -1, 1) : 0;
    return { vol, pan, d };
  }

  /** How enclosed a spot is: 0 open ground, ~0.6 alley, 1 tunnel. */
  private encCache = new Map<number, number>();

  enclosure(x: number, z: number) {
    if (inTunnel(x, z)) return 1;
    // Cached on a 6 m grid: a minigun fires ~66 rounds a second.
    const key = Math.round(x / 6) * 10000 + Math.round(z / 6);
    const cached = this.encCache.get(key);
    if (cached !== undefined) return cached;
    let hits = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (this.g.world.raycast(x, 2, z, x + Math.sin(a) * 22, 2, z + Math.cos(a) * 22)) hits++;
    }
    this.encCache.set(key, hits / 8);
    return hits / 8;
  }

  private voice(x: number, y: number, z: number, range: number, verb = 0) {
    if (!this.ctx || this.muted) return null;
    const { vol, pan } = this.place(x, y, z, range);
    if (vol <= 0.001) return null;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.sfx);
    if (verb > 0) {
      const enc = this.enclosure(x, z);
      const s = ctx.createGain();
      s.gain.value = vol * verb * (enc >= 1 ? 0 : 0.2 + enc * 0.8);
      g.connect(s).connect(this.shortSend);
      if (enc >= 1) {
        const l = ctx.createGain();
        l.gain.value = vol * verb * 1.4;
        g.connect(l).connect(this.longSend);
      }
    }
    return g;
  }

  private noise(out: AudioNode, dur: number, freq: number, q: number, type: BiquadFilterType = 'bandpass', gain = 1, attack = 0.002) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rand(0.9, 1.1);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, rand(0, 1));
    src.stop(t + dur + 0.05);
  }

  private tone(out: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, gain = 0.3, delay = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  gunshot(s: WeaponSpec, x: number, y: number, z: number, suppressed: boolean) {
    const range = suppressed ? 30 : s.cat === 'sniper' || s.cat === 'heavy' ? 400 : 220;
    const out = this.voice(x, y, z, range, suppressed ? 0.2 : 1);
    if (!out) return;
    if (suppressed) {
      this.noise(out, 0.08, 1400, 1, 'bandpass', 0.6);
      return;
    }
    const heavy = s.cat === 'sniper' || s.cat === 'shotgun' || s.dmg > 60;
    this.noise(out, heavy ? 0.45 : 0.22, heavy ? 700 : 1600, 0.7, 'lowpass', 1.2);
    this.noise(out, 0.06, 3500, 0.8, 'highpass', 0.7);
    this.tone(out, 'sine', heavy ? 120 : 180, 40, heavy ? 0.35 : 0.15, heavy ? 0.9 : 0.5);
  }

  explosion(x: number, y: number, z: number, size = 1) {
    const out = this.voice(x, y, z, 600, 1);
    if (!out) return;
    this.noise(out, 1.8 * size, 300, 0.5, 'lowpass', 2.2, 0.01);
    this.tone(out, 'sine', 70, 25, 1.4, 1.4);
    this.noise(out, 0.5, 2000, 0.5, 'bandpass', 0.6);
  }

  crash(x: number, y: number, z: number, amt: number) {
    const out = this.voice(x, y, z, 120);
    if (!out) return;
    this.noise(out, 0.4, 500, 0.6, 'lowpass', amt * 1.5);
    this.noise(out, 0.25, 3000, 2, 'bandpass', amt * 0.6);
  }
  glass(x: number, y: number, z: number) {
    const out = this.voice(x, y, z, 80);
    if (!out) return;
    for (let i = 0; i < 5; i++) this.tone(out, 'triangle', rand(3000, 6000), rand(2000, 4000), 0.15, 0.08, i * 0.03);
    this.noise(out, 0.3, 6000, 1, 'highpass', 0.5);
  }
  punch() {
    if (!this.ctx) return;
    this.noise(this.sfx, 0.12, 400, 1, 'lowpass', 1);
  }
  click() {
    if (!this.ctx) return;
    this.tone(this.sfx, 'square', 1800, 1500, 0.03, 0.08);
  }
  reload() {
    if (!this.ctx) return;
    this.tone(this.sfx, 'square', 900, 700, 0.04, 0.06);
    this.tone(this.sfx, 'square', 600, 500, 0.05, 0.06, 0.25);
  }
  horn(x: number, z: number) {
    const out = this.voice(x, 1, z, 90);
    if (!out) return;
    this.tone(out, 'square', 420, 415, 0.35, 0.12);
    this.tone(out, 'square', 520, 515, 0.35, 0.1);
  }
  scream(x: number, z: number) {
    const out = this.voice(x, 1.6, z, 60);
    if (!out) return;
    const f = rand(600, 1100);
    this.tone(out, 'sawtooth', f, f * 1.3, 0.5, 0.05);
  }
  thud(x: number, y: number, z: number) {
    const out = this.voice(x, y, z, 60);
    if (out) this.noise(out, 0.4, 300, 1, 'lowpass', 0.6);
  }
  bang(x: number, y: number, z: number) {
    const out = this.voice(x, y, z, 150, 1);
    if (out) this.noise(out, 0.6, 1200, 0.4, 'lowpass', 2);
  }
  cannon(x: number, y: number, z: number) {
    const out = this.voice(x, y, z, 500, 1);
    if (!out) return;
    this.noise(out, 1, 250, 0.5, 'lowpass', 2);
    this.tone(out, 'sine', 60, 30, 0.8, 1.2);
  }
  jet() {
    if (!this.ctx) return;
    this.noise(this.sfx, 4, 900, 0.3, 'lowpass', 0.8, 1.5);
  }
  thunder() {
    if (!this.ctx) return;
    this.noise(this.sfx, 3.5, 160, 0.4, 'lowpass', 1.6, 0.05);
  }
  radioBlip() {
    if (!this.ctx) return;
    this.noise(this.sfx, 0.12, 2200, 3, 'bandpass', 0.25);
    this.tone(this.sfx, 'sine', 1200, 1200, 0.08, 0.06, 0.12);
  }
  wantedUp(stars: number) {
    if (!this.ctx) return;
    for (let i = 0; i < stars; i++) this.tone(this.music, 'sawtooth', 220 * (1 + i * 0.25), 200, 0.4, 0.4, i * 0.12);
  }
  evaded() {
    if (!this.ctx) return;
    [523, 659, 784].forEach((f, i) => this.tone(this.music, 'triangle', f, f, 0.35, 0.4, i * 0.12));
  }
  checkpoint() {
    if (!this.ctx) return;
    this.tone(this.sfx, 'triangle', 880, 1320, 0.2, 0.25);
  }
  missionStart() {
    if (!this.ctx) return;
    [392, 523].forEach((f, i) => this.tone(this.music, 'triangle', f, f, 0.3, 0.4, i * 0.15));
  }
  missionPassed() {
    if (!this.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(this.music, 'square', f, f, 0.3, 0.2, i * 0.14));
  }
  wasted() {
    if (!this.ctx) return;
    this.tone(this.music, 'sawtooth', 300, 60, 2.5, 0.5);
  }

  speak(text: string) {
    if (!this.speech || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    u.rate = 1.1;
    speechSynthesis.speak(u);
  }

  cycleStation() {
    this.station = this.station >= STATIONS.length - 1 ? -1 : this.station + 1;
    return this.station >= 0 ? STATIONS[this.station].name : 'רדיו כבוי';
  }

  // ---- per frame ----------------------------------------------------------------

  update(dt: number) {
    if (!this.ctx) return;
    const g = this.g, ctx = this.ctx, t = ctx.currentTime;
    const v = g.player.ped.vehicle;
    // Engine
    if (v && !v.destroyed) {
      if (!this.engine) {
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
        const types: Record<string, [OscillatorType, number]> = { v8: ['sawtooth', 38], v12: ['sawtooth', 62], i4: ['square', 55], twin: ['sawtooth', 70], diesel: ['square', 30], rotor: ['triangle', 18], prop: ['sawtooth', 45], jet: ['sawtooth', 120], outboard: ['square', 60] };
        const [type] = types[v.spec.engine];
        o1.type = type;
        o2.type = 'sawtooth';
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 600;
        const gn = ctx.createGain();
        gn.gain.value = 0;
        o1.connect(f);
        o2.connect(f);
        f.connect(gn).connect(this.sfx);
        o1.start();
        o2.start();
        this.engine = { osc1: o1, osc2: o2, filt: f, gain: gn };
      }
      const base = { v8: 38, v12: 62, i4: 55, twin: 70, diesel: 30, rotor: 18, prop: 45, jet: 120, outboard: 60 }[v.spec.engine];
      const rpm = v.rpm;
      const f = base * (1 + rpm * 3);
      this.engine.osc1.frequency.setTargetAtTime(f, t, 0.05);
      this.engine.osc2.frequency.setTargetAtTime(f * (v.spec.engine === 'v8' ? 0.502 : 1.01), t, 0.05);
      this.engine.filt.frequency.setTargetAtTime(300 + rpm * 1800, t, 0.05);
      this.engine.gain.gain.setTargetAtTime(0.08 + rpm * 0.12, t, 0.1);
    } else if (this.engine) {
      const e = this.engine;
      e.gain.gain.setTargetAtTime(0, t, 0.1);
      setTimeout(() => {
        e.osc1.stop();
        e.osc2.stop();
      }, 400);
      this.engine = null;
    }
    // Rain: louder and more "drummy" on a car roof, varying with speed.
    if (this.rainNode) {
      const inCar = v && v.spec.kind === 'car' && !v.glassBroken;
      const speed = v ? v.speed : 0;
      const tunnel = inTunnel(g.player.ped.x, g.player.ped.z);
      const amt = tunnel ? 0 : g.env.rain;
      this.rainNode.gain.gain.setTargetAtTime(amt * (inCar ? 0.35 + speed / 80 : 0.22), t, 0.3);
      this.rainNode.filt.frequency.setTargetAtTime(inCar ? 900 + speed * 25 : 3000, t, 0.3);
    }
    // Sirens: nearest active siren
    if (this.siren) {
      let best = 0;
      for (const c of g.vehicles) if (c.sirenOn && !c.destroyed) best = Math.max(best, this.place(c.x, 1, c.z, 160).vol);
      const wail = 650 + Math.sin(g.time * (g.police.stars >= 2 ? 9 : 3)) * 250;
      this.siren.osc.frequency.setTargetAtTime(wail, t, 0.02);
      this.siren.gain.gain.setTargetAtTime(best * 0.05, t, 0.1);
    }
    // Tinnitus and heartbeat at low health or after a flashbang.
    if (this.tinnitus) {
      const p = g.player.ped;
      const low = p.alive && p.health < p.maxHealth * 0.2;
      const flash = g.hud.flashAmt;
      this.tinnitus.gain.gain.setTargetAtTime((low ? 0.025 : 0) + flash * 0.08, t, 0.2);
      this.sfx.gain.setTargetAtTime(1 - flash * 0.85 - (low ? 0.3 : 0), t, 0.1);
      if (low && g.time > this.heartAt) {
        this.heartAt = g.time + 0.55;
        this.tone(this.master, 'sine', 60, 40, 0.12, 0.6);
        this.tone(this.master, 'sine', 55, 38, 0.1, 0.4, 0.18);
      }
    }
    this.radio(v !== null, dt);
  }

  /** Procedural station loops scheduled slightly ahead of time. */
  private radio(inVehicle: boolean, dt: number) {
    void dt;
    const ctx = this.ctx!;
    if (!inVehicle || this.station < 0) return;
    const st = STATIONS[this.station];
    if (st.kind === 'talk' || !st.bpm) return;
    const spb = 60 / st.bpm / 2;
    if (this.nextBeat < ctx.currentTime) this.nextBeat = ctx.currentTime + 0.05;
    while (this.nextBeat < ctx.currentTime + 0.2) {
      const b = this.beat++ % 32, at = this.nextBeat - ctx.currentTime;
      const prog = st.kind === 'rock' ? [82, 82, 98, 73] : [55, 65, 73, 49];
      const root = prog[Math.floor(b / 8) % 4];
      if (b % 4 === 0) this.tone(this.music, 'sine', 120, 40, 0.18, 0.9, at); // kick
      if (b % 8 === 4) this.noiseAt(at, 0.15, 1800, 0.7); // snare
      if (b % 2 === 1 || st.kind === 'rock') this.noiseAt(at, 0.03, 8000, 0.15); // hat
      if (st.kind === 'rock') this.tone(this.music, 'sawtooth', root, root, spb * 0.9, 0.18, at);
      else {
        this.tone(this.music, 'triangle', root, root, spb * 1.8, 0.25, at);
        const arp = [1, 1.5, 2, 3][b % 4];
        this.tone(this.music, 'square', root * 4 * arp, root * 4 * arp, spb * 0.6, 0.05, at);
      }
      this.nextBeat += spb;
    }
  }

  private noiseAt(delay: number, dur: number, freq: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, rand(0, 1));
    src.stop(t + dur + 0.02);
  }
}

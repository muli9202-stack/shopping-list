// All sounds are synthesized with WebAudio (no audio files): crowd bed, chants,
// roars, whistle, kicks, post and net. Commentary can also be spoken with the
// browser's Hebrew voice when one is installed.

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private crowdGain!: GainNode;
  private crowdFilter!: BiquadFilterNode;
  private chantGain!: GainNode;
  private noise!: AudioBuffer;
  private chantTimer = 0;
  private excite = 0.2;
  volume = 0.8;
  speech = true;
  private voice: SpeechSynthesisVoice | null = null;
  private lastSpeak = 0;

  constructor() {
    const pick = () => {
      const vs = speechSynthesis?.getVoices?.() ?? [];
      this.voice = vs.find((v) => v.lang?.toLowerCase().startsWith('he')) ?? null;
    };
    try {
      pick();
      speechSynthesis?.addEventListener?.('voiceschanged', pick);
    } catch {
      /* no speech synthesis */
    }
  }

  get hasHebrewVoice() {
    return !!this.voice;
  }

  // Must be called from a user gesture (browsers block audio until then).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = this.noise.getChannelData(c);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < len; i++) {
        // pinkish noise sounds like a distant crowd
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 700;
    this.crowdFilter.Q.value = 0.6;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    src.connect(this.crowdFilter).connect(this.crowdGain).connect(this.master);
    src.start();
    this.chantGain = ctx.createGain();
    this.chantGain.gain.value = 0.5;
    this.chantGain.connect(this.master);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }

  crowd(on: boolean) {
    if (!this.ctx) return;
    this.crowdGain.gain.setTargetAtTime(on ? 0.35 : 0, this.ctx.currentTime, 0.6);
  }

  private silenceT = 0;
  // The home crowd goes quiet (late away goal).
  silence(sec: number) {
    this.silenceT = sec;
  }

  // Whistles and jeers from the stands.
  boo() {
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) this.burst(1.4 + Math.random(), 180 + Math.random() * 60, 4, 0.22, 'bandpass', i * 0.12, 0.25);
    this.burst(1.2, 2600, 6, 0.05, 'bandpass', 0.1, 0.2);
  }

  // Each club gets its own chant rhythm.
  chantStyle = 0;
  setChantStyle(teamId: string) {
    let h = 0;
    for (const c of teamId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    this.chantStyle = h % 4;
  }

  update(dt: number, excitement: number) {
    if (!this.ctx) return;
    if (this.silenceT > 0) {
      this.silenceT -= dt;
      this.crowdGain.gain.setTargetAtTime(0.03, this.ctx.currentTime, 0.4);
      return;
    }
    this.excite += (excitement - this.excite) * Math.min(1, dt * 1.5);
    const t = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(0.22 + this.excite * 0.5, t, 0.3);
    this.crowdFilter.frequency.setTargetAtTime(550 + this.excite * 700, t, 0.3);
    this.chantTimer -= dt;
    if (this.chantTimer <= 0) {
      this.chantTimer = 9 + Math.random() * 14;
      if (this.excite < 0.6) this.chant();
    }
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', when = 0, attack = 0.005) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random() * 2);
    src.stop(t0 + dur + 0.05);
  }

  // Rhythmic "oh-oh-oh" + claps from the stands.
  chant() {
    if (!this.ctx) return;
    const patterns = [
      [0, 0.5, 1.0, 1.75, 2.0, 2.5, 3.0, 3.75],
      [0, 0.75, 1.5, 2.0, 2.25, 3.0],
      [0, 0.33, 0.66, 1.5, 2.0, 2.33, 2.66, 3.5],
      [0, 1.0, 1.5, 2.0, 3.0, 3.25, 3.5],
    ];
    const beats = patterns[this.chantStyle] ?? patterns[0];
    for (let r = 0; r < 2; r++)
      for (const b of beats) {
        this.burst(0.32, 420 + Math.random() * 40, 3, 0.18, 'bandpass', r * 4 + b, 0.06);
        this.burst(0.06, 2400, 1, 0.12, 'highpass', r * 4 + b + 0.25);
      }
  }

  roar(strength = 1) {
    if (!this.ctx) return;
    this.burst(3.5 * strength + 1, 900, 0.5, 0.9 * strength, 'bandpass', 0, 0.15);
    this.burst(4 * strength, 400, 0.7, 0.6 * strength, 'bandpass', 0.1, 0.3);
  }

  groan() {
    if (!this.ctx) return;
    this.burst(1.8, 350, 1.2, 0.45, 'bandpass', 0, 0.2);
  }

  whistle(kind: 'short' | 'long' | 'end' = 'short') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const pattern = kind === 'short' ? [[0, 0.25]] : kind === 'long' ? [[0, 0.9]] : [[0, 0.35], [0.5, 0.35], [1.0, 1.1]];
    for (const [w, d] of pattern) {
      const t0 = ctx.currentTime + w;
      const o = ctx.createOscillator();
      o.frequency.value = 2900;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 38;
      const lg = ctx.createGain();
      lg.gain.value = 120;
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.setValueAtTime(0.12, t0 + d - 0.05);
      g.gain.linearRampToValueAtTime(0, t0 + d);
      o.connect(g).connect(this.master);
      o.start(t0);
      lfo.start(t0);
      o.stop(t0 + d + 0.05);
      lfo.stop(t0 + d + 0.05);
    }
  }

  kick(power: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t0);
    o.frequency.exponentialRampToValueAtTime(55, t0 + 0.09);
    const g = ctx.createGain();
    const v = Math.min(0.6, 0.12 + power * 0.02);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.15);
    this.burst(0.05, 1800, 0.8, v * 0.6);
  }

  post() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (const f of [520, 1330, 2210]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + 1);
    }
    this.groan();
  }

  net() {
    this.burst(0.25, 300, 0.5, 0.25, 'lowpass');
  }

  say(text: string, priority = false) {
    if (!this.speech || !this.voice || typeof speechSynthesis === 'undefined') return;
    const now = performance.now();
    if (!priority && (speechSynthesis.speaking || now - this.lastSpeak < 2500)) return;
    if (priority) speechSynthesis.cancel();
    this.lastSpeak = now;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = this.voice;
    u.lang = this.voice.lang;
    u.rate = priority ? 1.2 : 1.1;
    u.pitch = priority ? 1.15 : 1;
    u.volume = Math.min(1, this.volume + 0.2);
    speechSynthesis.speak(u);
  }

  stopSpeech() {
    try {
      speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }
}

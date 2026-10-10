import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * רובי – the talking robot teacher. A shiny 3D head and body: the eyes blink and follow, the antenna
 * light glows while thinking, and the mouth opens and closes with the loudness of the voice (lip sync
 * from a Web Audio analyser on the reply audio).
 */
export class RobotView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private head = new THREE.Group();
  private mouth: THREE.Mesh;
  private mouthInner: THREE.Mesh;
  private eyes: THREE.Group[] = [];
  private antennaLight: THREE.Mesh;
  private arms: THREE.Group[] = [];
  private raf = 0;
  private t0 = performance.now();
  private open = 0;
  private thinking = false;
  private analyser: AnalyserNode | null = null;
  private data = new Uint8Array(256);
  private fakeTalkUntil = 0;
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private nextBlink = 2;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(2, 3, 4);
    this.scene.add(key);

    const shell = new THREE.MeshStandardMaterial({ color: '#f4f7fb', metalness: 0.25, roughness: 0.25 });
    const blue = new THREE.MeshStandardMaterial({ color: '#4dabf7', metalness: 0.4, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1b2340', metalness: 0.2, roughness: 0.15 });

    // head with a dark visor face
    const skull = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.25, 1.2, 6, 0.32), shell);
    const visor = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.85, 0.1, 4, 0.2), dark);
    visor.position.set(0, -0.02, 0.58);
    const ears = [-0.86, 0.86].map((x) => {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 24), blue);
      e.rotation.z = Math.PI / 2;
      e.position.set(x, 0, 0);
      return e;
    });
    this.head.add(skull, visor, ...ears);
    // glowing eyes
    for (const x of [-0.3, 0.3]) {
      const eye = new THREE.Group();
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), new THREE.MeshStandardMaterial({ color: '#74c0fc', emissive: '#4dabf7', emissiveIntensity: 1.6 }));
      glow.scale.z = 0.4;
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      pupil.position.set(0.03, 0.03, 0.05);
      eye.add(glow, pupil);
      eye.position.set(x, 0.12, 0.64);
      this.head.add(eye);
      this.eyes.push(eye);
    }
    // the mouth: a glowing bar that opens with the voice
    this.mouth = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.1, 0.05, 3, 0.04), new THREE.MeshStandardMaterial({ color: '#ff8787', emissive: '#ff6b6b', emissiveIntensity: 1 }));
    this.mouth.position.set(0, -0.22, 0.64);
    this.mouthInner = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.06, 0.04, 3, 0.02), new THREE.MeshBasicMaterial({ color: '#2b0a0a' }));
    this.mouthInner.position.set(0, -0.22, 0.655);
    this.head.add(this.mouth, this.mouthInner);
    // antenna
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 12), blue);
    stick.position.y = 0.78;
    this.antennaLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), new THREE.MeshStandardMaterial({ color: '#ffd43b', emissive: '#fab005', emissiveIntensity: 0.6 }));
    this.antennaLight.position.y = 1.0;
    this.head.add(stick, this.antennaLight);
    this.head.position.y = 0.55;

    // body and arms
    const body = new THREE.Group();
    const torso = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.95, 0.8, 5, 0.25), shell);
    torso.position.y = -0.62;
    const chest = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshStandardMaterial({ color: '#69db7c', emissive: '#40c057', emissiveIntensity: 0.8 }));
    chest.position.set(0, -0.55, 0.41);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 16), blue);
    neck.position.y = -0.1;
    body.add(torso, chest, neck);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.7, -0.3, 0);
      const arm = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.62, 0.22, 3, 0.09), blue);
      arm.position.y = -0.3;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), shell);
      hand.position.y = -0.66;
      pivot.add(arm, hand);
      pivot.rotation.z = side * 0.18;
      body.add(pivot);
      this.arms.push(pivot);
    }
    this.scene.add(this.head, body);
    this.camera.position.set(0, 0.35, 6);
    this.camera.lookAt(0, 0.22, 0);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.loop();
  }

  private resize = () => {
    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 260;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  setThinking(on: boolean) {
    this.thinking = on;
  }

  /** Mouth movement without audio (when the server has no voice): a talking rhythm for the reading time. */
  fakeTalk(text: string) {
    this.fakeTalkUntil = performance.now() + Math.min(12000, 500 + text.length * 65);
  }

  /** Play the reply audio (base64 mp3) and move the mouth with it. Resolves when it ends. */
  async say(b64: string): Promise<void> {
    this.stopAudio();
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => undefined);
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const buf = await this.ctx.decodeAudioData(bin.buffer);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const an = this.ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an).connect(this.ctx.destination);
    this.analyser = an;
    this.source = src;
    await new Promise<void>((resolve) => {
      src.onended = () => resolve();
      src.start();
    });
    this.analyser = null;
    this.source = null;
  }

  stopAudio() {
    try {
      this.source?.stop();
    } catch {
      // already stopped
    }
    this.source = null;
    this.analyser = null;
    this.fakeTalkUntil = 0;
  }

  private loop = () => {
    const t = (performance.now() - this.t0) / 1000;
    // loudness of the voice → how open the mouth is
    let target = 0;
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.data);
      let sum = 0;
      for (const v of this.data) sum += ((v - 128) / 128) ** 2;
      target = Math.min(1, Math.sqrt(sum / this.data.length) * 6);
    } else if (performance.now() < this.fakeTalkUntil) target = 0.35 + 0.35 * Math.abs(Math.sin(t * 11)) * Math.abs(Math.sin(t * 3.3));
    this.open += (target - this.open) * 0.45;
    this.mouth.scale.y = 1 + this.open * 3.2;
    this.mouthInner.scale.y = this.open * 3.4;
    this.mouthInner.visible = this.open > 0.05;
    // blink
    if (t > this.nextBlink) this.nextBlink = t + 2 + Math.random() * 3;
    const blink = this.nextBlink - t < 0.12 ? 0.1 : 1;
    for (const e of this.eyes) e.scale.y = blink;
    // head: a little life, and a curious tilt while thinking
    this.head.rotation.y = Math.sin(t * 0.7) * 0.18;
    this.head.rotation.z = this.thinking ? 0.12 : Math.sin(t * 0.5) * 0.04;
    this.head.position.y = 0.55 + Math.sin(t * 1.6) * 0.03 + this.open * 0.02;
    const mat = this.antennaLight.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = this.thinking ? 1 + Math.sin(t * 10) * 0.8 : 0.6;
    // arms move while talking
    this.arms.forEach((a, i) => (a.rotation.x = this.open > 0.1 ? Math.sin(t * 4 + i) * 0.25 : 0));
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.stopAudio();
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.ctx?.close().catch(() => undefined);
  }
}

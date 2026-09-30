import * as THREE from 'three';

/** Draw text (handwriting font) onto a canvas texture. */
export function textTexture(text: string, opts: { font?: number; color?: string; bg?: string; w?: number; h?: number } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, w, h);
  }
  let size = opts.font ?? 150;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `${size}px KtavYad, "Varela Round", sans-serif`;
    size -= 6;
  } while (ctx.measureText(text).width > w * 0.9 && size > 30);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = opts.color ?? '#2b2d42';
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export interface Stage3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dispose: () => void;
  onFrame: (fn: (dt: number, t: number) => void) => void;
  pick: (clientX: number, clientY: number, objects: THREE.Object3D[]) => THREE.Object3D | null;
}

/** A small three.js stage bound to a container element, with resize handling and a frame loop. */
export function createStage(container: HTMLElement, opts: { sky?: [string, string]; fov?: number; camZ?: number } = {}): Stage3D {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const [top, bottom] = opts.sky ?? ['#8ecae6', '#fff7e6'];
  scene.background = gradientTexture(top, bottom);
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 50, 1, 0.1, 100);
  camera.position.set(0, 0, opts.camZ ?? 10);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffe8cc, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 8, 6);
  sun.castShadow = true;
  scene.add(sun);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const fns: ((dt: number, t: number) => void)[] = [];
  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    fns.forEach((f) => f(dt, t));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  const ray = new THREE.Raycaster();
  return {
    renderer,
    scene,
    camera,
    onFrame: (fn) => fns.push(fn),
    pick: (x, y, objects) => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(objects, true)[0];
      if (!hit) return null;
      let o: THREE.Object3D | null = hit.object;
      while (o && !objects.includes(o)) o = o.parent;
      return o;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          (mat as THREE.MeshStandardMaterial).map?.dispose();
          mat.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function gradientTexture(top: string, bottom: string) {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Particle burst at a 3D point. */
export function burst(stage: Stage3D, at: THREE.Vector3, color: number) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.08, 6, 6);
  const parts: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];
  for (let k = 0; k < 26; k++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: k % 3 === 0 ? 0xffd43b : color }));
    m.position.copy(at);
    parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 7, (Math.random() - 0.5) * 4) });
    group.add(m);
  }
  stage.scene.add(group);
  let life = 0;
  stage.onFrame((dt) => {
    if (!group.parent) return;
    life += dt;
    for (const p of parts) {
      p.v.y -= 12 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.scale.setScalar(Math.max(0.01, 1 - life));
    }
    if (life > 1) {
      stage.scene.remove(group);
      geo.dispose();
    }
  });
}

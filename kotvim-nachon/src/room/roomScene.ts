import * as THREE from 'three';

/** Half the room's width: the room is 8.4 m × 8.4 m. */
export const HALF = 4.2;
const WALL_H = 3.4;

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}

/** Wooden floor planks (grayscale, tinted by the chosen floor colour). */
function planks() {
  return canvasTexture(
    512,
    512,
    (ctx) => {
      const rows = 8;
      const h = 512 / rows;
      for (let r = 0; r < rows; r++) {
        let x = -((r * 173) % 400);
        while (x < 512) {
          const len = 260 + ((x * 7 + r * 31) % 180);
          const shade = 215 + ((x + r * 13) % 35);
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          ctx.fillRect(x, r * h, len, h);
          // wood grain
          ctx.strokeStyle = 'rgba(0,0,0,.06)';
          ctx.lineWidth = 1.2;
          for (let g = 0; g < 5; g++) {
            ctx.beginPath();
            const y = r * h + 8 + g * (h / 5);
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(x + len * 0.3, y + 4, x + len * 0.6, y - 4, x + len, y + 2);
            ctx.stroke();
          }
          // gaps between planks
          ctx.fillStyle = 'rgba(0,0,0,.28)';
          ctx.fillRect(x, r * h, 2, h);
          x += len;
        }
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.fillRect(0, r * h, 512, 2);
      }
    },
    [4, 4],
  );
}

/** Soft wallpaper pattern (tinted by the chosen wall colour). */
function wallpaper() {
  return canvasTexture(
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(0,0,0,.05)';
      for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 14, 256);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      for (let y = 16; y < 256; y += 64)
        for (let x = 23; x < 256; x += 64) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
    },
    [6, 2],
  );
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Builds a bright, realistic kid's room: plank floor, wallpaper, baseboards, a big window with
 * curtains and sunlight, a door, pictures and a rug-friendly open floor. Returns the materials the
 * shop can recolour.
 */
export function buildRoom(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene.background = new THREE.Color('#f8f0e3');
  scene.fog = new THREE.Fog('#f8f0e3', 18, 40);

  // light: soft sky light + warm sun through the window + a fill light
  scene.add(new THREE.HemisphereLight(0xfff7ec, 0xc9a67a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.position.set(3, 7, -9);
  sun.target.position.set(0, 0, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xdbe9ff, 0.7);
  fill.position.set(6, 5, 6);
  scene.add(fill);

  const floorMat = new THREE.MeshStandardMaterial({ color: '#e6c9a8', map: planks(), roughness: 0.55, metalness: 0.02 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.1, HALF * 2), floorMat);
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffe8cc', map: wallpaper(), roughness: 0.95 });
  const white = new THREE.MeshStandardMaterial({ color: '#fdfdfb', roughness: 0.5 });

  // back wall with a window opening (built from 4 pieces)
  const winW = 2.6;
  const winH = 1.7;
  const winX = 0.9;
  const winY = 1.9;
  const bz = -HALF - 0.08;
  const leftW = HALF + winX - winW / 2;
  const rightW = HALF - winX - winW / 2;
  scene.add(
    box(leftW, WALL_H, 0.16, wallMat, -HALF + leftW / 2, WALL_H / 2, bz),
    box(rightW, WALL_H, 0.16, wallMat, HALF - rightW / 2, WALL_H / 2, bz),
    box(winW, winY - winH / 2, 0.16, wallMat, winX, (winY - winH / 2) / 2, bz),
    box(winW, WALL_H - (winY + winH / 2), 0.16, wallMat, winX, (WALL_H + winY + winH / 2) / 2, bz),
  );
  // window frame, cross bars, sill and the view outside
  const frame = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
  scene.add(
    box(winW + 0.16, 0.08, 0.2, frame, winX, winY + winH / 2, bz),
    box(winW + 0.3, 0.08, 0.34, frame, winX, winY - winH / 2 - 0.02, bz + 0.1),
    box(0.08, winH, 0.2, frame, winX - winW / 2, winY, bz),
    box(0.08, winH, 0.2, frame, winX + winW / 2, winY, bz),
    box(0.05, winH, 0.06, frame, winX, winY, bz),
    box(winW, 0.05, 0.06, frame, winX, winY, bz),
  );
  const skyTex = canvasTexture(
    256,
    256,
    (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#74c0fc');
      g.addColorStop(0.7, '#d0ebff');
      g.addColorStop(0.7, '#8ce99a');
      g.addColorStop(1, '#51cf66');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#fff';
      for (const [x, y, r] of [[60, 60, 22], [85, 55, 28], [110, 62, 20], [180, 90, 18], [200, 86, 24]]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.arc(215, 40, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f9e44';
      for (const x of [30, 140, 230]) {
        ctx.beginPath();
        ctx.arc(x, 175, 26, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [1, 1],
  );
  const view = new THREE.Mesh(new THREE.PlaneGeometry(winW * 1.6, winH * 1.6), new THREE.MeshBasicMaterial({ map: skyTex }));
  view.position.set(winX, winY, bz - 1.2);
  scene.add(view);
  // curtains
  const curtain = new THREE.MeshStandardMaterial({ color: '#ffc9c9', roughness: 0.9, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.7, winH + 0.8, 8, 1), curtain);
    const pos = c.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 14) * 0.05);
    c.geometry.computeVertexNormals();
    c.position.set(winX + side * (winW / 2 + 0.25), winY - 0.1, bz + 0.14);
    c.castShadow = true;
    scene.add(c);
  }
  scene.add(box(winW + 1.6, 0.04, 0.04, new THREE.MeshStandardMaterial({ color: '#adb5bd', metalness: 0.6, roughness: 0.3 }), winX, winY + winH / 2 + 0.35, bz + 0.16));

  // left wall with a door
  const lx = -HALF - 0.08;
  scene.add(box(0.16, WALL_H, HALF * 2, wallMat, lx, WALL_H / 2, 0));
  const doorMat = new THREE.MeshStandardMaterial({ color: '#f1e3d3', roughness: 0.6 });
  scene.add(box(0.06, 2.2, 1.0, doorMat, lx + 0.1, 1.1, 2.4), box(0.08, 2.32, 0.1, white, lx + 0.1, 1.16, 1.86), box(0.08, 2.32, 0.1, white, lx + 0.1, 1.16, 2.94), box(0.08, 0.1, 1.18, white, lx + 0.1, 2.3, 2.4));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshStandardMaterial({ color: '#fab005', metalness: 0.8, roughness: 0.25 }));
  knob.position.set(lx + 0.17, 1.05, 2.05);
  scene.add(knob);

  // baseboards
  scene.add(box(HALF * 2, 0.12, 0.04, white, 0, 0.06, -HALF + 0.02), box(0.04, 0.12, HALF * 2, white, -HALF + 0.02, 0.06, 0));

  // pictures on the walls
  const pic = (colors: string[], w: number, h: number, pos: [number, number, number], rotY: number) => {
    const tex = canvasTexture(
      128,
      128,
      (ctx) => {
        ctx.fillStyle = colors[0];
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = colors[1];
        ctx.beginPath();
        ctx.arc(64, 70, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors[2];
        ctx.fillRect(0, 96, 128, 32);
      },
      [1, 1],
    );
    const g = new THREE.Group();
    g.add(box(w + 0.1, h + 0.1, 0.05, new THREE.MeshStandardMaterial({ color: '#495057' }), 0, 0, 0));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    p.position.z = 0.03;
    g.add(p);
    g.position.set(...pos);
    g.rotation.y = rotY;
    scene.add(g);
  };
  pic(['#d0ebff', '#ffd43b', '#8ce99a'], 0.8, 0.6, [-2.6, 2.1, -HALF + 0.02], 0);
  pic(['#ffe3e3', '#f06595', '#ffc9c9'], 0.6, 0.8, [-HALF + 0.02, 2.1, -1.4], Math.PI / 2);
  pic(['#f3f0ff', '#845ef7', '#d0bfff'], 0.6, 0.6, [-HALF + 0.02, 2.2, -0.3], Math.PI / 2);

  // a ceiling lamp hanging from above
  const lampLight = new THREE.PointLight(0xfff0d0, 1.2, 12, 1.6);
  lampLight.position.set(0, WALL_H - 0.6, 0);
  scene.add(lampLight);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.35, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#ffe066', side: THREE.DoubleSide, emissive: '#ffd43b', emissiveIntensity: 0.3 }));
  shade.position.copy(lampLight.position).add(new THREE.Vector3(0, 0.1, 0));
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8), new THREE.MeshStandardMaterial({ color: '#343a40' }));
  cord.position.set(0, WALL_H - 0.05, 0);
  scene.add(shade, cord);

  return { floorMat, wallMat };
}

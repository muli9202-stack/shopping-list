import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { updateActive, useActiveChild } from '../store';
import { TopBar } from '../ui/kit';
import { useGuide } from '../ui/guide';
import { CATS, COLOR_PRICE, FLOOR_COLORS, ITEMS, ITEM_BY_ID, WALL_COLORS, type ItemCat } from './items';
import { confetti, sfx } from '../ui/effects';
import { speak } from '../services/tts';
import type { PlacedItem, RoomState } from '../types';
import { HALF, buildRoom } from './roomScene';
import { spendPoints } from '../engine/progress';
import { animateWalk, person } from '../arcade/models';


/** The child's own 3D room: rotate the view, buy things with points, place and move them. */
export function RoomScreen() {
  const child = useActiveChild();
  const wrap = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [shop, setShop] = useState(false);
  const [cat, setCat] = useState<ItemCat | 'colors'>('furniture');
  const [msg, setMsg] = useState('');
  const api = useRef<{ sync: (room: RoomState, sel: string | null) => void; night: (on: boolean) => void } | null>(null);
  // play mode: the child's own character walks in the room, pets follow, items react to a touch
  const [play, setPlay] = useState(false);
  const [night, setNight] = useState(false);
  const playRef = useRef(false);
  playRef.current = play;
  useGuide('room');

  useEffect(() => {
    if (!wrap.current) return;
    const el = wrap.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.set(9.6, 7.4, 10.8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.6, 0);
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minAzimuthAngle = -0.1;
    controls.maxAzimuthAngle = Math.PI / 2 + 0.1;
    controls.enableDamping = true;

    const { floorMat, wallMat, setNight: nightMode, dispose: disposeRoom } = buildRoom(scene, renderer);

    // the child's character
    const me = person(3, 0x8338ec);
    const mePos = new THREE.Vector3(0, 0, 2.5);
    me.root.position.copy(mePos);
    me.root.visible = false;
    scene.add(me.root);
    const joy = { on: false, x0: 0, y0: 0, dx: 0, dy: 0 };
    const keys = new Set<string>();
    const hearts: { s: THREE.Sprite; t: number }[] = [];
    const heartTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.font = '52px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', 32, 36);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const pop = (obj: THREE.Object3D) => {
      obj.userData.bounce = 1;
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthTest: false }));
        sp.scale.setScalar(0.45);
        sp.position.set(obj.position.x + (i - 1) * 0.3, 1.2 + i * 0.15, obj.position.z);
        scene.add(sp);
        hearts.push({ s: sp, t: 0 });
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!playRef.current) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.type === 'keydown' ? keys.add(e.key) : keys.delete(e.key);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    const selRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.85, 40), new THREE.MeshBasicMaterial({ color: '#8338ec', side: THREE.DoubleSide }));
    selRing.rotation.x = -Math.PI / 2;
    selRing.position.y = 0.03;
    selRing.visible = false;
    scene.add(selRing);

    const objects = new Map<string, THREE.Group>();
    let current: RoomState | null = null;
    let sel: string | null = null;

    const sync = (room: RoomState, selectedUid: string | null) => {
      current = room;
      sel = selectedUid;
      floorMat.color.set(room.floor);
      wallMat.color.set(room.wall);
      const keep = new Set(room.placed.map((p) => p.uid));
      for (const [uid, obj] of objects) if (!keep.has(uid)) {
        scene.remove(obj);
        objects.delete(uid);
      }
      for (const p of room.placed) {
        let obj = objects.get(p.uid);
        if (!obj) {
          const def = ITEM_BY_ID[p.itemId];
          if (!def) continue;
          obj = def.build();
          obj.userData.uid = p.uid;
          obj.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          objects.set(p.uid, obj);
          scene.add(obj);
          obj.scale.setScalar(0.01);
          obj.userData.grow = 0;
        }
        obj.position.x = p.x;
        obj.position.z = p.z;
        obj.rotation.y = p.rot;
      }
      const s = sel ? objects.get(sel) : null;
      selRing.visible = !!s;
    };
    api.current = { sync, night: nightMode };

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // picking & dragging on the floor plane
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    let dragging: string | null = null;
    let downAt = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
      ray.setFromCamera(ndc(e), camera);
      const hits = ray.intersectObjects([...objects.values()], true);
      if (playRef.current) {
        // play mode: touching an item makes it jump with hearts; dragging the floor walks
        if (hits.length) {
          let o: THREE.Object3D | null = hits[0].object;
          while (o && !o.userData.uid) o = o.parent;
          if (o) {
            pop(o);
            sfx('pop');
            return;
          }
        }
        Object.assign(joy, { on: true, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
        controls.enabled = false;
        return;
      }
      if (hits.length) {
        let o: THREE.Object3D | null = hits[0].object;
        while (o && !o.userData.uid) o = o.parent;
        if (o) {
          dragging = o.userData.uid as string;
          controls.enabled = false;
          setSelected(dragging);
          sfx('pop');
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      if (joy.on) {
        const dx = e.clientX - joy.x0;
        const dy = e.clientY - joy.y0;
        const l = Math.max(40, Math.hypot(dx, dy));
        joy.dx = dx / l;
        joy.dy = dy / l;
        return;
      }
      if (!dragging) return;
      ray.setFromCamera(ndc(e), camera);
      const p = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, p)) {
        const obj = objects.get(dragging);
        if (obj) {
          obj.position.x = THREE.MathUtils.clamp(p.x, -HALF + 0.4, HALF - 0.4);
          obj.position.z = THREE.MathUtils.clamp(p.z, -HALF + 0.4, HALF - 0.4);
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      if (joy.on) {
        Object.assign(joy, { on: false, dx: 0, dy: 0 });
        controls.enabled = true;
        return;
      }
      if (dragging) {
        const obj = objects.get(dragging);
        const uid = dragging;
        dragging = null;
        controls.enabled = true;
        if (obj && current) {
          const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6;
          if (moved)
            updateActive((c) => ({
              ...c,
              room: { ...c.room, placed: c.room.placed.map((p) => (p.uid === uid ? { ...p, x: obj.position.x, z: obj.position.z } : p)) },
              updatedAt: Date.now(),
            }));
        }
      } else if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) setSelected(null);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const clock = new THREE.Clock();
    let raf = 0;
    let prev = 0;
    const loop = () => {
      const t = clock.getElapsedTime();
      const dt = Math.min(0.05, t - prev);
      prev = t;
      me.root.visible = playRef.current;
      if (playRef.current) {
        let dx = joy.dx;
        let dy = joy.dy;
        if (keys.has('ArrowLeft')) dx -= 1;
        if (keys.has('ArrowRight')) dx += 1;
        if (keys.has('ArrowUp')) dy -= 1;
        if (keys.has('ArrowDown')) dy += 1;
        const moving = Math.hypot(dx, dy) > 0.15;
        if (moving) {
          // move relative to the camera: up on the screen = away from the camera
          const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
          const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
          const dir = right.multiplyScalar(dx).add(fwd.multiplyScalar(-dy)).normalize();
          mePos.addScaledVector(dir, 3 * dt);
          mePos.x = THREE.MathUtils.clamp(mePos.x, -HALF + 0.4, HALF - 0.4);
          mePos.z = THREE.MathUtils.clamp(mePos.z, -HALF + 0.4, HALF - 0.4);
          me.root.rotation.y = Math.atan2(dir.x, dir.z);
        }
        me.root.position.copy(mePos);
        animateWalk(me, t, moving, false);
        controls.target.lerp(new THREE.Vector3(mePos.x, 0.8, mePos.z), 0.05);
        // pets follow the child
        let k = 0;
        for (const obj of objects.values()) {
          const def = ITEM_BY_ID[(current?.placed.find((p) => p.uid === obj.userData.uid)?.itemId) ?? ''];
          if (def?.cat !== 'animals' || def.id === 'fish') continue;
          const goal = new THREE.Vector3(mePos.x + Math.cos(k * 2.1 + 1) * 1.2, 0, mePos.z + Math.sin(k * 2.1 + 1) * 1.2);
          const d = goal.sub(obj.position).setY(0);
          if (d.length() > 0.3) {
            obj.position.addScaledVector(d.normalize(), Math.min(2.4 * dt, d.length()));
            obj.rotation.y = Math.atan2(d.x, d.z);
          }
          k++;
        }
      }
      for (const h of [...hearts]) {
        h.t += dt;
        h.s.position.y += dt * 0.8;
        (h.s.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - h.t);
        if (h.t > 1) {
          scene.remove(h.s);
          hearts.splice(hearts.indexOf(h), 1);
        }
      }
      for (const obj of objects.values())
        if (obj.userData.bounce > 0) {
          obj.userData.bounce = Math.max(0, obj.userData.bounce - dt * 2.5);
          obj.position.y = Math.sin(obj.userData.bounce * Math.PI) * 0.35;
        }
      controls.update();
      for (const obj of objects.values()) {
        if (obj.userData.grow < 1) {
          const g = (obj.userData.grow = Math.min(1, obj.userData.grow + 0.04));
          // ease-out-back "pop" when an item appears
          const e = 1 + 2.70158 * Math.pow(g - 1, 3) + 1.70158 * Math.pow(g - 1, 2);
          obj.scale.setScalar(Math.max(0.01, e));
        }
        const anim = obj.userData.anim as ((g: THREE.Group, t: number) => void) | undefined;
        anim?.(obj, t);
      }
      const s = sel ? objects.get(sel) : null;
      if (s) {
        selRing.position.x = s.position.x;
        selRing.position.z = s.position.z;
        selRing.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      controls.dispose();
      disposeRoom();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    if (child) api.current?.sync(child.room, selected);
  }, [child, selected]);
  useEffect(() => api.current?.night(night), [night]);

  if (!child) return null;
  const room = child.room;
  const selItem = room.placed.find((p) => p.uid === selected);

  const buy = (id: string) => {
    const def = ITEM_BY_ID[id];
    if (child.points < def.price) {
      sfx('bad');
      setMsg(`חסרות לך ${def.price - child.points} נקודות. בוא נלמד עוד קצת! 💪`);
      speak('חסרות לך עוד נקודות. בוא נלמד ונצבור עוד!');
      return;
    }
    const uid = `${id}-${Date.now().toString(36)}`;
    const placed: PlacedItem = { uid, itemId: id, x: (Math.random() - 0.5) * 5, z: (Math.random() - 0.5) * 5, rot: 0 };
    updateActive((c) => ({
      ...spendPoints(c, def.price),
      room: { ...c.room, owned: [...c.room.owned, id], placed: [...c.room.placed, placed] },
    }));
    sfx('coin');
    confetti(70);
    speak(`קנית ${def.name}! איזה יופי!`);
    setMsg('');
    setShop(false);
    setSelected(uid);
  };

  const buyColor = (kind: 'wall' | 'floor', color: string) => {
    if (room[kind] === color) return;
    if (child.points < COLOR_PRICE) {
      sfx('bad');
      setMsg('חסרות נקודות לצבע חדש');
      return;
    }
    updateActive((c) => ({ ...spendPoints(c, COLOR_PRICE), room: { ...c.room, [kind]: color } }));
    sfx('coin');
  };

  const updatePlaced = (fn: (p: PlacedItem[]) => PlacedItem[]) => updateActive((c) => ({ ...c, room: { ...c.room, placed: fn(c.room.placed) }, updatedAt: Date.now() }));

  const stored = (() => {
    const counts = new Map<string, number>();
    room.owned.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    room.placed.forEach((p) => counts.set(p.itemId, (counts.get(p.itemId) ?? 0) - 1));
    return [...counts.entries()].filter(([, n]) => n > 0).map(([id]) => id);
  })();

  return (
    <div className="screen" style={{ background: '#fff4e6', paddingBottom: 8 }}>
      <TopBar title={`🏠 החדר של ${child.name}`} guide="room" />
      <div ref={wrap} className="three-wrap" style={{ height: '58vh', minHeight: 320 }}>
        {selItem && (
          <div className="hud">
            <div className="row">
              <button className="icon-btn" aria-label="סיבוב" onClick={() => updatePlaced((ps) => ps.map((p) => (p.uid === selected ? { ...p, rot: p.rot + Math.PI / 4 } : p)))}>
                🔄
              </button>
              <button
                className="icon-btn"
                aria-label="למחסן"
                onClick={() => {
                  updatePlaced((ps) => ps.filter((p) => p.uid !== selected));
                  setSelected(null);
                }}
              >
                📦
              </button>
            </div>
            <span className="points-pill" style={{ fontSize: 16 }}>
              {ITEM_BY_ID[selItem.itemId]?.emoji} גררו להזזה
            </span>
          </div>
        )}
      </div>
      <p className="small muted center" style={{ margin: '6px 0' }}>
        {play ? '🚶 גררו את האצבע כדי ללכת · לחצו על חיה או חפץ' : '👆 גררו ברקע כדי לסובב · גררו חפץ כדי להזיז אותו'}
      </p>
      {msg && <div className="card center" style={{ background: '#fff9db' }}>{msg}</div>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn big green grow" onClick={() => setShop(true)}>
          🛒 חנות
        </button>
        <button
          className={`btn big ${play ? 'purple' : 'white'}`}
          onClick={() => {
            setPlay(!play);
            setSelected(null);
            sfx('pop');
          }}
        >
          {play ? '✋ לעצב' : '🚶 לטייל'}
        </button>
        <button className="btn big white" aria-label="יום או לילה" onClick={() => setNight(!night)}>
          {night ? '☀️' : '🌙'}
        </button>
      </div>
      {stored.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <b>📦 המחסן שלי</b>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
            {stored.map((id) => (
              <button
                key={id}
                className="chip"
                onClick={() => {
                  const uid = `${id}-${Date.now().toString(36)}`;
                  updatePlaced((ps) => [...ps, { uid, itemId: id, x: 0, z: 0, rot: 0 }]);
                  setSelected(uid);
                }}
              >
                {ITEM_BY_ID[id].emoji} {ITEM_BY_ID[id].name}
              </button>
            ))}
          </div>
        </div>
      )}

      {shop && (
        <div className="overlay" onClick={() => setShop(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="row">
              <h2 className="grow" style={{ margin: 0 }}>
                🛒 החנות
              </h2>
              <span className="points-pill">⭐ {child.points}</span>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
              {CATS.map((c) => (
                <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
            {msg && <div className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>{msg}</div>}
            {cat === 'colors' ? (
              <div>
                <b>צבע קיר ({COLOR_PRICE} ⭐)</b>
                <div className="row" style={{ flexWrap: 'wrap', margin: '8px 0 14px' }}>
                  {WALL_COLORS.map((c) => (
                    <button key={c} onClick={() => buyColor('wall', c)} style={{ width: 48, height: 48, borderRadius: 14, background: c, border: room.wall === c ? '4px solid var(--purple)' : '2px solid #dee2e6' }} />
                  ))}
                </div>
                <b>צבע רצפה ({COLOR_PRICE} ⭐)</b>
                <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                  {FLOOR_COLORS.map((c) => (
                    <button key={c} onClick={() => buyColor('floor', c)} style={{ width: 48, height: 48, borderRadius: 14, background: c, border: room.floor === c ? '4px solid var(--purple)' : '2px solid #dee2e6' }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid2">
                {ITEMS.filter((i) => i.cat === cat && i.price > 0).map((i) => {
                  const afford = child.points >= i.price;
                  return (
                    <button key={i.id} className="card center" style={{ border: 'none', gap: 4, opacity: afford ? 1 : 0.6, cursor: 'pointer' }} onClick={() => buy(i.id)}>
                      <span style={{ fontSize: 46 }}>{i.emoji}</span>
                      <b>{i.name}</b>
                      <span style={{ color: afford ? 'var(--orange)' : 'var(--muted)', fontWeight: 700 }}>
                        {afford ? '' : '🔒 '}
                        {i.price} ⭐
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

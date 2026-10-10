import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameProps } from './common';
import { GameShell } from './common';
import { mixedQuestions } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, pick } from '../ui/kit';
import { animateWalk, cashBundle, group, label, person, product, rbox, cyl, type Character } from '../arcade/models';
import type { Question } from '../types';

/**
 * "Word restaurant" – a 3D isometric diner like the business games, where spelling IS the game:
 * a customer orders a word (heard aloud, with its picture), three counters hold three spellings, the
 * child taps the right counter, the chef walks there, takes the plate and serves it.
 */
export function WordDinerGame({ skills, grade, rounds, report, finish }: GameProps) {
  const qs = useMemo(() => mixedQuestions(skills, grade, Math.ceil(rounds / skills.length), 'choose').slice(0, rounds), [skills, grade, rounds]);
  const host = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [result, setResult] = useState<null | { ok: boolean; q: Question }>(null);
  const [cash, setCash] = useState(0);
  const scoreRef = useRef(0);
  const sceneApi = useRef<{ newOrder: (q: Question) => void } | null>(null);
  const qRef = useRef<Question | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffe8cc');
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(9, 11, 9);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa08060, 1.1));
    const sun = new THREE.DirectionalLight(0xfff3dd, 2);
    sun.position.set(5, 10, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    scene.add(sun);
    // floor, walls, decoration
    const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 8), new THREE.MeshStandardMaterial({ color: '#fff4e6', roughness: 0.8 }));
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);
    for (let x = -4.5; x <= 4.5; x += 1) for (let z = -3.5; z <= 3.5; z += 1) if ((Math.round(x + 4.5) + Math.round(z + 3.5)) % 2 === 0) scene.add(rbox(1, 0.01, 1, '#ffd8a8', x, 0.005, z, 0.001));
    scene.add(rbox(10.2, 2, 0.25, '#ff922b', 0, 1, -4.1, 0.05), rbox(0.25, 2, 8.2, '#ff922b', -5.1, 1, 0, 0.05));
    const sign = label('🍽️ מסעדת המילים', '#ffffff', '#e8590c', 1.4);
    sign.position.set(0, 2.6, -4);
    scene.add(sign);
    for (const [x, z] of [
      [3.6, 2.6],
      [-4.2, 2.8],
    ])
      scene.add(group(cyl(0.6, 0.6, 0.06, '#ffffff', x, 0.75, z), cyl(0.06, 0.06, 0.72, '#868e96', x, 0.37, z), rbox(0.4, 0.5, 0.4, '#f06595', x + 0.8, 0.25, z), rbox(0.4, 0.5, 0.4, '#f06595', x - 0.8, 0.25, z)));

    // three counters (spellings) along the back
    const counterX = [-2.4, 0, 2.4];
    const counters = counterX.map((x) => {
      const g = group(rbox(2.2, 0.9, 0.9, '#ffffff', 0, 0.45, 0, 0.08), rbox(2.26, 0.1, 0.96, '#e8590c', 0, 0.92, 0, 0.04));
      g.position.set(x, 0, -2.8);
      scene.add(g);
      return { g, x, tag: null as THREE.Sprite | null, dish: null as THREE.Object3D | null, option: '' };
    });
    const chef = person(2, 0xffffff, 0xffffff);
    const chefPos = new THREE.Vector3(0, 0, -0.6);
    chef.root.position.copy(chefPos);
    scene.add(chef.root);
    let customer: { c: Character; pos: THREE.Vector3; bubble: THREE.Sprite } | null = null;
    let leaving: { c: Character; pos: THREE.Vector3 }[] = [];
    let target: THREE.Vector3 | null = null;
    let onArrive: (() => void) | null = null;
    let held: THREE.Object3D | null = null;
    const door = new THREE.Vector3(5.5, 0, 2.5);
    const seat = new THREE.Vector3(0, 0, 1.7);
    let seed = 1;

    const newOrder = (q: Question) => {
      qRef.current = q;
      // three counters: the right spelling and two wrong ones, in random order
      const opts = [q.answer, ...q.options.filter((o) => o !== q.answer)].slice(0, 3).sort(() => Math.random() - 0.5);
      counters.forEach((c, k) => {
        if (c.tag) c.g.remove(c.tag);
        if (c.dish) c.g.remove(c.dish);
        c.option = opts[k] ?? '';
        c.g.visible = !!c.option;
        if (!c.option) return;
        c.tag = label(c.option, '#212529', 'rgba(255,255,255,.97)', 1.7);
        c.tag.position.set(0, 2.1, 0);
        c.dish = product('cake');
        c.dish.position.set(0, 0.98, 0.1);
        c.g.add(c.tag, c.dish);
      });
      const c = person(seed++);
      const pos = door.clone();
      c.root.position.copy(pos);
      const bubble = label(q.kind === 'sentence' ? q.display.replace('___', '?') : `${q.emoji ?? '🍽️'} ?`, '#212529', '#fff3bf', q.kind === 'sentence' ? 0.8 : 1.1);
      bubble.position.y = 1.9;
      c.root.add(bubble);
      scene.add(c.root);
      customer = { c, pos, bubble };
    };
    sceneApi.current = { newOrder };

    const walk = (ch: Character, pos: THREE.Vector3, to: THREE.Vector3, speed: number, dt: number, t: number) => {
      const d = to.clone().sub(pos).setY(0);
      const l = d.length();
      if (l < 0.05) {
        animateWalk(ch, t, false, !!held && ch === chef);
        return true;
      }
      pos.add(d.multiplyScalar(Math.min(l, speed * dt) / l));
      ch.root.position.copy(pos);
      ch.root.rotation.y = Math.atan2(to.x - pos.x, to.z - pos.z);
      animateWalk(ch, t, true, !!held && ch === chef);
      return false;
    };

    // tap a counter: the chef walks there, takes the plate, and serves it
    const ray = new THREE.Raycaster();
    const onDown = (e: PointerEvent) => {
      if (busy.current || !qRef.current || !customer) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = counters.find((c) => c.g.visible && ray.intersectObject(c.g, true).length);
      if (!hit) return;
      busy.current = true;
      sfx('pop');
      target = new THREE.Vector3(hit.x, 0, -1.9);
      onArrive = () => {
        held = product('cake');
        held.position.set(0, 0, 0);
        chef.hands.add(held);
        hit.g.remove(hit.dish!);
        target = seat.clone().add(new THREE.Vector3(0, 0, -0.9));
        onArrive = () => {
          if (held) chef.hands.remove(held);
          held = null;
          const q = qRef.current!;
          const ok = hit.option === q.answer;
          report(q.skill, ok, q.answer, hit.option);
          if (ok) {
            scoreRef.current += 1;
            sfx('coin');
            speak(pick(PRAISE));
            const bills = cashBundle();
            bills.position.set(0.9, 0.8, 1.7);
            scene.add(bills);
            setTimeout(() => scene.remove(bills), 1200);
            setCash((v) => v + 10);
          } else {
            sfx('bad');
            speak(`${pick(ENCOURAGE)}. כותבים ${q.say}`);
          }
          setResult({ ok, q });
          if (customer) {
            customer.c.root.remove(customer.bubble);
            const face = label(ok ? '😋' : '🤔', '#212529', 'rgba(255,255,255,0)', 1.2);
            face.position.y = 1.9;
            customer.c.root.add(face);
            const leaver = customer;
            customer = null;
            setTimeout(() => leaving.push(leaver), 900);
          }
          target = new THREE.Vector3(0, 0, -0.6);
          onArrive = null;
        };
      };
    };
    renderer.domElement.addEventListener('pointerdown', onDown);

    const resize = () => {
      const w = el.clientWidth || 360;
      const h = el.clientHeight || 360;
      renderer.setSize(w, h);
      const view = 4.6;
      Object.assign(camera, { left: (-view * w) / h, right: (view * w) / h, top: view, bottom: -view });
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      if (target && walk(chef, chefPos, target, 3.4, dt, t)) {
        target = null;
        const f = onArrive;
        onArrive = null;
        f?.();
      }
      if (!target) animateWalk(chef, t, false, !!held);
      if (customer) {
        if (walk(customer.c, customer.pos, seat, 2.4, dt, t)) customer.c.root.rotation.y = Math.PI;
        customer.bubble.position.y = 1.9 + Math.sin(t * 3) * 0.05;
      }
      leaving = leaving.filter((l) => {
        if (walk(l.c, l.pos, door, 2.6, dt, t)) {
          scene.remove(l.c.root);
          return false;
        }
        return true;
      });
      for (const c of counters) if (c.dish) c.dish.rotation.y = t;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.dispose();
      renderer.domElement.remove();
      sceneApi.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a new customer for every question
  useEffect(() => {
    const q = qs[i];
    if (!q) return;
    busy.current = false;
    setResult(null);
    const t = setTimeout(() => {
      sceneApi.current?.newOrder(q);
      speak(q.say, { force: true, rate: 0.85 });
    }, 400);
    return () => clearTimeout(t);
  }, [i, qs]);

  const next = () => {
    if (i + 1 >= qs.length) finish(scoreRef.current, qs.length);
    else setI(i + 1);
  };

  const q = qs[i];
  if (!q) return null;
  return (
    <GameShell game="worddiner" title="🍽️ מסעדת המילים" done={i} total={qs.length} instruction="הלקוח מזמין מילה – לחצו על הדלפק עם הכתיב הנכון, והשף יגיש!">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="points-pill" style={{ background: '#d3f9d8' }}>💵 {cash}</span>
        <button className="btn white" style={{ padding: '6px 14px' }} onClick={() => speak(q.say, { force: true, rate: 0.8 })}>
          🔊 מה הוא הזמין?
        </button>
      </div>
      <div ref={host} style={{ height: '52vh', minHeight: 300, borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
        {result && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 18, padding: '10px 18px', boxShadow: '0 4px 14px rgba(0,0,0,.2)', textAlign: 'center', minWidth: 220 }}>
            <div style={{ fontWeight: 700, color: result.ok ? 'var(--green)' : 'var(--red)' }}>{result.ok ? 'הלקוח מרוצה! 😋' : 'אופס! ככה כותבים:'}</div>
            <div className="word-big" style={{ fontSize: 46 }}>
              {result.q.answer}
            </div>
            <button className="btn green" onClick={next}>
              הלקוח הבא ⬅️
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
}

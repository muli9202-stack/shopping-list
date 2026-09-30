import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameProps } from './common';
import { GameShell, QuestionPrompt, fontReady } from './common';
import { mixedQuestions } from '../engine/questions';
import { burst, createStage, textTexture, type Stage3D } from './three-util';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, pick } from '../ui/kit';

const CUBE_COLORS = ['#ffd43b', '#74c0fc', '#ff8787', '#8ce99a', '#e599f7'];

/** Letter rain: 3D letter cubes fall from the sky – catch the missing letter before it lands. */
export function RainGame({ skills, grade, rounds, report, finish }: GameProps) {
  const qs = useMemo(
    () => mixedQuestions(skills, grade, Math.ceil(rounds / skills.length) + 2, 'missing').filter((q) => q.kind === 'missing').slice(0, rounds),
    [skills, grade, rounds],
  );
  const [i, setI] = useState(0);
  const [fill, setFill] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage3D | null>(null);
  const cubes = useRef<THREE.Mesh[]>([]);
  const busy = useRef(false);
  const score = useRef(0);
  const qsRef = useRef(qs);
  const iRef = useRef(i);
  qsRef.current = qs;
  iRef.current = i;
  const q = qs[i];

  useEffect(() => {
    const stage = createStage(wrap.current!, { sky: ['#4c6ef5', '#d0bfff'], camZ: 11 });
    stageRef.current = stage;
    // stars in the background
    const starGeo = new THREE.BufferGeometry();
    const pts = new Float32Array(300);
    for (let k = 0; k < 300; k++) pts[k] = (Math.random() - 0.5) * (k % 3 === 2 ? 4 : 24);
    starGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 }));
    stars.position.z = -6;
    stage.scene.add(stars);
    // a little basket character at the bottom
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1, 1, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xc08552, side: THREE.DoubleSide }));
    basket.position.y = -4.3;
    stage.scene.add(basket);
    stage.onFrame((dt, t) => {
      stars.rotation.z = t * 0.02;
      basket.position.x = Math.sin(t * 0.8) * 2.5;
      for (const c of cubes.current) {
        const d = c.userData as { v: number; caught?: boolean };
        if (d.caught) continue;
        c.position.y -= d.v * dt;
        c.rotation.x += dt * 0.8;
        c.rotation.y += dt * 1.1;
        if (c.position.y < -5.5) {
          c.position.y = 6 + Math.random() * 3;
          c.position.x = (Math.random() - 0.5) * 7;
        }
      }
    });
    const el = stage.renderer.domElement;
    const onDown = (e: PointerEvent) => {
      const hit = stage.pick(e.clientX, e.clientY, cubes.current);
      if (hit) onCatch(hit as THREE.Mesh);
    };
    el.addEventListener('pointerdown', onDown);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      stage.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !q) return;
    let cancelled = false;
    fontReady().then(() => {
      if (cancelled) return;
      cubes.current.forEach((c) => stage.scene.remove(c));
      const letters = [...q.options, ...q.options, ...q.options];
      cubes.current = letters.map((L, k) => {
        const tex = textTexture(L, { font: 200, w: 256, h: 256, bg: CUBE_COLORS[k % CUBE_COLORS.length] });
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
        const cube = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), mat);
        cube.position.set((Math.random() - 0.5) * 7, 5 + k * 1.6, (Math.random() - 0.5) * 1.5);
        cube.userData = { v: 1.1 + Math.random() * 0.6 + grade * 0.05, letter: L };
        stage.scene.add(cube);
        return cube;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [q, grade]);

  const onCatch = (c: THREE.Mesh) => {
    if (busy.current) return;
    const cur = qsRef.current[iRef.current];
    const L = c.userData.letter as string;
    const ok = L === cur.answer;
    report(cur.skill, ok, cur.word, cur.display.replace('_', L));
    const stage = stageRef.current!;
    burst(stage, c.position.clone(), ok ? 0x2ec27e : 0xef476f);
    if (ok) {
      busy.current = true;
      sfx('win');
      speak(`${pick(PRAISE)} ${cur.say}`);
      score.current += 1;
      setFill(cur.answer);
      stage.scene.remove(c);
      setTimeout(() => {
        busy.current = false;
        setFill(null);
        if (iRef.current + 1 >= qsRef.current.length) finish(score.current, qsRef.current.length);
        else setI(iRef.current + 1);
      }, 1500);
    } else {
      sfx('bad');
      speak(pick(ENCOURAGE));
      c.position.y = 7;
    }
  };

  if (!q) return <div className="card">אין מספיק מילים – ממשיכים!</div>;
  return (
    <GameShell game="rain" title="🌠 גשם אותיות" done={i} total={qs.length} instruction="תפסו את האות החסרה מבין הקוביות שנופלות">
      <QuestionPrompt q={q} grade={grade} fill={fill} />
      <div ref={wrap} className="three-wrap" style={{ height: '50vh', minHeight: 300 }} />
    </GameShell>
  );
}

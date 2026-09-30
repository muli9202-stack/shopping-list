import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameProps } from './common';
import { GameShell, QuestionPrompt, fontReady } from './common';
import { mixedQuestions } from '../engine/questions';
import { burst, createStage, textTexture, type Stage3D } from './three-util';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, pick } from '../ui/kit';

const COLORS = [0xff5d8f, 0x3a86ff, 0xffb703, 0x2ec27e, 0x8338ec, 0xfb8500];

/** 3D balloons carry the answers – pop the one that is written correctly. */
export function BalloonsGame({ skills, grade, rounds, report, finish }: GameProps) {
  const qs = useMemo(() => mixedQuestions(skills, grade, Math.ceil(rounds / skills.length), 'choose').slice(0, rounds), [skills, grade, rounds]);
  const [i, setI] = useState(0);
  const [fill, setFill] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage3D | null>(null);
  const balloons = useRef<THREE.Group[]>([]);
  const busy = useRef(false);
  const score = useRef(0);
  const q = qs[i];

  useEffect(() => {
    const stage = createStage(wrap.current!, { sky: ['#a5d8ff', '#fff4e6'] });
    stageRef.current = stage;
    // ground + clouds
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshStandardMaterial({ color: 0x8ce99a }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    stage.scene.add(ground);
    for (let k = 0; k < 5; k++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.6 + Math.random() * 0.4, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        s.position.set(j * 0.7, Math.random() * 0.3, 0);
        cloud.add(s);
      }
      cloud.position.set(-8 + k * 4, 3 + Math.random() * 2, -8);
      stage.scene.add(cloud);
      stage.onFrame((dt) => {
        cloud.position.x += dt * 0.3;
        if (cloud.position.x > 10) cloud.position.x = -10;
      });
    }
    stage.onFrame((dt, t) => {
      balloons.current.forEach((b, k) => {
        const d = b.userData as { baseX: number; speed: number; popped?: boolean };
        if (d.popped) return;
        b.position.y += dt * d.speed;
        if (b.position.y > 4.5) b.position.y = -5;
        b.position.x = d.baseX + Math.sin(t * 1.2 + k) * 0.35;
        b.rotation.z = Math.sin(t * 1.5 + k) * 0.08;
      });
    });
    const el = stage.renderer.domElement;
    const onDown = (e: PointerEvent) => {
      const hit = stage.pick(e.clientX, e.clientY, balloons.current);
      if (hit) onPop(hit as THREE.Group);
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
      balloons.current.forEach((b) => stage.scene.remove(b));
      const n = q.options.length;
      balloons.current = q.options.map((opt, k) => {
        const g = new THREE.Group();
        const color = COLORS[(k + i) % COLORS.length];
        const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1 }));
        body.scale.set(1, 1.18, 1);
        body.castShadow = true;
        g.add(body);
        const knot = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 12), new THREE.MeshStandardMaterial({ color }));
        knot.position.y = -1.35;
        knot.rotation.x = Math.PI;
        g.add(knot);
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2), new THREE.MeshBasicMaterial({ color: 0x555555 }));
        string.position.y = -2.4;
        g.add(string);
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 1.2),
          new THREE.MeshBasicMaterial({ map: textTexture(opt, { font: 170 }), transparent: true }),
        );
        label.position.z = 1.15;
        g.add(label);
        const spread = n === 2 ? 3.2 : 2.6;
        const baseX = (k - (n - 1) / 2) * spread * -1;
        g.position.set(baseX, -4.5 - k * 1.2, 0);
        g.userData = { baseX, speed: 0.9 + Math.random() * 0.4, opt };
        stage.scene.add(g);
        return g;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [q, i]);

  const onPop = (b: THREE.Group) => {
    if (busy.current) return;
    const cur = qsRef.current[iRef.current];
    const opt = b.userData.opt as string;
    const ok = opt === cur.answer;
    report(cur.skill, ok, cur.word, opt);
    const stage = stageRef.current!;
    if (ok) {
      busy.current = true;
      b.userData.popped = true;
      burst(stage, b.position.clone(), COLORS[0]);
      stage.scene.remove(b);
      sfx('win');
      speak(pick(PRAISE));
      score.current += 1;
      setFill(cur.answer);
      setTimeout(() => {
        busy.current = false;
        setFill(null);
        if (iRef.current + 1 >= qsRef.current.length) finish(score.current, qsRef.current.length);
        else setI(iRef.current + 1);
      }, 1500);
    } else {
      // a wrong balloon is a mistake: show the right one and move on (no endless tries)
      busy.current = true;
      sfx('bad');
      speak(`${pick(ENCOURAGE)}. כותבים ${cur.say}`);
      b.userData.popped = true;
      const right = balloons.current.find((x) => x.userData.opt === cur.answer);
      const start = performance.now();
      stage.onFrame(() => {
        const p = (performance.now() - start) / 600;
        if (p < 1) {
          b.scale.setScalar(Math.max(0.01, 1 - p * 0.9));
          b.rotation.z += 0.3;
        } else if (b.parent) stage.scene.remove(b);
        if (right && right.parent) right.scale.setScalar(1.15 + Math.sin(performance.now() / 120) * 0.08);
      });
      setFill(cur.answer);
      setTimeout(() => {
        busy.current = false;
        setFill(null);
        if (iRef.current + 1 >= qsRef.current.length) finish(score.current, qsRef.current.length);
        else setI(iRef.current + 1);
      }, 2300);
    }
  };
  const qsRef = useRef(qs);
  const iRef = useRef(i);
  qsRef.current = qs;
  iRef.current = i;

  if (!q) return null;
  return (
    <GameShell game="balloons" title="🎈 בלונים" done={i} total={qs.length} instruction="פוצצו את הבלון עם הכתיב הנכון">
      <QuestionPrompt q={q} grade={grade} fill={fill} />
      <div ref={wrap} className="three-wrap" style={{ height: '52vh', minHeight: 300 }} />
    </GameShell>
  );
}

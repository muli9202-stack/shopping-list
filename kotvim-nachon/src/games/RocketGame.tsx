import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameProps } from './common';
import { GameShell, QuestionPrompt, fitFont, optionsFor, useRounds } from './common';
import { mixedQuestions } from '../engine/questions';
import { createStage, burst, type Stage3D } from './three-util';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { ENCOURAGE, PRAISE, pick } from '../ui/kit';

/** 3D rocket: every correct spelling fires the engines and the rocket climbs toward the moon. */
export function RocketGame({ skills, grade, rounds, level = 2, report, finish }: GameProps) {
  const total = rounds + (level - 2) * 2;
  const qs = useMemo(() => mixedQuestions(skills, grade, Math.ceil(total / skills.length), 'choose').slice(0, total), [skills, grade, total]);
  const { i, locked, answer } = useRounds(qs.length, finish);
  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage3D | null>(null);
  const rocket = useRef<THREE.Group | null>(null);
  const target = useRef(0);
  const shake = useRef(0);
  const q = qs[i];

  useEffect(() => {
    const stage = createStage(wrap.current!, { sky: ['#0b1d51', '#4263eb'], camZ: 12 });
    stageRef.current = stage;
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(Array.from({ length: 900 }, (_, k) => (k % 3 === 1 ? Math.random() * 80 - 5 : (Math.random() - 0.5) * 30))), 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 }),
    );
    stars.position.z = -8;
    stage.scene.add(stars);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 32, 24), new THREE.MeshStandardMaterial({ color: 0xf1f3f5, roughness: 0.9 }));
    moon.position.set(3, qs.length * 3 + 6, -6);
    stage.scene.add(moon);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 10), new THREE.MeshStandardMaterial({ color: 0x51cf66 }));
    ground.position.y = -5;
    stage.scene.add(ground);
    // the rocket
    const r = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 24), new THREE.MeshStandardMaterial({ color: 0xf8f9fa, metalness: 0.3, roughness: 0.3 }));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0xff5d8f }));
    nose.position.y = 1.9;
    const win = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0x74c0fc, emissive: 0x1c7ed6, emissiveIntensity: 0.4 }));
    win.position.set(0, 0.5, 0.65);
    r.add(body, nose, win);
    for (let k = 0; k < 3; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0x8338ec }));
      fin.position.set(Math.sin((k * Math.PI * 2) / 3) * 0.75, -1.1, Math.cos((k * Math.PI * 2) / 3) * 0.75);
      fin.rotation.y = (k * Math.PI * 2) / 3;
      r.add(fin);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 16), new THREE.MeshBasicMaterial({ color: 0xffa94d }));
    flame.rotation.x = Math.PI;
    flame.position.y = -2;
    r.add(flame);
    r.position.y = -3;
    stage.scene.add(r);
    rocket.current = r;
    stage.onFrame((dt, t) => {
      const goal = -3 + target.current * 3;
      r.position.y += (goal - r.position.y) * Math.min(1, dt * 2.5);
      const moving = Math.abs(goal - r.position.y) > 0.05;
      flame.scale.set(1, moving ? 1.4 + Math.sin(t * 40) * 0.3 : 0.5 + Math.sin(t * 20) * 0.1, 1);
      r.rotation.y += dt * 0.6;
      r.position.x = shake.current > 0 ? Math.sin(t * 60) * 0.2 : 0;
      shake.current = Math.max(0, shake.current - dt);
      stage.camera.position.y += (r.position.y + 1 - stage.camera.position.y) * Math.min(1, dt * 2);
    });
    return () => stage.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opts = useMemo(() => (q ? optionsFor(q, level) : []), [q, level]);
  if (!q) return null;

  const choose = (opt: string) => {
    if (locked) return;
    const ok = opt === q.answer;
    report(q.skill, ok, q.word, q.kind === 'missing' ? q.display.replace('_', opt) : opt);
    if (ok) {
      target.current += 1;
      sfx('win');
      speak(pick(PRAISE));
      if (stageRef.current && rocket.current) burst(stageRef.current, rocket.current.position.clone().add(new THREE.Vector3(0, -2, 0)), 0xffa94d);
    } else {
      shake.current = 0.6;
      sfx('bad');
      speak(`${pick(ENCOURAGE)}. כותבים ${q.say}`);
    }
    answer(ok);
  };

  return (
    <GameShell game="rocket" title="🚀 חללית המילים" done={i} total={qs.length}>
      <QuestionPrompt q={q} grade={grade} fill={locked ? q.answer : null} />
      <div ref={wrap} className="three-wrap" style={{ height: '38vh', minHeight: 240 }} />
      <div className="options" style={{ marginTop: 12 }}>
        {opts.map((o) => (
          <button key={o} className="opt" style={{ fontSize: q.kind === 'missing' ? 56 : fitFont(o, 40, 22) }} onClick={() => choose(o)}>
            {o}
          </button>
        ))}
      </div>
    </GameShell>
  );
}

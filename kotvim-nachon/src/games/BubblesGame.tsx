import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameProps } from './common';
import { GameShell, fontReady } from './common';
import { mixedQuestions, shuffle } from '../engine/questions';
import { burst, createStage, textTexture, type Stage3D } from './three-util';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { PRAISE, pick } from '../ui/kit';
import type { SkillId } from '../types';

interface Bubble {
  text: string;
  right: string;
  ok: boolean;
  skill: SkillId;
}

/** Visible area at z=0, minus a bubble radius, so bubbles never drift off screen. */
function bounds(stage: Stage3D) {
  const halfH = stage.camera.position.z * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2));
  return { halfW: Math.max(1, halfH * stage.camera.aspect - 1.25), halfH: Math.max(1, halfH - 1.25) };
}

/** 3D soap bubbles carry words – pop only the ones spelled correctly, leave the misspelled ones. */
export function BubblesGame({ skills, grade, rounds, level = 2, report, finish }: GameProps) {
  const waves = level === 1 ? 2 : level === 2 ? 3 : 4;
  const perWave = level === 1 ? 4 : level === 2 ? 5 : 6;
  const plan = useMemo(() => {
    const qs = mixedQuestions(skills, grade, Math.ceil((waves * perWave) / skills.length) + 1, 'choose', true).filter((q) => q.kind === 'choose');
    return Array.from({ length: waves }, (_, w) =>
      shuffle(
        qs.slice(w * perWave, w * perWave + perWave).map((q, k): Bubble => {
          // about half the bubbles are correct
          const ok = k % 2 === 0;
          const wrong = q.options.find((o) => o !== q.answer) ?? q.answer;
          return { text: ok ? q.answer : wrong, right: q.answer, ok: ok || wrong === q.answer, skill: q.skill };
        }),
      ),
    );
  }, [skills, grade, waves, perWave]);
  void rounds;
  const [wave, setWave] = useState(0);
  const [left, setLeft] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage3D | null>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const stats = useRef({ good: 0, total: 0, mistakes: 0 });
  const waveRef = useRef(0);
  waveRef.current = wave;

  useEffect(() => {
    const stage = createStage(wrap.current!, { sky: ['#99e9f2', '#fff0f6'], camZ: 11 });
    stageRef.current = stage;
    stage.onFrame((dt, t) => {
      meshes.current.forEach((m, k) => {
        const d = m.userData as { vx: number; vy: number };
        const { halfW, halfH } = bounds(stage);
        m.position.x += d.vx * dt;
        m.position.y += d.vy * dt + Math.sin(t * 2 + k) * 0.004;
        if (Math.abs(m.position.x) > halfW) d.vx = -Math.sign(m.position.x) * Math.abs(d.vx);
        if (Math.abs(m.position.y) > halfH) d.vy = -Math.sign(m.position.y) * Math.abs(d.vy);
        m.rotation.y = Math.sin(t + k) * 0.3;
      });
    });
    const el = stage.renderer.domElement;
    const onDown = (e: PointerEvent) => {
      const hit = stage.pick(e.clientX, e.clientY, meshes.current);
      if (hit) pop(hit as THREE.Mesh);
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
    if (!stage || !plan[wave]) return;
    let cancelled = false;
    fontReady().then(() => {
      if (cancelled) return;
      meshes.current.forEach((m) => stage.scene.remove(m));
      const speed = level === 1 ? 0.5 : level === 2 ? 0.9 : 1.3;
      meshes.current = plan[wave].map((b, k) => {
        const tex = textTexture(b.text, { font: 150, w: 512, h: 256 });
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(1.15, 32, 24),
          [new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.3, sheen: 1, sheenColor: new THREE.Color(0xd0bfff) })],
        );
        // rim and shine so the bubble reads as a bubble on any background
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: 0x74c0fc }));
        m.add(rim);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        shine.position.set(-0.45, 0.55, 1);
        m.add(shine);
        const label = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.05), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        label.position.z = 1.2;
        m.add(label);
        const { halfW, halfH } = bounds(stage);
        const cols = halfW > 3.5 ? 3 : 2;
        m.position.set(((k % cols) - (cols - 1) / 2) * ((halfW * 2) / cols), halfH - 1.5 - Math.floor(k / cols) * 2.5, 0);
        m.userData = { vx: (Math.random() - 0.5) * speed, vy: (Math.random() - 0.5) * speed, bubble: b };
        stage.scene.add(m);
        return m;
      });
      setLeft(plan[wave].filter((b) => b.ok).length);
    });
    return () => {
      cancelled = true;
    };
  }, [plan, wave, level]);

  const pop = (m: THREE.Mesh) => {
    const stage = stageRef.current!;
    const b = m.userData.bubble as Bubble;
    report(b.skill, b.ok, b.right, b.text);
    stats.current.total += 1;
    if (b.ok) {
      stats.current.good += 1;
      burst(stage, m.position.clone(), 0x74c0fc);
      stage.scene.remove(m);
      meshes.current = meshes.current.filter((x) => x !== m);
      sfx('pop');
      setLeft((n) => {
        const nl = n - 1;
        if (nl <= 0) {
          sfx('win');
          speak(pick(PRAISE));
          setTimeout(() => {
            if (waveRef.current + 1 >= plan.length) finish(stats.current.good, stats.current.total);
            else setWave(waveRef.current + 1);
          }, 900);
        }
        return nl;
      });
    } else {
      stats.current.mistakes += 1;
      sfx('bad');
      speak(`אופס! בבועה הזו יש טעות. כותבים ${b.right}`);
      const mat = (m.material as THREE.MeshPhysicalMaterial[])[0];
      mat.color.set(0xff8787);
      setTimeout(() => mat.color.set(0xffffff), 900);
    }
  };

  return (
    <GameShell game="bubbles" title="🫧 בועות קסם" done={wave} total={plan.length}>
      <div className="card center" style={{ marginBottom: 10 }}>
        <b>פוצצו רק בועות עם מילה שכתובה נכון!</b>
        <span className="muted small">נשארו עוד {left} בועות נכונות</span>
      </div>
      <div ref={wrap} className="three-wrap" style={{ height: '56vh', minHeight: 320 }} />
    </GameShell>
  );
}

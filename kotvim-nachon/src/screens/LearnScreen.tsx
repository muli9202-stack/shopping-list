import { useEffect, useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { Stars, TopBar, useSpeakOnMount } from '../ui/kit';
import { MascotSays } from '../ui/Mascot';
import { SKILL_BY_ID } from '../data/skills';
import { STAGES_PER_WORLD, ensureWorld, gamesForSkill, isWeak, stageAt, weakestSkills } from '../engine/progress';
import { GAME_INFO } from '../games/GameHost';
import type { SkillId, World } from '../types';
import { sfx } from '../ui/effects';

export function worldInfo(w: World) {
  if (w.skill === 'review') return { title: 'עולם החזרה', icon: '🌀', color: '#495057' };
  const s = SKILL_BY_ID[w.skill];
  return { title: s.title, icon: s.icon, color: s.color };
}

const STAGE_ICON = { trick: '💡', game: '🎮', boss: '👑' };

export function LearnScreen() {
  const child = useActiveChild();
  const go = useNav((s) => s.go);
  const [practiceSkill, setPracticeSkill] = useState<SkillId | null>(null);

  useEffect(() => {
    if (child?.diagnosed) updateActive((c) => ensureWorld(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.diagnosed]);

  useSpeakOnMount(child?.diagnosed ? 'זו מפת הלמידה שלך. לחץ על השלב שקופץ כדי להמשיך.' : 'לפני שמתחילים, נעשה משחק קצר כדי לראות מה אתה כבר יודע.');
  if (!child) return null;

  if (!child.diagnosed) {
    return (
      <div className="screen sky-bg">
        <TopBar title="🎮 למידה" />
        <div className="center" style={{ gap: 18, marginTop: 30 }}>
          <MascotSays text="לפני שיוצאים לדרך – משחק קצר כדי שאדע במה לעזור לך!" size={120} />
          <button className="btn big green" onClick={() => go({ name: 'diagnostic' })}>
            🚀 יוצאים לדרך!
          </button>
        </div>
      </div>
    );
  }

  const worlds = child.worlds.slice(-6);
  const offset = child.worlds.length - worlds.length;
  const weak = weakestSkills(child).slice(0, 4);

  return (
    <div className="screen" style={{ background: 'linear-gradient(#e7f5ff, #fff9db)' }}>
      <TopBar title="🗺️ מפת הלמידה" />

      <div className="map">
        {worlds.map((w, wi) => {
          const info = worldInfo(w);
          const worldIndex = offset + wi;
          const isCurrent = worldIndex === child.worlds.length - 1;
          return (
            <div key={worldIndex}>
              <div className="world-banner" style={{ background: info.color }}>
                <span style={{ fontSize: 32 }}>{info.icon}</span>
                <span className="grow">
                  עולם {worldIndex + 1}: {info.title}
                </span>
                {w.done >= STAGES_PER_WORLD && <span>🏆</span>}
              </div>
              {Array.from({ length: STAGES_PER_WORLD }, (_, k) => {
                const st = stageAt(w, worldIndex, k);
                const done = k < w.done;
                const current = isCurrent && k === w.done;
                const locked = !done && !current;
                const icon = st.kind === 'game' ? GAME_INFO[st.game].emoji : STAGE_ICON[st.kind];
                const x = Math.sin((k + worldIndex) * 1.3) * 90;
                return (
                  <div key={k} style={{ transform: `translateX(${x}px)`, marginBottom: 40 }}>
                    <button
                      className={`map-node ${locked ? 'locked' : ''} ${current ? 'current' : ''}`}
                      style={{ background: done ? '#ffe066' : info.color }}
                      onClick={() => {
                        if (current) {
                          sfx('pop');
                          go({ name: 'stage' });
                        } else if (done && st.kind === 'trick' && w.skill !== 'review') go({ name: 'trick', skill: w.skill });
                      }}
                    >
                      {locked ? '🔒' : icon}
                      {done && (
                        <span className="stars">
                          <Stars n={w.stars[k] ?? 0} />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: -20 }}>
        <h3 style={{ marginTop: 0 }}>🎲 ארגז המשחקונים</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          בחרו נושא ומשחק – מתאמנים כמה שרוצים!
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {weak.map((s) => (
            <button key={s} className={`chip ${practiceSkill === s ? 'on' : ''}`} onClick={() => setPracticeSkill(s)}>
              {SKILL_BY_ID[s].icon} {SKILL_BY_ID[s].title} {isWeak(child, s) ? '💪' : ''}
            </button>
          ))}
        </div>
        {practiceSkill && (
          <div className="grid2" style={{ marginTop: 12 }}>
            {gamesForSkill(practiceSkill).map((g) => (
              <button
                key={g}
                className="btn"
                style={{ background: GAME_INFO[g].color, color: '#fff', borderRadius: 20, fontSize: 18 }}
                onClick={() => go({ name: 'practice', skill: practiceSkill, game: g })}
              >
                {GAME_INFO[g].emoji} {GAME_INFO[g].title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

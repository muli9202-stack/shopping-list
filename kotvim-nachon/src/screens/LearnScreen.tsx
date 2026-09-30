import { useEffect } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { Stars, TopBar } from '../ui/kit';
import { useGuide } from '../ui/guide';
import { MascotSays } from '../ui/Mascot';
import { SKILL_BY_ID } from '../data/skills';
import { STAGES_PER_WORLD, ensureWorld, stageAt } from '../engine/progress';
import { GAME_INFO } from '../games/GameHost';
import { catalogSize } from './GamesScreen';
import { dueWords } from '../engine/review';
import type { World } from '../types';
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

  useEffect(() => {
    if (child?.diagnosed) updateActive((c) => ensureWorld(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.diagnosed]);

  useGuide(child?.diagnosed ? 'learn' : 'diagnostic');
  if (!child) return null;

  if (!child.diagnosed) {
    return (
      <div className="screen sky-bg">
        <TopBar title="🎮 למידה" guide="diagnostic" />
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

  return (
    <div className="screen" style={{ background: 'linear-gradient(#e7f5ff, #fff9db)' }}>
      <TopBar title="🗺️ מפת הלמידה" guide="learn" />
      {dueWords(child).length > 0 && (
        <button className="big-square" style={{ background: 'linear-gradient(135deg,#0ca678,#20c997)', minHeight: 96, marginBottom: 12 }} onClick={() => go({ name: 'review' })}>
          <span className="emoji" style={{ fontSize: 50 }}>🔁</span>
          <span className="grow">
            חזרה חכמה
            <span className="sub">{dueWords(child).length} מילים שלך מחכות לחזרה היום</span>
          </span>
        </button>
      )}
      <button className="big-square" style={{ background: 'linear-gradient(135deg,#8338ec,#ff5d8f)', minHeight: 110, marginBottom: 6 }} onClick={() => go({ name: 'games' })}>
        <span className="emoji" style={{ fontSize: 56 }}>🎲</span>
        <span className="grow">
          עולם המשחקים
          <span className="sub">{catalogSize(child.grade)} משחקים לבחירה!</span>
        </span>
      </button>

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

    </div>
  );
}

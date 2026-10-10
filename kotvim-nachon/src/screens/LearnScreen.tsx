import { useEffect } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { Stars, TopBar } from '../ui/kit';
import { useGuide } from '../ui/guide';
import { MascotSays } from '../ui/Mascot';
import { SKILL_BY_ID } from '../data/skills';
import { ensureWorld } from '../engine/progress';
import { PATH_LENGTH, pathLevel, pathStep, rankOf, tierOf } from '../engine/path';
import { catalogSize } from './GamesScreen';
import { dueWords } from '../engine/review';
import type { World } from '../types';
import { sfx } from '../ui/effects';

export function worldInfo(w: World) {
  if (w.skill === 'review') return { title: 'עולם החזרה', icon: '🌀', color: '#495057' };
  const s = SKILL_BY_ID[w.skill];
  return { title: s.title, icon: s.icon, color: s.color };
}

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

  const cur = pathLevel(child);
  const from = Math.max(1, cur - 3);
  const to = Math.min(PATH_LENGTH, from + 14);

  return (
    <div className="screen" style={{ background: 'linear-gradient(#e7f5ff, #fff9db)' }}>
      <TopBar title={`🗺️ שלב ${cur} מתוך ${PATH_LENGTH}`} guide="learn" />
      <button className="big-square" style={{ background: 'linear-gradient(135deg,#3a86ff,#8338ec)', minHeight: 96, marginBottom: 12 }} onClick={() => go({ name: 'teacher' })}>
        <span className="emoji" style={{ fontSize: 50 }}>👩‍🏫</span>
        <span className="grow">
          ממשיכים עם המורה
          <span className="sub">שלב {cur} · {rankOf(cur)}</span>
        </span>
      </button>
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
        {Array.from({ length: to - from + 1 }, (_, k) => {
          const n = from + k;
          const st = pathStep(child, n);
          const sk = SKILL_BY_ID[st.topic];
          const done = n < cur;
          const current = n === cur;
          const x = Math.sin(n * 1.3) * 90;
          return (
            <div key={n}>
              {(n - 1) % 100 === 0 && <div className="world-banner" style={{ background: sk.color }}>🎖️ דרגה {tierOf(n) + 1}: {rankOf(n)}</div>}
              <div style={{ transform: `translateX(${x}px)`, marginBottom: 34 }}>
                <button
                  className={`map-node ${!done && !current ? 'locked' : ''} ${current ? 'current' : ''}`}
                  style={{ background: done ? '#ffe066' : st.kind === 'boss' ? '#fab005' : sk.color, flexDirection: 'column', fontSize: 22 }}
                  onClick={() => {
                    if (current) {
                      sfx('pop');
                      go({ name: 'teacher' });
                    }
                  }}
                >
                  <span>{st.kind === 'boss' ? '👑' : st.kind === 'review' ? '🔁' : st.kind === 'dictation' && (done || current) ? '📝' : !done && !current ? '🔒' : sk.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{n}</span>
                  {done && (
                    <span className="stars">
                      <Stars n={child.path?.stars[String(n)] ?? 0} />
                    </span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

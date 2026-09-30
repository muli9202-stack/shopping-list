import { useState } from 'react';
import { useActiveChild } from '../store';
import { useNav } from '../nav';
import { Stars, TopBar } from '../ui/kit';
import { useGuide } from '../ui/guide';
import { SKILL_BY_ID } from '../data/skills';
import { eligibleSkills, gamesForSkill, isWeak, weakestSkills } from '../engine/progress';
import { GAME_INFO } from '../games/GameHost';
import type { Child, GameId, SkillId } from '../types';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';

export const LEVEL_NAMES = ['', 'קל', 'בינוני', 'אלופים'];

export function gameKey(game: GameId, skill: SkillId, level: number) {
  return `${game}:${skill}:${level}`;
}

/** Every combination of topic × game × level is its own game with its own stars. */
export function catalogSize(grade: number): number {
  return eligibleSkills(grade).reduce((a, s) => a + gamesForSkill(s).length * 3, 0);
}

function starsOf(c: Child, game: GameId, skill: SkillId, level: number) {
  return c.gameStars?.[gameKey(game, skill, level)] ?? 0;
}

/** Level 1 is always open; the next level opens after two stars on the previous one. */
export function levelOpen(c: Child, game: GameId, skill: SkillId, level: number) {
  return level === 1 || starsOf(c, game, skill, level - 1) >= 2;
}

/** The topic the child picked last – kept while they go in and out of games. */
let lastSkill: { child: string; skill: SkillId } | null = null;

export function GamesScreen() {
  const child = useActiveChild();
  const go = useNav((s) => s.go);
  const [skill, setSkillState] = useState<SkillId | null>(() => {
    if (!child) return null;
    if (lastSkill?.child !== child.id) lastSkill = { child: child.id, skill: weakestSkills(child)[0] };
    return lastSkill.skill;
  });
  const setSkill = (s: SkillId) => {
    setSkillState(s);
    if (child) lastSkill = { child: child.id, skill: s };
  };
  useGuide('games');
  if (!child || !skill) return null;
  const total = catalogSize(child.grade);
  const earned = Object.values(child.gameStars ?? {}).reduce((a, b) => a + b, 0);
  const played = Object.keys(child.gameStars ?? {}).length;

  return (
    <div className="screen" style={{ background: 'linear-gradient(#f3f0ff, #fff7e6)' }}>
      <TopBar title="🎲 עולם המשחקים" guide="games" />
      <div className="card row" style={{ justifyContent: 'space-around', marginBottom: 12 }}>
        <div className="center">
          <b style={{ fontSize: 26 }}>{total}</b>
          <span className="small muted">משחקים</span>
        </div>
        <div className="center">
          <b style={{ fontSize: 26 }}>{played}</b>
          <span className="small muted">שיחקת</span>
        </div>
        <div className="center">
          <b style={{ fontSize: 26 }}>⭐ {earned}</b>
          <span className="small muted">כוכבים</span>
        </div>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {eligibleSkills(child.grade).map((s) => (
          <button
            key={s}
            className={`chip ${skill === s ? 'on' : ''}`}
            onClick={() => {
              setSkill(s);
              speak(SKILL_BY_ID[s].title);
            }}
          >
            {SKILL_BY_ID[s].icon} {SKILL_BY_ID[s].title} {isWeak(child, s) ? '💪' : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {gamesForSkill(skill).map((g) => {
          const info = GAME_INFO[g];
          return (
            <div key={g} className="card" style={{ borderRight: `8px solid ${info.color}` }}>
              <div className="row">
                <span style={{ fontSize: 40 }}>{info.emoji}</span>
                <b className="grow" style={{ fontSize: 20 }}>
                  {info.title}
                  <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                    {SKILL_BY_ID[skill].title}
                  </span>
                </b>
              </div>
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                {[1, 2, 3].map((lv) => {
                  const open = levelOpen(child, g, skill, lv);
                  return (
                    <button
                      key={lv}
                      className="btn grow"
                      disabled={!open}
                      style={{ background: open ? info.color : '#dee2e6', color: open ? '#fff' : '#868e96', padding: '10px 6px', fontSize: 16, flexDirection: 'column', gap: 2 }}
                      onClick={() => {
                        sfx('pop');
                        go({ name: 'practice', skill, game: g, level: lv as 1 | 2 | 3 });
                      }}
                    >
                      <span>{open ? LEVEL_NAMES[lv] : `🔒 ${LEVEL_NAMES[lv]}`}</span>
                      <span style={{ fontSize: 14 }}>
                        <Stars n={starsOf(child, g, skill, lv)} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

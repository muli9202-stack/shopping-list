import { useActiveChild, updateActive } from '../store';
import { useNav } from '../nav';
import { TopBar } from '../ui/kit';
import { useGuide } from '../ui/guide';
import { TRICKS } from '../tricks/tricks';
import { TrickPlayer } from '../tricks/TrickPlayer';
import { SKILLS, SKILL_BY_ID } from '../data/skills';
import { isWeak } from '../engine/progress';
import type { SkillId } from '../types';

export function TricksScreen() {
  const child = useActiveChild();
  const go = useNav((s) => s.go);
  useGuide('tricks');
  if (!child) return null;
  return (
    <div className="screen" style={{ background: 'linear-gradient(#fff3bf, #fff7e6)' }}>
      <TopBar title="💡 ספריית הטריקים" guide="tricks" />
      <div className="grid2">
        {SKILLS.filter((s) => s.minGrade <= child.grade).map((s) => (
          <button
            key={s.id}
            className="card center"
            style={{ border: `4px solid ${isWeak(child, s.id) ? s.color : 'transparent'}`, cursor: 'pointer', gap: 4 }}
            onClick={() => go({ name: 'trick', skill: s.id })}
          >
            <span style={{ fontSize: 44 }}>{TRICKS[s.id].emoji}</span>
            <b>{TRICKS[s.id].title}</b>
            <span className="small muted">{s.title}</span>
            {child.seenTricks.includes(s.id) && <span className="small">✅ נצפה</span>}
            {isWeak(child, s.id) && <span className="small" style={{ color: s.color }}>💪 מומלץ לך</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrickScreen({ skill }: { skill: SkillId }) {
  const back = useNav((s) => s.back);
  return (
    <div className="screen" style={{ background: `linear-gradient(${SKILL_BY_ID[skill].color}33, #fff7e6)` }}>
      <TopBar title={`💡 ${TRICKS[skill].title}`} guide="trick" />
      <TrickPlayer
        skill={skill}
        onDone={() => {
          updateActive((c) => (c.seenTricks.includes(skill) ? c : { ...c, seenTricks: [...c.seenTricks, skill], updatedAt: Date.now() }));
          back();
        }}
      />
    </div>
  );
}

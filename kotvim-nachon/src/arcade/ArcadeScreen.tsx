import { useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { TopBar } from '../ui/kit';
import { useGuide } from '../ui/guide';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { changeCoins, coinsOf } from '../engine/merge';
import { SHIFT_COST, THEMES, unlockCost } from './themes';

/** The arcade: 30 businesses to run with gold coins earned by learning. */
export function ArcadeScreen() {
  const child = useActiveChild();
  const go = useNav((s) => s.go);
  const [msg, setMsg] = useState('');
  useGuide('arcade');
  if (!child) return null;
  const coins = coinsOf(child);
  const opened = (id: string, i: number) => unlockCost(i) === 0 || !!child.arcade?.[id];

  const open = (id: string, i: number) => {
    setMsg('');
    if (!opened(id, i)) {
      const cost = unlockCost(i);
      if (coins < cost) {
        sfx('bad');
        setMsg(`צריך ${cost} 🪙 כדי לפתוח. אוספים מטבעות בלמידה עם המורה!`);
        speak('צריך עוד מטבעות. אוספים מטבעות כשלומדים!');
        return;
      }
      updateActive((c) => ({ ...changeCoins(c, -cost), arcade: { ...(c.arcade ?? {}), [id]: { level: 0, cash: 0, served: 0, bought: [] } } }));
      sfx('win');
    }
    if (coinsOf(child) < SHIFT_COST && opened(id, i)) {
      sfx('bad');
      setMsg(`משמרת עולה ${SHIFT_COST} 🪙. אוספים מטבעות בלמידה – כל תשובה נכונה שווה מטבע!`);
      speak('צריך עוד מטבעות. אוספים מטבעות כשלומדים!');
      return;
    }
    go({ name: 'arcadePlay', id });
  };

  return (
    <div className="screen" style={{ background: 'linear-gradient(#d0ebff, #fff7e6)' }}>
      <TopBar title="🎢 עולם העסקים" guide="arcade" right={<span className="points-pill">🪙 {coins}</span>} />
      <p className="small muted center" style={{ marginTop: 0 }}>
        מנהלים עסק אמיתי! כל משמרת עולה {SHIFT_COST} 🪙, ואת המטבעות מרוויחים בלמידה.
      </p>
      {msg && <div className="card center" style={{ background: '#fff3bf', marginBottom: 10 }}>{msg}</div>}
      <div className="grid2">
        {THEMES.map((t, i) => {
          const isOpen = opened(t.id, i);
          const save = child.arcade?.[t.id];
          return (
            <button
              key={t.id}
              className="card center"
              style={{ border: 'none', cursor: 'pointer', gap: 4, background: `linear-gradient(160deg, ${t.floor}, ${t.wall}55)`, opacity: isOpen ? 1 : 0.8 }}
              onClick={() => open(t.id, i)}
            >
              <span style={{ fontSize: 46 }}>{t.emoji}</span>
              <b style={{ fontSize: 17 }}>{t.name}</b>
              <span className="small">{isOpen ? (save ? `רמה ${save.level + 1} · ${save.served} לקוחות` : 'פתוח – בואו נתחיל!') : `🔒 ${unlockCost(i)} 🪙`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

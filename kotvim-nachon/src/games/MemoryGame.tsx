import { useMemo, useState } from 'react';
import type { GameProps } from './common';
import { GameShell } from './common';
import { shuffle, wordsFor } from '../engine/questions';
import { sfx } from '../ui/effects';
import { speak } from '../services/tts';

interface Card {
  id: number;
  pair: number;
  face: string;
  isWord: boolean;
}

/** Memory: match each picture with its correctly written word (3D flipping cards). */
export function MemoryGame({ skills, grade, report, finish }: GameProps) {
  const { cards, words } = useMemo(() => {
    const pool = shuffle(skills.flatMap((s) => wordsFor(s, grade, 12).filter((w) => w.e).map((w) => ({ ...w, skill: s }))));
    const uniq = pool.filter((w, k) => pool.findIndex((x) => x.w === w.w || x.e === w.e) === k).slice(0, 6);
    const list: Card[] = [];
    uniq.forEach((w, k) => {
      list.push({ id: k * 2, pair: k, face: w.e!, isWord: false });
      list.push({ id: k * 2 + 1, pair: k, face: w.w, isWord: true });
    });
    return { cards: shuffle(list), words: uniq };
  }, [skills, grade]);
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [tries, setTries] = useState(0);

  const flip = (c: Card) => {
    if (open.length === 2 || open.includes(c.id) || done.includes(c.pair)) return;
    sfx('pop');
    if (c.isWord) speak(words[c.pair].n ?? c.face, { force: true });
    const next = [...open, c.id];
    setOpen(next);
    if (next.length === 2) {
      setTries((t) => t + 1);
      const [a, b] = next.map((id) => cards.find((x) => x.id === id)!);
      if (a.pair === b.pair) {
        setTimeout(() => {
          sfx('good');
          const nd = [...done, a.pair];
          setDone(nd);
          setOpen([]);
          report(words[a.pair].skill, true, words[a.pair].w, words[a.pair].w);
          if (nd.length === words.length) {
            speak('כל הכבוד! מצאתם את כל הזוגות');
            setTimeout(() => finish(Math.max(words.length - Math.max(0, tries + 1 - words.length) / 2, 1), words.length), 900);
          }
        }, 500);
      } else setTimeout(() => setOpen([]), 1000);
    }
  };

  if (words.length < 3) return <div className="card">אין מספיק מילים עם תמונה – ממשיכים!</div>;

  return (
    <GameShell title="🧠 זיכרון" done={done.length} total={words.length} instruction="מצאו לכל תמונה את המילה שלה">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {cards.map((c) => {
          const shown = open.includes(c.id) || done.includes(c.pair);
          return (
            <div key={c.id} className="flip" style={{ height: 104 }} onClick={() => flip(c)}>
              <div className={`flip-inner ${shown ? 'flipped' : ''}`} style={{ height: '100%' }}>
                <div className="flip-face" style={{ background: 'linear-gradient(135deg,#8338ec,#3a86ff)', fontSize: 40, boxShadow: 'var(--shadow)' }}>
                  ❓
                </div>
                <div
                  className="flip-face flip-back"
                  style={{
                    background: done.includes(c.pair) ? '#d3f9d8' : '#fff',
                    boxShadow: 'var(--shadow)',
                    fontSize: c.isWord ? 34 : 50,
                    fontFamily: c.isWord ? 'var(--script)' : undefined,
                  }}
                >
                  {c.face}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GameShell>
  );
}

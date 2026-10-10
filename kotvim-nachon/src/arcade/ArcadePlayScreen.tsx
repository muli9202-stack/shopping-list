import { useEffect, useMemo, useRef, useState } from 'react';
import { updateActive, useActiveChild } from '../store';
import { useNav } from '../nav';
import { TopBar, PRAISE, pick } from '../ui/kit';
import { confetti, sfx } from '../ui/effects';
import { speak } from '../services/tts';
import { changeCoins } from '../engine/merge';
import { buildQuestions } from '../engine/questions';
import { sentencesFor } from '../data/words';
import { weakestSkills } from '../engine/progress';
import { reviewAnswer } from '../engine/review';
import { recordAnswer } from '../engine/progress';
import { TycoonEngine, type ArcadeSave, type Hud } from './engine';
import { SHIFT_COST, SHIFT_SECONDS, THEME_BY_ID } from './themes';
import type { Question } from '../types';

/** One shift in a business: the 3D game, money, progress, timer, and spelling "special orders". */
export function ArcadePlayScreen({ id }: { id: string }) {
  const child = useActiveChild();
  const back = useNav((s) => s.back);
  const theme = THEME_BY_ID[id];
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<TycoonEngine | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [toast, setToast] = useState('');
  const [left, setLeft] = useState(SHIFT_SECONDS);
  const [special, setSpecial] = useState<null | { q: Question; answer: (ok: boolean) => void }>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const startServed = useRef(0);
  const grade = child?.grade ?? 3;
  const skills = useMemo(() => (child ? weakestSkills(child).filter((s) => !sentencesFor(s)).slice(0, 3) : []), [child?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = () => {
    const e = engine.current;
    if (!e) return;
    const s = e.getSave();
    updateActive((c) => ({ ...c, arcade: { ...(c.arcade ?? {}), [id]: s }, updatedAt: Date.now() }));
  };

  useEffect(() => {
    if (!host.current || !child) return;
    // the shift costs coins once, when it starts
    updateActive((c) => changeCoins(c, -SHIFT_COST));
    const save: ArcadeSave = child.arcade?.[id] ?? { level: 0, cash: 0, served: 0, bought: [] };
    startServed.current = save.served;
    let toastTimer = 0;
    const e = new TycoonEngine(host.current, theme, save, {
      hud: setHud,
      toast: (t) => {
        setToast(t);
        clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => setToast(''), 1200);
      },
      levelUp: (lv) => {
        confetti(220);
        sfx('win');
        speak('וואו! העסק שלך גדל!');
        setToast(`🎉 העסק עלה לרמה ${lv + 1}!`);
      },
      special: (answer) => {
        const sk = skills[Math.floor(Math.random() * Math.max(1, skills.length))] ?? 'alef_ayin';
        const q = buildQuestions(sk, grade, 1, 'choose')[0];
        if (!q) return answer(false);
        setPicked(null);
        setSpecial({ q, answer });
        speak(q.say, { force: true });
      },
    });
    engine.current = e;
    // automated tests drive the game through this handle
    (window as unknown as { __tycoon?: TycoonEngine }).__tycoon = e;
    e.start();
    const tick = window.setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(tick);
          e.pause(true);
          setOver(true);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    const autosave = window.setInterval(persist, 15000);
    return () => {
      clearInterval(tick);
      clearInterval(autosave);
      persist();
      e.dispose();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (over) {
      persist();
      sfx('win');
      speak('המשמרת נגמרה! כל הכבוד!');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  if (!child || !theme) return null;

  const choose = (opt: string) => {
    if (!special || picked) return;
    setPicked(opt);
    const ok = opt === special.q.answer;
    updateActive((c) => reviewAnswer(recordAnswer(c, special.q.skill, ok, ok ? undefined : { expected: special.q.word, typed: opt, source: 'game' }), special.q.skill, special.q.word, ok));
    sfx(ok ? 'good' : 'bad');
    speak(ok ? pick(PRAISE) : `כותבים ${special.q.say}`);
    setTimeout(() => {
      const a = special.answer;
      setSpecial(null);
      a(ok);
    }, ok ? 900 : 2200);
  };

  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <div className="screen" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div style={{ padding: '8px 12px 0' }}>
        <TopBar title={`${theme.emoji} ${theme.name}`} right={<span className="points-pill">⏱️ {mm}</span>} />
        <div className="row" style={{ gap: 8, fontWeight: 700 }}>
          <span className="points-pill" style={{ background: '#d3f9d8' }}>💵 {hud?.cash ?? 0}</span>
          <div className="grow" style={{ height: 14, background: '#e9ecef', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ width: `${(hud?.progress ?? 0) * 100}%`, height: '100%', background: theme.accent, transition: 'width .4s' }} />
          </div>
          <span className="small">רמה {(hud?.level ?? 0) + 1}</span>
          <span className="small">🎒 {hud?.carrying ?? 0}/{hud?.capacity ?? 3}</span>
        </div>
      </div>
      <div ref={host} style={{ position: 'relative', flex: 1, minHeight: 300, overflow: 'hidden' }}>
        {toast && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.65)', color: '#fff', padding: '6px 14px', borderRadius: 20, fontWeight: 700, zIndex: 5, pointerEvents: 'none' }}>
            {toast}
          </div>
        )}
        <div className="small" style={{ position: 'absolute', bottom: 8, width: '100%', textAlign: 'center', color: '#495057', pointerEvents: 'none' }}>
          👆 גוררים את האצבע כדי ללכת · עומדים על עיגול כדי לקחת, לתת ולקנות
        </div>
      </div>

      {special && (
        <div className="overlay">
          <div className="modal center" style={{ gap: 10 }}>
            <b>✨ הזמנה מיוחדת! תשובה נכונה = טיפ ענק</b>
            {special.q.emoji && <div style={{ fontSize: 48 }}>{special.q.emoji}</div>}
            <div className="small muted">איך כותבים נכון?</div>
            <div className="options">
              {special.q.options.map((o) => (
                <button key={o} className={`opt ${picked === o ? (o === special.q.answer ? 'good' : 'bad') : picked && o === special.q.answer ? 'good' : ''}`} style={{ fontSize: 34 }} onClick={() => choose(o)}>
                  {o}
                </button>
              ))}
            </div>
            <button className="btn white" onClick={() => speak(special.q.say, { force: true })}>
              🔊 שוב
            </button>
          </div>
        </div>
      )}

      {over && (
        <div className="overlay">
          <div className="modal center" style={{ gap: 10 }}>
            <div style={{ fontSize: 60 }}>{theme.emoji}</div>
            <h2 style={{ margin: 0 }}>המשמרת נגמרה!</h2>
            <p style={{ margin: 0 }}>
              שירתת <b>{(hud?.served ?? 0) - startServed.current}</b> לקוחות · בקופה <b>{hud?.cash ?? 0} 💵</b>
            </p>
            <p className="small muted" style={{ margin: 0 }}>הכסף והשדרוגים נשמרים לפעם הבאה.</p>
            <button className="btn green big" onClick={back}>
              סיימתי
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

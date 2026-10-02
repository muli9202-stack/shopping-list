import { useEffect, useRef, useState } from 'react';
import { IS_ARTIFACT, claudeUse } from './env';
import { cloudAvailable } from './storage';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { allMeals, countMeals, exportData, useStore } from './store';
import { Counter, MealCard } from './planner';
import { Header, ask } from './ui';
import type { KitchenData } from './types';

export function HomeScreen() {
  return (
    <div className="page home">
      <div className="home-title">
        <h1>המטבח שלי</h1>
        <Link to="/settings" className="icon-btn" aria-label="הגדרות">
          ⚙
        </Link>
      </div>
      <div className="home-grid">
        <Link to="/videos" className="home-tile t-videos">
          <span className="emoji">🎬</span>
          <span>הסרטונים שלי</span>
        </Link>
        <Link to="/recipes" className="home-tile t-recipes">
          <span className="emoji">📖</span>
          <span>מתכונים</span>
        </Link>
        <Link to="/table" className="home-tile t-table">
          <span className="emoji">🕯️</span>
          <span>שולחן שבת וחג</span>
        </Link>
      </div>
    </div>
  );
}

export function TableChooseScreen() {
  const shabbat = useStore((s) => s.shabbat);
  const chag = useStore((s) => s.chag);
  const sc = countMeals([shabbat.night, ...shabbat.morning]);
  const cc = countMeals(chag.days.flatMap((d) => d.meals));
  return (
    <div className="page">
      <Header title="שולחן שבת וחג" back="/" tone="#6366f1" />
      <div className="tile-grid two">
        <Link to="/table/shabbat" className="big-tile t-shabbat">
          <span className="emoji">🕯️</span>
          <span>שבת</span>
          <Counter left={sc.left} total={sc.total} />
        </Link>
        <Link to="/table/chag" className="big-tile t-chag">
          <span className="emoji">🍷</span>
          <span>חג</span>
          <Counter left={cc.left} total={cc.total} />
        </Link>
      </div>
    </div>
  );
}

function PlanToolbar({ onReset, onClear }: { onReset: () => void; onClear: () => void }) {
  return (
    <div className="row gap wrap toolbar">
      <button className="btn small ghost" onClick={() => void ask('לבטל את כל הסימונים?').then((ok) => ok && onReset())}>
        ↺ ביטול כל הסימונים
      </button>
      <button className="btn small ghost danger-text" onClick={() => void ask('למחוק את כל התכנון ולהתחיל מחדש?').then((ok) => ok && onClear())}>
        🗑 ניקוי הכול
      </button>
    </div>
  );
}

export function ShabbatScreen() {
  const s = useStore((x) => x.shabbat);
  const setField = useStore((x) => x.setShabbatField);
  const reset = useStore((x) => x.resetShabbatMarks);
  const clear = useStore((x) => x.clearShabbat);
  const all = countMeals([s.night, ...s.morning]);
  return (
    <div className="page">
      <Header title="שולחן שבת" back="/table" tone="#4338ca" />
      <div className="summary">
        <span>סה״כ לשבת:</span>
        <Counter left={all.left} total={all.total} big />
      </div>
      <PlanToolbar onReset={reset} onClear={clear} />

      <div className="part part-night">
        <h2 className="part-title">🌙 לילה</h2>
        <div className="guests">
          <label>
            סועדים גדולים
            <input className="input" inputMode="numeric" value={s.adults} onChange={(e) => setField('adults', e.target.value.replace(/\D/g, ''))} />
          </label>
          <label>
            סועדים קטנים
            <input className="input" inputMode="numeric" value={s.kids} onChange={(e) => setField('kids', e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
        <MealCard meal={s.night} />
      </div>

      <div className="part part-morning">
        <h2 className="part-title">☀️ בוקר</h2>
        {s.morning.map((m) => (
          <MealCard key={m.id} meal={m} />
        ))}
      </div>
    </div>
  );
}

const DAY_TONES = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#65a30d'];

export function ChagScreen() {
  const chag = useStore((x) => x.chag);
  const setName = useStore((x) => x.setChagName);
  const addDay = useStore((x) => x.addDay);
  const renameDay = useStore((x) => x.renameDay);
  const deleteDay = useStore((x) => x.deleteDay);
  const addMeal = useStore((x) => x.addMeal);
  const deleteMeal = useStore((x) => x.deleteMeal);
  const reset = useStore((x) => x.resetChagMarks);
  const clear = useStore((x) => x.clearChag);
  const all = countMeals(chag.days.flatMap((d) => d.meals));
  return (
    <div className="page">
      <Header title="שולחן חג" back="/table" tone="#b45309" />
      <label className="chag-name">
        שם החג
        <input className="input" value={chag.name} onChange={(e) => setName(e.target.value)} placeholder="למשל ראש השנה" />
      </label>
      <div className="summary">
        <span>סה״כ ל{chag.name || 'חג'}:</span>
        <Counter left={all.left} total={all.total} big />
      </div>
      <PlanToolbar onReset={reset} onClear={clear} />

      {chag.days.map((day, i) => {
        const c = countMeals(day.meals);
        return (
          <div key={day.id} className="part part-day" style={{ '--tone': DAY_TONES[i % DAY_TONES.length] } as React.CSSProperties}>
            <div className="part-title row gap">
              <input className="title-input big" value={day.name} onChange={(e) => renameDay(day.id, e.target.value)} aria-label="שם היום" />
              <Counter left={c.left} total={c.total} />
              <button className="icon-btn" aria-label="מחיקת יום" onClick={() => void ask(`למחוק את "${day.name}"?`).then((ok) => ok && deleteDay(day.id))}>
                🗑
              </button>
            </div>
            {day.meals.map((m) => (
              <MealCard key={m.id} meal={m} onDelete={() => deleteMeal(day.id, m.id)} />
            ))}
            <button className="btn add" onClick={() => addMeal(day.id)}>
              + הוספת סעודה
            </button>
          </div>
        );
      })}
      <button className="btn add big-add" onClick={addDay}>
        + הוספת יום
      </button>
    </div>
  );
}

export function SettingsScreen() {
  const key = useStore((s) => s.settings.ytApiKey);
  const setKey = useStore((s) => s.setYtApiKey);
  const replaceAll = useStore((s) => s.replaceAll);
  const counts = useStore(useShallow((s) => ({ v: s.videos.length, r: s.recipes.length, c: s.chefs.length, m: allMeals(s).length })));
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const [cloud, setCloud] = useState(false);
  useEffect(() => {
    void cloudAvailable().then(setCloud);
  }, []);

  const download = async () => {
    const json = JSON.stringify(exportData(), null, 1);
    const filename = `kitchen-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (IS_ARTIFACT) {
      const dl = await claudeUse('downloads');
      if (!dl) return setMsg('ההורדה לא זמינה בתצוגה הזאת');
      try {
        await dl.save({ filename, data: json });
        setMsg('✓ הגיבוי נשמר');
      } catch {
        /* the viewer declined */
      }
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as KitchenData;
      if (data.version !== 1 || !Array.isArray(data.chefs) || !data.shabbat) throw new Error();
      if (!(await ask('השחזור יחליף את כל הנתונים הנוכחיים. להמשיך?'))) return;
      replaceAll(data);
      setMsg('✓ הנתונים שוחזרו');
    } catch {
      setMsg('הקובץ לא תקין');
    }
  };

  return (
    <div className="page">
      <Header title="הגדרות" back="/" />
      <section className="card">
        <h2>שמירת נתונים</h2>
        <p className="muted">
          {cloud
            ? 'כל מה שמוסיפים נשמר אוטומטית בחשבון שלך, גם אחרי סגירת הצ׳אט, ורק לך יש גישה אליו.'
            : 'כל מה שמוסיפים נשמר אוטומטית במכשיר הזה, גם אחרי סגירת האפליקציה.'} כרגע שמורים {counts.c} שפים, {counts.v} סרטונים,{' '}
          {counts.r} מתכונים ו-{counts.m} סעודות.
        </p>
        <p className="muted">לגיבוי או להעברה למכשיר אחר:</p>
        <div className="row gap wrap">
          <button className="btn" onClick={download}>
            ⬇ הורדת גיבוי
          </button>
          <button className="btn ghost" onClick={() => file.current?.click()}>
            ⬆ שחזור מגיבוי
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </div>
        {msg && <p>{msg}</p>}
      </section>
      <section className="card">
        <h2>מפתח YouTube (לא חובה)</h2>
        <p className="muted">
          כדי למשוך אוטומטית את תיאור הסרטון (שממנו נבנה המתכון) צריך מפתח YouTube Data API חינמי מ-Google Cloud Console. בלי
          מפתח אפשר פשוט להדביק את התיאור ידנית. שם הסרטון ותמונת הכותרת נמשכים תמיד, גם בלי מפתח.
        </p>
        <input className="input" dir="ltr" value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="AIza…" />
      </section>
    </div>
  );
}

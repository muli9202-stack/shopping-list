import { useEffect, useRef, useState } from 'react';
import { exportData, useApp } from '../store';
import { AI_MODELS, type AppData } from '../types';
import { Header } from '../ui/components';
import { confirmDialog } from '../ui/dialog';
import { downloadExcel, xlsxToData } from '../excel';
import { listSnapshots, type Snapshot } from '../autoBackup';
import { defaultReminder, downloadIcs, googleCalendarUrl, WEEKDAYS } from '../reminder';
import { MODES, MODE_IDS, type Mode, type Reminder } from '../types';
import SyncCard from '../ui/SyncCard';

const fmt = (ts: number) =>
  new Date(ts).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function SettingsScreen() {
  const settings = useApp((s) => s.settings);
  const counts = { p: useApp((s) => s.products.length), h: useApp((s) => s.history.length) };
  const { updateSettings, importData, resetAll } = useApp.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);

  useEffect(() => {
    listSnapshots().then(setSnaps);
  }, []);

  const restore = async (data: AppData, source: string) => {
    if (data?.version !== 1 || !Array.isArray(data.products) || !Array.isArray(data.categories)) throw new Error('bad');
    const ok = await confirmDialog({
      title: 'שחזור מגיבוי',
      message: `${source}: ${data.products.length} מוצרים ו-${data.history?.length ?? 0} קניות בהיסטוריה. כל הנתונים הנוכחיים יוחלפו.`,
      confirmText: 'שחזור',
      danger: true,
    });
    if (!ok) return;
    importData({ ...data, settings: { ...settings, ...data.settings, apiKey: settings.apiKey || data.settings?.apiKey || '' } });
    setMsg('הנתונים שוחזרו בהצלחה');
  };

  const doImport = async (file: File) => {
    try {
      const data = file.name.toLowerCase().endsWith('.json')
        ? (JSON.parse(await file.text()) as AppData)
        : xlsxToData(new Uint8Array(await file.arrayBuffer()));
      await restore(data, 'הקובץ מכיל');
    } catch {
      setMsg('הקובץ אינו קובץ גיבוי תקין');
    }
  };

  return (
    <div className="page">
      <Header title="הגדרות" back="/" />

      <section className="card">
        <h2>גיבוי לאקסל</h2>
        <p className="muted">
          כל הנתונים נשמרים במכשיר ({counts.p} מוצרים, {counts.h} קניות בהיסטוריה). קובץ האקסל כולל את הרשימות, ההיסטוריה ורשימת המוצרים, ואפשר גם לשחזר ממנו.
        </p>
        <div className="stack">
          <button
            className="btn primary"
            onClick={() => {
              downloadExcel(exportData());
              setMsg('קובץ האקסל נשמר בהורדות');
            }}
          >
            ⬇️ ייצוא לאקסל עכשיו
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆️ שחזור מקובץ גיבוי
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        <label className="switch-row">
          <input type="checkbox" checked={!!settings.autoExcel} onChange={(e) => updateSettings({ autoExcel: e.target.checked })} />
          <span>
            <strong>הורדת קובץ אקסל אוטומטית כל שעה</strong>
            <span className="muted small"> כל עוד האפליקציה פתוחה. הדפדפן לא מאפשר לשמור קבצים כשהיא סגורה.</span>
          </span>
        </label>
        {msg && <p className="ok-msg">{msg}</p>}
      </section>

      <section className="card">
        <h2>גיבויים אוטומטיים במכשיר</h2>
        <p className="muted small">כל שעה (כשיש שינוי) נשמר עותק במכשיר. נשמרים 24 העותקים האחרונים.</p>
        {snaps.length === 0 ? (
          <p className="muted">עדיין אין גיבויים אוטומטיים.</p>
        ) : (
          <ul className="snap-list">
            {snaps.map((sn) => (
              <li key={sn.date}>
                <span>
                  {fmt(sn.date)}
                  <span className="muted small"> · {sn.data.products.length} מוצרים</span>
                </span>
                <span className="row">
                  <button className="btn small" onClick={() => downloadExcel(sn.data, new Date(sn.date))}>
                    אקסל
                  </button>
                  <button className="btn small ghost" onClick={() => restore(sn.data, 'הגיבוי מכיל').catch(() => setMsg('הגיבוי פגום'))}>
                    שחזור
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SyncCard />
      <ReminderCard />
      <BudgetCard />

      <section className="card">
        <h2>בינה מלאכותית (Claude)</h2>
        <p className="muted">מפתח ה-API משמש לניתוח הקנייה הממוצעת. הוא נשמר רק במכשיר הזה ולא נכלל בקובץ הגיבוי.</p>
        <label className="form">
          מפתח Claude API
          <div className="row">
            <input
              className="input ltr"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-ant-..."
              value={settings.apiKey}
              onChange={(e) => updateSettings({ apiKey: e.target.value.trim() })}
            />
            <button type="button" className="btn ghost" onClick={() => setShowKey(!showKey)}>
              {showKey ? 'הסתר' : 'הצג'}
            </button>
          </div>
        </label>
        <label className="form">
          מודל
          <select className="input" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}>
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">
          מפתח אפשר ליצור ב-<a className="link" href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">platform.claude.com</a>. כל ניתוח עולה בדרך כלל כמה סנטים.
        </p>
      </section>

      <section className="card">
        <h2>איפוס</h2>
        <button
          className="btn danger"
          onClick={async () => {
            if (await confirmDialog({ title: 'מחיקת כל הנתונים', message: 'המאגר, הרשימות וההיסטוריה יימחקו לצמיתות.', confirmText: 'מחיקה', danger: true }))
              resetAll();
          }}
        >
          מחיקת כל הנתונים
        </button>
      </section>
    </div>
  );
}

function ReminderCard() {
  const saved = useApp((s) => s.settings.reminder);
  const r: Reminder = saved ?? defaultReminder();
  const set = (patch: Partial<Reminder>) => useApp.getState().updateSettings({ reminder: { ...r, ...patch } });
  const when = (m: Mode) => (m === 'weekly' ? `כל יום ${WEEKDAYS[r.weekday]} ב-${r.time}` : `כל ${r.monthDay} בחודש ב-${r.time}`);
  return (
    <section className="card">
      <h2>🔔 תזכורת לקנייה</h2>
      <p className="muted small">התזכורת נכנסת ליומן של הטלפון כאירוע חוזר, ולכן היא מצלצלת גם כשהאפליקציה סגורה.</p>
      <div className="row two-col form">
        <label>
          יום בשבוע
          <select className="input" value={r.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          שעה
          <input className="input ltr" type="time" value={r.time} onChange={(e) => set({ time: e.target.value || '18:00' })} />
        </label>
      </div>
      <label className="form">
        יום בחודש (לקנייה החודשית)
        <select className="input" value={r.monthDay} onChange={(e) => set({ monthDay: Number(e.target.value) })}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      {MODE_IDS.map((m) => (
        <div key={m} className="reminder-mode">
          <strong>{MODES[m].name}</strong> <span className="muted small">{when(m)}</span>
          <div className="row">
            <a className="btn small" href={googleCalendarUrl(r, m)} target="_blank" rel="noreferrer">
              ליומן Google
            </a>
            <button className="btn small ghost" onClick={() => downloadIcs(r, m)}>
              ליומן אחר (אייפון)
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function BudgetCard() {
  const budgets = useApp((s) => s.budgets);
  return (
    <section className="card">
      <h2>💰 תקציב</h2>
      <p className="muted small">בזמן הקנייה תראה כמה נשאר מהתקציב.</p>
      <div className="row two-col form">
        {MODE_IDS.map((m) => (
          <label key={m}>
            {MODES[m].name} (₪)
            <input
              className="input ltr"
              inputMode="decimal"
              placeholder="ללא"
              defaultValue={budgets[m] ?? ''}
              onBlur={(e) => useApp.getState().setBudget(m, parseFloat(e.target.value) || undefined)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

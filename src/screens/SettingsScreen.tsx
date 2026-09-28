import { useRef, useState } from 'react';
import { exportData, useApp } from '../store';
import type { AppData } from '../types';
import { Header } from '../ui/components';
import { confirmDialog } from '../ui/dialog';

export default function SettingsScreen() {
  const settings = useApp((s) => s.settings);
  const counts = { p: useApp((s) => s.products.length), h: useApp((s) => s.history.length) };
  const { updateSettings, importData, resetAll } = useApp.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [showKey, setShowKey] = useState(false);

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shopping-list-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('קובץ הגיבוי נשמר');
  };

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppData;
      if (data.version !== 1 || !Array.isArray(data.products) || !Array.isArray(data.categories)) throw new Error('bad');
      const ok = await confirmDialog({
        title: 'שחזור מגיבוי',
        message: `הקובץ מכיל ${data.products.length} מוצרים ו-${data.history?.length ?? 0} רשימות בהיסטוריה. כל הנתונים הנוכחיים יוחלפו.`,
        confirmText: 'שחזור',
        danger: true,
      });
      if (!ok) return;
      importData({ ...data, settings: { ...data.settings, apiKey: settings.apiKey || data.settings?.apiKey || '' } });
      setMsg('הנתונים שוחזרו בהצלחה');
    } catch {
      setMsg('הקובץ אינו קובץ גיבוי תקין');
    }
  };

  return (
    <div className="page">
      <Header title="הגדרות" back="/" />

      <section className="card">
        <h2>גיבוי ושחזור</h2>
        <p className="muted">
          כל הנתונים נשמרים במכשיר ({counts.p} מוצרים, {counts.h} רשימות בהיסטוריה). מומלץ לשמור גיבוי מדי פעם.
        </p>
        <div className="stack">
          <button className="btn primary" onClick={doExport}>
            ⬇️ ייצוא גיבוי (JSON)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆️ ייבוא מגיבוי
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        {msg && <p className="ok-msg">{msg}</p>}
      </section>

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

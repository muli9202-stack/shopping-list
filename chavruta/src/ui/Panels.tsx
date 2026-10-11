// Secondary screens: study picker, settings (with costs and privacy), library coverage
// and progress, and the Hebrew help page.
import { useEffect, useState } from 'react';
import { engine } from '../brain/engine';
import { IS_ARTIFACT } from '../env';
import { PRICES, PRICES_CHECKED } from '../brain/claude';
import { COVERAGE, COVERAGE_CHECKED, STATUS_HE } from '../core/coverage';
import { TERMS } from '../core/lexicon';
import { SNAPSHOT_DATE } from '../core/sefaria';
import { hebrewVoices, voicesReady } from '../speech/tts';
import { LEVELS, PROGRESS_LABEL, useStudy, type Level, type Settings } from '../state/store';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="סגור" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const QUICK = [
  { label: 'ברכות ב׳ ע״א', say: 'בוא נלמד ברכות דף ב עמוד א' },
  { label: 'ברכות ב׳ ע״ב', say: 'פתח ברכות דף ב עמוד ב' },
  { label: 'משנה ברכות א׳ א׳', say: 'נלמד משנה ברכות פרק א משנה א' },
  { label: 'בראשית א׳', say: 'פתח בראשית פרק א' },
  { label: 'פרשת השבוע', say: 'פתח את הפסוקים בפרשת השבוע' },
];

/** First screen: continue, quick picks, level and style. The chavruta stays visible beside it. */
export function StartPanel() {
  const resume = useStudy((s) => s.resume);
  const progress = useStudy((s) => s.progress);
  const settings = useStudy((s) => s.settings);
  const recent = Object.values(progress)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);
  return (
    <div className="start">
      <h2>מה נלמד היום?</h2>
      <p className="muted">
        אפשר לדבר („בוא נלמד ברכות דף ב׳ עמוד א׳”), להקליד למטה, או לבחור כאן. החברותא תמיד נשארת גלויה לצד הדף.
      </p>
      {resume && (
        <button className="resume-card" onClick={() => engine.dispatch({ type: 'resume' })}>
          <strong>להמשיך מהמקום שעצרנו</strong>
          <span>
            {resume.he}, שורה {resume.seg}
            {resume.pending.length ? ' · יש הסבר שנקטע באמצע' : ''}
          </span>
        </button>
      )}
      <div className="quick">
        {QUICK.filter((q) => !IS_ARTIFACT || q.label !== 'פרשת השבוע').map((q) => (
          <button key={q.label} className="chip big" onClick={() => engine.handleInput(q.say)}>
            {q.label}
          </button>
        ))}
      </div>
      <div className="row">
        <label>
          אופן לימוד{' '}
          <select value={settings.level} onChange={(e) => useStudy.getState().setSettings({ level: e.target.value as Level })}>
            {Object.entries(LEVELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          הסברים{' '}
          <select value={settings.style} onChange={(e) => useStudy.getState().setSettings({ style: e.target.value as Settings['style'] })}>
            <option value="direct">הסבר ישיר</option>
            <option value="hint">אני רוצה לנסות לבד (רמזים)</option>
          </select>
        </label>
      </div>
      {recent.length > 0 && (
        <>
          <h3>למדנו לאחרונה</h3>
          <ul className="recent">
            {recent.map((p) => (
              <li key={p.ref}>
                <button className="link-btn" onClick={() => engine.openRef(p.ref)}>
                  {p.he}
                </button>{' '}
                <span className={`status s-${p.status}`}>{PROGRESS_LABEL[p.status]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const s = useStudy((x) => x.settings);
  const costs = useStudy((x) => x.costs);
  const set = useStudy.getState().setSettings;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(hebrewVoices());
  const [showKey, setShowKey] = useState(false);
  useEffect(() => {
    voicesReady().then(setVoices);
  }, []);
  const price = PRICES[s.model];
  return (
    <div className="settings">
      {IS_ARTIFACT ? (
        <fieldset>
          <legend>מנגנון ההסבר</legend>
          <p className="muted small">
            בגרסה שבצ'אט Claude עונה דרך החשבון שלך, בלי מפתח. בשאלה הראשונה תתבקש לאשר. אם לא תאשר, החברותא תמשיך במצב הדגמה. השימוש נספר במכסת השימוש הרגילה שלך ב-Claude.
          </p>
        </fieldset>
      ) : (
        <>
      <fieldset>
        <legend>מנגנון ההסבר</legend>
        <p className="muted small">
          בלי מפתח עובד <b>מצב הדגמה</b>: קריאה מהמקור, מפרשים, מילון מילים, המחשות ובדיקת טענות על ברכות ב׳ ע״א. עם מפתח Claude החברותא עונה חופשית מתוך המקורות.
        </p>
        <label className="field">
          מפתח Claude API
          <span className="row">
            <input type={showKey ? 'text' : 'password'} value={s.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="sk-ant-…" dir="ltr" autoComplete="off" />
            <button className="btn small" onClick={() => setShowKey(!showKey)}>
              {showKey ? 'הסתר' : 'הצג'}
            </button>
          </span>
        </label>
        <p className="muted small">המפתח נשמר רק במכשיר הזה, והבקשות נשלחות ישירות מהדפדפן ל-Anthropic. מקבלים מפתח ב-console.anthropic.com.</p>
        <label className="field">
          מודל
          <select value={s.model} onChange={(e) => set({ model: e.target.value })}>
            {Object.entries(PRICES).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label} (${p.input} / ${p.output} למיליון טוקנים)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          עומק חשיבה
          <select value={s.effort} onChange={(e) => set({ effort: e.target.value as Settings['effort'] })}>
            <option value="low">מהיר (מתאים לשיחה)</option>
            <option value="medium">בינוני</option>
            <option value="high">עמוק (איטי יותר)</option>
          </select>
        </label>
      </fieldset>
        </>
      )}

      <fieldset>
        <legend>קול ודמות</legend>
        <label className="field">
          קול
          <select value={s.voiceURI} onChange={(e) => set({ voiceURI: e.target.value })}>
            <option value="">ברירת מחדל (קול עברי ראשון)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        {voices.length === 0 && <p className="warn small">לא נמצא במכשיר קול עברי. החברותא תציג כתוביות בלי קול. ב-Windows: הגדרות → זמן ושפה → דיבור → הוסף קול „עברית”. באנדרואיד: מנוע הדיבור של Google עם עברית.</p>}
        <div className="row">
          <label className="field">
            מראה
            <select value={s.look} onChange={(e) => set({ look: e.target.value as Settings['look'] })}>
              <option value="young">אברך</option>
              <option value="elder">ת״ח מבוגר</option>
              <option value="woman">לומדת</option>
            </select>
          </label>
          <label className="field">
            רקע
            <select value={s.background} onChange={(e) => set({ background: e.target.value as Settings['background'] })}>
              <option value="beit-midrash">בית מדרש</option>
              <option value="library">ספרייה</option>
              <option value="plain">רקע שקט</option>
            </select>
          </label>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={s.voiceOnly} onChange={(e) => set({ voiceOnly: e.target.checked })} /> קול בלבד (בלי דמות)
        </label>
      </fieldset>

      <fieldset>
        <legend>שיחה</legend>
        <label className="field">
          מיקרופון
          <select value={s.micMode} onChange={(e) => set({ micMode: e.target.value as Settings['micMode'] })}>
            <option value="open">פתוח (מדברים חופשי, אפשר לקטוע)</option>
            <option value="ptt">לחץ כדי לדבר</option>
          </select>
        </label>
        <label className="field">
          זמן חשיבה לפני תשובה: {(s.endOfTurnMs / 1000).toFixed(1)} שניות
          <input type="range" min={600} max={4000} step={100} value={s.endOfTurnMs} onChange={(e) => set({ endOfTurnMs: Number(e.target.value) })} />
        </label>
        <p className="muted small">במיקרופון פתוח מומלץ להשתמש באוזניות, כדי שקול החברותא לא ייקלט כדיבור שלך.</p>
      </fieldset>

      <fieldset>
        <legend>תצוגה</legend>
        <label className="field">
          גודל הכתב בדף: {Math.round(s.fontScale * 100)}%
          <input type="range" min={0.8} max={2} step={0.1} value={s.fontScale} onChange={(e) => set({ fontScale: Number(e.target.value) })} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.highContrast} onChange={(e) => set({ highContrast: e.target.checked })} /> ניגודיות גבוהה
        </label>
      </fieldset>

      <fieldset>
        <legend>פרטיות ושמירה</legend>
        <label className="toggle">
          <input type="checkbox" checked={s.save.place} onChange={(e) => set({ save: { ...s.save, place: e.target.checked } })} /> לשמור מקום לימוד והתקדמות
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.save.notes} onChange={(e) => set({ save: { ...s.save, notes: e.target.checked } })} /> לשמור הערות, סימניות ושאלות פתוחות
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.save.conversation} onChange={(e) => set({ save: { ...s.save, conversation: e.target.checked } })} /> לשמור את תמליל השיחה
        </label>
        <p className="muted small">
          הכול נשמר רק במכשיר. הקול לא מוקלט ולא נשמר. הקלטה מופעלת רק בבחירה מפורשת, ובגרסה הזאת אין הקלטה בכלל. אין שימוש במצלמה. זיהוי הדיבור של Chrome מעבד את הקול בשרתי Google.
        </p>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('למחוק את כל ההיסטוריה, ההערות והסימניות מהמכשיר?')) useStudy.getState().clearHistory();
          }}
        >
          מחיקת היסטוריה
        </button>
      </fieldset>

      <fieldset>
        <legend>עלויות</legend>
        <table className="costs">
          <tbody>
            <tr>
              <th>מודל ({price?.label ?? s.model})</th>
              <td>
                {s.apiKey ? (
                  <>
                    ${costs.usd.toFixed(4)} בשיחה הזאת · {costs.requests} בקשות · {costs.inputTokens.toLocaleString()} טוקנים נכנסים,{' '}
                    {costs.outputTokens.toLocaleString()} יוצאים, {costs.cacheReadTokens.toLocaleString()} מהמטמון
                  </>
                ) : (
                  'מצב הדגמה: ללא עלות'
                )}
                <div className="muted small">
                  מחירון Anthropic (נבדק {PRICES_CHECKED}): ${price?.input} לכל מיליון טוקנים נכנסים, ${price?.output} לכל מיליון יוצאים
                  {price?.estimated ? ' (מחיר המטמון לדגם הזה הוא הערכה)' : ''}. הערכה גסה: שאלה ותשובה קצרה עם הדף בהקשר, כ-5,000 טוקנים נכנסים ו-500 יוצאים.
                </div>
              </td>
            </tr>
            <tr>
              <th>שיחה קולית</th>
              <td>ללא עלות. זיהוי הדיבור וההקראה הם של הדפדפן (Web Speech API).</td>
            </tr>
            <tr>
              <th>דמות</th>
              <td>ללא עלות. הדמות מצוירת ומונפשת במכשיר (SVG).</td>
            </tr>
            <tr>
              <th>מקורות</th>
              <td>ללא עלות. ה-API הציבורי של ספריא.</td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    </div>
  );
}

export function LibraryPanel() {
  const progress = useStudy((s) => s.progress);
  const bookmarks = useStudy((s) => s.bookmarks);
  const notes = useStudy((s) => s.notes);
  const items = Object.values(progress).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="library">
      <h3>המקום שלי</h3>
      {items.length === 0 && <p className="muted">עוד לא נפתחו מקורות.</p>}
      {items.length > 0 && (
        <table className="progress">
          <thead>
            <tr>
              <th>מקור</th>
              <th>מצב</th>
              <th>סימון</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.ref}>
                <td>
                  <button className="link-btn" onClick={() => engine.openRef(p.ref)}>
                    {p.he}
                  </button>
                </td>
                <td>
                  <span className={`status s-${p.status}`}>{PROGRESS_LABEL[p.status]}</span>
                </td>
                <td>
                  <button className="btn small" onClick={() => useStudy.getState().markProgress(p.ref, p.he, 'learned')}>
                    למדתי והבנתי
                  </button>{' '}
                  <button className="btn small" onClick={() => useStudy.getState().markProgress(p.ref, p.he, 'reviewed')}>
                    חזרתי
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">
        „נפתח” ו„נקרא” נקבעים לפי מה שנפתח ומה שהוקרא עד הסוף. „נלמד” ו„חזרתי” נקבעים רק כשאתה מסמן אותם. זמן שהדף היה פתוח לא נחשב להבנה.
      </p>
      {bookmarks.length > 0 && (
        <>
          <h3>סימניות</h3>
          <ul>
            {bookmarks.map((b) => (
              <li key={`${b.ref}:${b.seg}`}>
                <button className="link-btn" onClick={() => engine.openRef(`${b.ref}:${b.seg}`, { silent: true })}>
                  {b.he}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {Object.keys(notes).length > 0 && (
        <>
          <h3>הערות</h3>
          <ul>
            {Object.entries(notes).map(([k, v]) => (
              <li key={k}>
                <button className="link-btn" onClick={() => engine.openRef(k, { silent: true })}>
                  {k}
                </button>
                : {v}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>מאגר המקורות: מה זמין ומה חסר</h3>
      <p className="muted small">
        נבדק בתאריך {COVERAGE_CHECKED}. העותק השמור במכשיר נשלף מספריא ב-{SNAPSHOT_DATE.slice(0, 10)}. החברותא לא טוענת שהיא יודעת את כל התורה: היא לומדת מהטקסטים שהיא מצליחה לפתוח, ואומרת כשמקור חסר.
      </p>
      <table className="coverage">
        <thead>
          <tr>
            <th>תחום</th>
            <th>מה</th>
            <th>מצב</th>
            <th>מקור ומהדורות</th>
          </tr>
        </thead>
        <tbody>
          {COVERAGE.map((c, i) => (
            <tr key={i}>
              <td>{c.area}</td>
              <td>
                {c.what}
                {c.note && <div className="muted small">{c.note}</div>}
              </td>
              <td>
                <span className={`cov cov-${c.status}`}>{STATUS_HE[c.status]}</span>
              </td>
              <td>
                {c.source}
                {c.editions && <div className="muted small">{c.editions}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HelpPanel() {
  return (
    <div className="help">
      <p>
        <b>החברותא שלי</b> היא שותפה ללימוד מבוססת בינה מלאכותית. המראה הטבעי נועד להקל על השיחה. היא לא אדם, ולא פוסקת הלכה למעשה.
      </p>
      <h3>איך מתחילים</h3>
      <ol>
        <li>לוחצים על „🎙 מיקרופון” ומאשרים גישה למיקרופון, או מקלידים בתיבה למטה.</li>
        <li>אומרים מה ללמוד: „בוא נלמד ברכות דף ב׳ עמוד א׳”, „נלמד משנה ברכות פרק א׳ משנה א׳”, „פתח את הפסוקים בפרשת השבוע”.</li>
        <li>הדף נפתח, והחברותא מתחילה לקרוא ולהסביר בקטעים קצרים.</li>
      </ol>
      <h3>תוך כדי לימוד</h3>
      <ul>
        <li>
          <b>לקטוע:</b> פשוט מדברים, למשל „רגע, לא הבנתי את המילה הזאת”. החברותא עוצרת, עונה, ואחר כך חוזרת למה שלא שמעת. אפשר גם ללחוץ „עצור” או Esc.
        </li>
        <li>
          <b>מילה:</b> לוחצים על מילה בדף ובוחרים „פירוש המילה”, או אומרים „מה פירוש המילה הזאת?”.
        </li>
        <li>
          <b>מפרשים:</b> „פתח רש״י”, „תראה את תוספות”, „פתח ברטנורא”, „פתח רמב״ן”. הפירוש נפתח לצד הדף, כל דיבור ליד השורה שלו.
        </li>
        <li>
          <b>מקור:</b> „תראה לי איפה זה כתוב” מסמן את השורה או את הדיבור שהחברותא ציטטה.
        </li>
        <li>
          <b>המחשה:</b> „תעשה לי המחשה”, „תצייר לי”, „תראה את ההבדל בין השיטות”, „מה ישתנה אם נשנה את המקרה?”.
        </li>
        <li>
          <b>ניווט:</b> „חזור לעמוד הקודם”, „עבור לדף הבא”, „תחזור למקום שבו עצרנו”.
        </li>
        <li>
          <b>אופן:</b> „אני רוצה לנסות לבד” (רמזים), „תסביר לי ישר”, „תסכם”.
        </li>
      </ul>
      <h3>מה כל אמירה</h3>
      <p>בכתוביות ובתמליל כל אמירה מסומנת: לשון המקור, תרגום, הסבר, שיטת מפרש, הצעה להבנה או שאלה. ציטוט מוצג רק אחרי שנבדק שהוא באמת כתוב במקור.</p>
      <h3>מקלדת</h3>
      <ul>
        <li>Esc: עצירה · /: מעבר לתיבת ההקלדה · Ctrl+Shift+M: מיקרופון · Tab: מעבר בין מילים וכפתורים, Enter: בחירת מילה</li>
      </ul>
      <h3>מונחים</h3>
      <dl className="terms">
        {TERMS.map((t) => (
          <div key={t.term}>
            <dt>{t.term}</dt>
            <dd>{t.meaning}</dd>
          </div>
        ))}
      </dl>
      <h3>דרישות</h3>
      <p className="muted">
        מומלץ Chrome או Edge, במחשב או באנדרואיד. נדרש קול עברי במכשיר להקראה. בלי קול עברי מוצגות כתוביות. זיהוי דיבור בעברית דורש אינטרנט.
      </p>
    </div>
  );
}

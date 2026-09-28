import { useState } from 'react';
import { useApp } from '../store';

const STEPS = [
  {
    icon: '🛒',
    title: 'ברוך הבא לרשימת הקניות',
    text: 'רשימה נפרדת לנטו חיסכון וליש חסד, לקנייה השבועית ולקנייה החודשית.',
  },
  {
    icon: '📋',
    title: 'פעם אחת: מה יש בחנות',
    text: 'בתוך "קנייה שבועית" מוסיפים קטגוריות ומוצרים (או טוענים רשימה לדוגמה). משם, כל שבוע רק מסמנים מה צריך.',
  },
  {
    icon: '✅',
    title: 'בחנות',
    text: 'לחיצה על מוצר מסמנת ✓. מה שלא היה במלאי עובר לבד לפעם הבאה. אפשר לסדר לפי מסלול בסניף ולנווט בתלת־ממד.',
  },
  {
    icon: '💾',
    title: 'הנתונים שלך בטלפון',
    text: 'הכול נשמר במכשיר, עם גיבוי אוטומטי כל שעה וייצוא לאקסל. בהגדרות אפשר לחבר רשימה משותפת עם בן/בת הזוג.',
  },
];

/** A short first-run introduction; shown once. */
export default function Welcome() {
  const [i, setI] = useState(0);
  const done = () => useApp.getState().updateSettings({ seenWelcome: true });
  const step = STEPS[i];
  return (
    <div className="overlay">
      <div className="dialog welcome">
        <div className="welcome-icon">{step.icon}</div>
        <h3>{step.title}</h3>
        <p className="muted">{step.text}</p>
        <div className="welcome-dots">
          {STEPS.map((_, j) => (
            <span key={j} className={j === i ? 'on' : ''} />
          ))}
        </div>
        <div className="dialog-actions">
          <button className="btn ghost" onClick={done}>
            דילוג
          </button>
          <button className="btn primary" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : done())}>
            {i < STEPS.length - 1 ? 'הבא' : 'מתחילים'}
          </button>
        </div>
      </div>
    </div>
  );
}

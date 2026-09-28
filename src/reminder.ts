import type { Mode, Reminder } from './types';
import { downloadBytes } from './excel';

// Web apps can't raise notifications while closed, so the reminder is a
// recurring event in the phone's own calendar (which alarms reliably).

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const defaultReminder = (): Reminder => ({ weekday: 4, time: '18:00', monthDay: 1 });

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

function nextStart(r: Reminder, mode: Mode): Date {
  const [h, m] = r.time.split(':').map(Number);
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  if (mode === 'weekly') {
    d.setDate(d.getDate() + ((r.weekday - d.getDay() + 7) % 7));
    if (d < now) d.setDate(d.getDate() + 7);
  } else {
    d.setDate(r.monthDay);
    if (d < now) d.setMonth(d.getMonth() + 1);
  }
  return d;
}

const rrule = (r: Reminder, mode: Mode) =>
  mode === 'weekly' ? `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[r.weekday]}` : `FREQ=MONTHLY;BYMONTHDAY=${r.monthDay}`;

const title = (mode: Mode) => (mode === 'weekly' ? '🛒 הגיע הזמן להכין רשימה לקנייה השבועית' : '📦 הגיע הזמן להכין רשימה לקנייה החודשית');
const appUrl = () => location.href.split('#')[0];

export function googleCalendarUrl(r: Reminder, mode: Mode): string {
  const start = nextStart(r, mode);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title(mode),
    details: `פתח את האפליקציה: ${appUrl()}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    recur: `RRULE:${rrule(r, mode)}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function downloadIcs(r: Reminder, mode: Mode) {
  const start = nextStart(r, mode);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//shopping-list//HE',
    'BEGIN:VEVENT',
    `UID:shopping-reminder-${mode}@shopping-list`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    'DURATION:PT15M',
    `RRULE:${rrule(r, mode)}`,
    `SUMMARY:${title(mode)}`,
    `URL:${appUrl()}`,
    `DESCRIPTION:${appUrl()}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title(mode)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  downloadBytes(new TextEncoder().encode(lines.join('\r\n')), `shopping-reminder-${mode}.ics`, 'text/calendar');
}

/** Which reminder (if any) falls on today, for the in-app banner. */
export function dueToday(r: Reminder | undefined): Mode | null {
  if (!r) return null;
  const d = new Date();
  if (d.getDay() === r.weekday) return 'weekly';
  if (d.getDate() === r.monthDay) return 'monthly';
  return null;
}

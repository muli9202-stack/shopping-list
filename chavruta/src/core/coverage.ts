// What the library really covers, and how we know. Shown on the "מאגר וכיסוי" screen.
// "checked" entries were verified against the live Sefaria API on the date given
// (names and structure: chavruta/scripts/check-coverage.mts; texts: the snapshot script and unit tests).

export const COVERAGE_CHECKED = '2026-10-10';

export type CoverageStatus = 'tested' | 'checked' | 'reachable' | 'link-only' | 'missing';

export const STATUS_HE: Record<CoverageStatus, string> = {
  tested: 'נבדק לעומק (טקסט, פירושים, ציטוטים)',
  checked: 'נבדק שהספר והמבנה קיימים',
  reachable: 'נגיש דרך חיפוש שמות, לא נבדק לעומק',
  'link-only': 'קישור חיצוני בלבד',
  missing: 'חסר / דורש חיבור',
};

export interface CoverageRow {
  area: string;
  what: string;
  status: CoverageStatus;
  source: string;
  editions?: string;
  note?: string;
}

export const COVERAGE: CoverageRow[] = [
  {
    area: 'תלמוד בבלי',
    what: 'ברכות ב׳ ע״א – ג׳ ע״א, עם רש״י ותוספות',
    status: 'tested',
    source: 'ספריא + עותק שמור במכשיר',
    editions: 'מהדורת וויליאם דייוידסון, ארמית מנוקדת (CC-BY-NC); רש״י ותוספות, דפוס וילנא (נחלת הכלל)',
    note: 'עובד גם בלי אינטרנט. כל ציטוטי מצב ההדגמה נבדקים מול הטקסט.',
  },
  {
    area: 'תלמוד בבלי',
    what: 'כל 37 המסכתות, כל דף ועמוד',
    status: 'checked',
    source: 'ספריא (חי)',
    editions: 'לפי ברירת המחדל של ספריא לכל מסכת',
    note: 'שמות המסכתות ומספר הדפים נבדקו מול ספריא. רש״י ותוספות נטענים לכל עמוד. מפרשים נוספים לפי הקישורים של ספריא.',
  },
  {
    area: 'משנה',
    what: 'משנה ברכות פרק א׳, עם ברטנורא, פירוש המשנה לרמב״ם ותוספות יום טוב',
    status: 'tested',
    source: 'ספריא + עותק שמור במכשיר',
    editions: 'משנה: תורת אמת (נחלת הכלל); ברטנורא: תורת אמת (CC-BY-NC); רמב״ם: דפוס וילנא; תוי״ט: דפוס ראם 1913',
  },
  {
    area: 'משנה',
    what: 'כל 63 המסכתות',
    status: 'checked',
    source: 'ספריא (חי)',
    note: 'שמות כל המסכתות נבדקו. ברטנורא, רמב״ם ותוי״ט נטענים לפי זמינותם בכל פרק.',
  },
  {
    area: 'תנ״ך',
    what: 'בראשית פרק א׳, עם רש״י, רמב״ן, אבן עזרא וספורנו',
    status: 'tested',
    source: 'ספריא + עותק שמור במכשיר',
    editions: 'מקרא על פי המסורה (CC-BY-SA); רש״י: מהדורת רוזנבאום־זילברמן (נחלת הכלל); רמב״ן וספורנו: מהדורה מנוקדת; אבן עזרא: פיוטרקוב',
  },
  {
    area: 'תנ״ך',
    what: 'כל 39 הספרים, פרשת השבוע וכל פרשה לפי שם',
    status: 'checked',
    source: 'ספריא (חי)',
    note: 'פרשת השבוע לפי לוח ארץ ישראל של ספריא.',
  },
  {
    area: 'ירושלמי, תוספתא, מדרשים, משנה תורה, שולחן ערוך ועוד',
    what: 'כל ספר שספריא מזהה בשמו העברי',
    status: 'reachable',
    source: 'ספריא (חי), פענוח שמות',
    note: 'נפתחים ומוצגים, והחברותא יכולה לצטט מהם. פירושים ייעודיים להם עדיין לא מוגדרים מראש. מפרשים מקושרים מופיעים ברשימת הקישורים.',
  },
  {
    area: 'ראשונים ואחרונים על הש״ס',
    what: 'כל מפרש שספריא מקשרת לעמוד (למשל מאירי, צל״ח, פני יהושע, תוספות הרא״ש)',
    status: 'reachable',
    source: 'ספריא (חי), קישורים',
    note: 'נטענים לצד הדף בלחיצה. הקישור לשורה המדויקת לפי ספריא.',
  },
  {
    area: 'חיפוש מקורות',
    what: 'חיפוש טקסט מלא בכל ספריא, ואז טעינת הטקסט המקורי של כל תוצאה',
    status: 'checked',
    source: 'ספריא search API',
    note: 'במצב מלא (עם Claude): לשאלות שמבקשות מקור נוסף. ההסבר נבנה מהטקסט המקורי, לא מתקציר החיפוש.',
  },
  {
    area: 'מכון ממרא',
    what: 'תנ״ך ומשנה תורה',
    status: 'link-only',
    source: 'mechon-mamre.org',
    note: 'האתר נגיש, אבל הטקסטים מוגנים בזכויות יוצרים („Copyright Mechon Mamre”) ואין רישיון פתוח. לשילוב נדרש אישור בכתב.',
  },
  {
    area: 'ויקיטקסט',
    what: 'טקסטים בעברית (CC-BY-SA)',
    status: 'missing',
    source: 'he.wikisource.org API',
    note: 'ה-API החזיר הגבלת קצב (429) בבדיקה. „מקרא על פי המסורה” שמקורו בוויקיטקסט כבר מגיע דרך ספריא. חיבור ישיר מתוכנן.',
  },
  {
    area: 'היברובוקס',
    what: 'צילומי ספרים ודפי גמרא',
    status: 'missing',
    source: 'hebrewbooks.org',
    note: 'אין API רשמי, הגישה נחסמה (403) מסביבת הבנייה, וזכויות השימוש משתנות לפי ספר. צילום דף מורשה עדיין לא מוצג. התצוגה היא טקסט דיגיטלי.',
  },
  {
    area: 'חיפוש גוגל',
    what: 'Google Custom Search JSON API',
    status: 'missing',
    source: 'googleapis.com',
    note: 'השירות סגור ללקוחות חדשים ומתוכנן להיסגר ב-1.1.2027, ולכן לא שולב. אפשר לחבר שירות חיפוש מורשה אחר דרך אותו ממשק.',
  },
];

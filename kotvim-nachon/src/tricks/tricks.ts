import type { SkillId } from '../types';

export type TrickVisual =
  | { kind: 'text'; big: string; emoji?: string; color?: string }
  | { kind: 'morph'; from: string; to: string; emoji?: string }
  | { kind: 'list'; items: { w: string; e?: string; mark?: number }[] }
  | { kind: 'family'; root: string; kids: string[] }
  | { kind: 'hands' }
  | { kind: 'eyes' }
  | { kind: 'train'; cars: string[]; word: string }
  | { kind: 'finals' }
  | { kind: 'sinDot' }
  | { kind: 'compare'; left: { w: string; e?: string }; right: { w: string; e?: string } };

export interface TrickStep {
  say: string;
  caption: string;
  visual: TrickVisual;
}

export interface Trick {
  skill: SkillId;
  title: string;
  emoji: string;
  steps: TrickStep[];
}

/** Original tips & tricks for every common difficulty. Narrated aloud step by step. */
export const TRICKS: Record<SkillId, Trick> = {
  im_im: {
    skill: 'im_im',
    title: 'הידיים של עם',
    emoji: '🤝',
    steps: [
      { say: 'אִם וְעִם נשמעות כמעט אותו דבר. בואו נלמד טריק שלא נשכח לעולם!', caption: 'אם או עם?', visual: { kind: 'compare', left: { w: 'אם', e: '🤔' }, right: { w: 'עם', e: '🤝' } } },
      { say: 'גררו את שתי הידיים אחת אל השנייה, ותראו מה קורה!', caption: 'חברו את הידיים!', visual: { kind: 'hands' } },
      { say: 'עִם זה ביחד! כששתי ידיים מחזיקות ביחד, נוצרת האות ע. אני משחק עם חבר, עם ע.', caption: 'עם = ביחד = ע', visual: { kind: 'text', big: 'עם חבר', emoji: '🧑‍🤝‍🧑', color: '#7950f2' } },
      { say: 'אִם זה כמו אולי. אם ירד גשם? אולי! אם ואולי מתחילות שתיהן באות א.', caption: 'אם = אולי = א', visual: { kind: 'text', big: 'אם ירד גשם?', emoji: '🌧️🤔', color: '#1098ad' } },
      { say: 'טריק הבדיקה: נסו להגיד ביחד. אם זה מתאים, כותבים עם בעין. אם לא, כותבים אם באלף.', caption: 'אפשר להגיד "ביחד"? ← עם', visual: { kind: 'list', items: [{ w: 'אוכל עם אבא', e: '✅' }, { w: 'אם תבוא, נשחק', e: '✅' }] } },
    ],
  },
  alef_ayin: {
    skill: 'alef_ayin',
    title: 'לעין יש עיניים',
    emoji: '👁️',
    steps: [
      { say: 'א ו-ע נשמעות היום כמעט אותו דבר, ולכן קל להתבלבל. יש לנו שלושה טריקים!', caption: 'א או ע?', visual: { kind: 'compare', left: { w: 'א', e: '🅰️' }, right: { w: 'ע', e: '👀' } } },
      { say: 'טריק ראשון: לאות ע יש שתי עיניים למעלה! היא אוהבת מילים של הסתכלות: עין, עיניים, עפעף.', caption: 'ע רואה הכול 👀', visual: { kind: 'eyes' } },
      { say: 'טריק שני: משפחת מילים. אם יודעים איך כותבים מילה אחת במשפחה, יודעים את כולן! עבודה, עובד, עבד. כולן עם ע.', caption: 'משפחה שומרת על האות', visual: { kind: 'family', root: 'עבד', kids: ['עבודה', 'עובד', 'מעבדה'] } },
      { say: 'טריק שלישי: הקול הסודי. בראש, תגידו את ה-ע מהגרון, כמו סבא וסבתא מתימן: עַ. ואת ה-א תגידו רך.', caption: 'ע מהגרון, א רכה', visual: { kind: 'text', big: 'עוּגָה', emoji: '🎂🗣️', color: '#ff6b6b' } },
      { say: 'ועכשיו נזכור כמה מילים חשובות.', caption: 'מילים לזכור', visual: { kind: 'list', items: [{ w: 'עוגה', e: '🎂', mark: 0 }, { w: 'ענן', e: '☁️', mark: 0 }, { w: 'אריה', e: '🦁', mark: 0 }, { w: 'אבא', e: '👨', mark: 0 }] } },
    ],
  },
  tet_tav: {
    skill: 'tet_tav',
    title: 'ת של הסוף',
    emoji: '🍓',
    steps: [
      { say: 'ט ו-ת נשמעות אותו דבר. הנה הטריקים שיעזרו לכם.', caption: 'ט או ת?', visual: { kind: 'compare', left: { w: 'ט', e: '💧' }, right: { w: 'ת', e: '🍓' } } },
      { say: 'כשהמילה נגמרת ב-וֹת, ב-ית או ב-תִי, תמיד כותבים ת! ילדות, כיתות, כתבתי.', caption: 'סופים של ת', visual: { kind: 'list', items: [{ w: 'ילדות', mark: 4 }, { w: 'כתבתי', mark: 3 }, { w: 'מחברת', mark: 4 }] } },
      { say: 'ט עגולה כמו טבעת, כמו טיפה שמתגלגלת. טבעת, טיפה, טוב.', caption: 'ט עגולה כמו טבעת 💍', visual: { kind: 'text', big: 'טבעת', emoji: '💍💧', color: '#4dabf7' } },
      { say: 'ומשפחת מילים: טיול, מטייל, טיילנו. כולן עם ט!', caption: 'משפחה שומרת על האות', visual: { kind: 'family', root: 'טיל', kids: ['טיול', 'מטייל', 'טיילנו'] } },
    ],
  },
  kaf_het_kuf: {
    skill: 'kaf_het_kuf',
    title: 'הקוף, החום והכלב',
    emoji: '🐒',
    steps: [
      { say: 'כ, ח ו-ק מבלבלות. הנה טריק מטורף!', caption: 'כ, ח או ק?', visual: { kind: 'compare', left: { w: 'ח', e: '☀️' }, right: { w: 'כ', e: '🐕' } } },
      { say: 'בתחילת מילה, כ תמיד נשמעת כמו ק! אז אם שומעים ח בתחילת המילה, כמו חתול או חלון, זו בטוח ח.', caption: 'שומעים "ח" בהתחלה? ← ח', visual: { kind: 'list', items: [{ w: 'חתול', e: '🐱', mark: 0 }, { w: 'חלון', e: '🪟', mark: 0 }, { w: 'כלב', e: '🐕', mark: 0 }] } },
      { say: 'כשמדברים אל מישהו, המילה נגמרת בך סופית: שלך, אותך, הספר שלך.', caption: 'שלך, אותך, לך ← ך', visual: { kind: 'text', big: 'שלך', emoji: '👉🎁', color: '#51cf66' } },
      { say: 'ומשפחת מילים: כתב, מכתב, כתיבה, כולן עם כ. קרא, מקרא, קריאה, כולן עם ק.', caption: 'משפחה שומרת על האות', visual: { kind: 'family', root: 'כתב', kids: ['מכתב', 'כתיבה', 'כותב'] } },
    ],
  },
  samekh_sin: {
    skill: 'samekh_sin',
    title: 'שׂ שמאלית',
    emoji: '🐴',
    steps: [
      { say: 'יש שתי אותיות שנשמעות ס: סמך, ושין שמאלית.', caption: 'ס או שׂ?', visual: { kind: 'compare', left: { w: 'ס', e: '🐴' }, right: { w: 'שׂ', e: '👗' } } },
      { say: 'כאשר ש נשמעת ס, הנקודה שלה קופצת לצד שמאל. שין שמאלית, כמו המילה שמאל!', caption: 'הנקודה בשמאל ← שׂמאל', visual: { kind: 'sinDot' } },
      { say: 'משפחת מילים: שמח, שמחה, משמח. כולן עם שין שמאלית.', caption: 'משפחה שומרת על האות', visual: { kind: 'family', root: 'שמח', kids: ['שמחה', 'שמחים', 'משמח'] } },
      { say: 'נזכור: סבא, סוס, ספר עם ס. שמלה, עשר, משחק, עם שין.', caption: 'מילים לזכור', visual: { kind: 'list', items: [{ w: 'סוס', e: '🐴', mark: 0 }, { w: 'ספר', e: '📖', mark: 0 }, { w: 'שמלה', e: '👗', mark: 0 }, { w: 'משחק', e: '🎲', mark: 1 }] } },
    ],
  },
  bet_vav: {
    skill: 'bet_vav',
    title: 'ב של בית, ו של ורד',
    emoji: '🌹',
    steps: [
      { say: 'ב בלי דגש ו-ו שתיהן נשמעות ו. איך נבחר?', caption: 'ב או ו?', visual: { kind: 'compare', left: { w: 'ב', e: '🏠' }, right: { w: 'ו', e: '🌹' } } },
      { say: 'בתחילת מילה, ב תמיד נשמעת בּ, כמו בית ובננה! אז אם שומעים ו בתחילת המילה, כמו ורד ווילון, זו ו.', caption: 'שומעים V בהתחלה? ← ו', visual: { kind: 'list', items: [{ w: 'ורד', e: '🌹', mark: 0 }, { w: 'וילון', e: '🪟', mark: 0 }, { w: 'בית', e: '🏠', mark: 0 }] } },
      { say: 'ו באמצע המילה שנשמעת ו, כותבים כפולה! תקווה, אוויר, טווס.', caption: 'V באמצע ← וו', visual: { kind: 'list', items: [{ w: 'טווס', e: '🦚', mark: 1 }, { w: 'תקווה', mark: 2 }, { w: 'אוויר', e: '💨', mark: 1 }] } },
      { say: 'ב היא כמו בית, יש לה רצפה למטה. כלב, לב, זהב, דב. כולן עם ב!', caption: 'ב = בית עם רצפה 🏠', visual: { kind: 'text', big: 'כלב', emoji: '🐕🏠', color: '#ff922b' } },
    ],
  },
  he_alef_end: {
    skill: 'he_alef_end',
    title: 'ה של הסוף',
    emoji: '👧',
    steps: [
      { say: 'בסוף מילה, ה ו-א נשמעות אותו דבר. אבל יש טריק!', caption: 'ה או א בסוף?', visual: { kind: 'compare', left: { w: 'ילדה', e: '👧' }, right: { w: 'אבא', e: '👨' } } },
      { say: 'רוב המילים נגמרות בה! ילדה, מורה, בובה, גלידה. ה היא מלכת הסוף.', caption: 'רוב המילים ← ה 👑', visual: { kind: 'morph', from: 'ילד', to: 'ילדה', emoji: '👦➡️👧' } },
      { say: 'א בסוף יש רק למילים מיוחדות, ונזכור אותן: אבא, אמא, סבא, סבתא, כיסא, רופא.', caption: 'המועדון המיוחד של א', visual: { kind: 'list', items: [{ w: 'אבא', e: '👨', mark: 2 }, { w: 'סבתא', e: '👵', mark: 3 }, { w: 'כיסא', e: '🪑', mark: 3 }, { w: 'רופא', e: '🧑‍⚕️', mark: 3 }] } },
      { say: 'ומשפחת מילים: קרא, קורא, קריאה. הא׳ נשארת בכל המשפחה!', caption: 'משפחה שומרת על האות', visual: { kind: 'family', root: 'קרא', kids: ['קורא', 'קריאה', 'מקרא'] } },
    ],
  },
  finals: {
    skill: 'finals',
    title: 'מנצפ״ך מחליפות בגדים',
    emoji: '🏁',
    steps: [
      { say: 'חמש אותיות מחליפות בגדים כשהן מגיעות לסוף המילה: מ, נ, צ, פ, כ. זוכרים: מנצפך!', caption: 'מנצפ״ך', visual: { kind: 'finals' } },
      { say: 'ן, ץ, ף ו-ך יורדות למטה, כמו רגל ארוכה שנחה בסוף הדרך. ו-ם סוגרת את הדלת!', caption: 'בסוף – יורדות ונסגרות', visual: { kind: 'morph', from: 'מימ', to: 'מים', emoji: '🚪' } },
      { say: 'באמצע המילה אף פעם לא כותבים סופית. בסוף המילה תמיד סופית!', caption: 'אמצע ← רגילה, סוף ← סופית', visual: { kind: 'list', items: [{ w: 'מלך', e: '👑', mark: 2 }, { w: 'מלכים', mark: 2 }, { w: 'עץ', e: '🌳', mark: 1 }, { w: 'עצים', mark: 1 }] } },
    ],
  },
  prefixes: {
    skill: 'prefixes',
    title: 'רכבת האותיות',
    emoji: '🚂',
    steps: [
      { say: 'יש שבע אותיות קטנות שנדבקות למילה: ו, ה, ב, כ, ל, מ, ש. זוכרים: משה וכלב!', caption: 'משה וכלב', visual: { kind: 'text', big: 'משה וכלב', emoji: '👦🐕', color: '#fab005' } },
      { say: 'הן לא עומדות לבד! הן מתחברות כמו קרון לרכבת: ל ועוד בית, זה לבית.', caption: 'מתחברות כמו קרון', visual: { kind: 'train', cars: ['ל'], word: 'בית' } },
      { say: 'אפשר לחבר כמה קרונות: ו, כש, הלכתי. וכשהלכתי!', caption: 'גם כמה קרונות', visual: { kind: 'train', cars: ['ו', 'כש'], word: 'הלכתי' } },
      { say: 'אחרי ב, כ ו-ל, ה הולכת להתחבא: בבית, ולא בהבית.', caption: 'בבית ✅   בהבית ❌', visual: { kind: 'morph', from: 'בהבית', to: 'בבית', emoji: '🙈' } },
    ],
  },
  full_spelling: {
    skill: 'full_spelling',
    title: 'אותיות עזר',
    emoji: '🧩',
    steps: [
      { say: 'כשכותבים בלי ניקוד, מוסיפים אותיות עזר: י ו-ו. הן עוזרות לקרוא.', caption: 'י ו-ו עוזרות', visual: { kind: 'morph', from: 'ספור', to: 'סיפור', emoji: '📖' } },
      { say: 'שומעים אִי באמצע המילה? מוסיפים י. סיפור, ציפור, כיתה.', caption: 'אִי ← י', visual: { kind: 'list', items: [{ w: 'סיפור', e: '📖', mark: 1 }, { w: 'ציפור', e: '🐦', mark: 1 }, { w: 'כיתה', e: '🏫', mark: 1 }] } },
      { say: 'שומעים אוֹ או אוּ? מוסיפים ו. שולחן, חולצה, תמונה.', caption: 'אוֹ / אוּ ← ו', visual: { kind: 'list', items: [{ w: 'שולחן', e: '🪑', mark: 1 }, { w: 'חולצה', e: '👕', mark: 1 }, { w: 'תמונה', e: '🖼️', mark: 2 }] } },
      { say: 'ו או י שנשמעות כמו עיצור באמצע המילה, כותבים כפולות: תקווה, אוויר, עגבנייה.', caption: 'וו ו-יי באמצע', visual: { kind: 'list', items: [{ w: 'תקווה', mark: 2 }, { w: 'אוויר', e: '💨', mark: 1 }, { w: 'עגבנייה', e: '🍅', mark: 4 }] } },
    ],
  },
};

import type { SkillId } from '../types';
import { WORDS, IM_SENTENCES, type WordEntry } from './words.ts';
import { FINAL_TO_REGULAR } from './skills.ts';
import { FAMILIES as ROOT_FAMILIES } from './roots.ts';
import { DETECTIVE_SENTENCES } from './detective.ts';
import { DICTATIONS, SHORT_DICTATIONS } from './stories.ts';

/**
 * Tips library. Every tip is derived from a real spelling rule and the word itself, so it is true
 * by construction (no invented "facts"). Each child sees each tip only once (child.seenTips).
 */
export interface Tip {
  id: string;
  skill: SkillId | 'general';
  /** the word the tip is about, when it is about one word */
  word?: string;
  text: string;
}

const FINAL_NAME: Record<string, string> = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' };

function where(w: string, i: number): string {
  if (i === 0) return 'בהתחלה';
  if (i === w.length - 1) return 'בסוף';
  return 'באמצע';
}

function firstOf(w: string, letters: string): number {
  for (let i = 0; i < w.length; i++) if (letters.includes(w[i])) return i;
  return -1;
}

/** The main rule tip for a word in a topic. */
function ruleTip(skill: SkillId, e: WordEntry): string | null {
  const w = e.w;
  switch (skill) {
    case 'alef_ayin': {
      const i = firstOf(w, 'אע');
      if (i < 0) return null;
      return w[i] === 'ע'
        ? `${w} נכתבת עם ע ${where(w, i)}. אמרו בלב ${w} עם צליל ע עמוק מהגרון, וכך תזכרו שיש כאן ע.`
        : `${w} נכתבת עם א ${where(w, i)}. א היא האות השקטה והרכה – בלי צליל מהגרון.`;
    }
    case 'tet_tav': {
      // suffixes (plural/abstract -ות, past-tense -תי) are always ת; a plain word ending can be ט (תכשיט, פשוט)
      if (w.endsWith('ות') && w.length > 3) return `${w} נגמרת בסיומת -ות, כמו ילדות ומורות. הסיומת הזו נכתבת תמיד עם ת.`;
      if (w.endsWith('תי') && w.length > 3) return `${w} נגמרת ב-תי, כמו כתבתי ואכלתי – מה שאני עשיתי. תמיד עם ת.`;
      const i = firstOf(w, 'טת');
      if (i < 0) return null;
      return w[i] === 'ט' ? `${w} נכתבת עם ט ${where(w, i)} – ט עגולה, כמו טבעת.` : `${w} נכתבת עם ת ${where(w, i)}.`;
    }
    case 'kaf_het_kuf': {
      if (w[0] === 'ח') return `${w} מתחילה בצליל ח. בתחילת מילה כ נשמעת תמיד כמו ק, לכן צליל ח בהתחלה נכתב ב-ח.`;
      if (w[0] === 'כ') return `${w} מתחילה ב-כ. בתחילת מילה כ נשמעת כמו ק – אז צריך לזכור: ${w} עם כ.`;
      if (w.endsWith('ך')) return `${w} נגמרת ב-ך, כ סופית. באמצע המילה היא הייתה כ רגילה.`;
      const i = firstOf(w, 'כחק');
      if (i < 0) return null;
      return `${w} נכתבת עם ${w[i]} ${where(w, i)}.`;
    }
    case 'samekh_sin':
      if (w.includes('ש')) return `במילה ${w} יש ש שנשמעת ס. זו שׂ שמאלית – הנקודה שלה בצד שמאל.`;
      return `${w} נכתבת עם ס ${where(w, w.indexOf('ס'))}, ס עגולה וסגורה.`;
    case 'bet_vav':
      if (w[0] === 'ו') return `${w} מתחילה בצליל v. בתחילת מילה ב נשמעת תמיד b, לכן צליל v בהתחלה נכתב ב-ו.`;
      if (w.includes('וו')) return `במילה ${w} יש צליל v באמצע המילה, והוא נכתב וו כפולה.`;
      if (w.includes('ב')) return `במילה ${w} יש ב ${where(w, w.indexOf('ב'))} שנשמעת v. ב שלא בתחילת המילה נשמעת לפעמים v – צריך לזכור אותה.`;
      return null;
    case 'he_alef_end':
      if (w.endsWith('ה')) return `${w} נגמרת ב-ה, כמו רוב המילים שנגמרות בצליל אָה.`;
      if (w.endsWith('א')) return `${w} נגמרת ב-א. היא מהמילים המיוחדות שנגמרות ב-א, וכדאי לזכור אותה.`;
      return null;
    case 'finals': {
      const last = w[w.length - 1];
      if (!FINAL_TO_REGULAR[last]) return null;
      return `${w} נגמרת ב-${last}, ${FINAL_NAME[last]} סופית, כי זה סוף המילה. באמצע מילה כותבים ${FINAL_TO_REGULAR[last]} רגילה.`;
    }
    case 'prefixes': {
      const split = e.x.find((x) => x.includes(' '));
      if (!split) return null;
      const [pre, base] = split.split(' ');
      return `${w} = ${pre} + ${base}. ${pre} נדבקת למילה ${base}, בלי רווח.`;
    }
    case 'full_spelling': {
      const x = e.x[0];
      if (!x || x.length !== w.length - 1) return null;
      let i = 0;
      while (i < x.length && x[i] === w[i]) i++;
      const added = w[i];
      if ((added === 'ו' || added === 'י') && (w[i - 1] === added || w[i + 1] === added))
        return `במילה ${w} ה-${added} היא עיצור באמצע המילה, ולכן כותבים אותה כפולה: ${w}.`;
      if (added === 'י') return `במילה ${w} שומעים אִי, ולכן מוסיפים י: ${w}, ולא ${x}.`;
      if (added === 'ו') return `במילה ${w} שומעים אוֹ או אוּ, ולכן מוסיפים ו: ${w}, ולא ${x}.`;
      return null;
    }
    default:
      return null;
  }
}

/** "Right letter, not the look-alike" – the plain fact, useful as a second reminder. */
function contrastTip(skill: SkillId, e: WordEntry): string | null {
  const w = e.w;
  const pairs: Partial<Record<SkillId, [string, string][]>> = {
    alef_ayin: [['א', 'ע'], ['ע', 'א']],
    tet_tav: [['ט', 'ת'], ['ת', 'ט']],
    kaf_het_kuf: [['ח', 'כ'], ['כ', 'ח'], ['ק', 'כ']],
    samekh_sin: [['ס', 'שׂ'], ['ש', 'ס']],
    bet_vav: [['ו', 'ב'], ['ב', 'ו']],
  };
  if (skill === 'he_alef_end') return w.endsWith('ה') ? `${w} – ה בסוף, לא א.` : w.endsWith('א') ? `${w} – א בסוף, לא ה.` : null;
  if (skill === 'finals') return /[ךםןףץ]$/.test(w) ? `${w} – בסוף אות סופית, לא אות רגילה.` : null;
  for (const [has, not] of pairs[skill] ?? []) if (w.includes(has[0])) return `${w} – עם ${has}, לא עם ${not}.`;
  return null;
}

/** Group tip: three words from the same topic that share the letter in the same place. */
function groupTips(skill: SkillId, list: WordEntry[]): Tip[] {
  const key = (w: string) => {
    if (skill === 'finals' || skill === 'he_alef_end') return `end:${w[w.length - 1]}`;
    const letters: Partial<Record<SkillId, string>> = { alef_ayin: 'אע', tet_tav: 'טת', kaf_het_kuf: 'כחק', samekh_sin: 'סש', bet_vav: 'בו' };
    const L = letters[skill];
    if (!L) return null;
    const i = firstOf(w, L);
    return i < 0 ? null : `${w[i]}:${where(w, i)}`;
  };
  const groups = new Map<string, WordEntry[]>();
  for (const e of list) {
    const k = key(e.w);
    if (k) groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const out: Tip[] = [];
  for (const [k, g] of groups) {
    if (g.length < 3) continue;
    const [kind, pos] = k.split(':');
    g.forEach((e, n) => {
      const others = [g[(n + 1) % g.length], g[(n + 2) % g.length]].map((x) => x.w);
      const place = kind === 'end' ? `${pos} בסוף` : `${kind} ${pos}`;
      out.push({ id: `${skill}:${e.w}:group`, skill, word: e.w, text: `${e.w}, ${others[0]} ו${others[1]} – בכולן יש ${place}. זכרו אותן ביחד!` });
    });
  }
  return out;
}

/** Why עם / אם in each practice sentence. */
const IM_WHY: Record<string, string> = {
  'עם': 'כאן המילה מחברת בין שני דברים שנמצאים ביחד – לכן עם, בעין.',
  'אם:if': 'כאן יש תנאי: אם זה יקרה, אז יקרה משהו אחר – לכן אם, באלף.',
  'אם:whether': 'כאן אפשר להגיד "האם" – זו שאלה, ולכן אם, באלף.',
};

/** Study strategies that work for every word. */
const GENERAL = [
  'שיטת הצילום: מסתכלים על המילה, אומרים אותה, מכסים, כותבים מהזיכרון – ובודקים.',
  'מילה שטעיתם בה? כתבו אותה שלוש פעמים, ובכל פעם אמרו אותה בקול.',
  'לפני שכותבים מילה קשה, חפשו מילה מאותה משפחה שאתם כבר יודעים לכתוב.',
  'קראו את מה שכתבתם לאט, מילה אחרי מילה. כך מוצאים טעויות לבד.',
  'אותיות שנשמעות אותו דבר – א וע, ט ות, כ וח – צריך לזכור בעיניים, לא באוזניים.',
  'בסוף כל מילה בדקו: האם האות האחרונה היא מ, נ, צ, פ או כ? אם כן, היא צריכה להיות סופית.',
  'אותיות ו, ה, ב, כ, ל, מ, ש בתחילת מילה נדבקות אליה – אף פעם לא עומדות לבד.',
  'בלי ניקוד מוסיפים אותיות עזר: י כששומעים אִי, ו כששומעים אוֹ או אוּ.',
  'מילה שחוזרת הרבה בטעות – כתבו אותה על פתק ותדביקו במקום שרואים כל יום.',
  'כשמתלבטים בין שתי אותיות, כתבו את המילה בשתי הדרכים – בדרך כלל העין מזהה מה נכון.',
  'חמש דקות תרגול בכל יום עוזרות יותר משעה פעם בשבוע.',
  'מילים שטעיתם בהן חוזרות אליכם אחרי יום, אחרי שלושה ימים ואחרי שבוע – כך הן נשארות בזיכרון.',
];

/**
 * Word families: words built on the same root keep the root letters. Knowing one member tells you
 * how to write the others – a strategy children can use on words they never practised.
 */
const FAMILIES: { root: string; letters: string; words: string[] }[] = [
  { root: 'כ-ת-ב', letters: 'כ ו-ת', words: ['כתב', 'מכתב', 'לכתוב', 'כתבתי'] },
  { root: 'ח-ש-ב', letters: 'ח', words: ['מחשב', 'חשבון', 'מחשבה', 'מחשבון'] },
  { root: 'ש-מ-ח', letters: 'ש שמאלית ו-ח', words: ['שמח', 'שמחה', 'בשמחה'] },
  { root: 'ש-ח-ק', letters: 'ש שמאלית, ח ו-ק', words: ['משחק', 'שיחק'] },
  { root: 'ס-פ-ר', letters: 'ס', words: ['ספר', 'סיפור', 'סיפרה'] },
  { root: 'ד-ב-ר', letters: 'ב', words: ['דיבר', 'דיברנו'] },
  { root: 'ט-ב-ע', letters: 'ט ו-ע', words: ['טבעת', 'טבעי', 'מטבע', 'טבע'] },
  { root: 'א-מ-ץ', letters: 'א', words: ['אמיץ', 'מאמץ'] },
  { root: 'ח-ב-ר', letters: 'ח ו-ב', words: ['חבר', 'לחבר', 'מחברת'] },
  { root: 'ע-ב-ד', letters: 'ע ו-ב', words: ['עבודה', 'עובדה'] },
  { root: 'ק-ר-א', letters: 'ק ו-א', words: ['קרא', 'קריאה'] },
  { root: 'י-צ-א', letters: 'צ ו-א', words: ['יצא', 'תוצאה', 'יצאתי'] },
  { root: 'ש-א-ל', letters: 'א', words: ['שאלה', 'שאלתי'] },
  { root: 'ע-ג-ל', letters: 'ע', words: ['עגול', 'עגלה'] },
];

function familyTips(): Tip[] {
  const out: Tip[] = [];
  // the roots topic's families: the root letters stay in every member
  const fromRoots = ROOT_FAMILIES.map((f) => ({ root: [...f.root].join('-'), letters: [...f.root].map((ch) => REGULAR_TO_FINAL_NAME[ch] ?? ch).join(', ').replace(/, ([^,]+)$/, ' ו-$1'), words: f.words }));
  for (const f of [...FAMILIES, ...fromRoots]) {
    if (f.words.length < 2) continue;
    for (const w of f.words) {
      const others = f.words.filter((x) => x !== w);
      const text = `${w} שייכת למשפחה של ${others.join(', ')}. למילים מאותה משפחה יש אותן אותיות שורש, ${f.root.split('-').join(', ')}, ולכן בכולן כותבים ${f.letters}.`;
      for (const [skill, list] of Object.entries(WORDS) as [SkillId, WordEntry[]][])
        if (list.some((e) => e.w === w)) out.push({ id: `${skill}:${w}:family`, skill, word: w, text });
    }
  }
  return out;
}

/** the letters as written in the root (regular forms), for "בכולן כותבים כ, ת ו-ב" */
const REGULAR_TO_FINAL_NAME: Record<string, string> = {};

const COUNT = ['', 'אות אחת', 'שתי אותיות', 'שלוש אותיות', 'ארבע אותיות', 'חמש אותיות', 'שש אותיות', 'שבע אותיות', 'שמונה אותיות', 'תשע אותיות', 'עשר אותיות'];
const ORDINAL = ['הראשונה', 'השנייה', 'השלישית', 'הרביעית', 'החמישית', 'השישית', 'השביעית', 'השמינית', 'התשיעית', 'העשירית'];
/** the letters a topic is about, to point at the one to remember */
const FOCUS: Partial<Record<SkillId, string>> = { alef_ayin: 'אע', tet_tav: 'טת', kaf_het_kuf: 'כחקך', samekh_sin: 'סש', bet_vav: 'בו' };

/**
 * Spelling aloud, letter by letter – the way children learn a word by heart. The voice reads the
 * single letters by their names. Points at the letter the topic is about.
 */
function spellTip(skill: SkillId, e: WordEntry): string | null {
  const w = e.w;
  const letters = [...w];
  if (letters.length < 2 || letters.length > 10 || !/^[א-ת]+$/.test(w)) return null;
  let focus = '';
  const set = FOCUS[skill];
  const i = set ? letters.findIndex((ch) => set.includes(ch)) : skill === 'he_alef_end' || skill === 'finals' ? letters.length - 1 : -1;
  if (i >= 0) focus = i === letters.length - 1 ? ` והאחרונה היא ${letters[i]}.` : ` והאות ${ORDINAL[i]} היא ${letters[i]}.`;
  return `מאייתים ${w}: ${letters.join(', ')}. ${COUNT[letters.length]}${focus ? `,${focus}` : '.'}`;
}

/** Teaching tips written by hand for each topic – rules, mnemonics and ways to check yourself. */
const TOPIC_TIPS: Partial<Record<SkillId, string[]>> = {
  alef_ayin: [
    'כשמתלבטים בין א ל-ע, חפשו מילה מאותה משפחה: עבודה ועובד, שתיהן עם ע.',
    'גם אוטו וגם עוגה מתחילות בצליל אוֹ, אבל אוטו עם א ועוגה עם ע. את זה זוכרים בעין, לא באוזן.',
    'מילים שקשורות לעין ולראייה נכתבות עם ע: עין, עיניים, עפעף.',
    'המספרים ארבע, שבע ותשע נגמרים כולם ב-ע.',
    'אמא ואבא נכתבות עם א בהתחלה ובסוף.',
    'שאלה, שאלתי ושואל הן מאותה משפחה, ובכולן יש א באמצע.',
    'שבוע, אצבע, צבע ומדע נגמרות כולן ב-ע. שימו לב לסוף המילה!',
    'אמת, אמיץ ואמצע מתחילות ב-א. עמוד ועמק מתחילות ב-ע. כדאי לזכור כל מילה ביחד עם מילה מהמשפחה שלה.',
  ],
  tet_tav: [
    'ת היא האות של הסיומות: ילדות, מורות, כתבתי ואכלתי. בכולן ת בסוף.',
    'מחברת, טבעת ודלת: הרבה שמות של חפצים נגמרים ב-ת.',
    'ט עגולה כמו טבעת, ו-ת עומדת על שתי רגליים. תגידו בלב: טבעת עם ט, תות עם ת.',
    'אני כתבתי, אני אכלתי, אני שיחקתי: כשאני עשיתי משהו, הסוף הוא תי, עם ת.',
    'כשמתלבטים, חפשו את המשפחה: טיול, מטייל ולטייל. בכולן ט.',
    'תות ותפוח מתחילים ב-ת, וטעים מתחיל ב-ט.',
    'מילים ברבים שנגמרות ב-ות, כמו מכוניות וחנויות, נגמרות תמיד ב-ת.',
    'תלמיד, תשובה ותמונה מתחילות ב-ת. טלפון, טיול וטבע מתחילות ב-ט. כדאי לזכור אותן בזוגות.',
  ],
  kaf_het_kuf: [
    'בתחילת מילה כ נשמעת כמו ק, ולכן קשה להבדיל: כלב עם כ, קוף עם ק. את זה זוכרים בעין.',
    'באמצע או בסוף מילה כ יכולה להישמע כמו ח: מכתב, מלך. לכן צליל ח יכול להיות ח או כ.',
    'ך סופית נשמעת כמו ח: מלך, דרך, ארוך.',
    'חשבון, מחשב ומחשבה הן משפחה אחת, ובכולן ח.',
    'במילה כתב שומעים ק בהתחלה, אבל כותבים כ. ולכן גם מכתב, מאותה משפחה, עם כ.',
    'ל-ק יש רגל ארוכה שיורדת מתחת לשורה, ול-כ אין.',
    'חם, חג וחלב: צליל ח בתחילת מילה נכתב ב-ח, כי בהתחלה כ נשמעת כמו ק.',
    'ירוק נגמר ב-ק, ומלך נגמר ב-ך. אם בסוף המילה שומעים ק, כותבים ק.',
  ],
  samekh_sin: [
    'ל-ש שמאלית יש נקודה בצד שמאל, והיא נשמעת כמו ס. בלי ניקוד צריך לזכור את המילה.',
    'שמח, שמחה ומשמח: כל המשפחה עם ש, למרות שהיא נשמעת כמו ס.',
    'משחק, שיחק ושחקן: כולן עם ש שמאלית.',
    'מילים שבאו משפות אחרות עם צליל ס נכתבות כמעט תמיד עם ס: אוטובוס, סוודר, סלט.',
    'עשר, עשרים ועשייה נכתבות עם ש שמאלית.',
    'ס היא אות סגורה ועגולה, ול-ש יש שלוש ידיים למעלה.',
    'סבא וסבתא, סבון וסל נכתבות עם ס. כדאי לזכור אותן בעל פה.',
    'בדקו את המשפחה: ספר, סיפור וספרייה. כולן עם ס.',
  ],
  bet_vav: [
    'ב בלי נקודה באמצע נשמעת כמו ו. לכן בסוף המילה זאב שומעים ו, אבל כותבים ב.',
    'בתחילת מילה עברית, צליל ב נכתב ב-ב: בית, בובה, בננה.',
    'ורד, וילון וופל מתחילות בצליל ו ונכתבות ב-ו.',
    'כתב, מכתב וכתובת הן משפחה עם ב, גם כשהיא נשמעת כמו ו.',
    'ו כפולה באמצע מילה נשמעת ו: תקווה, שווה, טווס.',
    'כלב, לב, ערב וחלב: הרבה מילים נגמרות בצליל ו שנכתב ב-ב.',
    'שבוע ושבועות, עבודה ועובד: המשפחה שומרת על ה-ב.',
    'דבש ודבורה הן מאותה משפחה, ובשתיהן כותבים ב.',
  ],
  he_alef_end: [
    'הרבה מילים בנקבה נגמרות ב-ה: ילדה, בובה, מורה.',
    'מילים שהשורש שלהן נגמר ב-א שומרות על ה-א: קרא, קורא, קריאה.',
    'יצא ומצא נגמרות ב-א, כי ה-א היא חלק מהשורש: יצא ויציאה, מצא ומציאה.',
    'אבא, אמא, סבא וסבתא נגמרות ב-א. אלו מילים שזוכרים בעל פה.',
    'כשהמילה נגמרת בצליל אֶה, כמו שדה ומורה, בדרך כלל כותבים ה.',
    'רופא נגמר ב-א, כמו רפואה. השורש: ר, פ, א.',
    'כיסא, פלא ובריא הן מילים שזוכרים עם א בסוף.',
    'שמחה, עוגה וגלידה: הרבה מילים בנקבה עם ה בסוף.',
  ],
  finals: [
    'חמש אותיות משנות צורה בסוף מילה: מ, נ, צ, פ, כ הופכות ל-ם, ן, ץ, ף, ך.',
    'אות סופית באה רק בסוף המילה. כשמוסיפים סוף למילה, היא חוזרת להיות רגילה: מלך, מלכה.',
    'ברבים האות הסופית נעלמת: עץ ועצים, כף וכפות, שולחן ושולחנות.',
    'ם סגורה מכל הצדדים, כמו קופסה. מ רגילה פתוחה קצת למטה.',
    'ן, ץ, ף ו-ך יורדות מתחת לשורה. ם לא יורדת, היא רק נסגרת.',
    'כל מילה שנגמרת ב-ים, כמו ילדים ופרחים, נגמרת ב-ם סופית.',
    'גם בשמות של אנשים ומקומות יש אותיות סופיות: אברהם, ירדן.',
    'בתחילת מילה ובאמצע שלה אין אף פעם אות סופית.',
  ],
  prefixes: [
    'ו, ה, ב, כ, ל, מ, ש הן אותיות שנדבקות לתחילת המילה, ולא כותבים רווח אחריהן.',
    'בבית: ב נדבקת לבית. לבית: ל נדבקת. מהבית: מ ו-ה נדבקות ביחד.',
    'אפשר להדביק כמה אותיות: וכשהלכתי זה ו, כש והלכתי.',
    'אחרי ב, ל או כ, ה של הידיעה נעלמת: לבית, ולא להבית.',
    'אחרי מ, ה של הידיעה נשארת: מהבית, מהגן.',
    'ש בהתחלה נדבקת למילה: הילד שאני אוהב. שאני כתוב צמוד.',
    'ו החיבור נדבקת תמיד: אבא ואמא, בלי רווח אחרי ה-ו.',
    'כשמחפשים מילה במילון, מורידים קודם את האותיות שנדבקו: בגינה, גינה.',
  ],
  im_im: [
    'עם עם ע, כשאפשר להגיד ביחד: אני משחק עם חבר.',
    'אם עם א, כשיש תנאי: אם ירד גשם, נישאר בבית.',
    'אם עם א גם בשאלה: אני לא יודע אם הוא יבוא.',
    'עם עם ע היא גם אומה: עם ישראל.',
    'נסו להוסיף את המילה ביחד: אכלתי ביחד עם אבא. הגיוני? אז עם בעין.',
    'אם אפשר להחליף במקרה ש, כותבים אם באלף: אם תבוא, במקרה שתבוא.',
    'אמא ואבא מתחילות ב-א, כמו אם. ובמילים גבוהות, אם היא גם אמא.',
    'כתבו את המשפט, קראו אותו, ושאלו: ביחד או תנאי? ביחד זה עם, תנאי זה אם.',
  ],
  full_spelling: [
    'בלי ניקוד מוסיפים ו כששומעים אוֹ או אוּ: שולחן, כדור.',
    'בלי ניקוד מוסיפים י כששומעים אִי: סיפור, מילה.',
    'ו בתחילת מילה, כמו ורד, היא עיצור. ו באמצע, כמו שולחן, היא תנועה.',
    'ו כפולה כשהיא עיצור באמצע מילה: תקווה, מצווה, אוויר.',
    'י כפולה כשהיא עיצור באמצע מילה: עגבנייה, מטרייה, עוגייה.',
    'במילים מנוקדות לא צריך את ה-ו וה-י הנוספות, אבל בכתיבה רגילה מוסיפים אותן.',
    'קיבלתי, דיברנו, סיפרה: בפעלים כאלה מוסיפים י אחרי האות הראשונה.',
    'שמיים ואופניים נכתבות עם שתי י.',
  ],
  roots: [
    'השורש הוא שלוש אותיות שחוזרות בכל המשפחה: כ, ת, ב בכתב, מכתב וכתיבה.',
    'כדי למצוא שורש, מורידים אותיות שנוספו בהתחלה ובסוף: מכתבים, מורידים מ ו-ים, ונשאר כתב.',
    'אותיות השורש לא משתנות במשפחה, ולכן הן עוזרות לכתוב נכון.',
    'צבע, צבעוני וצובע: ה-ע בסוף השורש נשארת בכל המילים.',
    'תלמיד ולומדים הן מאותו שורש: ל, מ, ד. ה-ת בתלמיד היא תוספת.',
    'מחשב ומחשבה: ה-מ בהתחלה היא תוספת, והשורש הוא ח, ש, ב.',
    'כשאות סופית נמצאת בשורש, היא חוזרת להיות רגילה במילים אחרות: מלך ומלכה, השורש מ, ל, כ.',
    'רכבת, רוכב ולרכוב: כולן מהשורש ר, כ, ב.',
  ],
};

/** A word seen in a real sentence: reading it in context helps remember its spelling. */
function sentenceTips(): Tip[] {
  const sentences = [...DETECTIVE_SENTENCES.map((d) => d.s), ...[...SHORT_DICTATIONS, ...DICTATIONS].flatMap((d) => d.sentences)];
  const out: Tip[] = [];
  for (const [skill, list] of Object.entries(WORDS) as [SkillId, WordEntry[]][])
    for (const e of list) {
      const s = sentences.find((x) => x.replace(/[.,!?:"]/g, '').split(' ').includes(e.w));
      if (s) out.push({ id: `${skill}:${e.w}:sentence`, skill, word: e.w, text: `קראו את המשפט ושימו לב למילה ${e.w}: ${s}` });
    }
  return out;
}

let cache: Tip[] | null = null;

export function allTips(): Tip[] {
  if (cache) return cache;
  const out: Tip[] = [];
  for (const [skill, list] of Object.entries(WORDS) as [SkillId, WordEntry[]][]) {
    for (const e of list) {
      const r = ruleTip(skill, e);
      if (r) out.push({ id: `${skill}:${e.w}:rule`, skill, word: e.w, text: r });
      const sp = spellTip(skill, e);
      if (sp) out.push({ id: `${skill}:${e.w}:spell`, skill, word: e.w, text: sp });
      const c = contrastTip(skill, e);
      if (c) out.push({ id: `${skill}:${e.w}:contrast`, skill, word: e.w, text: c });
    }
    out.push(...groupTips(skill, list));
  }
  for (const s of IM_SENTENCES) {
    const full = s.s.replace('___', s.a);
    const why = s.a === 'עם' ? IM_WHY['עם'] : IM_WHY[/(שאלתי|יודע|ידעתי|בדקתי|שאלה|מושג)/.test(s.s) ? 'אם:whether' : 'אם:if'];
    out.push({ id: `im_im:${full}`, skill: 'im_im', word: s.a, text: `${full}. ${why}` });
  }
  out.push(...familyTips());
  out.push(...sentenceTips());
  for (const [skill, list] of Object.entries(TOPIC_TIPS) as [SkillId, string[]][]) list.forEach((t, i) => out.push({ id: `${skill}:topic:${i}`, skill, text: t }));
  GENERAL.forEach((t, i) => out.push({ id: `general:${i}`, skill: 'general', text: t }));
  // one tip per id (a word can appear in several topics)
  const seen = new Set<string>();
  cache = out.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  return cache;
}

/** Next tip the child has not heard yet: first about this word, then this topic, then general. */
export function nextTip(seen: string[], skill: SkillId, word?: string): Tip | null {
  const s = new Set(seen);
  const tips = allTips().filter((t) => !s.has(t.id));
  const order = ['rule', 'family', 'spell', 'sentence', 'contrast', 'group'];
  if (word) {
    const forWord = tips.filter((t) => t.skill === skill && t.word === word).sort((a, b) => order.indexOf(a.id.split(':').pop()!) - order.indexOf(b.id.split(':').pop()!));
    if (forWord.length) return forWord[0];
  }
  return tips.find((t) => t.skill === skill) ?? tips.find((t) => t.skill === 'general') ?? null;
}

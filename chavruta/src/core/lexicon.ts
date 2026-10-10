// Names, spoken variants and abbreviations used by the command parser, the
// speech layer and the explanation context. Display text is never rewritten
// with these tables: they only help recognize what was said and how to say it.

export interface Tractate {
  /** Sefaria title of the Bavli tractate (null when the tractate has Mishnah only). */
  bavli: string | null;
  /** Sefaria title of the Mishnah tractate. */
  mishnah: string;
  he: string;
  /** Last daf in the Vilna Shas (for validating requests). */
  lastDaf?: number;
  /** Spellings and pronunciations people (and speech recognizers) produce. */
  variants: string[];
}

export const TRACTATES: Tractate[] = [
  { bavli: 'Berakhot', mishnah: 'Mishnah Berakhot', he: 'ברכות', lastDaf: 64, variants: ['ברוכות', 'ברוכוס', 'בראכות', 'ברכוס'] },
  { bavli: null, mishnah: 'Mishnah Peah', he: 'פאה', variants: ['פיאה'] },
  { bavli: null, mishnah: 'Mishnah Demai', he: 'דמאי', variants: [] },
  { bavli: null, mishnah: 'Mishnah Kilayim', he: 'כלאים', variants: ['כלאיים'] },
  { bavli: null, mishnah: 'Mishnah Sheviit', he: 'שביעית', variants: ['שביעיס'] },
  { bavli: null, mishnah: 'Mishnah Terumot', he: 'תרומות', variants: ['תרומוס'] },
  { bavli: null, mishnah: 'Mishnah Maasrot', he: 'מעשרות', variants: ['מעשרוס'] },
  { bavli: null, mishnah: 'Mishnah Maaser Sheni', he: 'מעשר שני', variants: [] },
  { bavli: null, mishnah: 'Mishnah Challah', he: 'חלה', variants: [] },
  { bavli: null, mishnah: 'Mishnah Orlah', he: 'ערלה', variants: [] },
  { bavli: null, mishnah: 'Mishnah Bikkurim', he: 'ביכורים', variants: ['בכורים'] },
  { bavli: 'Shabbat', mishnah: 'Mishnah Shabbat', he: 'שבת', lastDaf: 157, variants: ['שאבעס', 'שבעס', 'שבס'] },
  { bavli: 'Eruvin', mishnah: 'Mishnah Eruvin', he: 'עירובין', lastDaf: 105, variants: ['ערובין', 'עירובים'] },
  { bavli: 'Pesachim', mishnah: 'Mishnah Pesachim', he: 'פסחים', lastDaf: 121, variants: ['פסוחים', 'פסחים'] },
  { bavli: null, mishnah: 'Mishnah Shekalim', he: 'שקלים', variants: [] },
  { bavli: 'Yoma', mishnah: 'Mishnah Yoma', he: 'יומא', lastDaf: 88, variants: ['יומה'] },
  { bavli: 'Sukkah', mishnah: 'Mishnah Sukkah', he: 'סוכה', lastDaf: 56, variants: ['סוכא', 'סוקה'] },
  { bavli: 'Beitzah', mishnah: 'Mishnah Beitzah', he: 'ביצה', lastDaf: 40, variants: ['ביצא', 'בייצה'] },
  { bavli: 'Rosh Hashanah', mishnah: 'Mishnah Rosh Hashanah', he: 'ראש השנה', lastDaf: 35, variants: ['ראש השנא', 'רוש השנה'] },
  { bavli: 'Taanit', mishnah: "Mishnah Ta'anit", he: 'תענית', lastDaf: 31, variants: ['תעניס', 'תאנית'] },
  { bavli: 'Megillah', mishnah: 'Mishnah Megillah', he: 'מגילה', lastDaf: 32, variants: ['מגלה', 'מגילא'] },
  { bavli: 'Moed Katan', mishnah: 'Mishnah Moed Katan', he: 'מועד קטן', lastDaf: 29, variants: ['מועד קאטן'] },
  { bavli: 'Chagigah', mishnah: 'Mishnah Chagigah', he: 'חגיגה', lastDaf: 27, variants: ['חגיגא'] },
  { bavli: 'Yevamot', mishnah: 'Mishnah Yevamot', he: 'יבמות', lastDaf: 122, variants: ['יבמוס', 'יבומוס'] },
  { bavli: 'Ketubot', mishnah: 'Mishnah Ketubot', he: 'כתובות', lastDaf: 112, variants: ['כתובוס', 'כסובוס', 'כתובת'] },
  { bavli: 'Nedarim', mishnah: 'Mishnah Nedarim', he: 'נדרים', lastDaf: 91, variants: [] },
  { bavli: 'Nazir', mishnah: 'Mishnah Nazir', he: 'נזיר', lastDaf: 66, variants: [] },
  { bavli: 'Sotah', mishnah: 'Mishnah Sotah', he: 'סוטה', lastDaf: 49, variants: ['סוטא'] },
  { bavli: 'Gittin', mishnah: 'Mishnah Gittin', he: 'גיטין', lastDaf: 90, variants: ['גטין'] },
  { bavli: 'Kiddushin', mishnah: 'Mishnah Kiddushin', he: 'קידושין', lastDaf: 82, variants: ['קדושין', 'קידושים'] },
  { bavli: 'Bava Kamma', mishnah: 'Mishnah Bava Kamma', he: 'בבא קמא', lastDaf: 119, variants: ['באבא קמא', 'בבא קאמא', 'בבא קמה', 'ב"ק', 'ב״ק'] },
  { bavli: 'Bava Metzia', mishnah: 'Mishnah Bava Metzia', he: 'בבא מציעא', lastDaf: 119, variants: ['באבא מציעא', 'בבא מציעה', 'בבא מציאה', 'ב"מ', 'ב״מ'] },
  { bavli: 'Bava Batra', mishnah: 'Mishnah Bava Batra', he: 'בבא בתרא', lastDaf: 176, variants: ['באבא בסרא', 'בבא בסרא', 'בבא בתרה', 'ב"ב', 'ב״ב'] },
  { bavli: 'Sanhedrin', mishnah: 'Mishnah Sanhedrin', he: 'סנהדרין', lastDaf: 113, variants: ['סנהדרים'] },
  { bavli: 'Makkot', mishnah: 'Mishnah Makkot', he: 'מכות', lastDaf: 24, variants: ['מכוס', 'מאכות'] },
  { bavli: 'Shevuot', mishnah: 'Mishnah Shevuot', he: 'שבועות', lastDaf: 49, variants: ['שבועוס'] },
  { bavli: null, mishnah: 'Mishnah Eduyot', he: 'עדויות', variants: ['עדיות', 'עדויוס'] },
  { bavli: 'Avodah Zarah', mishnah: 'Mishnah Avodah Zarah', he: 'עבודה זרה', lastDaf: 76, variants: ['עבודא זרה', 'ע"ז', 'ע״ז', 'עבודה זרא'] },
  { bavli: null, mishnah: 'Pirkei Avot', he: 'אבות', variants: ['פרקי אבות'] },
  { bavli: 'Horayot', mishnah: 'Mishnah Horayot', he: 'הוריות', lastDaf: 14, variants: ['הורייס', 'הוריוס'] },
  { bavli: 'Zevachim', mishnah: 'Mishnah Zevachim', he: 'זבחים', lastDaf: 120, variants: [] },
  { bavli: 'Menachot', mishnah: 'Mishnah Menachot', he: 'מנחות', lastDaf: 110, variants: ['מנחוס'] },
  { bavli: 'Chullin', mishnah: 'Mishnah Chullin', he: 'חולין', lastDaf: 142, variants: ['חולים', 'חלין'] },
  { bavli: 'Bekhorot', mishnah: 'Mishnah Bekhorot', he: 'בכורות', lastDaf: 61, variants: ['בכורוס', 'בכורת'] },
  { bavli: 'Arakhin', mishnah: 'Mishnah Arakhin', he: 'ערכין', lastDaf: 34, variants: ['ערכים'] },
  { bavli: 'Temurah', mishnah: 'Mishnah Temurah', he: 'תמורה', lastDaf: 34, variants: ['תמורא'] },
  { bavli: 'Keritot', mishnah: 'Mishnah Keritot', he: 'כריתות', lastDaf: 28, variants: ['כריסוס', 'כריתוס'] },
  { bavli: 'Meilah', mishnah: 'Mishnah Meilah', he: 'מעילה', lastDaf: 22, variants: ['מעילא'] },
  { bavli: 'Tamid', mishnah: 'Mishnah Tamid', he: 'תמיד', lastDaf: 33, variants: [] },
  { bavli: null, mishnah: 'Mishnah Middot', he: 'מידות', variants: ['מדות'] },
  { bavli: null, mishnah: 'Mishnah Kinnim', he: 'קינים', variants: ['קנים'] },
  { bavli: null, mishnah: 'Mishnah Kelim', he: 'כלים', variants: [] },
  { bavli: null, mishnah: 'Mishnah Oholot', he: 'אהלות', variants: ['אוהלות'] },
  { bavli: null, mishnah: 'Mishnah Negaim', he: 'נגעים', variants: [] },
  { bavli: null, mishnah: 'Mishnah Parah', he: 'פרה', variants: [] },
  { bavli: null, mishnah: 'Mishnah Tahorot', he: 'טהרות', variants: ['טהורות'] },
  { bavli: null, mishnah: 'Mishnah Mikvaot', he: 'מקואות', variants: ['מקוואות'] },
  { bavli: 'Niddah', mishnah: 'Mishnah Niddah', he: 'נדה', lastDaf: 73, variants: ['נידה'] },
  { bavli: null, mishnah: 'Mishnah Makhshirin', he: 'מכשירין', variants: [] },
  { bavli: null, mishnah: 'Mishnah Zavim', he: 'זבים', variants: [] },
  { bavli: null, mishnah: 'Mishnah Tevul Yom', he: 'טבול יום', variants: [] },
  { bavli: null, mishnah: 'Mishnah Yadayim', he: 'ידיים', variants: ['ידים'] },
  { bavli: null, mishnah: 'Mishnah Oktzin', he: 'עוקצין', variants: ['עוקצים'] },
];

export interface TanakhBook {
  sefaria: string;
  he: string;
  variants: string[];
  torah?: boolean;
}

export const TANAKH: TanakhBook[] = [
  { sefaria: 'Genesis', he: 'בראשית', variants: [], torah: true },
  { sefaria: 'Exodus', he: 'שמות', variants: [], torah: true },
  { sefaria: 'Leviticus', he: 'ויקרא', variants: [], torah: true },
  { sefaria: 'Numbers', he: 'במדבר', variants: ['במידבר'], torah: true },
  { sefaria: 'Deuteronomy', he: 'דברים', variants: [], torah: true },
  { sefaria: 'Joshua', he: 'יהושע', variants: [] },
  { sefaria: 'Judges', he: 'שופטים', variants: [] },
  { sefaria: 'I Samuel', he: 'שמואל א', variants: ['שמואל אלף'] },
  { sefaria: 'II Samuel', he: 'שמואל ב', variants: ['שמואל בית'] },
  { sefaria: 'I Kings', he: 'מלכים א', variants: ['מלכים אלף'] },
  { sefaria: 'II Kings', he: 'מלכים ב', variants: ['מלכים בית'] },
  { sefaria: 'Isaiah', he: 'ישעיהו', variants: ['ישעיה'] },
  { sefaria: 'Jeremiah', he: 'ירמיהו', variants: ['ירמיה'] },
  { sefaria: 'Ezekiel', he: 'יחזקאל', variants: [] },
  { sefaria: 'Hosea', he: 'הושע', variants: [] },
  { sefaria: 'Joel', he: 'יואל', variants: [] },
  { sefaria: 'Amos', he: 'עמוס', variants: [] },
  { sefaria: 'Obadiah', he: 'עובדיה', variants: [] },
  { sefaria: 'Jonah', he: 'יונה', variants: [] },
  { sefaria: 'Micah', he: 'מיכה', variants: [] },
  { sefaria: 'Nahum', he: 'נחום', variants: [] },
  { sefaria: 'Habakkuk', he: 'חבקוק', variants: [] },
  { sefaria: 'Zephaniah', he: 'צפניה', variants: [] },
  { sefaria: 'Haggai', he: 'חגי', variants: [] },
  { sefaria: 'Zechariah', he: 'זכריה', variants: [] },
  { sefaria: 'Malachi', he: 'מלאכי', variants: [] },
  { sefaria: 'Psalms', he: 'תהילים', variants: ['תהלים'] },
  { sefaria: 'Proverbs', he: 'משלי', variants: [] },
  { sefaria: 'Job', he: 'איוב', variants: [] },
  { sefaria: 'Song of Songs', he: 'שיר השירים', variants: [] },
  { sefaria: 'Ruth', he: 'רות', variants: [] },
  { sefaria: 'Lamentations', he: 'איכה', variants: [] },
  { sefaria: 'Ecclesiastes', he: 'קהלת', variants: [] },
  { sefaria: 'Esther', he: 'אסתר', variants: [] },
  { sefaria: 'Daniel', he: 'דניאל', variants: [] },
  { sefaria: 'Ezra', he: 'עזרא', variants: [] },
  { sefaria: 'Nehemiah', he: 'נחמיה', variants: [] },
  { sefaria: 'I Chronicles', he: 'דברי הימים א', variants: ['דברי הימים אלף'] },
  { sefaria: 'II Chronicles', he: 'דברי הימים ב', variants: ['דברי הימים בית'] },
];

export type TextKind = 'talmud' | 'mishnah' | 'tanakh' | 'other';

export interface Commentator {
  /** Sefaria collective name: the commentary index is `${id} on ${book}`. */
  id: string;
  he: string;
  /** Which kinds of text this commentator is offered on by default. */
  on: TextKind[];
  variants: string[];
}

export const COMMENTATORS: Commentator[] = [
  { id: 'Rashi', he: 'רש״י', on: ['talmud', 'tanakh'], variants: ['רשי', 'רש"י', "רש'י", 'ראשי', 'רש י', 'רש״י'] },
  { id: 'Tosafot', he: 'תוספות', on: ['talmud'], variants: ['תוספות', 'תוס', "תוס'", 'תוספת', 'התוספות'] },
  { id: 'Bartenura', he: 'ברטנורא', on: ['mishnah'], variants: ['ברטנורא', 'ברטנורה', 'הברטנורא', 'רע"ב', 'רע״ב', 'ברטנורו'] },
  { id: 'Rambam', he: 'פירוש המשנה לרמב״ם', on: ['mishnah'], variants: ['רמבם', 'רמב"ם', 'רמב״ם', 'הרמבם', 'הרמב"ם', 'הרמב״ם', 'רמבאם'] },
  { id: 'Tosafot Yom Tov', he: 'תוספות יום טוב', on: ['mishnah'], variants: ['תוספות יום טוב', 'תוי"ט', 'תוי״ט', 'תויט'] },
  { id: 'Ramban', he: 'רמב״ן', on: ['tanakh'], variants: ['רמבן', 'רמב"ן', 'רמב״ן', 'הרמבן', 'הרמב"ן', 'הרמב״ן'] },
  { id: 'Ibn Ezra', he: 'אבן עזרא', on: ['tanakh'], variants: ['אבן עזרא', 'ראב"ע', 'ראב״ע', 'האבן עזרא', 'אבנעזרא'] },
  { id: 'Sforno', he: 'ספורנו', on: ['tanakh'], variants: ['ספורנו', 'הספורנו', 'ספורנא'] },
];

/** "Rashi" + "Berakhot" → "Rashi on Berakhot"; Rambam's Mishnah commentary keeps the "Mishnah X" book name. */
export const commentaryIndex = (commentator: string, book: string) => `${commentator} on ${book}`;

export interface Abbreviation {
  abbr: string;
  /** Candidate expansions. The first one found spelled out in the surrounding text wins; otherwise the first with a matching context. */
  options: { text: string; context?: 'talmud' | 'rishonim' | 'any' }[];
}

// Common ראשי תיבות in Gemara, Rashi and Tosafot. Ambiguous ones are resolved by
// looking for the full name in the passage being studied (see expandAbbreviation).
export const ABBREVIATIONS: Abbreviation[] = [
  { abbr: 'ר"י', options: [{ text: 'רבי יהודה', context: 'talmud' }, { text: 'רבינו יצחק', context: 'rishonim' }, { text: 'רבי יוחנן', context: 'talmud' }] },
  { abbr: 'ר"ת', options: [{ text: 'רבינו תם' }] },
  { abbr: 'ר"א', options: [{ text: 'רבי אליעזר' }, { text: 'רבי אלעזר' }] },
  { abbr: 'ר"ג', options: [{ text: 'רבן גמליאל' }] },
  { abbr: 'ר"ע', options: [{ text: 'רבי עקיבא' }] },
  { abbr: 'ר"מ', options: [{ text: 'רבי מאיר' }] },
  { abbr: 'ר"ש', options: [{ text: 'רבי שמעון' }] },
  { abbr: 'ר"נ', options: [{ text: 'רב נחמן' }] },
  { abbr: 'ר"פ', options: [{ text: 'רב פפא' }] },
  { abbr: 'רשב"ג', options: [{ text: 'רבן שמעון בן גמליאל' }] },
  { abbr: 'ריב"ל', options: [{ text: 'רבי יהושע בן לוי' }] },
  { abbr: 'רשב"י', options: [{ text: 'רבי שמעון בר יוחאי' }] },
  { abbr: 'א"ר', options: [{ text: 'אמר רבי' }, { text: 'אמר רב' }] },
  { abbr: 'ת"ר', options: [{ text: 'תנו רבנן' }] },
  { abbr: 'ת"ש', options: [{ text: 'תא שמע' }] },
  { abbr: 'מ"ט', options: [{ text: 'מאי טעמא' }] },
  { abbr: 'מנה"מ', options: [{ text: 'מנא הני מילי' }] },
  { abbr: 'ה"מ', options: [{ text: 'הני מילי' }] },
  { abbr: 'ה"נ', options: [{ text: 'הכי נמי' }] },
  { abbr: 'א"נ', options: [{ text: 'אי נמי' }] },
  { abbr: 'א"כ', options: [{ text: 'אם כן' }] },
  { abbr: 'וא"ת', options: [{ text: 'ואם תאמר' }] },
  { abbr: 'וי"ל', options: [{ text: 'ויש לומר' }] },
  { abbr: 'קמ"ל', options: [{ text: 'קא משמע לן' }] },
  { abbr: 'ש"מ', options: [{ text: 'שמע מינה' }] },
  { abbr: 'ק"ש', options: [{ text: 'קריאת שמע' }] },
  { abbr: 'ק"ו', options: [{ text: 'קל וחומר' }] },
  { abbr: 'ג"ש', options: [{ text: 'גזירה שווה' }] },
  { abbr: 'אע"ג', options: [{ text: 'אף על גב' }] },
  { abbr: 'אע"פ', options: [{ text: 'אף על פי' }] },
  { abbr: 'בד"א', options: [{ text: 'במה דברים אמורים' }] },
  { abbr: 'ת"ח', options: [{ text: 'תלמיד חכם' }] },
  { abbr: 'לכ"ע', options: [{ text: 'לכולי עלמא' }] },
  { abbr: 'מ"מ', options: [{ text: 'מכל מקום' }] },
  { abbr: 'ד"ה', options: [{ text: 'דיבור המתחיל' }] },
  { abbr: 'ע"א', options: [{ text: 'עמוד א' }] },
  { abbr: 'ע"ב', options: [{ text: 'עמוד ב' }] },
  { abbr: 'ע"ש', options: [{ text: 'עיין שם', context: 'rishonim' }, { text: 'ערב שבת', context: 'talmud' }] },
  { abbr: 'הקב"ה', options: [{ text: 'הקדוש ברוך הוא' }] },
  { abbr: 'פי\'', options: [{ text: 'פירוש' }, { text: 'פירש' }] },
  { abbr: 'גמ\'', options: [{ text: 'גמרא' }] },
  { abbr: 'מתני\'', options: [{ text: 'מתניתין' }] },
  { abbr: 'וכו\'', options: [{ text: 'וכולי' }] },
];

const unifyQuotes = (s: string) => s.replace(/[״”“]/g, '"').replace(/[׳’‘`]/g, "'");

export interface Expansion {
  text: string;
  /** Other readings that could also fit; non-empty means the chavruta should say it is unsure. */
  alternatives: string[];
  how: 'found-in-text' | 'context' | 'default' | 'unknown';
}

/**
 * Expands a ראשי תיבות using the passage it appears in: an expansion that is spelled out
 * in the passage wins; otherwise one that fits the kind of text (Gemara vs. rishonim).
 */
export function expandAbbreviation(abbr: string, passage: string, where: 'talmud' | 'rishonim' = 'talmud'): Expansion | null {
  const key = unifyQuotes(abbr).replace(/^[ו]/, (m) => m);
  const entry =
    ABBREVIATIONS.find((a) => a.abbr === key) ?? ABBREVIATIONS.find((a) => a.abbr === key.replace(/^[ודהש](?=.{2,})/, ''));
  if (!entry) return null;
  const opts = entry.options;
  if (opts.length === 1) return { text: opts[0].text, alternatives: [], how: 'default' };
  const plainPassage = unifyQuotes(passage).replace(/[\u0591-\u05C7]/g, '');
  const found = opts.filter((o) => plainPassage.includes(o.text));
  if (found.length === 1) return { text: found[0].text, alternatives: [], how: 'found-in-text' };
  const byContext = opts.filter((o) => !o.context || o.context === where);
  const pick = (found.length ? found : byContext.length ? byContext : opts)[0];
  return {
    text: pick.text,
    alternatives: opts.map((o) => o.text).filter((t) => t !== pick.text),
    how: found.length > 1 ? 'unknown' : 'context',
  };
}

/** Yeshiva terms the chavruta uses and can explain (used by the help screen and the demo). */
export const TERMS: { term: string; meaning: string }[] = [
  { term: 'הווה אמינא', meaning: 'ההבנה הראשונית, ההנחה שהגמרא שוקלת לפני שהיא מגיעה למסקנה' },
  { term: 'מסקנה', meaning: 'ההבנה שהסוגיה נשארת איתה בסוף המשא ומתן' },
  { term: 'שקלא וטריא', meaning: 'המשא ומתן של הגמרא: שאלות, תשובות, ראיות ודחיות' },
  { term: 'קושיה', meaning: 'שאלה שמראה סתירה או קושי בדברים' },
  { term: 'תירוץ', meaning: 'תשובה שמיישבת את הקושיה' },
  { term: 'ראיה', meaning: 'הוכחה ממקור אחר לטענה' },
  { term: 'דחייה', meaning: 'הסבר שמראה שהראיה אינה מוכרחת' },
  { term: 'סברה', meaning: 'טענה מבוססת היגיון, לא על פסוק או מקור כתוב' },
  { term: 'נפקא מינה', meaning: 'ההבדל המעשי שיוצא ממחלוקת או מהבנה' },
  { term: 'פשט', meaning: 'ההבנה הפשוטה של הדברים לפי לשונם' },
  { term: 'חידוש', meaning: 'דבר חדש שלא היינו יודעים בלי המקור הזה' },
  { term: 'צריך עיון', meaning: 'שאלה שנשארת פתוחה ודורשת עוד בירור' },
  { term: 'דיבור המתחיל', meaning: 'המילים הראשונות מהגמרא שהמפרש מצטט כדי לסמן על מה הוא מפרש' },
];

/**
 * How to say things aloud. Keys are matched on plain letters (quotes unified);
 * values are given with niqqud so the voice pronounces them correctly.
 */
export const PRONUNCIATION: Record<string, string> = {
  'רש"י': 'רַשִׁ"י',
  'רשי': 'רַשִׁ"י',
  'רמב"ם': 'רַמְבַּ"ם',
  'רמב"ן': 'רַמְבַּ"ן',
  'ראב"ע': 'אִבְּן עֶזְרָא',
  'תוי"ט': 'תּוֹסְפוֹת יוֹם טוֹב',
  'רע"ב': 'רַבֵּנוּ עוֹבַדְיָה מִבַּרְטְנוּרָא',
  'גמ\'': 'גְּמָרָא',
  'מתני\'': 'מַתְנִיתִין',
  'ע"א': 'עַמּוּד אָלֶף',
  'ע"ב': 'עַמּוּד בֵּית',
  'ד"ה': 'דִּבּוּר הַמַּתְחִיל',
  'הקב"ה': 'הַקָּדוֹשׁ בָּרוּךְ הוּא',
  'ה\'': 'הַשֵּׁם',
  'וכו\'': 'וְכוּלֵי',
  'ק"ש': 'קְרִיאַת שְׁמַע',
  'תוס\'': 'תּוֹסָפוֹת',
  'תוספות': 'תּוֹסָפוֹת',
  'אמורא': 'אָמוֹרָא',
  'תנא': 'תַּנָּא',
  'מאי': 'מַאי',
  'סברה': 'סְבָרָה',
  'סברא': 'סְבָרָא',
  'נפקא': 'נַפְקָא',
  'מינה': 'מִינַּהּ',
  'הווה': 'הֲוָה',
  'אמינא': 'אַמִינָא',
  'שקלא': 'שַׁקְלָא',
  'וטריא': 'וְטַרְיָא',
};

const LETTER_NAMES = ['', 'אָלֶף', 'בֵּית', 'גִּימֶל', 'דָּלֶת', 'הֵא', 'וָו', 'זַיִן', 'חֵית', 'טֵית'];

/** Prepares text for the voice: expands known abbreviations and spells numerals in refs ("דף ב׳" → "דף בֵּית"). */
export function speakable(text: string, passage = ''): string {
  let out = unifyQuotes(text);
  out = out.replace(/(דף|עמוד|פרק|פסוק|משנה|סימן|סעיף)\s+([א-ט])'(?=[\s,.?!:;]|$)/g, (_m, w: string, l: string) => {
    const idx = 'אבגדהוזחט'.indexOf(l) + 1;
    return `${w} ${LETTER_NAMES[idx]}`;
  });
  const keys = Object.keys(PRONUNCIATION).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp(`(^|[\\s(\\[–-])${escapeRe(k)}(?=$|[\\s,.?!:;)\\]–-])`, 'g');
    out = out.replace(re, (_m, pre: string) => pre + PRONUNCIATION[k]);
  }
  out = out.replace(/(^|\s)([\u05D0-\u05EA]{1,4}"[\u05D0-\u05EA])(?=$|[\s,.?!:;])/g, (m, pre: string, abbr: string) => {
    const e = expandAbbreviation(abbr, passage);
    return e ? pre + e.text : m;
  });
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

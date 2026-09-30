import type { SkillId } from '../types';
import { WORDS, IM_SENTENCES, type WordEntry } from './words.ts';
import { FINAL_TO_REGULAR } from './skills.ts';

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

let cache: Tip[] | null = null;

export function allTips(): Tip[] {
  if (cache) return cache;
  const out: Tip[] = [];
  for (const [skill, list] of Object.entries(WORDS) as [SkillId, WordEntry[]][]) {
    for (const e of list) {
      const r = ruleTip(skill, e);
      if (r) out.push({ id: `${skill}:${e.w}:rule`, skill, word: e.w, text: r });
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
  const order = ['rule', 'contrast', 'group'];
  if (word) {
    const forWord = tips.filter((t) => t.skill === skill && t.word === word).sort((a, b) => order.indexOf(a.id.split(':').pop()!) - order.indexOf(b.id.split(':').pop()!));
    if (forWord.length) return forWord[0];
  }
  return tips.find((t) => t.skill === skill) ?? tips.find((t) => t.skill === 'general') ?? null;
}

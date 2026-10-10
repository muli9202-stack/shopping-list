// Hebrew text helpers: niqqud stripping, gematria and word tokenizing.

const NIQQUD = /[\u0591-\u05C7]/g;
const TAGS = /<[^>]+>/g;

/** Removes vowels, cantillation and HTML so texts can be compared letter by letter. */
export function plain(s: string): string {
  return s
    .replace(TAGS, '')
    .replace(/\u05BE/g, ' ')
    .replace(NIQQUD, '')
    .replace(/&nbsp;|&thinsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** For matching: plain letters only, no punctuation, final letters folded, single spaces. */
export function norm(s: string): string {
  return plain(s)
    .replace(/[״"׳'`.,:;!?()[\]{}\-–—־|/\\*]/g, ' ')
    .replace(/ך/g, 'כ')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ')
    .replace(/ץ/g, 'צ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VALUES: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
};

/** "ב׳" → 2, "כ״ב" → 22, "קכ" → 120. Returns NaN for anything that is not a Hebrew numeral. */
export function gematria(s: string): number {
  const letters = s.replace(/[״"׳']/g, '').trim();
  if (!letters || !/^[\u05D0-\u05EA]+$/.test(letters)) return NaN;
  let sum = 0;
  for (const ch of letters) sum += VALUES[ch] ?? NaN;
  return sum;
}

/** 2 → "ב׳", 15 → "ט״ו", 22 → "כ״ב". */
export function toHebrewNumeral(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  const parts: string[] = [];
  let rest = n;
  for (const [v, ch] of [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק']] as const) {
    while (rest >= v) {
      parts.push(ch);
      rest -= v;
    }
  }
  if (rest === 15) parts.push('ט', 'ו');
  else if (rest === 16) parts.push('ט', 'ז');
  else {
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'][Math.floor(rest / 10)];
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'][rest % 10];
    if (tens) parts.push(tens);
    if (ones) parts.push(ones);
  }
  if (parts.length === 1) return `${parts[0]}׳`;
  return `${parts.slice(0, -1).join('')}״${parts[parts.length - 1]}`;
}

const SPOKEN_NUMBERS: Record<string, number> = {
  אחד: 1, אחת: 1, ראשון: 1, ראשונה: 1, שתיים: 2, שתים: 2, שניים: 2, שנים: 2, שני: 2, שנייה: 2, שניה: 2,
  שלוש: 3, שלש: 3, שלושה: 3, שלישי: 3, שלישית: 3, ארבע: 4, ארבעה: 4, רביעי: 4, רביעית: 4,
  חמש: 5, חמישה: 5, חמישי: 5, חמישית: 5, שש: 6, שישה: 6, שישי: 6, שישית: 6, שבע: 7, שבעה: 7, שביעי: 7,
  שמונה: 8, שמיני: 8, תשע: 9, תשעה: 9, תשיעי: 9, עשר: 10, עשרה: 10, עשירי: 10,
  עשרים: 20, שלושים: 30, שלשים: 30, ארבעים: 40, חמישים: 50, שישים: 60, שבעים: 70, שמונים: 80, תשעים: 90,
  מאה: 100, מאתיים: 200,
};

/**
 * Reads one number token: digits ("12"), a Hebrew numeral ("י״ב", "יב") or a spoken word ("שתיים").
 * Spoken compounds ("עשרים ושתיים") are handled by {@link parseNumberWords}.
 */
export function parseNumberToken(tok: string): number {
  const t = tok.replace(/^ו(?=[\u05D0-\u05EA]{2,})/, '').trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (t in SPOKEN_NUMBERS) return SPOKEN_NUMBERS[t];
  if (tok in SPOKEN_NUMBERS) return SPOKEN_NUMBERS[tok];
  return gematria(tok);
}

/** Parses a run of words like ["עשרים","ושתיים"] → 22. Returns [value, wordsConsumed]. */
export function parseNumberWords(words: string[]): [number, number] {
  if (!words.length) return [NaN, 0];
  const first = words[0];
  if (/^\d+$/.test(first)) return [Number(first), 1];
  const firstPlain = first.replace(/^ו/, '');
  if (!(first in SPOKEN_NUMBERS) && !(firstPlain in SPOKEN_NUMBERS)) {
    // Bare letters count as a numeral only when short ("ב", "כא") or marked ("קכ״ג"):
    // otherwise ordinary words like "טוב" would read as numbers.
    const marked = /["״׳']/.test(first);
    if (!marked && first.length > 2) return [NaN, 0];
    const g = gematria(first);
    return [g, Number.isNaN(g) ? 0 : 1];
  }
  let total = 0;
  let used = 0;
  for (const w of words) {
    const bare = w.replace(/^ו/, '');
    const v = SPOKEN_NUMBERS[w] ?? SPOKEN_NUMBERS[bare];
    if (v === undefined) break;
    if (used > 0 && !w.startsWith('ו') && v < 10 && total % 10 !== 0) break;
    total += v;
    used++;
  }
  return [total, used];
}

export interface Token {
  /** The word as displayed (with niqqud). */
  text: string;
  /** Normalized letters for matching. */
  key: string;
  /** True for whitespace/punctuation runs between words. */
  sep: boolean;
}

/** Splits a segment into word and separator tokens; joining every token's text rebuilds the plain-HTML-free string. */
export function tokenize(s: string): Token[] {
  const clean = s.replace(TAGS, '').replace(/&nbsp;|&thinsp;/g, ' ');
  const out: Token[] = [];
  // Maqaf (U+05BE) separates words: "עַל־פְּנֵי" is two clickable words.
  const re = /([\u05D0-\u05EA\u0591-\u05BD\u05BF-\u05C7"״׳']+)|([^\u05D0-\u05EA\u0591-\u05BD\u05BF-\u05C7"״׳']+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (m[1]) {
      // A quote mark glued to the start/end is punctuation, not part of the word.
      const word = m[1];
      const lead = word.match(/^["״׳']+/)?.[0] ?? '';
      const trail = word.match(/["׳']+$/)?.[0] ?? '';
      const core = word.slice(lead.length, word.length - trail.length);
      if (lead) out.push({ text: lead, key: '', sep: true });
      if (core) out.push({ text: core, key: norm(core).replace(/ /g, ''), sep: false });
      if (trail) out.push({ text: trail, key: '', sep: true });
    } else out.push({ text: m[2], key: '', sep: true });
  }
  return out;
}

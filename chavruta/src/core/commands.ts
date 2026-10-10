// Turns what the learner said or typed into an intent. Navigation and commentary commands are
// handled locally and immediately; anything unclear becomes a clarifying question instead of
// opening a possibly wrong source; everything else goes to the chavruta as conversation.
import { norm, parseNumberWords } from './hebrew';
import { COMMENTATORS, TANAKH, TRACTATES, type Commentator, type Tractate } from './lexicon';
import { targetToHebrew, type Amud, type Target } from './refs';

export type Intent =
  | { type: 'open'; target: Target; thenCommentary?: string }
  | { type: 'clarify'; question: string; options: { label: string; intent: Intent }[] }
  | { type: 'say'; text: string }
  | { type: 'commentary'; who: string; action: 'open' | 'close' }
  | { type: 'nav'; dir: 1 | -1 }
  | { type: 'resume' }
  | { type: 'showWhere' }
  | { type: 'illustrate'; variant: 'default' | 'compare' | 'change'; text: string }
  | { type: 'stop' }
  | { type: 'continue' }
  | { type: 'repeat' }
  | { type: 'word'; word: string | null; text: string }
  | { type: 'summary' }
  | { type: 'style'; style: 'hint' | 'direct' }
  | { type: 'chat'; text: string };

/** Lowercase-ish canonical form: no niqqud, unified quotes, single spaces; keeps " ' . : for daf notation. */
export function clean(text: string): string {
  return text
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[״”“]/g, '"')
    .replace(/[׳’‘`]/g, "'")
    .replace(/[,!?;،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OPEN_VERB = /(^|\s)(פתח|תפתח|פתחי|תפתחי|נפתח|לפתוח|נלמד|ללמוד|נלמוד|בוא נלמד|בואו נלמד|תביא|הבא|תעבור ל|נעבור ל|עבור ל|לך ל|תלך ל|תראה|הראה|תראי|הצג|תציג|נעיין|בוא נראה)/;
const CLOSE_VERB = /(^|\s)(סגור|תסגור|סגרי|תסגרי|הסתר|תסתיר|תוריד)/;
const SHORT = (t: string, n: number) => t.split(' ').length <= n;

const LETTER_NAMES: Record<string, number> = {
  אלף: 1, אלאף: 1, בית: 2, בייס: 2, ביית: 2, גימל: 3, דלת: 4, דאלד: 4, הא: 5, הי: 5, ואו: 6, וו: 6, זין: 7, חית: 8, טית: 9,
  יוד: 10, כף: 20, למד: 30, מם: 40, נון: 50, סמך: 60, עין: 70, פא: 80, פה: 80, צדי: 90, קוף: 100, ריש: 200, שין: 300, תו: 400, תיו: 400,
};

/** Reads a number at words[i] (digits, gematria, spoken numbers or letter names like "בית"). */
function readNumber(words: string[], i: number): [number, number] {
  const w = words[i];
  if (w === undefined) return [NaN, 0];
  const bare = w.replace(/[.:]$/, '');
  if (bare in LETTER_NAMES) {
    // "כף בית" → 22
    let total = LETTER_NAMES[bare];
    let used = 1;
    const next = words[i + 1]?.replace(/[.:]$/, '');
    if (next && next in LETTER_NAMES && LETTER_NAMES[next] < total && total >= 10) {
      total += LETTER_NAMES[next];
      used = 2;
    }
    return [total, used];
  }
  return parseNumberWords([bare, ...words.slice(i + 1)]);
}

function readAmud(words: string[], i: number, dafToken: string): { amud: Amud | null; used: number } {
  if (/:$/.test(dafToken)) return { amud: 'b', used: 0 };
  const w = words[i];
  const w2 = words[i + 1];
  const side = (s: string | undefined): Amud | null => {
    if (!s) return null;
    const b = s.replace(/['".:]/g, '');
    if (['א', 'אלף', 'ראשון', '1', 'אחד', 'אלאף'].includes(b)) return 'a';
    if (['ב', 'בית', 'שני', '2', 'שתיים', 'בייס', 'בייס'].includes(b)) return 'b';
    return null;
  };
  if (w === 'ע"א' || w === "ע'א" || w === 'עא') return { amud: 'a', used: 1 };
  if (w === 'ע"ב' || w === "ע'ב" || w === 'עב') return { amud: 'b', used: 1 };
  if (w === 'עמוד' || w === 'צד' || w === 'עמ' || w === "עמ'") {
    const s = side(w2);
    return { amud: s, used: s ? 2 : 1 };
  }
  const s = side(w);
  if (s && w.length <= 4) return { amud: s, used: 1 };
  // "ב." in the middle of a sentence is amud a (a period at the very end is just punctuation).
  if (/\.$/.test(dafToken) && i < words.length) return { amud: 'a', used: 0 };
  return { amud: null, used: 0 };
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

interface NameHit<T> {
  item: T;
  start: number;
  end: number;
  distance: number;
}

/** Finds a name (exact first, then within a small edit distance) in a run of words. */
function findName<T>(words: string[], items: T[], names: (t: T) => string[], fuzzy = true): NameHit<T>[] {
  const keyed = items.flatMap((item) => names(item).map((n) => ({ item, key: norm(n).replace(/ /g, ''), len: n.split(' ').length })));
  const exact: NameHit<T>[] = [];
  const near: NameHit<T>[] = [];
  for (let start = 0; start < words.length; start++) {
    for (let len = 3; len >= 1; len--) {
      if (start + len > words.length) continue;
      const span = norm(words.slice(start, start + len).join(' ')).replace(/ /g, '');
      if (!span) continue;
      for (const k of keyed) {
        if (k.len !== len) continue;
        // Hebrew glues prepositions on: "בברכות", "למסכת".
        const candidates = [span, span.replace(/^[בלמוה]/, ''), span.replace(/^(וב|ול|ומ|מה|בה|לה)/, '')];
        if (candidates.includes(k.key)) exact.push({ item: k.item, start, end: start + len, distance: 0 });
        else if (fuzzy && k.key.length >= 4) {
          const d = Math.min(...candidates.map((c) => levenshtein(c, k.key)));
          const allowed = k.key.length >= 7 ? 2 : 1;
          if (d <= allowed) near.push({ item: k.item, start, end: start + len, distance: d });
        }
      }
    }
  }
  if (exact.length) return dedupe(exact.sort((a, b) => b.end - b.start - (a.end - a.start)));
  return dedupe(near.sort((a, b) => a.distance - b.distance));
}

function dedupe<T>(hits: NameHit<T>[]): NameHit<T>[] {
  const seen = new Set<T>();
  return hits.filter((h) => (seen.has(h.item) ? false : (seen.add(h.item), true)));
}

const OTHER_WORKS = /(ירושלמי|תוספתא|רמב"ם|רמבם|משנה תורה|הלכות|שולחן ערוך|שו"ע|טור |משנה ברורה|מדרש|מכילתא|ספרא|ספרי|זוהר|תנחומא|בראשית רבה|שמות רבה|ויקרא רבה)/;

/** Parses a request to open a source. Returns null when the text does not name one. */
export function parseTarget(raw: string): Intent | null {
  const text = clean(raw);
  const words = text.split(' ');
  if (/פרשת השבוע|פרשה של השבוע|הפרשה השבועית/.test(text)) return { type: 'open', target: { kind: 'parasha', name: 'current' } };
  const parasha = text.match(/פרשת ([\u05D0-\u05EA]+(?: [\u05D0-\u05EA]+)?)/);
  if (parasha && !/פרשת (השבוע|ה?פסוקים)/.test(text)) {
    return { type: 'open', target: { kind: 'name', text: `פרשת ${parasha[1]}` } };
  }
  const otherWork = text.match(OTHER_WORKS);
  if (otherWork) {
    const from = text.indexOf(otherWork[0]);
    const rest = text.slice(from).replace(/\s+(עם|ותפתח|ופתח).*$/, '');
    return { type: 'open', target: { kind: 'name', text: rest } };
  }

  const wantsMishnah = /(^|\s)(משנה|משניות|מתניתין|במשנה|המשנה)(\s|$)/.test(text) && !/דף/.test(text);
  // A misheard tractate name is only considered when a daf/perek number follows it, and never
  // when the words are a commentator's name ("תוספות" is not a garbled "תרומות").
  const commentatorWords = new Set(COMMENTATORS.flatMap((c) => [c.he, ...c.variants]).map((v) => norm(v).replace(/ /g, '')));
  const tractHits = findName<Tractate>(words, TRACTATES, (t) => [t.he, ...t.variants]).filter(
    (h) =>
      h.distance === 0 ||
      (!commentatorWords.has(norm(words.slice(h.start, h.end).join(' ')).replace(/ /g, '')) &&
        /^(דף|פרק|\d+|[א-ת]{1,3}["'][א-ת]?)$/.test(words[h.end] ?? '')),
  );
  const bookHits = findName(words, TANAKH, (b) => [b.he, ...b.variants], false);

  if (tractHits.length) {
    if (tractHits.length > 1 && tractHits[0].distance === tractHits[1].distance && tractHits[0].distance > 0) {
      return {
        type: 'clarify',
        question: `לא שמעתי בבירור את שם המסכת. התכוונת ל${tractHits.slice(0, 3).map((h) => h.item.he).join(' או ל')}?`,
        options: tractHits.slice(0, 3).map((h) => ({
          label: h.item.he,
          intent: parseTarget(words.slice(0, h.start).concat(h.item.he, words.slice(h.end)).join(' ')) ?? { type: 'say', text: '' },
        })),
      };
    }
    const hit = tractHits[0];
    const tr = hit.item;
    const after = words.slice(hit.end);
    const intent = parseTractateTail(tr, after, wantsMishnah, text);
    if (intent && hit.distance > 0) {
      const fixed = words.slice(0, hit.start).concat(tr.he, words.slice(hit.end)).join(' ');
      const resolved = parseTarget(fixed);
      const label = resolved?.type === 'open' ? targetToHebrew(resolved.target) : tr.he;
      return {
        type: 'clarify',
        question: `שמעתי „${words.slice(hit.start, hit.end).join(' ')}”. התכוונת ל${label}?`,
        options: [{ label: `כן, ${label}`, intent: resolved ?? intent }],
      };
    }
    return intent;
  }

  if (bookHits.length) {
    const hit = bookHits[0];
    const after = words.slice(hit.end);
    let i = 0;
    if (after[i] === 'פרק') i++;
    const [chapter, used] = readNumber(after, i);
    if (!used || !chapter) return null; // "בראשית" alone is usually just a word
    i += used;
    if (after[i] === 'פסוק') i++;
    const [verse, vUsed] = readNumber(after, i);
    return {
      type: 'open',
      target: { kind: 'tanakh', book: hit.item.sefaria, chapter, verse: vUsed ? verse : undefined },
      thenCommentary: commentatorIn(text)?.id,
    };
  }
  return null;
}

function parseTractateTail(tr: Tractate, after: string[], wantsMishnah: boolean, text: string): Intent | null {
  const thenCommentary = commentatorIn(text)?.id;
  let i = 0;
  if (after[i] === 'פרק' || wantsMishnah || !tr.bavli) {
    // Mishnah: "פרק א משנה ב" or "א ב"
    if (after[i] === 'פרק') i++;
    const [perek, used] = readNumber(after, i);
    if (!used) {
      return wantsMishnah || !tr.bavli
        ? { type: 'clarify', question: `באיזה פרק במסכת ${tr.he}?`, options: [] }
        : null;
    }
    i += used;
    if (after[i] === 'משנה') i++;
    const [mishnah, mUsed] = readNumber(after, i);
    return {
      type: 'open',
      target: { kind: 'mishnah', tractate: tr.mishnah, perek, mishnah: mUsed ? mishnah : undefined },
      thenCommentary,
    };
  }
  if (after[i] === 'דף') i++;
  const dafToken = after[i];
  const [daf, used] = readNumber(after, i);
  if (!used) {
    if (/(^|\s)(דף|גמרא|מסכת)(\s|$)/.test(text) || OPEN_VERB.test(text)) {
      return { type: 'clarify', question: `באיזה דף במסכת ${tr.he}?`, options: [] };
    }
    return null;
  }
  i += used;
  if (daf < 2 || (tr.lastDaf && daf > tr.lastDaf)) {
    return { type: 'say', text: `במסכת ${tr.he} יש דפים מב׳ עד ${tr.lastDaf ?? '?'} בלבד. איזה דף התכוונת?` };
  }
  const { amud } = readAmud(after, i, dafToken);
  if (!amud) {
    const a: Target = { kind: 'talmud', tractate: tr.bavli!, daf, amud: 'a' };
    const b: Target = { kind: 'talmud', tractate: tr.bavli!, daf, amud: 'b' };
    return {
      type: 'clarify',
      question: `${tr.he} דף ${dafToken?.replace(/[.:]$/, '')}: עמוד א׳ או עמוד ב׳?`,
      options: [
        { label: 'עמוד א׳', intent: { type: 'open', target: a, thenCommentary } },
        { label: 'עמוד ב׳', intent: { type: 'open', target: b, thenCommentary } },
      ],
    };
  }
  return { type: 'open', target: { kind: 'talmud', tractate: tr.bavli!, daf, amud }, thenCommentary };
}

/** Finds a commentator named in the text (longest name first, so "תוספות יום טוב" beats "תוספות"). */
export function commentatorIn(text: string): Commentator | null {
  const words = clean(text).split(' ');
  const hits = findName<Commentator>(words, COMMENTATORS, (c) => [c.he, ...c.variants], false);
  if (!hits.length) return null;
  return hits.sort((a, b) => b.end - b.start - (a.end - a.start))[0].item;
}

const FUNCTION_WORDS = new Set(['הזאת', 'הזו', 'הזה', 'הזות', 'כאן', 'פה', 'שם', 'זה', 'זאת', 'אומר', 'אומרת', 'בדיוק', 'לי', 'את', 'של']);

/** Main entry: what does the learner want? */
export function parseCommand(raw: string): Intent {
  const text = clean(raw);
  if (!text) return { type: 'chat', text: raw };

  if (SHORT(text, 3) && /^(עצור|עצרי|תעצור|די|שקט|תפסיק|הפסק|רגע עצור|stop)( |$)/.test(text)) return { type: 'stop' };

  if (/(חזור|תחזור|נחזור|תחזרי|תמשיך|נמשיך|המשך|תמשיכי).*(למקום|לאן|מאיפה|איפה|שעצרנו|שבו עצרנו|שהפסקנו|האחרון|מהמקום)/.test(text)) {
    return { type: 'resume' };
  }
  if (/(עמוד|דף|פרק)( ה)?(קודם|הקודם|הבא)|(הקודם|הבא)$/.test(text) && /(חזור|תחזור|עבור|תעבור|נעבור|לך|תלך|עמוד|דף|פרק)/.test(text)) {
    return { type: 'nav', dir: /קודם/.test(text) ? -1 : 1 };
  }
  const asksQuote = /["„“]/.test(text) || /(תצטט|ציטוט)/.test(text);
  if (/(תראה|הראה|תראי|תראו)( לי)? איפה|איפה (זה )?כתוב|איפה זה מופיע/.test(text) && !commentatorIn(text) && !asksQuote) {
    return { type: 'showWhere' };
  }
  if (/(ההבדל בין השיטות|טבלת שיטות|השוואה בין|תשווה)/.test(text)) return { type: 'illustrate', variant: 'compare', text: raw };
  if (/(מה ישתנה|אם נשנה|ומה אם|נשנה את המקרה)/.test(text)) return { type: 'illustrate', variant: 'change', text: raw };
  if (/(תצייר|צייר|ציור|המחשה|תמחיש|הדגמה|תדגים|שרטוט|תשרטט|תרשים)/.test(text)) return { type: 'illustrate', variant: 'default', text: raw };

  if (/(לנסות לבד|תן לי לנסות|תני לי לנסות|תן לי רמז|רק רמז|אל תגלה)/.test(text)) return { type: 'style', style: 'hint' };
  if (/(תסביר( לי)? (ישר|ישירות)|תגיד לי ישר|תן לי את התשובה|תסביר כבר)/.test(text)) return { type: 'style', style: 'direct' };
  if (/(^| )(תסכם|סכם|נסכם|סיכום|מה למדנו)( |$)/.test(text)) return { type: 'summary' };

  const target = parseTarget(text);
  if (target && (OPEN_VERB.test(text) || /(דף|פרק|מסכת|פרשת)/.test(text) || target.type !== 'open' || SHORT(text, 4))) {
    return target;
  }

  const who = commentatorIn(text);
  if (who) {
    if (CLOSE_VERB.test(text)) return { type: 'commentary', who: who.id, action: 'close' };
    const bare = norm(text).replace(/ /g, '');
    const isJustName = [who.he, ...who.variants].some((v) => norm(v).replace(/ /g, '') === bare);
    if (OPEN_VERB.test(text) && SHORT(text, 5) || isJustName) return { type: 'commentary', who: who.id, action: 'open' };
  }

  const wordQ =
    text.match(/(?:מה (?:פירוש|פירושו של|הפירוש של|זה|זאת|פשר)|תסביר(?: לי)? את|מה המשמעות של)(?: המילה| המילים| הביטוי)? ([\u05D0-\u05EA"']+(?: [\u05D0-\u05EA"']+)?)\s*$/) ??
    text.match(/(?:לא הבנתי|לא מבין|לא מבינה)(?: את)? (?:המילה|המילים|הביטוי) ([\u05D0-\u05EA"']+(?: [\u05D0-\u05EA"']+)?)\s*$/);
  if (/(המילה|המילים|הביטוי)( הזאת| הזו| הזה| הזות| כאן)/.test(text) || /^(רגע )?מה זה\??$/.test(text)) {
    return { type: 'word', word: null, text: raw };
  }
  if (wordQ) {
    const w = wordQ[1].split(' ').filter((x) => !FUNCTION_WORDS.has(x)).join(' ');
    if (w && !/^(הפשט|הנפקא מינה|ההבדל|הקושיה|התירוץ)$/.test(w)) return { type: 'word', word: w, text: raw };
  }

  if (SHORT(text, 3) && /(^| )(שוב|עוד פעם|לא שמעתי|תחזור על זה)( |$)/.test(text)) return { type: 'repeat' };
  if (SHORT(text, 3) && /^(כן|נמשיך|המשך|הלאה|קדימה|יאללה|בסדר|טוב|אוקיי|אוקי|הבנתי|ברור|נו|תמשיך|תמשיכי|הבא)( |$)/.test(text)) {
    return { type: 'continue' };
  }
  return { type: 'chat', text: raw };
}

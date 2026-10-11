// The full chavruta: Claude writes the explanation from the sources we retrieved.
// Retrieval (Sefaria), writing (Claude) and playback (the engine) are separate steps:
// this module only builds the context, streams the model's answer and turns it into steps.
// The engine then verifies every citation before anything is spoken.
import Anthropic from '@anthropic-ai/sdk';
import { plain } from '../core/hebrew';
import { parseIllustration } from '../core/illustration';
import { fetchRefText, search, type Section } from '../core/sefaria';
import { LEVELS, SAY_KIND_LABEL, type SayKind } from '../state/store';
import type { Brain, BrainRequest, Step, StudyContext, Usage } from './types';

/** Prices per million tokens (USD), from Anthropic's model table as checked on 2026-10-06. */
export const PRICES: Record<string, { label: string; input: number; output: number; cacheRead: number; cacheWrite: number; estimated?: boolean }> = {
  'claude-opus-5-5': { label: 'Claude Opus 5.5', input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { label: 'Claude Sonnet 5.5', input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { label: 'Claude Haiku 5.5', input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125, estimated: true },
};
export const PRICES_CHECKED = '2026-10-06';

export function costOf(u: Usage): number {
  const p = PRICES[u.model] ?? PRICES['claude-opus-5-5'];
  return (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1e6;
}

export const SYSTEM = `אתה „החברותא”: שותף ללימוד תורה מבוסס בינה מלאכותית. הלומד רואה את הדף על המסך ושומע אותך מדבר. מה שאתה כותב מוקרא בקול, משפט אחר משפט, וכל משפט מוצג גם ככתובית.

## אופי
- מדבר עברית טבעית ודבורה, כמו חברותא בבית מדרש: קצר, חם, ענייני. משתמש במונחים כמו הווה אמינא, מסקנה, שקלא וטריא, קושיה, תירוץ, ראיה, דחייה, סברה, נפקא מינה, פשט, חידוש, צריך עיון, דיבור המתחיל, ומסביר אותם כשהלומד מתחיל.
- לומד בקטעים קצרים: קוראים, מבינים מילים, מבררים את הטענה, בודקים מה קשה ומה התירוץ, ומסכמים את החידוש. אחרי 2–6 אמירות עוצר ונותן ללומד להשתתף (שאלה קצרה, או פשוט עוצר). לא הרצאות.
- הטקסט שלך מוקרא בקול עברי. כתוב מילים בארמית, שמות חכמים ומילים שעלולות להיקרא לא נכון עם ניקוד (למשל „תַּנָּא”, „אִיבַּעְיָא לְהוּ”, „רַבִּי אֱלִיעֶזֶר”), כדי שההגייה תהיה נכונה. בציטוט (quote) העתק את הלשון כפי שהיא.
- שואל שאלות כמו „מה קשה לך כאן?”, „איזו מילה הביאה אותך להבנה הזאת?”, „מה השתנה אחרי התירוץ?”, אבל לא הופך כל משפט למבחן.
- כשהלומד מציע סברה או מקשה: בודק ברצינות מול המקור. מסכים כשהדברים נכונים, ומתקן בעדינות כשצריך, עם המקור.
- כשהלומד ביקש הסבר ישיר, נותן אותו. כשביקש לנסות לבד, נותן רמז ולא את כל התשובה.
- בדיון הלכתי: מסביר את הסוגיה ואת השיטות, ומבחין בין לימוד לבין פסיקה למעשה. לשאלה מעשית אישית ממליץ לברר אצל רב.

## אמינות (חובה)
- מצטט רק מתוך הטקסטים שמופיעים בהקשר (<text>, <commentary>, <retrieved>). הפניה (cite) היא תמיד אחת מההפניות שבסוגריים המרובעים שם, בדיוק כפי שהיא כתובה.
- quote הוא העתקה מדויקת של כמה מילים רצופות מהטקסט שב-cite (בלי ניקוד זה בסדר). המערכת בודקת אותו, ואם הוא לא נמצא האמירה לא תושמע כציטוט.
- אסור להמציא ציטוטים, דפים, דיבורים המתחילים או עמדות בשם מפרש. אם המקור לא נמצא בהקשר, אמור זאת (kind "meta") והצע לחפש או לפתוח אותו.
- הפרד בין סוגי אמירה, בשדה kind:
  quote = לשון המקור; translation = תרגום מילולי; explain = ההסבר שלך; commentator = מה שמפרש מסוים אומר (עם cite לדבריו); suggestion = הצעה אפשרית להבנה, לא מוכרחת; question = שאלה ללומד; meta = הערה על השיחה עצמה.
- כשיש כמה נוסחים, או כשהמהדורה משנה, ציין את המהדורה שבהקשר.

## פורמט פלט
שורות JSON בלבד, אובייקט אחד בכל שורה, בלי טקסט נוסף ובלי סימוני קוד:
{"t":"say","kind":"quote","text":"מה שאומרים בקול","cite":"Berakhot 2a:1","quote":"מאימתי קורין","hl":{"seg":1,"words":"מאימתי קורין"}}
{"t":"say","kind":"explain","text":"משפט הסבר אחד או שניים.","hl":{"seg":1}}
{"t":"open_commentary","who":"Rashi"}   (Rashi, Tosafot, Bartenura, Rambam, Tosafot Yom Tov, Ramban, Ibn Ezra, Sforno, או שם אחר מתוך <available>)
{"t":"focus","seg":3}   (העברת המוקד לשורה אחרת בדף הפתוח)
{"t":"select_word","seg":1,"word":"בתרומתן"}   (סימון מילה שאתה מסביר)
{"t":"clarify","question":"שאלת בירור קצרה","options":["אפשרות א","אפשרות ב"]}
{"t":"illustrate","spec":{...}}
{"t":"resume_pending"}   (חזרה להסבר שנקטע: המערכת תשמיע מחדש את מה שהלומד עוד לא שמע)

- text של say: משפט או שניים, לדיבור. בלי רשימות, בלי כוכביות.
- hl.seg הוא מספר שורה בטקסט הפתוח (המספר שבסוגריים ב-<text>). hl.words הן מילים מתוך אותה שורה.
- illustrate.spec, אחד מארבעה סוגים, ובכולם title, assumptions (הנחות, מידות או שיטה שמשפיעות על ההבנה), sources ([{label, ref}] מתוך ההקשר) ו-changed (אם זו וריאציה: מה שונה):
  timeline: startLabel, endLabel, points [{at 0..1, label, who, ref}], ranges [{from, to, label, ref}]
  table: columns [..], rows [{cells [..], ref}]
  scene (רשת 12×7): entities [{id, label, x, y, w, h, shape person|object|area|wall, ref}], arrows [{from, to, label}]
  flow: steps [{label, type statement|question|answer|proof|rejection|conclusion, ref}]
  המחשה היא „המחשה להסבר” ולא פסק הלכה. כשמשנים מקרה, אמור במפורש איזה פרט השתנה ועל איזה מקור נשענת ההשוואה.
- אם הלומד קטע אותך (<interrupted>): ענה קודם על מה שאמר. אם מתאים לחזור למהלך, הוסף בסוף {"t":"resume_pending"}. אל תניח שהוא שמע את השורות שלא נשמעו.
- אם הבקשה לא ברורה (איזו מילה? איזה מפרש? איזה דף?), שאל clarify קצר ואל תנחש.`;

const kindHe: Record<string, string> = { talmud: 'גמרא (בבלי)', mishnah: 'משנה', tanakh: 'תנ״ך', other: 'ספר' };

function sectionBlock(s: Section): string {
  const lines = s.segments.map((seg, i) => `[${i + 1}] ${plain(seg)}`);
  return `<text ref="${s.ref}" he="${s.heRef}">\n${lines.join('\n')}\n</text>`;
}

const STOP = new Set(['מה', 'למה', 'איך', 'את', 'של', 'על', 'זה', 'זאת', 'הוא', 'היא', 'אני', 'לי', 'יש', 'אין', 'כאן', 'פה', 'גם', 'עם', 'אם', 'כי', 'אבל', 'או', 'לא', 'כן', 'מי', 'איפה', 'עוד', 'מקור', 'מקורות', 'תראה', 'תביא', 'בבקשה']);
const NEEDS_SEARCH = /(מקור|איפה עוד|מקביל|בעוד מקום|ירושלמי|תוספתא|רמב"ם|רמב״ם|שולחן ערוך|שו"ע|הלכה|פוסקים|מדרש|בשם|מי אומר|מי עוד)/;

async function retrieve(text: string, ctx: StudyContext, signal: AbortSignal): Promise<string> {
  if (!NEEDS_SEARCH.test(text)) return '';
  const q = text
    .replace(/[^א-ת"״ ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 6)
    .join(' ');
  if (!q) return '';
  try {
    const hits = (await search(q, 8)).filter((h) => !h.ref.startsWith(ctx.section.ref)).slice(0, 4);
    if (signal.aborted) return '';
    // Search finds candidates; the text we hand the model is the original, fetched by ref.
    const texts = await Promise.all(
      hits.map((h) =>
        fetchRefText(h.ref)
          .then((t) => `[${t.ref}] (${t.heRef}; מהדורה: ${t.version.heTitle || t.version.title}) ${t.text.slice(0, 700)}`)
          .catch(() => ''),
      ),
    );
    const ok = texts.filter(Boolean);
    return ok.length ? `<retrieved query="${q}">\n${ok.join('\n')}\n</retrieved>` : `<retrieved query="${q}">לא נמצאו מקורות בחיפוש.</retrieved>`;
  } catch {
    return '<retrieved>החיפוש בספריא לא זמין כרגע.</retrieved>';
  }
}

function contextBlock(ctx: StudyContext, retrieved: string): string {
  const s = ctx.section;
  const parts = [
    `<study>\nמקור פתוח: ${s.heRef} (${s.ref}), ${kindHe[s.kind]}. מהדורה: ${s.version.heTitle || s.version.title}, רישיון ${s.version.license}${s.origin === 'snapshot' ? ', מעותק שמור במכשיר' : ''}.\nשורה במוקד: ${ctx.focusSeg}. נקרא בקול עד שורה: ${ctx.readUpTo}.\n${
      ctx.selection && ctx.selection.ref === s.ref ? `מילה שהלומד סימן: „${ctx.selection.text}” בשורה ${ctx.selection.seg}.\n` : ''
    }רמה: ${LEVELS[ctx.level]}. אופן: ${ctx.style === 'hint' ? 'הלומד רוצה לנסות לבד, תן רמזים' : 'הסבר ישיר'}.\n</study>`,
    sectionBlock(s),
  ];
  const lo = Math.max(1, ctx.focusSeg - 1);
  const hi = ctx.focusSeg + 2;
  for (const c of ctx.commentaries) {
    const near = c.comments.filter((x) => x.segment >= lo && x.segment <= hi);
    const body = near.map((x) => `[${x.ref}] (על שורה ${x.segment}) ${plain(x.text).slice(0, 900)}`).join('\n');
    parts.push(
      `<commentary id="${c.id}" he="${c.he}" edition="${c.version.heTitle || c.version.title}"${c.id === ctx.activeCommentary ? ' active="true"' : ''}>\n${body || 'אין דיבורים על השורות האלה.'}\n</commentary>`,
    );
  }
  if (retrieved) parts.push(retrieved);
  if (ctx.interruptedLine || ctx.pending.length) {
    parts.push(
      `<interrupted>\nהלומד קטע אותך באמצע.${ctx.interruptedLine ? ` השורה שנקטעה: „${ctx.interruptedLine.text}” (נשמע בערך: „${ctx.interruptedLine.text.slice(0, ctx.interruptedLine.cutAt ?? 0)}”).` : ''}\n${
        ctx.pending.length ? `שורות שלא נשמעו: ${ctx.pending.map((p) => `„${p.text}”`).join(' ')}` : ''
      }\n</interrupted>`,
    );
  }
  return parts.join('\n\n');
}

const REQUEST_TEXT: Record<string, (r: BrainRequest) => string> = {
  opened: () => 'פתחנו עכשיו את המקור. פתח בקצרה, והתחל ללמוד מהשורה שבמוקד: קרא אותה (quote) והסבר בקצרה.',
  continue: () => 'הלומד רוצה להמשיך. התקדם לקטע הבא (או השלם את הנוכחי אם עוד לא הוסבר).',
  word: (r) => (r.word ? `הלומד שואל על המילה „${r.word}”.` : 'הלומד שואל „מה פירוש המילה הזאת?”. השתמש במילה המסומנת או בהקשר. אם לא ברור לאיזו מילה הכוונה, שאל clarify.'),
  commentary: (r) => `הלומד ביקש לפתוח את ${r.commentator}. פתח אותו (open_commentary) והסבר מתוך דבריו על השורה שבמוקד.`,
  illustrate: (r) =>
    r.variant === 'compare'
      ? 'הלומד ביקש לראות את ההבדל בין השיטות. בנה טבלת שיטות (illustrate table) מהמקורות והסבר.'
      : r.variant === 'change'
        ? `הלומד שואל מה ישתנה אם נשנה את המקרה: „${r.text}”. בנה וריאציה (illustrate עם changed), אמור איזה פרט השתנה ועל איזה מקור נשענת ההשוואה.`
        : `הלומד ביקש המחשה: „${r.text ?? ''}”. בנה המחשה מתאימה (illustrate) והסבר אותה.`,
  summary: () => 'סכם בקצרה את מה שלמדנו עד עכשיו, מושגים חדשים ושאלה אחת או שתיים לחזרה.',
  resume: () => 'הלומד ביקש לחזור למקום שבו עצרנו. הזכר בקצרה איפה היינו והמשך משם.',
  repeat: () => 'הלומד ביקש לשמוע שוב. חזור על הנקודה האחרונה בניסוח קצר.',
  chat: (r) => `הלומד אומר: „${r.text ?? ''}”`,
};

/** Parses one output line into a step, or null when it is not a valid one. */
export function parseStepLine(raw: string): Step | null {
  const line = raw.trim().replace(/^```(json)?|```$/g, '').trim();
  if (!line) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(line);
  } catch {
    // A plain sentence instead of JSON: speak it as the chavruta's own words.
    return /[א-ת]/.test(line) ? { t: 'say', kind: 'explain', text: line } : null;
  }
  const kinds = Object.keys(SAY_KIND_LABEL);
  switch (o.t) {
    case 'say': {
      if (typeof o.text !== 'string' || !o.text.trim()) return null;
      const hl = o.hl as { seg?: unknown; words?: unknown } | undefined;
      return {
        t: 'say',
        text: o.text,
        kind: (kinds.includes(o.kind as string) ? o.kind : 'explain') as SayKind,
        cite: typeof o.cite === 'string' ? o.cite : undefined,
        quote: typeof o.quote === 'string' ? o.quote : undefined,
        hl: hl && Number.isFinite(Number(hl.seg)) ? { seg: Number(hl.seg), words: typeof hl.words === 'string' ? hl.words : undefined } : undefined,
      };
    }
    case 'open_commentary':
      return typeof o.who === 'string' ? { t: 'open_commentary', who: o.who } : null;
    case 'focus':
      return Number.isFinite(Number(o.seg)) ? { t: 'focus', seg: Number(o.seg) } : null;
    case 'select_word':
      return typeof o.word === 'string' && Number.isFinite(Number(o.seg)) ? { t: 'select_word', seg: Number(o.seg), word: o.word } : null;
    case 'clarify':
      return typeof o.question === 'string'
        ? { t: 'clarify', question: o.question, options: Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === 'string').slice(0, 4) : [] }
        : null;
    case 'illustrate': {
      const spec = parseIllustration(o.spec);
      return spec ? { t: 'illustrate', spec } : null;
    }
    case 'resume_pending':
      return { t: 'resume_pending' };
    default:
      return null;
  }
}

/**
 * The conversation sent to the model: what the learner said, what they actually heard
 * from the chavruta (cut lines marked), and last the study context and the request.
 */
export async function buildTurns(req: BrainRequest, signal: AbortSignal): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const { ctx } = req;
  const retrieved = req.kind === 'chat' ? await retrieve(req.text ?? '', ctx, signal) : '';
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of ctx.history.slice(-10)) {
    if (t.role === 'user' && t.text) messages.push({ role: 'user', content: t.text });
    else if (t.role === 'chavruta') {
      const heard = t.lines
        .filter((l) => l.heard || l.cutAt)
        .map((l) => {
          const said = l.heard ? l.text : `${l.text.slice(0, l.cutAt)}… [נקטע כאן]`;
          return l.kind === 'meta' ? said : `(${SAY_KIND_LABEL[l.kind]}) ${said}`;
        });
      if (heard.length) messages.push({ role: 'assistant', content: heard.join('\n') });
    }
  }
  // Alternating roles, starting with the learner.
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n${m.content}`;
    else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== 'user') merged.shift();
  const content = `${contextBlock(ctx, retrieved)}\n\n<request kind="${req.kind}">${REQUEST_TEXT[req.kind]?.(req) ?? req.text ?? ''}</request>`;
  if (merged.length && merged[merged.length - 1].role === 'user') merged.push({ role: 'assistant', content: '(ממתין)' });
  merged.push({ role: 'user', content });
  return merged;
}

/** Splits streamed text into complete lines and turns each into a step. */
export class StepLineReader {
  private buf = '';
  push(delta: string): Step[] {
    this.buf += delta;
    const out: Step[] = [];
    let nl: number;
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const step = parseStepLine(this.buf.slice(0, nl));
      this.buf = this.buf.slice(nl + 1);
      if (step) out.push(step);
    }
    return out;
  }
  end(): Step[] {
    const step = parseStepLine(this.buf);
    this.buf = '';
    return step ? [step] : [];
  }
}

export class ClaudeBrain implements Brain {
  readonly demo = false;
  onUsage?: (u: Usage) => void;
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
    private effort: 'low' | 'medium' | 'high',
  ) {
    // The key stays on this device; requests go straight from the browser to Anthropic.
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async *respond(req: BrainRequest, signal: AbortSignal): AsyncIterable<Step> {
    const merged = await buildTurns(req, signal);
    if (signal.aborted) return;

    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: 8000,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: merged,
        output_config: { effort: this.effort },
        ...(this.model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
      },
      { signal },
    );

    const reader = new StepLineReader();
    for await (const ev of stream) {
      if (signal.aborted) return;
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield* reader.push(ev.delta.text);
    }
    yield* reader.end();
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      yield { t: 'say', kind: 'meta', text: 'המודל סירב לענות על הבקשה הזאת. אפשר לנסח אחרת.' };
    }
    const u = final.usage;
    this.onUsage?.({
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      model: final.model ?? this.model,
    });
  }
}

/** Turns an API error into a Hebrew message for the learner. */
export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'מפתח ה-API של Claude לא תקין. אפשר לבדוק אותו בהגדרות.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'למפתח הזה אין הרשאה למודל שנבחר.';
  if (e instanceof Anthropic.RateLimitError) return 'הגענו למגבלת הקצב של Claude. ננסה שוב בעוד רגע.';
  if (e instanceof Anthropic.BadRequestError) return `Claude דחה את הבקשה: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'אין חיבור ל-Claude. בדוק את החיבור לאינטרנט.';
  if (e instanceof Anthropic.APIError) return `שגיאה מ-Claude (${e.status}).`;
  return 'משהו השתבש בהכנת התשובה.';
}

// The demo chavruta: works without an API key. It reads the real text, explains the
// sections it has hand-written material for (Berakhot 2a), reads commentaries in their
// own words everywhere, and says plainly when a question needs the full (Claude) mode.
import { norm, plain } from '../core/hebrew';
import type { Comment } from '../core/sefaria';
import { DEMO, type GlossEntry, type ScriptLine } from './demoContent';
import type { Brain, BrainRequest, Step, StudyContext } from './types';

const words = (s: string, n: number) => {
  const w = plain(s).split(' ');
  return w.length <= n ? w.join(' ') : `${w.slice(0, n).join(' ')}…`;
};

/** Strips Hebrew prefixes for glossary lookup: "ובתרומתן" → "בתרומתן" / "תרומתן". */
const keys = (w: string) => {
  const k = norm(w).replace(/ /g, '');
  return [k, k.replace(/^[ווהבדלמש]/, ''), k.replace(/^(וה|וב|ול|ומ|וד|דה|שה|מה|כש)/, '')];
};

function findGloss(entries: GlossEntry[], word: string): GlossEntry | undefined {
  const ks = keys(word);
  return entries.find((e) => {
    const ek = norm(e.word).replace(/ /g, '');
    return ks.includes(ek) || ks.some((k) => k.length > 2 && ek === k);
  });
}

const line = (l: ScriptLine, seg?: number): Step => ({
  t: 'say',
  text: l.text,
  kind: l.kind,
  cite: l.cite,
  quote: l.quote,
  hl: seg ? { seg, words: l.words } : undefined,
});

const meta = (text: string): Step => ({ t: 'say', text, kind: 'meta' });

function segmentSteps(ctx: StudyContext, seg: number): Step[] {
  const demo = DEMO[ctx.section.ref];
  const out: Step[] = [{ t: 'focus', seg }];
  const script = demo?.segments[seg];
  if (script) {
    const hint = ctx.style === 'hint';
    let hinted = false;
    for (const l of script) {
      if (hint && (l.kind === 'explain' || l.kind === 'commentator')) {
        if (!hinted) {
          out.push({ t: 'say', kind: 'question', text: 'נסה להסביר בעצמך מה נאמר כאן. אם תרצה, תגיד „תסביר” ואסביר.', hl: { seg } });
          hinted = true;
        }
        continue;
      }
      out.push(line(l, seg));
    }
  } else {
    const text = ctx.section.segments[seg - 1];
    if (!text) return out;
    out.push({ t: 'say', kind: 'quote', text: words(text, 45), cite: `${ctx.section.ref}:${seg}`, quote: words(text, 8).replace('…', ''), hl: { seg } });
    if (!demo) {
      const has = ctx.commentaries.find((c) => c.comments.some((x) => x.segment === seg));
      out.push({
        t: 'say',
        kind: 'question',
        text: has ? `מה קשה לך כאן? אפשר לבקש שנראה מה ${has.he} אומר על זה.` : 'מה קשה לך כאן? אפשר לבקש לפתוח פירוש על הקטע.',
      });
    }
  }
  out.push({ t: 'mark', status: 'read' });
  return out;
}

function nextSeg(ctx: StudyContext): number {
  return ctx.readUpTo >= ctx.focusSeg ? ctx.focusSeg + 1 : ctx.focusSeg;
}

function* opened(ctx: StudyContext): Generator<Step> {
  const { section } = ctx;
  const where = section.origin === 'snapshot' ? ' מתוך העותק השמור במכשיר, כי אין כרגע חיבור לספריא' : '';
  yield meta(`פתחנו ${section.heRef}${where}. אני אקרא ונבין יחד. אפשר לעצור אותי בכל רגע.`);
  if (!DEMO[section.ref]) {
    yield meta('במצב הדגמה אני קורא את הטקסט והמפרשים מהמקור. הסברים חופשיים ותשובות לכל שאלה זמינים כשמחברים מפתח Claude בהגדרות.');
  }
  yield* segmentSteps(ctx, section.focus?.from ?? 1);
}

function* explainWord(ctx: StudyContext, req: BrainRequest): Generator<Step> {
  const demo = DEMO[ctx.section.ref];
  const seg = ctx.selection?.ref === ctx.section.ref ? ctx.selection.seg : ctx.focusSeg;
  let target = req.word ?? (ctx.selection?.ref === ctx.section.ref ? ctx.selection.text : null);
  if (!target) {
    // "this word" with nothing marked: look at the words of the line that was just said.
    const segText = plain(ctx.section.segments[seg - 1] ?? '');
    const lastWords = ctx.interruptedLine?.text ?? '';
    const candidates = (demo?.glossary ?? []).filter((g) => norm(segText).includes(norm(g.word)));
    const near = candidates.filter((g) => norm(lastWords).includes(norm(g.word)));
    const pool = near.length ? near : candidates;
    if (pool.length === 1) target = pool[0].word;
    else if (pool.length > 1) {
      yield { t: 'clarify', question: 'לאיזו מילה התכוונת? אפשר גם ללחוץ על המילה בדף.', options: pool.slice(0, 4).map((g) => g.word) };
      return;
    } else {
      yield meta('לא ברור לי לאיזו מילה התכוונת. אפשר ללחוץ עליה בדף או לומר אותה.');
      return;
    }
  }
  const entry = demo && findGloss(demo.glossary, target);
  const inSeg = norm(ctx.section.segments[seg - 1] ?? '').includes(norm(target).split(' ')[0]);
  if (inSeg) yield { t: 'select_word', seg, word: target };
  if (entry) {
    yield { t: 'say', kind: 'translation', text: `„${entry.word}”, ב${entry.lang}: ${entry.meaning}`, hl: inSeg ? { seg, words: target } : undefined };
    if (entry.cite && entry.quote) yield { t: 'say', kind: 'commentator', text: `כך גם ברש״י: „${entry.quote}”.`, cite: entry.cite, quote: entry.quote };
  } else {
    const fromComment = ctx.commentaries
      .flatMap((c) => c.comments.map((x) => ({ c, x })))
      .find(({ x }) => x.segment === seg && x.dh && norm(x.dh).includes(norm(target!)));
    if (fromComment) {
      const body = words(fromComment.x.text.replace(fromComment.x.dh ?? '', ''), 18);
      yield {
        t: 'say',
        kind: 'commentator',
        text: `${fromComment.c.he} מסביר את זה: „${body}”`,
        cite: fromComment.x.ref,
        quote: words(fromComment.x.text, 6).replace('…', ''),
      };
    } else {
      yield meta(`אין לי במצב הדגמה הסבר בדוק למילה „${target}”, ואני לא רוצה לנחש. עם מפתח Claude אחפש אותה במקורות. אפשר גם לפתוח רש״י ולראות אם הוא מפרש אותה.`);
    }
  }
  if (ctx.pending.length) {
    yield meta('נחזור למה שאמרנו.');
    yield { t: 'resume_pending' };
  }
}

function* commentary(ctx: StudyContext, who: string): Generator<Step> {
  yield { t: 'open_commentary', who };
  const com = ctx.commentaries.find((c) => c.id === who);
  if (!com) {
    yield meta('לא הצלחתי לטעון את הפירוש הזה. ייתכן שהוא לא זמין למקור הזה.');
    return;
  }
  const seg = ctx.focusSeg;
  let list: Comment[] = com.comments.filter((c) => c.segment === seg);
  let at = seg;
  if (!list.length) {
    const next = com.comments.find((c) => c.segment > seg) ?? com.comments[com.comments.length - 1];
    if (!next) {
      yield meta(`ל${com.he} אין דיבורים על העמוד הזה.`);
      return;
    }
    at = next.segment;
    list = com.comments.filter((c) => c.segment === at);
    yield meta(`ל${com.he} אין דיבור על השורה הזאת. הדיבור הקרוב הוא על שורה ${at}.`);
    yield { t: 'focus', seg: at };
  }
  const script = DEMO[ctx.section.ref]?.segments[at] ?? [];
  for (const c of list.slice(0, 2)) {
    const authored = script.find((l) => l.cite === c.ref);
    if (authored) {
      yield line(authored, at);
      continue;
    }
    const dh = c.dh ? `דיבור המתחיל „${c.dh}”: ` : '';
    const body = c.dh ? plain(c.text).replace(/^.*?[–-]\s*/, '') : plain(c.text);
    yield {
      t: 'say',
      kind: 'commentator',
      text: `${com.he}, ${dh}${words(body, 30)}`,
      cite: c.ref,
      quote: words(body, 6).replace('…', ''),
      hl: { seg: at, words: c.dh ?? undefined },
    };
  }
  if (list.length > 2) yield meta(`יש ל${com.he} עוד ${list.length - 2} דיבורים על השורה הזאת. הם מסומנים בחלון הפירוש.`);
  yield { t: 'say', kind: 'question', text: 'מה אתה מבין מדבריו? מה הוא מוסיף על הפשט של הגמרא?' };
}

function* illustrate(ctx: StudyContext, variant: 'default' | 'compare' | 'change'): Generator<Step> {
  const demo = DEMO[ctx.section.ref];
  const spec = demo?.illustrations[variant] ?? demo?.illustrations.default;
  if (!spec) {
    yield meta('למקור הזה אין לי המחשה מוכנה במצב הדגמה. עם מפתח Claude אבנה המחשה מתוך המקור.');
    return;
  }
  if (variant !== 'default' && !demo?.illustrations[variant]) yield meta('אין לי במצב הדגמה גרסה כזאת, אז הנה ההמחשה הבסיסית.');
  yield { t: 'illustrate', spec };
  if (spec.kind === 'timeline' && !spec.changed) {
    yield { t: 'say', kind: 'explain', text: 'הנה ציר הלילה, מצאת הכוכבים עד עלות השחר. כל פס הוא שיטה אחת: רבי אליעזר עד שליש הלילה, חכמים עד חצות, רבן גמליאל עד עמוד השחר.' };
    yield { t: 'say', kind: 'meta', text: 'זו המחשה להסבר. הלילה מצויר בחלקים שווים רק לצורך ההמחשה. לחיצה על נקודה פותחת את המקור שלה.' };
  } else if (spec.kind === 'table') {
    yield { t: 'say', kind: 'explain', text: 'בטבלה שלוש השיטות זו מול זו: עד מתי, ומה הטעם לפי רש״י ולפי סוף המשנה.' };
  } else if (spec.changed) {
    yield { t: 'say', kind: 'explain', text: spec.changed };
    yield { t: 'say', kind: 'meta', text: 'שינוי בהמחשה הוא כלי להבנת הסברה, לא פסק הלכה.' };
  }
}

function* chat(ctx: StudyContext, text: string): Generator<Step> {
  const demo = DEMO[ctx.section.ref];
  const t = text.replace(/[״]/g, '"');
  if (demo) {
    // A claim about who holds what: check it against the Mishnah.
    const who = demo.claims.find((c) => c.who.test(t));
    const said = demo.claims.find((c) => c.key.test(t));
    if (who && said) {
      if (who === said) {
        yield { t: 'say', kind: 'meta', text: `נכון. ${who.whoHe} אומר ${who.holds}, כך כתוב במשנה:` };
        yield { t: 'say', kind: 'quote', text: `„${who.quote}”`, cite: who.cite, quote: who.quote, hl: { seg: Number(who.cite.split(':')[1]) } };
      } else {
        yield {
          t: 'say',
          kind: 'meta',
          text: `לא בדיוק. לפי המשנה ${who.whoHe} אומר ${who.holds}. „${said.holds}” זו שיטת ${said.whoHe}. בוא נסתכל בלשון:`,
        };
        yield { t: 'say', kind: 'quote', text: `„${who.quote}”`, cite: who.cite, quote: who.quote, hl: { seg: Number(who.cite.split(':')[1]) } };
      }
      return;
    }
    for (const a of demo.answers) {
      if (!a.match.test(t)) continue;
      if (a.lines.length) {
        for (const l of a.lines) yield line(l);
      } else {
        const explain = (demo.segments[ctx.focusSeg] ?? []).filter((l) => l.kind === 'explain');
        if (explain.length) for (const l of explain) yield line(l, ctx.focusSeg);
        else yield* segmentSteps(ctx, ctx.focusSeg);
      }
      return;
    }
  }
  const quoted = t.match(/["„“](.+?)["”]/)?.[1];
  if (quoted && /(ציטוט|תצטט|כתוב|אומר)/.test(t)) {
    const all = [
      ...ctx.section.segments.map((s, i) => ({ ref: `${ctx.section.ref}:${i + 1}`, text: s, seg: i + 1 })),
      ...ctx.commentaries.flatMap((c) => c.comments.map((x) => ({ ref: x.ref, text: x.text, seg: x.segment }))),
    ];
    const hit = all.find((x) => norm(x.text).includes(norm(quoted)));
    if (hit) {
      yield { t: 'say', kind: 'quote', text: `מצאתי: „${quoted}”.`, cite: hit.ref, quote: quoted, hl: { seg: hit.seg, words: quoted } };
    } else {
      yield meta(`חיפשתי את הלשון „${quoted}” בעמוד ובמפרשים הפתוחים ולא מצאתי אותה. ייתכן שהנוסח שונה או שהמקור במקום אחר. אני לא אצטט מה שלא מצאתי.`);
    }
    return;
  }
  yield meta('במצב הדגמה אני יכול לקרוא, להסביר מילים מהמילון שהוכן, לפתוח מפרשים, להמחיש ולבדוק טענה על השיטות בעמוד הזה. לשאלה חופשית צריך לחבר מפתח Claude בהגדרות.');
}

function* summary(ctx: StudyContext): Generator<Step> {
  const demo = DEMO[ctx.section.ref];
  if (demo) {
    yield meta('סיכום קצר של מה שלמדנו:');
    for (const s of demo.summary.learned) yield { t: 'say', kind: 'explain', text: s };
    yield { t: 'say', kind: 'meta', text: `מושגים חדשים: ${demo.summary.terms.join(', ')}.` };
    yield { t: 'say', kind: 'question', text: `שאלה לחזרה: ${demo.summary.review[0]}` };
  } else {
    yield meta(`קראנו עד שורה ${ctx.readUpTo} ב${ctx.section.heRef}. סיכום תוכן מלא זמין עם מפתח Claude.`);
  }
  yield { t: 'say', kind: 'meta', text: 'אם הרגשת שהבנת, אפשר לסמן את העמוד כ„נלמד” בכפתור שליד שם המקור.' };
}

export const demoBrain: Brain = {
  demo: true,
  async *respond(req: BrainRequest, signal: AbortSignal) {
    const { ctx } = req;
    let gen: Iterable<Step>;
    switch (req.kind) {
      case 'opened':
        gen = opened(ctx);
        break;
      case 'continue': {
        const seg = nextSeg(ctx);
        if (seg > ctx.section.segments.length) {
          gen = [meta('סיימנו את העמוד. רוצה לסכם, לעבור לעמוד הבא או לחזור על משהו?')];
        } else gen = segmentSteps(ctx, seg);
        break;
      }
      case 'word':
        gen = explainWord(ctx, req);
        break;
      case 'commentary':
        gen = commentary(ctx, req.commentator ?? 'Rashi');
        break;
      case 'illustrate':
        gen = illustrate(ctx, req.variant ?? 'default');
        break;
      case 'summary':
        gen = summary(ctx);
        break;
      case 'resume': {
        // A short recap of what was already learned here, then back to the exact place.
        const recap = DEMO[ctx.section.ref]?.summary.learned[0];
        const intro: Step[] = [meta(`חוזרים ל${ctx.section.heRef}${ctx.pending.length ? ', למקום שבו עצרנו' : `, שורה ${ctx.focusSeg}`}.`)];
        if (recap && ctx.focusSeg > 1) intro.push({ t: 'say', kind: 'explain', text: `בקצרה, מה שלמדנו: ${recap}` });
        gen = ctx.pending.length ? [...intro, { t: 'resume_pending' }] : [...intro, ...segmentSteps(ctx, ctx.focusSeg)];
        break;
      }
      case 'repeat':
        gen = ctx.pending.length ? [{ t: 'resume_pending' }] : segmentSteps(ctx, ctx.focusSeg);
        break;
      default:
        gen = chat(ctx, req.text ?? '');
    }
    for (const step of gen) {
      if (signal.aborted) return;
      // A short beat between steps, like a person speaking.
      await new Promise((r) => setTimeout(r, 30));
      yield step;
    }
  },
};

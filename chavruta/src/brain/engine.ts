// The turn engine: takes what the learner said, decides what to do, asks the brain for
// an explanation, verifies it, plays it line by line with highlighting, and keeps an exact
// record of what was heard. Interruptions stop everything at once (generation, queued
// audio, the mouth) and remember the unheard lines so we can return to them.
import { clean, parseCommand, type Intent } from '../core/commands';
import { norm, plain, tokenize } from '../core/hebrew';
import type { Illustration } from '../core/illustration';
import { illustrationRefs } from '../core/illustration';
import { COMMENTATORS } from '../core/lexicon';
import { stepAmud, targetToHebrew, targetToSefaria, type Target } from '../core/refs';
import {
  currentParasha,
  defaultCommentators,
  loadCommentary,
  loadLinks,
  loadSection,
  resolveName,
  SourceError,
  SNAPSHOT_REFS,
  type Section,
} from '../core/sefaria';
import { checkCitation } from '../core/verify';
import { speaker } from '../speech/tts';
import { useStudy, type HeardLine, type SayKind } from '../state/store';
import { ClaudeBrain, costOf, describeError } from './claude';
import { demoBrain } from './demo';
import type { Brain, BrainRequest, RequestKind, Step, StudyContext } from './types';

const st = () => useStudy.getState();
const set = (p: Parameters<ReturnType<typeof useStudy.getState>['set']>[0]) => st().set(p);

interface Playing {
  turnId: number;
  ac: AbortController;
  queue: Step[];
  line: HeardLine | null;
  lineIndex: number;
  ref: string;
}

let cachedBrain: { key: string; brain: Brain } | null = null;

export function getBrain(): Brain {
  const s = st().settings;
  if (!s.apiKey.trim()) return demoBrain;
  const effort = s.level === 'iyun' && s.effort === 'low' ? 'medium' : s.effort;
  const key = `${s.apiKey}|${s.model}|${effort}`;
  if (cachedBrain?.key !== key) {
    const brain = new ClaudeBrain(s.apiKey.trim(), s.model, effort);
    brain.onUsage = (u) => {
      const c = st().costs;
      set({
        costs: {
          inputTokens: c.inputTokens + u.inputTokens,
          outputTokens: c.outputTokens + u.outputTokens,
          cacheReadTokens: c.cacheReadTokens + u.cacheReadTokens,
          cacheWriteTokens: c.cacheWriteTokens + u.cacheWriteTokens,
          usd: c.usd + costOf(u),
          requests: c.requests + 1,
        },
      });
    };
    cachedBrain = { key, brain };
  }
  return cachedBrain.brain;
}

const ORDINALS: Record<string, number> = { ראשון: 0, הראשון: 0, ראשונה: 0, א: 0, '1': 0, שני: 1, השני: 1, שנייה: 1, ב: 1, '2': 1, שלישי: 2, השלישי: 2, ג: 2, '3': 2 };

class Engine {
  private playing: Playing | null = null;
  /** Texts already in hand, so citations to the open page are checked without a network call. */
  private known = new Map<string, string>();
  private brainOverride: Brain | null = null;

  /** For tests: use a specific brain. */
  setBrain(b: Brain | null) {
    this.brainOverride = b;
  }

  private brain(): Brain {
    return this.brainOverride ?? getBrain();
  }

  get busy() {
    return !!this.playing;
  }

  /** The line being spoken right now (for echo filtering). */
  get speakingText() {
    return this.playing?.line?.text ?? '';
  }

  // ───────────────────────── input ─────────────────────────

  async handleInput(raw: string) {
    const text = raw.trim();
    if (!text) return;
    if (this.playing) this.interrupt();
    set({ interim: '' });
    st().addTurn({ role: 'user', text, lines: [], ref: st().section?.ref });

    const clarify = st().clarify;
    if (clarify) {
      set({ clarify: null });
      const picked = this.pickOption(text, clarify.options);
      if (picked) return this.dispatch(picked.payload as Intent);
    }
    return this.dispatch(parseCommand(text));
  }

  private pickOption(text: string, options: { label: string; payload: unknown }[]) {
    if (!options.length) return null;
    const t = norm(text);
    const byLabel = options.find((o) => norm(o.label) && (t.includes(norm(o.label)) || norm(o.label).includes(t)));
    if (byLabel) return byLabel;
    const first = clean(text).split(' ').find((w) => w in ORDINALS);
    if (first !== undefined) return options[ORDINALS[first]] ?? null;
    if (/^(כן|נכון|בדיוק|אכן|יאללה)/.test(clean(text)) && options.length === 1) return options[0];
    return null;
  }

  async dispatch(intent: Intent): Promise<void> {
    switch (intent.type) {
      case 'open':
        return this.openTarget(intent.target, intent.thenCommentary);
      case 'clarify':
        set({ clarify: { question: intent.question, options: intent.options.map((o) => ({ label: o.label, payload: o.intent })) } });
        return this.sayLocal(intent.question, 'question');
      case 'say':
        return this.sayLocal(intent.text, 'meta');
      case 'commentary':
        if (!st().section) return this.noSection();
        if (intent.action === 'close') {
          this.closeCommentary(intent.who);
          return;
        }
        return this.brainTurn('commentary', { commentator: intent.who });
      case 'nav':
        return this.navigate(intent.dir);
      case 'resume':
        return this.resumeStudy();
      case 'showWhere':
        return this.showWhere();
      case 'illustrate':
        return this.brainTurn('illustrate', { variant: intent.variant, text: intent.text });
      case 'stop':
        this.interrupt();
        set({ avatar: 'waiting' });
        return;
      case 'continue':
        return this.brainTurn('continue');
      case 'repeat':
        return this.brainTurn('repeat');
      case 'word':
        return this.brainTurn('word', { word: intent.word, text: intent.text });
      case 'summary':
        return this.brainTurn('summary');
      case 'style':
        st().setSettings({ style: intent.style });
        return this.sayLocal(intent.style === 'hint' ? 'בסדר. אתן לך לנסות, ואעזור ברמזים.' : 'בסדר. אסביר ישירות.', 'meta');
      case 'chat':
        if (!st().section) return this.noSection();
        return this.brainTurn('chat', { text: intent.text });
    }
  }

  /** Opening line of a session: offer to continue from the last place, or ask what to learn. */
  async greet() {
    const r = st().resume;
    if (r) {
      set({
        clarify: {
          question: 'נמשיך?',
          options: [
            { label: 'כן, נמשיך', payload: { type: 'resume' } satisfies Intent },
            { label: 'משהו אחר', payload: { type: 'say', text: 'בסדר. מה נלמד היום?' } satisfies Intent },
          ],
        },
      });
      return this.sayLocal(`שלום! בפעם הקודמת למדנו ${r.he}${r.pending.length ? ', והפסקנו באמצע הסבר' : ''}. נמשיך משם, ונחזור בקצרה על מה שלמדנו?`, 'question');
    }
    return this.sayLocal('שלום! אני החברותא שלך, חברותא מבוססת בינה מלאכותית. מה נלמד היום?', 'question');
  }

  private noSection() {
    return this.sayLocal('מה נלמד היום? אפשר לומר למשל „בוא נלמד ברכות דף ב׳ עמוד א׳”, „משנה ברכות פרק א׳” או „פרשת השבוע”.', 'question');
  }

  // ───────────────────────── sources ─────────────────────────

  async openTarget(target: Target, thenCommentary?: string) {
    const label = targetToHebrew(target);
    let ref: string | null = targetToSefaria(target);
    this.cancel();
    set({ loading: label, avatar: 'checking', error: null });
    try {
      if (target.kind === 'parasha') {
        const p = await currentParasha();
        ref = p.ref;
      } else if (target.kind === 'name') {
        const r = await resolveName(target.text);
        if (!r) {
          set({ loading: null });
          return this.sayLocal(`לא מצאתי מקור בשם „${target.text}”. אפשר לנסח אחרת?`, 'meta');
        }
        ref = r.ref;
      }
      await this.openRef(ref!, { thenCommentary });
    } catch (e) {
      set({ loading: null, avatar: 'waiting' });
      this.sourceError(e, label);
    }
  }

  /** Opens a Sefaria ref as the study page. */
  async openRef(ref: string, opts: { thenCommentary?: string; silent?: boolean; keepResume?: boolean } = {}) {
    this.cancel();
    const epoch = st().epoch + 1;
    const keepOpen = st().openCommentaries;
    // New page: bump the epoch first so nothing still in flight can mark the new page.
    set({ epoch, loading: st().loading ?? ref, avatar: 'checking', highlight: null, illustration: null, clarify: null });
    let section: Section;
    try {
      section = await loadSection(ref);
    } catch (e) {
      if (st().epoch === epoch) set({ loading: null, avatar: 'waiting' });
      this.sourceError(e, ref);
      return;
    }
    if (st().epoch !== epoch) return; // the learner moved on while this was loading
    const prevKind = st().section?.kind;
    this.known.clear();
    section.segments.forEach((s, i) => this.known.set(`${section.ref}:${i + 1}`, plain(s)));
    set({
      section,
      loading: null,
      error: null,
      focusSeg: section.focus?.from ?? 1,
      readUpTo: 0,
      selection: null,
      commentaries: {},
      openCommentaries: [],
      activeCommentary: null,
      commentHighlight: null,
      links: [],
    });
    st().markProgress(section.ref, section.heRef, 'opened', section.focus?.from ?? 1);
    // An explanation cut off mid-way stays the place to return to until learning moves on.
    if (!opts.keepResume && !st().resume?.pending.length) {
      set({ resume: { ref: section.ref, he: section.heRef, seg: section.focus?.from ?? 1, pending: [] } });
    }

    // Commentaries: reopen the ones that were open (same kind of text), preload the defaults.
    const reopen = prevKind === section.kind ? keepOpen : [];
    const defaults = defaultCommentators(section.kind).map((c) => c.id);
    await Promise.all(
      [...new Set([...reopen, ...defaults])].map((id) => this.loadCommentaryInto(id, section, epoch, reopen.includes(id)).catch(() => undefined)),
    );
    loadLinks(section)
      .then((links) => st().epoch === epoch && set({ links }))
      .catch(() => undefined);
    if (st().epoch !== epoch) return;
    if (opts.thenCommentary) await this.openCommentary(opts.thenCommentary);
    if (!opts.silent) await this.brainTurn('opened');
  }

  private async loadCommentaryInto(id: string, section: Section, epoch: number, open: boolean, he?: string) {
    const c = await loadCommentary(id, section, he);
    if (st().epoch !== epoch) return null;
    c.comments.forEach((x) => this.known.set(x.ref, plain(x.text)));
    set({ commentaries: { ...st().commentaries, [id]: c } });
    if (open) set({ openCommentaries: [...new Set([...st().openCommentaries, id])], activeCommentary: id });
    return c;
  }

  /** Resolves "רש״י" / "Rashi" / a linked commentary name to an id. */
  resolveCommentator(who: string): { id: string; he?: string } | null {
    const w = norm(who);
    const known = COMMENTATORS.find((c) => c.id.toLowerCase() === who.toLowerCase() || [c.he, ...c.variants].some((v) => norm(v) === w));
    if (known) return { id: known.id };
    const link = st().links.find((l) => l.relation === 'commentary' && (l.id.toLowerCase() === who.toLowerCase() || norm(l.he) === w));
    return link ? { id: link.id, he: link.he } : null;
  }

  async openCommentary(who: string): Promise<boolean> {
    const section = st().section;
    if (!section) return false;
    const r = this.resolveCommentator(who);
    if (!r) {
      await this.sayLocal(`לא מצאתי פירוש בשם „${who}” על ${section.heRef}.`, 'meta');
      return false;
    }
    const have = st().commentaries[r.id];
    if (have) {
      set({ openCommentaries: [...new Set([...st().openCommentaries, r.id])], activeCommentary: r.id });
      return true;
    }
    set({ avatar: 'checking' });
    try {
      await this.loadCommentaryInto(r.id, section, st().epoch, true, r.he);
      return true;
    } catch {
      await this.sayLocal(`הפירוש ${r.he ?? who} לא זמין על ${section.heRef}${section.origin === 'snapshot' ? ' בעותק השמור במכשיר' : ''}.`, 'meta');
      return false;
    }
  }

  closeCommentary(who: string) {
    const r = this.resolveCommentator(who);
    const open = st().openCommentaries.filter((id) => id !== r?.id);
    set({ openCommentaries: open, activeCommentary: open[open.length - 1] ?? null });
  }

  async navigate(dir: 1 | -1) {
    const s = st().section;
    if (!s) return this.noSection();
    const ref = s.kind === 'talmud' ? stepAmud(s.ref, dir) : dir === 1 ? s.next : s.prev;
    if (!ref) return this.sayLocal(dir === 1 ? 'זה סוף המסכת.' : 'זו תחילת המסכת.', 'meta');
    await this.openRef(ref);
  }

  private sourceError(e: unknown, label: string) {
    const offline = e instanceof SourceError && e.reason === 'offline';
    const notFound = e instanceof SourceError && e.reason === 'not-found';
    const msg = offline
      ? `אין חיבור לספריא, ו${label} לא נמצא בעותק השמור במכשיר. בעותק השמור: ברכות ב׳–ג׳, משנה ברכות פרק א׳ ובראשית פרק א׳.`
      : notFound
        ? `לא מצאתי את ${label} בספריא. ייתכן שהדף או הפרק לא קיימים. אפשר לבדוק את המספר?`
        : `לא הצלחתי לפתוח את ${label}: ${(e as Error).message}`;
    set({ error: msg });
    void this.sayLocal(msg, 'meta');
  }

  // ───────────────────────── study actions ─────────────────────────

  async resumeStudy() {
    const r = st().resume;
    const latest = Object.values(st().progress).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const ref = r?.ref ?? latest?.ref;
    if (!ref) return this.sayLocal('עוד לא למדנו יחד. מה נלמד?', 'question');
    if (st().section?.ref !== ref) {
      await this.openRef(ref, { silent: true, keepResume: true });
      if (st().section?.ref !== ref) return;
    }
    const seg = r?.ref === ref ? r.seg : (latest?.lastSeg ?? 1);
    set({ focusSeg: seg, highlight: { ref, seg, epoch: st().epoch } });
    return this.brainTurn('resume');
  }

  async showWhere() {
    const lc = st().lastCitation;
    const s = st().section;
    if (!lc || !s) return this.sayLocal('עוד לא הבאתי מקור בשיחה הזאת. על איזה דבר אתה שואל?', 'question');
    const mine = lc.ref.startsWith(`${s.ref}:`);
    const comment = lc.ref.match(/^(.*) on (.*) (\S+?):(\d+):\d+$/);
    if (mine) {
      const seg = Number(lc.ref.slice(s.ref.length + 1).split(':')[0]);
      set({ focusSeg: seg, highlight: { ref: s.ref, seg, epoch: st().epoch } });
      return this.sayLocal(`כאן, בשורה ${seg}. סימנתי אותה בדף.`, 'meta');
    }
    if (comment && `${comment[2]} ${comment[3]}` === s.ref) {
      const seg = Number(comment[4]);
      await this.openCommentary(comment[1]);
      set({ commentHighlight: lc.ref, focusSeg: seg, highlight: { ref: s.ref, seg, epoch: st().epoch } });
      return this.sayLocal('סימנתי את הדיבור בחלון הפירוש ואת השורה בדף.', 'meta');
    }
    await this.openRef(lc.ref, { silent: true });
    return this.sayLocal('פתחתי את המקור וסימנתי אותו.', 'meta');
  }

  // ───────────────────────── speaking ─────────────────────────

  private context(): StudyContext {
    const s = st();
    const section = s.section!;
    const pending = s.resume?.ref === section.ref ? s.resume.pending : [];
    const lastChavruta = [...s.turns].reverse().find((t) => t.role === 'chavruta' && t.ref === section.ref);
    const cut = lastChavruta?.lines.find((l) => l.cutAt !== undefined) ?? null;
    return {
      section,
      focusSeg: s.focusSeg,
      readUpTo: s.readUpTo,
      selection: s.selection,
      commentaries: Object.values(s.commentaries),
      activeCommentary: s.activeCommentary,
      level: s.settings.level,
      style: s.settings.style,
      history: s.turns.slice(-12),
      pending,
      interruptedLine: lastChavruta?.interrupted ? cut : null,
    };
  }

  /** Says a short line that does not come from the brain (confirmations, errors, questions). */
  async sayLocal(text: string, kind: SayKind) {
    this.cancel();
    const turnId = st().addTurn({ role: 'chavruta', lines: [], ref: st().section?.ref });
    const ac = new AbortController();
    this.playing = { turnId, ac, queue: [], line: null, lineIndex: 0, ref: st().section?.ref ?? '' };
    try {
      await this.playSay({ t: 'say', text, kind }, this.playing, st().epoch);
    } finally {
      if (this.playing?.ac === ac) {
        this.playing = null;
        set({ avatar: st().clarify ? 'listening' : 'waiting', caption: null });
      }
    }
  }

  async brainTurn(kind: RequestKind, extra: Partial<BrainRequest> = {}) {
    if (!st().section) return this.noSection();
    this.cancel();
    const section = st().section!;
    // "Continue" after an interruption first replays what was not heard.
    const resume = st().resume;
    if (kind === 'continue' && resume?.ref === section.ref && resume.pending.length) kind = 'resume';
    const epoch = st().epoch;
    const turnId = st().addTurn({ role: 'chavruta', lines: [], ref: section.ref });
    const ac = new AbortController();
    const p: Playing = { turnId, ac, queue: [], line: null, lineIndex: 0, ref: section.ref };
    this.playing = p;
    set({ avatar: 'thinking' });
    const req: BrainRequest = { kind, ctx: this.context(), ...extra };

    let done = false;
    let failure: unknown = null;
    const bell: { wake: (() => void) | null } = { wake: null };
    const producer = (async () => {
      try {
        for await (const step of this.brain().respond(req, ac.signal)) {
          if (ac.signal.aborted) break;
          p.queue.push(step);
          bell.wake?.();
        }
      } catch (e) {
        if (!ac.signal.aborted) failure = e;
      } finally {
        done = true;
        bell.wake?.();
      }
    })();

    while (!ac.signal.aborted) {
      if (st().epoch !== epoch) break;
      const step = p.queue.shift();
      if (step) {
        await this.play(step, p, epoch);
        continue;
      }
      if (done) break;
      await new Promise<void>((r) => (bell.wake = r));
      bell.wake = null;
    }
    await producer;
    if (this.playing === p) {
      this.playing = null;
      if (failure) {
        await this.sayLocal(describeError(failure), 'meta');
        return;
      }
      set({ avatar: st().clarify ? 'listening' : 'waiting', caption: null });
    }
  }

  private async play(step: Step, p: Playing, epoch: number) {
    const s = st();
    const stale = s.epoch !== epoch || s.section?.ref !== p.ref;
    if (stale) return;
    switch (step.t) {
      case 'say':
        return this.playSay(step, p, epoch);
      case 'focus':
        if (step.seg >= 1 && step.seg <= (s.section?.segments.length ?? 0)) {
          set({ focusSeg: step.seg, highlight: { ref: p.ref, seg: step.seg, epoch } });
        }
        return;
      case 'select_word':
        return this.selectWord(step.seg, step.word);
      case 'open_commentary':
        await this.openCommentary(step.who);
        return;
      case 'illustrate':
        return this.showIllustration(step.spec, epoch);
      case 'clarify': {
        const wordQ = /מילה/.test(step.question);
        set({
          clarify: {
            question: step.question,
            options: step.options.map((label) => ({
              label,
              payload: (wordQ ? { type: 'word', word: label, text: label } : { type: 'chat', text: `${step.question} — ${label}` }) satisfies Intent,
            })),
          },
        });
        return this.playSay({ t: 'say', text: step.question, kind: 'question' }, p, epoch);
      }
      case 'resume_pending': {
        const r = st().resume;
        if (!r || r.ref !== p.ref || !r.pending.length) return;
        const lines = r.pending;
        set({ resume: { ...r, pending: [] } });
        for (let i = 0; i < lines.length; i++) {
          if (p.ac.signal.aborted || st().epoch !== epoch) {
            // Interrupted again: keep what is still unheard.
            const rest = lines.slice(i);
            const cur = st().resume;
            if (cur) set({ resume: { ...cur, pending: [...rest, ...cur.pending.filter((x) => !rest.includes(x))] } });
            return;
          }
          const l = lines[i];
          await this.playSay({ t: 'say', text: l.text, kind: l.kind, cite: l.cite, hl: l.hlSeg ? { seg: l.hlSeg, words: l.hlWords } : undefined, verified: true }, p, epoch);
        }
        return;
      }
      case 'mark': {
        const sec = st().section!;
        const all = st().readUpTo >= sec.segments.length;
        st().markProgress(sec.ref, sec.heRef, all ? 'read' : 'opened', st().focusSeg);
        set({ resume: { ref: sec.ref, he: sec.heRef, seg: st().focusSeg, pending: st().resume?.ref === sec.ref ? st().resume!.pending : [] } });
        return;
      }
    }
  }

  private selectWord(seg: number, word: string) {
    const s = st().section;
    if (!s) return;
    const toks = tokenize(s.segments[seg - 1] ?? '').filter((t) => !t.sep);
    const first = norm(word).replace(/ /g, '').slice(0, 40);
    const key = norm(word.split(' ')[0]).replace(/ /g, '');
    let idx = toks.findIndex((t) => t.key === key);
    if (idx < 0) idx = toks.findIndex((t) => t.key.endsWith(key) || key.endsWith(t.key));
    if (idx < 0) return;
    set({ selection: { ref: s.ref, seg, word: idx, text: word }, focusSeg: seg, highlight: { ref: s.ref, seg, words: first ? word : undefined, epoch: st().epoch } });
  }

  private async showIllustration(spec: Illustration, epoch: number) {
    set({ avatar: 'checking' });
    const refs = illustrationRefs(spec);
    const bad = new Set<string>();
    await Promise.all(
      refs.map(async (r) => {
        const c = await checkCitation(r, null, this.known);
        if (!c.ok && c.reason !== 'offline') bad.add(r);
      }),
    );
    if (st().epoch !== epoch) return;
    // Sources that could not be found are removed rather than shown as if they back the drawing.
    const clean = { ...spec, sources: spec.sources.filter((x) => !bad.has(x.ref)) } as Illustration;
    if (bad.size) clean.assumptions = [...clean.assumptions, `${bad.size} הפניות שלא נמצאו הוסרו מההמחשה.`];
    set({ illustration: clean });
  }

  private async playSay(step: Extract<Step, { t: 'say' }> & { verified?: boolean }, p: Playing, epoch: number) {
    let { text, kind } = step;
    let unverified = false;
    const s0 = st();
    if (step.cite && !step.verified) {
      set({ avatar: 'checking' });
      const check = await checkCitation(step.cite, step.quote ?? null, this.known);
      if (p.ac.signal.aborted || st().epoch !== epoch) return;
      if (!check.ok) {
        if (check.reason === 'offline') unverified = true;
        else if (check.reason === 'quote-not-found') {
          text = `רציתי לצטט כאן, אבל לא מצאתי את הלשון הזה במקור שציינתי, אז אני לא אצטט אותו.`;
          kind = 'meta';
        } else {
          text = `רציתי להביא מקור (${step.cite}), אבל לא מצאתי אותו. אני לא אסתמך עליו.`;
          kind = 'meta';
        }
      }
    }
    const citeOk = kind !== 'meta' ? step.cite : undefined;
    const hl = kind !== 'meta' || !step.cite ? step.hl : undefined;
    const section = s0.section;
    if (hl && section && section.ref === p.ref && hl.seg >= 1 && hl.seg <= section.segments.length) {
      set({ focusSeg: hl.seg, highlight: { ref: p.ref, seg: hl.seg, words: hl.words, epoch } });
    }
    if (citeOk) {
      const seg = citeOk.startsWith(`${p.ref}:`) ? Number(citeOk.slice(p.ref.length + 1).split(':')[0]) : hl?.seg;
      set({ lastCitation: { ref: citeOk, seg } });
      if (/ on /.test(citeOk)) set({ commentHighlight: citeOk });
    }
    const line: HeardLine & { hlSeg?: number; hlWords?: string } = {
      text,
      kind,
      cite: citeOk,
      heard: false,
      unverified,
      hlSeg: hl?.seg,
      hlWords: hl?.words,
    };
    p.line = line;
    st().updateTurn(p.turnId, (t) => ({ ...t, lines: [...t.lines, line] }));
    const idx = st().turns.find((t) => t.id === p.turnId)!.lines.length - 1;
    set({ avatar: 'speaking', caption: { text, kind } });
    const settings = st().settings;
    const r = await speaker.speak(text, {
      rate: settings.rate,
      volume: settings.volume,
      voiceURI: settings.voiceURI,
      passage: section ? plain(section.segments.join(' ')) : '',
    });
    const update = (f: (l: HeardLine) => HeardLine) =>
      st().updateTurn(p.turnId, (t) => ({ ...t, lines: t.lines.map((l, i) => (i === idx ? f(l) : l)) }));
    if (r.status === 'done') {
      update((l) => ({ ...l, heard: true }));
      if (kind === 'quote' && hl && st().epoch === epoch) set({ readUpTo: Math.max(st().readUpTo, hl.seg) });
    } else {
      update((l) => ({ ...l, cutAt: r.spokenChars }));
    }
    if (p.line === line) p.line = null;
  }

  // ───────────────────────── stopping ─────────────────────────

  /**
   * The learner cut in (spoke, pressed stop, or typed). Stops generation, speech, queued
   * lines and the mouth immediately, and keeps the unheard lines for "נחזור".
   */
  interrupt() {
    const p = this.playing;
    if (!p) {
      speaker.cancel();
      return;
    }
    this.playing = null;
    p.ac.abort();
    const cut = p.line;
    const unheardSays = p.queue.filter((s): s is Extract<Step, { t: 'say' }> => s.t === 'say');
    p.queue.length = 0;
    speaker.cancel();
    const pending: HeardLine[] = [
      ...(cut && cut.kind !== 'meta' && cut.kind !== 'question' ? [cut] : []),
      ...unheardSays
        .filter((s) => s.kind !== 'meta')
        .map((s) => ({ text: s.text, kind: s.kind, cite: s.cite, heard: false, hlSeg: s.hl?.seg, hlWords: s.hl?.words }) as HeardLine),
    ];
    st().updateTurn(p.turnId, (t) => ({ ...t, interrupted: true }));
    const sec = st().section;
    if (sec && sec.ref === p.ref) {
      const cur = st().resume;
      const prev = cur?.ref === sec.ref ? cur.pending : [];
      if (pending.length) {
        set({ resume: { ref: sec.ref, he: sec.heRef, seg: st().focusSeg, pending: [...pending, ...prev.filter((x) => !pending.some((y) => y.text === x.text))] } });
      } else if (!cur?.pending.length) {
        set({ resume: { ref: sec.ref, he: sec.heRef, seg: st().focusSeg, pending: [] } });
      }
      // Otherwise keep the earlier place where an explanation was cut off.
    }
    set({ avatar: 'listening', caption: null });
  }

  /** Stops whatever is running without treating it as an interruption (new request, navigation). */
  cancel() {
    const p = this.playing;
    this.playing = null;
    if (p) p.ac.abort();
    speaker.cancel();
  }
}

export const engine = new Engine();

// For the browser console and end-to-end tests.
declare global {
  interface Window {
    __chavruta?: { engine: Engine; store: typeof useStudy; snapshotRefs: string[] };
  }
}
if (typeof window !== 'undefined') window.__chavruta = { engine, store: useStudy, snapshotRefs: SNAPSHOT_REFS };

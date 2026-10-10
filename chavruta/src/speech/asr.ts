// Listening: the Web Speech API in Hebrew, continuously (open mic) or while a button is held
// (push to talk). Final results are held briefly so a pause to think does not end the turn.
// The listener also reports interim speech, which is what lets the learner cut in.

interface RecognitionAlt {
  transcript: string;
  confidence: number;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlt;
  length: number;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const recognitionSupported = () => typeof window !== 'undefined' && !!ctor();

export interface ListenerEvents {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onState: (listening: boolean) => void;
  onError: (message: string) => void;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'אין הרשאה למיקרופון. אפשר לאשר בהגדרות הדפדפן, או להקליד.',
  'service-not-allowed': 'זיהוי הדיבור חסום בדפדפן הזה. אפשר להקליד.',
  'audio-capture': 'לא נמצא מיקרופון.',
  network: 'זיהוי הדיבור דורש חיבור לאינטרנט. אפשר להקליד.',
  'language-not-supported': 'הדפדפן לא תומך בזיהוי דיבור בעברית.',
};

export class Listener {
  private rec: Recognition | null = null;
  private wanted = false;
  private buffer = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  endOfTurnMs = 1300;

  constructor(private ev: ListenerEvents) {}

  get active() {
    return this.wanted;
  }

  start() {
    const C = ctor();
    if (!C) {
      this.ev.onError('הדפדפן הזה לא תומך בזיהוי דיבור. מומלץ Chrome או Edge. אפשר להקליד.');
      return;
    }
    this.wanted = true;
    if (this.rec) return;
    const rec = new C();
    rec.lang = 'he-IL';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => this.ev.onState(true);
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript.trim();
        if (!t) continue;
        if (r.isFinal) {
          // Very low confidence on a short result is usually background noise.
          if (r[0].confidence > 0 && r[0].confidence < 0.35 && t.split(' ').length < 2) continue;
          this.buffer = `${this.buffer} ${t}`.trim();
          this.scheduleFlush();
        } else interim += ` ${t}`;
      }
      const shown = `${this.buffer} ${interim}`.trim();
      if (interim.trim()) {
        // Still talking: do not end the turn yet.
        if (this.flushTimer) this.scheduleFlush();
      }
      this.ev.onInterim(shown);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (ERRORS[e.error]) {
        this.wanted = false;
        this.ev.onError(ERRORS[e.error]);
      }
    };
    rec.onend = () => {
      this.rec = null;
      if (this.wanted) setTimeout(() => this.wanted && this.start(), 200);
      else {
        this.flush();
        this.ev.onState(false);
      }
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), this.endOfTurnMs);
  }

  private flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const t = this.buffer.trim();
    this.buffer = '';
    if (t) this.ev.onFinal(t);
  }

  /** Push-to-talk release: send what was said right away. */
  release() {
    this.wanted = false;
    this.rec?.stop();
    setTimeout(() => this.flush(), 350);
  }

  stop() {
    this.wanted = false;
    this.buffer = '';
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.rec?.abort();
    this.rec = null;
    this.ev.onState(false);
  }
}

/**
 * Was this interim speech the learner, or our own voice coming back through the speakers?
 * Returns true when most of the heard words are words the chavruta is saying right now.
 */
export function isEcho(heard: string, speaking: string): boolean {
  const strip = (s: string) =>
    s
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/[^\u05D0-\u05EA ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  const h = strip(heard);
  if (!h.length) return true;
  const said = new Set(strip(speaking));
  const overlap = h.filter((w) => said.has(w)).length / h.length;
  return overlap >= 0.6;
}

const BARGE_WORDS = /(רגע|עצור|שנייה|שניה|סליחה|לא הבנתי|חכה|המתן|תעצור|די)/;

/** Should this interim speech stop the chavruta? (Two real words, or an explicit "wait"). */
export function shouldBargeIn(heard: string, speaking: string): boolean {
  const words = heard.trim().split(/\s+/).filter(Boolean);
  if (BARGE_WORDS.test(heard)) return !isEcho(heard, speaking) || words.length <= 2;
  return words.length >= 2 && !isEcho(heard, speaking);
}

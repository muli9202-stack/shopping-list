// Speaking: the browser's speechSynthesis, one sentence at a time so an interruption stops
// within a sentence and we know exactly what was heard. The mouth moves only while audio
// is actually playing (driven by the start/boundary/end events) and closes the moment it stops.
import { speakable } from '../core/lexicon';
import { mouth } from '../state/store';

export type SpeakResult = { status: 'done' } | { status: 'cancelled'; spokenChars: number };

export interface SpeakOptions {
  rate: number;
  volume: number;
  voiceURI?: string;
  /** Text of the passage being studied, for expanding abbreviations correctly. */
  passage?: string;
  onSentence?: (index: number, sentence: string) => void;
}

const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

export function hebrewVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  if (!s) return [];
  return s.getVoices().filter((v) => v.lang.toLowerCase().startsWith('he') || v.lang.toLowerCase().startsWith('iw'));
}

/** Resolves once the voice list is loaded (Chrome loads it asynchronously). */
export function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const s = synth();
  if (!s) return Promise.resolve([]);
  if (s.getVoices().length) return Promise.resolve(hebrewVoices());
  return new Promise((resolve) => {
    const done = () => resolve(hebrewVoices());
    s.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

/** Splits text into sentences (keeping short fragments together). */
export function sentences(text: string): string[] {
  const parts = text.match(/[^.?!:;]+[.?!:;]*["״׳']?\s*/g) ?? [text];
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (out.length && (t.length < 12 || out[out.length - 1].length < 12)) out[out.length - 1] += ` ${t}`;
    else out.push(t);
  }
  return out;
}

class Speaker {
  private cancelCurrent: (() => void) | null = null;
  private raf = 0;
  private pulse = 0;
  private playing = false;
  /** Captions-only mode: no Hebrew voice available, lines are shown for a reading time instead. */
  silent = false;

  get speaking() {
    return this.playing;
  }

  private animate = () => {
    if (!this.playing) {
      mouth.set(0);
      return;
    }
    // A word boundary opens the mouth; it closes gradually until the next one. A gentle
    // syllable rhythm keeps it alive for voices that do not send boundary events.
    const t = performance.now() / 1000;
    const rhythm = 0.25 + 0.2 * Math.abs(Math.sin(t * 11)) * Math.abs(Math.sin(t * 3.3));
    this.pulse *= 0.86;
    mouth.set(Math.min(1, Math.max(rhythm, this.pulse)));
    this.raf = requestAnimationFrame(this.animate);
  };

  private startMouth() {
    this.playing = true;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.animate);
  }

  private stopMouth() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.pulse = 0;
    mouth.set(0);
  }

  /** Speaks one line. Resolves when it ends or is cancelled (with how much was spoken). */
  async speak(text: string, opts: SpeakOptions): Promise<SpeakResult> {
    const s = synth();
    const voice = (await voicesReady()).find((v) => v.voiceURI === opts.voiceURI) ?? hebrewVoices()[0];
    const parts = sentences(text);
    let spoken = 0;
    for (let i = 0; i < parts.length; i++) {
      opts.onSentence?.(i, parts[i]);
      const r = !s || !voice || this.silent ? await this.readSilently(parts[i], opts.rate) : await this.say(s, voice, parts[i], opts);
      if (r.status === 'cancelled') return { status: 'cancelled', spokenChars: spoken + r.spokenChars };
      spoken += parts[i].length + 1;
    }
    return { status: 'done' };
  }

  private say(s: SpeechSynthesis, voice: SpeechSynthesisVoice, sentence: string, opts: SpeakOptions): Promise<SpeakResult> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(speakable(sentence, opts.passage));
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = opts.rate;
      u.volume = opts.volume;
      let spokenChars = 0;
      let settled = false;
      const finish = (r: SpeakResult) => {
        if (settled) return;
        settled = true;
        this.cancelCurrent = null;
        this.stopMouth();
        resolve(r);
      };
      u.onstart = () => this.startMouth();
      u.onboundary = (e) => {
        spokenChars = Math.round((e.charIndex / Math.max(1, u.text.length)) * sentence.length);
        this.pulse = 1;
      };
      u.onend = () => finish({ status: 'done' });
      u.onerror = (e) => finish(e.error === 'interrupted' || e.error === 'canceled' ? { status: 'cancelled', spokenChars } : { status: 'done' });
      this.cancelCurrent = () => {
        finish({ status: 'cancelled', spokenChars });
        s.cancel();
      };
      s.speak(u);
    });
  }

  private readSilently(sentence: string, rate: number): Promise<SpeakResult> {
    return new Promise((resolve) => {
      const ms = Math.max(900, (sentence.split(/\s+/).length * 380) / rate);
      const started = performance.now();
      const timer = setTimeout(() => {
        this.cancelCurrent = null;
        resolve({ status: 'done' });
      }, ms);
      this.cancelCurrent = () => {
        clearTimeout(timer);
        this.cancelCurrent = null;
        const frac = Math.min(1, (performance.now() - started) / ms);
        resolve({ status: 'cancelled', spokenChars: Math.round(frac * sentence.length) });
      };
    });
  }

  /** Stops speech immediately and drops anything queued in the browser. */
  cancel() {
    this.cancelCurrent?.();
    synth()?.cancel();
    this.stopMouth();
  }
}

export const speaker = new Speaker();

// Simulated browser speech for tests: a Hebrew voice that "plays" each utterance for a time
// proportional to its length (with start/boundary/end events), and a recognizer the test
// drives with window.__speech.hear(text).
(() => {
  const MS_PER_CHAR = Number(window.__msPerChar || 18);
  const log = { spoken: [], cancelled: 0, current: null };
  const voice = { name: 'Test Hebrew', lang: 'he-IL', voiceURI: 'test-he', localService: true, default: true };
  let timers = [];
  let current = null;
  class Utterance {
    constructor(text) {
      this.text = text;
      this.rate = 1;
      this.volume = 1;
      this.lang = 'he-IL';
      this.voice = null;
    }
  }
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [voice],
    addEventListener() {},
    removeEventListener() {},
    speak(u) {
      current = u;
      log.current = u.text;
      synth.speaking = true;
      const dur = Math.max(120, u.text.length * MS_PER_CHAR);
      timers.push(setTimeout(() => u.onstart && u.onstart({}), 5));
      const words = u.text.split(' ');
      let pos = 0;
      words.forEach((w, i) => {
        const at = pos;
        timers.push(setTimeout(() => u.onboundary && u.onboundary({ charIndex: at, name: 'word' }), 10 + (dur * i) / words.length));
        pos += w.length + 1;
      });
      timers.push(
        setTimeout(() => {
          if (current !== u) return;
          current = null;
          log.current = null;
          synth.speaking = false;
          log.spoken.push(u.text);
          u.onend && u.onend({});
        }, dur),
      );
    },
    cancel() {
      log.cancelled++;
      timers.forEach(clearTimeout);
      timers = [];
      const u = current;
      current = null;
      log.current = null;
      synth.speaking = false;
      if (u && u.onerror) u.onerror({ error: 'interrupted' });
    },
    pause() {},
    resume() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = Utterance;

  let rec = null;
  class Recognition {
    constructor() {
      rec = this;
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
    }
    start() {
      rec = this;
      setTimeout(() => this.onstart && this.onstart(), 5);
    }
    stop() {
      setTimeout(() => this.onend && this.onend(), 5);
    }
    abort() {
      setTimeout(() => this.onend && this.onend(), 5);
    }
  }
  window.SpeechRecognition = Recognition;
  window.webkitSpeechRecognition = Recognition;
  const result = (text, isFinal) => ({ resultIndex: 0, results: [Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal })] });
  window.__speech = {
    log,
    /** Simulates the learner saying something: interim words first, then the final result. */
    hear(text) {
      if (!rec) throw new Error('microphone is not on');
      const words = text.split(' ');
      for (let i = 1; i < words.length; i++) rec.onresult && rec.onresult(result(words.slice(0, i).join(' '), false));
      rec.onresult && rec.onresult(result(text, true));
    },
    interim(text) {
      rec.onresult && rec.onresult(result(text, false));
    },
  };
})();

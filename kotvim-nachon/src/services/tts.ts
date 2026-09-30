import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

let enabled = true;
let token = 0;

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  if (!on) stop();
}

export function isVoiceEnabled() {
  return enabled;
}

/** Speak Hebrew text. `force` speaks even when voice guidance is off (e.g. dictation, "hear the word" buttons). */
export async function speak(text: string, opts: { rate?: number; force?: boolean } = {}): Promise<void> {
  if (!text || (!enabled && !opts.force)) return;
  const my = ++token;
  const rate = opts.rate ?? 0.9;
  try {
    if (Capacitor.isNativePlatform()) {
      await TextToSpeech.stop().catch(() => undefined);
      if (my !== token) return;
      await TextToSpeech.speak({ text, lang: 'he-IL', rate, pitch: 1.1, volume: 1, category: 'playback' });
      return;
    }
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'he-IL';
      u.rate = rate;
      u.pitch = 1.1;
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('he') || v.lang.startsWith('iw'));
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
      setTimeout(resolve, 15000);
    });
  } catch {
    // speech is a nice-to-have; never break the game because of it
  }
}

export function stop() {
  token++;
  if (Capacitor.isNativePlatform()) TextToSpeech.stop().catch(() => undefined);
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

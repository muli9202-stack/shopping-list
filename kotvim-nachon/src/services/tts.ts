import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { httpsCallable } from 'firebase/functions';
import { auth, fns } from './firebase';
import { planSpeech, playClip, stopClip, voicePackReady } from './voicePack';

/**
 * Voice guidance.
 * 1. The recorded natural voice shipped with the app (voicePack.ts) – every fixed phrase, offline.
 * 2. For text that was never recorded: the server voice (Cloud Function "tts") if set up,
 * 3. otherwise the device's best Hebrew voice.
 */

let enabled = true;
let token = 0;
let current: HTMLAudioElement | null = null;
let cloudBroken = false;

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  if (!on) stop();
}

export function isVoiceEnabled() {
  return enabled;
}

// ---- tiny IndexedDB cache: phrase → mp3 (base64) ----
const DB = 'kn-voice';
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('a');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function cacheGet(key: string): Promise<string | undefined> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const q = db.transaction('a').objectStore('a').get(key);
      q.onsuccess = () => resolve(q.result as string | undefined);
      q.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}
async function cachePut(key: string, val: string) {
  try {
    const db = await idb();
    db.transaction('a', 'readwrite').objectStore('a').put(val, key);
  } catch {
    // no storage – fine
  }
}

async function cloudAudio(text: string, rate: number): Promise<string | null> {
  if (cloudBroken || !fns || !auth?.currentUser) return null;
  const key = `${rate.toFixed(2)}|${text}`;
  const hit = await cacheGet(key);
  if (hit) return hit;
  try {
    const call = httpsCallable<{ text: string; rate: number }, { audio: string }>(fns, 'tts', { timeout: 12000 });
    const { data } = await call({ text, rate });
    cachePut(key, data.audio);
    return data.audio;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    // not deployed / not allowed → stop trying for this session
    if (code.includes('not-found') || code.includes('permission') || code.includes('unimplemented')) cloudBroken = true;
    return null;
  }
}

function playMp3(b64: string, my: number): Promise<void> {
  return new Promise((resolve) => {
    if (my !== token) return resolve();
    const a = new Audio(`data:audio/mpeg;base64,${b64}`);
    current = a;
    a.onended = () => resolve();
    a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}

// ---- choosing the best voice the device has ----
/**
 * Natural-sounding voices first: browser "Natural"/"Online" neural voices (e.g. Edge's Hila),
 * Google network voices on Android, enhanced/premium voices on Apple devices.
 */
function voiceScore(name: string, local: boolean): number {
  const n = name.toLowerCase();
  let s = 0;
  if (/natural|neural|online|wavenet|studio/.test(n)) s += 50;
  if (/network/.test(n)) s += 40;
  if (/premium|enhanced|high/.test(n)) s += 30;
  if (/google/.test(n)) s += 20;
  if (!local) s += 5;
  return s;
}

let webVoice: SpeechSynthesisVoice | null | undefined;
/** Browsers fill the voice list asynchronously – wait for it instead of speaking with a wrong (English) voice. */
function loadWebVoice(): Promise<SpeechSynthesisVoice | null> {
  if (webVoice !== undefined) return Promise.resolve(webVoice);
  if (!('speechSynthesis' in window)) return Promise.resolve((webVoice = null));
  return new Promise((resolve) => {
    const pickNow = () => {
      const he = window.speechSynthesis.getVoices().filter((v) => /^(he|iw)/i.test(v.lang));
      if (!he.length) return false;
      webVoice = he.sort((a, b) => voiceScore(b.name, b.localService) - voiceScore(a.name, a.localService))[0];
      resolve(webVoice);
      return true;
    };
    if (pickNow()) return;
    const onChange = () => {
      if (pickNow()) window.speechSynthesis.removeEventListener('voiceschanged', onChange);
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    setTimeout(() => {
      if (webVoice === undefined) {
        window.speechSynthesis.removeEventListener('voiceschanged', onChange);
        resolve((webVoice = null));
      }
    }, 2500);
  });
}

let nativeVoice: number | null | undefined;
async function loadNativeVoice(): Promise<number | null> {
  if (nativeVoice !== undefined) return nativeVoice;
  try {
    const { voices } = await TextToSpeech.getSupportedVoices();
    let best = -1;
    let bestScore = -1;
    voices.forEach((v, i) => {
      if (!/^(he|iw)/i.test(v.lang)) return;
      const sc = voiceScore(`${v.name} ${v.voiceURI}`, v.localService);
      if (sc > bestScore) {
        bestScore = sc;
        best = i;
      }
    });
    nativeVoice = best >= 0 ? best : null;
  } catch {
    nativeVoice = null;
  }
  return nativeVoice;
}

/** Is there any Hebrew voice (cloud or device)? Games switch to "see the word" questions when not. */
export async function hebrewVoiceAvailable(): Promise<boolean> {
  if (await voicePackReady()) return true;
  if (fns && auth?.currentUser && !cloudBroken) return true;
  if (Capacitor.isNativePlatform()) {
    try {
      const { languages } = await TextToSpeech.getSupportedLanguages();
      return languages.some((l) => /^(he|iw)/i.test(l));
    } catch {
      return false;
    }
  }
  return (await loadWebVoice()) !== null;
}

async function deviceSpeak(text: string, rate: number, my: number) {
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.stop().catch(() => undefined);
    const voice = await loadNativeVoice();
    if (my !== token) return;
    await TextToSpeech.speak({ text, lang: 'he-IL', rate, pitch: 1.05, volume: 1, category: 'playback', ...(voice !== null ? { voice } : {}) });
    return;
  }
  const voice = await loadWebVoice();
  // no Hebrew voice: stay silent rather than read Hebrew with an English voice
  if (!voice || my !== token) return;
  window.speechSynthesis.cancel();
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice.lang;
    u.voice = voice;
    u.rate = rate;
    u.pitch = 1.05;
    let started = false;
    u.onstart = () => (started = true);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    // some embedded browsers never start speaking – don't make the game wait for them
    setTimeout(() => !started && resolve(), 1500);
    setTimeout(resolve, 20000);
  });
}

/** `local` keeps the text on the device (used for feedback about the child's own story). */
export async function speak(text: string, opts: { rate?: number; force?: boolean; local?: boolean } = {}): Promise<void> {
  if (!text || (!enabled && !opts.force)) return;
  stop();
  const my = token;
  const rate = opts.rate ?? 0.95;
  try {
    // 1. the recorded natural voice (everything fixed in the app); slow version for slow speech
    const plan = await planSpeech(text, rate < 0.8);
    if (my !== token) return;
    if (plan) {
      // Only the natural voice speaks: pieces that were never recorded are left out rather than read
      // by a second, robotic voice in the middle of the sentence (the text is on the screen anyway).
      if (plan.some((p) => 'clip' in p)) {
        for (const part of plan) {
          if (my !== token) return;
          if ('clip' in part) await playClip(part.clip);
        }
        return;
      }
      // nothing recorded: a natural cloud voice if the server has one, otherwise stay quiet
      const mp3 = opts.local ? null : await cloudAudio(text, rate);
      if (mp3 && my === token) await playMp3(mp3, my);
      return;
    }
    // no recorded voice at all (pack missing): the best voice we can find
    await otherVoice(text, rate, my, !!opts.local);
  } catch {
    // speech is a nice-to-have; never break the game because of it
  }
}

/** Without the recorded voice pack: the cloud voice when set up, else the device voice. */
async function otherVoice(text: string, rate: number, my: number, local: boolean) {
  const mp3 = local ? null : await cloudAudio(text, rate);
  if (my !== token) return;
  if (mp3) return await playMp3(mp3, my);
  await deviceSpeak(text, rate, my);
}

/** Download phrases in the background so they play instantly later (e.g. the next questions). */
export function prefetch(texts: string[], rate = 0.95) {
  if (!auth?.currentUser) return;
  texts.slice(0, 12).forEach((t, i) => setTimeout(() => cloudAudio(t, rate), 400 * i));
}

export function stop() {
  token++;
  stopClip();
  if (current) {
    current.pause();
    current = null;
  }
  if (Capacitor.isNativePlatform()) TextToSpeech.stop().catch(() => undefined);
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

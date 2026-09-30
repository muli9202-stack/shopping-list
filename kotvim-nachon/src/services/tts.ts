import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { httpsCallable } from 'firebase/functions';
import { auth, fns } from './firebase';

/**
 * Voice guidance.
 * 1. Natural neural Hebrew voice from the server (Cloud Function "tts"), cached on the device,
 *    so each phrase is downloaded once and then plays instantly, even offline.
 * 2. Fallback: the phone's own Hebrew text-to-speech.
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

async function deviceSpeak(text: string, rate: number, my: number) {
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
}

/** Speak Hebrew text. `force` speaks even when voice guidance is off (dictation, "hear the word" buttons). */
export async function speak(text: string, opts: { rate?: number; force?: boolean } = {}): Promise<void> {
  if (!text || (!enabled && !opts.force)) return;
  stop();
  const my = token;
  const rate = opts.rate ?? 0.95;
  try {
    const mp3 = await cloudAudio(text, rate);
    if (my !== token) return;
    if (mp3) return await playMp3(mp3, my);
    await deviceSpeak(text, rate, my);
  } catch {
    // speech is a nice-to-have; never break the game because of it
  }
}

/** Download phrases in the background so they play instantly later (e.g. the next questions). */
export function prefetch(texts: string[], rate = 0.95) {
  if (!auth?.currentUser) return;
  texts.slice(0, 12).forEach((t, i) => setTimeout(() => cloudAudio(t, rate), 400 * i));
}

export function stop() {
  token++;
  if (current) {
    current.pause();
    current = null;
  }
  if (Capacitor.isNativePlatform()) TextToSpeech.stop().catch(() => undefined);
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

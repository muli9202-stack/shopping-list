import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { httpsCallable } from 'firebase/functions';
import { auth, fns } from '../services/firebase';

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

/** Is the talking teacher reachable (the app is connected to the cloud and a parent is signed in)? */
export function tutorAvailable(): boolean {
  return !!fns && !!auth?.currentUser;
}

/** One answer from רובי (Claude on our server): the text and, when the server has the neural voice, the audio. */
export async function askTutor(history: Turn[], grade: number): Promise<{ text: string; audio: string | null }> {
  if (!fns) throw new Error('offline');
  const call = httpsCallable<{ messages: Turn[]; grade: number }, { text: string; audio: string | null }>(fns, 'tutor', { timeout: 45000 });
  const { data } = await call({ messages: history.slice(-16), grade });
  return data;
}

type WebRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/** Can the child talk instead of typing on this device? */
export async function canListen(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      return (await SpeechRecognition.available()).available;
    } catch {
      return false;
    }
  }
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Listen to one sentence in Hebrew and return what was said ('' if nothing was heard). */
export async function listenOnce(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') throw new Error('no-permission');
    const res = await SpeechRecognition.start({ language: 'he-IL', maxResults: 1, partialResults: false, popup: false, prompt: 'דברו עם רובי' });
    return res.matches?.[0] ?? '';
  }
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) throw new Error('unsupported');
  return new Promise((resolve, reject) => {
    const r = new Ctor();
    r.lang = 'he-IL';
    r.interimResults = false;
    r.maxAlternatives = 1;
    let text = '';
    r.onresult = (e) => {
      text = e.results[0]?.[0]?.transcript ?? '';
    };
    r.onerror = (e) => reject(e);
    r.onend = () => resolve(text);
    r.start();
  });
}

export async function stopListening() {
  if (Capacitor.isNativePlatform()) await SpeechRecognition.stop().catch(() => undefined);
}

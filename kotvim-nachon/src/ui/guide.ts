import { useEffect } from 'react';
import { speak } from '../services/tts';
import { GUIDES } from '../data/guides';

export { GUIDES };

/**
 * Spoken explanations for every screen and game.
 * The first time a child opens something, the full explanation is read aloud; afterwards a short
 * reminder. The ❓ button always repeats the full explanation.
 */

function seenKey(key: string) {
  return `kn-guide-${key}`;
}

function wasSeen(key: string): boolean {
  try {
    return localStorage.getItem(seenKey(key)) === '1';
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(seenKey(key), '1');
  } catch {
    // ignore
  }
}

/** Speak the guide for `key` when the screen opens: full explanation the first time, then a short one. */
export function useGuide(key: string | null) {
  useEffect(() => {
    if (!key || !GUIDES[key]) return;
    const g = GUIDES[key];
    const first = !wasSeen(key);
    const t = setTimeout(() => {
      speak(first ? g.long : g.short);
      markSeen(key);
    }, 400);
    return () => clearTimeout(t);
  }, [key]);
}

export function isFirstTime(key: string) {
  return !wasSeen(key);
}

export function speakGuide(key: string): Promise<void> {
  const g = GUIDES[key];
  return g ? speak(g.long, { force: true }) : Promise.resolve();
}

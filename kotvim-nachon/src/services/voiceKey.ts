/**
 * How spoken text is matched to the recorded voice clips. Shared by the app and by the recording
 * script (scripts/voice-texts.ts), so both split and normalise text exactly the same way.
 */

/** Normalised lookup key: no nikud, no punctuation, single spaces. */
export function voiceKey(text: string): string {
  return text
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^א-ת0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a longer text into sentences/phrases at punctuation followed by a space. */
export function voiceSegments(text: string): string[] {
  return text
    .split(/(?<=[.!?:,–])\s+/)
    .map((s) => s.trim())
    .filter((s) => voiceKey(s));
}

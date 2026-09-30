import { voiceKey, voiceSegments } from './voiceKey';

/**
 * The recorded natural voice (scripts/voice-build.py): every phrase of the app is pre-recorded and
 * shipped in public/voice/ as a few "pack" files plus an index. Plays with Web Audio, offline.
 */

type Clip = [pack: number, offset: number, length: number];
interface Index {
  packs: number;
  clips: Record<string, Clip[]>; // [normal] or [normal, slow]
}

let indexPromise: Promise<Index | null> | null = null;
const packs = new Map<number, Promise<ArrayBuffer>>();
const decoded = new Map<string, Promise<AudioBuffer>>();
let ctx: AudioContext | null = null;
/** every clip that is playing – stopping speech stops all of them, so two voices never overlap */
const playing = new Set<AudioBufferSourceNode>();

function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

// browsers only allow sound after a tap – wake the audio context on the first one
if (typeof window !== 'undefined')
  window.addEventListener(
    'pointerdown',
    () => {
      try {
        audio();
      } catch {
        // no Web Audio
      }
    },
    { once: true, capture: true },
  );

function loadIndex(): Promise<Index | null> {
  indexPromise ??= fetch('voice/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<Index>) : null))
    .catch(() => null);
  return indexPromise;
}

export async function voicePackReady(): Promise<boolean> {
  return (await loadIndex()) !== null;
}

function pack(n: number): Promise<ArrayBuffer> {
  let p = packs.get(n);
  if (!p) {
    p = fetch(`voice/v${n}.bin`).then((r) => {
      if (!r.ok) throw new Error('voice pack missing');
      return r.arrayBuffer();
    });
    p.catch(() => packs.delete(n));
    packs.set(n, p);
  }
  return p;
}

function decode(c: Clip): Promise<AudioBuffer> {
  const id = c.join(':');
  let d = decoded.get(id);
  if (!d) {
    d = pack(c[0]).then((buf) => audio().decodeAudioData(buf.slice(c[1], c[1] + c[2])));
    d.catch(() => decoded.delete(id));
    decoded.set(id, d);
    if (decoded.size > 300) decoded.delete(decoded.keys().next().value!);
  }
  return d;
}

export type Part = { clip: Clip } | { text: string };

/** Tests can collect the texts that have no recording by setting globalThis.__voiceMisses = new Set(). */
function miss(text: string) {
  (globalThis as { __voiceMisses?: Set<string> }).__voiceMisses?.add(text);
}

/**
 * Turn a text into recorded clips: the whole phrase if it was recorded, otherwise sentence by
 * sentence, otherwise the longest recorded word runs ("כותבים" + "עוּגָה"). Anything never
 * recorded (e.g. AI feedback) is returned as text for another voice.
 */
export async function planSpeech(text: string, slow: boolean): Promise<Part[] | null> {
  const idx = await loadIndex();
  if (!idx) return null;
  const pick = (k: string): Clip | null => {
    const e = idx.clips[k];
    return e ? (slow && e[1] ? e[1] : e[0]) : null;
  };
  const whole = pick(voiceKey(text));
  if (whole) return [{ clip: whole }];
  const parts: Part[] = [];
  for (const seg of voiceSegments(text)) {
    const c = pick(voiceKey(seg));
    if (c) {
      parts.push({ clip: c });
      continue;
    }
    const words = voiceKey(seg).split(' ');
    let i = 0;
    let unknown: string[] = [];
    while (i < words.length) {
      let found: Clip | null = null;
      let j = Math.min(words.length, i + 8);
      for (; j > i; j--) {
        found = pick(words.slice(i, j).join(' '));
        if (found) break;
      }
      if (found) {
        if (unknown.length) parts.push({ text: unknown.join(' ') });
        unknown = [];
        parts.push({ clip: found });
        i = j;
      } else {
        unknown.push(words[i]);
        i++;
      }
    }
    if (unknown.length) parts.push({ text: unknown.join(' ') });
  }
  for (const p of parts) if ('text' in p) miss(`${p.text}  ⟵  ${text}`);
  return parts;
}

export function stopClip() {
  for (const src of playing)
    try {
      src.stop();
    } catch {
      // already stopped
    }
  playing.clear();
}

/**
 * Play one clip; resolves when it ends (or is stopped). `alive` is checked after the (async) loading:
 * if newer speech started meanwhile, this clip is dropped instead of playing on top of it.
 */
export async function playClip(c: Clip, alive: () => boolean = () => true): Promise<void> {
  const buf = await decode(c);
  if (!alive()) return;
  const ac = audio();
  await new Promise<void>((resolve) => {
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = 1;
    src.connect(gain).connect(ac.destination);
    src.onended = () => {
      playing.delete(src);
      resolve();
    };
    // only one clip at a time
    stopClip();
    playing.add(src);
    src.start();
    // safety net if the browser never reports the end
    setTimeout(resolve, buf.duration * 1000 + 800);
  });
}

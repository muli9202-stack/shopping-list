// The chavruta inside a claude.ai Artifact: the same instructions, context and checks as
// the API-key mode, but Claude answers through the viewer's own account (the `sample`
// capability), so no key is needed. The first question asks the viewer to allow it.
import { buildTurns, StepLineReader, SYSTEM } from './claude';
import type { Brain, BrainRequest, Step } from './types';

interface SampleError {
  code: string;
  message: string;
}
type SampleFn = (
  input: { role: 'user' | 'assistant'; content: string }[],
  opts: { onText?: (u: { text: string; delta: string }) => void; signal?: AbortSignal; cache?: boolean; modelTier?: 'quick' | 'default' | 'complex' },
) => Promise<{ text: string; truncated: boolean }>;

let sampleFn: Promise<SampleFn | null> | null = null;
/** Set when the viewer declined, or Claude is not available here: the demo takes over. */
export let sampleUnavailable = false;

/** The viewer's `sample` capability, or null outside a Claude viewer. */
export function getSample(): Promise<SampleFn | null> {
  if (!sampleFn) {
    const use = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude?.use;
    sampleFn = use ? (use('sample') as Promise<SampleFn | null>).catch(() => null) : Promise.resolve(null);
  }
  return sampleFn;
}

const HIDE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

const ERROR_HE: Record<string, string> = {
  not_granted: 'לא אושר שימוש ב-Claude בדף הזה, אז אני ממשיך במצב הדגמה.',
  sampling_disabled: 'Claude לא זמין בחשבון הזה, אז אני ממשיך במצב הדגמה.',
  rate_limited: 'הגענו למגבלת השימוש ב-Claude. אפשר לנסות שוב בעוד כמה דקות.',
  session_expired: 'צריך להתחבר מחדש ל-Claude.',
  refused: 'Claude לא ענה על הבקשה הזאת. אפשר לנסח אחרת.',
  prompt_too_large: 'הבקשה ארוכה מדי. נסה לשאול על קטע קצר יותר.',
};

export const sampleBrain = (fallback: Brain): Brain => ({
  demo: false,
  async *respond(req: BrainRequest, signal: AbortSignal) {
    const sample = sampleUnavailable ? null : await getSample();
    if (!sample) {
      yield* fallback.respond(req, signal);
      return;
    }
    const turns = await buildTurns(req, signal);
    if (signal.aborted) return;
    // There is no system prompt here: the standing instructions go in a leading user turn.
    const input = [{ role: 'user' as const, content: SYSTEM }, ...turns];
    if (input[1]?.role === 'user') input.splice(1, 0, { role: 'assistant', content: 'מוכן ללמוד.' });

    const reader = new StepLineReader();
    const queue: Step[] = [];
    let done = false;
    let failure: SampleError | null = null;
    const bell: { wake: (() => void) | null } = { wake: null };
    sample(input, {
      signal,
      cache: false,
      modelTier: req.ctx.level === 'iyun' ? 'complex' : 'default',
      onText: ({ delta }) => {
        queue.push(...reader.push(delta));
        bell.wake?.();
      },
    })
      .then(() => queue.push(...reader.end()))
      .catch((e: SampleError) => {
        if (e?.code !== 'cancelled') failure = e;
      })
      .finally(() => {
        done = true;
        bell.wake?.();
      });

    while (!signal.aborted) {
      const step = queue.shift();
      if (step) {
        yield step;
        continue;
      }
      if (done) break;
      await new Promise<void>((r) => (bell.wake = r));
      bell.wake = null;
    }
    const f = failure as SampleError | null;
    if (f) {
      if (HIDE.has(f.code)) sampleUnavailable = true;
      yield { t: 'say', kind: 'meta', text: ERROR_HE[f.code] ?? 'Claude לא ענה הפעם. אפשר לנסות שוב.' };
      if (HIDE.has(f.code)) yield* fallback.respond(req, signal);
    }
  },
});

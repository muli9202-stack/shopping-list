// The contract between the turn engine and whatever writes the explanations
// (Claude, or the scripted demo chavruta). A brain only produces steps; the engine
// verifies them, plays them, highlights, and records what was actually heard.
import type { Illustration } from '../core/illustration';
import type { Commentary, Section } from '../core/sefaria';
import type { HeardLine, Level, SayKind, Selection, Turn } from '../state/store';

export type Step =
  | {
      t: 'say';
      text: string;
      kind: SayKind;
      /** Exact ref the line relies on (a segment, a comment). Verified before speaking. */
      cite?: string;
      /** Exact words from the cited text; must appear there or the line is not spoken as a quote. */
      quote?: string;
      /** Segment (1-based) of the current section to highlight while saying this, and optionally the words. */
      hl?: { seg: number; words?: string };
    }
  | { t: 'open_commentary'; who: string }
  | { t: 'illustrate'; spec: Illustration }
  | { t: 'clarify'; question: string; options: string[] }
  | { t: 'focus'; seg: number }
  | { t: 'select_word'; seg: number; word: string }
  /** Go back to the explanation that was cut off (replays the lines not yet heard). */
  | { t: 'resume_pending' }
  | { t: 'mark'; status: 'read' };

export type RequestKind =
  | 'opened'
  | 'continue'
  | 'word'
  | 'commentary'
  | 'illustrate'
  | 'chat'
  | 'summary'
  | 'resume'
  | 'repeat';

export interface StudyContext {
  section: Section;
  focusSeg: number;
  readUpTo: number;
  selection: Selection | null;
  commentaries: Commentary[];
  activeCommentary: string | null;
  level: Level;
  style: 'direct' | 'hint';
  /** Recent conversation, with only what was actually heard. */
  history: Turn[];
  /** Lines the chavruta had planned but the learner did not hear (cut off). */
  pending: HeardLine[];
  /** Was the previous answer interrupted, and where. */
  interruptedLine: HeardLine | null;
}

export interface BrainRequest {
  kind: RequestKind;
  text?: string;
  word?: string | null;
  commentator?: string;
  variant?: 'default' | 'compare' | 'change';
  ctx: StudyContext;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  model: string;
}

export interface Brain {
  readonly demo: boolean;
  respond(req: BrainRequest, signal: AbortSignal): AsyncIterable<Step>;
  /** Called after a response with token usage (Claude only). */
  onUsage?: (u: Usage) => void;
}

// The shared study state. Every part of the app (text pane, commentary, avatar, speech,
// the explanation engine) reads and writes the same store, so "what page are we on",
// "which word is marked" and "what was actually heard" have one source of truth.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Illustration } from '../core/illustration';
import type { Commentary, LinkGroup, Section } from '../core/sefaria';

export type Level = 'beginner' | 'bekiut' | 'iyun' | 'prep' | 'review';
export const LEVELS: Record<Level, string> = {
  beginner: 'מתחילים',
  bekiut: 'בקיאות',
  iyun: 'עיון',
  prep: 'הכנה לשיעור',
  review: 'חזרה',
};

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'checking' | 'speaking' | 'waiting';
export const AVATAR_LABEL: Record<AvatarState, string> = {
  idle: 'מוכן',
  listening: 'מקשיב',
  thinking: 'חושב',
  checking: 'בודק במקור',
  speaking: 'מדבר',
  waiting: 'ממתין לך',
};

/** What a spoken line is, so the learner can tell source from explanation. */
export type SayKind = 'quote' | 'translation' | 'explain' | 'commentator' | 'suggestion' | 'question' | 'meta';
export const SAY_KIND_LABEL: Record<SayKind, string> = {
  quote: 'לשון המקור',
  translation: 'תרגום',
  explain: 'הסבר',
  commentator: 'שיטת מפרש',
  suggestion: 'הצעה להבנה',
  question: 'שאלה',
  meta: '',
};

export interface HeardLine {
  text: string;
  kind: SayKind;
  cite?: string;
  /** True only once the line finished playing (or was shown, in captions-only mode). */
  heard: boolean;
  /** Set when the learner cut in: how much of the line was actually spoken. */
  cutAt?: number;
  unverified?: boolean;
  /** Segment and words this line highlights, so a replay highlights the same place. */
  hlSeg?: number;
  hlWords?: string;
}

export interface Turn {
  id: number;
  role: 'user' | 'chavruta';
  text?: string;
  lines: HeardLine[];
  at: number;
  /** Section the turn belongs to. */
  ref?: string;
  interrupted?: boolean;
}

export type ProgressStatus = 'opened' | 'read' | 'learned' | 'reviewed';
export const PROGRESS_LABEL: Record<ProgressStatus, string> = {
  opened: 'נפתח',
  read: 'נקרא',
  learned: 'נלמד',
  reviewed: 'חזרתי',
};
const RANK: ProgressStatus[] = ['opened', 'read', 'learned', 'reviewed'];

export interface Progress {
  ref: string;
  he: string;
  status: ProgressStatus;
  lastSeg: number;
  updatedAt: number;
}

export interface Bookmark {
  ref: string;
  seg: number;
  he: string;
  at: number;
}

export interface Settings {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high';
  voiceURI: string;
  rate: number;
  volume: number;
  captions: boolean;
  look: 'young' | 'elder' | 'woman';
  background: 'beit-midrash' | 'library' | 'plain';
  voiceOnly: boolean;
  level: Level;
  style: 'direct' | 'hint';
  micMode: 'open' | 'ptt';
  /** How long to wait after the learner stops talking before answering (thinking pauses). */
  endOfTurnMs: number;
  fontScale: number;
  highContrast: boolean;
  save: { place: boolean; notes: boolean; conversation: boolean };
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-opus-5-5',
  effort: 'low',
  voiceURI: '',
  rate: 1,
  volume: 1,
  captions: true,
  look: 'young',
  background: 'beit-midrash',
  voiceOnly: false,
  level: 'bekiut',
  style: 'direct',
  micMode: 'open',
  endOfTurnMs: 1300,
  fontScale: 1,
  highContrast: false,
  save: { place: true, notes: true, conversation: false },
};

export interface Selection {
  ref: string;
  seg: number;
  /** Index among the segment's word tokens (0-based). */
  word: number;
  text: string;
}

export interface Highlight {
  ref: string;
  seg: number;
  words?: string;
  epoch: number;
}

export interface Clarify {
  question: string;
  options: { label: string; payload: unknown }[];
}

export interface Costs {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  usd: number;
  requests: number;
}

export interface StudyState {
  settings: Settings;
  section: Section | null;
  loading: string | null;
  error: string | null;
  /** Bumped on every navigation; work started under an older epoch must not touch the page. */
  epoch: number;
  focusSeg: number;
  /** Highest segment read aloud in this section. */
  readUpTo: number;
  selection: Selection | null;
  highlight: Highlight | null;
  commentaries: Record<string, Commentary>;
  openCommentaries: string[];
  activeCommentary: string | null;
  /** Comment ref to mark inside the commentary pane. */
  commentHighlight: string | null;
  links: LinkGroup[];
  illustration: Illustration | null;
  avatar: AvatarState;
  caption: { text: string; kind: SayKind } | null;
  interim: string;
  micOn: boolean;
  muted: boolean;
  turns: Turn[];
  clarify: Clarify | null;
  /** Where we stopped: the section, the segment, and the explanation line not yet heard. */
  resume: { ref: string; he: string; seg: number; pending: HeardLine[] } | null;
  progress: Record<string, Progress>;
  bookmarks: Bookmark[];
  notes: Record<string, string>;
  openQuestions: { ref: string; seg: number; text: string; at: number }[];
  costs: Costs;
  lastCitation: { ref: string; seg?: number } | null;

  set: (p: Partial<StudyState>) => void;
  setSettings: (p: Partial<Settings>) => void;
  addTurn: (t: Omit<Turn, 'id' | 'at'>) => number;
  updateTurn: (id: number, f: (t: Turn) => Turn) => void;
  markProgress: (ref: string, he: string, status: ProgressStatus, lastSeg?: number) => void;
  toggleBookmark: (b: Omit<Bookmark, 'at'>) => void;
  setNote: (key: string, text: string) => void;
  clearHistory: () => void;
}

let turnSeq = 1;

export const useStudy = create<StudyState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      section: null,
      loading: null,
      error: null,
      epoch: 0,
      focusSeg: 1,
      readUpTo: 0,
      selection: null,
      highlight: null,
      commentaries: {},
      openCommentaries: [],
      activeCommentary: null,
      commentHighlight: null,
      links: [],
      illustration: null,
      avatar: 'idle',
      caption: null,
      interim: '',
      micOn: false,
      muted: false,
      turns: [],
      clarify: null,
      resume: null,
      progress: {},
      bookmarks: [],
      notes: {},
      openQuestions: [],
      costs: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, usd: 0, requests: 0 },
      lastCitation: null,

      set: (p) => set(p),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      addTurn: (t) => {
        const id = turnSeq++;
        set({ turns: [...get().turns.slice(-80), { ...t, id, at: Date.now() }] });
        return id;
      },
      updateTurn: (id, f) => set({ turns: get().turns.map((t) => (t.id === id ? f(t) : t)) }),
      markProgress: (ref, he, status, lastSeg) => {
        const cur = get().progress[ref];
        // Status only moves forward; "learned" and "reviewed" are set by explicit learner actions only.
        const next = cur && RANK.indexOf(cur.status) > RANK.indexOf(status) ? cur.status : status;
        set({
          progress: {
            ...get().progress,
            [ref]: { ref, he, status: next, lastSeg: lastSeg ?? cur?.lastSeg ?? 1, updatedAt: Date.now() },
          },
        });
      },
      toggleBookmark: (b) => {
        const exists = get().bookmarks.some((x) => x.ref === b.ref && x.seg === b.seg);
        set({
          bookmarks: exists
            ? get().bookmarks.filter((x) => !(x.ref === b.ref && x.seg === b.seg))
            : [...get().bookmarks, { ...b, at: Date.now() }],
        });
      },
      setNote: (key, text) => {
        const notes = { ...get().notes };
        if (text.trim()) notes[key] = text;
        else delete notes[key];
        set({ notes });
      },
      clearHistory: () => set({ progress: {}, bookmarks: [], notes: {}, openQuestions: [], turns: [], resume: null }),
    }),
    {
      name: 'chavruta',
      version: 1,
      // Only what the learner chose to keep is written to the device.
      partialize: (s) => ({
        settings: s.settings,
        progress: s.settings.save.place ? s.progress : {},
        resume: s.settings.save.place ? s.resume : null,
        bookmarks: s.settings.save.notes ? s.bookmarks : [],
        notes: s.settings.save.notes ? s.notes : {},
        openQuestions: s.settings.save.notes ? s.openQuestions : [],
        turns: s.settings.save.conversation ? s.turns.slice(-40) : [],
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudyState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}), save: { ...DEFAULT_SETTINGS.save, ...(p.settings?.save ?? {}) } } };
      },
    },
  ),
);

/** Mouth openness 0..1, updated every animation frame without re-rendering React. */
type MouthListener = (v: number) => void;
const mouthListeners = new Set<MouthListener>();
let mouthValue = 0;
export const mouth = {
  get: () => mouthValue,
  set(v: number) {
    mouthValue = v;
    mouthListeners.forEach((l) => l(v));
  },
  subscribe(l: MouthListener): () => void {
    mouthListeners.add(l);
    return () => {
      mouthListeners.delete(l);
    };
  },
};

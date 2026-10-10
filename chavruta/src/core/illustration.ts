// Illustration specs: the chavruta describes a drawing as data, the UI renders it.
// Every illustration is labeled "המחשה להסבר" and lists its assumptions and sources.

export interface IllusSource {
  label: string;
  ref: string;
}

interface Base {
  title: string;
  assumptions: string[];
  sources: IllusSource[];
  /** When this illustration is a variation of a previous one: what was changed. */
  changed?: string;
}

export interface TimelineIllus extends Base {
  kind: 'timeline';
  startLabel: string;
  endLabel: string;
  /** Points along the axis, position 0..1. */
  points: { at: number; label: string; who?: string; ref?: string }[];
  ranges: { from: number; to: number; label: string; ref?: string }[];
}

export interface TableIllus extends Base {
  kind: 'table';
  columns: string[];
  rows: { cells: string[]; ref?: string }[];
}

export interface SceneIllus extends Base {
  kind: 'scene';
  /** Grid is 12 × 7 units. */
  entities: { id: string; label: string; x: number; y: number; w?: number; h?: number; shape: 'person' | 'object' | 'area' | 'wall'; ref?: string }[];
  arrows: { from: string; to: string; label?: string }[];
}

export interface FlowIllus extends Base {
  kind: 'flow';
  steps: { label: string; type: 'statement' | 'question' | 'answer' | 'proof' | 'rejection' | 'conclusion'; ref?: string }[];
}

export type Illustration = TimelineIllus | TableIllus | SceneIllus | FlowIllus;

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, lo: number, hi: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const optRef = (v: unknown) => (typeof v === 'string' && v.length < 120 ? v : undefined);

/** Validates an illustration the model produced; returns null when it is unusable. */
export function parseIllustration(raw: unknown): Illustration | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base: Base = {
    title: str(r.title, 120) || 'המחשה',
    assumptions: (Array.isArray(r.assumptions) ? r.assumptions : []).map((a) => str(a)).filter(Boolean).slice(0, 6),
    sources: arr(r.sources)
      .map((s) => ({ label: str(s.label, 80), ref: str(s.ref, 120) }))
      .filter((s) => s.ref)
      .slice(0, 8),
    changed: str(r.changed) || undefined,
  };
  switch (r.kind) {
    case 'timeline': {
      const points = arr(r.points).map((p) => ({ at: num(p.at, 0, 1), label: str(p.label, 80), who: str(p.who, 60) || undefined, ref: optRef(p.ref) }));
      if (!points.length) return null;
      return {
        ...base,
        kind: 'timeline',
        startLabel: str(r.startLabel, 60),
        endLabel: str(r.endLabel, 60),
        points: points.slice(0, 10),
        ranges: arr(r.ranges)
          .map((g) => ({ from: num(g.from, 0, 1), to: num(g.to, 0, 1), label: str(g.label, 80), ref: optRef(g.ref) }))
          .slice(0, 6),
      };
    }
    case 'table': {
      const columns = (Array.isArray(r.columns) ? r.columns : []).map((c) => str(c, 60)).slice(0, 6);
      const rows = arr(r.rows)
        .map((row) => ({ cells: (Array.isArray(row.cells) ? row.cells : []).map((c) => str(c, 160)).slice(0, columns.length), ref: optRef(row.ref) }))
        .slice(0, 10);
      if (!columns.length || !rows.length) return null;
      return { ...base, kind: 'table', columns, rows };
    }
    case 'scene': {
      const entities = arr(r.entities)
        .map((e, i) => ({
          id: str(e.id, 30) || `e${i}`,
          label: str(e.label, 40),
          x: num(e.x, 0, 12),
          y: num(e.y, 0, 7),
          w: e.w === undefined ? undefined : num(e.w, 0.2, 12),
          h: e.h === undefined ? undefined : num(e.h, 0.2, 7),
          shape: (['person', 'object', 'area', 'wall'].includes(e.shape as string) ? e.shape : 'object') as SceneIllus['entities'][number]['shape'],
          ref: optRef(e.ref),
        }))
        .slice(0, 12);
      if (!entities.length) return null;
      return {
        ...base,
        kind: 'scene',
        entities,
        arrows: arr(r.arrows)
          .map((a) => ({ from: str(a.from, 30), to: str(a.to, 30), label: str(a.label, 40) || undefined }))
          .slice(0, 10),
      };
    }
    case 'flow': {
      const types = ['statement', 'question', 'answer', 'proof', 'rejection', 'conclusion'];
      const steps = arr(r.steps)
        .map((s) => ({
          label: str(s.label, 160),
          type: (types.includes(s.type as string) ? s.type : 'statement') as FlowIllus['steps'][number]['type'],
          ref: optRef(s.ref),
        }))
        .slice(0, 10);
      if (!steps.length) return null;
      return { ...base, kind: 'flow', steps };
    }
    default:
      return null;
  }
}

/** Every ref an illustration leans on (to be verified before showing it). */
export function illustrationRefs(il: Illustration): string[] {
  const refs = new Set(il.sources.map((s) => s.ref));
  if (il.kind === 'timeline') [...il.points, ...il.ranges].forEach((p) => p.ref && refs.add(p.ref));
  if (il.kind === 'table') il.rows.forEach((r) => r.ref && refs.add(r.ref));
  if (il.kind === 'scene') il.entities.forEach((e) => e.ref && refs.add(e.ref));
  if (il.kind === 'flow') il.steps.forEach((s) => s.ref && refs.add(s.ref));
  return [...refs];
}

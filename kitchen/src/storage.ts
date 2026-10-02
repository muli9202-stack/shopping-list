import type { StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { IS_ARTIFACT, claudeUse } from './env';

const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await idbGet<string>(name)) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await idbSet(name, value);
    } catch {
      /* storage blocked: the cloud copy (when present) still holds the data */
    }
  },
  removeItem: async (name) => {
    try {
      await idbDel(name);
    } catch {
      /* ignore */
    }
  },
};

/* ------------------------------------------------------------------ */
/* Inside an Artifact: the viewer's private cloud store (db capability) */
/* ------------------------------------------------------------------ */

/** Documents hold at most 256 KiB, so the saved JSON is split into chunks. */
const CHUNK = 180_000;

type Doc = { get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>; set(d: Record<string, unknown>): Promise<void> };
type Db = { doc(path: string): Doc };

let cloud: Promise<{ db: Db; base: string } | null> | null = null;

function getCloud() {
  cloud ??= (async () => {
    const [db, user] = await Promise.all([claudeUse('db'), claudeUse('user')]);
    const id = db && user ? await user.id().catch(() => null) : null;
    return db && id ? { db: db as Db, base: `data/users/${id}` } : null;
  })();
  return cloud;
}

const written = new Map<string, string>();
let pending: string | null = null;
let saving = false;

/** Writes the latest value only, one document write at a time, skipping unchanged chunks. */
async function flush(name: string) {
  if (saving) return;
  saving = true;
  try {
    while (pending !== null) {
      const value = pending;
      pending = null;
      const c = await getCloud();
      if (!c) return;
      const parts: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
      for (let i = 0; i < parts.length; i++) {
        const path = `${c.base}/${name}-${i}`;
        if (written.get(path) === parts[i]) continue;
        await c.db.doc(path).set({ s: parts[i] });
        written.set(path, parts[i]);
      }
      await c.db.doc(`${c.base}/${name}-meta`).set({ n: parts.length, at: Date.now() });
    }
  } catch (e) {
    console.warn('cloud save failed', e);
  } finally {
    saving = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

const artifactStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const c = await getCloud();
      if (c) {
        const meta = await c.db.doc(`${c.base}/${name}-meta`).get();
        const n = meta.exists ? Number(meta.data()?.n ?? 0) : 0;
        if (n > 0) {
          const docs = await Promise.all(Array.from({ length: n }, (_, i) => c.db.doc(`${c.base}/${name}-${i}`).get()));
          const parts = docs.map((d) => String(d.data()?.s ?? ''));
          parts.forEach((p, i) => written.set(`${c.base}/${name}-${i}`, p));
          return parts.join('');
        }
      }
    } catch (e) {
      console.warn('cloud load failed', e);
    }
    return idbStorage.getItem(name);
  },
  setItem: (name, value) => {
    void idbStorage.setItem(name, value);
    pending = value;
    clearTimeout(timer);
    timer = setTimeout(() => void flush(name), 1200);
  },
  removeItem: (name) => idbStorage.removeItem(name),
};

export const storage: StateStorage = IS_ARTIFACT ? artifactStorage : idbStorage;

/** Whether saving goes to the viewer's cloud store (Artifact) or this device only. */
export const cloudAvailable = async () => IS_ARTIFACT && !!(await getCloud());

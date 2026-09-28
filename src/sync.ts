import { initializeApp, deleteApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { useApp, type Store } from './store';
import type { ActiveList, HistoryEntry } from './types';
import { useSyncStatus, type SyncStatus } from './syncStatus';

// Real-time family sync through the user's own Firebase project (Firestore).
// Layout under families/{code}/:
//   state/catalog  { categories, products }      – whole document
//   state/home     { stock, budgets, branches }  – whole document
//   lists/{chain:mode} { items{…}, branchId, startedAt } – field-level updates,
//                                                   so two phones can tick items at once
//   history/{id}   one document per finished purchase
// Settings (API key etc.) and AI results stay on the device.


/** Accepts the `const firebaseConfig = {...}` snippet from the Firebase console, or plain JSON. */
export function parseFirebaseConfig(text: string): FirebaseOptions {
  const body = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const json = body
    .replace(/\/\/.*$/gm, '')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,\s*}/g, '}');
  const cfg = JSON.parse(json) as FirebaseOptions;
  if (!cfg.apiKey || !cfg.projectId) throw new Error('missing apiKey/projectId');
  return cfg;
}

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newFamilyCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

let app: FirebaseApp | null = null;
let unsubs: Unsubscribe[] = [];
let applyingRemote = false;

const setStatus = (status: SyncStatus, error = '') => useSyncStatus.setState({ status, error });

function applyRemote(partial: Partial<Store>) {
  applyingRemote = true;
  try {
    useApp.setState(partial);
  } finally {
    applyingRemote = false;
  }
}

const strip = <T,>(v: T): T => JSON.parse(JSON.stringify(v)); // Firestore rejects `undefined`.

function refs(db: Firestore, code: string) {
  const base = `families/${code}`;
  return {
    catalog: doc(db, `${base}/state/catalog`),
    home: doc(db, `${base}/state/home`),
    lists: collection(db, `${base}/lists`),
    list: (key: string) => doc(db, `${base}/lists/${key}`),
    history: collection(db, `${base}/history`),
    entry: (id: string) => doc(db, `${base}/history/${id}`),
  };
}

type Refs = ReturnType<typeof refs>;

async function pushEverything(db: Firestore, r: Refs) {
  const s = useApp.getState();
  const batch = writeBatch(db);
  batch.set(r.catalog, strip({ categories: s.categories, products: s.products }));
  batch.set(r.home, strip({ stock: s.stock, budgets: s.budgets, branches: s.branches }));
  for (const [key, l] of Object.entries(s.lists)) batch.set(r.list(key), strip(l));
  for (const h of s.history.slice(0, 400)) batch.set(r.entry(h.id), strip(h));
  await batch.commit();
}

/** Writes local changes to Firestore as small, mergeable updates. */
function watchLocal(r: Refs): Unsubscribe {
  return useApp.subscribe((s, prev) => {
    if (applyingRemote) return;
    const fail = (e: unknown) => setStatus('error', (e as Error).message);

    if (s.categories !== prev.categories || s.products !== prev.products)
      setDoc(r.catalog, strip({ categories: s.categories, products: s.products })).catch(fail);
    if (s.stock !== prev.stock || s.budgets !== prev.budgets || s.branches !== prev.branches)
      setDoc(r.home, strip({ stock: s.stock, budgets: s.budgets, branches: s.branches })).catch(fail);

    if (s.lists !== prev.lists) {
      for (const key of new Set([...Object.keys(s.lists), ...Object.keys(prev.lists)])) {
        const now = s.lists[key];
        const before = prev.lists[key];
        if (now === before) continue;
        if (!now) {
          deleteDoc(r.list(key)).catch(fail);
          continue;
        }
        const pairs: unknown[] = [];
        const oldItems = before?.items ?? {};
        for (const k of new Set([...Object.keys(now.items), ...Object.keys(oldItems)])) {
          const a = now.items[k];
          const b = oldItems[k];
          if (JSON.stringify(a) === JSON.stringify(b)) continue;
          pairs.push(new FieldPath('items', k), a ? strip(a) : deleteField());
        }
        if (now.branchId !== before?.branchId) pairs.push('branchId', now.branchId);
        if (now.startedAt !== before?.startedAt) pairs.push('startedAt', now.startedAt);
        if (!pairs.length) continue;
        const [field, value, ...more] = pairs as [FieldPath | string, unknown, ...unknown[]];
        // Field-level update; if the document doesn't exist yet, create it whole.
        updateDoc(r.list(key), field, value, ...more).catch(() => setDoc(r.list(key), strip(now)).catch(fail));
      }
    }

    if (s.history !== prev.history) {
      const before = new Map(prev.history.map((h) => [h.id, h]));
      const after = new Set(s.history.map((h) => h.id));
      for (const h of s.history) if (before.get(h.id) !== h) setDoc(r.entry(h.id), strip(h)).catch(fail);
      for (const id of before.keys()) if (!after.has(id)) deleteDoc(r.entry(id)).catch(fail);
    }
  });
}

// Snapshots are applied even while this device has writes in flight: Firestore
// merges pending local writes into them, and it does not re-send the settled
// state afterwards, so skipping them would lose the other phone's changes.
function watchRemote(r: Refs): Unsubscribe[] {
  const onErr = (e: Error) => setStatus('error', e.message);
  const online = () => useSyncStatus.getState().status !== 'online' && setStatus('online');
  return [
    onSnapshot(
      r.catalog,
      (snap) => {
        online();
        if (!snap.exists()) return;
        const d = snap.data();
        applyRemote({ categories: d.categories ?? [], products: d.products ?? [] });
      },
      onErr,
    ),
    onSnapshot(
      r.home,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        applyRemote({ stock: d.stock ?? {}, budgets: d.budgets ?? {}, branches: d.branches ?? [] });
      },
      onErr,
    ),
    onSnapshot(
      r.lists,
      (snap) => {
        const lists: Record<string, ActiveList> = {};
        snap.forEach((d) => (lists[d.id] = { items: {}, branchId: null, startedAt: 0, ...(d.data() as Partial<ActiveList>) }));
        applyRemote({ lists });
      },
      onErr,
    ),
    onSnapshot(
      r.history,
      (snap) => {
        const history = snap.docs.map((d) => d.data() as HistoryEntry).sort((a, b) => b.date - a.date);
        applyRemote({ history });
      },
      onErr,
    ),
  ];
}

export async function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
  if (app) await deleteApp(app).catch(() => {});
  app = null;
  setStatus('off');
}

/**
 * Connects this device to the family.
 * `mode: 'create'` uploads this device's data; `'join'` replaces it with the family's
 * (history from both sides is kept).
 */
export async function startSync(configText: string, code: string, mode: 'create' | 'join' | 'resume') {
  await stopSync();
  setStatus('connecting');
  try {
    const cfg = parseFirebaseConfig(configText);
    app = initializeApp(cfg, `family-sync-${Date.now()}`);
    const db = initializeFirestore(app, { localCache: persistentLocalCache() });
    // Local testing only: ?firestoreEmulator=host:port is honored on localhost.
    const emu = location.hostname === 'localhost' && new URLSearchParams(location.search).get('firestoreEmulator');
    if (emu) connectFirestoreEmulator(db, emu.split(':')[0], Number(emu.split(':')[1]));
    const r = refs(db, code);

    if (mode === 'create') {
      await pushEverything(db, r);
    } else if (mode === 'join') {
      const exists = (await getDoc(r.catalog)).exists();
      if (!exists) throw new Error('לא נמצאה קבוצה עם הקוד הזה');
      // Keep this device's history too: upload entries the family doesn't have yet.
      const remoteIds = new Set((await getDocs(r.history)).docs.map((d) => d.id));
      const mine = useApp.getState().history.filter((h) => !remoteIds.has(h.id));
      await Promise.all(mine.map((h) => setDoc(r.entry(h.id), strip(h))));
    }
    unsubs = [...watchRemote(r), watchLocal(r)];
  } catch (e) {
    setStatus('error', (e as Error).message);
    throw e;
  }
}

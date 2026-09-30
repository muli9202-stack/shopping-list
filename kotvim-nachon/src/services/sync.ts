import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useStore } from '../store';
import type { Child, FamilySettings } from '../types';

/**
 * Cloud sync: families/{uid} holds the settings, families/{uid}/children/{childId} one doc per child.
 * Local state (zustand + localStorage) stays the source of truth while offline; the newest `updatedAt` wins.
 */
let stopFns: (() => void)[] = [];
const synced = new Map<string, number>();
let settingsSynced = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function startSync(uid: string): Promise<void> {
  stopSync();
  if (!db) return;
  const fam = doc(db, 'families', uid);
  const kids = collection(fam, 'children');
  // a child deleted on one device leaves a marker here, so other devices remove it too
  const deleted = collection(fam, 'deleted');
  try {
    const [famSnap, kidsSnap, delSnap] = await Promise.all([getDoc(fam), getDocs(kids), getDocs(deleted)]);
    const remote = kidsSnap.docs.map((d) => d.data() as Child);
    remote.forEach((c) => synced.set(c.id, c.updatedAt));
    const settings = famSnap.exists() ? ((famSnap.data().settings as FamilySettings) ?? null) : null;
    if (settings) settingsSynced = settings.updatedAt;
    useStore.getState().mergeRemote(settings, remote, delSnap.docs.map((d) => d.id));
  } catch (e) {
    console.warn('initial sync failed (offline?)', e);
  }
  stopFns.push(
    onSnapshot(kids, (snap) => {
      const remote = snap.docs.filter((d) => !d.metadata.hasPendingWrites).map((d) => d.data() as Child);
      remote.forEach((c) => synced.set(c.id, Math.max(synced.get(c.id) ?? 0, c.updatedAt)));
      if (remote.length) useStore.getState().mergeRemote(null, remote);
    }),
  );
  stopFns.push(
    onSnapshot(deleted, (snap) => {
      const ids = snap.docs.map((d) => d.id);
      if (ids.length) useStore.getState().mergeRemote(null, [], ids);
    }),
  );
  stopFns.push(useStore.subscribe(() => schedulePush(uid)));
  schedulePush(uid);
}

function schedulePush(uid: string) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => push(uid), 1500);
}

async function push(uid: string) {
  if (!db) return;
  const { children, settings } = useStore.getState();
  const fam = doc(db, 'families', uid);
  try {
    if (settings.updatedAt > settingsSynced) {
      await setDoc(fam, { settings }, { merge: true });
      settingsSynced = settings.updatedAt;
    }
    for (const c of children) {
      if ((synced.get(c.id) ?? 0) >= c.updatedAt) continue;
      await setDoc(doc(fam, 'children', c.id), JSON.parse(JSON.stringify(c)));
      synced.set(c.id, c.updatedAt);
    }
  } catch (e) {
    console.warn('sync push failed, will retry', e);
  }
}

export async function deleteChildRemote(uid: string, childId: string) {
  if (!db) return;
  synced.delete(childId);
  await setDoc(doc(db, 'families', uid, 'deleted', childId), { t: Date.now() }).catch((e) => console.warn(e));
  await deleteDoc(doc(db, 'families', uid, 'children', childId)).catch((e) => console.warn(e));
}

export function stopSync() {
  stopFns.forEach((f) => f());
  stopFns = [];
  synced.clear();
  settingsSynced = 0;
}

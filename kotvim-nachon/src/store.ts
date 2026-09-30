import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Child, FamilySettings } from './types';
import { newChild } from './engine/progress';

export type Mode = 'none' | 'local' | 'cloud';

interface State {
  mode: Mode;
  uid: string | null;
  email: string | null;
  settings: FamilySettings;
  children: Child[];
  activeChildId: string | null;
  setMode: (mode: Mode, uid?: string | null, email?: string | null) => void;
  addChild: (name: string, grade: number, avatar: string) => Child;
  updateChild: (id: string, fn: (c: Child) => Child) => void;
  removeChild: (id: string) => void;
  setActive: (id: string | null) => void;
  setSettings: (p: Partial<FamilySettings>) => void;
  mergeRemote: (settings: FamilySettings | null, children: Child[]) => void;
  resetAll: () => void;
}

const defaultSettings: FamilySettings = { voiceOn: true, parentPin: null, updatedAt: 0 };

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      mode: 'none',
      uid: null,
      email: null,
      settings: defaultSettings,
      children: [],
      activeChildId: null,
      setMode: (mode, uid = null, email = null) => set({ mode, uid, email }),
      addChild: (name, grade, avatar) => {
        const c = newChild(name, grade, avatar);
        set({ children: [...get().children, c] });
        return c;
      },
      updateChild: (id, fn) => set({ children: get().children.map((c) => (c.id === id ? fn(c) : c)) }),
      removeChild: (id) =>
        set({
          children: get().children.filter((c) => c.id !== id),
          activeChildId: get().activeChildId === id ? null : get().activeChildId,
        }),
      setActive: (id) => set({ activeChildId: id }),
      setSettings: (p) => set({ settings: { ...get().settings, ...p, updatedAt: Date.now() } }),
      mergeRemote: (settings, remote) => {
        const byId = new Map(get().children.map((c) => [c.id, c]));
        for (const r of remote) {
          const l = byId.get(r.id);
          if (!l || r.updatedAt > l.updatedAt) byId.set(r.id, r);
        }
        const s = settings && settings.updatedAt > get().settings.updatedAt ? settings : get().settings;
        set({ children: Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt), settings: s });
      },
      resetAll: () => set({ mode: 'none', uid: null, email: null, settings: defaultSettings, children: [], activeChildId: null }),
    }),
    { name: 'kotvim-nachon', version: 1 },
  ),
);

export function useActiveChild(): Child | null {
  return useStore((s) => s.children.find((c) => c.id === s.activeChildId) ?? null);
}

/** Update the active child. */
export function updateActive(fn: (c: Child) => Child) {
  const { activeChildId, updateChild } = useStore.getState();
  if (activeChildId) updateChild(activeChildId, fn);
}

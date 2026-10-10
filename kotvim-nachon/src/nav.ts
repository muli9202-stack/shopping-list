import { create } from 'zustand';
import type { GameId, SkillId, Level } from './types';

export type Route =
  | { name: 'login' }
  | { name: 'family' }
  | { name: 'parentGate'; next: Route }
  | { name: 'parents' }
  | { name: 'settings' }
  | { name: 'privacy' }
  | { name: 'child' }
  | { name: 'learn' }
  | { name: 'teacher' }
  | { name: 'weekwords' }
  | { name: 'arcade' }
  | { name: 'tutor' }
  | { name: 'arcadePlay'; id: string }
  | { name: 'diagnostic' }
  | { name: 'stage' }
  | { name: 'trick'; skill: SkillId; back?: boolean }
  | { name: 'tricks' }
  | { name: 'practice'; skill: SkillId; game: GameId; level?: Level }
  | { name: 'games' }
  | { name: 'review' }
  | { name: 'write' }
  | { name: 'room' }
  | { name: 'deleteAccount' };

interface NavState {
  stack: Route[];
  go: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  reset: (r: Route) => void;
}

export const useNav = create<NavState>()((set, get) => ({
  stack: [{ name: 'login' }],
  go: (r) => set({ stack: [...get().stack, r] }),
  replace: (r) => set({ stack: [...get().stack.slice(0, -1), r] }),
  back: () => {
    const s = get().stack;
    if (s.length > 1) set({ stack: s.slice(0, -1) });
  },
  reset: (r) => set({ stack: [r] }),
}));

export function useRoute(): Route {
  return useNav((s) => s.stack[s.stack.length - 1]);
}

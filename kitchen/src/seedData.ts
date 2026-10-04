import { create } from 'zustand';

/**
 * The built-in channel videos and recipes are large (several MB), so they
 * are fetched as separate files after the page is already on screen.
 */
type VideoRows = Record<string, [string, string, string, (string[] | null)?, 1?][]>;
type RecipeRows = [string, string, string, string, string[], string[], string?][];

export const useSeeds = create<{ rev: number; videos: VideoRows; recipes: RecipeRows; failed: boolean }>(() => ({
  rev: 0,
  videos: {},
  recipes: [],
  failed: false,
}));

async function getJson<T>(name: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`./${name}`);
      if (res.ok) return (await res.json()) as T;
      lastErr = new Error(`${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw lastErr;
}

let started = false;
export function loadSeeds() {
  if (started) return;
  started = true;
  void getJson<VideoRows>('seed-videos.json')
    .then((videos) => useSeeds.setState((s) => ({ videos, rev: s.rev + 1 })))
    .catch(() => useSeeds.setState({ failed: true }));
  void getJson<RecipeRows>('seed-recipes.json')
    .then((recipes) => useSeeds.setState((s) => ({ recipes, rev: s.rev + 1 })))
    .catch(() => useSeeds.setState({ failed: true }));
}

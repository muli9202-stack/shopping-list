import type { Recipe } from './types';
import { useSeeds } from './seedData';

/**
 * Recipes taken from the descriptions of the built-in channel videos.
 * Ingredient and step lines are copied verbatim; nothing is added. Rows are
 * [youtubeId, chefId, categoryId, title, ingredients, steps, sourcePage?]. Without a
 * source page the lines come from the video description.
 */
type Row = [string, string, string, string, string[], string[], string?];

let cache: { raw: unknown; out: Recipe[] } | null = null;

export function seedRecipes(): Recipe[] {
  const raw = useSeeds.getState().recipes;
  if (cache?.raw === raw) return cache.out;
  let i = 0;
  const out = (raw as unknown as Row[]).map(([youtubeId, chefId, categoryId, title, ingredients, steps, source]) => ({
    id: `sr_${youtubeId}`,
    chefId,
    categoryId,
    youtubeId,
    url: `https://www.youtube.com/watch?v=${youtubeId}`,
    title,
    ingredients,
    steps,
    missing: ingredients.length === 0 || steps.length === 0,
    description: '',
    source,
    rating: 0,
    createdAt: -i++,
  }));
  cache = { raw, out };
  return out;
}

export const isSeedRecipe = (id: string) => id.startsWith('sr_');

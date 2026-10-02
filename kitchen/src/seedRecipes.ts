import type { Recipe } from './types';
import raw from './seedRecipes.json';

/**
 * Recipes taken from the descriptions of the built-in channel videos.
 * Ingredient and step lines are copied verbatim; nothing is added. Rows are
 * [youtubeId, chefId, categoryId, title, ingredients, steps].
 */
type Row = [string, string, string, string, string[], string[]];

let cache: Recipe[] | null = null;

export function seedRecipes(): Recipe[] {
  if (cache) return cache;
  let i = 0;
  cache = (raw as unknown as Row[]).map(([youtubeId, chefId, categoryId, title, ingredients, steps]) => ({
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
    rating: 0,
    createdAt: -i++,
  }));
  return cache;
}

export const isSeedRecipe = (id: string) => id.startsWith('sr_');

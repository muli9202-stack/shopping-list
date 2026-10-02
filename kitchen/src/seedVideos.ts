import type { Video } from './types';
import raw from './seedVideos.json';

/**
 * Real videos from each seeded chef's YouTube channel (titles as published),
 * sorted into categories by keywords in the title. Rows are
 * [youtubeId, title, mainCategory, extraCategories?].
 */
type Row = [string, string, string, string[]?];

let cache: Video[] | null = null;

export function seedVideos(): Video[] {
  if (cache) return cache;
  const out: Video[] = [];
  let i = 0;
  for (const [chefId, rows] of Object.entries(raw as unknown as Record<string, Row[]>)) {
    for (const [youtubeId, title, categoryId, extra] of rows) {
      out.push({
        id: `s_${youtubeId}`,
        chefId,
        categoryId,
        extraCategoryIds: extra,
        youtubeId,
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        title,
        rating: 0,
        // Keeps each channel's newest-first order among unrated videos.
        createdAt: -i++,
      });
    }
  }
  cache = out;
  return out;
}

export const isSeedVideo = (id: string) => id.startsWith('s_');

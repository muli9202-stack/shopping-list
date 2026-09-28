import type { Category, ListItem, Product } from './types';

/**
 * A shopping list holds products (keyed by product id) and whole categories
 * (keyed by `cat:<id>`). A category entry means "I need something from here";
 * it only shows as its own row while none of its products are selected.
 */
export const CAT_PREFIX = 'cat:';
export const catKey = (categoryId: string) => CAT_PREFIX + categoryId;
export const isCatKey = (key: string) => key.startsWith(CAT_PREFIX);
export const catIdOf = (key: string) => key.slice(CAT_PREFIX.length);

export function descendantIds(categories: Category[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        grew = true;
      }
    }
  }
  return out;
}

/** List keys that should appear as rows (products, plus categories with no selected product inside). */
export function visibleKeys(items: Record<string, ListItem>, categories: Category[], products: Product[]): string[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const catIds = new Set(categories.map((c) => c.id));
  const selectedProductCats = Object.keys(items)
    .filter((k) => !isCatKey(k))
    .map((k) => byId.get(k)?.categoryId)
    .filter((c): c is string => !!c);
  return Object.keys(items).filter((k) => {
    if (!isCatKey(k)) return byId.has(k);
    const id = catIdOf(k);
    if (!catIds.has(id)) return false;
    const inside = descendantIds(categories, id);
    return !selectedProductCats.some((c) => inside.has(c));
  });
}

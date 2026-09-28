import type { Category, ChainId, Product } from './types';

export interface Section {
  /** null = the "no category" bucket. */
  category: Category | null;
  depth: number;
  path: string;
  products: Product[];
}

export const NO_CATEGORY = 'ללא קטגוריה';

export function categoryPath(categories: Category[], id: string | null): string {
  const names: string[] = [];
  let cur = id ? categories.find((c) => c.id === id) : undefined;
  while (cur) {
    names.unshift(cur.name);
    const parentId = cur.parentId;
    cur = parentId ? categories.find((c) => c.id === parentId) : undefined;
  }
  return names.join(' › ') || NO_CATEGORY;
}

export function childCategories(categories: Category[], chainId: ChainId, parentId: string | null): Category[] {
  return categories.filter((c) => c.chainId === chainId && c.parentId === parentId).sort((a, b) => a.order - b.order);
}

/**
 * Flattens a chain's category tree into display sections in tree (DFS) order.
 * Sections with no matching products are dropped unless `keepEmpty`.
 */
export function buildSections(
  categories: Category[],
  products: Product[],
  chainId: ChainId,
  include: (p: Product) => boolean = () => true,
  keepEmpty = false,
): Section[] {
  const byCat = new Map<string | null, Product[]>();
  for (const p of products) {
    if (p.chainId !== chainId || !include(p)) continue;
    const list = byCat.get(p.categoryId) ?? [];
    list.push(p);
    byCat.set(p.categoryId, list);
  }
  for (const list of byCat.values()) list.sort((a, b) => a.order - b.order);

  const out: Section[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    for (const c of childCategories(categories, chainId, parentId)) {
      const path = prefix ? `${prefix} › ${c.name}` : c.name;
      const prods = byCat.get(c.id) ?? [];
      const at = out.length;
      walk(c.id, depth + 1, path);
      // Keep a parent header when any descendant section survived, so subcategories stay grouped.
      if (prods.length || keepEmpty || out.length > at) out.splice(at, 0, { category: c, depth, path, products: prods });
    }
  };
  walk(null, 0, '');
  const loose = byCat.get(null) ?? [];
  if (loose.length) out.push({ category: null, depth: 0, path: NO_CATEGORY, products: loose });
  return out;
}

/** Top-level ancestor id of a category (itself when top-level). */
export function rootCategoryId(categories: Category[], id: string | null): string | null {
  let cur = id ? categories.find((c) => c.id === id) : undefined;
  while (cur?.parentId) {
    const parentId = cur.parentId;
    cur = categories.find((c) => c.id === parentId);
  }
  return cur?.id ?? null;
}

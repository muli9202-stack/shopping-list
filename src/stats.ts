import type { HistoryEntry } from './types';

export interface ProductStat {
  productId: string;
  name: string;
  categoryPath: string;
  /** Number of past lists this product appeared in. */
  appearances: number;
  /** appearances / total lists (0..1). */
  frequency: number;
  bought: number;
  missing: number;
  avgQty: number;
  lastDate: number;
  tier: 'always' | 'often' | 'sometimes';
}

export interface AverageSummary {
  lists: number;
  avgItems: number;
  /** Average days between trips; null with fewer than two lists. */
  avgDaysBetween: number | null;
  firstDate: number;
  lastDate: number;
  products: ProductStat[];
}

export const TIER_LABELS: Record<ProductStat['tier'], string> = {
  always: 'קונה כמעט תמיד',
  often: 'קונה לעיתים קרובות',
  sometimes: 'קונה לפעמים',
};

export function computeAverage(entries: HistoryEntry[]): AverageSummary | null {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => a.date - b.date);
  const n = sorted.length;
  const map = new Map<string, Omit<ProductStat, 'frequency' | 'avgQty' | 'tier'> & { qty: number }>();

  for (const e of sorted) {
    for (const it of e.items) {
      if (it.productId.startsWith('cat:')) continue;
      const s = map.get(it.productId) ?? {
        productId: it.productId,
        name: it.name,
        categoryPath: it.categoryPath,
        appearances: 0,
        bought: 0,
        missing: 0,
        qty: 0,
        lastDate: 0,
      };
      s.appearances++;
      s.qty += it.qty;
      if (it.status === 'bought') s.bought++;
      if (it.status === 'missing') s.missing++;
      s.lastDate = e.date;
      // Keep the latest name in case the product was renamed.
      s.name = it.name;
      s.categoryPath = it.categoryPath;
      map.set(it.productId, s);
    }
  }

  const products: ProductStat[] = [...map.values()]
    .map(({ qty, ...s }) => {
      const frequency = s.appearances / n;
      return {
        ...s,
        frequency,
        avgQty: Math.round((qty / s.appearances) * 10) / 10,
        tier: frequency >= 0.75 ? 'always' : frequency >= 0.4 ? 'often' : 'sometimes',
      } as ProductStat;
    })
    .sort((a, b) => b.frequency - a.frequency || a.name.localeCompare(b.name, 'he'));

  const spanDays = (sorted[n - 1].date - sorted[0].date) / 86_400_000;
  return {
    lists: n,
    avgItems: Math.round((sorted.reduce((sum, e) => sum + e.items.length, 0) / n) * 10) / 10,
    avgDaysBetween: n > 1 ? Math.round((spanDays / (n - 1)) * 10) / 10 : null,
    firstDate: sorted[0].date,
    lastDate: sorted[n - 1].date,
    products,
  };
}

export const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: '2-digit' });

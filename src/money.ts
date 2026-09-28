import { isCatKey } from './listView';
import type { ChainId, ListItem, Product } from './types';

export const fmtMoney = (n: number) => `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export interface ListTotals {
  /** Expected cost of everything still wanted (pending + bought). */
  planned: number;
  /** Cost of what was already put in the cart. */
  bought: number;
  /** Products in the list without a price. */
  unpriced: number;
}

export function listTotals(keys: string[], items: Record<string, ListItem>, products: Product[]): ListTotals {
  const byId = new Map(products.map((p) => [p.id, p]));
  const t: ListTotals = { planned: 0, bought: 0, unpriced: 0 };
  for (const k of keys) {
    if (isCatKey(k)) continue;
    const it = items[k];
    const p = byId.get(k);
    if (!it || !p || it.status === 'missing') continue;
    if (!p.price) {
      t.unpriced++;
      continue;
    }
    t.planned += p.price * it.qty;
    if (it.status === 'bought') t.bought += p.price * it.qty;
  }
  return t;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export interface ChainComparison {
  here: number;
  there: number;
  /** Products priced in both chains (the comparison covers only these). */
  matched: number;
  total: number;
}

/** Compares the list's cost with the same products (matched by name) at the other chain. */
export function compareWithChain(keys: string[], items: Record<string, ListItem>, products: Product[], other: ChainId): ChainComparison {
  const byId = new Map(products.map((p) => [p.id, p]));
  const otherByName = new Map(products.filter((p) => p.chainId === other && p.price).map((p) => [norm(p.name), p]));
  const r: ChainComparison = { here: 0, there: 0, matched: 0, total: 0 };
  for (const k of keys) {
    const p = byId.get(k);
    if (!p) continue;
    r.total++;
    const o = otherByName.get(norm(p.name));
    if (!p.price || !o?.price) continue;
    r.matched++;
    r.here += p.price * items[k].qty;
    r.there += o.price * items[k].qty;
  }
  return r;
}

import { buildSections } from './catalog';
import { catKey, visibleKeys } from './listView';
import { useApp } from './store';
import { CHAINS, MODES, listKey, type ChainId, type Mode } from './types';
import { showToast } from './ui/toast';

/** Plain-text list grouped by category, ready for WhatsApp. */
export function listAsText(chainId: ChainId, mode: Mode): string {
  const s = useApp.getState();
  const items = s.lists[listKey(chainId, mode)]?.items ?? {};
  const visible = new Set(visibleKeys(items, s.categories, s.products));
  const lines = [`🛒 ${MODES[mode].name} · ${CHAINS[chainId].name}`];
  for (const sec of buildSections(s.categories, s.products, chainId, (p) => visible.has(p.id), true)) {
    const rows: string[] = [];
    if (sec.category && visible.has(catKey(sec.category.id))) rows.push(`${mark(items[catKey(sec.category.id)].status)} ${sec.category.name} (כללי)`);
    for (const p of sec.products) {
      const it = items[p.id];
      rows.push(`${mark(it.status)} ${p.name}${it.qty > 1 ? ` ×${it.qty}` : ''}${p.note ? ` (${p.note})` : ''}`);
    }
    if (rows.length) lines.push('', `*${sec.path}*`, ...rows);
  }
  return lines.join('\n');
}

const mark = (status: string) => (status === 'bought' ? '✅' : status === 'missing' ? '❌' : '⬜');

export async function shareList(chainId: ChainId, mode: Mode) {
  const text = listAsText(chainId, mode);
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('הרשימה הועתקה. אפשר להדביק בוואטסאפ');
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
}

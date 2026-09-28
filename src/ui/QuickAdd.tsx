import { useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { categoryPath } from '../catalog';
import { CHAINS, CHAIN_IDS, MODES, MODE_IDS, listKey, type ChainId, type Mode } from '../types';
import { Sheet } from './dialog';
import { haptic, showToast } from './toast';

const LAST = 'quick-add-target';

function readLast(): { chain: ChainId; mode: Mode } {
  try {
    const v = JSON.parse(localStorage.getItem(LAST) ?? 'null');
    if (v && CHAIN_IDS.includes(v.chain) && MODE_IDS.includes(v.mode)) return v;
  } catch {
    /* storage unavailable */
  }
  return { chain: 'neto', mode: 'weekly' };
}

/** Floating "+" that adds products to any list without navigating through screens. */
export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="הוספה מהירה לרשימה">
        +
      </button>
      {open && <QuickAddSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const products = useApp((s) => s.products);
  const categories = useApp((s) => s.categories);
  const lists = useApp((s) => s.lists);
  const [target, setTarget] = useState(readLast);
  const [q, setQ] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (patch: Partial<typeof target>) => {
    const next = { ...target, ...patch };
    setTarget(next);
    try {
      localStorage.setItem(LAST, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const items = lists[listKey(target.chain, target.mode)]?.items ?? {};
  const text = q.trim();
  const matches = useMemo(() => {
    const pool = products.filter((p) => p.chainId === target.chain);
    if (!text) return [];
    const starts = pool.filter((p) => p.name.startsWith(text));
    const contains = pool.filter((p) => !p.name.startsWith(text) && p.name.includes(text));
    return [...starts, ...contains].slice(0, 8);
  }, [products, target.chain, text]);
  const exact = matches.find((p) => p.name === text);

  const add = (productId: string, name: string) => {
    const s = useApp.getState();
    if (items[productId]) s.setQty(target.chain, target.mode, productId, items[productId].qty + 1);
    else s.addToList(target.chain, target.mode, productId);
    haptic();
    setAdded((a) => [name, ...a.filter((x) => x !== name)].slice(0, 12));
    setQ('');
    inputRef.current?.focus();
  };
  const addNew = () => {
    if (!text) return;
    const s = useApp.getState();
    s.addProducts(target.chain, [text], null);
    const p = useApp.getState().products.filter((x) => x.chainId === target.chain && x.name === text).pop();
    if (p) add(p.id, p.name);
    showToast(`"${text}" נוסף כמוצר חדש (בלי קטגוריה)`);
  };

  return (
    <Sheet title="הוספה מהירה לרשימה" onClose={onClose}>
      <div className="quick-target">
        <div className="chip-row">
          {CHAIN_IDS.map((c) => (
            <button key={c} className={`chip ${target.chain === c ? 'active' : ''}`} onClick={() => choose({ chain: c })}>
              {CHAINS[c].name}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {MODE_IDS.map((m) => (
            <button key={m} className={`chip ${target.mode === m ? 'active' : ''}`} onClick={() => choose({ mode: m })}>
              {MODES[m].name}
            </button>
          ))}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (exact) add(exact.id, exact.name);
          else if (matches.length === 1) add(matches[0].id, matches[0].name);
          else addNew();
        }}
      >
        <input ref={inputRef} className="input" autoFocus placeholder="מה להוסיף? למשל: חלב" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="menu">
        {matches.map((p) => (
          <button key={p.id} className="quick-match" onClick={() => add(p.id, p.name)}>
            <span>
              {p.name}
              <span className="pick-path">{categoryPath(categories, p.categoryId)}</span>
            </span>
            <span className={items[p.id] ? 'in-list-pill' : 'quick-plus'}>{items[p.id] ? `ברשימה ×${items[p.id].qty}` : '+'}</span>
          </button>
        ))}
        {text && !exact && (
          <button className="quick-match new" onClick={addNew}>
            <span>+ הוספת "{text}" כמוצר חדש</span>
          </button>
        )}
      </div>
      {added.length > 0 && (
        <p className="ok-msg small">
          נוספו ל{MODES[target.mode].name} ב{CHAINS[target.chain].name}: {added.join(', ')}
        </p>
      )}
      <button className="btn primary block" onClick={onClose}>
        סיום
      </button>
    </Sheet>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { buildSections } from '../catalog';
import { CHAINS, MODES, MODE_IDS, type ChainId, type Product } from '../types';
import { Empty, Header, Stepper } from '../ui/components';
import { promptDialog } from '../ui/dialog';

export default function InventoryScreen({ chainId }: { chainId: ChainId }) {
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const stock = useApp((s) => s.stock);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [onlyTracked, setOnlyTracked] = useState(false);
  const [msg, setMsg] = useState('');
  const q = query.trim();

  const sections = useMemo(
    () => buildSections(categories, products, chainId, (p) => (!q || p.name.includes(q)) && (!onlyTracked || !!p.target)).filter((s) => s.products.length),
    [categories, products, chainId, q, onlyTracked],
  );
  const chainProducts = products.filter((p) => p.chainId === chainId);
  const short = chainProducts.filter((p) => p.target && (stock[p.id] ?? 0) < p.target);

  const fill = (mode: (typeof MODE_IDS)[number]) => {
    const n = useApp.getState().fillFromInventory(chainId, mode);
    if (n) navigate(`/c/${chainId}/${mode}`);
    else setMsg(`כל מה שחסר כבר נמצא ברשימה של ${MODES[mode].period}`);
  };

  return (
    <div className={`page with-bottom-bar ${CHAINS[chainId].className}`}>
      <Header title="מלאי בבית" subtitle={CHAINS[chainId].name} back={`/c/${chainId}`} />
      {chainProducts.length === 0 ? (
        <Empty icon="🏠" title="עדיין אין מוצרים">
          <p className="muted">קודם מוסיפים קטגוריות ומוצרים בקנייה השבועית או החודשית.</p>
        </Empty>
      ) : (
        <>
          <div className="card inv-help">
            <p>
              לכל מוצר קובעים <strong>כמה צריך בבית</strong>, ומעדכנים <strong>כמה יש</strong>. האפליקציה בונה רשימה ממה שחסר.
            </p>
            <p className="muted small">בסיום כל קנייה, מה שנקנה מתווסף למלאי אוטומטית.</p>
          </div>
          <div className="search-row">
            <input className="input search" type="search" placeholder="🔍 חיפוש מוצר" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className={`chip ${onlyTracked ? 'active' : ''}`} onClick={() => setOnlyTracked(!onlyTracked)}>
              במעקב
            </button>
          </div>
          {sections.map((sec) => (
            <section key={sec.category?.id ?? 'none'} className="shop-section">
              <div className="shop-section-title">{sec.path}</div>
              <div className="catalog-items">
                {sec.products.map((p) => (
                  <InventoryRow key={p.id} product={p} have={stock[p.id] ?? 0} />
                ))}
              </div>
            </section>
          ))}
          {msg && <p className="ok-msg center">{msg}</p>}
        </>
      )}
      {chainProducts.length > 0 && (
        <div className="bottom-bar">
          <div className="row">
            {MODE_IDS.map((m) => (
              <button key={m} className="btn primary block" disabled={!short.length} onClick={() => fill(m)}>
                {short.length ? `חסרים ${short.length} → ל${MODES[m].name}` : 'לא חסר כלום'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryRow({ product, have }: { product: Product; have: number }) {
  const { setStock, updateProduct } = useApp.getState();
  const low = product.target !== undefined && have < product.target;
  const editTarget = async () => {
    const v = await promptDialog({
      title: `כמה ${product.name} צריך בבית?`,
      message: 'השאר ריק כדי להוציא את המוצר מהמעקב.',
      initial: product.target?.toString() ?? '',
      placeholder: 'לדוגמה: 2',
    });
    if (v === null) return;
    const n = Math.round(parseFloat(v));
    updateProduct(product.id, { target: n > 0 ? n : undefined });
  };
  return (
    <div className={`inv-row ${low ? 'low' : ''}`}>
      <div className="inv-name">
        <span className="stat-name">{product.name}</span>
        <button className="link-btn" onClick={editTarget}>
          {product.target ? `צריך ${product.target}` : '+ מעקב'}
        </button>
      </div>
      {product.target !== undefined && (
        <div className="inv-have">
          <span className="muted small">יש</span>
          <Stepper value={have} onChange={(v) => setStock(product.id, Math.max(0, v))} />
        </div>
      )}
    </div>
  );
}

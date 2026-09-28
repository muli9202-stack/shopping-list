import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, useList } from '../store';
import { buildSections } from '../catalog';
import { CHAINS, MODES, type ChainId, type ListItem, type Mode, type Product } from '../types';
import { Empty, Header } from '../ui/components';
import { confirmDialog } from '../ui/dialog';

type SortMode = 'category' | 'route';

export default function ShopScreen({ chainId, mode }: { chainId: ChainId; mode: Mode }) {
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const list = useList(chainId, mode);
  const { toggleStatus, finishList } = useApp.getState();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortMode>('category');

  const items = list?.items ?? {};
  const sections = useMemo(
    () => buildSections(categories, products, chainId, (p) => !!items[p.id]).filter((s) => s.products.length),
    [categories, products, chainId, items],
  );
  const all = Object.values(items);
  const bought = all.filter((i) => i.status === 'bought').length;
  const missing = all.filter((i) => i.status === 'missing').length;
  const period = MODES[mode].period;

  const finish = async () => {
    const pending = all.length - bought - missing;
    const ok = await confirmDialog({
      title: 'סיום קנייה',
      message: `נקנו ${bought}, לא היו במלאי ${missing}${pending ? `, ${pending} לא סומנו` : ''}. הרשימה תישמר בהיסטוריה ותתחיל רשימה חדשה.`,
      confirmText: 'סיום ושמירה',
    });
    if (ok) {
      finishList(chainId, mode);
      navigate(`/c/${chainId}`);
    }
  };

  return (
    <div className={`page with-bottom-bar ${CHAINS[chainId].className}`}>
      <Header title={`רשימת הקניות של ${period}`} subtitle={CHAINS[chainId].name} back={`/c/${chainId}/${mode}`} />

      {all.length === 0 ? (
        <Empty icon="📝" title="הרשימה ריקה">
          <p className="muted">חזור למסך הבחירה וסמן את המוצרים שצריך {period}.</p>
          <Link className="btn primary" to={`/c/${chainId}/${mode}`}>
            בחירת מוצרים
          </Link>
        </Empty>
      ) : (
        <>
          <div className="progress-card">
            <div className="progress-text">
              <strong>
                {bought} / {all.length}
              </strong>{' '}
              נקנו{missing > 0 && <span className="missing-note"> · {missing} לא היו במלאי</span>}
            </div>
            <div className="progress">
              <div className="progress-bought" style={{ width: `${(bought / all.length) * 100}%` }} />
              <div className="progress-missing" style={{ width: `${(missing / all.length) * 100}%` }} />
            </div>
          </div>

          <div className="segmented">
            <button className={sort === 'category' ? 'active' : ''} onClick={() => setSort('category')}>
              🗂️ לפי קטגוריות
            </button>
            <button className={sort === 'route' ? 'active' : ''} onClick={() => setSort('route')}>
              🧭 לפי מסלול בחנות
            </button>
          </div>

          {sort === 'route' && (
            <div className="notice">
              הסידור לפי מסלול יעבוד אחרי שתגדיר סניף ומפת חנות (שלב 3). בינתיים הרשימה מוצגת לפי קטגוריות.
            </div>
          )}

          {sections.map((sec) => (
            <section key={sec.category?.id ?? 'none'} className="shop-section">
              <div className="shop-section-title">{sec.path}</div>
              {sec.products.map((p) => (
                <ShopRow
                  key={p.id}
                  product={p}
                  item={items[p.id]}
                  onToggle={() => toggleStatus(chainId, mode, p.id, 'bought')}
                  onMissing={() => toggleStatus(chainId, mode, p.id, 'missing')}
                />
              ))}
            </section>
          ))}
        </>
      )}

      {all.length > 0 && (
        <div className="bottom-bar">
          <button className="btn primary block big" onClick={finish}>
            ✔ סיום קנייה ושמירה
          </button>
        </div>
      )}
    </div>
  );
}

export function ShopRow({
  product,
  item,
  onToggle,
  onMissing,
  highlight,
}: {
  product: Product;
  item: ListItem;
  onToggle: () => void;
  onMissing: () => void;
  highlight?: boolean;
}) {
  return (
    <div className={`shop-row status-${item.status} ${highlight ? 'highlight' : ''}`}>
      <button className="shop-main" onClick={onToggle}>
        <span className="shop-check">{item.status === 'bought' ? '✓' : ''}</span>
        <span className="shop-name">{product.name}</span>
        {item.qty > 1 && (
          <span className="shop-qty" dir="ltr">
            ×{item.qty}
          </span>
        )}
      </button>
      <button className={`missing-btn ${item.status === 'missing' ? 'on' : ''}`} onClick={onMissing}>
        {item.status === 'missing' ? 'לא היה במלאי ✕' : 'לא היה במלאי'}
      </button>
    </div>
  );
}

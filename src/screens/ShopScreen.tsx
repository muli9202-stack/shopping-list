import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, useList } from '../store';
import { buildSections } from '../catalog';
import { catKey, visibleKeys } from '../listView';
import { CHAINS, MODES, type ChainId, type ListItem, type Mode } from '../types';
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

  const [query, setQuery] = useState('');

  const items = list?.items ?? {};
  const visible = useMemo(() => new Set(visibleKeys(items, categories, products)), [items, categories, products]);
  const q = query.trim();
  // Each section: an optional whole-category row ("something from dairy") plus the chosen products.
  const sections = useMemo(
    () =>
      buildSections(categories, products, chainId, (p) => visible.has(p.id), true)
        .map((sec) => {
          const rows: { key: string; name: string; note?: string }[] = [];
          if (sec.category && visible.has(catKey(sec.category.id)))
            rows.push({ key: catKey(sec.category.id), name: sec.category.name, note: 'כל הקטגוריה' });
          for (const p of sec.products) rows.push({ key: p.id, name: p.name });
          return { sec, rows: q ? rows.filter((r) => r.name.includes(q)) : rows };
        })
        .filter((x) => x.rows.length),
    [categories, products, chainId, visible, q],
  );
  const all = [...visible].map((k) => items[k]);
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

          <div className="search-row">
            <input className="input search" type="search" placeholder="🔍 חיפוש ברשימה" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {sections.length === 0 && <p className="muted center pad">לא נמצאו מוצרים ברשימה</p>}
          {sections.map(({ sec, rows }) => (
            <section key={sec.category?.id ?? 'none'} className="shop-section">
              <div className="shop-section-title">{sec.path}</div>
              {rows.map((r) => (
                <ShopRow
                  key={r.key}
                  name={r.name}
                  note={r.note}
                  item={items[r.key]}
                  onToggle={() => toggleStatus(chainId, mode, r.key, 'bought')}
                  onMissing={() => toggleStatus(chainId, mode, r.key, 'missing')}
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
  name,
  note,
  item,
  onToggle,
  onMissing,
  highlight,
}: {
  name: string;
  note?: string;
  item: ListItem;
  onToggle: () => void;
  onMissing: () => void;
  highlight?: boolean;
}) {
  return (
    <div className={`shop-row status-${item.status} ${highlight ? 'highlight' : ''}`}>
      <button className="shop-main" onClick={onToggle}>
        <span className="shop-check">{item.status === 'bought' ? '✓' : ''}</span>
        <span className="shop-name">
          {name}
          {note && <span className="pick-path">{note}</span>}
        </span>
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

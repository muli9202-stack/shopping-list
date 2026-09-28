import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp, useList } from '../store';
import { buildSections } from '../catalog';
import { catIdOf, catKey, isCatKey, visibleKeys } from '../listView';
import { describeLeg, finalHeading, planRoute, type Route } from '../route';
import { compareWithChain, fmtMoney, listTotals } from '../money';
import { CHAINS, CHAIN_IDS, MODES, type ChainId, type ListItem, type Mode, type Product } from '../types';
import { Empty, Header } from '../ui/components';
import { promptDialog, Sheet } from '../ui/dialog';
import { useWakeLock } from '../ui/useWakeLock';

const Scanner = lazy(() => import('../ui/Scanner'));

type SortMode = 'category' | 'route';

const readSort = (): SortMode | null => {
  try {
    return localStorage.getItem('shop-sort') as SortMode | null;
  } catch {
    return null;
  }
};

/** One cell ≈ 1.2 m of floor. */
const METERS_PER_CELL = 1.2;

export default function ShopScreen({ chainId, mode }: { chainId: ChainId; mode: Mode }) {
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const budget = useApp((s) => s.budgets[mode]);
  const list = useList(chainId, mode);
  const { toggleStatus, setBudget } = useApp.getState();
  const branch = useApp((s) => s.branches.find((b) => b.id === list?.branchId));
  const [params] = useSearchParams();
  const [sort, setSortState] = useState<SortMode>(() => (params.get('branch') || readSort() === 'route' ? 'route' : 'category'));
  const setSort = (m: SortMode) => {
    setSortState(m);
    try {
      localStorage.setItem('shop-sort', m);
    } catch {
      /* storage unavailable */
    }
  };
  useEffect(() => {
    const b = params.get('branch');
    if (b) useApp.getState().setListBranch(chainId, mode, b);
  }, [params, chainId, mode]);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  useWakeLock();

  const items = list?.items ?? {};
  const visibleList = useMemo(() => visibleKeys(items, categories, products), [items, categories, products]);
  const visible = useMemo(() => new Set(visibleList), [visibleList]);
  const q = query.trim();
  // Each section: an optional whole-category row ("something from dairy") plus the chosen products.
  const sections = useMemo(
    () =>
      buildSections(categories, products, chainId, (p) => visible.has(p.id), true)
        .map((sec) => {
          const rows: { key: string; name: string; note?: string; product?: Product }[] = [];
          if (sec.category && visible.has(catKey(sec.category.id)))
            rows.push({ key: catKey(sec.category.id), name: sec.category.name, note: 'כל הקטגוריה' });
          for (const p of sec.products) rows.push({ key: p.id, name: p.name, product: p });
          return { sec, rows: q ? rows.filter((r) => r.name.includes(q)) : rows };
        })
        .filter((x) => x.rows.length),
    [categories, products, chainId, visible, q],
  );
  const all = visibleList.map((k) => items[k]);
  const bought = all.filter((i) => i.status === 'bought').length;
  const missing = all.filter((i) => i.status === 'missing').length;
  const period = MODES[mode].period;
  const totals = useMemo(() => listTotals(visibleList, items, products), [visibleList, items, products]);
  const otherChain = CHAIN_IDS.find((c) => c !== chainId)!;
  const route = useMemo(
    () => (sort === 'route' && branch?.map ? planRoute(branch.map, visibleList, products, categories) : null),
    // Plan over the whole list so the order stays put while items get ticked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, branch?.map, visibleList.join('|'), products, categories],
  );
  const rowFor = (k: string) => {
    if (isCatKey(k)) {
      const c = categories.find((x) => x.id === catIdOf(k));
      return { key: k, name: c?.name ?? '', note: 'כל הקטגוריה' as string | undefined, product: undefined as Product | undefined };
    }
    const p = products.find((x) => x.id === k);
    return { key: k, name: p?.name ?? '', note: undefined as string | undefined, product: p };
  };
  const compare = useMemo(() => compareWithChain(visibleList, items, products, otherChain), [visibleList, items, products, otherChain]);

  const onScan = (code: string) => {
    const s = useApp.getState();
    const p = s.products.find((x) => x.chainId === chainId && x.barcode === code);
    if (!p) {
      setScanning(false);
      setUnknownCode(code);
      return;
    }
    const inList = !!s.lists[`${chainId}:${mode}`]?.items[p.id];
    s.setStatus(chainId, mode, p.id, 'bought');
    setScanMsg(inList ? `✓ ${p.name}` : `✓ ${p.name} (לא היה ברשימה, נוסף)`);
  };

  const editBudget = async () => {
    const v = await promptDialog({
      title: `תקציב ל${MODES[mode].name}`,
      message: 'השאר ריק כדי לבטל את התקציב.',
      initial: budget?.toString() ?? '',
      placeholder: 'לדוגמה: 600',
    });
    if (v === null) return;
    setBudget(mode, parseFloat(v) || undefined);
  };

  return (
    <div className={`page with-bottom-bar ${CHAINS[chainId].className}`}>
      <Header
        title={`רשימת הקניות של ${period}`}
        subtitle={CHAINS[chainId].name}
        back={`/c/${chainId}/${mode}`}
        actions={
          all.length > 0 && (
            <button className="icon-btn" onClick={() => (setScanMsg(''), setScanning(true))} aria-label="סריקת ברקוד">
              📷
            </button>
          )
        }
      />

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
            <MoneyBox totals={totals} budget={budget} onEditBudget={editBudget} />
            {compare.matched > 0 && (
              <div className="compare-line small">
                ב{CHAINS[otherChain].name}, {compare.matched === compare.total ? 'אותם מוצרים' : `${compare.matched} מהמוצרים`} עולים{' '}
                <strong>{fmtMoney(compare.there)}</strong> לעומת {fmtMoney(compare.here)} כאן
                {compare.there !== compare.here &&
                  (compare.there < compare.here ? (
                    <span className="cheaper-there"> · זול שם ב-{fmtMoney(compare.here - compare.there)}</span>
                  ) : (
                    <span className="cheaper-here"> · כאן זול יותר ב-{fmtMoney(compare.there - compare.here)}</span>
                  ))}
              </div>
            )}
          </div>

          <div className="segmented">
            <button className={sort === 'category' ? 'active' : ''} onClick={() => setSort('category')}>
              🗂️ לפי קטגוריות
            </button>
            <button className={sort === 'route' ? 'active' : ''} onClick={() => setSort('route')}>
              🧭 לפי מסלול בחנות
            </button>
          </div>

          <BranchPicker chainId={chainId} mode={mode} branchId={list?.branchId ?? null} />

          <div className="search-row">
            <input className="input search" type="search" placeholder="🔍 חיפוש ברשימה" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {sort === 'route' && branch?.map && route ? (
            <RouteList
              route={route}
              rowFor={rowFor}
              query={q}
              items={items}
              onToggle={(k) => toggleStatus(chainId, mode, k, 'bought')}
              onMissing={(k) => toggleStatus(chainId, mode, k, 'missing')}
              navTo={`/c/${chainId}/${mode}/nav`}
            />
          ) : (
            <>
              {sort === 'route' && (
                <div className="notice">
                  {!branch
                    ? 'כדי לסדר לפי מסלול, בחר למעלה באיזה סניף אתה נמצא.'
                    : 'לסניף הזה עדיין אין מפה. '}
                  {branch && !branch.map && <Link className="link" to={`/c/${chainId}/branches/${branch.id}`}>ליצירת מפה</Link>}
                </div>
              )}
              {sections.length === 0 && <p className="muted center pad">לא נמצאו מוצרים ברשימה</p>}
              {sections.map(({ sec, rows }) => (
                <section key={sec.category?.id ?? 'none'} className="shop-section">
                  <div className="shop-section-title">{sec.path}</div>
                  {rows.map((r) => (
                    <ShopRow
                      key={r.key}
                      name={r.name}
                      note={r.note}
                      price={r.product?.price}
                      item={items[r.key]}
                      onToggle={() => toggleStatus(chainId, mode, r.key, 'bought')}
                      onMissing={() => toggleStatus(chainId, mode, r.key, 'missing')}
                    />
                  ))}
                </section>
              ))}
            </>
          )}
        </>
      )}

      {all.length > 0 && (
        <div className="bottom-bar">
          <button className="btn primary block big" onClick={() => setFinishing(true)}>
            ✔ סיום קנייה ושמירה
          </button>
        </div>
      )}

      {scanning && (
        <Suspense fallback={null}>
          <Scanner onCode={onScan} onClose={() => setScanning(false)} message={scanMsg} />
        </Suspense>
      )}
      {unknownCode && (
        <AssignBarcodeSheet
          code={unknownCode}
          chainId={chainId}
          mode={mode}
          candidates={visibleList.map((k) => products.find((p) => p.id === k)).filter((p): p is Product => !!p)}
          onDone={(name) => {
            setUnknownCode(null);
            setScanMsg(name ? `✓ ${name} (הברקוד נשמר)` : '');
            setScanning(true);
          }}
        />
      )}
      {finishing && (
        <FinishSheet chainId={chainId} mode={mode} counts={{ bought, missing, total: all.length }} totals={totals} onClose={() => setFinishing(false)} />
      )}
    </div>
  );
}

function MoneyBox({ totals, budget, onEditBudget }: { totals: ReturnType<typeof listTotals>; budget?: number; onEditBudget: () => void }) {
  const over = budget !== undefined && totals.planned > budget;
  return (
    <div className="money-box">
      <div className="money-row">
        <span>
          בעגלה <strong>{fmtMoney(totals.bought)}</strong>
          <span className="muted"> מתוך {fmtMoney(totals.planned)} צפוי</span>
        </span>
        <button className="link-btn" onClick={onEditBudget}>
          {budget ? `תקציב ${fmtMoney(budget)}` : '+ תקציב'}
        </button>
      </div>
      {budget !== undefined && (
        <>
          <div className="progress budget-bar">
            <div className={over ? 'over' : ''} style={{ width: `${Math.min(100, (totals.bought / budget) * 100)}%` }} />
          </div>
          <div className={`small ${over ? 'danger-text' : 'muted'}`}>
            {budget - totals.bought >= 0 ? `נשאר ${fmtMoney(budget - totals.bought)}` : `חריגה של ${fmtMoney(totals.bought - budget)}`}
            {over && ` · הרשימה צפויה לעבור את התקציב ב-${fmtMoney(totals.planned - budget)}`}
          </div>
        </>
      )}
      {totals.unpriced > 0 && <div className="muted small">ל-{totals.unpriced} מוצרים אין מחיר (אפשר להוסיף ב-✎ עריכה)</div>}
    </div>
  );
}

function AssignBarcodeSheet({
  code,
  chainId,
  mode,
  candidates,
  onDone,
}: {
  code: string;
  chainId: ChainId;
  mode: Mode;
  candidates: Product[];
  onDone: (name?: string) => void;
}) {
  const [q, setQ] = useState('');
  const products = useApp((s) => s.products);
  const all = products.filter((p) => p.chainId === chainId);
  const shown = q ? all.filter((p) => p.name.includes(q)) : candidates.filter((p) => !p.barcode);
  return (
    <Sheet title="ברקוד חדש" onClose={() => onDone()}>
      <p className="muted">
        הברקוד <span dir="ltr">{code}</span> עוד לא מוכר. לאיזה מוצר הוא שייך? מהפעם הבאה הסריקה תזהה אותו לבד.
      </p>
      <input className="input" placeholder="🔍 חיפוש מוצר" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="menu">
        {shown.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              const s = useApp.getState();
              s.updateProduct(p.id, { barcode: code });
              s.setStatus(chainId, mode, p.id, 'bought');
              onDone(p.name);
            }}
          >
            {p.name}
          </button>
        ))}
        {shown.length === 0 && <p className="muted">לא נמצאו מוצרים</p>}
      </div>
    </Sheet>
  );
}

function FinishSheet({
  chainId,
  mode,
  counts,
  totals,
  onClose,
}: {
  chainId: ChainId;
  mode: Mode;
  counts: { bought: number; missing: number; total: number };
  totals: ReturnType<typeof listTotals>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [paid, setPaid] = useState(totals.bought ? String(Math.round(totals.bought * 100) / 100) : '');
  const pending = counts.total - counts.bought - counts.missing;
  return (
    <Sheet title="סיום קנייה" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          useApp.getState().finishList(chainId, mode, parseFloat(paid.replace(',', '.')) || undefined);
          navigate(`/c/${chainId}`);
        }}
      >
        <p className="muted">
          נקנו {counts.bought}
          {counts.missing > 0 && `, לא היו במלאי ${counts.missing}`}
          {pending > 0 && `, ${pending} לא סומנו`}. הרשימה תישמר בהיסטוריה ותתחיל רשימה חדשה.
        </p>
        {counts.missing > 0 && <p className="notice">{counts.missing} מוצרים שלא היו במלאי יעברו אוטומטית לרשימה הבאה.</p>}
        <label>
          כמה שילמת? (לא חובה, לסיכום ההוצאות)
          <input className="input ltr" inputMode="decimal" placeholder="₪" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </label>
        <button type="submit" className="btn primary block big">
          ✔ סיום ושמירה
        </button>
      </form>
    </Sheet>
  );
}

export function ShopRow({
  name,
  note,
  price,
  item,
  onToggle,
  onMissing,
  highlight,
}: {
  name: string;
  note?: string;
  price?: number;
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
          {price !== undefined && <span className="pick-path">{fmtMoney(price * item.qty)}</span>}
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

function BranchPicker({ chainId, mode, branchId }: { chainId: ChainId; mode: Mode; branchId: string | null }) {
  const branches = useApp((s) => s.branches);
  const mine = branches.filter((b) => b.chainId === chainId);
  if (!mine.length)
    return (
      <div className="branch-picker muted small">
        🏬 אין עדיין סניפים. <Link className="link" to={`/c/${chainId}/branches`}>הוספת סניף ומפה</Link>
      </div>
    );
  return (
    <label className="branch-picker">
      <span>🏬 אני בסניף</span>
      <select className="input" value={branchId ?? ''} onChange={(e) => useApp.getState().setListBranch(chainId, mode, e.target.value || null)}>
        <option value="">בחר סניף…</option>
        {mine.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.map ? '' : ' (בלי מפה)'}
          </option>
        ))}
      </select>
    </label>
  );
}

function RouteList({
  route,
  rowFor,
  query,
  items,
  onToggle,
  onMissing,
  navTo,
}: {
  route: Route;
  rowFor: (k: string) => { key: string; name: string; note?: string; product?: Product };
  query: string;
  items: Record<string, ListItem>;
  onToggle: (k: string) => void;
  onMissing: (k: string) => void;
  navTo: string;
}) {
  let heading: number | null = null;
  const nextIdx = route.stops.findIndex((s) => s.keys.some((k) => items[k]?.status === 'pending'));
  const match = (k: string) => !query || rowFor(k).name.includes(query);
  return (
    <>
      <div className="route-summary">
        <span>
          🧭 {route.stops.length} עצירות · כ-{Math.round(route.length * METERS_PER_CELL)} מ׳ הליכה
        </span>
        <Link className="btn primary small" to={navTo}>
          ניווט תלת־ממדי
        </Link>
      </div>
      <ol className="route-list">
        {route.stops.map((stop, i) => {
          const steps = describeLeg(stop.leg, stop.shelf, heading);
          heading = finalHeading(stop.leg);
          const keys = stop.keys.filter(match);
          if (!keys.length) return null;
          const done = stop.keys.every((k) => items[k]?.status !== 'pending');
          return (
            <li key={i} className={`route-stop ${done ? 'done' : ''} ${i === nextIdx ? 'next' : ''}`}>
              <div className="stop-head">
                <span className="stop-num">{i + 1}</span>
                <span className="stop-dir">{steps.map((s) => s.text).join(' · ')}</span>
              </div>
              {keys.map((k) => {
                const r = rowFor(k);
                return (
                  <ShopRow key={k} name={r.name} note={r.note} price={r.product?.price} item={items[k]} onToggle={() => onToggle(k)} onMissing={() => onMissing(k)} />
                );
              })}
            </li>
          );
        })}
      </ol>
      {route.unplaced.filter(match).length > 0 && (
        <section className="shop-section">
          <div className="shop-section-title">לא מופיע במפה של הסניף</div>
          {route.unplaced.filter(match).map((k) => {
            const r = rowFor(k);
            return <ShopRow key={k} name={r.name} note={r.note} price={r.product?.price} item={items[k]} onToggle={() => onToggle(k)} onMissing={() => onMissing(k)} />;
          })}
        </section>
      )}
    </>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useList } from '../store';
import { categoryPath, childCategories, NO_CATEGORY } from '../catalog';
import { catKey, descendantIds, visibleKeys } from '../listView';
import { CHAINS, CHAIN_IDS, MODES, type Category, type ChainId, type ListItem, type Mode, type Product } from '../types';
import { Empty, Header, Stepper, Tile } from '../ui/components';
import { promptDialog } from '../ui/dialog';
import { haptic, withUndo } from '../ui/toast';
import { BulkAddSheet, CategorySheet, ProductSheet } from '../ui/catalogSheets';
import VoiceAdd from '../ui/VoiceAdd';
import { fmtMoney, listTotals } from '../money';
import { categoryEmoji } from '../catColors';

interface Ctx {
  chainId: ChainId;
  mode: Mode;
  categories: Category[];
  products: Product[];
  items: Record<string, ListItem>;
  open: Set<string>;
  editMode: boolean;
  toggleOpen: (id: string) => void;
  onEditCategory: (c: Category) => void;
  onEditProduct: (p: Product) => void;
  onAddSub: (parentId: string) => void;
}

export default function SelectScreen({ chainId, mode }: { chainId: ChainId; mode: Mode }) {
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const list = useList(chainId, mode);
  const historyCount = useApp((s) => s.history.filter((h) => h.chainId === chainId && h.mode === mode).length);
  const { clearList, loadSampleCatalog, copyCatalog, addCategory, addToList } = useApp.getState();
  const [query, setQuery] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [bulkFor, setBulkFor] = useState<string | null | undefined>(undefined);

  const items = list?.items ?? {};
  const visibleList = useMemo(() => visibleKeys(items, categories, products), [items, categories, products]);
  const selectedCount = visibleList.length;
  const planned = useMemo(() => listTotals(visibleList, items, products).planned, [visibleList, items, products]);
  const tracked = products.filter((p) => p.chainId === chainId && p.target).length;
  const { fillFromInventory } = useApp.getState();
  const [fillMsg, setFillMsg] = useState('');
  const chainCats = useMemo(() => categories.filter((c) => c.chainId === chainId), [categories, chainId]);
  const chainProducts = useMemo(() => products.filter((p) => p.chainId === chainId), [products, chainId]);
  const topCats = childCategories(categories, chainId, null);
  const loose = chainProducts.filter((p) => !p.categoryId).sort((a, b) => a.order - b.order);
  const q = query.trim();
  const matches = q ? chainProducts.filter((p) => p.name.includes(q)) : [];
  const isEmpty = chainCats.length === 0 && chainProducts.length === 0;
  const otherChain = CHAIN_IDS.find((c) => c !== chainId)!;
  const period = MODES[mode].period;

  const toggleOpen = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      // Opening a category also puts it on this week's list.
      addToList(chainId, mode, catKey(id));
    }
    setOpen(next);
  };
  const newCategory = async (parentId: string | null) => {
    const name = await promptDialog({ title: parentId ? 'תת־קטגוריה חדשה' : 'קטגוריה חדשה', placeholder: 'לדוגמה: מוצרי חלב' });
    if (!name) return;
    const id = addCategory(chainId, name, parentId);
    if (parentId) setOpen((o) => new Set(o).add(parentId));
    return id;
  };

  const ctx: Ctx = {
    chainId,
    mode,
    categories,
    products: chainProducts,
    items,
    open,
    editMode,
    toggleOpen,
    onEditCategory: setEditCategory,
    onEditProduct: setEditProduct,
    onAddSub: (id) => void newCategory(id),
  };

  return (
    <div className={`page with-bottom-bar ${CHAINS[chainId].className}`}>
      <Header
        title={MODES[mode].name}
        subtitle={`${CHAINS[chainId].name} · בחר מה צריך ${period}`}
        back={`/c/${chainId}`}
        actions={
          !isEmpty && (
            <>
              <VoiceAdd chainId={chainId} mode={mode} />
              <button className={`chip ${editMode ? 'active' : ''}`} onClick={() => setEditMode(!editMode)}>
                {editMode ? '✓ סיום' : '✎ עריכה'}
              </button>
            </>
          )
        }
      />

      <div className="quick-tiles">
        <Tile
          to={`/c/${chainId}/${mode}/average`}
          className="tile-small tile-accent tile-row"
          icon="📊"
          title="כניסה לקנייה הממוצעת שלי"
          subtitle={historyCount ? `מבוסס על ${historyCount} קניות קודמות` : 'עדיין אין היסטוריה'}
        />
      </div>

      {isEmpty ? (
        <Empty icon="🧺" title="עדיין אין קטגוריות ומוצרים">
          <p className="muted">הוסף את הקטגוריות של החנות, ובתוך כל קטגוריה את המוצרים שיש בה. את זה עושים פעם אחת, ומשם בוחרים כל {period} מה צריך.</p>
          <div className="stack">
            <button className="btn primary" onClick={() => newCategory(null)}>
              + קטגוריה ראשונה
            </button>
            <button className="btn" onClick={() => loadSampleCatalog(chainId)}>
              טעינת רשימה לדוגמה
            </button>
            {products.some((p) => p.chainId === otherChain) && (
              <button className="btn" onClick={() => copyCatalog(otherChain, chainId)}>
                העתקה מ{CHAINS[otherChain].name}
              </button>
            )}
          </div>
        </Empty>
      ) : (
        <>
          <div className="search-row">
            <input className="input search" type="search" placeholder="🔍 חיפוש מוצר" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {tracked > 0 && (
            <button
              className="btn block inventory-btn"
              onClick={() => {
                const n = fillFromInventory(chainId, mode);
                setFillMsg(n ? `נוספו ${n} מוצרים שחסרים בבית` : 'לפי המלאי בבית לא חסר כלום');
              }}
            >
              🏠 הוספת מה שחסר בבית
            </button>
          )}
          {fillMsg && <p className="ok-msg center">{fillMsg}</p>}

          {editMode && (
            <div className="notice edit-notice">מצב עריכה: לחיצה על מוצר פותחת עריכה. ב-⋯ שליד קטגוריה אפשר לשנות שם, להזיז או למחוק.</div>
          )}

          {q ? (
            <div className="pick-grid">
              {matches.length === 0 && <p className="muted center pad">לא נמצאו מוצרים</p>}
              {matches.map((p) => (
                <PickRow key={p.id} ctx={ctx} product={p} showPath />
              ))}
            </div>
          ) : (
            <div className="cat-tree">
              {topCats.map((c) => (
                <CategoryNode key={c.id} ctx={ctx} cat={c} depth={0} />
              ))}
              {loose.length > 0 && (
                <section className="cat-card open">
                  <div className="cat-card-head static">
                    <span className="cat-card-name">{NO_CATEGORY}</span>
                  </div>
                  <div className="cat-card-body">
                    {loose.map((p) => (
                      <PickRow key={p.id} ctx={ctx} product={p} />
                    ))}
                  </div>
                </section>
              )}
              <button className="btn dashed block" onClick={() => newCategory(null)}>
                + קטגוריה חדשה
              </button>
            </div>
          )}

          {selectedCount > 0 && (
            <div className="center pad">
              <button
                className="btn ghost small"
                onClick={() => withUndo('הרשימה נוקתה', () => clearList(chainId, mode))}
              >
                ניקוי כל הסימונים
              </button>
            </div>
          )}
        </>
      )}

      <div className="bottom-bar">
        <Link to={`/c/${chainId}/${mode}/shop`} className={`btn primary block big ${selectedCount ? '' : 'disabled'}`}>
          כניסה לרשימת הקניות של {period}
          {selectedCount > 0 && <span className="count-pill">{selectedCount}</span>}
          {planned > 0 && <span className="count-pill">{fmtMoney(planned)}</span>}
        </Link>
      </div>

      {editCategory && (
        <CategorySheet
          category={editCategory}
          onClose={() => setEditCategory(null)}
          onAddSub={() => newCategory(editCategory.id)}
          onAddProducts={() => setBulkFor(editCategory.id)}
        />
      )}
      {editProduct && <ProductSheet product={editProduct} categories={categories} onClose={() => setEditProduct(null)} />}
      {bulkFor !== undefined && (
        <BulkAddSheet chainId={chainId} categoryId={bulkFor} categories={categories} onClose={() => setBulkFor(undefined)} />
      )}
    </div>
  );
}

function CategoryNode({ ctx, cat, depth }: { ctx: Ctx; cat: Category; depth: number }) {
  const { chainId, mode, categories, products, items, open } = ctx;
  const isOpen = open.has(cat.id);
  const key = catKey(cat.id);
  const inList = !!items[key];
  const inside = descendantIds(categories, cat.id);
  const pickedInside = products.filter((p) => items[p.id] && p.categoryId && inside.has(p.categoryId)).length;
  const subs = childCategories(categories, chainId, cat.id);
  const own = products.filter((p) => p.categoryId === cat.id).sort((a, b) => a.order - b.order);
  const total = products.filter((p) => p.categoryId && inside.has(p.categoryId)).length;

  return (
    <section className={`cat-card depth-${Math.min(depth, 2)} ${isOpen ? 'open' : ''} ${inList || pickedInside ? 'in-list' : ''}`}>
      <div className="cat-card-head">
        <button className="cat-card-main" onClick={() => ctx.toggleOpen(cat.id)}>
          <span className="chev">{isOpen ? '▾' : '◂'}</span>
          <span className="cat-card-name">
            {depth === 0 && <span className="cat-emoji">{categoryEmoji(cat.name)}</span>}
            {cat.name}
          </span>
          <span className="muted small">{pickedInside > 0 ? `${pickedInside} נבחרו` : `${total} מוצרים`}</span>
        </button>
        {inList && (
          <button
            className="in-list-pill"
            title="הסרת הקטגוריה מהרשימה"
            onClick={() => useApp.getState().toggleSelect(chainId, mode, key)}
          >
            ✓ ברשימה
          </button>
        )}
        <button className="icon-btn small" onClick={() => ctx.onEditCategory(cat)} aria-label="פעולות קטגוריה">
          ⋯
        </button>
      </div>
      {isOpen && (
        <div className="cat-card-body">
          {own.map((p) => (
            <PickRow key={p.id} ctx={ctx} product={p} />
          ))}
          {subs.map((c) => (
            <CategoryNode key={c.id} ctx={ctx} cat={c} depth={depth + 1} />
          ))}
          <InlineAdd chainId={chainId} categoryId={cat.id} />
          <button className="inline-add sub" onClick={() => ctx.onAddSub(cat.id)}>
            + תת־קטגוריה
          </button>
        </div>
      )}
    </section>
  );
}

function PickRow({ ctx, product, showPath }: { ctx: Ctx; product: Product; showPath?: boolean }) {
  const { chainId, mode, items, editMode } = ctx;
  const it = items[product.id];
  const { toggleSelect, setQty } = useApp.getState();
  const onClick = () => {
    if (editMode) return ctx.onEditProduct(product);
    haptic();
    toggleSelect(chainId, mode, product.id);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className={`pick ${it ? 'selected' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className="pick-check">{it ? '✓' : ''}</span>
      <span className="pick-name">
        {product.name}
        {showPath && <span className="pick-path">{categoryPath(ctx.categories, product.categoryId)}</span>}
        {(product.note || product.price !== undefined) && (
          <span className="pick-path">
            {[product.note && `📝 ${product.note}`, product.price !== undefined && fmtMoney(product.price)].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      {editMode ? (
        <span className="chev">✎</span>
      ) : (
        it && <Stepper value={it.qty} onChange={(v) => setQty(chainId, mode, product.id, v)} />
      )}
    </div>
  );
}

function InlineAdd({ chainId, categoryId }: { chainId: ChainId; categoryId: string | null }) {
  const [active, setActive] = useState(false);
  const [name, setName] = useState('');
  if (!active)
    return (
      <button className="inline-add" onClick={() => setActive(true)}>
        + הוספת מוצר לקטגוריה
      </button>
    );
  return (
    <form
      className="inline-add-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) useApp.getState().addProducts(chainId, [name], categoryId);
        setName('');
      }}
    >
      <input
        className="input"
        autoFocus
        value={name}
        placeholder="שם המוצר ואז Enter"
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setActive(false)}
      />
      <button className="btn primary" type="submit">
        הוספה
      </button>
    </form>
  );
}

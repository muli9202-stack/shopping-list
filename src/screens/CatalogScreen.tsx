import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildSections, categoryPath, type Section } from '../catalog';
import { CHAINS, CHAIN_IDS, type Category, type ChainId, type Product } from '../types';
import { Empty, Header } from '../ui/components';
import { Sheet, confirmDialog, promptDialog } from '../ui/dialog';

export default function CatalogScreen({ chainId }: { chainId: ChainId }) {
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const { addCategory, loadSampleCatalog, copyCatalog } = useApp.getState();
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [bulkFor, setBulkFor] = useState<string | null | undefined>(undefined);

  const sections = useMemo(() => buildSections(categories, products, chainId, undefined, true), [categories, products, chainId]);
  const otherChain = CHAIN_IDS.find((c) => c !== chainId)!;
  const otherHasProducts = products.some((p) => p.chainId === otherChain);
  const isEmpty = sections.length === 0;

  const newCategory = async (parentId: string | null) => {
    const name = await promptDialog({ title: parentId ? 'תת־קטגוריה חדשה' : 'קטגוריה חדשה', placeholder: 'לדוגמה: מוצרי חלב' });
    if (name) addCategory(chainId, name, parentId);
  };
  const copyFromOther = async () => {
    const ok = await confirmDialog({
      title: `העתקה מ${CHAINS[otherChain].name}`,
      message: 'כל הקטגוריות והמוצרים יועתקו למאגר הזה. מוצרים שכבר קיימים לא ישוכפלו.',
      confirmText: 'העתקה',
    });
    if (ok) copyCatalog(otherChain, chainId);
  };

  return (
    <div className={`page ${CHAINS[chainId].className}`}>
      <Header title="מאגר המוצרים" subtitle={CHAINS[chainId].name} back={`/c/${chainId}`} />

      {isEmpty ? (
        <Empty icon="📋" title="המאגר ריק">
          <p className="muted">הוסף את כל המוצרים שאתה קונה, או עשוי לקנות, מסודרים בקטגוריות.</p>
          <div className="stack">
            <button className="btn primary" onClick={() => newCategory(null)}>
              + קטגוריה ראשונה
            </button>
            <button className="btn" onClick={() => loadSampleCatalog(chainId)}>
              טעינת מאגר לדוגמה
            </button>
            {otherHasProducts && (
              <button className="btn" onClick={copyFromOther}>
                העתקת המאגר של {CHAINS[otherChain].name}
              </button>
            )}
          </div>
        </Empty>
      ) : (
        <>
          <div className="toolbar">
            <button className="btn primary" onClick={() => newCategory(null)}>
              + קטגוריה
            </button>
            <button className="btn" onClick={() => setBulkFor(null)}>
              + מוצרים
            </button>
            {otherHasProducts && (
              <button className="btn ghost" onClick={copyFromOther}>
                העתקה מ{CHAINS[otherChain].name}
              </button>
            )}
          </div>
          {sections.map((sec) => (
            <CatalogSection
              key={sec.category?.id ?? 'none'}
              section={sec}
              chainId={chainId}
              onEditCategory={setEditCategory}
              onEditProduct={setEditProduct}
            />
          ))}
        </>
      )}

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

function CatalogSection({
  section,
  chainId,
  onEditCategory,
  onEditProduct,
}: {
  section: Section;
  chainId: ChainId;
  onEditCategory: (c: Category) => void;
  onEditProduct: (p: Product) => void;
}) {
  const { category, depth, products } = section;
  return (
    <section className={`cat-section depth-${Math.min(depth, 3)}`}>
      <div className="cat-head">
        <span className="cat-name">{category ? category.name : section.path}</span>
        <span className="cat-count">{products.length}</span>
        {category && (
          <button className="icon-btn small" onClick={() => onEditCategory(category)} aria-label="פעולות קטגוריה">
            ⋯
          </button>
        )}
      </div>
      <div className="catalog-items">
        {products.map((p) => (
          <button key={p.id} className="catalog-item" onClick={() => onEditProduct(p)}>
            <span>{p.name}</span>
            <span className="chev">✎</span>
          </button>
        ))}
        <InlineAdd chainId={chainId} categoryId={category?.id ?? null} />
      </div>
    </section>
  );
}

function InlineAdd({ chainId, categoryId }: { chainId: ChainId; categoryId: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (!open)
    return (
      <button className="inline-add" onClick={() => setOpen(true)}>
        + הוספת מוצר
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
        onBlur={() => !name.trim() && setOpen(false)}
      />
      <button className="btn primary" type="submit">
        הוספה
      </button>
    </form>
  );
}

function CategoryOptions({ categories, chainId }: { categories: Category[]; chainId: ChainId }) {
  const options = buildSections(categories, [], chainId, undefined, true).filter((s) => s.category);
  return (
    <>
      <option value="">ללא קטגוריה</option>
      {options.map((s) => (
        <option key={s.category!.id} value={s.category!.id}>
          {s.path}
        </option>
      ))}
    </>
  );
}

function CategorySheet({
  category,
  onClose,
  onAddSub,
  onAddProducts,
}: {
  category: Category;
  onClose: () => void;
  onAddSub: () => void;
  onAddProducts: () => void;
}) {
  const { renameCategory, moveCategory, deleteCategory } = useApp.getState();
  const categories = useApp((s) => s.categories);
  const path = categoryPath(categories, category.id);
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet title={path} onClose={onClose}>
      <div className="menu">
        <button onClick={run(onAddProducts)}>➕ הוספת מוצרים לקטגוריה</button>
        <button onClick={run(onAddSub)}>📁 הוספת תת־קטגוריה</button>
        <button
          onClick={run(async () => {
            const name = await promptDialog({ title: 'שינוי שם', initial: category.name });
            if (name) renameCategory(category.id, name);
          })}
        >
          ✎ שינוי שם
        </button>
        <button onClick={() => moveCategory(category.id, -1)}>⬆️ הזזה למעלה</button>
        <button onClick={() => moveCategory(category.id, 1)}>⬇️ הזזה למטה</button>
        <button
          className="danger-text"
          onClick={run(async () => {
            const ok = await confirmDialog({
              title: `מחיקת "${category.name}"`,
              message: 'תתי־הקטגוריות יימחקו, והמוצרים שבהן יועברו ל"ללא קטגוריה".',
              confirmText: 'מחיקה',
              danger: true,
            });
            if (ok) deleteCategory(category.id);
          })}
        >
          🗑️ מחיקת קטגוריה
        </button>
      </div>
    </Sheet>
  );
}

function ProductSheet({ product, categories, onClose }: { product: Product; categories: Category[]; onClose: () => void }) {
  const { updateProduct, moveProduct, deleteProduct } = useApp.getState();
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? '');
  return (
    <Sheet title="עריכת מוצר" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          updateProduct(product.id, { name: name.trim(), categoryId: categoryId || null });
          onClose();
        }}
      >
        <label>
          שם המוצר
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          קטגוריה
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <CategoryOptions categories={categories} chainId={product.chainId} />
          </select>
        </label>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => moveProduct(product.id, -1)}>
            ⬆️ למעלה
          </button>
          <button type="button" className="btn ghost" onClick={() => moveProduct(product.id, 1)}>
            ⬇️ למטה
          </button>
        </div>
        <button type="submit" className="btn primary block">
          שמירה
        </button>
        <button
          type="button"
          className="btn danger block"
          onClick={async () => {
            const ok = await confirmDialog({ title: `מחיקת "${product.name}"`, message: 'המוצר יוסר מהמאגר ומהרשימות הפעילות.', confirmText: 'מחיקה', danger: true });
            if (ok) {
              deleteProduct(product.id);
              onClose();
            }
          }}
        >
          מחיקת מוצר
        </button>
      </form>
    </Sheet>
  );
}

function BulkAddSheet({
  chainId,
  categoryId,
  categories,
  onClose,
}: {
  chainId: ChainId;
  categoryId: string | null;
  categories: Category[];
  onClose: () => void;
}) {
  const [cat, setCat] = useState(categoryId ?? '');
  const [text, setText] = useState('');
  const names = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <Sheet title="הוספת מוצרים" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!names.length) return;
          useApp.getState().addProducts(chainId, names, cat || null);
          onClose();
        }}
      >
        <label>
          קטגוריה
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <CategoryOptions categories={categories} chainId={chainId} />
          </select>
        </label>
        <label>
          מוצרים (כל שורה היא מוצר)
          <textarea className="input" rows={7} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={'חלב 3%\nקוטג׳\nגבינה צהובה'} />
        </label>
        <button type="submit" className="btn primary block" disabled={!names.length}>
          הוספת {names.length || ''} מוצרים
        </button>
      </form>
    </Sheet>
  );
}

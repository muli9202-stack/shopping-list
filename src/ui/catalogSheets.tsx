import { useState } from 'react';
import { useApp } from '../store';
import { buildSections, categoryPath } from '../catalog';
import type { Category, ChainId, Product } from '../types';
import { Sheet, confirmDialog, promptDialog } from './dialog';

// Bottom sheets for editing the catalog (categories and products) in place.

export function CategoryOptions({ categories, chainId }: { categories: Category[]; chainId: ChainId }) {
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

export function CategorySheet({
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

export function ProductSheet({ product, categories, onClose }: { product: Product; categories: Category[]; onClose: () => void }) {
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

export function BulkAddSheet({
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

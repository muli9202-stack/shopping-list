import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import {
  type ActiveList,
  type Branch,
  type AppData,
  type Category,
  type ChainId,
  type HistoryEntry,
  type HistoryItem,
  type ItemStatus,
  type Mode,
  type Product,
  type Settings,
  listKey,
} from './types';
import { SAMPLE_CATALOG } from './sampleCatalog';
import { categoryPath } from './catalog';
import type { AiInsight } from './ai';
import { catIdOf, catKey, isCatKey, visibleKeys } from './listView';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: (name, value) => idbSet(name, value),
  removeItem: (name) => idbDel(name),
};

export const emptyData = (): AppData => ({
  version: 1,
  categories: [],
  products: [],
  lists: {},
  history: [],
  branches: [],
  settings: { apiKey: '', model: 'claude-opus-5', autoExcel: false },
  aiInsights: {},
  stock: {},
  budgets: {},
});

const emptyList = (): ActiveList => ({ items: {}, branchId: null, startedAt: Date.now() });

const nextOrder = (arr: { order: number }[]) => arr.reduce((m, x) => Math.max(m, x.order), -1) + 1;

/** Swaps `id` with its neighbour among `siblings` (already sorted by order). */
function swapOrder<T extends { id: string; order: number }>(all: T[], siblings: T[], id: string, dir: -1 | 1): T[] {
  const i = siblings.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= siblings.length) return all;
  const a = siblings[i];
  const b = siblings[j];
  return all.map((x) => (x.id === a.id ? { ...x, order: b.order } : x.id === b.id ? { ...x, order: a.order } : x));
}

interface Actions {
  addCategory: (chainId: ChainId, name: string, parentId: string | null) => string;
  renameCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  moveCategory: (id: string, dir: -1 | 1) => void;

  addProducts: (chainId: ChainId, names: string[], categoryId: string | null) => void;
  updateProduct: (id: string, patch: Partial<Pick<Product, 'name' | 'categoryId' | 'price' | 'barcode' | 'target' | 'note'>>) => void;
  deleteProduct: (id: string) => void;
  moveProduct: (id: string, dir: -1 | 1) => void;

  loadSampleCatalog: (chainId: ChainId) => void;
  copyCatalog: (from: ChainId, to: ChainId) => void;

  toggleSelect: (chainId: ChainId, mode: Mode, productId: string) => void;
  setQty: (chainId: ChainId, mode: Mode, productId: string, qty: number) => void;
  toggleStatus: (chainId: ChainId, mode: Mode, productId: string, status: Exclude<ItemStatus, 'pending'>) => void;
  /** Sets an item's status, adding it to the list first if needed. */
  setStatus: (chainId: ChainId, mode: Mode, key: string, status: ItemStatus) => void;
  setListBranch: (chainId: ChainId, mode: Mode, branchId: string | null) => void;
  addBranch: (chainId: ChainId, name: string, address?: string) => string;
  updateBranch: (id: string, patch: Partial<Omit<Branch, 'id' | 'chainId'>>) => void;
  deleteBranch: (id: string) => void;
  clearList: (chainId: ChainId, mode: Mode) => void;
  /**
   * Saves the list to history and starts a new one. Items that were out of
   * stock carry over to the new list; bought products are added to the home inventory.
   */
  finishList: (chainId: ChainId, mode: Mode, paid?: number) => void;
  deleteHistory: (id: string) => void;
  /** Adds products to the active list, keeping items already there. */
  mergeIntoList: (chainId: ChainId, mode: Mode, items: { productId: string; qty: number }[]) => void;
  /** Replaces the active list with the given items (used to repeat a past list). */
  replaceList: (chainId: ChainId, mode: Mode, items: { productId: string; qty: number }[]) => void;
  /** Adds a product or `cat:` key to the list if it isn't there yet. */
  addToList: (chainId: ChainId, mode: Mode, key: string) => void;
  setAiInsight: (chainId: ChainId, mode: Mode, insight: AiInsight) => void;

  setStock: (productId: string, count: number) => void;
  /** Adds every product whose home stock is below its target; returns how many were added. */
  fillFromInventory: (chainId: ChainId, mode: Mode) => number;
  setBudget: (mode: Mode, amount: number | undefined) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  importData: (data: AppData) => void;
  resetAll: () => void;
}

export type Store = AppData & Actions;

export const useApp = create<Store>()(
  persist(
    (set, get) => {
      const updateList = (chainId: ChainId, mode: Mode, fn: (l: ActiveList) => ActiveList) =>
        set((s) => {
          const key = listKey(chainId, mode);
          const cur = s.lists[key] ?? emptyList();
          return { lists: { ...s.lists, [key]: fn({ ...cur, items: { ...cur.items } }) } };
        });

      return {
        ...emptyData(),

        addCategory: (chainId, name, parentId) => {
          const id = uid();
          set((s) => {
            const siblings = s.categories.filter((c) => c.chainId === chainId && c.parentId === parentId);
            const cat: Category = { id, chainId, name, parentId, order: nextOrder(siblings) };
            return { categories: [...s.categories, cat] };
          });
          return id;
        },
        renameCategory: (id, name) =>
          set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)) })),
        deleteCategory: (id) =>
          set((s) => {
            // Remove the category and all its descendants; their products move to "no category".
            const doomed = new Set([id]);
            let grew = true;
            while (grew) {
              grew = false;
              for (const c of s.categories) {
                if (c.parentId && doomed.has(c.parentId) && !doomed.has(c.id)) {
                  doomed.add(c.id);
                  grew = true;
                }
              }
            }
            const lists: Record<string, ActiveList> = {};
            for (const [k, l] of Object.entries(s.lists)) {
              const items = { ...l.items };
              for (const id of doomed) delete items[catKey(id)];
              lists[k] = { ...l, items };
            }
            return {
              lists,
              categories: s.categories.filter((c) => !doomed.has(c.id)),
              products: s.products.map((p) => (p.categoryId && doomed.has(p.categoryId) ? { ...p, categoryId: null } : p)),
            };
          }),
        moveCategory: (id, dir) =>
          set((s) => {
            const cat = s.categories.find((c) => c.id === id);
            if (!cat) return {};
            const siblings = s.categories
              .filter((c) => c.chainId === cat.chainId && c.parentId === cat.parentId)
              .sort((a, b) => a.order - b.order);
            return { categories: swapOrder(s.categories, siblings, id, dir) };
          }),

        addProducts: (chainId, names, categoryId) =>
          set((s) => {
            const siblings = s.products.filter((p) => p.chainId === chainId && p.categoryId === categoryId);
            let order = nextOrder(siblings);
            const added: Product[] = names
              .map((n) => n.trim())
              .filter(Boolean)
              .map((name) => ({ id: uid(), chainId, name, categoryId, order: order++ }));
            return { products: [...s.products, ...added] };
          }),
        updateProduct: (id, patch) =>
          set((s) => ({
            products: s.products.map((p) => {
              if (p.id !== id) return p;
              const next = { ...p, ...patch };
              if (patch.categoryId !== undefined && patch.categoryId !== p.categoryId) {
                next.order = nextOrder(s.products.filter((x) => x.chainId === p.chainId && x.categoryId === patch.categoryId));
              }
              return next;
            }),
          })),
        deleteProduct: (id) =>
          set((s) => {
            const lists: Record<string, ActiveList> = {};
            for (const [k, l] of Object.entries(s.lists)) {
              const items = { ...l.items };
              delete items[id];
              lists[k] = { ...l, items };
            }
            const stock = { ...s.stock };
            delete stock[id];
            return { products: s.products.filter((p) => p.id !== id), lists, stock };
          }),
        moveProduct: (id, dir) =>
          set((s) => {
            const prod = s.products.find((p) => p.id === id);
            if (!prod) return {};
            const siblings = s.products
              .filter((p) => p.chainId === prod.chainId && p.categoryId === prod.categoryId)
              .sort((a, b) => a.order - b.order);
            return { products: swapOrder(s.products, siblings, id, dir) };
          }),

        loadSampleCatalog: (chainId) => {
          const { addCategory, addProducts } = get();
          for (const [catName, node] of Object.entries(SAMPLE_CATALOG)) {
            const catId = addCategory(chainId, catName, null);
            if (Array.isArray(node)) {
              addProducts(chainId, node, catId);
            } else {
              for (const [subName, items] of Object.entries(node)) {
                addProducts(chainId, items, addCategory(chainId, subName, catId));
              }
            }
          }
        },
        copyCatalog: (from, to) => {
          // Merge by name: categories/products that already exist in the target (same path) are skipped.
          const s = get();
          const idMap = new Map<string, string>();
          const copyLevel = (srcParent: string | null, dstParent: string | null) => {
            const srcCats = s.categories
              .filter((c) => c.chainId === from && c.parentId === srcParent)
              .sort((a, b) => a.order - b.order);
            for (const c of srcCats) {
              const existing = get().categories.find((x) => x.chainId === to && x.parentId === dstParent && x.name === c.name);
              const dstId = existing?.id ?? get().addCategory(to, c.name, dstParent);
              idMap.set(c.id, dstId);
              copyLevel(c.id, dstId);
            }
          };
          copyLevel(null, null);
          const srcProducts = s.products.filter((p) => p.chainId === from).sort((a, b) => a.order - b.order);
          for (const p of srcProducts) {
            const dstCat = p.categoryId ? idMap.get(p.categoryId) ?? null : null;
            const exists = get().products.some((x) => x.chainId === to && x.categoryId === dstCat && x.name === p.name);
            if (!exists) get().addProducts(to, [p.name], dstCat);
          }
        },

        toggleSelect: (chainId, mode, productId) =>
          updateList(chainId, mode, (l) => {
            if (l.items[productId]) delete l.items[productId];
            else l.items[productId] = { qty: 1, status: 'pending' };
            return l;
          }),
        setQty: (chainId, mode, productId, qty) =>
          updateList(chainId, mode, (l) => {
            const cur = l.items[productId];
            if (qty <= 0) delete l.items[productId];
            else l.items[productId] = { status: cur?.status ?? 'pending', qty };
            return l;
          }),
        toggleStatus: (chainId, mode, productId, status) =>
          updateList(chainId, mode, (l) => {
            const cur = l.items[productId];
            if (cur) l.items[productId] = { ...cur, status: cur.status === status ? 'pending' : status };
            return l;
          }),
        setStatus: (chainId, mode, key, status) =>
          updateList(chainId, mode, (l) => {
            l.items[key] = { qty: l.items[key]?.qty ?? 1, status };
            return l;
          }),
        setListBranch: (chainId, mode, branchId) => updateList(chainId, mode, (l) => ({ ...l, branchId })),
        addBranch: (chainId, name, address = '') => {
          const id = uid();
          set((s) => ({ branches: [...s.branches, { id, chainId, name, address }] }));
          return id;
        },
        updateBranch: (id, patch) => set((s) => ({ branches: s.branches.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
        deleteBranch: (id) =>
          set((s) => ({
            branches: s.branches.filter((b) => b.id !== id),
            lists: Object.fromEntries(Object.entries(s.lists).map(([k, l]) => [k, l.branchId === id ? { ...l, branchId: null } : l])),
          })),
        clearList: (chainId, mode) => updateList(chainId, mode, () => emptyList()),
        finishList: (chainId, mode, paid) => {
          const s = get();
          const list = s.lists[listKey(chainId, mode)];
          if (!list) return;
          const byId = new Map(s.products.map((p) => [p.id, p]));
          const items: HistoryItem[] = visibleKeys(list.items, s.categories, s.products).flatMap((key): HistoryItem[] => {
            const it = list.items[key];
            if (isCatKey(key)) {
              const cat = s.categories.find((c) => c.id === catIdOf(key));
              if (!cat) return [];
              return [{ productId: key, name: cat.name, categoryPath: categoryPath(s.categories, cat.id), qty: it.qty, status: it.status }];
            }
            const p = byId.get(key)!;
            return [{ productId: key, name: p.name, categoryPath: categoryPath(s.categories, p.categoryId), qty: it.qty, status: it.status, price: p.price }];
          });
          const estimated = items.reduce((sum, it) => sum + (it.status === 'bought' && it.price ? it.price * it.qty : 0), 0);
          const entry: HistoryEntry = {
            id: uid(),
            chainId,
            mode,
            date: Date.now(),
            branchId: list.branchId,
            items,
            estimated: Math.round(estimated * 100) / 100,
            paid: paid && paid > 0 ? paid : undefined,
          };
          const carried: ActiveList = { ...emptyList(), branchId: list.branchId };
          for (const it of items) if (it.status === 'missing') carried.items[it.productId] = { qty: it.qty, status: 'pending' };
          const stock = { ...s.stock };
          for (const it of items) if (it.status === 'bought' && !isCatKey(it.productId)) stock[it.productId] = (stock[it.productId] ?? 0) + it.qty;
          set((st) => ({
            history: [entry, ...st.history],
            lists: { ...st.lists, [listKey(chainId, mode)]: carried },
            stock,
          }));
        },
        deleteHistory: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),
        mergeIntoList: (chainId, mode, items) => {
          const known = new Set([...get().products.map((p) => p.id), ...get().categories.map((c) => catKey(c.id))]);
          updateList(chainId, mode, (l) => {
            for (const { productId, qty } of items) {
              if (known.has(productId) && !l.items[productId]) l.items[productId] = { qty: Math.max(1, Math.round(qty)), status: 'pending' };
            }
            return l;
          });
        },
        replaceList: (chainId, mode, items) => {
          updateList(chainId, mode, (l) => ({ ...emptyList(), branchId: l.branchId }));
          get().mergeIntoList(chainId, mode, items);
        },
        addToList: (chainId, mode, key) =>
          updateList(chainId, mode, (l) => {
            if (!l.items[key]) l.items[key] = { qty: 1, status: 'pending' };
            return l;
          }),
        setAiInsight: (chainId, mode, insight) =>
          set((s) => ({ aiInsights: { ...s.aiInsights, [listKey(chainId, mode)]: insight } })),

        setStock: (productId, count) =>
          set((s) => {
            const stock = { ...s.stock };
            if (count <= 0) delete stock[productId];
            else stock[productId] = count;
            return { stock };
          }),
        fillFromInventory: (chainId, mode) => {
          const s = get();
          const need = s.products
            .filter((p) => p.chainId === chainId && p.target && (s.stock[p.id] ?? 0) < p.target)
            .map((p) => ({ productId: p.id, qty: p.target! - (s.stock[p.id] ?? 0) }));
          const before = Object.keys(s.lists[listKey(chainId, mode)]?.items ?? {}).length;
          get().mergeIntoList(chainId, mode, need);
          return Object.keys(get().lists[listKey(chainId, mode)]?.items ?? {}).length - before;
        },
        setBudget: (mode, amount) =>
          set((s) => {
            const budgets = { ...s.budgets };
            if (amount && amount > 0) budgets[mode] = amount;
            else delete budgets[mode];
            return { budgets };
          }),
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        importData: (data) => set({ ...emptyData(), ...data, aiInsights: data.aiInsights ?? {}, stock: data.stock ?? {}, budgets: data.budgets ?? {}, settings: { ...emptyData().settings, ...data.settings } }),
        resetAll: () => set(emptyData()),
      };
    },
    {
      name: 'shopping-list-data',
      version: 3,
      migrate: (persisted, version) => {
        const data = persisted as AppData;
        if (version < 3) {
          data.stock = {};
          data.budgets = {};
        }
        if (version < 2) {
          data.aiInsights = {};
          // v1 stored a default model the user never picked; move it to the current default.
          if (data.settings?.model === 'claude-sonnet-5') data.settings.model = 'claude-opus-5';
        }
        return data as Store;
      },
      storage: createJSONStorage(() => idbStorage),
      partialize: (s): AppData => ({
        version: 1,
        categories: s.categories,
        products: s.products,
        lists: s.lists,
        history: s.history,
        branches: s.branches,
        settings: s.settings,
        aiInsights: s.aiInsights,
        stock: s.stock,
        budgets: s.budgets,
      }),
    },
  ),
);

export function exportData(): AppData {
  const s = useApp.getState();
  return {
    version: 1,
    categories: s.categories,
    products: s.products,
    lists: s.lists,
    history: s.history,
    branches: s.branches,
    settings: { ...s.settings, apiKey: '' },
    aiInsights: s.aiInsights,
    stock: s.stock,
    budgets: s.budgets,
  };
}

export function useList(chainId: ChainId, mode: Mode): ActiveList | undefined {
  return useApp((s) => s.lists[listKey(chainId, mode)]);
}

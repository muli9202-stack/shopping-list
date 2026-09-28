export type ChainId = 'neto' | 'yesh';
export type Mode = 'weekly' | 'monthly';

export const CHAIN_IDS: ChainId[] = ['neto', 'yesh'];
export const MODE_IDS: Mode[] = ['weekly', 'monthly'];

export const CHAINS: Record<ChainId, { name: string; className: string }> = {
  neto: { name: 'נטו חיסכון', className: 'chain-neto' },
  yesh: { name: 'יש חסד', className: 'chain-yesh' },
};

export const MODES: Record<Mode, { name: string; period: string; emoji: string }> = {
  weekly: { name: 'קנייה שבועית', period: 'השבוע', emoji: '🗓️' },
  monthly: { name: 'קנייה חודשית', period: 'החודש', emoji: '📦' },
};

export interface Category {
  id: string;
  chainId: ChainId;
  name: string;
  parentId: string | null;
  order: number;
}

export interface Product {
  id: string;
  chainId: ChainId;
  name: string;
  categoryId: string | null;
  order: number;
}

export type ItemStatus = 'pending' | 'bought' | 'missing';

export interface ListItem {
  qty: number;
  status: ItemStatus;
}

export interface ActiveList {
  items: Record<string, ListItem>;
  branchId: string | null;
  startedAt: number;
}

export interface HistoryItem {
  productId: string;
  name: string;
  categoryPath: string;
  qty: number;
  status: ItemStatus;
}

export interface HistoryEntry {
  id: string;
  chainId: ChainId;
  mode: Mode;
  date: number;
  branchId: string | null;
  items: HistoryItem[];
}

export interface Branch {
  id: string;
  chainId: ChainId;
  name: string;
  address: string;
}

export interface Settings {
  apiKey: string;
  model: string;
}

export interface AppData {
  version: 1;
  categories: Category[];
  products: Product[];
  lists: Record<string, ActiveList>;
  history: HistoryEntry[];
  branches: Branch[];
  settings: Settings;
}

export const listKey = (chainId: ChainId, mode: Mode) => `${chainId}:${mode}`;

export const isChainId = (v: string | undefined): v is ChainId => v === 'neto' || v === 'yesh';
export const isMode = (v: string | undefined): v is Mode => v === 'weekly' || v === 'monthly';

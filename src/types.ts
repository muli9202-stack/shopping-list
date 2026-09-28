import type { AiInsight } from './ai';

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
  /** Price per unit in shekels at this chain. */
  price?: number;
  barcode?: string;
  /** How many to keep at home (home inventory). */
  target?: number;
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
  price?: number;
}

export interface HistoryEntry {
  id: string;
  chainId: ChainId;
  mode: Mode;
  date: number;
  branchId: string | null;
  items: HistoryItem[];
  /** Sum of bought items by the catalog prices at the time. */
  estimated?: number;
  /** What was actually paid, if entered at checkout. */
  paid?: number;
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
  /** Download an Excel backup every hour while the app is open. */
  autoExcel: boolean;
  reminder?: Reminder;
  sync?: SyncSettings;
}

export interface Reminder {
  /** 0 = Sunday. */
  weekday: number;
  /** "HH:MM". */
  time: string;
  /** Day of month for the monthly reminder. */
  monthDay: number;
}

export interface SyncSettings {
  /** Firebase web-app config, as pasted from the Firebase console. */
  firebaseConfig: string;
  /** Shared family code; everyone with it sees the same lists. */
  familyCode: string;
  enabled: boolean;
}

export interface AppData {
  version: 1;
  categories: Category[];
  products: Product[];
  lists: Record<string, ActiveList>;
  history: HistoryEntry[];
  branches: Branch[];
  settings: Settings;
  /** Last AI analysis per list key (chain:mode). */
  aiInsights: Record<string, AiInsight>;
  /** Home inventory: how many of each product are at home. */
  stock: Record<string, number>;
  budgets: Partial<Record<Mode, number>>;
}

export const listKey = (chainId: ChainId, mode: Mode) => `${chainId}:${mode}`;

export const isChainId = (v: string | undefined): v is ChainId => v === 'neto' || v === 'yesh';
export const isMode = (v: string | undefined): v is Mode => v === 'weekly' || v === 'monthly';

export const AI_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (מומלץ)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (זול יותר)' },
];

export type ItemLink = { kind: 'video' | 'recipe'; id: string };

/** A single task inside a course, e.g. "טורטיות" × "20 יחידות". */
export interface PlanItem {
  id: string;
  name: string;
  qty: string;
  done: boolean;
  link?: ItemLink;
}

export interface Course {
  id: string;
  name: string;
  items: PlanItem[];
}

export interface Meal {
  id: string;
  name: string;
  courses: Course[];
}

export interface ShabbatPlan {
  adults: string;
  kids: string;
  night: Meal;
  /** "סעודה שנייה" and "סעודה שלישית". */
  morning: Meal[];
}

export interface ChagDay {
  id: string;
  name: string;
  meals: Meal[];
}

export interface ChagPlan {
  name: string;
  days: ChagDay[];
}

export type Platform = 'youtube' | 'tiktok' | 'other';

export interface Chef {
  id: string;
  name: string;
  url: string;
  platform: Platform;
  note?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Video {
  id: string;
  chefId: string;
  categoryId: string;
  youtubeId: string;
  url: string;
  title: string;
  rating: number;
  createdAt: number;
}

export interface Recipe {
  id: string;
  chefId: string;
  categoryId: string;
  youtubeId: string;
  url: string;
  title: string;
  /** Verbatim lines from the video description. Lines ending in ":" are sub-headings. */
  ingredients: string[];
  steps: string[];
  /** The description had no complete recipe — nothing is invented to fill the gap. */
  missing: boolean;
  description: string;
  rating: number;
  createdAt: number;
}

export type CollectionKey = 'shabbat' | 'chag';

export interface CollectionEntry {
  kind: 'video' | 'recipe';
  id: string;
  note: string;
  addedAt: number;
}

export interface KitchenData {
  version: 1;
  shabbat: ShabbatPlan;
  chag: ChagPlan;
  chefs: Chef[];
  categories: Category[];
  videos: Video[];
  recipes: Recipe[];
  collections: Record<CollectionKey, CollectionEntry[]>;
  settings: { ytApiKey: string };
}

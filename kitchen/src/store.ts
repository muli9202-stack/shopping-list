import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setLateCloudHandler, storage } from './storage';
import type {
  Category,
  ChagDay,
  ChagPlan,
  Chef,
  CollectionKey,
  Course,
  KitchenData,
  Meal,
  PlanItem,
  Recipe,
  SeedEdit,
  ShabbatPlan,
  Video,
} from './types';
import { SEED_CATEGORIES, SEED_CHEFS, SEED_CHEFS_HE } from './seed';
import { isSeedVideo, seedVideos } from './seedVideos';
import { isSeedRecipe, seedRecipes } from './seedRecipes';
import { useSeeds } from './seedData';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ORDINAL_F = ['ראשונה', 'שנייה', 'שלישית', 'רביעית', 'חמישית', 'שישית', 'שביעית', 'שמינית', 'תשיעית', 'עשירית'];
const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳'];

export const courseName = (i: number) => (i < ORDINAL_F.length ? `מנה ${ORDINAL_F[i]}` : `מנה ${i + 1}`);
export const mealName = (i: number) => (i < ORDINAL_F.length ? `סעודה ${ORDINAL_F[i]}` : `סעודה ${i + 1}`);
const dayName = (i: number) => (i < DAY_LETTERS.length ? `יום ${DAY_LETTERS[i]}` : `יום ${i + 1}`);

const newMeal = (name: string): Meal => ({ id: uid(), name, courses: [] });

export const emptyShabbat = (): ShabbatPlan => ({
  adults: '',
  kids: '',
  night: newMeal('סעודה ראשונה'),
  morning: [newMeal('סעודה שנייה'), newMeal('סעודה שלישית')],
});

export const emptyChag = (): ChagPlan => ({ name: 'חג', days: [] });

/** Adds the Israeli channels after the Israeli/kosher ones already in the list (before the foreign chefs). */
function withHebrewChefs(chefs: Chef[]): Chef[] {
  const have = new Set(chefs.map((c) => c.id));
  const add = SEED_CHEFS_HE.filter((c) => !have.has(c.id));
  const at = chefs.findIndex((c) => c.id === 'busy-in-brooklyn');
  return at < 0 ? [...chefs, ...add] : [...chefs.slice(0, at + 1), ...add, ...chefs.slice(at + 1)];
}

export const emptyData = (): KitchenData => ({
  version: 2,
  shabbat: emptyShabbat(),
  chag: emptyChag(),
  chefs: withHebrewChefs(SEED_CHEFS),
  categories: SEED_CATEGORIES,
  videos: [],
  seedEdits: {},
  recipes: [],
  collections: { shabbat: [], chag: [] },
  settings: { ytApiKey: '' },
});

/** Every meal in both plans, so meal-level actions can address a meal by id alone. */
export function allMeals(d: Pick<KitchenData, 'shabbat' | 'chag'>): Meal[] {
  return [d.shabbat.night, ...d.shabbat.morning, ...d.chag.days.flatMap((x) => x.meals)];
}

type Draft = Pick<KitchenData, 'shabbat' | 'chag'>;

/** Applies `fn` to the meal with `mealId`, wherever it lives. */
function mapMeal(d: Draft, mealId: string, fn: (m: Meal) => Meal): Draft {
  const m = (x: Meal) => (x.id === mealId ? fn(x) : x);
  return {
    shabbat: { ...d.shabbat, night: m(d.shabbat.night), morning: d.shabbat.morning.map(m) },
    chag: { ...d.chag, days: d.chag.days.map((day) => ({ ...day, meals: day.meals.map(m) })) },
  };
}

const mapCourse = (d: Draft, mealId: string, courseId: string, fn: (c: Course) => Course) =>
  mapMeal(d, mealId, (meal) => ({ ...meal, courses: meal.courses.map((c) => (c.id === courseId ? fn(c) : c)) }));

const resetMeal = (m: Meal): Meal => ({
  ...m,
  courses: m.courses.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, done: false })) })),
});

const mapDay = (chag: ChagPlan, dayId: string, fn: (d: ChagDay) => ChagDay): ChagPlan => ({
  ...chag,
  days: chag.days.map((d) => (d.id === dayId ? fn(d) : d)),
});

interface Actions {
  setShabbatField: (field: 'adults' | 'kids', value: string) => void;
  setChagName: (name: string) => void;
  resetShabbatMarks: () => void;
  resetChagMarks: () => void;
  clearShabbat: () => void;
  clearChag: () => void;

  addDay: () => void;
  renameDay: (dayId: string, name: string) => void;
  deleteDay: (dayId: string) => void;
  addMeal: (dayId: string) => void;
  deleteMeal: (dayId: string, mealId: string) => void;
  renameMeal: (mealId: string, name: string) => void;

  addCourse: (mealId: string) => void;
  renameCourse: (mealId: string, courseId: string, name: string) => void;
  deleteCourse: (mealId: string, courseId: string) => void;
  addItem: (mealId: string, courseId: string, name: string, qty: string) => void;
  updateItem: (mealId: string, courseId: string, itemId: string, patch: Partial<Omit<PlanItem, 'id'>>) => void;
  deleteItem: (mealId: string, courseId: string, itemId: string) => void;
  toggleItem: (mealId: string, courseId: string, itemId: string) => void;

  addChef: (name: string, url: string) => string;
  updateChef: (id: string, patch: Partial<Omit<Chef, 'id'>>) => void;
  deleteChef: (id: string) => void;
  addCategory: (name: string, icon: string) => string;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;

  addVideo: (v: Omit<Video, 'id' | 'createdAt' | 'rating'>) => string;
  updateVideo: (id: string, patch: Partial<Omit<Video, 'id'>>) => void;
  deleteVideo: (id: string) => void;
  addRecipe: (r: Omit<Recipe, 'id' | 'createdAt' | 'rating'>) => string;
  updateRecipe: (id: string, patch: Partial<Omit<Recipe, 'id'>>) => void;
  deleteRecipe: (id: string) => void;

  toggleCollection: (key: CollectionKey, kind: 'video' | 'recipe', id: string) => void;
  setCollectionNote: (key: CollectionKey, kind: 'video' | 'recipe', id: string, note: string) => void;

  setYtApiKey: (key: string) => void;
  replaceAll: (data: KitchenData) => void;
}

export type Store = KitchenData & Actions;

const platformOf = (url: string) =>
  /youtu\.?be/i.test(url) ? ('youtube' as const) : /tiktok\.com/i.test(url) ? ('tiktok' as const) : ('other' as const);

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...emptyData(),

      setShabbatField: (field, value) => set((s) => ({ shabbat: { ...s.shabbat, [field]: value } })),
      setChagName: (name) => set((s) => ({ chag: { ...s.chag, name } })),
      resetShabbatMarks: () =>
        set((s) => ({ shabbat: { ...s.shabbat, night: resetMeal(s.shabbat.night), morning: s.shabbat.morning.map(resetMeal) } })),
      resetChagMarks: () =>
        set((s) => ({ chag: { ...s.chag, days: s.chag.days.map((d) => ({ ...d, meals: d.meals.map(resetMeal) })) } })),
      clearShabbat: () => set({ shabbat: emptyShabbat() }),
      clearChag: () => set((s) => ({ chag: { ...emptyChag(), name: s.chag.name } })),

      addDay: () =>
        set((s) => ({
          chag: { ...s.chag, days: [...s.chag.days, { id: uid(), name: dayName(s.chag.days.length), meals: [] }] },
        })),
      renameDay: (dayId, name) => set((s) => ({ chag: mapDay(s.chag, dayId, (d) => ({ ...d, name })) })),
      deleteDay: (dayId) => set((s) => ({ chag: { ...s.chag, days: s.chag.days.filter((d) => d.id !== dayId) } })),
      addMeal: (dayId) =>
        set((s) => ({ chag: mapDay(s.chag, dayId, (d) => ({ ...d, meals: [...d.meals, newMeal(mealName(d.meals.length))] })) })),
      deleteMeal: (dayId, mealId) =>
        set((s) => ({ chag: mapDay(s.chag, dayId, (d) => ({ ...d, meals: d.meals.filter((m) => m.id !== mealId) })) })),
      renameMeal: (mealId, name) => set((s) => mapMeal(s, mealId, (m) => ({ ...m, name }))),

      addCourse: (mealId) =>
        set((s) =>
          mapMeal(s, mealId, (m) => ({ ...m, courses: [...m.courses, { id: uid(), name: courseName(m.courses.length), items: [] }] })),
        ),
      renameCourse: (mealId, courseId, name) => set((s) => mapCourse(s, mealId, courseId, (c) => ({ ...c, name }))),
      deleteCourse: (mealId, courseId) =>
        set((s) => mapMeal(s, mealId, (m) => ({ ...m, courses: m.courses.filter((c) => c.id !== courseId) }))),
      addItem: (mealId, courseId, name, qty) =>
        set((s) =>
          mapCourse(s, mealId, courseId, (c) => ({ ...c, items: [...c.items, { id: uid(), name, qty, done: false }] })),
        ),
      updateItem: (mealId, courseId, itemId, patch) =>
        set((s) =>
          mapCourse(s, mealId, courseId, (c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) })),
        ),
      deleteItem: (mealId, courseId, itemId) =>
        set((s) => mapCourse(s, mealId, courseId, (c) => ({ ...c, items: c.items.filter((i) => i.id !== itemId) }))),
      toggleItem: (mealId, courseId, itemId) =>
        set((s) =>
          mapCourse(s, mealId, courseId, (c) => ({
            ...c,
            items: c.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
          })),
        ),

      addChef: (name, url) => {
        const id = uid();
        set((s) => ({ chefs: [...s.chefs, { id, name, url, platform: platformOf(url) }] }));
        return id;
      },
      updateChef: (id, patch) =>
        set((s) => ({
          chefs: s.chefs.map((c) =>
            c.id === id ? { ...c, ...patch, platform: patch.url !== undefined ? platformOf(patch.url) : c.platform } : c,
          ),
        })),
      deleteChef: (id) =>
        set((s) => {
          const gone = new Set([
            ...allVideos(s).filter((v) => v.chefId === id).map((v) => v.id),
            ...allRecipes(s).filter((r) => r.chefId === id).map((r) => r.id),
          ]);
          return {
            chefs: s.chefs.filter((c) => c.id !== id),
            videos: s.videos.filter((v) => v.chefId !== id),
            recipes: s.recipes.filter((r) => r.chefId !== id),
            collections: {
              shabbat: s.collections.shabbat.filter((e) => !gone.has(e.id)),
              chag: s.collections.chag.filter((e) => !gone.has(e.id)),
            },
          };
        }),
      addCategory: (name, icon) => {
        const id = uid();
        set((s) => ({ categories: [...s.categories, { id, name, icon: icon || '🍽️' }] }));
        return id;
      },
      updateCategory: (id, patch) => set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteCategory: (id) =>
        set((s) => {
          const gone = new Set([
            ...allVideos(s).filter((v) => v.categoryId === id).map((v) => v.id),
            ...allRecipes(s).filter((r) => r.categoryId === id).map((r) => r.id),
          ]);
          return {
            categories: s.categories.filter((c) => c.id !== id),
            videos: s.videos.filter((v) => v.categoryId !== id),
            recipes: s.recipes.filter((r) => r.categoryId !== id),
            collections: {
              shabbat: s.collections.shabbat.filter((e) => !gone.has(e.id)),
              chag: s.collections.chag.filter((e) => !gone.has(e.id)),
            },
          };
        }),

      addVideo: (v) => {
        const id = uid();
        set((s) => ({ videos: [...s.videos, { ...v, id, rating: 0, createdAt: Date.now() }] }));
        return id;
      },
      updateVideo: (id, patch) =>
        set((s) => {
          if (!isSeedVideo(id)) return { videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)) };
          const edit: SeedEdit = { ...s.seedEdits[id] };
          if (patch.rating !== undefined) edit.rating = patch.rating;
          if (patch.title !== undefined) edit.title = patch.title;
          if (patch.categoryId !== undefined) edit.categoryId = patch.categoryId;
          if (patch.extraCategoryIds !== undefined) edit.extraCategoryIds = patch.extraCategoryIds;
          return { seedEdits: { ...s.seedEdits, [id]: edit } };
        }),
      deleteVideo: (id) =>
        set((s) => ({
          videos: s.videos.filter((v) => v.id !== id),
          seedEdits: isSeedVideo(id) ? { ...s.seedEdits, [id]: { ...s.seedEdits[id], deleted: true } } : s.seedEdits,
          collections: {
            shabbat: s.collections.shabbat.filter((e) => e.id !== id),
            chag: s.collections.chag.filter((e) => e.id !== id),
          },
        })),
      addRecipe: (r) => {
        const id = uid();
        set((s) => ({ recipes: [...s.recipes, { ...r, id, rating: 0, createdAt: Date.now() }] }));
        return id;
      },
      updateRecipe: (id, patch) =>
        set((s) => {
          if (s.recipes.some((r) => r.id === id)) return { recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
          // First change to a built-in recipe: keep the user's own copy under the same id.
          const seed = allRecipes(s).find((r) => r.id === id);
          return seed ? { recipes: [...s.recipes, { ...seed, ...patch }] } : {};
        }),
      deleteRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          seedEdits: isSeedRecipe(id) ? { ...s.seedEdits, [id]: { ...s.seedEdits[id], deleted: true } } : s.seedEdits,
          collections: {
            shabbat: s.collections.shabbat.filter((e) => e.id !== id),
            chag: s.collections.chag.filter((e) => e.id !== id),
          },
        })),

      toggleCollection: (key, kind, id) =>
        set((s) => {
          const list = s.collections[key];
          const has = list.some((e) => e.kind === kind && e.id === id);
          return {
            collections: {
              ...s.collections,
              [key]: has
                ? list.filter((e) => !(e.kind === kind && e.id === id))
                : [...list, { kind, id, note: '', addedAt: Date.now() }],
            },
          };
        }),
      setCollectionNote: (key, kind, id, note) =>
        set((s) => ({
          collections: {
            ...s.collections,
            [key]: s.collections[key].map((e) => (e.kind === kind && e.id === id ? { ...e, note } : e)),
          },
        })),

      setYtApiKey: (ytApiKey) => set((s) => ({ settings: { ...s.settings, ytApiKey } })),
      replaceAll: (data) => set({ ...emptyData(), ...data }),
    }),
    {
      name: 'kitchen-data',
      version: 5,
      migrate: (persisted, version) => {
        const d = persisted as KitchenData;
        // v2 adds the built-in channel videos, which need the "שונות" category.
        if (version < 2) {
          d.seedEdits ??= {};
        }
        // v3: make sure every built-in category exists, so no built-in video or recipe is hidden.
        // v4: the Israeli channels join the chef list (the user's own chefs stay as they are).
        if (version < 4) {
          d.chefs = withHebrewChefs(d.chefs);
        }
        if (version < 4) {
          const have = new Set(d.categories.map((c) => c.id));
          d.categories = [...d.categories, ...SEED_CATEGORIES.filter((c) => !have.has(c.id))];
        }
        // v5: Shorts live in their dish categories; the separate "שורטס" category is gone.
        if (version < 5) d.categories = d.categories.filter((c) => c.id !== 'shorts');
        return d;
      },
      storage: createJSONStorage(() => storage),
      partialize: (s): KitchenData => ({
        version: 2,
        shabbat: s.shabbat,
        chag: s.chag,
        chefs: s.chefs,
        categories: s.categories,
        videos: s.videos,
        seedEdits: s.seedEdits,
        recipes: s.recipes,
        collections: s.collections,
        settings: s.settings,
      }),
    },
  ),
);

export const exportData = (): KitchenData => {
  const s = useStore.getState();
  return {
    version: 2,
    shabbat: s.shabbat,
    chag: s.chag,
    chefs: s.chefs,
    categories: s.categories,
    videos: s.videos,
    seedEdits: s.seedEdits,
    recipes: s.recipes,
    collections: s.collections,
    settings: s.settings,
  };
};

type VideoSource = Pick<KitchenData, 'videos' | 'seedEdits' | 'chefs' | 'categories'>;
let memo: { src: VideoSource; out: Video[]; rev: number } | null = null;

/** The user's videos plus the built-in channel videos, with the user's edits applied. */
export function allVideos(s: VideoSource): Video[] {
  const rev = useSeeds.getState().rev;
  if (
    memo &&
    memo.rev === rev &&
    memo.src.videos === s.videos &&
    memo.src.seedEdits === s.seedEdits &&
    memo.src.chefs === s.chefs &&
    memo.src.categories === s.categories
  )
    return memo.out;
  const chefs = new Set(s.chefs.map((c) => c.id));
  const cats = new Set(s.categories.map((c) => c.id));
  const seen = new Set(s.videos.map((v) => `${v.chefId}/${v.youtubeId}`));
  const seeded: Video[] = [];
  for (const v of seedVideos()) {
    const e = s.seedEdits[v.id];
    if (e?.deleted || !chefs.has(v.chefId) || seen.has(`${v.chefId}/${v.youtubeId}`)) continue;
    const merged = e ? { ...v, ...e } : v;
    if (cats.has(merged.categoryId)) seeded.push(merged);
  }
  const out = [...s.videos, ...seeded];
  memo = { src: { videos: s.videos, seedEdits: s.seedEdits, chefs: s.chefs, categories: s.categories }, out, rev };
  return out;
}

export const useAllVideos = () => {
  useSeeds((x) => x.rev);
  return useStore(allVideos);
};

type RecipeSource = Pick<KitchenData, 'recipes' | 'seedEdits' | 'chefs' | 'categories'>;
let rmemo: { src: RecipeSource; out: Recipe[]; rev: number } | null = null;

/** The user's recipes plus the built-in ones taken from video descriptions. */
export function allRecipes(s: RecipeSource): Recipe[] {
  const rev = useSeeds.getState().rev;
  if (
    rmemo &&
    rmemo.rev === rev &&
    rmemo.src.recipes === s.recipes &&
    rmemo.src.seedEdits === s.seedEdits &&
    rmemo.src.chefs === s.chefs &&
    rmemo.src.categories === s.categories
  )
    return rmemo.out;
  const chefs = new Set(s.chefs.map((c) => c.id));
  const cats = new Set(s.categories.map((c) => c.id));
  const own = new Set(s.recipes.map((r) => r.id));
  const seeded = seedRecipes().filter(
    (r) => !own.has(r.id) && !s.seedEdits[r.id]?.deleted && chefs.has(r.chefId) && cats.has(r.categoryId),
  );
  const out = [...s.recipes, ...seeded];
  rmemo = { src: { recipes: s.recipes, seedEdits: s.seedEdits, chefs: s.chefs, categories: s.categories }, out, rev };
  return out;
}

export const useAllRecipes = () => {
  useSeeds((x) => x.rev);
  return useStore(allRecipes);
};

/** Whether a video belongs in a category (its main one or an extra one). */
export const inCategory = (v: Video, catId: string) => v.categoryId === catId || !!v.extraCategoryIds?.includes(catId);

/** Counts for the "כמה נשאר" badges. */
export function countMeals(meals: Meal[]) {
  let total = 0;
  let done = 0;
  for (const m of meals) for (const c of m.courses) for (const i of c.items) {
    total++;
    if (i.done) done++;
  }
  return { total, done, left: total - done };
}

/** Highest rated first; unrated keep newest first. */
export const byRating = <T extends { rating: number; createdAt: number }>(a: T, b: T) =>
  b.rating - a.rating || b.createdAt - a.createdAt;

// The account copy arrived after the page started from this device's copy: switch to it.
setLateCloudHandler((value) => {
  try {
    const parsed = JSON.parse(value) as { state?: KitchenData };
    if (parsed.state) useStore.setState({ ...parsed.state });
  } catch {
    /* ignore a broken copy */
  }
});

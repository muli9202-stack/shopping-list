import { rootCategoryId } from './catalog';
import type { Category, ChainId } from './types';

// A stable color and emoji per top-level category, shared by the map editor,
// the route list and the 3D view.

const HUES = [168, 262, 28, 205, 330, 95, 45, 190, 0, 125, 285, 60];

export function categoryHue(categories: Category[], chainId: ChainId, catId: string | null): number | null {
  const root = rootCategoryId(categories, catId);
  if (!root) return null;
  const tops = categories.filter((c) => c.chainId === chainId && !c.parentId).sort((a, b) => a.order - b.order);
  const i = tops.findIndex((c) => c.id === root);
  return i < 0 ? null : HUES[i % HUES.length];
}

const EMOJI: [RegExp, string][] = [
  [/חלב|גבינ|יוגורט|מעדנ|שמנת|חמאה/, '🥛'],
  [/ביצ/, '🥚'],
  [/ירק|פירות|פרי/, '🥦'],
  [/לחם|מאפ|חלות|פית/, '🍞'],
  [/בשר|עוף|דג/, '🍗'],
  [/ממתק|חטיף|שוקולד|סוכרי|טופ|עוגי/, '🍬'],
  [/שתי|משקא|מיץ|מים|קפה|תה/, '🥤'],
  [/קפוא|גליד/, '🧊'],
  [/ניקי|כביס|אקונומיקה/, '🧽'],
  [/טיפוח|היגיינ|שמפו|סבון/, '🧴'],
  [/תינוק|חיתול/, '🍼'],
  [/שימור|רטב/, '🥫'],
  [/יבש|אורז|פסטה|קמח|קטני|אפי/, '🌾'],
  [/תבלין|שמן/, '🫒'],
  [/חיות|כלב|חתול/, '🐾'],
  [/נייר|חד.פעמי/, '🧻'],
];

export function categoryEmoji(name: string): string {
  return EMOJI.find(([re]) => re.test(name))?.[1] ?? '🛒';
}

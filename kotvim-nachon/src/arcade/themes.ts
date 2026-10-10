import type { ProductKind } from './models';

/**
 * The 30 business games of the arcade. One engine (engine.ts) runs them all:
 * - 'shop':  a station makes the product → carry it to the counter → the queue buys it
 * - 'line':  a raw-material station → a machine turns it into the product → counter
 * - 'seats': customers wait at seats (beds, pumps…) → bring the product to each one
 */
export interface Theme {
  id: string;
  name: string;
  emoji: string;
  kind: 'shop' | 'line' | 'seats';
  product: ProductKind;
  productName: string;
  station: string;
  /** 'line': the raw material and the machine that processes it */
  raw?: ProductKind;
  rawStation?: string;
  /** 'seats': what the customers wait at */
  seat?: string;
  customer: 'person' | 'car';
  price: number;
  floor: string;
  wall: string;
  accent: string;
}

const T = (t: Omit<Theme, 'customer' | 'price'> & Partial<Pick<Theme, 'customer' | 'price'>>): Theme => ({ customer: 'person', price: 5, ...t });

export const THEMES: Theme[] = [
  T({ id: 'burger', name: 'בורגר לנד', emoji: '🍔', kind: 'shop', product: 'burger', productName: 'המבורגר', station: 'גריל', floor: '#ffe8cc', wall: '#ff922b', accent: '#e8590c' }),
  T({ id: 'pizza', name: 'פיצרייה', emoji: '🍕', kind: 'line', product: 'pizza', productName: 'פיצה', raw: 'dough', rawStation: 'מקרר בצק', station: 'תנור', floor: '#fff4e6', wall: '#e03131', accent: '#c92a2a', price: 7 }),
  T({ id: 'coffee', name: 'בית קפה', emoji: '☕', kind: 'shop', product: 'coffee', productName: 'קפה', station: 'מכונת קפה', floor: '#f1e3d3', wall: '#8d5a2b', accent: '#6d3b1e' }),
  T({ id: 'icecream', name: 'גלידרייה', emoji: '🍦', kind: 'shop', product: 'icecream', productName: 'גלידה', station: 'מקרר גלידה', floor: '#fff0f6', wall: '#f783ac', accent: '#d6336c' }),
  T({ id: 'bakery', name: 'מאפייה', emoji: '🥖', kind: 'line', product: 'bread', productName: 'לחם', raw: 'flour', rawStation: 'שקי קמח', station: 'תנור', floor: '#fff9db', wall: '#f59f00', accent: '#e67700', price: 6 }),
  T({ id: 'hospital', name: 'בית חולים', emoji: '🏥', kind: 'seats', product: 'medicine', productName: 'תרופה', station: 'בית מרקחת', seat: 'מיטה', floor: '#e7f5ff', wall: '#74c0fc', accent: '#1c7ed6', price: 9 }),
  T({ id: 'paint', name: 'חנות צבעים', emoji: '🎨', kind: 'shop', product: 'paint', productName: 'צבע', station: 'מערבל צבע', floor: '#f3f0ff', wall: '#9775fa', accent: '#7048e8', price: 6 }),
  T({ id: 'gas', name: 'תחנת דלק', emoji: '⛽', kind: 'seats', product: 'fuel', productName: 'דלק', station: 'מיכל דלק', seat: 'משאבה', customer: 'car', floor: '#e9ecef', wall: '#e03131', accent: '#c92a2a', price: 10 }),
  T({ id: 'carwash', name: 'שטיפת מכוניות', emoji: '🚿', kind: 'seats', product: 'soap', productName: 'סבון', station: 'מחסן סבון', seat: 'עמדת שטיפה', customer: 'car', floor: '#e3fafc', wall: '#15aabf', accent: '#0c8599', price: 8 }),
  T({ id: 'donut', name: 'דונאטס', emoji: '🍩', kind: 'shop', product: 'donut', productName: 'סופגנייה', station: 'מטגנת', floor: '#fff0f6', wall: '#e64980', accent: '#c2255c' }),
  T({ id: 'cake', name: 'קונדיטוריה', emoji: '🎂', kind: 'line', product: 'cake', productName: 'עוגה', raw: 'flour', rawStation: 'שקי קמח', station: 'תנור עוגות', floor: '#fff5f5', wall: '#ff8787', accent: '#f03e3e', price: 8 }),
  T({ id: 'juice', name: 'בר מיצים', emoji: '🧃', kind: 'line', product: 'juice', productName: 'מיץ', raw: 'fruit', rawStation: 'ארגז תפוזים', station: 'מסחטה', floor: '#fff4e6', wall: '#fd7e14', accent: '#e8590c', price: 6 }),
  T({ id: 'sushi', name: 'סושי בר', emoji: '🍣', kind: 'shop', product: 'sushi', productName: 'סושי', station: 'דלפק סושי', floor: '#f8f9fa', wall: '#495057', accent: '#212529', price: 7 }),
  T({ id: 'hotdog', name: 'נקניקייה', emoji: '🌭', kind: 'shop', product: 'hotdog', productName: 'נקניקייה', station: 'גריל', floor: '#fff9db', wall: '#fab005', accent: '#e67700' }),
  T({ id: 'cinema', name: 'קולנוע', emoji: '🍿', kind: 'shop', product: 'popcorn', productName: 'פופקורן', station: 'מכונת פופקורן', floor: '#ffe3e3', wall: '#862e9c', accent: '#5f3dc4' }),
  T({ id: 'candy', name: 'חנות ממתקים', emoji: '🍬', kind: 'shop', product: 'candy', productName: 'סוכרייה', station: 'מכונת ממתקים', floor: '#f8f0fc', wall: '#da77f2', accent: '#ae3ec9', price: 4 }),
  T({ id: 'fruits', name: 'דוכן תפוחים', emoji: '🍎', kind: 'shop', product: 'apple', productName: 'תפוח', station: 'ארגז תפוחים', floor: '#ebfbee', wall: '#40c057', accent: '#2f9e44', price: 4 }),
  T({ id: 'fish', name: 'דוכן דגים', emoji: '🐟', kind: 'shop', product: 'fish', productName: 'דג', station: 'מקרר דגים', floor: '#e7f5ff', wall: '#339af0', accent: '#1971c2', price: 7 }),
  T({ id: 'flowers', name: 'חנות פרחים', emoji: '💐', kind: 'line', product: 'flower', productName: 'פרח', raw: 'seed', rawStation: 'שקי זרעים', station: 'חממה', floor: '#f4fce3', wall: '#94d82d', accent: '#66a80f', price: 7 }),
  T({ id: 'library', name: 'ספרייה', emoji: '📚', kind: 'shop', product: 'book', productName: 'ספר', station: 'מדף ספרים', floor: '#f1e3d3', wall: '#1c7ed6', accent: '#1864ab', price: 6 }),
  T({ id: 'gifts', name: 'חנות מתנות', emoji: '🎁', kind: 'shop', product: 'gift', productName: 'מתנה', station: 'עמדת עטיפה', floor: '#fff5f5', wall: '#fa5252', accent: '#e03131', price: 8 }),
  T({ id: 'toys', name: 'חנות צעצועים', emoji: '🧸', kind: 'shop', product: 'toy', productName: 'צעצוע', station: 'מכונת צעצועים', floor: '#e7f5ff', wall: '#fcc419', accent: '#f08c00', price: 7 }),
  T({ id: 'laundry', name: 'מכבסה', emoji: '👕', kind: 'line', product: 'shirt', productName: 'חולצה', raw: 'cloth', rawStation: 'סל כביסה', station: 'מכונת כביסה', floor: '#e3fafc', wall: '#3bc9db', accent: '#1098ad', price: 6 }),
  T({ id: 'shoes', name: 'חנות נעליים', emoji: '👟', kind: 'shop', product: 'shoe', productName: 'נעל', station: 'מדף נעליים', floor: '#fff4e6', wall: '#e8590c', accent: '#d9480f', price: 8 }),
  T({ id: 'clinic', name: 'מרפאה', emoji: '🩹', kind: 'seats', product: 'bandage', productName: 'תחבושת', station: 'ארון עזרה', seat: 'כיסא טיפולים', floor: '#f8f9fa', wall: '#ff6b6b', accent: '#e03131', price: 8 }),
  T({ id: 'garage', name: 'מוסך', emoji: '🛞', kind: 'seats', product: 'tire', productName: 'צמיג', station: 'מחסן צמיגים', seat: 'עמדת תיקון', customer: 'car', floor: '#dee2e6', wall: '#495057', accent: '#343a40', price: 11 }),
  T({ id: 'phones', name: 'חנות טלפונים', emoji: '📱', kind: 'shop', product: 'phone', productName: 'טלפון', station: 'מחסן טלפונים', floor: '#f8f9fa', wall: '#4263eb', accent: '#364fc7', price: 12 }),
  T({ id: 'jewels', name: 'חנות תכשיטים', emoji: '💎', kind: 'shop', product: 'gem', productName: 'יהלום', station: 'כספת', floor: '#f3f0ff', wall: '#22b8cf', accent: '#1098ad', price: 14 }),
  T({ id: 'vet', name: 'וטרינר', emoji: '🐶', kind: 'seats', product: 'bone', productName: 'עצם', station: 'מזווה', seat: 'כיסא המתנה', floor: '#fff9db', wall: '#a9e34b', accent: '#74b816', price: 9 }),
  T({ id: 'nursery', name: 'משתלה', emoji: '🪴', kind: 'shop', product: 'plant', productName: 'עציץ', station: 'חממה', floor: '#ebfbee', wall: '#69db7c', accent: '#37b24d', price: 6 }),
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<string, Theme>;

/** Gold coins to open each game: the first three are free, then a little more each time. */
export function unlockCost(index: number): number {
  return index < 3 ? 0 : 20 + (index - 3) * 5;
}

/** Gold coins for one shift (3 minutes) in a business. */
export const SHIFT_COST = 5;
export const SHIFT_SECONDS = 180;

// Fictional teams, players, formations and tactics. Every name is invented;
// the database is generated from a fixed seed so it is the same on every device.

export type Pos = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface Stats {
  pace: number;
  accel: number;
  agility: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  stamina: number;
  composure: number;
  freeKick: number;
  gk: number;
}

export interface PlayerData {
  id: string;
  name: string;
  num: number;
  pos: Pos;
  role: string;
  nation: string;
  league: string;
  clubId: string;
  stats: Stats;
  ovr: number;
  potential: number;
  height: number; // cm
  weight: number; // kg
  age: number;
  skin: number; // index into SKIN_TONES
  hair: number; // index into hair styles
  hairColor: number; // index into HAIR_COLORS
  boots: number;
  foot: 'R' | 'L';
  value: number; // in thousands
  wage: number; // weekly, in thousands
}

export interface Kit {
  shirt: string;
  sleeve: string;
  shorts: string;
  socks: string;
  number: string;
  stripes?: string;
}

export interface TeamData {
  id: string;
  name: string;
  short: string;
  league: string;
  home: Kit;
  away: Kit;
  gkKit: Kit;
  players: PlayerData[];
  formation: string;
  tactic: TacticId;
  rating: number;
  stadium: string;
}

export const SKIN_TONES = ['#e3b08c', '#d09a74', '#b57a54', '#93603f', '#6e432c', '#4d2e1e'];
export const HAIR_COLORS = ['#1b1410', '#3b2414', '#6b4423', '#a8763e', '#d9b56c', '#9a9a9a'];
export const BOOT_COLORS = ['#111111', '#f5f5f5', '#ff4d1a', '#20d0ff', '#c6ff1a', '#ff2a8a', '#ffd400'];

// ---- deterministic random ----
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES: Record<string, { first: string[]; last: string[]; skin: number[] }> = {
  'ישראל': {
    first: ['איתי', 'נועם', 'עומר', 'יונתן', 'דניאל', 'אורי', 'עידו', 'רועי', 'אלון', 'תומר', 'גיא', 'אביב', 'שי', 'ליאור', 'ניר', 'עמית', 'אופק', 'יהב'],
    last: ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שלום', 'אזולאי', 'דהן', 'חדד', 'גבאי', 'אוחיון', 'סויסה', 'נחום', 'בן שושן'],
    skin: [0, 1, 1, 2],
  },
  'ספרד': {
    first: ['חוויאר', 'סרחיו', 'פבלו', 'אלברו', 'מרקוס', 'אדריאן', 'איקר', 'רובן', 'חורחה', 'דייגו'],
    last: ['גרסיה', 'רודריגס', 'מרטינס', 'לופס', 'סאנצ\'ס', 'פרננדס', 'מורנו', 'רואיס', 'נבארו', 'טורס', 'בלסקו'],
    skin: [0, 1, 1],
  },
  'ברזיל': {
    first: ['גבריאל', 'לוקאס', 'מתאוס', 'פליפה', 'רפאל', 'ברונו', 'טיאגו', 'ז\'ואאו', 'קאיו', 'ויטור'],
    last: ['סילבה', 'סנטוס', 'אוליביירה', 'סוזה', 'פריירה', 'קוסטה', 'אלמיידה', 'ליימה', 'ריביירו', 'קרדוזו'],
    skin: [1, 2, 3, 4, 5],
  },
  'ארגנטינה': {
    first: ['ניקולס', 'מתיאס', 'פקונדו', 'לאוטרו', 'גונסאלו', 'אנחל', 'חוליאן', 'אמיליאנו', 'רודריגו'],
    last: ['גומס', 'דיאס', 'רומרו', 'אקוניה', 'פרס', 'סוסה', 'מדינה', 'פרייטס', 'קבראל', 'לדסמה'],
    skin: [0, 1, 1, 2],
  },
  'צרפת': {
    first: ['אנטואן', 'תאו', 'לוקה', 'יוגו', 'אדריאן', 'מקסים', 'נתן', 'ז\'ול', 'עוסמן', 'ברהים'],
    last: ['דופון', 'מרטן', 'לורן', 'ברנאר', 'מורו', 'פטי', 'לפבר', 'גרנייה', 'קמארה', 'דיאבי', 'טראורה'],
    skin: [0, 1, 3, 4, 5],
  },
  'גרמניה': {
    first: ['לוקאס', 'יונאס', 'פליקס', 'לאון', 'טימו', 'ניקלס', 'מקסימיליאן', 'פול', 'יאניק'],
    last: ['מולר', 'שמידט', 'שניידר', 'פישר', 'וובר', 'וגנר', 'בקר', 'הופמן', 'קליין', 'וולף'],
    skin: [0, 0, 1],
  },
  'אנגליה': {
    first: ['ג\'יימס', 'הארי', 'ג\'ק', 'אוליבר', 'מייסון', 'ג\'ורג\'', 'קונור', 'ריס', 'בן', 'טיירון'],
    last: ['סמית\'', 'ג\'ונס', 'טיילור', 'בראון', 'ווקר', 'רייט', 'קלארק', 'יוז', 'אדוארדס', 'בנט'],
    skin: [0, 0, 1, 4, 5],
  },
  'איטליה': {
    first: ['מרקו', 'אלסנדרו', 'לורנצו', 'פדריקו', 'מתיאו', 'ג\'ובאני', 'ניקולו', 'אנדריאה'],
    last: ['רוסי', 'פרארי', 'אספוזיטו', 'ביאנקי', 'רומנו', 'קולומבו', 'ריצ\'י', 'מרינו', 'גרקו'],
    skin: [0, 1, 1],
  },
  'פורטוגל': {
    first: ['ז\'ואאו', 'דיוגו', 'רובן', 'אנדרה', 'נונו', 'פדרו', 'גונסאלו', 'ויטיניה'],
    last: ['קרוואליו', 'רודריגש', 'מנדש', 'גומש', 'פינטו', 'מרקש', 'טייישרה', 'נבש'],
    skin: [0, 1, 2],
  },
  'הולנד': {
    first: ['דאן', 'סם', 'לוק', 'ייס', 'תיס', 'ברם', 'מילאן', 'ריאן'],
    last: ['יאנסן', 'דה פריס', 'ואן דר ברג', 'בקר', 'וויסר', 'סמיט', 'מולדר', 'דה גראף'],
    skin: [0, 0, 3, 4],
  },
  'ניגריה': {
    first: ['צ\'ידי', 'אמקה', 'טונדה', 'סמואל', 'קלצ\'י', 'אוביננה', 'פמי', 'איקצ\'וקו'],
    last: ['אוקונקוו', 'אדבאיו', 'אובי', 'אוקאפור', 'נוואנקו', 'אייגבה', 'אדה', 'אוגבו'],
    skin: [4, 5, 5],
  },
  'יפן': {
    first: ['הירוטו', 'רן', 'סוטה', 'יוטו', 'קאיטו', 'דאיצ\'י', 'טקומי', 'קנטו'],
    last: ['סאטו', 'סוזוקי', 'טקהאשי', 'טנאקה', 'ואטנבה', 'איטו', 'נקמורה', 'קובאיאשי'],
    skin: [0, 1],
  },
};

export const NATIONS = Object.keys(NAMES);

export const NATION_FLAGS: Record<string, string> = {
  'ישראל': '🇮🇱', 'ספרד': '🇪🇸', 'ברזיל': '🇧🇷', 'ארגנטינה': '🇦🇷', 'צרפת': '🇫🇷', 'גרמניה': '🇩🇪',
  'אנגליה': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'איטליה': '🇮🇹', 'פורטוגל': '🇵🇹', 'הולנד': '🇳🇱', 'ניגריה': '🇳🇬', 'יפן': '🇯🇵',
};

export const LEAGUES = ['ליגת הכוכבים', 'הליגה הבינלאומית'];

interface ClubSeed {
  id: string;
  name: string;
  short: string;
  league: number;
  base: number;
  nations: string[];
  home: Kit;
  away: Kit;
  stadium: string;
  formation: string;
  tactic: TacticId;
}

const k = (shirt: string, sleeve: string, shorts: string, socks: string, number: string, stripes?: string): Kit => ({
  shirt, sleeve, shorts, socks, number, stripes,
});

const CLUBS: ClubSeed[] = [
  { id: 'gal', name: 'אריות הגליל', short: 'GAL', league: 0, base: 80, nations: ['ישראל', 'ברזיל', 'צרפת'], home: k('#0f7a3a', '#0f7a3a', '#ffffff', '#0f7a3a', '#ffffff'), away: k('#ffffff', '#0f7a3a', '#0f7a3a', '#ffffff', '#0f7a3a'), stadium: 'אצטדיון הגליל', formation: '4-3-3', tactic: 'balanced' },
  { id: 'koc', name: 'כוכבי הים', short: 'KOC', league: 0, base: 83, nations: ['ישראל', 'ספרד', 'ארגנטינה'], home: k('#132a6b', '#132a6b', '#132a6b', '#d4a017', '#d4a017'), away: k('#d4a017', '#132a6b', '#ffffff', '#d4a017', '#132a6b'), stadium: 'היכל הגלים', formation: '4-2-3-1', tactic: 'tikitaka' },
  { id: 'nes', name: 'נשרי הדרום', short: 'NES', league: 0, base: 76, nations: ['ישראל', 'ניגריה', 'פורטוגל'], home: k('#c4161c', '#111111', '#111111', '#c4161c', '#ffffff', '#111111'), away: k('#f2f2f2', '#c4161c', '#f2f2f2', '#f2f2f2', '#c4161c'), stadium: 'קן הנשרים', formation: '4-4-2', tactic: 'counter' },
  { id: 'brk', name: 'ברקי הכרמל', short: 'BRK', league: 0, base: 78, nations: ['ישראל', 'גרמניה', 'הולנד'], home: k('#ffd100', '#1d4ed8', '#1d4ed8', '#ffd100', '#1d4ed8'), away: k('#1d4ed8', '#ffd100', '#ffffff', '#1d4ed8', '#ffd100'), stadium: 'זירת הכרמל', formation: '4-3-3', tactic: 'gegenpress' },
  { id: 'zav', name: 'זאבי ההר', short: 'ZAV', league: 0, base: 72, nations: ['ישראל', 'איטליה'], home: k('#5b5f66', '#f97316', '#2b2d31', '#f97316', '#f97316'), away: k('#f97316', '#2b2d31', '#2b2d31', '#2b2d31', '#ffffff'), stadium: 'מצודת ההר', formation: '5-3-2', tactic: 'parkbus' },
  { id: 'sar', name: 'סערת החוף', short: 'SAR', league: 0, base: 74, nations: ['ישראל', 'ארגנטינה', 'יפן'], home: k('#5ec2f2', '#ffffff', '#ffffff', '#5ec2f2', '#0b3d63'), away: k('#0b3d63', '#5ec2f2', '#0b3d63', '#0b3d63', '#ffffff'), stadium: 'אצטדיון החוף', formation: '4-4-2', tactic: 'balanced' },
  { id: 'pan', name: 'הפנתרים השחורים', short: 'PAN', league: 0, base: 75, nations: ['ישראל', 'צרפת', 'אנגליה'], home: k('#111111', '#6b21a8', '#111111', '#111111', '#c084fc'), away: k('#ede9fe', '#6b21a8', '#6b21a8', '#ede9fe', '#6b21a8'), stadium: 'המאורה', formation: '3-5-2', tactic: 'gegenpress' },
  { id: 'drk', name: 'דרקוני המזרח', short: 'DRK', league: 0, base: 70, nations: ['ישראל', 'יפן', 'ניגריה'], home: k('#8b0d1f', '#d4a017', '#8b0d1f', '#8b0d1f', '#d4a017'), away: k('#d4a017', '#8b0d1f', '#8b0d1f', '#d4a017', '#8b0d1f'), stadium: 'ארמון הדרקון', formation: '4-2-3-1', tactic: 'counter' },
  { id: 'sol', name: 'אתלטיקו סולארה', short: 'SOL', league: 1, base: 84, nations: ['ספרד', 'ארגנטינה', 'ברזיל'], home: k('#ffffff', '#d71920', '#1c2a5a', '#d71920', '#1c2a5a', '#d71920'), away: k('#1c2a5a', '#1c2a5a', '#1c2a5a', '#1c2a5a', '#ffffff'), stadium: 'אסטדיו סולארה', formation: '4-4-2', tactic: 'parkbus' },
  { id: 'ven', name: 'ריאל ונטורה', short: 'VEN', league: 1, base: 87, nations: ['ספרד', 'ברזיל', 'צרפת'], home: k('#fafafa', '#fafafa', '#fafafa', '#fafafa', '#6d28d9'), away: k('#6d28d9', '#fafafa', '#6d28d9', '#6d28d9', '#fafafa'), stadium: 'אסטדיו ונטורה', formation: '4-3-3', tactic: 'tikitaka' },
  { id: 'lus', name: 'ספורטינג לוסיטה', short: 'LUS', league: 1, base: 79, nations: ['פורטוגל', 'ברזיל'], home: k('#ffffff', '#16794a', '#ffffff', '#16794a', '#16794a', '#16794a'), away: k('#111111', '#16794a', '#111111', '#111111', '#16794a'), stadium: 'אסטדיו לוסיטה', formation: '4-2-3-1', tactic: 'balanced' },
  { id: 'nor', name: 'אינטר נורדיקה', short: 'NOR', league: 1, base: 82, nations: ['איטליה', 'ארגנטינה', 'הולנד'], home: k('#1846c4', '#111111', '#111111', '#111111', '#ffffff', '#111111'), away: k('#ffffff', '#1846c4', '#ffffff', '#ffffff', '#1846c4'), stadium: 'סטדיו נורדיקו', formation: '3-5-2', tactic: 'counter' },
  { id: 'rhe', name: 'פ.צ. ריינלנד', short: 'RHE', league: 1, base: 85, nations: ['גרמניה', 'הולנד', 'צרפת'], home: k('#dc0f2e', '#dc0f2e', '#dc0f2e', '#dc0f2e', '#ffffff'), away: k('#f3f4f6', '#dc0f2e', '#f3f4f6', '#f3f4f6', '#dc0f2e'), stadium: 'ריינלנד ארנה', formation: '4-2-3-1', tactic: 'gegenpress' },
  { id: 'alb', name: 'יונייטד אלביון', short: 'ALB', league: 1, base: 81, nations: ['אנגליה', 'פורטוגל', 'ניגריה'], home: k('#c8102e', '#c8102e', '#ffffff', '#111111', '#ffffff'), away: k('#111111', '#c8102e', '#111111', '#111111', '#c8102e'), stadium: 'פארק אלביון', formation: '4-3-3', tactic: 'counter' },
  { id: 'lum', name: 'אולימפיק לומייר', short: 'LUM', league: 1, base: 78, nations: ['צרפת', 'ניגריה'], home: k('#ffffff', '#1e3a8a', '#1e3a8a', '#ffffff', '#1e3a8a'), away: k('#1e3a8a', '#ffffff', '#ffffff', '#1e3a8a', '#ffffff'), stadium: 'סטאד לומייר', formation: '4-3-3', tactic: 'balanced' },
  { id: 'kar', name: 'דינמו קרפטיה', short: 'KAR', league: 1, base: 74, nations: ['גרמניה', 'איטליה', 'יפן'], home: k('#1e40af', '#ffffff', '#ffffff', '#1e40af', '#ffffff'), away: k('#ffffff', '#1e40af', '#1e40af', '#1e40af', '#1e40af'), stadium: 'הקרפטים', formation: '5-3-2', tactic: 'parkbus' },
];

// ---- formations ----
// depth: 0 = defensive line, 1 = forward line. w: -1 = left touchline, 1 = right (team's own view).
export interface Slot {
  role: string;
  pos: Pos;
  depth: number;
  w: number;
}

export const FORMATIONS: Record<string, Slot[]> = {
  '4-3-3': [
    { role: 'GK', pos: 'GK', depth: -1, w: 0 },
    { role: 'LB', pos: 'DEF', depth: 0.02, w: -0.82 },
    { role: 'CB', pos: 'DEF', depth: 0, w: -0.3 },
    { role: 'CB', pos: 'DEF', depth: 0, w: 0.3 },
    { role: 'RB', pos: 'DEF', depth: 0.02, w: 0.82 },
    { role: 'CM', pos: 'MID', depth: 0.45, w: -0.45 },
    { role: 'CDM', pos: 'MID', depth: 0.3, w: 0 },
    { role: 'CM', pos: 'MID', depth: 0.45, w: 0.45 },
    { role: 'LW', pos: 'FWD', depth: 0.88, w: -0.75 },
    { role: 'ST', pos: 'FWD', depth: 1, w: 0 },
    { role: 'RW', pos: 'FWD', depth: 0.88, w: 0.75 },
  ],
  '4-4-2': [
    { role: 'GK', pos: 'GK', depth: -1, w: 0 },
    { role: 'LB', pos: 'DEF', depth: 0.02, w: -0.82 },
    { role: 'CB', pos: 'DEF', depth: 0, w: -0.3 },
    { role: 'CB', pos: 'DEF', depth: 0, w: 0.3 },
    { role: 'RB', pos: 'DEF', depth: 0.02, w: 0.82 },
    { role: 'LM', pos: 'MID', depth: 0.5, w: -0.8 },
    { role: 'CM', pos: 'MID', depth: 0.42, w: -0.25 },
    { role: 'CM', pos: 'MID', depth: 0.42, w: 0.25 },
    { role: 'RM', pos: 'MID', depth: 0.5, w: 0.8 },
    { role: 'ST', pos: 'FWD', depth: 0.95, w: -0.22 },
    { role: 'ST', pos: 'FWD', depth: 1, w: 0.22 },
  ],
  '4-2-3-1': [
    { role: 'GK', pos: 'GK', depth: -1, w: 0 },
    { role: 'LB', pos: 'DEF', depth: 0.02, w: -0.82 },
    { role: 'CB', pos: 'DEF', depth: 0, w: -0.3 },
    { role: 'CB', pos: 'DEF', depth: 0, w: 0.3 },
    { role: 'RB', pos: 'DEF', depth: 0.02, w: 0.82 },
    { role: 'CDM', pos: 'MID', depth: 0.3, w: -0.25 },
    { role: 'CDM', pos: 'MID', depth: 0.3, w: 0.25 },
    { role: 'LM', pos: 'MID', depth: 0.68, w: -0.72 },
    { role: 'CAM', pos: 'MID', depth: 0.7, w: 0 },
    { role: 'RM', pos: 'MID', depth: 0.68, w: 0.72 },
    { role: 'ST', pos: 'FWD', depth: 1, w: 0 },
  ],
  '3-5-2': [
    { role: 'GK', pos: 'GK', depth: -1, w: 0 },
    { role: 'CB', pos: 'DEF', depth: 0, w: -0.45 },
    { role: 'CB', pos: 'DEF', depth: 0, w: 0 },
    { role: 'CB', pos: 'DEF', depth: 0, w: 0.45 },
    { role: 'LM', pos: 'MID', depth: 0.45, w: -0.85 },
    { role: 'CM', pos: 'MID', depth: 0.38, w: -0.3 },
    { role: 'CDM', pos: 'MID', depth: 0.28, w: 0 },
    { role: 'CM', pos: 'MID', depth: 0.38, w: 0.3 },
    { role: 'RM', pos: 'MID', depth: 0.45, w: 0.85 },
    { role: 'ST', pos: 'FWD', depth: 0.95, w: -0.22 },
    { role: 'ST', pos: 'FWD', depth: 1, w: 0.22 },
  ],
  '5-3-2': [
    { role: 'GK', pos: 'GK', depth: -1, w: 0 },
    { role: 'LB', pos: 'DEF', depth: 0.08, w: -0.85 },
    { role: 'CB', pos: 'DEF', depth: 0, w: -0.4 },
    { role: 'CB', pos: 'DEF', depth: 0, w: 0 },
    { role: 'CB', pos: 'DEF', depth: 0, w: 0.4 },
    { role: 'RB', pos: 'DEF', depth: 0.08, w: 0.85 },
    { role: 'CM', pos: 'MID', depth: 0.4, w: -0.4 },
    { role: 'CDM', pos: 'MID', depth: 0.32, w: 0 },
    { role: 'CM', pos: 'MID', depth: 0.4, w: 0.4 },
    { role: 'ST', pos: 'FWD', depth: 0.95, w: -0.22 },
    { role: 'ST', pos: 'FWD', depth: 1, w: 0.22 },
  ],
};

// ---- tactics ----
export type TacticId = 'balanced' | 'gegenpress' | 'tikitaka' | 'parkbus' | 'counter';

export interface Tactic {
  id: TacticId;
  name: string;
  desc: string;
  lineHeight: number; // 0 deep .. 1 high (defensive line position)
  width: number; // 0 narrow .. 1 wide (in possession)
  depth: number; // vertical distance between lines (0 compact .. 1 stretched)
  press: number; // 0 drop off .. 1 press everywhere
  pressers: number; // players that close down the ball together
  directness: number; // 0 short passing .. 1 long and forward
  tempo: number; // 0 patient .. 1 fast decisions
  runs: number; // how often players make runs in behind
  forwardsStayHigh: boolean;
}

export const TACTICS: Record<TacticId, Tactic> = {
  balanced: { id: 'balanced', name: 'מאוזן', desc: 'הגנה ולחץ בגובה בינוני, משחק מסירות מגוון', lineHeight: 0.45, width: 0.6, depth: 0.5, press: 0.5, pressers: 1, directness: 0.45, tempo: 0.5, runs: 0.5, forwardsStayHigh: false },
  gegenpress: { id: 'gegenpress', name: 'לחץ גבוה (Gegenpressing)', desc: 'קו הגנה גבוה ושני לוחצים מיד באיבוד כדור', lineHeight: 0.8, width: 0.6, depth: 0.3, press: 0.95, pressers: 2, directness: 0.55, tempo: 0.85, runs: 0.7, forwardsStayHigh: false },
  tikitaka: { id: 'tikitaka', name: 'טיקי-טאקה', desc: 'מסירות קצרות, החזקה סבלנית ורוחב מלא', lineHeight: 0.6, width: 0.9, depth: 0.35, press: 0.65, pressers: 1, directness: 0.12, tempo: 0.3, runs: 0.35, forwardsStayHigh: false },
  parkbus: { id: 'parkbus', name: 'חניית אוטובוס', desc: 'בלוק נמוך וצפוף מול השער, כמעט בלי לחץ', lineHeight: 0.08, width: 0.35, depth: 0.15, press: 0.1, pressers: 1, directness: 0.75, tempo: 0.4, runs: 0.25, forwardsStayHigh: false },
  counter: { id: 'counter', name: 'מתפרצת', desc: 'הגנה עמוקה, חלוצים נשארים גבוה, כדורי עומק מהירים', lineHeight: 0.25, width: 0.5, depth: 0.55, press: 0.35, pressers: 1, directness: 0.85, tempo: 0.8, runs: 0.9, forwardsStayHigh: true },
};

// ---- player generation ----
const ROLE_POOL: { role: string; pos: Pos }[] = [
  { role: 'GK', pos: 'GK' }, { role: 'GK', pos: 'GK' },
  { role: 'LB', pos: 'DEF' }, { role: 'CB', pos: 'DEF' }, { role: 'CB', pos: 'DEF' }, { role: 'RB', pos: 'DEF' }, { role: 'CB', pos: 'DEF' }, { role: 'RB', pos: 'DEF' },
  { role: 'CDM', pos: 'MID' }, { role: 'CM', pos: 'MID' }, { role: 'CM', pos: 'MID' }, { role: 'CAM', pos: 'MID' }, { role: 'LM', pos: 'MID' }, { role: 'RM', pos: 'MID' }, { role: 'CM', pos: 'MID' },
  { role: 'LW', pos: 'FWD' }, { role: 'ST', pos: 'FWD' }, { role: 'RW', pos: 'FWD' }, { role: 'ST', pos: 'FWD' },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function computeOvr(s: Stats, pos: Pos): number {
  let v: number;
  if (pos === 'GK') v = s.gk * 0.8 + s.composure * 0.1 + s.physical * 0.1;
  else if (pos === 'DEF') v = s.defending * 0.42 + s.physical * 0.2 + s.pace * 0.14 + s.passing * 0.12 + s.composure * 0.12;
  else if (pos === 'MID') v = s.passing * 0.32 + s.dribbling * 0.22 + s.composure * 0.12 + s.defending * 0.1 + s.shooting * 0.12 + s.stamina * 0.12;
  else v = s.shooting * 0.36 + s.pace * 0.2 + s.dribbling * 0.22 + s.composure * 0.12 + s.physical * 0.1;
  return Math.round(clamp(v, 40, 99));
}

export function makePlayer(r: () => number, opts: { clubId: string; league: string; nation: string; role: string; pos: Pos; base: number; num: number; idx: number }): PlayerData {
  const { pos, base } = opts;
  const pool = NAMES[opts.nation];
  const n = (s: number) => Math.round(clamp(base + s + (r() - 0.5) * 16, 30, 97));
  const isGK = pos === 'GK';
  const stats: Stats = {
    pace: n(pos === 'FWD' ? 5 : pos === 'DEF' ? -4 : isGK ? -25 : 0),
    accel: n(pos === 'FWD' ? 5 : isGK ? -22 : 0),
    agility: n(pos === 'FWD' || opts.role === 'CAM' ? 4 : isGK ? -10 : -2),
    shooting: n(pos === 'FWD' ? 6 : pos === 'MID' ? -4 : isGK ? -45 : -22),
    passing: n(pos === 'MID' ? 5 : pos === 'DEF' ? -8 : isGK ? -25 : -4),
    dribbling: n(pos === 'FWD' ? 4 : pos === 'MID' ? 2 : isGK ? -40 : -10),
    defending: n(pos === 'DEF' ? 6 : pos === 'MID' ? -6 : isGK ? -35 : -35),
    physical: n(pos === 'DEF' ? 4 : 0),
    stamina: n(pos === 'MID' ? 5 : isGK ? -10 : 0),
    composure: n(0),
    freeKick: n(pos === 'FWD' || opts.role === 'CAM' ? 0 : -15),
    gk: isGK ? n(6) : 20,
  };
  const ovr = computeOvr(stats, pos);
  const age = 18 + Math.floor(r() * 16);
  const height = Math.round(isGK || opts.role === 'CB' || opts.role === 'ST' ? 182 + r() * 14 : 168 + r() * 18);
  const weight = Math.round(height - 108 + (r() - 0.5) * 12 + (stats.physical - 70) * 0.15);
  const potential = Math.min(97, ovr + Math.max(0, Math.round((30 - age) * (0.5 + r()))));
  const value = Math.round(Math.pow(1.13, ovr - 50) * 40 * (age < 24 ? 1.5 : age > 30 ? 0.6 : 1));
  return {
    id: `${opts.clubId}-${opts.idx}`,
    name: `${pool.first[Math.floor(r() * pool.first.length)]} ${pool.last[Math.floor(r() * pool.last.length)]}`,
    num: opts.num,
    pos,
    role: opts.role,
    nation: opts.nation,
    league: opts.league,
    clubId: opts.clubId,
    stats,
    ovr,
    potential,
    height,
    weight,
    age,
    skin: pool.skin[Math.floor(r() * pool.skin.length)],
    hair: Math.floor(r() * 6),
    hairColor: Math.floor(r() * (opts.nation === 'יפן' || pool.skin[0] >= 3 ? 2 : HAIR_COLORS.length - 1)),
    boots: Math.floor(r() * BOOT_COLORS.length),
    foot: r() < 0.22 ? 'L' : 'R',
    value,
    wage: Math.max(1, Math.round(value / 180)),
  };
}

function buildTeams(): TeamData[] {
  return CLUBS.map((c, ci) => {
    const r = rng(1000 + ci * 7919);
    const used = new Set<number>();
    const names = new Set<string>();
    const players = ROLE_POOL.map((rp, i) => {
      let num = rp.pos === 'GK' ? (i === 0 ? 1 : 12 + Math.floor(r() * 10)) : 2 + Math.floor(r() * 28);
      while (used.has(num)) num++;
      used.add(num);
      const nation = r() < 0.6 ? c.nations[0] : c.nations[Math.floor(r() * c.nations.length)];
      // first eleven-ish are stronger than the bench
      const base = c.base - 6 - (i >= 11 && i % 2 === 0 ? 5 : 0);
      let p = makePlayer(r, { clubId: c.id, league: LEAGUES[c.league], nation, role: rp.role, pos: rp.pos, base, num, idx: i });
      for (let k = 0; k < 6 && names.has(p.name); k++) p = makePlayer(r, { clubId: c.id, league: LEAGUES[c.league], nation, role: rp.role, pos: rp.pos, base, num, idx: i });
      names.add(p.name);
      return p;
    });
    const gkKit: Kit = ci % 2 ? k('#22c55e', '#15803d', '#111111', '#22c55e', '#111111') : k('#facc15', '#ca8a04', '#111111', '#facc15', '#111111');
    const t: TeamData = {
      id: c.id, name: c.name, short: c.short, league: LEAGUES[c.league], home: c.home, away: c.away, gkKit,
      players, formation: c.formation, tactic: c.tactic, rating: 0, stadium: c.stadium,
    };
    t.rating = teamRating(t);
    return t;
  });
}

let TEAMS_CACHE: TeamData[] | null = null;
export function allTeams(): TeamData[] {
  if (!TEAMS_CACHE) TEAMS_CACHE = buildTeams();
  return TEAMS_CACHE;
}

export function teamById(id: string): TeamData | undefined {
  return allTeams().find((t) => t.id === id);
}

// Picks the best eleven for a formation: each slot takes the best unused player of the closest role.
const ROLE_NEAR: Record<string, string[]> = {
  GK: ['GK'],
  LB: ['LB', 'RB', 'CB', 'LM'], RB: ['RB', 'LB', 'CB', 'RM'], CB: ['CB', 'LB', 'RB', 'CDM'],
  CDM: ['CDM', 'CM', 'CB'], CM: ['CM', 'CDM', 'CAM'], CAM: ['CAM', 'CM', 'ST'],
  LM: ['LM', 'LW', 'RM', 'CM'], RM: ['RM', 'RW', 'LM', 'CM'],
  LW: ['LW', 'LM', 'RW', 'ST'], RW: ['RW', 'RM', 'LW', 'ST'], ST: ['ST', 'LW', 'RW', 'CAM'],
};

export function pickEleven(players: PlayerData[], formation: string): PlayerData[] {
  const slots = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  const used = new Set<string>();
  return slots.map((s) => {
    const near = ROLE_NEAR[s.role] ?? [s.role];
    let best: PlayerData | undefined;
    let bestScore = -1e9;
    for (const p of players) {
      if (used.has(p.id)) continue;
      const ri = near.indexOf(p.role);
      const posMatch = p.pos === s.pos;
      if (s.pos === 'GK' && p.pos !== 'GK') continue;
      if (s.pos !== 'GK' && p.pos === 'GK') continue;
      const score = p.ovr - (ri < 0 ? (posMatch ? 6 : 15) : ri * 3);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) best = players.find((p) => !used.has(p.id))!;
    used.add(best.id);
    return best;
  });
}

export function teamRating(t: TeamData): number {
  const xi = pickEleven(t.players, t.formation);
  return Math.round(xi.reduce((a, p) => a + p.ovr, 0) / xi.length);
}

export function fmtMoney(thousands: number): string {
  if (thousands >= 1000) return `₪${(thousands / 1000).toFixed(thousands >= 10000 ? 0 : 1)}M`;
  return `₪${Math.round(thousands)}K`;
}

// ---- referees ----
export interface Referee {
  name: string;
  style: 'strict' | 'lenient' | 'cards';
  styleName: string;
  cardMul: number; // multiplies the chance of a card
  advantage: number; // chance to play advantage
  error: number; // chance to miss a tight offside
}
export const REFEREES: Referee[] = [
  { name: 'אורן ברק', style: 'strict', styleName: 'קפדן', cardMul: 1.5, advantage: 0.25, error: 0.15 },
  { name: 'יוסי שגיא', style: 'lenient', styleName: 'מקל', cardMul: 0.6, advantage: 0.75, error: 0.3 },
  { name: 'מרקו פיורנטיני', style: 'cards', styleName: 'שולף כרטיסים', cardMul: 2, advantage: 0.35, error: 0.2 },
  { name: 'דניאלה לוין', style: 'strict', styleName: 'קפדנית', cardMul: 1.3, advantage: 0.45, error: 0.1 },
  { name: 'הנס ריכטר', style: 'lenient', styleName: 'מקל', cardMul: 0.8, advantage: 0.6, error: 0.25 },
];

// ---- derbies ----
export const RIVALRIES: [string, string, string][] = [
  ['gal', 'brk', 'דרבי הצפון'],
  ['koc', 'sar', 'דרבי החוף'],
  ['nes', 'drk', 'דרבי הדרום-מזרח'],
  ['zav', 'pan', 'דרבי ההרים'],
  ['ven', 'sol', 'הקלאסיקו של היבשת'],
  ['alb', 'lum', 'דרבי התעלה'],
  ['rhe', 'kar', 'דרבי הנהר'],
  ['nor', 'lus', 'דרבי הנמלים'],
];
export function derbyName(a: string, b: string): string | null {
  const r = RIVALRIES.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return r ? r[2] : null;
}

export const INJURIES = {
  hamstring: { name: 'מתיחה בשריר הירך האחורי', rounds: 3 },
  ankle: { name: 'נקע בקרסול', rounds: 2 },
  knee: { name: 'פגיעה ברצועה בברך', rounds: 8 },
  head: { name: 'מכה בראש (ממשיך עם חבישה)', rounds: 0 },
} as const;
export type InjuryKind = keyof typeof INJURIES;

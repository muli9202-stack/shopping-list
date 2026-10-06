import type { MatchResult } from './match';
import {
  INJURIES, allTeams, computeOvr, FORMATIONS, LEAGUES, makePlayer, NATIONS, pickEleven, rng, teamById, teamRating,
  type Kit, type PlayerData, type Pos, type TacticId, type TeamData,
} from './data';

// ---------------- storage ----------------
export function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked */
  }
}

export interface Settings {
  quality: 'high' | 'low';
  commentary: boolean;
  volume: number;
  zoom: number;
  radar: boolean;
  touch: 'auto' | 'on' | 'off';
  difficulty: number;
  halfMinutes: number;
  guide: boolean;
  retro: boolean;
  modelScope: 'off' | 'mine' | 'all';
}
export const defaultSettings = (): Settings => ({
  quality: matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'low' : 'high',
  commentary: true,
  volume: 0.8,
  zoom: 1,
  radar: true,
  touch: 'auto',
  difficulty: 1,
  halfMinutes: 3,
  guide: true,
  retro: false,
  modelScope: 'mine',
});

export const DIFFICULTIES = ['מתחיל', 'מקצוען', 'כוכב-על', 'אגדה'];

// Head-to-head history between clubs (any mode).
export interface H2H {
  a: string;
  b: string;
  ga: number;
  gb: number;
}
export function recordH2H(a: string, b: string, ga: number, gb: number) {
  const h = load<H2H[]>('fb-h2h', []);
  h.push({ a, b, ga, gb });
  save('fb-h2h', h.slice(-300));
}
export function h2hSummary(a: string, b: string) {
  const h = load<H2H[]>('fb-h2h', []);
  let wa = 0;
  let wb = 0;
  let d = 0;
  for (const m of h) {
    let ga: number;
    let gb: number;
    if (m.a === a && m.b === b) [ga, gb] = [m.ga, m.gb];
    else if (m.a === b && m.b === a) [ga, gb] = [m.gb, m.ga];
    else continue;
    if (ga > gb) wa++;
    else if (gb > ga) wb++;
    else d++;
  }
  return { wa, wb, d, n: wa + wb + d };
}

// ---------------- quick simulation of matches the player doesn't play ----------------
function poisson(l: number, r: () => number) {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}
export function simulate(ra: number, rb: number, r: () => number = Math.random): [number, number] {
  const la = 1.35 * Math.exp((ra - rb) * 0.07) + 0.12;
  const lb = 1.1 * Math.exp((rb - ra) * 0.07);
  return [poisson(la, r), poisson(lb, r)];
}

export function kitsFor(home: TeamData, away: TeamData): [Kit, Kit] {
  const dist = (a: string, b: string) => {
    const p = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  let awayKit = away.home;
  if (dist(home.home.shirt, away.home.shirt) < 140) awayKit = away.away;
  if (dist(home.home.shirt, awayKit.shirt) < 140) awayKit = { ...away.away, shirt: '#f5f5f5', sleeve: '#d4d4d4', number: '#111111' };
  return [home.home, awayKit];
}

// ---------------- league tables ----------------
export interface Row {
  id: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}
export function emptyTable(ids: string[]): Row[] {
  return ids.map((id) => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
}
export function applyResult(table: Row[], a: string, b: string, ga: number, gb: number) {
  const ra = table.find((r) => r.id === a);
  const rb = table.find((r) => r.id === b);
  if (!ra || !rb) return;
  ra.p++;
  rb.p++;
  ra.gf += ga;
  ra.ga += gb;
  rb.gf += gb;
  rb.ga += ga;
  if (ga > gb) {
    ra.w++;
    rb.l++;
    ra.pts += 3;
  } else if (gb > ga) {
    rb.w++;
    ra.l++;
    rb.pts += 3;
  } else {
    ra.d++;
    rb.d++;
    ra.pts++;
    rb.pts++;
  }
}
export function sortTable(t: Row[]) {
  return [...t].sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}
// double round robin (circle method)
export function fixtures(ids: string[]): [string, string][][] {
  const n = ids.length;
  const arr = [...ids];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      round.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop()!);
  }
  return [...rounds, ...rounds.map((r) => r.map(([a, b]) => [b, a] as [string, string]))];
}

// ---------------- tournament ----------------
export interface Tournament {
  teamId: string;
  teams: string[]; // 8, bracket order
  round: number; // 0 QF, 1 SF, 2 F, 3 done
  results: { a: string; b: string; ga: number; gb: number; pens?: [number, number]; winner: string }[][];
  champion?: string;
}
export function newTournament(teamId: string): Tournament {
  const others = allTeams().map((t) => t.id).filter((id) => id !== teamId).sort(() => Math.random() - 0.5).slice(0, 7);
  const teams = [teamId, ...others].sort(() => Math.random() - 0.5);
  return { teamId, teams, round: 0, results: [] };
}
export function roundPairs(t: Tournament): [string, string][] {
  const alive = t.round === 0 ? t.teams : t.results[t.round - 1].map((r) => r.winner);
  const pairs: [string, string][] = [];
  for (let i = 0; i < alive.length; i += 2) pairs.push([alive[i], alive[i + 1]]);
  return pairs;
}
export function simKnockout(a: string, b: string) {
  const ta = teamById(a)!;
  const tb = teamById(b)!;
  const [ga, gb] = simulate(ta.rating, tb.rating);
  let pens: [number, number] | undefined;
  let winner = ga > gb ? a : b;
  if (ga === gb) {
    const pa = 3 + Math.floor(Math.random() * 3);
    let pb = 3 + Math.floor(Math.random() * 3);
    if (pa === pb) pb = pa - 1;
    pens = [pa, pb];
    winner = pa > pb ? a : b;
  }
  return { a, b, ga, gb, pens, winner };
}

// ---------------- manager career ----------------
export interface CareerPlayer extends PlayerData {
  morale: number; // 0..100
  scouted?: boolean;
  wonderkid?: boolean;
  fitness?: number; // 0..100 carried between matches
  injuredRounds?: number;
  injuryName?: string;
  suspended?: number;
  contract?: { releaseClause: number; sellOn: number; bonus: number };
}
export type BoardKind = 'title' | 'budget' | 'youth';
export const BOARD_TEXT: Record<BoardKind, string> = {
  title: 'הדירקטוריון דורש אליפות – רק המקום הראשון נחשב.',
  budget: 'הדירקטוריון דורש איזון תקציבי קפדני: לא לחרוג מתקציב השכר.',
  youth: 'הדירקטוריון רוצה לקדם צעירים: לפחות שחקן אחד עד גיל 21 בהרכב.',
};
export const REGIONS: Record<string, string[]> = {
  'דרום אמריקה': ['ברזיל', 'ארגנטינה'],
  'אירופה': ['ספרד', 'צרפת', 'גרמניה', 'אנגליה', 'איטליה', 'פורטוגל', 'הולנד'],
  'אפריקה': ['ניגריה'],
  'אסיה': ['יפן'],
  'ישראל': ['ישראל'],
};
export interface Career {
  kind: 'manager';
  teamId: string;
  season: number;
  round: number;
  league: string;
  clubs: string[];
  schedule: [string, string][][];
  table: Row[];
  budget: number; // thousands
  wageBudget: number; // weekly thousands
  squad: CareerPlayer[];
  formation: string;
  tactic: TacticId;
  objective: number; // target league position
  scouts: { nation: string; left: number; pos?: Pos; maxAge?: number; region?: string }[];
  prospects: CareerPlayer[];
  news: string[];
  lastResult?: string;
  trophies: string[];
  boardHappy: number;
  board: BoardKind;
  fired?: boolean;
  transferBan?: boolean;
  ffpSeason?: number;
  formationDef?: string;
  appeal?: { id: string; name: string } | null;
  others: Record<string, PlayerData[]>; // AI rosters (transfers move players)
}
export function newCareer(teamId: string): Career {
  const team = teamById(teamId)!;
  const clubs = allTeams().filter((t) => t.league === team.league).map((t) => t.id);
  const others: Record<string, PlayerData[]> = {};
  for (const id of clubs) if (id !== teamId) others[id] = teamById(id)!.players.map((p) => ({ ...p }));
  const sorted = [...clubs].sort((a, b) => teamById(b)!.rating - teamById(a)!.rating);
  const rank = sorted.indexOf(teamId);
  return {
    kind: 'manager',
    teamId,
    season: 1,
    round: 0,
    league: team.league,
    clubs,
    schedule: fixtures(clubs),
    table: emptyTable(clubs),
    budget: Math.round(teamById(teamId)!.rating ** 2 * 3.2),
    wageBudget: Math.round(team.players.reduce((a, p) => a + p.wage, 0) * 1.15),
    squad: team.players.map((p) => ({ ...p, morale: 70 })),
    formation: team.formation,
    tactic: team.tactic,
    objective: Math.min(clubs.length, rank + 1 + (rank < 2 ? 0 : 1)),
    scouts: [],
    prospects: [],
    news: [`ברוכים הבאים ל${team.name}! הדירקטוריון מצפה לסיים במקום ${Math.min(clubs.length, rank + 1 + (rank < 2 ? 0 : 1))} ומעלה.`],
    trophies: [],
    boardHappy: 70,
    board: rank < 2 ? 'title' : rank < 5 ? 'budget' : 'youth',
    others,
  };
}
export function careerTeamData(c: Career): TeamData {
  const base = teamById(c.teamId)!;
  const fit = c.squad.filter((p) => !(p.injuredRounds && p.injuredRounds > 0) && !(p.suspended && p.suspended > 0));
  const t: TeamData = { ...base, players: (fit.length >= 14 ? fit : c.squad).map((p) => moraleAdjusted(p)), formation: c.formation, tactic: c.tactic };
  t.rating = teamRating(t);
  return t;
}
export function otherTeamData(c: Career, id: string): TeamData {
  const base = teamById(id)!;
  const t: TeamData = { ...base, players: c.others[id] ?? base.players };
  t.rating = teamRating(t);
  return t;
}
function moraleAdjusted(p: CareerPlayer): PlayerData {
  const k = (p.morale - 60) / 20; // -3 .. +2
  const s = { ...p.stats };
  for (const key of Object.keys(s) as (keyof typeof s)[]) s[key] = Math.max(20, Math.min(99, Math.round(s[key] + k)));
  return { ...p, stats: s };
}
export function careerFitness(c: Career): Record<string, number> {
  return Object.fromEntries(c.squad.map((p) => [p.id, p.fitness ?? 100]));
}
// Contract talks: the selling club and the player's agent each have demands.
export interface Offer {
  fee: number;
  wage: number;
  releaseClause: number;
  bonus: number;
  sellOn: number; // % of a future sale
}
export function askingPrice(c: Career, p: PlayerData) {
  const strong = p.ovr > careerTeamData(c).rating ? 1.15 : 1;
  return Math.round(p.value * 1.15 * strong);
}
export function wageDemand(c: Career, p: PlayerData) {
  const pull = careerTeamData(c).rating < p.ovr ? 1.35 : 1.15;
  return Math.max(1, Math.round(p.wage * pull));
}
export function negotiate(c: Career, p: PlayerData & { askClub: string }, o: Offer): { ok: boolean; msg: string } {
  const ask = askingPrice(c, p);
  const clubValue = o.fee + (o.sellOn / 100) * p.value * 0.6;
  if (clubValue < ask * 0.93) return { ok: false, msg: `המועדון דוחה: הם מבקשים כ-${ask.toLocaleString()}K (אחוז ממכירה עתידית מוסיף ערך).` };
  const demand = wageDemand(c, p);
  if (o.wage + o.bonus / 30 < demand) return { ok: false, msg: `הסוכן דורש שכר של ${demand}K לשבוע (או מענק חתימה גדול יותר).` };
  if (o.releaseClause > 0 && o.releaseClause < p.value * 1.3) return { ok: false, msg: 'המועדון שלך לא יכול לקבוע סעיף שחרור נמוך משווי השחקן ×1.3.' };
  if (o.releaseClause > p.value * 4) return { ok: false, msg: 'הסוכן מסרב לסעיף שחרור גבוה כל כך – הוא רוצה פתח ליציאה.' };
  if (o.fee + o.bonus > c.budget) return { ok: false, msg: 'אין מספיק תקציב (דמי העברה + מענק חתימה).' };
  if (wageBill(c) + o.wage > c.wageBudget) return { ok: false, msg: 'חריגה מתקציב השכר.' };
  const err = buyPlayer(c, { ...p, wage: o.wage }, o.fee);
  if (err) return { ok: false, msg: err };
  c.budget -= o.bonus;
  const signed = c.squad[c.squad.length - 1];
  signed.contract = { releaseClause: o.releaseClause, sellOn: o.sellOn, bonus: o.bonus };
  return { ok: true, msg: `${p.name} חתם! ${o.fee.toLocaleString()}K, ${o.wage}K לשבוע${o.releaseClause ? `, סעיף שחרור ${o.releaseClause.toLocaleString()}K` : ''}.` };
}
export function wageBill(c: Career) {
  return c.squad.reduce((a, p) => a + p.wage, 0);
}
export function transferList(c: Career): (PlayerData & { askClub: string })[] {
  const out: (PlayerData & { askClub: string })[] = [];
  for (const [club, list] of Object.entries(c.others)) for (const p of list) out.push({ ...p, askClub: club });
  for (const t of allTeams()) if (t.league !== c.league) for (const p of t.players) out.push({ ...p, askClub: t.id });
  return out.sort((a, b) => b.ovr - a.ovr);
}
export function buyPlayer(c: Career, p: PlayerData & { askClub: string }, fee: number): string | null {
  if (c.transferBan) return 'המועדון תחת איסור רכש (פייר-פליי פיננסי) עד שהתקציב יחזור לאיזון';
  if (fee > c.budget) return 'אין מספיק תקציב העברות';
  if (wageBill(c) + p.wage > c.wageBudget) return 'חריגה מתקציב השכר';
  if (c.squad.length >= 28) return 'הסגל מלא (28 שחקנים)';
  c.budget -= fee;
  if (c.others[p.askClub]) c.others[p.askClub] = c.others[p.askClub].filter((q) => q.id !== p.id);
  const used = new Set(c.squad.map((q) => q.num));
  let num = p.num;
  while (used.has(num)) num++;
  const { askClub: _drop, ...data } = p;
  void _drop;
  c.squad.push({ ...data, num, clubId: c.teamId, morale: 80 });
  c.news.unshift(`הוחתם: ${p.name} (${p.role}, ${p.ovr}) תמורת ${fee}K`);
  return null;
}
export function sellPlayer(c: Career, id: string): number {
  const p = c.squad.find((q) => q.id === id);
  if (!p || c.squad.length <= 16) return 0;
  const fee = Math.round(p.value * (0.85 + Math.random() * 0.3));
  c.squad = c.squad.filter((q) => q.id !== id);
  c.budget += fee;
  const buyer = Object.keys(c.others)[Math.floor(Math.random() * Object.keys(c.others).length)];
  if (buyer) c.others[buyer].push({ ...p, clubId: buyer });
  c.news.unshift(`נמכר: ${p.name} תמורת ${fee}K`);
  return fee;
}
export function startScout(c: Career, region: string, pos?: Pos, maxAge = 23) {
  if (c.scouts.length >= 2) return 'כבר יש שני סקאוטים בשטח';
  if (c.budget < 150) return 'אין תקציב לסקאוטינג';
  c.budget -= 150;
  const nations = REGIONS[region] ?? [region];
  c.scouts.push({ nation: nations[0], region, pos, maxAge, left: 2 });
  return null;
}
export function advanceScouts(c: Career) {
  for (const s of c.scouts) {
    s.left--;
    if (s.left <= 0) {
      const r = rng(Date.now() % 100000);
      const all: { role: string; pos: Pos }[] = [{ role: 'ST', pos: 'FWD' }, { role: 'LW', pos: 'FWD' }, { role: 'RW', pos: 'FWD' }, { role: 'CM', pos: 'MID' }, { role: 'CAM', pos: 'MID' }, { role: 'CDM', pos: 'MID' }, { role: 'CB', pos: 'DEF' }, { role: 'LB', pos: 'DEF' }, { role: 'GK', pos: 'GK' }];
      const roles = s.pos ? all.filter((x) => x.pos === s.pos) : all.filter((x) => x.pos !== 'GK');
      const nations = (s.region && REGIONS[s.region]) || [s.nation];
      const maxAge = s.maxAge ?? 23;
      let kids = 0;
      for (let i = 0; i < 3; i++) {
        const rp = roles[Math.floor(r() * roles.length)];
        const nation = nations[Math.floor(r() * nations.length)];
        const wonder = r() < 0.18;
        const p = makePlayer(r, { clubId: 'free', league: 'סקאוטינג', nation, role: rp.role, pos: rp.pos, base: (wonder ? 64 : 58) + Math.floor(r() * 9), num: 30 + i, idx: Date.now() % 1e6 + i });
        p.age = Math.min(maxAge, 16 + Math.floor(r() * Math.max(1, maxAge - 15)));
        p.potential = wonder ? 88 + Math.floor(r() * 8) : Math.min(90, p.ovr + 8 + Math.floor(r() * 16));
        p.value = Math.round(p.value * (wonder ? 1.6 : 0.8));
        if (wonder) kids++;
        c.prospects.push({ ...p, id: `scout-${Date.now()}-${i}`, morale: 85, scouted: true, wonderkid: wonder });
      }
      c.news.unshift(`הסקאוט ב${s.region ?? s.nation} מצא 3 כישרונות${kids ? ` – כולל ${kids} ילד פלא!` : '.'}`);
    }
  }
  c.scouts = c.scouts.filter((s) => s.left > 0);
}
// Appeal a red card at the disciplinary committee.
export function appealRed(c: Career): string {
  const a = c.appeal;
  if (!a) return '';
  c.appeal = null;
  const p = c.squad.find((x) => x.id === a.id);
  if (!p) return '';
  if (Math.random() < 0.35) {
    p.suspended = 0;
    c.news.unshift(`הערעור התקבל! ההרחקה של ${p.name} בוטלה.`);
    return 'הערעור התקבל – השחקן כשיר למשחק הבא.';
  }
  c.budget -= 20;
  c.news.unshift(`הערעור על הכרטיס של ${p.name} נדחה (קנס 20K).`);
  return 'הערעור נדחה, וגם קיבלתם קנס של 20K.';
}

// Off-pitch trouble: a player turns up late after a night out.
export function rollScandal(c: Career): { id: string; text: string } | null {
  if (Math.random() > 0.08) return null;
  const stars = [...c.squad].sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  const p = stars[Math.floor(Math.random() * stars.length)];
  const texts = [`${p.name} צולם במועדון לילה בשלוש בבוקר ואיחר לאימון.`, `${p.name} לא הופיע לאימון הבוקר וכבה את הטלפון.`, `${p.name} התווכח בפומבי עם הקפטן על בעיטות חופשיות.`];
  return { id: p.id, text: texts[Math.floor(Math.random() * texts.length)] };
}
export function resolveScandal(c: Career, id: string, choice: 'fine' | 'suspend' | 'ignore') {
  const p = c.squad.find((x) => x.id === id);
  if (!p) return;
  if (choice === 'fine') {
    p.morale = Math.max(20, p.morale - 8);
    c.boardHappy = Math.min(100, c.boardHappy + 2);
    c.budget += 30;
    c.news.unshift(`${p.name} נקנס. ההנהלה מרוצה מהמשמעת.`);
  } else if (choice === 'suspend') {
    p.morale = Math.max(20, p.morale - 15);
    p.suspended = Math.max(p.suspended ?? 0, 1);
    c.news.unshift(`${p.name} הושעה למשחק אחד.`);
  } else {
    for (const q of c.squad) q.morale = Math.max(20, q.morale - 3);
    c.news.unshift(`התעלמת מהמקרה של ${p.name} – בחדר ההלבשה לא מרוצים.`);
  }
}

// Mind games: the rival manager tries to get under your skin before a big game.
export const MIND_GAMES = [
  { q: 'מאמן היריבה: "הם עוד לא מוכנים לרמה הזאת. נראה אותם מתמודדים עם הלחץ."', answers: [{ t: 'נענה על המגרש.', morale: 4 }, { t: 'אנחנו מכבדים אותם, נלך משחק-משחק.', morale: 1 }, { t: 'הוא כנראה מפחד מאיתנו.', morale: -2 }] },
  { q: 'מאמן היריבה: "השופט צריך לשים לב לכל הצלילות של השחקנים שלכם."', answers: [{ t: 'לא נגרר לזה. נתמקד בכדורגל.', morale: 3 }, { t: 'הוא מחפש תירוצים מראש.', morale: 2 }, { t: 'אנחנו נגיש תלונה להתאחדות!', morale: -3 }] },
];
export function applyMindGame(c: Career, qi: number, ai: number) {
  const m = MIND_GAMES[qi].answers[ai].morale;
  for (const p of c.squad) p.morale = Math.max(20, Math.min(100, p.morale + m));
}

export const PRESS_QUESTIONS: { q: string; answers: { t: string; morale: number; board: number }[] }[] = [
  { q: 'איך אתה מסכם את המשחק היום?', answers: [{ t: 'אני גאה בשחקנים, הם נתנו הכול.', morale: 4, board: 0 }, { t: 'זה לא מספיק טוב, נצטרך להשתפר.', morale: -3, board: 2 }, { t: 'אין לי מה להוסיף.', morale: 0, board: -1 }] },
  { q: 'יש שמועות על החתמה גדולה בחלון הקרוב. תגובה?', answers: [{ t: 'אנחנו תמיד מחפשים לחזק את הסגל.', morale: -1, board: 2 }, { t: 'אני סומך לגמרי על השחקנים שלי.', morale: 4, board: -1 }, { t: 'לא מתייחס לשמועות.', morale: 0, board: 0 }] },
  { q: 'האוהדים מצפים לאליפות. זה ריאלי?', answers: [{ t: 'בהחלט, אנחנו הולכים על הכול!', morale: 3, board: 3 }, { t: 'נלך משחק-משחק.', morale: 1, board: 0 }, { t: 'הציפיות מוגזמות.', morale: -2, board: -2 }] },
];
export function pressConference(c: Career, ai: number, qi: number) {
  const a = PRESS_QUESTIONS[qi].answers[ai];
  for (const p of c.squad) p.morale = Math.max(20, Math.min(100, p.morale + a.morale));
  c.boardHappy = Math.max(0, Math.min(100, c.boardHappy + a.board));
}
export function afterCareerMatch(c: Career, myGoals: number, oppGoals: number, playedIds: string[], r: MatchResult | null = null): string[] {
  const win = myGoals > oppGoals;
  const draw = myGoals === oppGoals;
  const notes: string[] = [];
  const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
  for (const p of c.squad) {
    const st = r?.playerStats[p.id];
    const played = st ? st.minutes > 0.5 : playedIds.includes(p.id);
    let m = (win ? 4 : draw ? 0 : -4) + (played ? 2 : -2);
    if (st) {
      // individual moments shape a player's mood for the next games
      m += st.goals * 4 - st.yellow * 5 - (st.red ? 12 : 0) - st.ownGoals * 10;
      if (st.subOff !== null && st.subOff < 60 && !st.injury) m -= 6;
      if (st.ownGoals) notes.push(`${p.name} מתקשה להתאושש מהשער העצמי.`);
      if (st.injury) {
        const inj = INJURIES[st.injury];
        if (inj.rounds > 0) {
          p.injuredRounds = inj.rounds;
          p.injuryName = inj.name;
          notes.push(`${p.name} פצוע: ${inj.name} (${inj.rounds} מחזורים).`);
        }
      }
    }
    p.morale = clamp100(Math.max(20, p.morale + m));
    // fitness: playing costs energy; three games in a row leave a player 30% down
    const mins = st ? st.minutes : played ? 90 : 0;
    p.fitness = clamp100((p.fitness ?? 100) - (mins / 90) * 26 + (played ? 6 : 18));
  }
  for (const p of c.squad) if (p.injuredRounds && p.injuredRounds > 0 && !r?.playerStats[p.id]?.injury) p.injuredRounds--;
  // suspensions: served by sitting this one out; a red card today means a ban for the next match
  c.appeal = null;
  for (const p of c.squad) {
    const st = r?.playerStats[p.id];
    if (p.suspended && p.suspended > 0 && !st?.red) p.suspended--;
    if (st?.red) {
      p.suspended = 1;
      c.appeal = { id: p.id, name: p.name };
      notes.push(`${p.name} מורחק למשחק הבא בעקבות הכרטיס האדום.`);
    }
  }
  // financial fair play: overspending brings a transfer ban and a points deduction
  if (c.budget < 0) {
    c.transferBan = true;
    if (c.ffpSeason !== c.season) {
      c.ffpSeason = c.season;
      const row = c.table.find((x) => x.id === c.teamId);
      if (row) row.pts -= 3;
      notes.push('הפרת כללי הפייר-פליי הפיננסי: הורדת 3 נקודות ואיסור רכש.');
    }
  } else c.transferBan = false;
  let delta = win ? 3 : draw ? 0 : -4;
  if (c.board === 'title') delta += win ? 0 : draw ? -2 : -3;
  if (c.board === 'budget' && (wageBill(c) > c.wageBudget || c.budget < 0)) delta -= 4;
  if (c.board === 'youth') delta += c.squad.some((p) => p.age <= 21 && playedIds.includes(p.id)) ? 2 : -3;
  c.boardHappy = clamp100(c.boardHappy + delta);
  if (c.boardHappy <= 12 && c.round >= 4) {
    c.fired = true;
    notes.push('הדירקטוריון החליט לפטר אותך.');
  }
  advanceScouts(c);
  c.news.unshift(...notes);
  return notes;
}
// Simulates the rest of the round's fixtures (all except the user's).
export function simulateRound(c: Career, skip: string) {
  const round = c.schedule[c.round];
  for (const [a, b] of round) {
    if (a === skip || b === skip) continue;
    const [ga, gb] = simulate(otherTeamData(c, a).rating, otherTeamData(c, b).rating);
    applyResult(c.table, a, b, ga, gb);
  }
}
export function endSeason(c: Career): string {
  const pos = sortTable(c.table).findIndex((r) => r.id === c.teamId) + 1;
  const champ = pos === 1;
  if (champ) c.trophies.push(`אליפות ${c.league} – עונה ${c.season}`);
  const msg = champ ? 'אלופים!!! הדירקטוריון בעננים.' : pos <= c.objective ? `סיום במקום ${pos} – עמדת ביעד.` : `סיום במקום ${pos} – מתחת ליעד (${c.objective}).`;
  c.boardHappy = Math.max(0, Math.min(100, c.boardHappy + (pos <= c.objective ? 15 : -20)));
  // development: young players grow, old players decline
  for (const p of c.squad) {
    p.age++;
    const delta = p.age < 24 ? Math.min(p.potential - p.ovr, 2 + Math.floor(Math.random() * 4)) : p.age > 31 ? -(1 + Math.floor(Math.random() * 3)) : Math.floor(Math.random() * 3) - 1;
    for (const k of Object.keys(p.stats) as (keyof typeof p.stats)[]) p.stats[k] = Math.max(25, Math.min(97, p.stats[k] + delta));
    p.ovr = computeOvr(p.stats, p.pos);
  }
  c.budget += 4000 + (c.clubs.length - pos) * 1500;
  c.season++;
  c.round = 0;
  c.table = emptyTable(c.clubs);
  c.schedule = fixtures(c.clubs);
  c.news.unshift(msg);
  return msg;
}

// ---------------- player career ----------------
export interface PCareer {
  kind: 'player';
  player: PlayerData;
  teamId: string;
  season: number;
  round: number;
  clubs: string[];
  schedule: [string, string][][];
  table: Row[];
  xp: number;
  points: number;
  money: number;
  salary: number;
  goals: number;
  assists: number;
  apps: number;
  ratings: number[];
  objective: { kind: 'goal' | 'rating' | 'passes' | 'shots'; n: number; text: string } | null;
  owned: string[];
  offers: { teamId: string; salary: number }[];
  news: string[];
}
export const LIFESTYLE: { id: string; name: string; price: number; icon: string }[] = [
  { id: 'watch', name: 'שעון יוקרה', price: 40, icon: '⌚' },
  { id: 'car', name: 'מכונית ספורט', price: 300, icon: '🏎️' },
  { id: 'apartment', name: 'דירת גג בתל אביב', price: 1200, icon: '🏙️' },
  { id: 'villa', name: 'וילה עם בריכה', price: 4000, icon: '🏡' },
  { id: 'yacht', name: 'יאכטה', price: 9000, icon: '🛥️' },
  { id: 'jet', name: 'מטוס פרטי', price: 25000, icon: '✈️' },
];
export function newPlayerCareer(name: string, role: string, pos: Pos, nation: string, look: { skin: number; hair: number; hairColor: number; boots: number; foot: 'R' | 'L'; height: number }): PCareer {
  const teams = allTeams();
  const weak = [...teams].sort((a, b) => a.rating - b.rating).slice(0, 4);
  const team = weak[Math.floor(Math.random() * weak.length)];
  const r = rng(Date.now() % 99999);
  const p = makePlayer(r, { clubId: team.id, league: team.league, nation, role, pos, base: 62, num: 19, idx: 99 });
  Object.assign(p, look, { id: 'me', name, age: 18, weight: look.height - 106, potential: 95 });
  p.ovr = computeOvr(p.stats, pos);
  const clubs = teams.filter((t) => t.league === team.league).map((t) => t.id);
  const c: PCareer = {
    kind: 'player', player: p, teamId: team.id, season: 1, round: 0, clubs, schedule: fixtures(clubs), table: emptyTable(clubs),
    xp: 0, points: 0, money: 50, salary: 8, goals: 0, assists: 0, apps: 0, ratings: [], objective: null, owned: [], offers: [],
    news: [`חתמת על חוזה ראשון ב${team.name}! המאמן מצפה לראות אותך מתאמן קשה.`],
  };
  c.objective = newObjective(c);
  return c;
}
export function newObjective(c: PCareer): PCareer['objective'] {
  const pos = c.player.pos;
  const opts: PCareer['objective'][] = pos === 'FWD'
    ? [{ kind: 'goal', n: 1, text: 'כבוש שער' }, { kind: 'shots', n: 3, text: '3 בעיטות למסגרת' }, { kind: 'rating', n: 7, text: 'דירוג 7.0 ומעלה' }]
    : pos === 'MID'
      ? [{ kind: 'passes', n: 8, text: '8 מסירות מוצלחות' }, { kind: 'rating', n: 7, text: 'דירוג 7.0 ומעלה' }, { kind: 'shots', n: 1, text: 'בעיטה אחת למסגרת' }]
      : [{ kind: 'rating', n: 7, text: 'דירוג 7.0 ומעלה' }, { kind: 'passes', n: 6, text: '6 מסירות מוצלחות' }];
  return opts[Math.floor(Math.random() * opts.length)];
}
export function pTeamData(c: PCareer): TeamData {
  const base = teamById(c.teamId)!;
  const list = base.players.filter((p) => !(p.role === c.player.role && p.pos === c.player.pos)).slice(0, 18);
  const t: TeamData = { ...base, players: [{ ...c.player, clubId: base.id }, ...list] };
  t.rating = teamRating(t);
  return t;
}
export function pCareerXI(c: PCareer, t: TeamData): PlayerData[] {
  // the player always starts; slot him into the best matching position
  const xi = pickEleven(t.players.filter((p) => p.id !== 'me'), t.formation);
  const slots = FORMATIONS[t.formation];
  let idx = slots.findIndex((s) => s.role === c.player.role);
  if (idx < 0) idx = slots.findIndex((s) => s.pos === c.player.pos);
  if (idx < 0) idx = 10;
  xi[idx] = t.players.find((p) => p.id === 'me')!;
  return xi;
}
export function afterPlayerMatch(c: PCareer, rating: number, st: { goals: number; assists: number; passOk: number; onTarget: number }) {
  c.apps++;
  c.goals += st.goals;
  c.assists += st.assists;
  c.ratings.push(rating);
  let done = false;
  const o = c.objective;
  if (o) {
    if (o.kind === 'goal') done = st.goals >= o.n;
    if (o.kind === 'rating') done = rating >= o.n;
    if (o.kind === 'passes') done = st.passOk >= o.n;
    if (o.kind === 'shots') done = st.onTarget >= o.n;
  }
  const xp = Math.round(rating * 20 + st.goals * 60 + st.assists * 40 + (done ? 120 : 0));
  c.xp += xp;
  while (c.xp >= 250) {
    c.xp -= 250;
    c.points += 3;
  }
  c.money += c.salary;
  c.objective = newObjective(c);
  // transfer interest
  if (c.player.ovr > teamById(c.teamId)!.rating + 2 && Math.random() < 0.4) {
    const better = allTeams().filter((t) => t.rating > teamById(c.teamId)!.rating && t.rating < c.player.ovr + 8 && t.id !== c.teamId);
    if (better.length) {
      const t = better[Math.floor(Math.random() * better.length)];
      if (!c.offers.find((x) => x.teamId === t.id)) c.offers.push({ teamId: t.id, salary: Math.round(c.salary * 1.6 + c.player.ovr) });
    }
  }
  return { done, xp };
}
export function spendPoint(c: PCareer, key: keyof PlayerData['stats']) {
  if (c.points <= 0 || c.player.stats[key] >= 97) return;
  c.points--;
  c.player.stats[key]++;
  c.player.ovr = computeOvr(c.player.stats, c.player.pos);
}

// ---------------- Ultimate Team ----------------
export interface UTCard {
  uid: string;
  pid: string; // player id in the database
  rare: boolean;
}
export interface UT {
  coins: number;
  club: UTCard[];
  squad: (string | null)[]; // uid per formation slot
  formation: string;
  name: string;
  division: number; // 10 .. 1
  points: number; // this division
  played: number;
  champions: { wins: number; played: number } | null;
  market: { uid: string; pid: string; rare: boolean; price: number; until: number }[];
  listed: { uid: string; price: number; at: number }[];
  log: string[];
}
export function newUT(): UT {
  const ut: UT = { coins: 5000, club: [], squad: Array(11).fill(null), formation: '4-3-3', name: 'החלומות שלי', division: 10, points: 0, played: 0, champions: null, market: [], listed: [], log: ['קיבלת 5,000 מטבעות ומארז פתיחה!'] };
  openPack(ut, 'starter');
  autoSquad(ut);
  refreshMarket(ut);
  return ut;
}
export function playerIndex(): Map<string, PlayerData> {
  const m = new Map<string, PlayerData>();
  for (const t of allTeams()) for (const p of t.players) m.set(p.id, p);
  return m;
}
export const PACKS = {
  bronze: { name: 'מארז ארד', price: 750, n: 5, min: 0, max: 64, rareP: 0.1 },
  silver: { name: 'מארז כסף', price: 2500, n: 6, min: 65, max: 74, rareP: 0.15 },
  gold: { name: 'מארז זהב', price: 7500, n: 8, min: 75, max: 99, rareP: 0.12 },
  starter: { name: 'מארז פתיחה', price: 0, n: 23, min: 0, max: 80, rareP: 0.05 },
} as const;
export type PackId = keyof typeof PACKS;
export function cardOvr(p: PlayerData, rare: boolean) {
  return p.ovr + (rare ? 3 : 0);
}
export function openPack(ut: UT, id: PackId): UTCard[] {
  const pk = PACKS[id];
  if (ut.coins < pk.price) return [];
  ut.coins -= pk.price;
  const pool = [...playerIndex().values()].filter((p) => p.ovr >= pk.min && p.ovr <= pk.max);
  const out: UTCard[] = [];
  const need: Pos[] = id === 'starter' ? ['GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'FWD'] : [];
  for (let i = 0; i < pk.n; i++) {
    const want = need[i];
    const cand = want ? pool.filter((p) => p.pos === want) : pool;
    // higher ratings are rarer
    let p = cand[Math.floor(Math.random() * cand.length)];
    for (let k = 0; k < 2; k++) {
      const q = cand[Math.floor(Math.random() * cand.length)];
      if (q.ovr < p.ovr) p = q;
    }
    if (id === 'gold' && Math.random() < 0.25) p = cand.reduce((a, b) => (Math.random() < 0.1 && b.ovr > a.ovr ? b : a), p);
    const c: UTCard = { uid: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, pid: p.id, rare: Math.random() < pk.rareP };
    out.push(c);
    ut.club.push(c);
  }
  return out.sort((a, b) => cardOvr(playerIndex().get(b.pid)!, b.rare) - cardOvr(playerIndex().get(a.pid)!, a.rare));
}
export function cardValue(p: PlayerData, rare: boolean) {
  const o = cardOvr(p, rare);
  return Math.round((o < 65 ? 150 + (o - 50) * 20 : o < 75 ? 500 + (o - 65) * 120 : 1800 + Math.pow(o - 74, 2.2) * 160) / 50) * 50;
}
export function refreshMarket(ut: UT) {
  const idx = [...playerIndex().values()];
  const now = Date.now();
  ut.market = ut.market.filter((m) => m.until > now);
  while (ut.market.length < 24) {
    const p = idx[Math.floor(Math.random() * idx.length)];
    const rare = Math.random() < 0.1;
    const price = Math.round((cardValue(p, rare) * (0.8 + Math.random() * 0.6)) / 50) * 50;
    ut.market.push({ uid: `m-${now}-${Math.random().toString(36).slice(2, 7)}`, pid: p.id, rare, price, until: now + (5 + Math.random() * 40) * 60000 });
  }
  // AI buyers pick up fairly priced listings
  const idx2 = playerIndex();
  for (const l of [...ut.listed]) {
    const card = ut.club.find((c) => c.uid === l.uid);
    if (!card) continue;
    const v = cardValue(idx2.get(card.pid)!, card.rare);
    const age = (now - l.at) / 60000;
    if (age > 1 && Math.random() < clamp01(1.4 - l.price / v) * Math.min(1, age / 3)) {
      ut.coins += Math.round(l.price * 0.95);
      ut.club = ut.club.filter((c) => c.uid !== l.uid);
      ut.squad = ut.squad.map((s) => (s === l.uid ? null : s));
      ut.listed = ut.listed.filter((x) => x.uid !== l.uid);
      ut.log.unshift(`נמכר בשוק: ${idx2.get(card.pid)!.name} ב-${l.price} מטבעות (5% עמלה)`);
    }
  }
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export function autoSquad(ut: UT) {
  const idx = playerIndex();
  const slots = FORMATIONS[ut.formation];
  const used = new Set<string>();
  ut.squad = slots.map((s) => {
    const cands = ut.club.filter((c) => !used.has(c.uid) && idx.get(c.pid)!.pos === s.pos && !ut.listed.find((l) => l.uid === c.uid));
    cands.sort((a, b) => cardOvr(idx.get(b.pid)!, b.rare) + (idx.get(b.pid)!.role === s.role ? 3 : 0) - cardOvr(idx.get(a.pid)!, a.rare) - (idx.get(a.pid)!.role === s.role ? 3 : 0));
    const c = cands[0];
    if (c) used.add(c.uid);
    return c?.uid ?? null;
  });
}
// Chemistry 0..3 per player from shared club / league / nation counts (and playing in position).
export function chemistry(ut: UT): { per: number[]; total: number } {
  const idx = playerIndex();
  const slots = FORMATIONS[ut.formation];
  const cards = ut.squad.map((u) => (u ? ut.club.find((c) => c.uid === u) : undefined));
  const ps = cards.map((c) => (c ? idx.get(c.pid) : undefined));
  const count = (f: (p: PlayerData) => string) => {
    const m = new Map<string, number>();
    ps.forEach((p, i) => p && p.pos === slots[i].pos && m.set(f(p), (m.get(f(p)) ?? 0) + 1));
    return m;
  };
  const clubs = count((p) => p.clubId);
  const leagues = count((p) => p.league);
  const nations = count((p) => p.nation);
  const per = ps.map((p, i) => {
    if (!p || p.pos !== slots[i].pos) return 0;
    const c = clubs.get(p.clubId)!;
    const l = leagues.get(p.league)!;
    const n = nations.get(p.nation)!;
    const pts = (c >= 7 ? 3 : c >= 5 ? 2 : c >= 2 ? 1 : 0) + (l >= 8 ? 3 : l >= 5 ? 2 : l >= 3 ? 1 : 0) + (n >= 8 ? 3 : n >= 5 ? 2 : n >= 2 ? 1 : 0);
    return Math.min(3, pts);
  });
  return { per, total: per.reduce((a, b) => a + b, 0) };
}
export function utTeamData(ut: UT, kit: Kit): { team: TeamData; xi: PlayerData[] } | null {
  const idx = playerIndex();
  const chem = chemistry(ut);
  const xi: PlayerData[] = [];
  for (let i = 0; i < 11; i++) {
    const u = ut.squad[i];
    const c = u ? ut.club.find((x) => x.uid === u) : null;
    if (!c) return null;
    const p = idx.get(c.pid)!;
    const boost = chem.per[i] * 1.5 + (c.rare ? 3 : 0) - (chem.per[i] === 0 ? 4 : 0);
    const s = { ...p.stats };
    for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] = Math.max(20, Math.min(99, Math.round(s[k] + boost)));
    xi.push({ ...p, id: `ut-${c.uid}`, stats: s, num: i === 0 ? 1 : i + 1, clubId: 'ut' });
  }
  const bench = ut.club.filter((c) => !ut.squad.includes(c.uid)).slice(0, 7).map((c, i) => ({ ...idx.get(c.pid)!, id: `ut-${c.uid}`, num: 12 + i, clubId: 'ut' }));
  const team: TeamData = {
    id: 'ut', name: ut.name, short: 'UT', league: 'אולטימייט', home: kit, away: { ...kit, shirt: '#f5f5f5', number: '#111' },
    gkKit: { shirt: '#22c55e', sleeve: '#15803d', shorts: '#111', socks: '#22c55e', number: '#111' },
    players: [...xi, ...bench], formation: ut.formation, tactic: 'balanced', rating: 0, stadium: 'אצטדיון החלומות',
  };
  team.rating = Math.round(xi.reduce((a, p) => a + p.ovr, 0) / 11);
  return { team, xi };
}
export function utOpponent(ut: UT, champions: boolean): TeamData {
  const target = champions ? 84 : 60 + (10 - ut.division) * 2.6;
  const idx = [...playerIndex().values()];
  const r = Math.random;
  const slots = FORMATIONS['4-3-3'];
  const xi = slots.map((s) => {
    const cands = idx.filter((p) => p.pos === s.pos && Math.abs(p.ovr - target) < 6);
    return cands[Math.floor(r() * cands.length)] ?? idx.find((p) => p.pos === s.pos)!;
  });
  const names = ['פ.צ. רשת', 'אריות האונליין', 'קבוצת החבר\'ה', 'מכבי פיקסל', 'הפועל אלגוריתם', 'סגל החלומות', 'כוכבי הסלון', 'אתלטיקו וויי-פיי'];
  const t = allTeams()[Math.floor(r() * allTeams().length)];
  const team: TeamData = {
    ...t, id: 'utopp', name: champions ? 'אלוף השבוע' : names[Math.floor(r() * names.length)], short: 'OPP',
    players: xi.map((p, i) => ({ ...p, id: `opp-${i}-${p.id}`, num: i === 0 ? 1 : i + 1 })), formation: '4-3-3', tactic: (['balanced', 'gegenpress', 'tikitaka', 'counter'] as TacticId[])[Math.floor(r() * 4)],
  };
  team.rating = Math.round(xi.reduce((a, p) => a + p.ovr, 0) / 11);
  return team;
}
export function utAfterMatch(ut: UT, gf: number, ga: number, champions: boolean): string {
  const win = gf > ga;
  const draw = gf === ga;
  let coins = 200 + gf * 50 + (win ? 400 : draw ? 150 : 0);
  let msg: string;
  if (champions && ut.champions) {
    ut.champions.played++;
    if (win) ut.champions.wins++;
    coins += win ? 1500 : 0;
    msg = `אלופים: ${ut.champions.wins} ניצחונות מתוך ${ut.champions.played}`;
    if (ut.champions.played >= 5) {
      const bonus = ut.champions.wins * 2500;
      coins += bonus;
      msg += ` · סוף הסבב! בונוס ${bonus} מטבעות`;
      ut.champions = null;
    }
  } else {
    ut.played++;
    ut.points += win ? 3 : draw ? 1 : 0;
    msg = `ליגת יריבויות: ${ut.points} נק' בדרג ${ut.division}`;
    if (ut.points >= 7) {
      ut.division = Math.max(1, ut.division - 1);
      ut.points = 0;
      ut.played = 0;
      coins += 2000;
      msg = `עלית לדרג ${ut.division}! +2000 מטבעות`;
    } else if (ut.played >= 5) {
      if (ut.points < 4 && ut.division < 10) {
        ut.division++;
        msg = `ירדת לדרג ${ut.division}`;
      } else msg = `נשארת בדרג ${ut.division}`;
      ut.points = 0;
      ut.played = 0;
    }
  }
  ut.coins += coins;
  ut.log.unshift(`${win ? 'ניצחון' : draw ? 'תיקו' : 'הפסד'} ${gf}-${ga} · +${coins} מטבעות`);
  return `${msg} · +${coins} מטבעות`;
}

export { LEAGUES, NATIONS };

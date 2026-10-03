import * as THREE from 'three';
import type { Game } from './game';
import type { Crime } from './police';
import { clamp, fmtMoney, pick, rand } from './util';
import { streetName } from './world';

// ---------------------------------------------------------------------------
// Living economy. The exchange reacts to what the player does in the world
// (blow up an airline's planes and its rival gains), owned businesses pay
// passive income and unlock side missions, and the radio reports it all.
// ---------------------------------------------------------------------------

export interface Company {
  sym: string;
  name: string;
  sector: string;
  price: number;
  history: number[];
  vol: number;
  drift: number;
  /** Pending shock, applied gradually: fraction per tick and ticks left. */
  shock: number;
  shockTicks: number;
}

const RIVAL: Record<string, string> = { SKYN: 'AERX', AERX: 'SKYN', VRTX: 'FURI', FURI: 'VRTX' };

export class Market {
  companies: Company[] = [
    { sym: 'SKYN', name: 'SkyNova Airlines', sector: 'תעופה', price: 84, history: [], vol: 0.006, drift: 0.0002, shock: 0, shockTicks: 0 },
    { sym: 'AERX', name: 'Aerolux Air', sector: 'תעופה', price: 61, history: [], vol: 0.006, drift: 0.0002, shock: 0, shockTicks: 0 },
    { sym: 'VRTX', name: 'Vortex Motors', sector: 'רכב', price: 132, history: [], vol: 0.005, drift: 0.0001, shock: 0, shockTicks: 0 },
    { sym: 'FURI', name: 'Furia Automobili', sector: 'רכב יוקרה', price: 410, history: [], vol: 0.008, drift: 0.0002, shock: 0, shockTicks: 0 },
    { sym: 'IRON', name: 'Ironclad Arms', sector: 'נשק', price: 57, history: [], vol: 0.007, drift: 0, shock: 0, shockTicks: 0 },
    { sym: 'SHLD', name: 'Shield Insurance', sector: 'ביטוח', price: 98, history: [], vol: 0.004, drift: 0.0002, shock: 0, shockTicks: 0 },
    { sym: 'PULS', name: 'Pulse Telecom', sector: 'תקשורת', price: 44, history: [], vol: 0.006, drift: 0.0001, shock: 0, shockTicks: 0 },
    { sym: 'OMGA', name: 'Omega Construction', sector: 'נדל"ן', price: 23, history: [], vol: 0.009, drift: 0.0003, shock: 0, shockTicks: 0 },
  ];
  shares: Record<string, number> = {};
  costBasis: Record<string, number> = {};
  private nextTick = 0;

  constructor(private g: Game) {
    for (const c of this.companies) for (let i = 0; i < 40; i++) this.step(c);
    g.bus.on('vehicleDestroyed', ({ v, by }) => {
      if (!v.company) return;
      const big = v.isAir;
      this.shockCo(v.company, big ? -0.24 : -0.015, big ? 6 : 2);
      const rival = RIVAL[v.company];
      if (rival) this.shockCo(rival, big ? 0.15 : 0.008, big ? 8 : 2);
      if (big) this.shockCo('SHLD', -0.05, 4);
      if (big && by?.isPlayer) g.news.say(`מבזק: מטוס של ${this.co(v.company).name} הושמד בנמל התעופה. המניה בצניחה, המתחרה ${this.co(rival!).name} מזנקת.`);
    });
    g.bus.on('explosion', () => {
      this.shockCo('IRON', 0.006, 2);
      this.shockCo('SHLD', -0.004, 2);
    });
    g.bus.on('death', () => this.shockCo('IRON', 0.002, 1));
  }

  co(sym: string) {
    return this.companies.find((c) => c.sym === sym)!;
  }

  shockCo(sym: string, frac: number, ticks: number) {
    const c = this.co(sym);
    c.shock += frac / ticks;
    c.shockTicks = Math.max(c.shockTicks, ticks);
  }

  private step(c: Company) {
    let r = c.drift + (Math.random() - 0.5) * 2 * c.vol;
    if (c.shockTicks > 0) {
      r += c.shock;
      if (--c.shockTicks === 0) c.shock = 0;
    }
    if (c.sym === 'IRON') r += this.g.police?.stars ? this.g.police.stars * 0.001 : 0;
    c.price = Math.max(1, c.price * (1 + r));
    c.history.push(c.price);
    if (c.history.length > 60) c.history.shift();
  }

  update() {
    if (this.g.time < this.nextTick) return;
    this.nextTick = this.g.time + 6;
    for (const c of this.companies) this.step(c);
  }

  buy(sym: string, n: number) {
    const c = this.co(sym);
    const cost = c.price * n * 1.002;
    if (this.g.money < cost) return false;
    this.g.money -= cost;
    const had = this.shares[sym] ?? 0;
    this.costBasis[sym] = ((this.costBasis[sym] ?? 0) * had + c.price * n) / (had + n);
    this.shares[sym] = had + n;
    return true;
  }

  sell(sym: string, n: number) {
    const have = this.shares[sym] ?? 0;
    n = Math.min(n, have);
    if (!n) return false;
    this.g.money += this.co(sym).price * n * 0.998;
    this.shares[sym] = have - n;
    return true;
  }

  portfolioValue() {
    return this.companies.reduce((s, c) => s + (this.shares[c.sym] ?? 0) * c.price, 0);
  }
}

export interface Business {
  id: string;
  name: string;
  price: number;
  weekly: number;
  owned: boolean;
  mission: string;
}

export interface MissionStep {
  x: number;
  z: number;
  label: string;
  needVehicle?: boolean;
  hot?: number;
}

export interface Mission {
  title: string;
  steps: MissionStep[];
  step: number;
  until: number;
  reward: number;
  from: string;
}

export class Businesses {
  list: Business[] = [
    { id: 'club', name: 'מועדון לילה "נאון"', price: 250000, weekly: 42000, owned: false, mission: 'הברחת סחורה למועדון' },
    { id: 'taxi', name: 'חברת מוניות "צהוב"', price: 120000, weekly: 15000, owned: false, mission: 'נסיעת מונית' },
    { id: 'build', name: 'אתר בנייה', price: 400000, weekly: 56000, owned: false, mission: 'משלוח חומרי בניין' },
    { id: 'carwash', name: 'שטיפת מכוניות', price: 80000, weekly: 9500, owned: false, mission: 'הלבנת כספים' },
    { id: 'ammo', name: 'חנות הנשק (בעלות)', price: 180000, weekly: 24000, owned: false, mission: 'משלוח נשק חם' },
  ];
  mission: Mission | null = null;
  beacon: THREE.Mesh;
  private lastDay = 0;

  constructor(private g: Game) {
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    this.beacon.visible = false;
    g.scene.add(this.beacon);
  }

  byId(id: string) {
    return this.list.find((b) => b.id === id);
  }

  buy(id: string) {
    const b = this.byId(id)!;
    if (b.owned || this.g.money < b.price) return false;
    this.g.money -= b.price;
    b.owned = true;
    this.g.news.say(`כלכלה: איש עסקים אלמוני רכש את ${b.name}. גורמים בעירייה מסרבים להגיב.`);
    if (id === 'build') this.g.market.shockCo('OMGA', 0.08, 4);
    return true;
  }

  weeklyIncome() {
    return this.list.filter((b) => b.owned).reduce((s, b) => s + b.weekly, 0);
  }

  startMission(id: string) {
    const g = this.g;
    const place = (pid: string) => g.world.places.find((p) => p.id === pid)!;
    const docks = place('docks');
    const here = place(id);
    let m: Mission;
    switch (id) {
      case 'club':
        m = { title: 'הברחת סחורה למועדון', steps: [{ ...docks, label: 'אסוף את הארגזים ברציף' }, { ...here, label: 'הבא את הסחורה למועדון' }], step: 0, until: g.time + 300, reward: 9000, from: id };
        break;
      case 'taxi': {
        const a = g.world.randomSidewalk(g.player.ped, 220), b = g.world.randomSidewalk(undefined);
        m = { title: 'נסיעת מונית', steps: [{ ...a, label: `אסוף נוסע ב${streetName(a.x, a.z)}`, needVehicle: true }, { ...b, label: `הורד את הנוסע ב${streetName(b.x, b.z)}`, needVehicle: true }], step: 0, until: g.time + 240, reward: Math.round(600 + Math.hypot(a.x - b.x, a.z - b.z) * 9), from: id };
        break;
      }
      case 'build':
        m = { title: 'משלוח חומרי בניין', steps: [{ x: -420, z: 0, label: 'אסוף משלוח בנמל התעופה', needVehicle: true }, { ...here, label: 'הבא לאתר הבנייה', needVehicle: true }], step: 0, until: g.time + 360, reward: 14000, from: id };
        break;
      case 'carwash':
        m = { title: 'הלבנת כספים', steps: [{ ...place('club'), label: 'אסוף את תיק הכסף מהמועדון' }, { ...here, label: 'הבא לשטיפת המכוניות' }], step: 0, until: g.time + 240, reward: 7000, from: id };
        break;
      default:
        m = { title: 'משלוח נשק חם', steps: [{ ...docks, label: 'אסוף את משלוח הנשק ברציף', hot: 2 }, { ...here, label: 'הבא לחנות, המשטרה במעקב' }], step: 0, until: g.time + 300, reward: 18000, from: id };
    }
    this.mission = m;
    g.hud.toast(`משימה: ${m.title}`, 3);
    g.audio.missionStart();
  }

  update() {
    const g = this.g;
    // Passive income: a seventh of the weekly take every game day.
    const day = Math.floor(g.env.days);
    if (day > this.lastDay) {
      this.lastDay = day;
      const inc = Math.round(this.weeklyIncome() / 7);
      if (inc) {
        g.money += inc;
        g.hud.toast(`הכנסה יומית מעסקים: ${fmtMoney(inc)}`, 3);
      }
    }
    const m = this.mission;
    if (!m) {
      this.beacon.visible = false;
      return;
    }
    const s = m.steps[m.step];
    this.beacon.visible = true;
    this.beacon.position.set(s.x, 30, s.z);
    if (g.time > m.until) {
      g.hud.toast('המשימה נכשלה: נגמר הזמן', 3);
      this.mission = null;
      return;
    }
    const pl = g.player.ped;
    if (Math.hypot(pl.x - s.x, pl.z - s.z) < 6) {
      if (s.needVehicle && !pl.vehicle) {
        g.hud.toast('צריך רכב למשימה הזו', 1);
        return;
      }
      if (m.step === m.steps.length - 1 && g.police.stars > 0) {
        g.hud.toast('התחמק מהמשטרה לפני המסירה', 1);
        return;
      }
      if (s.hot) {
        g.police.commitCrime('shooting', pl.x, pl.z, true);
      }
      m.step++;
      g.audio.checkpoint();
      if (m.step >= m.steps.length) {
        g.money += m.reward;
        g.hud.toast(`המשימה הושלמה! +${fmtMoney(m.reward)}`, 4);
        g.audio.missionPassed();
        this.mission = null;
      }
    }
  }
}

/** News bulletins that react to the world. Shown on the ticker and read on the radio. */
export class News {
  private queue: { at: number; text: string }[] = [];
  private lastCrime = -99;
  private nextFiller = 60;

  constructor(private g: Game) {
    g.bus.on('vehicleDestroyed', ({ v, by }) => {
      if (by?.isPlayer && (v.role === 'military' || v.role === 'air-support')) this.later(`חדשות: דיווחים על השמדת כלי רכב צבאי ב${streetName(v.x, v.z)}. הצבא מגביר כוחות.`, 6);
    });
  }

  say(text: string) {
    this.g.hud.ticker(text, 'news');
    this.g.audio.speak(text);
  }

  later(text: string, delay: number) {
    this.queue.push({ at: this.g.time + delay, text });
  }

  crime(c: Crime, x: number, z: number, stars: number) {
    if (this.g.time - this.lastCrime < 25) return;
    this.lastCrime = this.g.time;
    const where = streetName(x, z);
    const lines: Partial<Record<Crime, string>> = {
      shooting: `חדשות: עדי ראייה מדווחים על ירי ב${where}. המשטרה קוראת לתושבים להישאר בבתים.`,
      murder: `חדשות: אדם נרצח ב${where}. החשוד נמלט.`,
      killCop: `חדשות: שוטר נהרג בתקרית ב${where}. מצוד רחב בעיר.`,
      explosion: `חדשות: פיצוץ עז נשמע ב${where}. כוחות הצלה בדרך.`,
      carjack: `חדשות: חטיפת רכב באור יום ב${where}.`,
    };
    const t = lines[c];
    if (t) this.later(t, rand(6, 12));
    if (stars >= 5) this.later('מבזק: ראש העיר הכריז על מצב צבאי. טנקים ברחובות פורט אומגה.', 4);
  }

  update() {
    const now = this.g.time;
    for (const q of this.queue) if (q.at <= now) this.say(q.text);
    this.queue = this.queue.filter((q) => q.at > now);
    if (now > this.nextFiller) {
      this.nextFiller = now + rand(70, 110);
      const m = this.g.market;
      const top = [...m.companies].sort((a, b) => b.history[b.history.length - 1] / b.history[0] - a.history[a.history.length - 1] / a.history[0])[0];
      const env = this.g.env;
      this.say(pick([
        `כלכלה: מניית ${top.name} מובילה את הבורסה היום.`,
        `מזג אוויר: ${env.forecast()}`,
        `תנועה: עומסים כבדים ב${pick(['שדרות המרכז', 'דרך הצפון', 'רחוב הנמל'])}. מומלץ להשתמש במנהרת הגבעה.`,
        `עירייה: הבנייה במגדל אומגה מתקדמת, ${Math.round(this.g.world.constructionBox.h)} מטרים כבר נבנו.`,
        `ספורט: קבוצת הכדורגל של פורט אומגה ניצחה אמש ${Math.floor(rand(1, 4))}:0.`,
      ]));
    }
    void clamp;
  }
}

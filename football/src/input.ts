// One controller model for keyboard, gamepads and touch. Buttons use console names:
// A pass, B shoot / tackle, X lob / slide, Y through ball, LB switch / close control,
// RB teammate press / finesse, LT jockey, RT sprint, START pause; the right stick
// (arrow keys) does skill moves, player switching and set-piece spin.

export type Btn = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'START' | 'R3' | 'RUP' | 'RDOWN' | 'RLEFT' | 'RRIGHT' | 'SUB';
const BTNS: Btn[] = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'START', 'R3', 'RUP', 'RDOWN', 'RLEFT', 'RRIGHT', 'SUB'];

export interface Pad {
  // left stick in screen space: x right, y up (away from the camera)
  mx: number;
  my: number;
  rx: number;
  ry: number;
  held: Record<Btn, boolean>;
  pressed: Set<Btn>;
  released: Set<Btn>;
  active: boolean; // any input this session
}

const newPad = (): Pad => ({
  mx: 0, my: 0, rx: 0, ry: 0,
  held: Object.fromEntries(BTNS.map((b) => [b, false])) as Record<Btn, boolean>,
  pressed: new Set(),
  released: new Set(),
  active: false,
});

export const KEYMAP: Record<string, Btn> = {
  // Face buttons as a Switch-style diamond on the Hebrew layout:
  // ל (K) top = lob / switch, ם (O) left = shield / jockey, ף (;) right = shoot / tackle,
  // ך (L) bottom = pass / teammate press. ן (I) = through ball.
  KeyL: 'A', Semicolon: 'B', KeyK: 'X', KeyO: 'LT', KeyI: 'Y',
  KeyQ: 'LB', KeyE: 'RB', KeyC: 'LT', ShiftLeft: 'RT', ShiftRight: 'RT',
  Escape: 'START', KeyP: 'START', KeyR: 'R3', KeyT: 'SUB',
  ArrowUp: 'RUP', ArrowDown: 'RDOWN', ArrowLeft: 'RLEFT', ArrowRight: 'RRIGHT',
  Space: 'B', Enter: 'A',
};

// On-screen key names for the face buttons (Hebrew letter + the Latin key under it).
export const KEY_LABEL: Record<'A' | 'B' | 'X' | 'Y', string> = { A: 'ך', B: 'ף', X: 'ל', Y: 'ן' };
export const kbd = (b: 'A' | 'B' | 'X' | 'Y') => `<kbd>${KEY_LABEL[b]}</kbd>`;

export const CONTROL_HELP: { keys: string; pad: string; attack: string; defend: string }[] = [
  { keys: 'W A S D', pad: 'סטיק שמאלי', attack: 'תנועה (עוצמת ההטיה: הליכה/ריצה)', defend: 'תנועה' },
  { keys: 'Shift', pad: 'RT / ZR', attack: 'ספרינט (פחות שליטה בכדור)', defend: 'ספרינט' },
  { keys: 'ף (;) / רווח', pad: 'ימני (A בסוויץ\')', attack: 'בעיטה: לחיצה קצרה = שטוחה, ארוכה = עוצמה. ↑+ף בננה (טריבלה), ↓+ף פצצה ללא סיבוב. לחיצה שנייה ברגע הפגיעה = סיום מתוזמן', defend: 'תיקול עומד · עם חצים: עבירות (ראה למטה)' },
  { keys: 'ך (L)', pad: 'תחתון (B בסוויץ\')', attack: 'מסירה שטוחה (החזקה = עוצמה ומרחק)', defend: 'לחץ של חבר קבוצה (החזקה)' },
  { keys: 'ל (K)', pad: 'עליון (X בסוויץ\')', attack: 'הגבהה / חילוף אגף / הרמה לרחבה', defend: 'החלפת שחקן' },
  { keys: 'ם (O) / C', pad: 'שמאלי (Y בסוויץ\') / ZL', attack: 'הגנה על הכדור עם הגב · זריקת חוץ מהירה', defend: 'ג\'וקי – שמירה מוכפפת מול התוקף' },
  { keys: 'ן (I)', pad: 'L3', attack: 'מסירת עומק', defend: '—' },
  { keys: 'Q / E', pad: 'L / R', attack: 'Q+ף צ\'יפ · E+ף פינס · Q כדרור צמוד', defend: 'Q החלפה · E לחץ חבר' },
  { keys: '← ↑ → ↓', pad: 'סטיק ימני', attack: 'מהלכי כדרור (בהקשה): ← → הטעיה, ↑ דחיקה, ↓ משיכה לאחור, R רולטה', defend: 'בשילוב ף: עבירות' },
  { keys: 'עכבר', pad: '', attack: 'תזוזה מהירה = מהלך כדרור · קליק שמאלי = כיוון מדויק לבעיטה/מסירה · קליק ימני = הטעיית בעיטה / הקפצה מעל המגן', defend: 'קליק שמאלי = כיוון' },
  { keys: 'T', pad: '', attack: 'חילוף מהיר (העייף ביותר יוצא) בעצירה הבאה', defend: '' },
  { keys: 'Esc / P', pad: 'Start / +', attack: 'השהיה, טקטיקה, חילופים ומצלמה', defend: '' },
];

export const FOUL_HELP: [string, string][] = [
  ['← או → + ף', 'משיכה בחולצה – מאט מתפרצת (סיכון לצהוב)'],
  ['↓ + החזקת ף', 'גלישה מכסחת מאחור – כמעט תמיד אדום'],
  ['↑ + ←/→ + ף', 'מכת כתף – מפיל את היריב'],
  ['↓ + ↑ + ף', 'הכשלה – ברחבה זה פנדל, ובמצב של שער בטוח גם אדום'],
  ['↓ ↓ (פעמיים) + ף', 'גלישת חסימה – נגד בעיטה; מאוחרת מדי = עבירה'],
];

export class Input {
  private keys = new Set<string>();
  private pads: Pad[] = [newPad(), newPad()];
  private prevHeld: Record<Btn, boolean>[] = [newPad().held, newPad().held];
  private touch = { mx: 0, my: 0, held: new Set<Btn>() };
  private touchEl: HTMLElement | null = null;
  splitGamepad = false; // gamepad 1 drives pad 1 (local two-player)
  enabled = true;
  // mouse (player 1): motion for skill moves, left click to aim, right click to fake / flick
  mouseDX = 0;
  mouseDY = 0;
  mouseSpeed = 0;
  leftClick: { x: number; y: number } | null = null;
  rightClick = false;
  private mdx = 0;
  private mdy = 0;
  private lc: { x: number; y: number } | null = null;
  private rc = false;
  private lastPoll = performance.now();

  constructor() {
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (KEYMAP[e.code] || /^Key[WASD]$/.test(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousemove', (e) => {
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    });
    addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement)?.id !== 'view') return;
      if (e.button === 0) this.lc = { x: e.clientX, y: e.clientY };
      if (e.button === 2) this.rc = true;
    });
    addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement)?.id === 'view') e.preventDefault();
    });
    addEventListener('blur', () => this.keys.clear());
  }

  pad(i: number): Pad {
    return this.pads[i];
  }

  // Call once per rendered frame.
  poll() {
    const now = performance.now();
    const dt = Math.max(1, now - this.lastPoll) / 1000;
    this.lastPoll = now;
    this.mouseDX = this.mdx;
    this.mouseDY = this.mdy;
    this.mouseSpeed = Math.hypot(this.mdx, this.mdy) / dt;
    this.mdx = this.mdy = 0;
    this.leftClick = this.lc;
    this.rightClick = this.rc;
    this.lc = null;
    this.rc = false;
    for (let i = 0; i < 2; i++) {
      const p = this.pads[i];
      this.prevHeld[i] = { ...p.held };
      p.mx = p.my = p.rx = p.ry = 0;
      for (const b of BTNS) p.held[b] = false;
    }
    const p0 = this.pads[0];
    const k = this.keys;
    p0.mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    p0.my = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    for (const code of k) {
      const b = KEYMAP[code];
      if (b) p0.held[b] = true;
    }
    p0.rx = (p0.held.RRIGHT ? 1 : 0) - (p0.held.RLEFT ? 1 : 0);
    p0.ry = (p0.held.RUP ? 1 : 0) - (p0.held.RDOWN ? 1 : 0);
    // touch
    if (this.touch.mx || this.touch.my) {
      p0.mx = this.touch.mx;
      p0.my = this.touch.my;
    }
    for (const b of this.touch.held) p0.held[b] = true;

    // gamepads
    const gps = navigator.getGamepads?.() ?? [];
    let gi = 0;
    for (const gp of gps) {
      if (!gp || !gp.connected) continue;
      // two-player: keyboard is player 1, gamepads drive player 2
      const target = this.pads[this.splitGamepad ? 1 : 0];
      gi++;
      const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
      const lx = dz(gp.axes[0] ?? 0);
      const ly = dz(gp.axes[1] ?? 0);
      if (lx || ly) {
        target.mx = lx;
        target.my = -ly;
      }
      const b = (n: number) => !!gp.buttons[n]?.pressed || (gp.buttons[n]?.value ?? 0) > 0.4;
      if (b(12)) target.my = 1;
      if (b(13)) target.my = -1;
      if (b(14)) target.mx = -1;
      if (b(15)) target.mx = 1;
      const rx = dz(gp.axes[2] ?? 0);
      const ry = -dz(gp.axes[3] ?? 0);
      if (rx || ry) {
        target.rx = rx;
        target.ry = ry;
      }
      // positional, like the keyboard diamond: bottom pass, right shoot, top lob, left shield
      const map: [number, Btn][] = [[0, 'A'], [1, 'B'], [3, 'X'], [2, 'LT'], [10, 'Y'], [4, 'LB'], [5, 'RB'], [6, 'LT'], [7, 'RT'], [9, 'START'], [11, 'R3']];
      for (const [n, btn] of map) if (b(n)) target.held[btn] = true;
      if (target.rx > 0.6) target.held.RRIGHT = true;
      if (target.rx < -0.6) target.held.RLEFT = true;
      if (target.ry > 0.6) target.held.RUP = true;
      if (target.ry < -0.6) target.held.RDOWN = true;
    }

    for (let i = 0; i < 2; i++) {
      const p = this.pads[i];
      p.pressed.clear();
      p.released.clear();
      for (const b of BTNS) {
        if (p.held[b] && !this.prevHeld[i][b]) p.pressed.add(b);
        if (!p.held[b] && this.prevHeld[i][b]) p.released.add(b);
      }
      const len = Math.hypot(p.mx, p.my);
      if (len > 1) {
        p.mx /= len;
        p.my /= len;
      }
      if (len > 0 || p.pressed.size) p.active = true;
    }
  }

  // Menus use the same input: returns 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' edges.
  menuEdges(): string[] {
    const out: string[] = [];
    const p = this.pads[0];
    if (p.pressed.has('A')) out.push('ok');
    if (p.pressed.has('START') || p.pressed.has('X')) out.push('back');
    return out;
  }

  // ---------------- touch overlay ----------------
  showTouch(show: boolean) {
    if (!show) {
      this.touchEl?.remove();
      this.touchEl = null;
      this.touch.mx = this.touch.my = 0;
      this.touch.held.clear();
      return;
    }
    if (this.touchEl) return;
    const el = document.createElement('div');
    el.className = 'touch';
    el.innerHTML = `
      <div class="stick"><div class="knob"></div></div>
      <div class="tbtns">
        <button data-b="RT" class="tb rt">ספרינט</button>
        <button data-b="Y" class="tb lt">עומק</button>
        <button data-b="LB" class="tb lb">צמוד</button>
        <button data-b="RB" class="tb rb">פינס</button>
        <button data-b="X" class="tb y">ל<br>הגבהה</button>
        <button data-b="LT" class="tb x">ם<br>מגן</button>
        <button data-b="B" class="tb b">ף<br>בעיטה</button>
        <button data-b="A" class="tb a">ך<br>מסירה</button>
      </div>
      <button data-b="START" class="tb start">❚❚</button>`;
    document.body.appendChild(el);
    this.touchEl = el;
    const stick = el.querySelector('.stick') as HTMLElement;
    const knob = el.querySelector('.knob') as HTMLElement;
    let sid: number | null = null;
    let cx = 0;
    let cy = 0;
    const move = (x: number, y: number) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = 50;
      const len = Math.hypot(dx, dy);
      const k = len > r ? r / len : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      this.touch.mx = (dx * k) / r;
      this.touch.my = -(dy * k) / r;
    };
    stick.addEventListener('pointerdown', (e) => {
      sid = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      move(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === sid) move(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== sid) return;
      sid = null;
      knob.style.transform = '';
      this.touch.mx = this.touch.my = 0;
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    el.querySelectorAll<HTMLElement>('[data-b]').forEach((b) => {
      const btn = b.dataset.b as Btn;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.touch.held.add(btn);
        b.classList.add('on');
      });
      const up = () => {
        this.touch.held.delete(btn);
        b.classList.remove('on');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }
}

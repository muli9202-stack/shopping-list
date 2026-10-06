// One controller model for keyboard, gamepads and touch. Buttons use console names:
// A pass, B shoot / tackle, X lob / slide, Y through ball, LB switch / close control,
// RB teammate press / finesse, LT jockey, RT sprint, START pause; the right stick
// (arrow keys) does skill moves, player switching and set-piece spin.

export type Btn = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'START' | 'R3' | 'RUP' | 'RDOWN' | 'RLEFT' | 'RRIGHT';
const BTNS: Btn[] = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'START', 'R3', 'RUP', 'RDOWN', 'RLEFT', 'RRIGHT'];

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
  KeyJ: 'A', KeyL: 'B', KeyK: 'X', KeyI: 'Y',
  KeyQ: 'LB', KeyE: 'RB', KeyC: 'LT', ShiftLeft: 'RT', ShiftRight: 'RT',
  Escape: 'START', KeyP: 'START', KeyR: 'R3',
  ArrowUp: 'RUP', ArrowDown: 'RDOWN', ArrowLeft: 'RLEFT', ArrowRight: 'RRIGHT',
  Space: 'B', Enter: 'A',
};

export const CONTROL_HELP: { keys: string; pad: string; attack: string; defend: string }[] = [
  { keys: 'W A S D', pad: 'סטיק שמאלי', attack: 'תנועה (עוצמת ההטיה: הליכה/ריצה)', defend: 'תנועה' },
  { keys: 'Shift', pad: 'RT / R2', attack: 'ספרינט (פחות שליטה בכדור)', defend: 'ספרינט' },
  { keys: 'J', pad: 'A / ✕', attack: 'מסירה קצרה (החזקה = עוצמה)', defend: 'לחץ על מחזיק הכדור (החזקה)' },
  { keys: 'K', pad: 'X / ▢', attack: 'הגבהה / חילוף אגף / הרמה לרחבה', defend: 'תיקול גלישה' },
  { keys: 'I', pad: 'Y / △', attack: 'מסירת עומק', defend: '—' },
  { keys: 'L / רווח', pad: 'B / ○', attack: 'בעיטה (החזקה = עוצמה, לחיצה שנייה ברגע הפגיעה = סיום מתוזמן) / נגיחה', defend: 'תיקול עומד' },
  { keys: 'Q', pad: 'LB / L1', attack: 'כדרור צמוד (החזקה) · Q+L = צ\'יפ', defend: 'החלפת שחקן' },
  { keys: 'E', pad: 'RB / R1', attack: 'E+L = בעיטה מסובבת (Finesse)', defend: 'חבר קבוצה לוחץ (החזקה)' },
  { keys: 'C', pad: 'LT / L2', attack: 'הגנה על הכדור עם הגב', defend: 'הכלה / ג\'וקי' },
  { keys: '← ↑ → ↓', pad: 'סטיק ימני', attack: 'מהלכי כדרור: ← → הטעיה, ↑ דחיקה קדימה, ↓ משיכה לאחור, R רולטה', defend: 'החלפה לשחקן בכיוון' },
  { keys: 'Esc / P', pad: 'Start', attack: 'השהיה, טקטיקה ומצלמה', defend: '' },
];

export class Input {
  private keys = new Set<string>();
  private pads: Pad[] = [newPad(), newPad()];
  private prevHeld: Record<Btn, boolean>[] = [newPad().held, newPad().held];
  private touch = { mx: 0, my: 0, held: new Set<Btn>() };
  private touchEl: HTMLElement | null = null;
  splitGamepad = false; // gamepad 1 drives pad 1 (local two-player)
  enabled = true;

  constructor() {
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (KEYMAP[e.code] || /^Key[WASD]$/.test(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  pad(i: number): Pad {
    return this.pads[i];
  }

  // Call once per rendered frame.
  poll() {
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
      const map: [number, Btn][] = [[0, 'A'], [1, 'B'], [2, 'X'], [3, 'Y'], [4, 'LB'], [5, 'RB'], [6, 'LT'], [7, 'RT'], [9, 'START'], [11, 'R3']];
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
        <button data-b="LT" class="tb lt">ג'וקי</button>
        <button data-b="LB" class="tb lb">החלף</button>
        <button data-b="RB" class="tb rb">לחץ/פינס</button>
        <button data-b="Y" class="tb y">עומק</button>
        <button data-b="X" class="tb x">הגבהה<br>גלישה</button>
        <button data-b="B" class="tb b">בעיטה<br>תיקול</button>
        <button data-b="A" class="tb a">מסירה</button>
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

import { clamp, isTouch } from './util';

// Unified input: keyboard + mouse (pointer lock) on desktop, a virtual
// joystick, look pad and buttons on touch screens. Systems ask for "actions"
// rather than keys, so both schemes drive the same code.

export type Action =
  | 'fire' | 'aim' | 'jump' | 'sprint' | 'down' | 'enter' | 'reload' | 'interact' | 'phone' | 'ability'
  | 'switch' | 'next' | 'prev' | 'dodge' | 'crouch' | 'horn' | 'help' | 'radio' | 'weather' | 'camera' | 'map' | 'pause'
  | 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'w6' | 'w7' | 'w8' | 'w9' | 'w0';

const KEYS: Record<string, Action> = {
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'down', KeyF: 'enter', KeyR: 'reload', KeyE: 'interact',
  KeyP: 'phone', KeyT: 'ability', KeyX: 'switch', KeyQ: 'dodge', KeyC: 'crouch', KeyH: 'horn', KeyK: 'help', KeyZ: 'radio',
  KeyN: 'weather', KeyV: 'camera', KeyM: 'map', Escape: 'pause',
  Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', Digit4: 'w4', Digit5: 'w5', Digit6: 'w6', Digit7: 'w7', Digit8: 'w8', Digit9: 'w9', Digit0: 'w0',
};

export class Input {
  readonly touch = isTouch();
  moveX = 0;
  moveY = 0;
  lookDX = 0;
  lookDY = 0;
  private held = new Set<Action>();
  private once = new Set<Action>();
  private keys = new Set<string>();
  private joy = { id: -1, cx: 0, cy: 0, x: 0, y: 0 };
  private look = { id: -1, x: 0, y: 0 };
  sensitivity = 0.0024;
  enabled = true;

  constructor(canvas: HTMLElement, private overlay: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      const a = KEYS[e.code];
      if (a && !e.repeat) {
        this.held.add(a);
        this.once.add(a);
      }
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const a = KEYS[e.code];
      if (a) this.held.delete(a);
    });
    addEventListener('blur', () => {
      this.keys.clear();
      this.held.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.touch) return;
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
        return;
      }
      if (e.button === 0) this.press('fire');
      if (e.button === 2) this.press('aim');
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.held.delete('fire');
      if (e.button === 2) this.held.delete('aim');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.lookDX += e.movementX * this.sensitivity;
      this.lookDY += e.movementY * this.sensitivity;
    });
    addEventListener('wheel', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.once.add(e.deltaY > 0 ? 'next' : 'prev');
    });
    if (this.touch) this.buildTouch();
  }

  private press(a: Action) {
    this.held.add(a);
    this.once.add(a);
  }

  isHeld(a: Action) {
    return this.held.has(a);
  }

  /** True once per press. */
  pressed(a: Action) {
    if (this.once.has(a)) {
      this.once.delete(a);
      return true;
    }
    return false;
  }

  /** Call at the end of every frame. */
  endFrame() {
    this.once.clear();
    this.lookDX = 0;
    this.lookDY = 0;
  }

  update() {
    if (!this.touch || this.joy.id < 0) {
      const k = this.keys;
      this.moveX = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      this.moveY = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      if (this.touch && this.joy.id < 0) {
        this.moveX = 0;
        this.moveY = 0;
      }
    }
  }

  // ---- touch ---------------------------------------------------------------

  private buttons: HTMLElement[] = [];

  setVehicleMode(mode: 'foot' | 'car' | 'air') {
    for (const b of this.buttons) {
      const m = b.dataset.mode;
      b.style.display = !m || m.split(' ').includes(mode) ? '' : 'none';
    }
  }

  private buildTouch() {
    const o = this.overlay;
    o.classList.add('touch');
    const joyBase = document.createElement('div');
    joyBase.className = 'joy';
    const knob = document.createElement('div');
    knob.className = 'knob';
    joyBase.appendChild(knob);
    o.appendChild(joyBase);

    const zoneL = document.createElement('div');
    zoneL.className = 'zone zone-l';
    const zoneR = document.createElement('div');
    zoneR.className = 'zone zone-r';
    o.prepend(zoneL, zoneR);

    zoneL.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.joy = { id: t.identifier, cx: t.clientX, cy: t.clientY, x: 0, y: 0 };
      joyBase.style.display = 'block';
      joyBase.style.left = t.clientX - 60 + 'px';
      joyBase.style.top = t.clientY - 60 + 'px';
      knob.style.transform = 'translate(0px,0px)';
      e.preventDefault();
    }, { passive: false });
    zoneR.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });
    addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joy.id) {
          const dx = clamp(t.clientX - this.joy.cx, -55, 55), dy = clamp(t.clientY - this.joy.cy, -55, 55);
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          this.moveX = dx / 55;
          this.moveY = -dy / 55;
        } else if (t.identifier === this.look.id) {
          this.lookDX += (t.clientX - this.look.x) * 0.006;
          this.lookDY += (t.clientY - this.look.y) * 0.006;
          this.look.x = t.clientX;
          this.look.y = t.clientY;
        }
      }
    }, { passive: true });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joy.id) {
          this.joy.id = -1;
          this.moveX = this.moveY = 0;
          joyBase.style.display = 'none';
        }
        if (t.identifier === this.look.id) this.look.id = -1;
      }
    };
    addEventListener('touchend', end);
    addEventListener('touchcancel', end);

    const pad = document.createElement('div');
    pad.className = 'tpad';
    o.appendChild(pad);
    const mk = (label: string, a: Action, cls = '', mode = '') => {
      const b = document.createElement('button');
      b.className = 'tbtn ' + cls;
      b.textContent = label;
      if (mode) b.dataset.mode = mode;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.press(a);
        b.classList.add('on');
      }, { passive: false });
      b.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.held.delete(a);
        b.classList.remove('on');
      });
      pad.appendChild(b);
      this.buttons.push(b);
      return b;
    };
    mk('🔫', 'fire', 'fire', 'foot car');
    mk('🎯', 'aim', 'aim', 'foot');
    mk('⤴', 'jump', 'jump', 'foot car');
    mk('🚗', 'enter', 'enter');
    mk('↻', 'reload', 'reload', 'foot');
    mk('⇄', 'next', 'next', 'foot car');
    mk('🏃', 'sprint', 'sprint', 'foot');
    mk('⚡', 'ability', 'ability');
    mk('E', 'interact', 'interact', 'foot car');
    mk('▲', 'jump', 'up', 'air');
    mk('▼', 'sprint', 'down', 'air');
    mk('🔥', 'fire', 'afire', 'air');
    const top = document.createElement('div');
    top.className = 'ttop';
    o.appendChild(top);
    const tb = (label: string, a: Action) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.press(a);
        setTimeout(() => this.held.delete(a), 60);
      }, { passive: false });
      top.appendChild(b);
    };
    tb('📱', 'phone');
    tb('👥', 'switch');
    tb('📻', 'radio');
    tb('🌦', 'weather');
    tb('❔', 'help');
    this.setVehicleMode('foot');
  }
}

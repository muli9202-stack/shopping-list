import * as THREE from 'three';
import type { Game } from './game';
import type { Ped } from './actors';
import type { Vehicle } from './vehicles';
import { FLEET } from './vehicles';
import { WEAPONS, type Attachment } from './weapons';
import { clamp, damp, fmtMoney } from './util';
import { AIRPORT, BEACH_X, BLOCK, BOUNDS, GRID, HALF, ROAD, SEA_X, TUNNEL, blockCenter, inTunnel, roadLine } from './world';

// ---------------------------------------------------------------------------
// Cognitive HUD. Everything stays out of the way until it matters: the status
// bars only show when they change, the minimap zooms with speed, shows the
// layer you're on (tunnel = level -1), enemy vision cones and the search area.
// ---------------------------------------------------------------------------

interface MenuItem {
  label: string;
  sub?: string;
  action?: () => void;
  disabled?: boolean;
  tag?: string;
}

const ATT_NAME: Record<Attachment, string> = { suppressor: 'משתיק', flashlight: 'פנס טקטי', holo: 'כוונת הולוגרפית', scope: 'כוונת צלפים', grip: 'ידית אחיזה', laser: 'ציין לייזר' };

export class Hud {
  private root: HTMLElement;
  private map: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private els: Record<string, HTMLElement> = {};
  private bars = { hp: 0, ar: 0, shownUntil: 0, lastHp: -1, lastAr: -1 };
  private zoom = 1.6;
  private bubbles: { el: HTMLElement; ped: Ped; until: number }[] = [];
  private lasers: { from: Ped; to: { x: number; z: number; y?: number } }[] = [];
  private laserMesh: THREE.LineSegments;
  flashAmt = 0;
  private damage = 0;
  menuOpen = false;
  private phoneTab = 'stocks';
  private starPulseUntil = 0;

  constructor(private g: Game, host: HTMLElement) {
    this.root = host;
    host.insertAdjacentHTML(
      'beforeend',
      `<div class="hud">
        <div class="mm-wrap"><canvas class="mm"></canvas><div class="mm-level"></div><div class="abil"><i></i></div></div>
        <div class="tr">
          <div class="stars"></div>
          <div class="bars"><div class="bar hp"><i></i></div><div class="bar ar"><i></i></div></div>
          <div class="money"></div>
          <div class="weapon"><b></b><span></span></div>
          <div class="clock"></div>
        </div>
        <div class="area"></div>
        <div class="vstat"></div>
        <div class="ticker"></div>
        <div class="toast"></div>
        <div class="prompt"></div>
        <div class="xhair"></div>
        <div class="scope"></div>
        <div class="vignette"></div>
        <div class="flash"></div>
        <div class="big"></div>
        <div class="bubbles"></div>
        <div class="mission"></div>
        <div class="menu" hidden></div>
      </div>`,
    );
    const hud = host.lastElementChild as HTMLElement;
    const q = (c: string) => hud.querySelector('.' + c) as HTMLElement;
    for (const c of ['stars', 'money', 'weapon', 'clock', 'area', 'vstat', 'ticker', 'toast', 'prompt', 'xhair', 'scope', 'vignette', 'flash', 'big', 'bubbles', 'mission', 'menu', 'bars', 'abil', 'mm-level']) this.els[c] = q(c);
    this.map = q('mm') as HTMLCanvasElement;
    const dpr = Math.min(2, devicePixelRatio);
    this.map.width = this.map.height = 200 * dpr;
    this.mctx = this.map.getContext('2d')!;
    this.mctx.scale(dpr, dpr);
    this.els.stars.innerHTML = '<span>★</span>'.repeat(5);
    this.laserMesh = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.7 }));
    this.laserMesh.frustumCulled = false;
    g.scene.add(this.laserMesh);
  }

  // ---- notifications -------------------------------------------------------------

  private toastTimer = 0;
  toast(text: string, secs = 2) {
    const t = this.els.toast;
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('on'), secs * 1000);
  }

  ticker(text: string, kind: 'police' | 'news') {
    const el = document.createElement('div');
    el.className = 'tick ' + kind;
    el.textContent = (kind === 'police' ? '📻 ' : '📰 ') + text;
    this.els.ticker.prepend(el);
    while (this.els.ticker.children.length > 4) this.els.ticker.lastChild!.remove();
    setTimeout(() => el.classList.add('old'), 9000);
    setTimeout(() => el.remove(), 12000);
  }

  say(ped: Ped, text: string, dur: number) {
    if (this.bubbles.length > 10) return;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    this.els.bubbles.appendChild(el);
    this.bubbles.push({ el, ped, until: this.g.time + dur });
  }

  laser(from: Ped, to: { x: number; z: number }) {
    this.lasers.push({ from, to });
  }

  damageFlash(amount: number) {
    this.damage = Math.min(1, this.damage + amount / 40);
  }

  flashbang(amount: number) {
    this.flashAmt = Math.max(this.flashAmt, amount);
  }

  starPulse() {
    this.starPulseUntil = this.g.time + 2;
  }

  big(text: string, sub = '') {
    this.els.big.innerHTML = text ? `<b>${text}</b><small>${sub}</small>` : '';
    this.els.big.classList.toggle('on', !!text);
  }

  switchCinematic(name: string, mid: () => void) {
    const b = this.els.big;
    b.innerHTML = `<b>${name}</b><small>מחליף דמות…</small>`;
    b.classList.add('on', 'switch');
    setTimeout(() => {
      mid();
      setTimeout(() => b.classList.remove('on', 'switch'), 700);
    }, 900);
  }

  // ---- per frame -----------------------------------------------------------------

  update(dt: number) {
    const g = this.g, p = g.player.ped, pl = g.player;
    // Status bars appear only when values change (or when low).
    const hp = p.health / p.maxHealth, ar = p.armor / 100;
    if (Math.abs(hp - this.bars.lastHp) > 0.001 || Math.abs(ar - this.bars.lastAr) > 0.001) this.bars.shownUntil = g.time + 4;
    this.bars.lastHp = hp;
    this.bars.lastAr = ar;
    const show = g.time < this.bars.shownUntil || hp < 0.35 || this.menuOpen;
    this.els.bars.classList.toggle('on', show);
    const hpEl = this.els.bars.querySelector('.hp i') as HTMLElement;
    hpEl.style.width = clamp(hp, 0, 1) * 100 + '%';
    hpEl.style.background = `rgb(${Math.round(lerp(200, 40, hp))},${Math.round(lerp(40, 140, hp))},${Math.round(lerp(40, 60, hp))})`;
    this.els.bars.classList.toggle('crit', hp < 0.2 && p.alive);
    (this.els.bars.querySelector('.ar i') as HTMLElement).style.width = clamp(ar, 0, 1) * 100 + '%';

    // Stars flash while the police search without seeing you.
    const s = g.police.stars;
    const searching = s > 0 && g.time - g.police.lastKnownAt > 1;
    Array.from(this.els.stars.children).forEach((c, i) => {
      c.classList.toggle('lit', i < s);
      c.classList.toggle('blink', i < s && searching);
    });
    this.els.stars.classList.toggle('pulse', g.time < this.starPulseUntil);
    this.els.stars.classList.toggle('show', s > 0 || this.menuOpen);

    this.els.money.textContent = fmtMoney(g.money);
    const ws = p.weapon;
    if (ws) {
      (this.els.weapon.firstChild as HTMLElement).textContent = ws.spec.name;
      const reloading = g.time < ws.reloadUntil;
      (this.els.weapon.lastChild as HTMLElement).textContent = ws.spec.cat === 'melee' ? '' : reloading ? 'טוען…' : `${ws.ammo} / ${ws.reserve}` + (ws.spec.spinUp && ws.spin < ws.spec.spinUp && ws.spin > 0 ? ' ⟳' : '') + (pl.bipod ? ' · רגליות' : '');
    }
    this.els.clock.textContent = `${g.env.clock()} · ${pl.char.name}`;
    this.els.area.textContent = g.streetName();
    const v = p.vehicle;
    this.els.vstat.innerHTML = v ? `<b>${Math.round(v.speed * 3.6)}</b> קמ"ש${v.isAir ? ` · גובה ${Math.round(v.y)} מ'` : ''}<i style="width:${clamp(v.health / v.spec.health, 0, 1) * 100}%"></i>` : '';
    this.els.vstat.classList.toggle('on', !!v);
    const abil = this.els.abil.firstChild as HTMLElement;
    abil.style.width = pl.char.meter + '%';
    this.els.abil.classList.toggle('active', g.ability.active);

    // Crosshair / scope
    const aimingGun = !v && p.armed && (pl.aiming || g.input.isHeld('fire'));
    this.els.xhair.classList.toggle('on', aimingGun && !pl.scoped);
    this.els.scope.classList.toggle('on', pl.scoped);
    this.els.xhair.classList.toggle('hit', false);

    // Damage / low-health vignette, flashbang whiteout, slow-motion tint
    this.damage = damp(this.damage, 0, 2, dt);
    this.flashAmt = Math.max(0, this.flashAmt - dt * 0.3);
    const low = p.alive && hp < 0.2 ? 0.5 + Math.sin(g.time * 8) * 0.2 : 0;
    this.els.vignette.style.opacity = String(Math.max(this.damage, low));
    this.els.flash.style.opacity = String(Math.min(1, this.flashAmt * 1.5));
    this.root.classList.toggle('slowmo', g.ability.active && g.ability.timeScale() < 1);

    // Interaction prompt
    this.els.prompt.textContent = g.interactionHint();
    this.els.prompt.classList.toggle('on', !!this.els.prompt.textContent);

    // Mission text
    const m = g.businesses.mission;
    this.els.mission.textContent = m ? `${m.title}: ${m.steps[m.step].label} · ${Math.max(0, Math.ceil(m.until - g.time))} שנ'` : '';

    this.updateBubbles();
    this.updateLasers();
    this.drawMinimap(dt);
  }

  private updateBubbles() {
    const g = this.g, cam = g.camera;
    const w = innerWidth, h = innerHeight;
    const v = new THREE.Vector3();
    this.bubbles = this.bubbles.filter((b) => {
      if (g.time > b.until || !b.ped.alive && g.time > b.until - 1) {
        b.el.remove();
        return false;
      }
      v.set(b.ped.x, b.ped.y + 2.2, b.ped.z).project(cam);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && b.ped.model.root.visible;
      b.el.style.display = visible ? '' : 'none';
      b.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      return true;
    });
  }

  private updateLasers() {
    const pts: number[] = [];
    for (const l of this.lasers) pts.push(l.from.x, l.from.y + 1.5, l.from.z, l.to.x, 1.2, l.to.z);
    this.laserMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.lasers = [];
  }

  // ---- minimap -------------------------------------------------------------------

  private drawMinimap(dt: number) {
    const g = this.g, c = this.mctx, S = 200, R = S / 2;
    const p = g.player.ped, v = p.vehicle;
    // Smart zoom: on foot see the alleys, at speed see the junctions ahead.
    const speed = v ? v.speed : g.player.vx ** 2 + g.player.vz ** 2 > 30 ? 6 : 0;
    const targetZoom = v?.isAir ? 0.28 : clamp(1.7 - speed / 30, 0.38, 1.7);
    this.zoom = damp(this.zoom, targetZoom, 1.5, dt);
    const z = this.zoom;
    const yaw = g.player.camYaw;
    const underground = inTunnel(p.x, p.z);
    c.save();
    c.clearRect(0, 0, S, S);
    c.beginPath();
    c.ellipse(R, R, R, R * 0.92, 0, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#3d5a34';
    c.fillRect(0, 0, S, S);
    // World -> map: rotate so the camera's forward points up.
    // Screen x = world offset · camera right, screen y = -(offset · camera forward).
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    c.translate(R, R * 1.1);
    c.scale(z, z);
    c.transform(-cy, -sy, sy, -cy, 0, 0);
    c.translate(-p.x, -p.z);
    c.globalAlpha = underground ? 0.25 : 1;
    // Sea, beach, airport
    c.fillStyle = '#d9c38f';
    c.fillRect(BEACH_X, BOUNDS.minZ - 300, SEA_X - BEACH_X, BOUNDS.maxZ - BOUNDS.minZ + 600);
    c.fillStyle = '#2a6f8f';
    c.fillRect(SEA_X, BOUNDS.minZ - 300, 900, BOUNDS.maxZ - BOUNDS.minZ + 600);
    c.fillStyle = '#4a4c50';
    c.fillRect(AIRPORT.minX, AIRPORT.minZ, AIRPORT.maxX - AIRPORT.minX, AIRPORT.maxZ - AIRPORT.minZ);
    c.fillRect(-HALF - ROAD / 2, -HALF - ROAD / 2, GRID * 82 + ROAD, GRID * 82 + ROAD);
    for (let k = 0; k <= GRID; k += 2) c.fillRect(AIRPORT.maxX, roadLine(k) - ROAD / 2, -AIRPORT.maxX - HALF, ROAD);
    // Blocks
    for (let i = 0; i < GRID; i++)
      for (let j = 0; j < GRID; j++) {
        const k = g.world.kinds[i][j];
        c.fillStyle = k === 'park' ? '#4d6b3a' : k === 'construction' ? '#7b6347' : k === 'hill' ? '#3f6b2f' : '#8a8a86';
        c.fillRect(blockCenter(i) - BLOCK / 2, blockCenter(j) - BLOCK / 2, BLOCK, BLOCK);
      }
    // Buildings in light 3D: a shadow footprint plus a raised roof.
    const near = g.world.boxesIn(p.x - 260 / z, p.x + 260 / z, p.z - 260 / z, p.z + 260 / z);
    for (const b of near) {
      if (b.kind !== 'building') continue;
      const lift = Math.min(b.h * 0.06, 6) / z;
      c.fillStyle = '#4c4f55';
      c.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
      // "Up" on screen is the camera's forward direction.
      const ox = Math.sin(yaw) * lift, oz = Math.cos(yaw) * lift;
      c.fillStyle = b.h > 40 ? '#c9ccd2' : '#b0b3b8';
      c.fillRect(b.minX + ox, b.minZ + oz, b.maxX - b.minX, b.maxZ - b.minZ);
    }
    c.globalAlpha = 1;
    // Tunnel layer
    c.setLineDash(underground ? [] : [6 / z, 4 / z]);
    c.strokeStyle = underground ? '#ffe9a0' : 'rgba(255,255,255,0.5)';
    c.lineWidth = 2 / z;
    c.fillStyle = underground ? '#55575c' : 'transparent';
    c.fillRect(TUNNEL.minX, TUNNEL.minZ, TUNNEL.maxX - TUNNEL.minX, TUNNEL.maxZ - TUNNEL.minZ);
    c.strokeRect(TUNNEL.minX, TUNNEL.minZ, TUNNEL.maxX - TUNNEL.minX, TUNNEL.maxZ - TUNNEL.minZ);
    c.setLineDash([]);
    this.els['mm-level'].textContent = underground ? 'מפלס ‎-1 · מנהרה' : '';

    // Police search area
    const pol = g.police;
    if (pol.stars > 0 && g.time - pol.lastKnownAt > 1) {
      const red = Math.floor(g.time * 2) % 2;
      c.fillStyle = red ? 'rgba(255,40,40,0.1)' : 'rgba(60,90,255,0.1)';
      c.strokeStyle = red ? 'rgba(255,60,60,0.8)' : 'rgba(80,120,255,0.8)';
      c.lineWidth = 3 / z;
      c.beginPath();
      c.arc(pol.lastKnown.x, pol.lastKnown.z, pol.searchRadius(), 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    // Vision cones: grey unaware, yellow suspicious, red engaged.
    for (const u of g.peds) {
      if (!u.alive || !u.isArmedUnit || u.vehicle) continue;
      if (Math.abs(u.x - p.x) > 180 / z || Math.abs(u.z - p.z) > 180 / z) continue;
      const engaged = pol.stars > 0 && u.awareness >= 1;
      c.fillStyle = engaged ? (u.seesPlayer ? 'rgba(255,40,40,0.45)' : 'rgba(255,90,60,0.25)') : u.awareness > 0.05 ? 'rgba(255,210,40,0.45)' : 'rgba(200,200,200,0.28)';
      const r = Math.min(u.role === 'sniper' ? 120 : 45, 60);
      const half = engaged ? 1.4 : 0.95;
      c.beginPath();
      c.moveTo(u.x, u.z);
      // Map angle for heading h: direction (sin h, cos h) -> atan2(cos h, sin h)
      const a = Math.atan2(Math.cos(u.heading), Math.sin(u.heading));
      c.arc(u.x, u.z, r, a - half, a + half);
      c.closePath();
      c.fill();
      c.fillStyle = u.team === 'military' ? '#7c8f45' : '#2f6bff';
      c.beginPath();
      c.arc(u.x, u.z, 2.2 / z + 1, 0, Math.PI * 2);
      c.fill();
    }
    // Vehicles of interest
    for (const o of g.vehicles) {
      if (o === v || Math.abs(o.x - p.x) > 220 / z || Math.abs(o.z - p.z) > 220 / z) continue;
      if (o.sirenOn) c.fillStyle = Math.floor(g.time * 6) % 2 ? '#ff3030' : '#3060ff';
      else if (o.role === 'military' || o.role === 'air-support') c.fillStyle = '#9aa860';
      else if (o.isAir || o.isBoat) c.fillStyle = '#ffffff';
      else continue;
      this.blipRect(o);
    }
    // Places
    c.font = `${12 / z}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const pl of g.world.places) {
      const icon = { police: '👮', hospital: '➕', garage: '🔧', gunshop: '🔫', business: '💼', docks: '⚓', helipad: 'H', safehouse: '🏠' }[pl.kind];
      c.save();
      c.translate(pl.x, pl.z);
      c.transform(-cy, sy, -sy, -cy, 0, 0); // undo the map rotation so icons stay upright
      c.fillText(icon, 0, 0);
      c.restore();
    }
    const m = g.businesses.mission;
    if (m) {
      const st = m.steps[m.step];
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.arc(st.x, st.z, 6 / z, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // Player arrow (centre)
    c.save();
    c.translate(R, R * 1.1);
    const rel = (v ? v.heading : p.heading) - yaw;
    c.rotate(-rel);
    c.fillStyle = '#fff';
    c.strokeStyle = '#000';
    c.beginPath();
    c.moveTo(0, -8);
    c.lineTo(6, 6);
    c.lineTo(0, 3);
    c.lineTo(-6, 6);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
    // Mission / off-map direction marker on the rim
    if (m) this.rimMarker(m.steps[m.step].x, m.steps[m.step].z, '#ffd23f');
    // North
    this.rimMarker(p.x, p.z - 1000, '#fff', 'צ');
  }

  private blipRect(o: Vehicle) {
    const c = this.mctx, z = this.zoom;
    c.save();
    c.translate(o.x, o.z);
    c.rotate(-o.heading);
    const s = Math.max(3 / z, o.spec.w);
    c.fillRect(-s / 2, -Math.max(4 / z, o.spec.l) / 2, s, Math.max(4 / z, o.spec.l));
    c.restore();
  }

  private rimMarker(wx: number, wz: number, color: string, text = '') {
    const g = this.g, c = this.mctx, R = 100;
    const p = g.player.ped;
    const dx = wx - p.x, dz = wz - p.z;
    const d = Math.hypot(dx, dz);
    if (!text && d * this.zoom < R * 0.85) return;
    // Same projection as the map, normalised onto the rim.
    const cy = Math.cos(g.player.camYaw), sny = Math.sin(g.player.camYaw);
    const mx = -dx * cy + dz * sny, my = -(dx * sny + dz * cy);
    const l = Math.hypot(mx, my) || 1;
    const sx = R + (mx / l) * R * 0.86, sy = R + (my / l) * R * 0.8;
    c.fillStyle = color;
    c.beginPath();
    c.arc(sx, sy, text ? 8 : 5, 0, Math.PI * 2);
    c.fill();
    if (text) {
      c.fillStyle = '#000';
      c.font = 'bold 10px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, sx, sy);
    }
  }

  // ---- menus -------------------------------------------------------------------

  openMenu(title: string, items: MenuItem[] | (() => MenuItem[]), tabs?: { id: string; label: string }[], onTab?: (id: string) => void, activeTab?: string) {
    const el = this.els.menu;
    this.menuOpen = true;
    this.g.paused = true;
    document.body.classList.add('menu-open');
    document.exitPointerLock?.();
    const render = () => {
      const list = typeof items === 'function' ? items() : items;
      el.innerHTML = `<div class="mhead"><b>${title}</b><span>${fmtMoney(this.g.money)}</span><button class="x">✕</button></div>` +
        (tabs ? `<div class="tabs">${tabs.map((t) => `<button data-tab="${t.id}" class="${t.id === activeTab ? 'on' : ''}">${t.label}</button>`).join('')}</div>` : '') +
        `<div class="mlist">${list.map((it, i) => `<button class="mi ${it.disabled ? 'dis' : ''} ${it.action ? '' : 'info'}" data-i="${i}"><span>${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}</span>${it.tag ? `<em>${it.tag}</em>` : ''}</button>`).join('')}</div>`;
      el.querySelector('.x')!.addEventListener('click', () => this.closeMenu());
      el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => onTab?.(b.dataset.tab!)));
      el.querySelectorAll<HTMLButtonElement>('.mi').forEach((b) =>
        b.addEventListener('click', () => {
          const it = list[Number(b.dataset.i)];
          if (it.disabled || !it.action) return;
          it.action();
          if (this.menuOpen && this.els.menu.dataset.title === title) render();
        }),
      );
    };
    el.dataset.title = title;
    el.hidden = false;
    render();
  }

  closeMenu() {
    this.els.menu.hidden = true;
    this.els.menu.dataset.title = '';
    this.menuOpen = false;
    this.g.paused = false;
    document.body.classList.remove('menu-open');
  }

  phone(tab = this.phoneTab) {
    const g = this.g;
    this.phoneTab = tab;
    const tabs = [
      { id: 'stocks', label: '📈 בורסה' },
      { id: 'biz', label: '💼 עסקים' },
      { id: 'settings', label: '⚙️ הגדרות' },
      { id: 'cheats', label: '🧪 בדיקות' },
    ];
    const items = (): MenuItem[] => {
      if (tab === 'stocks') {
        const m = g.market;
        return [
          { label: `תיק השקעות: ${fmtMoney(m.portfolioValue())}`, sub: 'פעולות בעולם משפיעות על המניות: פוצצו מטוס של חברה, והמתחרה תזנק.' },
          ...m.companies.map((c) => {
            const first = c.history[0], last = c.price, ch = ((last - first) / first) * 100;
            const own = m.shares[c.sym] ?? 0;
            return {
              label: `${c.sym} · ${c.name}`,
              sub: `${c.sector} · ${last.toFixed(2)}$ ${spark(c.history)} ${own ? `· ברשותך ${own} (${fmtMoney(own * last)})` : ''}`,
              tag: `${ch >= 0 ? '▲' : '▼'} ${ch.toFixed(1)}%`,
              action: () => this.tradeMenu(c.sym),
            };
          }),
        ];
      }
      if (tab === 'biz') {
        const b = g.businesses;
        return [
          { label: `הכנסה שבועית: ${fmtMoney(b.weeklyIncome())}`, sub: 'משולמת כל יום משחק (1/7). קונים בכניסה לעסק (E), ושם גם מתחילים משימות.' },
          ...b.list.map((x) => ({ label: x.name, sub: `${x.owned ? 'בבעלותך' : 'מחיר ' + fmtMoney(x.price)} · ${fmtMoney(x.weekly)} לשבוע · משימה: ${x.mission}`, tag: x.owned ? '✓' : '' })),
        ];
      }
      if (tab === 'settings') {
        return [
          { label: `איכות גרפיקה: ${g.quality === 'high' ? 'גבוהה' : 'נמוכה'}`, sub: 'צללים, Bloom, עומק שדה. נטען מחדש.', action: () => g.setQuality(g.quality === 'high' ? 'low' : 'high') },
          { label: `קריין חדשות: ${g.audio.speech ? 'פועל' : 'כבוי'}`, sub: 'הקראת מבזקים בקול (אם הדפדפן תומך)', action: () => (g.audio.speech = !g.audio.speech) },
          { label: `קושי: ${g.difficultyName()}`, action: () => g.cycleDifficulty() },
          { label: `רגישות מצלמה: ${Math.round(g.input.sensitivity * 1e4)}`, action: () => (g.input.sensitivity = g.input.sensitivity >= 0.004 ? 0.0012 : g.input.sensitivity + 0.0006) },
          { label: '💾 שמירת משחק', sub: 'אפשר גם לישון בדירת המסתור', action: () => g.save() },
          { label: '❔ מקשים ועזרה', action: () => this.help() },
        ];
      }
      return [
        { label: '+ $100,000', action: () => (g.money += 100000) },
        { label: 'כל הנשקים + תחמושת', action: () => g.giveAll() },
        { label: 'שריון וחיים מלאים', action: () => g.heal() },
        ...[1, 2, 3, 4, 5].map((s) => ({ label: `רמת מבוקש ${'★'.repeat(s)}`, sub: ['ניידת אחת, ניסיון מעצר', '3 ניידות, ירי מהחלונות, מחסומים', 'SWAT, צלפים, מסוק עם זרקור', 'משמר לאומי, נגמ"שים, עשן ואיגוף', 'מצב צבאי: טנקים, מטוסי קרב, צניחה לגגות'][s - 1], action: () => g.setWanted(s) })),
        { label: 'ניקוי רמת מבוקש', action: () => g.police.clear('cheat') },
        { label: `משטרה ${g.cheats.noPolice ? 'כבויה' : 'פעילה'}`, action: () => (g.cheats.noPolice = !g.cheats.noPolice) },
        { label: 'מזג אוויר הבא', action: () => g.env.cycleWeather() },
        { label: 'קפיצה של 6 שעות', action: () => (g.env.minutes += 360) },
        ...FLEET.filter((f) => f.price > 0 || f.id === 'tank').map((f) => ({ label: `הזמן רכב: ${f.name}`, sub: f.cls, action: () => g.spawnVehicleNearPlayer(f.id) })),
      ];
    };
    this.openMenu('📱 טלפון', items, tabs, (t) => this.phone(t), tab);
  }

  private tradeMenu(sym: string) {
    const g = this.g, m = g.market, c = m.co(sym);
    this.openMenu(`${c.name} (${sym})`, () => {
      const own = m.shares[sym] ?? 0;
      const basis = m.costBasis[sym] ?? 0;
      return [
        { label: `מחיר: ${c.price.toFixed(2)}$`, sub: `${spark(c.history)} · ברשותך ${own}${own ? ` · רווח/הפסד ${fmtMoney((c.price - basis) * own)}` : ''}` },
        ...[10, 100, 1000].map((n) => ({ label: `קנה ${n}`, tag: fmtMoney(c.price * n), disabled: g.money < c.price * n, action: () => m.buy(sym, n) })),
        ...[10, 100].map((n) => ({ label: `מכור ${n}`, disabled: own < 1, action: () => m.sell(sym, n) })),
        { label: 'מכור הכל', disabled: own < 1, action: () => m.sell(sym, own) },
        { label: '→ חזרה לבורסה', action: () => this.phone('stocks') },
      ];
    });
  }

  gunShop() {
    const g = this.g, p = g.player.ped;
    this.openMenu('🔫 חנות נשק', () => {
      const items: MenuItem[] = [
        { label: 'שריון גוף מלא', tag: fmtMoney(800), disabled: p.armor >= 100 || g.money < 800, action: () => g.pay(800) && (p.armor = 100) },
      ];
      for (const w of WEAPONS) {
        if (!w.price) continue;
        const own = p.weapons.find((x) => x.spec.id === w.id);
        if (!own) items.push({ label: w.name, sub: w.desc, tag: fmtMoney(w.price), disabled: g.money < w.price, action: () => g.pay(w.price) && p.give(w.id) });
        else if (w.cat !== 'melee') {
          const ammoPrice = Math.round(w.price * 0.08 + 20);
          items.push({ label: `תחמושת: ${w.name}`, sub: `${own.reserve} ברזרבה`, tag: fmtMoney(ammoPrice), disabled: g.money < ammoPrice, action: () => g.pay(ammoPrice) && (own.reserve += w.mag * 3) });
          for (const a of w.attachments ?? []) {
            if (own.attachments.has(a)) continue;
            const price = a === 'scope' ? 1500 : a === 'suppressor' ? 1100 : 600;
            items.push({ label: `↳ ${ATT_NAME[a]} ל-${w.name}`, tag: fmtMoney(price), disabled: g.money < price, action: () => g.pay(price) && own.attachments.add(a) });
          }
        }
      }
      return items;
    });
  }

  garage(v: Vehicle) {
    const g = this.g;
    const colors: [string, number][] = [['אדום', 0xb31b1b], ['שחור', 0x111111], ['לבן', 0xf2f2f2], ['כחול', 0x1f4fa8], ['ירוק', 0x2e7d32], ['צהוב', 0xe7b416], ['סגול', 0x5b2a86]];
    this.openMenu(`🔧 מוסך: ${v.spec.name}`, () => {
      const m = v.mods;
      const cost = (base: number) => Math.round(base * (v.spec.price > 100000 ? 2.5 : 1));
      const repair = v.repairCost();
      return [
        { label: 'תיקון מלא', sub: `נזק: ${Math.round((1 - v.health / v.spec.health) * 100)}%${v.wheelsLost ? ` · ${v.wheelsLost} גלגלים חסרים` : ''}${v.glassBroken ? ' · שמשות מנופצות' : ''}`, tag: fmtMoney(repair), disabled: repair <= 0 || g.money < repair, action: () => g.pay(repair) && v.repair() },
        { label: `מנוע שלב ${m.engine + 1}`, sub: `האצה ומהירות מרבית +12% (כעת ${m.engine}/4)`, tag: fmtMoney(cost(4000 * (m.engine + 1))), disabled: m.engine >= 4 || g.money < cost(4000 * (m.engine + 1)), action: () => g.pay(cost(4000 * (m.engine + 1))) && m.engine++ },
        { label: `מתלים שלב ${m.suspension + 1}`, sub: 'אחיזה ויציבות, פחות התהפכויות', tag: fmtMoney(cost(2500 * (m.suspension + 1))), disabled: m.suspension >= 3 || g.money < cost(2500 * (m.suspension + 1)), action: () => g.pay(cost(2500 * (m.suspension + 1))) && m.suspension++ },
        { label: `שריון שלב ${m.armor + 1}`, sub: 'פחות נזק מירי ומהתנגשויות', tag: fmtMoney(cost(5000 * (m.armor + 1))), disabled: m.armor >= 4 || g.money < cost(5000 * (m.armor + 1)), action: () => g.pay(cost(5000 * (m.armor + 1))) && m.armor++ },
        { label: `פגוש פלדה לפריצת מחסומים ${m.ram ? '✓' : ''}`, tag: fmtMoney(3000), disabled: m.ram || g.money < 3000, action: () => g.pay(3000) && (m.ram = true) },
        ...(['road', 'offroad', 'race'] as const).map((t) => ({ label: `צמיגי ${{ road: 'כביש', offroad: 'שטח', race: 'מרוץ' }[t]} ${m.tyres === t ? '✓' : ''}`, sub: { road: 'מאוזנים', offroad: 'אחיזה בחול ובעפר', race: 'אחיזה מרבית באספלט, גרועים בשטח' }[t], tag: fmtMoney(1200), disabled: m.tyres === t || g.money < 1200, action: () => g.pay(1200) && (m.tyres = t) })),
        ...(['gloss', 'matte', 'chrome', 'pearl'] as const).map((pt) => ({ label: `גימור ${{ gloss: 'מבריק', matte: 'מט', chrome: 'כרום', pearl: 'פנינה' }[pt]} ${m.paint === pt ? '✓' : ''}`, tag: fmtMoney(pt === 'chrome' ? 5000 : 800), disabled: g.money < (pt === 'chrome' ? 5000 : 800), action: () => g.pay(pt === 'chrome' ? 5000 : 800) && ((m.paint = pt), v.applyPaint(), true) })),
        ...colors.map(([n, c]) => ({ label: `צבע: ${n}`, tag: fmtMoney(500), disabled: g.money < 500, action: () => g.pay(500) && ((m.color = c), v.applyPaint(), true) })),
      ];
    });
  }

  businessMenu(id: string) {
    const g = this.g, b = g.businesses.byId(id)!;
    this.openMenu(`💼 ${b.name}`, () => [
      { label: b.owned ? 'העסק בבעלותך' : `רכישה: ${fmtMoney(b.price)}`, sub: `הכנסה פסיבית ${fmtMoney(b.weekly)} לשבוע`, disabled: b.owned || g.money < b.price, action: b.owned ? undefined : () => g.businesses.buy(id) },
      { label: `משימה צדדית: ${b.mission}`, sub: b.owned ? 'התחל עכשיו' : 'זמין אחרי רכישה', disabled: !b.owned || !!g.businesses.mission, action: () => (g.businesses.startMission(id), this.closeMenu()) },
    ]);
  }

  help() {
    const touch = this.g.input.touch;
    this.openMenu('❔ איך משחקים', [
      { label: touch ? 'ג׳ויסטיק שמאלי: תנועה / היגוי · גרירה בצד ימין: מצלמה' : 'WASD תנועה · עכבר מצלמה (לחיצה לנעילה) · שמאלי ירי · ימני כיוון', sub: touch ? '🔫 ירי (עם נעילת מטרה) · 🎯 כיוון · ⤴ קפיצה / בלם יד · 🚗 כניסה/יציאה' : 'Space קפיצה/בלם יד/מעלה · Shift ריצה/מטה · C כריעה (רגליות לברט) · Q התחמקות' },
      { label: touch ? '⇄ החלפת נשק · ↻ טעינה · ⚡ יכולת · E פעולה' : 'F כניסה/יציאה מרכב · R טעינה · 1-0 / גלגלת נשקים · E פעולה', sub: touch ? '📱 טלפון · 👥 החלפת דמות · 📻 רדיו · 🌦 מזג אוויר' : 'T יכולת מיוחדת · X החלפת דמות · P טלפון · Z רדיו · H צופר · V מרחק מצלמה · N מזג אוויר' },
      { label: 'כוכבי מבוקש', sub: 'עבירות שנראו או נשמעו מעלות "חום". התחמקו מקו הראייה וצאו מאזור החיפוש (העיגול במפה) כדי להתחמק. המנהרה מסתירה מהמסוק.' },
      { label: 'המפה', sub: 'מתרחקת אוטומטית במהירות. חרוטי ראייה: אפור = לא מודע, צהוב = חשד, אדום = זיהוי. במנהרה רואים "מפלס ‎-1".' },
      { label: 'כלכלה', sub: 'בטלפון: בורסה ועסקים. השמדת מטוסים של חברת תעופה בנמל התעופה (מערב) מפילה את המניה שלה ומקפיצה את המתחרה.' },
      { label: 'מקומות', sub: '🔫 חנות נשק · 🔧 מוסך (להיכנס עם רכב) · 💼 עסקים למכירה · 🏠 דירת מסתור (שינה ושמירה) · ⚓ רציף: אופנוע ים ויאכטה · ✈️ שדה התעופה: מטוס ומסוק' },
    ]);
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t, 0, 1);
}

function spark(h: number[]) {
  const bars = '▁▂▃▄▅▆▇█';
  const pts = h.slice(-16);
  const lo = Math.min(...pts), hi = Math.max(...pts);
  return pts.map((v) => bars[Math.round(((v - lo) / (hi - lo || 1)) * 7)]).join('');
}

// DOM overlay for the broadcast graphics: scoreboard, banners, commentary ticker,
// power bar, radar, set-piece hints and the stats panels.

export interface HudTeam {
  short: string;
  name: string;
  color: string;
  color2: string;
}

export interface RadarDot {
  x: number;
  z: number;
  side: number;
  me: boolean;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class Hud {
  root: HTMLElement;
  private sb: HTMLElement;
  private bannerEl: HTMLElement;
  private ticker: HTMLElement;
  private playerEl: HTMLElement;
  private powerEl: HTMLElement;
  private timedEl: HTMLElement;
  private hintEl: HTMLElement;
  private radar: HTMLCanvasElement;
  private replayEl: HTMLElement;
  private panel: HTMLElement;
  private bannerTimer = 0;
  private tickerTimer = 0;
  private timedTimer = 0;
  private teams: HudTeam[] = [];

  constructor(parent: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <div class="sb"></div>
      <div class="banner"></div>
      <div class="ticker"></div>
      <div class="pl"></div>
      <div class="power"><div class="fill"></div><span></span></div>
      <div class="timed"></div>
      <div class="hint"></div>
      <canvas class="radar" width="210" height="136"></canvas>
      <div class="replay">● הילוך חוזר</div>
      <div class="panel"></div>`;
    parent.appendChild(root);
    this.root = root;
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    this.sb = q('.sb');
    this.bannerEl = q('.banner');
    this.ticker = q('.ticker');
    this.playerEl = q('.pl');
    this.powerEl = q('.power');
    this.timedEl = q('.timed');
    this.hintEl = q('.hint');
    this.radar = q('.radar') as HTMLCanvasElement;
    this.replayEl = q('.replay');
    this.panel = q('.panel');
  }

  dispose() {
    this.root.remove();
  }

  setTeams(home: HudTeam, away: HudTeam) {
    this.teams = [home, away];
  }

  setScore(h: number, a: number, clock: string, extra = '') {
    const [H, A] = this.teams;
    if (!H) return;
    this.sb.innerHTML = `
      <span class="chip" style="background:${H.color};border-color:${H.color2}"></span><b>${esc(H.short)}</b>
      <span class="sc">${h} - ${a}</span>
      <b>${esc(A.short)}</b><span class="chip" style="background:${A.color};border-color:${A.color2}"></span>
      <span class="clk">${clock}${extra ? `<i>${extra}</i>` : ''}</span>`;
  }

  banner(text: string, sub = '', kind: 'goal' | 'info' | 'yellow' | 'red' | 'big' = 'info', dur = 2.6) {
    this.bannerEl.className = `banner show ${kind}`;
    this.bannerEl.innerHTML = `<div class="t">${esc(text)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}`;
    this.bannerTimer = dur;
  }

  comment(text: string) {
    this.ticker.innerHTML = `<span>🎙️</span> ${esc(text)}`;
    this.ticker.classList.add('show');
    this.tickerTimer = 4.5;
  }

  player(name: string, num: number, stamina: number, color: string, label = '') {
    this.playerEl.style.display = 'flex';
    this.playerEl.innerHTML = `<span class="num" style="background:${color}">${num}</span><span class="nm">${esc(name)}${label ? ` <small>${esc(label)}</small>` : ''}</span><span class="st"><i style="width:${Math.round(stamina * 100)}%;background:${stamina > 0.5 ? '#4ade80' : stamina > 0.25 ? '#facc15' : '#f87171'}"></i></span>`;
  }

  hidePlayer() {
    this.playerEl.style.display = 'none';
  }

  power(show: boolean, value = 0, x = 0, y = 0, label = '', danger = 0.85) {
    if (!show) {
      this.powerEl.style.display = 'none';
      return;
    }
    this.powerEl.style.display = 'block';
    this.powerEl.style.left = `${x - 40}px`;
    this.powerEl.style.top = `${y - 34}px`;
    const fill = this.powerEl.firstElementChild as HTMLElement;
    fill.style.width = `${Math.round(value * 100)}%`;
    fill.style.background = value > danger ? '#ef4444' : value > 0.6 ? '#f59e0b' : '#22c55e';
    (this.powerEl.lastElementChild as HTMLElement).textContent = label;
  }

  timed(kind: 'green' | 'yellow' | 'red', x: number, y: number) {
    const txt = kind === 'green' ? 'מושלם!' : kind === 'yellow' ? 'תזמון בסדר' : 'תזמון גרוע';
    this.timedEl.className = `timed show ${kind}`;
    this.timedEl.textContent = txt;
    this.timedEl.style.left = `${x - 50}px`;
    this.timedEl.style.top = `${y - 70}px`;
    this.timedTimer = 1.2;
  }

  hint(text: string | null) {
    if (!text) {
      this.hintEl.style.display = 'none';
      return;
    }
    this.hintEl.style.display = 'block';
    this.hintEl.innerHTML = text;
  }

  drawRadar(dots: RadarDot[], ball: { x: number; z: number }, colors: string[]) {
    const c = this.radar;
    const g = c.getContext('2d')!;
    const W = c.width;
    const H = c.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(10,40,20,0.55)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 1;
    const px = (x: number) => ((x + 52.5) / 105) * (W - 8) + 4;
    const pz = (z: number) => ((z + 34) / 68) * (H - 8) + 4;
    g.strokeRect(4, 4, W - 8, H - 8);
    g.beginPath();
    g.moveTo(W / 2, 4);
    g.lineTo(W / 2, H - 4);
    g.stroke();
    g.beginPath();
    g.arc(W / 2, H / 2, 12, 0, Math.PI * 2);
    g.stroke();
    g.strokeRect(4, pz(-20.16), px(-36) - 4, pz(20.16) - pz(-20.16));
    g.strokeRect(px(36), pz(-20.16), W - 4 - px(36), pz(20.16) - pz(-20.16));
    for (const d of dots) {
      g.fillStyle = colors[d.side];
      g.beginPath();
      g.arc(px(d.x), pz(d.z), d.me ? 5 : 3.6, 0, Math.PI * 2);
      g.fill();
      if (d.me) {
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.stroke();
      }
    }
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(px(ball.x), pz(ball.z), 2.6, 0, Math.PI * 2);
    g.fill();
  }

  private radarOn = true;
  showRadar(v: boolean) {
    this.radarOn = v;
    this.radar.style.display = v ? 'block' : 'none';
  }
  radarHidden(h: boolean) {
    this.radar.style.display = this.radarOn && !h ? 'block' : 'none';
  }
  private panelT = 0;
  panelAge() {
    return (performance.now() - this.panelT) / 1000;
  }

  replay(on: boolean) {
    this.replayEl.style.display = on ? 'block' : 'none';
  }

  // A centred panel (lineups, half-time stats, results). Returns a promise for the button.
  showPanel(html: string, button = 'המשך', secondary?: string): Promise<'primary' | 'secondary'> {
    this.panel.innerHTML = `<div class="card">${html}<div class="row-btns"><button class="btn primary" data-k="primary">${esc(button)}</button>${secondary ? `<button class="btn" data-k="secondary">${esc(secondary)}</button>` : ''}</div></div>`;
    this.panel.classList.add('show');
    this.panelT = performance.now();
    return new Promise((res) => {
      const done = (k: 'primary' | 'secondary') => {
        this.panel.classList.remove('show');
        this.panel.innerHTML = '';
        this.panelResolve = null;
        res(k);
      };
      this.panelResolve = () => done('primary');
      this.panel.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.addEventListener('click', () => done(b.dataset.k as 'primary' | 'secondary')));
    });
  }

  panelResolve: (() => void) | null = null;

  get panelOpen() {
    return !!this.panelResolve;
  }

  update(dt: number) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('show');
    }
    if (this.tickerTimer > 0) {
      this.tickerTimer -= dt;
      if (this.tickerTimer <= 0) this.ticker.classList.remove('show');
    }
    if (this.timedTimer > 0) {
      this.timedTimer -= dt;
      if (this.timedTimer <= 0) this.timedEl.classList.remove('show');
    }
  }
}

export function statsTable(title: string, home: HudTeam, away: HudTeam, rows: [string, string | number, string | number][], extra = '') {
  return `<h2>${esc(title)}</h2>
    <div class="st-head"><span style="color:${home.color === '#ffffff' || home.color === '#fafafa' ? '#111' : home.color}">${esc(home.name)}</span><span style="color:${away.color === '#ffffff' || away.color === '#fafafa' ? '#111' : away.color}">${esc(away.name)}</span></div>
    <table class="stats">${rows.map(([l, h, a]) => `<tr><td>${h}</td><th>${esc(l)}</th><td>${a}</td></tr>`).join('')}</table>${extra}`;
}

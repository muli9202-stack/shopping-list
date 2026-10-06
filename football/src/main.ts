import '@fontsource/heebo/400.css';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import './styles.css';
import * as THREE from 'three';
import { allTeams, derbyName, FORMATIONS, LEAGUES, NATION_FLAGS, NATIONS, pickEleven, TACTICS, teamById, BOOT_COLORS, HAIR_COLORS, SKIN_TONES, type Kit, type PlayerData, type Pos, type TacticId, type TeamData } from './data';
import { Match, type MatchResult, type MatchSetup } from './match';
import { Hud } from './hud';
import { Input, CONTROL_HELP, FOUL_HELP } from './input';
import { GameAudio } from './audio';
import { Stadium, type TimeOfDay, type Weather } from './stadium';
import { PlayerModel, type PoseState } from './playerModel';
import * as M from './modes';
import { setDebugHook } from './ai';
import { esc, face, futCard, modal, stars, teamBadge, toast } from './ui';

// ---------------------------------------------------------------- engine
const canvas = document.getElementById('view') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
let settings: M.Settings = { ...M.defaultSettings(), ...M.load<Partial<M.Settings>>('fb-settings', {}) };
const saveSettings = () => M.save('fb-settings', settings);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.quality === 'high', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, settings.quality === 'high' ? 2 : 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 3000);
const input = new Input();
const audio = new GameAudio();
audio.setVolume(settings.volume);
audio.speech = settings.commentary;

// Retro broadcast: washed-out colours, soft picture, scanlines.
function applyRetro() {
  canvas.style.filter = settings.retro ? 'sepia(0.35) saturate(0.7) contrast(1.1) blur(0.6px)' : '';
  document.body.classList.toggle('retro', settings.retro);
}
applyRetro();

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 55 : 38;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
addEventListener('pointerdown', () => audio.unlock());
addEventListener('keydown', () => audio.unlock());

let match: Match | null = null;
let debugNoRender = false;
let menu: MenuStage | null = null;
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (match) match.update(dt);
  else if (menu) menu.update(dt);
  if (!debugNoRender) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// A living stadium behind the menus.
class MenuStage {
  stadium: Stadium;
  models: { m: PlayerModel; pose: PoseState; x: number; z: number; f: number; t: number }[] = [];
  ball: THREE.Mesh;
  t = 0;
  constructor() {
    const teams = allTeams();
    const a = teams[Math.floor(Math.random() * teams.length)];
    const b = teams.find((t) => t !== a)!;
    const times: TimeOfDay[] = ['day', 'dusk', 'night'];
    this.stadium = new Stadium(scene, renderer, { weather: 'clear', time: times[Math.floor(Math.random() * 3)], quality: 'low', homeColors: [a.home.shirt, a.home.shorts], awayColors: [b.home.shirt, b.home.shorts], name: a.stadium });
    const xi = [...pickEleven(a.players, a.formation).slice(5, 10), ...pickEleven(b.players, b.formation).slice(5, 9)];
    xi.forEach((p, i) => {
      const own = i < 5;
      const m = new PlayerModel(p, own ? a.home : b.home, false);
      const pose: PoseState = { speed: 0, phase: Math.random() * 6, turn: 0, accel: 0, action: null, actionT: 0, actionDur: 1, contact: 0.6, leftFoot: false, diveSide: 1, diveHigh: 0, jockey: false, isGK: false, gkReady: false, time: 0, celebrateStyle: 0 };
      const x = (i - 4) * 3.2;
      const z = own ? -2 : 2;
      m.root.position.set(x, 0, z);
      scene.add(m.root);
      this.models.push({ m, pose, x, z, f: 0, t: Math.random() * 10 });
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    ball.position.set(0, 0.11, 0);
    ball.castShadow = true;
    scene.add(ball);
    this.ball = ball;
    renderer.toneMappingExposure = 1;
  }
  update(dt: number) {
    this.t += dt;
    const a = this.t * 0.06;
    camera.position.set(Math.sin(a) * 26, 6 + Math.sin(this.t * 0.2) * 1.5, Math.cos(a) * 20);
    camera.lookAt(0, 1.2, 0);
    for (const o of this.models) {
      o.t += dt;
      // jog in small circles, kick the ball about
      const r = 2.2;
      const sp = 2.5 + Math.sin(o.t * 0.3) * 1.5;
      o.f += (sp / r) * dt * 0.4;
      o.m.root.position.set(o.x + Math.cos(o.f) * r * 0.5, 0, o.z + Math.sin(o.f) * r * 0.5);
      o.m.root.rotation.y = Math.atan2(-Math.sin(o.f), Math.cos(o.f));
      o.pose.speed = sp;
      o.pose.phase += (sp / (1.2 + sp * 0.32)) * Math.PI * 2 * dt;
      o.pose.time = this.t;
      o.m.setTarget(o.pose);
      o.m.blend(dt);
    }
    this.ball.position.set(Math.sin(this.t * 0.7) * 4, 0.11 + Math.abs(Math.sin(this.t * 2.1)) * 0.6, Math.cos(this.t * 0.5) * 1.5);
    this.stadium.update(dt, 0.25);
  }
  dispose() {
    this.stadium.dispose();
    for (const o of this.models) scene.remove(o.m.root);
    scene.remove(this.ball);
  }
}
function showMenuStage() {
  if (!menu) menu = new MenuStage();
}
function hideMenuStage() {
  menu?.dispose();
  menu = null;
}

// ---------------------------------------------------------------- match flow
function touchOn() {
  return settings.touch === 'on' || (settings.touch === 'auto' && matchMedia('(pointer: coarse)').matches);
}

function baseSetup(home: TeamData, away: TeamData, over: Partial<MatchSetup> = {}): MatchSetup {
  const [hk, ak] = M.kitsFor(home, away);
  const derby = derbyName(home.id, away.id);
  const h = M.h2hSummary(home.id, away.id);
  const history = h.n ? `במפגשים הקודמים: ${h.wa} ניצחונות ל${home.name}, ${h.wb} ל${away.name} ו-${h.d} תיקו.` : 'זה המפגש הראשון ביניהן.';
  let hash = 0;
  for (const c of home.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const turf = (['hybrid', 'normal', 'old'] as const)[hash % 3];
  return {
    derby, history, turf,
    home, away, homeKit: hk, awayKit: ak,
    homeXI: pickEleven(home.players, home.formation),
    awayXI: pickEleven(away.players, away.formation),
    homeFormation: home.formation, awayFormation: away.formation,
    homeTactic: home.tactic, awayTactic: away.tactic,
    pads: [0, null],
    halfSeconds: settings.halfMinutes * 60,
    difficulty: settings.difficulty,
    weather: 'clear', time: 'night', knockout: false, quality: settings.quality,
    cameraZoom: settings.zoom, title: 'משחק ידידות', commentary: settings.commentary, guide: settings.guide,
    ...over,
  };
}

function playMatch(setup: MatchSetup): Promise<MatchResult | null> {
  hideMenuStage();
  ui.innerHTML = '';
  ui.classList.add('hidden');
  const hud = new Hud(document.body);
  hud.showRadar(settings.radar);
  input.showTouch(touchOn());
  renderer.toneMappingExposure = setup.time === 'night' ? 1.1 : setup.time === 'dusk' ? 1.05 : 1;
  const m = new Match(scene, renderer, camera, setup, hud, audio, input);
  match = m;
  return new Promise((resolve) => {
    const cleanup = () => {
      m.dispose();
      hud.dispose();
      input.showTouch(false);
      match = null;
      ui.classList.remove('hidden');
      showMenuStage();
    };
    m.onEnd = (r) => {
      cleanup();
      M.recordH2H(setup.home.id, setup.away.id, r.goals[0], r.goals[1]);
      resolve(r);
    };
    let closedAt = 0;
    m.onPause = () => {
      if (m.paused || performance.now() - closedAt < 400) return;
      m.paused = true;
      audio.stopSpeech();
      const humanSide = setup.pads[0] !== null ? 0 : 1;
      const t = m.teams[humanSide];
      const mdl = modal(`
        <h2>השהיה</h2>
        <div class="menu-col">
          <button class="btn primary" data-a="resume">המשך משחק</button>
          <label class="field">טקטיקה (${esc(t.data.name)})
            <select data-a="tactic">${Object.values(TACTICS).map((x) => `<option value="${x.id}" ${x.id === t.tactic.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
          </label>
          <label class="field">רוחב בהתקפה <input type="range" min="0" max="1" step="0.05" value="${t.tactic.width}" data-tk="width"></label>
          <label class="field">גובה קו ההגנה <input type="range" min="0" max="1" step="0.05" value="${t.tactic.lineHeight}" data-tk="lineHeight"></label>
          <label class="field">מרחק בין הקווים <input type="range" min="0" max="1" step="0.05" value="${t.tactic.depth}" data-tk="depth"></label>
          <label class="field">עוצמת לחץ <input type="range" min="0" max="1" step="0.05" value="${t.tactic.press}" data-tk="press"></label>
          <label class="field">זום מצלמה <input type="range" min="0.6" max="1.6" step="0.05" value="${m.setup.cameraZoom}" data-a="zoom"></label>
          <label class="check"><input type="checkbox" data-a="comm" ${m.setup.commentary ? 'checked' : ''}> קריינות קולית${audio.hasHebrewVoice ? '' : ' (אין קול עברי בדפדפן – כתוביות בלבד)'}</label>
          <label class="check"><input type="checkbox" data-a="radar" ${settings.radar ? 'checked' : ''}> מכ"ם</label>
          <div class="subs">
            <b>חילופים (${t.subsLeft} נותרו)</b>
            <label class="field">יוצא<select data-a="subOut">${t.players.filter((p) => !p.sent).map((p, i) => `<option value="${i}">${p.d.num} ${esc(p.d.name)} · כושר ${Math.round(p.stamina * 100)}%${p.injury ? ' · פצוע' : ''}</option>`).join('')}</select></label>
            <label class="field">נכנס<select data-a="subIn">${t.bench.map((d) => `<option value="${d.id}">${d.num} ${esc(d.name)} · ${d.role} ${d.ovr}</option>`).join('')}</select></label>
            <button class="btn" data-a="sub" ${t.subsLeft > 0 && t.bench.length ? '' : 'disabled'}>בצע חילוף (בעצירה הבאה)</button>
          </div>
          <button class="btn" data-a="controls">מקשים ושליטה</button>
          <button class="btn danger" data-a="quit">יציאה מהמשחק</button>
        </div>`);
      const el = mdl.el;
      const close = () => {
        mdl.close();
        m.paused = false;
        closedAt = performance.now();
      };
      el.querySelector('[data-a=resume]')!.addEventListener('click', close);
      el.querySelector('[data-a=tactic]')!.addEventListener('change', (e) => {
        t.tactic = TACTICS[(e.target as HTMLSelectElement).value as TacticId];
      });
      el.querySelectorAll<HTMLInputElement>('[data-tk]').forEach((inp) =>
        inp.addEventListener('input', () => {
          // custom instructions on top of the preset
          t.tactic = { ...t.tactic, [inp.dataset.tk!]: +inp.value };
        }),
      );
      el.querySelector('[data-a=zoom]')!.addEventListener('input', (e) => {
        m.setup.cameraZoom = +(e.target as HTMLInputElement).value;
        settings.zoom = m.setup.cameraZoom;
        saveSettings();
      });
      el.querySelector('[data-a=comm]')!.addEventListener('change', (e) => {
        m.setup.commentary = (e.target as HTMLInputElement).checked;
        audio.speech = m.setup.commentary;
      });
      el.querySelector('[data-a=radar]')!.addEventListener('change', (e) => {
        settings.radar = (e.target as HTMLInputElement).checked;
        hud.showRadar(settings.radar);
        saveSettings();
      });
      el.querySelector('[data-a=controls]')!.addEventListener('click', () => controlsModal());
      el.querySelector('[data-a=sub]')?.addEventListener('click', () => {
        const active = t.players.filter((p) => !p.sent);
        const out = active[+(el.querySelector('[data-a=subOut]') as HTMLSelectElement).value];
        const inId = (el.querySelector('[data-a=subIn]') as HTMLSelectElement).value;
        if (out && inId) {
          m.requestSub(t, out, inId);
          toast('החילוף יבוצע בעצירת המשחק הבאה');
        }
      });
      el.querySelector('[data-a=quit]')!.addEventListener('click', () => {
        mdl.close();
        const r = m.result();
        r.quit = true;
        cleanup();
        resolve(null);
      });
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          removeEventListener('keydown', onKey);
          close();
        }
      };
      setTimeout(() => addEventListener('keydown', onKey), 100);
    };
  });
}

function lineupHtml(setup: MatchSetup) {
  const col = (t: TeamData, xi: PlayerData[], f: string, tac: TacticId, kit: Kit) => `
    <div class="lu-col">
      <div class="lu-head">${teamBadge(t, 40)}<div><b>${esc(t.name)}</b><small>${esc(f)} · ${esc(TACTICS[tac].name)} · דירוג ${t.rating}</small></div></div>
      <ol class="lu">${xi.map((p) => `<li><span class="n" style="background:${kit.shirt};color:${kit.number}">${p.num}</span><span class="nm">${esc(p.name)}</span><small>${esc(p.role)}</small><b>${p.ovr}</b></li>`).join('')}</ol>
    </div>`;
  const h = M.h2hSummary(setup.home.id, setup.away.id);
  const w = { clear: 'בהיר', cloudy: 'מעונן', rain: 'גשם', snow: 'שלג' }[setup.weather];
  const tm = { day: 'יום', dusk: 'בין ערביים', night: 'לילה' }[setup.time];
  return `<h2>${esc(setup.title)}</h2>
    <p class="sub">${esc(setup.home.stadium)} · ${w} · ${tm}${h.n ? ` · מפגשים קודמים: ${h.wa} ניצחונות ל${esc(setup.home.short)}, ${h.d} תיקו, ${h.wb} ל${esc(setup.away.short)}` : ''}</p>
    <div class="lu-wrap">${col(setup.home, setup.homeXI, setup.homeFormation, setup.homeTactic, setup.homeKit)}${col(setup.away, setup.awayXI, setup.awayFormation, setup.awayTactic, setup.awayKit)}</div>`;
}

async function preMatch(setup: MatchSetup): Promise<MatchResult | null> {
  return new Promise((resolve) => {
    screen(`<div class="panel-screen">${lineupHtml(setup)}
      <div class="row-btns"><button class="btn primary big" data-go>לשריקת הפתיחה ▶</button><button class="btn" data-back>חזרה</button></div>
      <p class="tip">טיפ: ${esc(TIPS[Math.floor(Math.random() * TIPS.length)])}</p></div>`, (root) => {
      root.querySelector('[data-go]')!.addEventListener('click', async () => resolve(await playMatch(setup)));
      root.querySelector('[data-back]')!.addEventListener('click', () => resolve(null));
    });
  });
}

const TIPS = [
  'לחיצה שנייה על מקש הבעיטה בדיוק ברגע שהרגל פוגעת בכדור = סיום מתוזמן ירוק.',
  'החזק C (LT) כדי לג\'קי מול התוקף במקום לרוץ לתוכו.',
  'E + ף = בעיטה מסובבת לפינה הרחוקה. Q + ף = צ\'יפ מעל השוער.',
  'בגשם הכדור מחליק מהר יותר על הדשא, ושלוליות עוצרות אותו.',
  'בשלג הכדור כתום והקווים כחולים – והכדור מאט מהר.',
  'שחקן כבד וחזק ינצח במאבק כתף מול שחקן קל.',
  'מסירת עומק (ם) עובדת הכי טוב כשהחלוץ כבר רץ מאחורי הקו.',
  'גלישה מאחור = סכנה לכרטיס אדום.',
  'עייפות פוגעת במהירות ובדיוק – שים לב לפס הסיבולת.',
];

// ---------------------------------------------------------------- screens
function screen(html: string, bind?: (root: HTMLElement) => void) {
  ui.innerHTML = html;
  ui.scrollTop = 0;
  bind?.(ui);
}

function home() {
  showMenuStage();
  screen(`
    <div class="home">
      <div class="logo"><span>⚽</span><h1>כדורגל 3D</h1><small>מנוע פיזיקה · אנימציה פרוצדורלית · AI טקטי</small></div>
      <div class="tiles">
        <button class="tile hero" data-go="quick"><b>משחק מהיר</b><small>בחר קבוצות, מזג אוויר, שעה – ולמגרש</small></button>
        <button class="tile" data-go="tournament"><b>טורניר</b><small>גביע נוקאאוט של 8 קבוצות עם פנדלים</small></button>
        <button class="tile" data-go="career"><b>קריירת מנג'ר</b><small>תקציב, העברות, סקאוטינג, מורל ועיתונאים</small></button>
        <button class="tile" data-go="pcareer"><b>קריירת שחקן</b><small>שחקן אחד, יעדים מהמאמן, אימונים וחוזים</small></button>
        <button class="tile ut" data-go="ut"><b>קבוצת חלומות</b><small>מארזי קלפים, כימיה, שוק העברות וליגת יריבויות</small></button>
        <button class="tile small" data-go="settings"><b>הגדרות</b></button>
        <button class="tile small" data-go="controls"><b>מקשים ושליטה</b></button>
      </div>
      <p class="foot">שמות הקבוצות והשחקנים בדיוניים. תומך במקלדת, בשלט (Xbox/PlayStation) ובמסך מגע.</p>
    </div>`, (root) => {
    root.querySelectorAll<HTMLElement>('[data-go]').forEach((b) =>
      b.addEventListener('click', () => {
        const g = b.dataset.go;
        if (g === 'quick') quickSetup();
        if (g === 'tournament') tournament();
        if (g === 'career') career();
        if (g === 'pcareer') playerCareer();
        if (g === 'ut') ultimate();
        if (g === 'settings') settingsScreen();
        if (g === 'controls') controlsModal();
      }),
    );
  });
}

function teamGrid(selected: string, attr: string, filter?: (t: TeamData) => boolean) {
  const leagues = LEAGUES.map((lg) => {
    const list = allTeams().filter((t) => t.league === lg && (!filter || filter(t)));
    if (!list.length) return '';
    return `<h4>${esc(lg)}</h4><div class="teams">${list.map((t) => `
      <button class="team ${t.id === selected ? 'on' : ''}" ${attr}="${t.id}">${teamBadge(t)}<span><b>${esc(t.name)}</b><small>${stars(t.rating)} ${t.rating}</small></span></button>`).join('')}</div>`;
  });
  return leagues.join('');
}

const qs = M.load('fb-quick', {
  home: 'gal', away: 'koc', control: 'home' as 'home' | 'away' | 'both' | 'none', formation: '', formationDef: '', tactic: '' as TacticId | '',
  weather: 'clear' as Weather, time: 'night' as TimeOfDay,
});

function quickSetup() {
  const render = () => {
    const H = teamById(qs.home)!;
    const A = teamById(qs.away)!;
    screen(`
      <div class="panel-screen wide">
        <div class="top"><button class="btn" data-back>→ חזרה</button><h2>משחק מהיר</h2></div>
        <div class="vs">
          <div class="side"><small>בית</small>${teamBadge(H, 64)}<b>${esc(H.name)}</b><span>${stars(H.rating)}</span></div>
          <div class="vs-x">נגד</div>
          <div class="side"><small>חוץ</small>${teamBadge(A, 64)}<b>${esc(A.name)}</b><span>${stars(A.rating)}</span></div>
        </div>
        <div class="grid2">
          <div><h3>קבוצת בית</h3>${teamGrid(qs.home, 'data-h')}</div>
          <div><h3>קבוצת חוץ</h3>${teamGrid(qs.away, 'data-a')}</div>
        </div>
        <div class="opts">
          <label class="field">מי משחק
            <select data-k="control">
              <option value="home" ${qs.control === 'home' ? 'selected' : ''}>אני – בית</option>
              <option value="away" ${qs.control === 'away' ? 'selected' : ''}>אני – חוץ</option>
              <option value="both" ${qs.control === 'both' ? 'selected' : ''}>שני שחקנים (מקלדת + שלט)</option>
              <option value="none" ${qs.control === 'none' ? 'selected' : ''}>צפייה: מחשב נגד מחשב</option>
            </select></label>
          <label class="field">מערך
            <select data-k="formation"><option value="">ברירת מחדל</option>${Object.keys(FORMATIONS).map((f) => `<option ${qs.formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
          <label class="field">מערך בלי כדור
            <select data-k="formationDef"><option value="">אותו מערך</option>${Object.keys(FORMATIONS).map((f) => `<option ${qs.formationDef === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
          <label class="field">סגנון משחק
            <select data-k="tactic"><option value="">ברירת מחדל</option>${Object.values(TACTICS).map((t) => `<option value="${t.id}" ${qs.tactic === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          <label class="field">מזג אוויר
            <select data-k="weather">${[['clear', 'בהיר'], ['cloudy', 'מעונן'], ['rain', 'גשם'], ['snow', 'שלג']].map(([v, n]) => `<option value="${v}" ${qs.weather === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="field">שעה
            <select data-k="time">${[['day', 'צהריים'], ['dusk', 'בין ערביים'], ['night', 'לילה (זרקורים)']].map(([v, n]) => `<option value="${v}" ${qs.time === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="field">אורך מחצית
            <select data-k="half">${[2, 3, 4, 6, 8, 10].map((m) => `<option value="${m}" ${settings.halfMinutes === m ? 'selected' : ''}>${m} דקות</option>`).join('')}</select></label>
          <label class="field">רמת קושי
            <select data-k="diff">${M.DIFFICULTIES.map((d, i) => `<option value="${i}" ${settings.difficulty === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        </div>
        <p class="tdesc">${qs.tactic ? esc(TACTICS[qs.tactic].desc) : ''}</p>
        <div class="row-btns"><button class="btn primary big" data-go>המשך להרכבים ▶</button></div>
      </div>`, (root) => {
      root.querySelector('[data-back]')!.addEventListener('click', home);
      root.querySelectorAll<HTMLElement>('[data-h]').forEach((b) => b.addEventListener('click', () => { qs.home = b.dataset.h!; if (qs.away === qs.home) qs.away = allTeams().find((t) => t.id !== qs.home)!.id; render(); }));
      root.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => { qs.away = b.dataset.a!; if (qs.away === qs.home) qs.home = allTeams().find((t) => t.id !== qs.away)!.id; render(); }));
      root.querySelectorAll<HTMLSelectElement>('select[data-k]').forEach((s) =>
        s.addEventListener('change', () => {
          const k = s.dataset.k!;
          if (k === 'half') settings.halfMinutes = +s.value;
          else if (k === 'diff') settings.difficulty = +s.value;
          else (qs as Record<string, string>)[k] = s.value;
          saveSettings();
          M.save('fb-quick', qs);
          if (k === 'tactic') render();
        }),
      );
      root.querySelector('[data-go]')!.addEventListener('click', async () => {
        M.save('fb-quick', qs);
        const H = { ...teamById(qs.home)! };
        const A = { ...teamById(qs.away)! };
        const mine = qs.control === 'away' ? A : H;
        if (qs.formation) mine.formation = qs.formation;
        if (qs.tactic) mine.tactic = qs.tactic;
        const pads: [number | null, number | null] = qs.control === 'home' ? [0, null] : qs.control === 'away' ? [null, 0] : qs.control === 'both' ? [0, 1] : [null, null];
        const setup = baseSetup(H, A, { pads, weather: qs.weather, time: qs.time, title: 'משחק ידידות' });
        if (qs.formationDef) {
          if (qs.control === 'away') setup.awayFormationDef = qs.formationDef;
          else setup.homeFormationDef = qs.formationDef;
        }
        const r = await preMatch(setup);
        void r;
        quickSetup();
      });
    });
  };
  render();
}

// ---------------------------------------------------------------- tournament
function tournament() {
  let t = M.load<M.Tournament | null>('fb-tournament', null);
  const pick = () =>
    screen(`<div class="panel-screen wide"><div class="top"><button class="btn" data-back>→ חזרה</button><h2>טורניר – בחר קבוצה</h2></div>${teamGrid('', 'data-t')}</div>`, (root) => {
      root.querySelector('[data-back]')!.addEventListener('click', home);
      root.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => b.addEventListener('click', () => {
        t = M.newTournament(b.dataset.t!);
        M.save('fb-tournament', t);
        render();
      }));
    });
  const render = () => {
    if (!t) return pick();
    const tt = t;
    const names = ['רבע גמר', 'חצי גמר', 'גמר'];
    const bracket = [0, 1, 2].map((r) => {
      const res = tt.results[r];
      const pairs = r < tt.round || (r === tt.round && tt.round < 3) ? (res ?? M.roundPairs({ ...tt, round: r }).map(([a, b]) => ({ a, b, ga: -1, gb: -1, winner: '' }))) : [];
      return `<div class="br-col"><h4>${names[r]}</h4>${pairs.map((m) => {
        const A = teamById(m.a)!;
        const B = teamById(m.b)!;
        const sc = m.ga >= 0 ? `${m.ga} - ${m.gb}${'pens' in m && m.pens ? ` (${m.pens[0]}-${m.pens[1]} פ')` : ''}` : '—';
        return `<div class="br-m ${m.a === tt.teamId || m.b === tt.teamId ? 'mine' : ''}"><span class="${m.winner === m.a ? 'w' : ''}">${teamBadge(A, 20)} ${esc(A.short)}</span><b>${sc}</b><span class="${m.winner === m.b ? 'w' : ''}">${esc(B.short)} ${teamBadge(B, 20)}</span></div>`;
      }).join('')}</div>`;
    }).join('');
    const alive = tt.round === 0 || (tt.results[tt.round - 1]?.some((r) => r.winner === tt.teamId) ?? false);
    const myPair = tt.round < 3 ? M.roundPairs(tt).find((p) => p.includes(tt.teamId)) : undefined;
    screen(`<div class="panel-screen wide">
      <div class="top"><button class="btn" data-back>→ חזרה</button><h2>גביע היבשת</h2></div>
      ${tt.champion ? `<div class="champ">🏆 ${esc(teamById(tt.champion)!.name)} זוכה בגביע!</div>` : ''}
      <div class="bracket">${bracket}</div>
      <div class="row-btns">
        ${tt.round < 3 && alive && myPair ? `<button class="btn primary big" data-play>שחק: ${esc(names[tt.round])} ▶</button><button class="btn" data-sim>סימולציה</button>` : ''}
        ${tt.round < 3 && !alive ? `<button class="btn" data-simall>המשך סימולציה</button>` : ''}
        <button class="btn danger" data-new>טורניר חדש</button>
      </div></div>`, (root) => {
      root.querySelector('[data-back]')!.addEventListener('click', home);
      root.querySelector('[data-new]')!.addEventListener('click', () => { t = null; M.save('fb-tournament', null); render(); });
      const finishRound = (mine?: { a: string; b: string; ga: number; gb: number; pens?: [number, number]; winner: string }) => {
        const pairs = M.roundPairs(tt);
        tt.results[tt.round] = pairs.map(([a, b]) => (mine && (a === tt.teamId || b === tt.teamId) ? mine : M.simKnockout(a, b)));
        tt.round++;
        if (tt.round === 3) tt.champion = tt.results[2][0].winner;
        M.save('fb-tournament', tt);
        render();
      };
      root.querySelector('[data-sim]')?.addEventListener('click', () => finishRound());
      root.querySelector('[data-simall]')?.addEventListener('click', () => { while (tt.round < 3) { const pairs = M.roundPairs(tt); tt.results[tt.round] = pairs.map(([a, b]) => M.simKnockout(a, b)); tt.round++; } tt.champion = tt.results[2][0].winner; M.save('fb-tournament', tt); render(); });
      root.querySelector('[data-play]')?.addEventListener('click', async () => {
        const [a, b] = myPair!;
        const H = teamById(a)!;
        const A = teamById(b)!;
        const pads: [number | null, number | null] = a === tt.teamId ? [0, null] : [null, 0];
        const weathers: Weather[] = ['clear', 'clear', 'cloudy', 'rain', 'snow'];
        const setup = baseSetup(H, A, { pads, knockout: true, title: `גביע היבשת – ${names[tt.round]}`, bigGame: tt.round === 2, weather: weathers[Math.floor(Math.random() * weathers.length)], time: tt.round === 2 ? 'night' : 'dusk' });
        const r = await preMatch(setup);
        if (!r) return render();
        const winner = r.winner === 0 ? a : b;
        finishRound({ a, b, ga: r.goals[0], gb: r.goals[1], pens: r.pens ?? undefined, winner });
      });
    });
  };
  render();
}

// ---------------------------------------------------------------- manager career
function career() {
  let c = M.load<M.Career | null>('fb-career', null);
  let tab = 'home';
  const persist = () => M.save('fb-career', c);
  const pick = () =>
    screen(`<div class="panel-screen wide"><div class="top"><button class="btn" data-back>→ חזרה</button><h2>קריירת מנג'ר – בחר מועדון</h2></div>${teamGrid('', 'data-t')}</div>`, (root) => {
      root.querySelector('[data-back]')!.addEventListener('click', home);
      root.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => b.addEventListener('click', () => { c = M.newCareer(b.dataset.t!); persist(); render(); }));
    });
  const pickNew = (trophies: string[]) =>
    screen(`<div class="panel-screen wide"><div class="top"><h2>מועדון חדש מחפש מאמן</h2></div>${teamGrid('', 'data-t')}</div>`, (root) => {
      root.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => b.addEventListener('click', () => { c = M.newCareer(b.dataset.t!); c.trophies = trophies; persist(); render(); }));
    });
  const render = () => {
    if (!c) return pick();
    const cc = c;
    if (!cc.board) cc.board = 'budget';
    const team = M.careerTeamData(cc);
    const round = cc.schedule[cc.round];
    const fx = round?.find((p) => p.includes(cc.teamId));
    const opp = fx ? M.otherTeamData(cc, fx[0] === cc.teamId ? fx[1] : fx[0]) : null;
    const tabs = [['home', 'סקירה'], ['table', 'טבלה'], ['squad', 'סגל והרכב'], ['transfers', 'שוק העברות'], ['scout', 'סקאוטינג'], ['news', 'חדשות']];
    let body = '';
    if (tab === 'home') {
      body = `<div class="cards3">
        <div class="box"><h4>המשחק הבא</h4>${opp ? `<div class="next">${teamBadge(team, 44)}<b>נגד</b>${teamBadge(opp, 44)}</div><p>${fx![0] === cc.teamId ? 'בבית' : 'בחוץ'} מול ${esc(opp.name)} (${opp.rating})</p><div class="row-btns"><button class="btn primary" data-play>שחק ▶</button><button class="btn" data-sim>סימולציה</button></div>` : '<p>העונה הסתיימה</p>'}</div>
        <div class="box"><h4>כספים</h4><p>תקציב העברות: <b>${cc.budget.toLocaleString()}K ₪</b></p><p>שכר שבועי: <b>${M.wageBill(cc)}K</b> / ${cc.wageBudget}K</p><p>שביעות רצון הדירקטוריון: <b>${cc.boardHappy}%</b></p><p>יעד: מקום ${cc.board === 'title' ? 1 : cc.objective} ומעלה</p><p class="tdesc">${esc(M.BOARD_TEXT[cc.board ?? 'budget'])}</p></div>
        <div class="box"><h4>עונה ${cc.season} · מחזור ${Math.min(cc.round + 1, cc.schedule.length)}/${cc.schedule.length}</h4>${miniTable(cc.table, cc.teamId)}${cc.lastResult ? `<p class="last">${esc(cc.lastResult)}</p>` : ''}</div>
      </div>${cc.trophies.length ? `<p>🏆 ${cc.trophies.map(esc).join(' · ')}</p>` : ''}`;
    } else if (tab === 'table') body = fullTable(cc.table, cc.teamId);
    else if (tab === 'squad') {
      const xi = pickEleven(team.players, cc.formation).map((p) => p.id);
      body = `<div class="opts"><label class="field">מערך עם כדור<select data-f>${Object.keys(FORMATIONS).map((f) => `<option ${f === cc.formation ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="field">מערך בלי כדור<select data-fd><option value="">אותו מערך</option>${Object.keys(FORMATIONS).map((f) => `<option ${f === cc.formationDef ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="field">סגנון<select data-tac>${Object.values(TACTICS).map((t) => `<option value="${t.id}" ${t.id === cc.tactic ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label></div>
        <p class="tdesc">${esc(TACTICS[cc.tactic].desc)}</p>
        <table class="list"><tr><th></th><th>שם</th><th>עמדה</th><th>גיל</th><th>כללי</th><th>פוטנציאל</th><th>מורל</th><th>כושר</th><th>שכר</th><th>שווי</th><th></th></tr>
        ${[...cc.squad].sort((a, b) => b.ovr - a.ovr).map((p) => `<tr class="${xi.includes(p.id) ? 'xi' : ''}"><td>${xi.includes(p.id) ? '●' : ''}</td><td>${face(p, 26)} ${esc(p.name)} ${NATION_FLAGS[p.nation] ?? ''}</td><td>${p.role}</td><td>${p.age}</td><td><b>${p.ovr}</b></td><td>${p.scouted || p.age < 23 ? p.potential : '?'}</td><td>${moraleIcon(p.morale)}</td><td>${p.injuredRounds ? `🤕 ${p.injuredRounds} מחז'` : p.suspended ? '🟥 מורחק' : `${Math.round(p.fitness ?? 100)}%`}</td><td>${p.wage}K</td><td>${p.value}K</td><td><button class="btn tiny" data-sell="${p.id}">מכירה</button></td></tr>`).join('')}</table>`;
    } else if (tab === 'transfers') {
      const list = M.transferList(cc).filter((p) => !filterPos || p.pos === filterPos).slice(0, 60);
      body = `<div class="opts"><label class="field">עמדה<select data-pos><option value="">הכל</option>${['GK', 'DEF', 'MID', 'FWD'].map((p) => `<option ${filterPos === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label><span class="pill">תקציב: ${cc.budget.toLocaleString()}K</span></div>
        <table class="list"><tr><th>שם</th><th>מועדון</th><th>עמדה</th><th>גיל</th><th>כללי</th><th>שכר</th><th>מחיר</th><th></th></tr>
        ${list.map((p) => `<tr><td>${face(p, 26)} ${esc(p.name)} ${NATION_FLAGS[p.nation] ?? ''}</td><td>${esc(teamById(p.askClub)?.short ?? '')}</td><td>${p.role}</td><td>${p.age}</td><td><b>${p.ovr}</b></td><td>${p.wage}K</td><td>${M.askingPrice(cc, p).toLocaleString()}K</td><td><button class="btn tiny" data-buy="${p.id}|${p.askClub}">משא ומתן</button></td></tr>`).join('')}</table>`;
    } else if (tab === 'scout') {
      body = `<p>שלח סקאוט (150K) עם הנחיות – אחרי שני מחזורים יחזור עם 3 שחקנים. לפעמים יימצא "ילד פלא" עם פוטנציאל 88+.</p>
        <div class="opts"><label class="field">אזור<select data-sr>${Object.keys(M.REGIONS).map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
        <label class="field">עמדה<select data-sp><option value="">כל עמדה</option><option value="FWD">חלוץ</option><option value="MID">קשר</option><option value="DEF">מגן</option><option value="GK">שוער</option></select></label>
        <label class="field">גיל מקסימלי<select data-sa>${[19, 20, 21, 23, 26].map((a) => `<option ${a === 21 ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <button class="btn" data-scout>שלח סקאוט</button></div>
        <p>${cc.scouts.map((s) => `🔍 ${esc(s.region ?? s.nation)}${s.pos ? ` (${s.pos})` : ''}: עוד ${s.left} מחזורים`).join(' · ') || 'אין סקאוטים בשטח.'}</p>
        <table class="list"><tr><th>שם</th><th>עמדה</th><th>גיל</th><th>כללי</th><th>פוטנציאל</th><th>מחיר</th><th></th></tr>
        ${cc.prospects.map((p) => `<tr><td>${face(p, 26)} ${esc(p.name)} ${NATION_FLAGS[p.nation] ?? ''}</td><td>${p.role}</td><td>${p.age}</td><td>${p.ovr}</td><td><b>${p.potential}</b>${p.wonderkid ? ' ⭐ ילד פלא' : ''}</td><td>${p.value}K</td><td><button class="btn tiny" data-sign="${p.id}">החתמה</button></td></tr>`).join('') || '<tr><td colspan="7">עדיין אין דוחות סקאוטינג</td></tr>'}</table>`;
    } else if (tab === 'news') body = `<ul class="news">${cc.news.slice(0, 30).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;

    screen(`<div class="panel-screen wide">
      <div class="top"><button class="btn" data-back>→ חזרה</button>${teamBadge(team, 40)}<h2>${esc(team.name)} <small>מנג'ר</small></h2><button class="btn danger tiny" data-reset>קריירה חדשה</button></div>
      <div class="tabs">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
      ${body}</div>`, (root) => {
      root.querySelector('[data-back]')!.addEventListener('click', home);
      root.querySelector('[data-reset]')!.addEventListener('click', () => { if (confirm('למחוק את הקריירה ולהתחיל מחדש?')) { c = null; persist(); render(); } });
      root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab!; render(); }));
      root.querySelector<HTMLSelectElement>('[data-f]')?.addEventListener('change', (e) => { cc.formation = (e.target as HTMLSelectElement).value; persist(); render(); });
      root.querySelector<HTMLSelectElement>('[data-fd]')?.addEventListener('change', (e) => { cc.formationDef = (e.target as HTMLSelectElement).value || undefined; persist(); render(); });
      root.querySelector<HTMLSelectElement>('[data-tac]')?.addEventListener('change', (e) => { cc.tactic = (e.target as HTMLSelectElement).value as TacticId; persist(); render(); });
      root.querySelector<HTMLSelectElement>('[data-pos]')?.addEventListener('change', (e) => { filterPos = (e.target as HTMLSelectElement).value; render(); });
      root.querySelectorAll<HTMLElement>('[data-sell]').forEach((b) => b.addEventListener('click', () => { const fee = M.sellPlayer(cc, b.dataset.sell!); toast(fee ? `נמכר ב-${fee}K` : 'לא ניתן למכור – מינימום 16 שחקנים'); persist(); render(); }));
      root.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => {
        const [id, club] = b.dataset.buy!.split('|');
        const p = M.transferList(cc).find((x) => x.id === id && x.askClub === club)!;
        negotiationModal(cc, p, () => {
          persist();
          render();
        });
      }));
      root.querySelector('[data-scout]')?.addEventListener('click', () => {
        const region = (root.querySelector('[data-sr]') as HTMLSelectElement).value;
        const pos = ((root.querySelector('[data-sp]') as HTMLSelectElement).value || undefined) as Pos | undefined;
        const age = +(root.querySelector('[data-sa]') as HTMLSelectElement).value;
        const err = M.startScout(cc, region, pos, age);
        toast(err ?? 'הסקאוט יצא לדרך');
        persist();
        render();
      });
      root.querySelectorAll<HTMLElement>('[data-sign]').forEach((b) => b.addEventListener('click', () => {
        const p = cc.prospects.find((x) => x.id === b.dataset.sign)!;
        const err = M.buyPlayer(cc, { ...p, askClub: 'free' }, p.value);
        if (!err) cc.prospects = cc.prospects.filter((x) => x.id !== p.id);
        toast(err ?? `${p.name} חתם!`);
        persist();
        render();
      }));
      const after = (gf: number, ga: number, played: string[], res: MatchResult | null = null) => {
        const [a, b] = fx!;
        const isHome = a === cc.teamId;
        M.applyResult(cc.table, a, b, isHome ? gf : ga, isHome ? ga : gf);
        M.simulateRound(cc, cc.teamId);
        const notes = M.afterCareerMatch(cc, gf, ga, played, res);
        if (cc.fired) {
          persist();
          const md = modal(`<h2>פוטרת</h2><p>${esc(notes.join(' '))}</p><p>אחרי ${cc.round + 1} מחזורים ושביעות רצון של ${cc.boardHappy}%, ההנהלה של ${esc(team.name)} נפרדת ממך.</p><div class="row-btns"><button class="btn primary">חפש מועדון חדש</button></div>`);
          md.el.querySelector('button')!.addEventListener('click', () => {
            md.close();
            const trophies = cc.trophies;
            c = null;
            persist();
            pickNew(trophies);
          });
          return;
        }
        if (notes.length) toast(notes[0]);
        cc.lastResult = `${isHome ? team.name : opp!.name} ${isHome ? gf : ga} - ${isHome ? ga : gf} ${isHome ? opp!.name : team.name}`;
        cc.news.unshift(cc.lastResult);
        cc.round++;
        if (cc.round >= cc.schedule.length) {
          const msg = M.endSeason(cc);
          persist();
          const md = modal(`<h2>סוף עונה</h2><p>${esc(msg)}</p><div class="row-btns"><button class="btn primary">לעונה הבאה</button></div>`);
          md.el.querySelector('button')!.addEventListener('click', () => { md.close(); render(); });
          return;
        }
        persist();
        const press = () => {
          const qi = Math.floor(Math.random() * M.PRESS_QUESTIONS.length);
          const q = M.PRESS_QUESTIONS[qi];
          const md = modal(`<h2>מסיבת עיתונאים</h2><p class="q">🎤 "${esc(q.q)}"</p><div class="menu-col">${q.answers.map((a, i) => `<button class="btn" data-ans="${i}">${esc(a.t)}</button>`).join('')}</div>`);
          md.el.querySelectorAll<HTMLElement>('[data-ans]').forEach((b) => b.addEventListener('click', () => { M.pressConference(cc, +b.dataset.ans!, qi); persist(); md.close(); render(); }));
        };
        const scandal = () => {
          const sc = M.rollScandal(cc);
          if (!sc) return press();
          const md = modal(`<h2>בעיה מחוץ למגרש</h2><p class="q">📰 ${esc(sc.text)}</p><div class="menu-col">
            <button class="btn" data-c="fine">קנס כספי</button><button class="btn" data-c="suspend">השעיה למשחק</button><button class="btn" data-c="ignore">להתעלם</button></div>`);
          md.el.querySelectorAll<HTMLElement>('[data-c]').forEach((b) => b.addEventListener('click', () => { M.resolveScandal(cc, sc.id, b.dataset.c as 'fine' | 'suspend' | 'ignore'); persist(); md.close(); press(); }));
        };
        if (cc.appeal) {
          const ap = cc.appeal;
          const md = modal(`<h2>כרטיס אדום</h2><p>${esc(ap.name)} הורחק ויחמיץ את המשחק הבא. להגיש ערעור לבית הדין המשמעתי? (סיכוי של כשליש; אם נדחה – קנס 20K)</p><div class="row-btns"><button class="btn primary" data-y>הגש ערעור</button><button class="btn" data-n>וותר</button></div>`);
          md.el.querySelector('[data-y]')!.addEventListener('click', () => { const msg = M.appealRed(cc); persist(); md.close(); toast(msg); scandal(); });
          md.el.querySelector('[data-n]')!.addEventListener('click', () => { cc.appeal = null; persist(); md.close(); scandal(); });
        } else scandal();
      };
      root.querySelector('[data-sim]')?.addEventListener('click', () => {
        const [g1, g2] = M.simulate(team.rating, opp!.rating);
        after(fx![0] === cc.teamId ? g1 : g2, fx![0] === cc.teamId ? g2 : g1, pickEleven(team.players, cc.formation).map((p) => p.id), null);
      });
      root.querySelector('[data-play]')?.addEventListener('click', async () => {
        // the rival manager plays mind games before big matches
        if (opp!.rating >= team.rating && Math.random() < 0.4) {
          const qi = Math.floor(Math.random() * M.MIND_GAMES.length);
          const q = M.MIND_GAMES[qi];
          await new Promise<void>((res) => {
            const md = modal(`<h2>מלחמה פסיכולוגית</h2><p class="q">🎤 ${esc(q.q)}</p><p class="tdesc">איך אתה מגיב? התשובה משפיעה על המורל של השחקנים.</p><div class="menu-col">${q.answers.map((a, i) => `<button class="btn" data-ans="${i}">${esc(a.t)}</button>`).join('')}</div>`);
            md.el.querySelectorAll<HTMLElement>('[data-ans]').forEach((b) => b.addEventListener('click', () => { M.applyMindGame(cc, qi, +b.dataset.ans!); persist(); md.close(); res(); }));
          });
        }
        const isHome = fx![0] === cc.teamId;
        const H = isHome ? team : opp!;
        const A = isHome ? opp! : team;
        const weathers: Weather[] = ['clear', 'clear', 'cloudy', 'rain', 'snow'];
        const setup = baseSetup(H, A, { pads: isHome ? [0, null] : [null, 0], fitness: M.careerFitness(cc), [isHome ? 'homeFormationDef' : 'awayFormationDef']: cc.formationDef, title: `${cc.league} – מחזור ${cc.round + 1}`, weather: weathers[Math.floor(Math.random() * weathers.length)], time: (['day', 'dusk', 'night'] as TimeOfDay[])[cc.round % 3] });
        const r = await preMatch(setup);
        if (!r) return render();
        const gf = isHome ? r.goals[0] : r.goals[1];
        const ga = isHome ? r.goals[1] : r.goals[0];
        after(gf, ga, (isHome ? setup.homeXI : setup.awayXI).map((p) => p.id), r);
      });
    });
  };
  let filterPos = '';
  render();
}

function negotiationModal(cc: M.Career, p: PlayerData & { askClub: string }, done: () => void) {
  const ask = M.askingPrice(cc, p);
  const wage = M.wageDemand(cc, p);
  const md = modal(`<h2>משא ומתן: ${esc(p.name)}</h2>
    <p class="tdesc">${esc(teamById(p.askClub)?.name ?? 'שחקן חופשי')} · ${p.role} · ${p.ovr} · גיל ${p.age} · שווי ${p.value.toLocaleString()}K</p>
    <div class="opts col">
      <label class="field">דמי העברה (K) <input type="number" data-n="fee" value="${Math.round(ask * 0.9)}" step="50"></label>
      <label class="field">אחוז ממכירה עתידית למועדון המוכר <input type="number" data-n="sellOn" value="0" min="0" max="40" step="5"></label>
      <label class="field">שכר שבועי (K) <input type="number" data-n="wage" value="${p.wage}" step="1"></label>
      <label class="field">מענק חתימה (K) <input type="number" data-n="bonus" value="0" step="50"></label>
      <label class="field">סעיף שחרור (K, 0 = ללא) <input type="number" data-n="releaseClause" value="${Math.round(p.value * 2)}" step="100"></label>
      <p class="tdesc">המועדון מבקש בערך ${ask.toLocaleString()}K · הסוכן מכוון לשכר של כ-${wage}K · תקציב: ${cc.budget.toLocaleString()}K</p>
      <p class="neg-msg"></p>
    </div>
    <div class="row-btns"><button class="btn primary" data-go>הגש הצעה</button><button class="btn" data-x>ביטול</button></div>`);
  const msg = md.el.querySelector('.neg-msg') as HTMLElement;
  md.el.querySelector('[data-x]')!.addEventListener('click', md.close);
  md.el.querySelector('[data-go]')!.addEventListener('click', () => {
    const v = (k: string) => +((md.el.querySelector(`[data-n=${k}]`) as HTMLInputElement).value || 0);
    const r = M.negotiate(cc, p, { fee: v('fee'), wage: v('wage'), bonus: v('bonus'), sellOn: v('sellOn'), releaseClause: v('releaseClause') });
    msg.textContent = r.msg;
    msg.style.color = r.ok ? '#86efac' : '#fca5a5';
    if (r.ok) {
      toast(r.msg);
      setTimeout(() => { md.close(); done(); }, 900);
    }
  });
}

function moraleIcon(m: number) {
  return m > 80 ? '😄' : m > 60 ? '🙂' : m > 40 ? '😐' : '😠';
}

function miniTable(t: M.Row[], me: string) {
  const s = M.sortTable(t);
  return `<table class="mini">${s.map((r, i) => `<tr class="${r.id === me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(teamById(r.id)?.short ?? r.id)}</td><td>${r.p}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table>`;
}
function fullTable(t: M.Row[], me: string) {
  if (!t.length) return '';
  const s = M.sortTable(t);
  return `<table class="list"><tr><th>#</th><th>קבוצה</th><th>מש'</th><th>נ</th><th>ת</th><th>ה</th><th>שערים</th><th>הפרש</th><th>נק'</th></tr>${s.map((r, i) => {
    const tm = teamById(r.id)!;
    return `<tr class="${r.id === me ? 'me' : ''}"><td>${i + 1}</td><td>${teamBadge(tm, 20)} ${esc(tm.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}:${r.ga}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`;
  }).join('')}</table>`;
}

// ---------------------------------------------------------------- player career
function playerCareer() {
  let c = M.load<M.PCareer | null>('fb-pcareer', null);
  let tab = 'home';
  const persist = () => M.save('fb-pcareer', c);
  const create = () => {
    const look = { skin: 1, hair: 0, hairColor: 0, boots: 2, foot: 'R' as 'R' | 'L', height: 180 };
    let role = 'ST';
    let nation = 'ישראל';
    let name = 'השחקן שלי';
    const roles: [string, Pos][] = [['ST', 'FWD'], ['LW', 'FWD'], ['RW', 'FWD'], ['CAM', 'MID'], ['CM', 'MID'], ['CDM', 'MID'], ['CB', 'DEF'], ['LB', 'DEF'], ['RB', 'DEF']];
    const draw = () => {
      const fake = { skin: look.skin, hair: look.hair, hairColor: look.hairColor, boots: look.boots } as PlayerData;
      screen(`<div class="panel-screen">
        <div class="top"><button class="btn" data-back>→ חזרה</button><h2>יצירת שחקן</h2></div>
        <div class="create"><div class="avatar">${face(fake, 120)}</div><div class="opts col">
          <label class="field">שם<input data-name value="${esc(name)}" maxlength="22"></label>
          <label class="field">עמדה<select data-role>${roles.map(([r]) => `<option ${r === role ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label class="field">לאום<select data-nat>${NATIONS.map((n) => `<option ${n === nation ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <label class="field">גובה <input type="range" min="165" max="198" value="${look.height}" data-h> <span>${look.height} ס"מ</span></label>
          <label class="field">רגל חזקה<select data-foot><option value="R" ${look.foot === 'R' ? 'selected' : ''}>ימין</option><option value="L" ${look.foot === 'L' ? 'selected' : ''}>שמאל</option></select></label>
          <div class="field">צבע עור<div class="swatches">${SKIN_TONES.map((s, i) => `<button style="background:${s}" class="${i === look.skin ? 'on' : ''}" data-skin="${i}"></button>`).join('')}</div></div>
          <div class="field">שיער<div class="swatches">${['קצר', 'קוצים', 'ארוך', 'קרחת', 'אפרו', 'בלורית'].map((s, i) => `<button class="txt ${i === look.hair ? 'on' : ''}" data-hair="${i}">${s}</button>`).join('')}</div></div>
          <div class="field">צבע שיער<div class="swatches">${HAIR_COLORS.map((s, i) => `<button style="background:${s}" class="${i === look.hairColor ? 'on' : ''}" data-hc="${i}"></button>`).join('')}</div></div>
          <div class="field">נעליים<div class="swatches">${BOOT_COLORS.map((s, i) => `<button style="background:${s}" class="${i === look.boots ? 'on' : ''}" data-boot="${i}"></button>`).join('')}</div></div>
        </div></div>
        <div class="row-btns"><button class="btn primary big" data-go>התחל קריירה ▶</button></div></div>`, (root) => {
        root.querySelector('[data-back]')!.addEventListener('click', home);
        root.querySelector<HTMLInputElement>('[data-name]')!.addEventListener('input', (e) => (name = (e.target as HTMLInputElement).value));
        root.querySelector<HTMLSelectElement>('[data-role]')!.addEventListener('change', (e) => (role = (e.target as HTMLSelectElement).value));
        root.querySelector<HTMLSelectElement>('[data-nat]')!.addEventListener('change', (e) => (nation = (e.target as HTMLSelectElement).value));
        root.querySelector<HTMLSelectElement>('[data-foot]')!.addEventListener('change', (e) => (look.foot = (e.target as HTMLSelectElement).value as 'R' | 'L'));
        root.querySelector<HTMLInputElement>('[data-h]')!.addEventListener('change', (e) => { look.height = +(e.target as HTMLInputElement).value; draw(); });
        const sw = (attr: string, key: 'skin' | 'hair' | 'hairColor' | 'boots') => root.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((b) => b.addEventListener('click', () => { look[key] = +b.getAttribute(attr)!; draw(); }));
        sw('data-skin', 'skin');
        sw('data-hair', 'hair');
        sw('data-hc', 'hairColor');
        sw('data-boot', 'boots');
        root.querySelector('[data-go]')!.addEventListener('click', () => {
          const pos = roles.find(([r]) => r === role)![1];
          c = M.newPlayerCareer(name.trim() || 'השחקן שלי', role, pos, nation, look);
          persist();
          render();
        });
      });
    };
    draw();
  };
  const render = () => {
    if (!c) return create();
    const cc = c;
    const team = M.pTeamData(cc);
    const round = cc.schedule[cc.round];
    const fx = round?.find((p) => p.includes(cc.teamId));
    const oppId = fx ? (fx[0] === cc.teamId ? fx[1] : fx[0]) : null;
    const opp = oppId ? teamById(oppId)! : null;
    const p = cc.player;
    const avg = cc.ratings.length ? (cc.ratings.reduce((a, b) => a + b, 0) / cc.ratings.length).toFixed(1) : '—';
    const tabs = [['home', 'סקירה'], ['train', `אימון${cc.points ? ` (${cc.points})` : ''}`], ['life', 'לייף סטייל'], ['offers', `הצעות${cc.offers.length ? ` (${cc.offers.length})` : ''}`], ['table', 'טבלה']];
    let body = '';
    if (tab === 'home') {
      body = `<div class="cards3">
        <div class="box center">${futCard(p)}<p>${esc(team.name)} · עונה ${cc.season}</p></div>
        <div class="box"><h4>המשחק הבא</h4>${opp ? `<div class="next">${teamBadge(team, 44)}<b>נגד</b>${teamBadge(opp, 44)}</div><p>${esc(opp.name)}</p><p class="obj">🎯 יעד מהמאמן: <b>${esc(cc.objective?.text ?? '')}</b></p><div class="row-btns"><button class="btn primary" data-play>שחק ▶</button><button class="btn" data-sim>סימולציה</button></div>` : '<p>העונה הסתיימה</p>'}</div>
        <div class="box"><h4>סטטיסטיקה</h4><p>הופעות: <b>${cc.apps}</b> · שערים: <b>${cc.goals}</b> · בישולים: <b>${cc.assists}</b></p><p>דירוג ממוצע: <b>${avg}</b></p><p>ניסיון: ${cc.xp}/250 · נקודות: ${cc.points}</p><p>חשבון בנק: <b>${cc.money.toLocaleString()}K ₪</b> · משכורת: ${cc.salary}K למשחק</p></div>
      </div><ul class="news">${cc.news.slice(0, 8).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
    } else if (tab === 'train') {
      const keys: [keyof PlayerData['stats'], string][] = [['pace', 'מהירות'], ['accel', 'תאוצה'], ['agility', 'זריזות'], ['shooting', 'בעיטה'], ['passing', 'מסירה'], ['dribbling', 'כדרור'], ['defending', 'הגנה'], ['physical', 'כוח'], ['stamina', 'סיבולת'], ['composure', 'קור רוח'], ['freeKick', 'בעיטות חופשיות']];
      body = `<p>נקודות לחלוקה: <b>${cc.points}</b> (מקבלים 3 נקודות על כל 250 נקודות ניסיון)</p><div class="train">${keys.map(([k, n]) => `<div class="tr-row"><span>${n}</span><div class="bar"><i style="width:${p.stats[k]}%"></i></div><b>${p.stats[k]}</b><button class="btn tiny" data-up="${k}" ${cc.points ? '' : 'disabled'}>+</button></div>`).join('')}</div><p>כללי: <b>${p.ovr}</b></p>`;
    } else if (tab === 'life') {
      body = `<div class="shop">${M.LIFESTYLE.map((it) => `<div class="box center"><div class="ic">${it.icon}</div><b>${esc(it.name)}</b><p>${it.price.toLocaleString()}K ₪</p>${cc.owned.includes(it.id) ? '<span class="pill">שלך ✓</span>' : `<button class="btn tiny" data-buyl="${it.id}" ${cc.money >= it.price ? '' : 'disabled'}>קנייה</button>`}</div>`).join('')}</div>`;
    } else if (tab === 'offers') {
      body = cc.offers.length ? `<table class="list">${cc.offers.map((o, i) => { const t = teamById(o.teamId)!; return `<tr><td>${teamBadge(t, 24)} ${esc(t.name)} (${t.rating})</td><td>${o.salary}K למשחק</td><td><button class="btn tiny" data-acc="${i}">קבל</button> <button class="btn tiny" data-rej="${i}">דחה</button></td></tr>`; }).join('')}</table>` : '<p>אין הצעות כרגע. הופעות טובות ימשכו מועדונים גדולים.</p>';
    } else body = fullTable(cc.table, cc.teamId);
    screen(`<div class="panel-screen wide">
      <div class="top"><button class="btn" data-back>→ חזרה</button>${face(p, 40)}<h2>${esc(p.name)} <small>${esc(p.role)} · ${esc(team.name)}</small></h2><button class="btn danger tiny" data-reset>קריירה חדשה</button></div>
      <div class="tabs">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>${body}</div>`, (root) => {
      root.querySelector('[data-back]')!.addEventListener('click', home);
      root.querySelector('[data-reset]')!.addEventListener('click', () => { if (confirm('למחוק את הקריירה?')) { c = null; persist(); render(); } });
      root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab!; render(); }));
      root.querySelectorAll<HTMLElement>('[data-up]').forEach((b) => b.addEventListener('click', () => { M.spendPoint(cc, b.dataset.up as keyof PlayerData['stats']); persist(); render(); }));
      root.querySelectorAll<HTMLElement>('[data-buyl]').forEach((b) => b.addEventListener('click', () => { const it = M.LIFESTYLE.find((x) => x.id === b.dataset.buyl)!; cc.money -= it.price; cc.owned.push(it.id); cc.news.unshift(`קנית ${it.name}! ${it.icon}`); persist(); render(); }));
      root.querySelectorAll<HTMLElement>('[data-acc]').forEach((b) => b.addEventListener('click', () => {
        const o = cc.offers[+b.dataset.acc!];
        const t = teamById(o.teamId)!;
        cc.teamId = t.id;
        cc.salary = o.salary;
        cc.offers = [];
        cc.clubs = allTeams().filter((x) => x.league === t.league).map((x) => x.id);
        cc.schedule = M.fixtures(cc.clubs);
        cc.table = M.emptyTable(cc.clubs);
        cc.round = 0;
        cc.player.clubId = t.id;
        cc.news.unshift(`עברת ל${t.name}! משכורת חדשה: ${o.salary}K`);
        persist();
        render();
      }));
      root.querySelectorAll<HTMLElement>('[data-rej]').forEach((b) => b.addEventListener('click', () => { cc.offers.splice(+b.dataset.rej!, 1); persist(); render(); }));
      const after = (myG: number, oppG: number, rating: number, st: { goals: number; assists: number; passOk: number; onTarget: number }) => {
        const [a, b] = fx!;
        const isHome = a === cc.teamId;
        M.applyResult(cc.table, a, b, isHome ? myG : oppG, isHome ? oppG : myG);
        for (const [x, y] of cc.schedule[cc.round]) {
          if (x === cc.teamId || y === cc.teamId) continue;
          const [g1, g2] = M.simulate(teamById(x)!.rating, teamById(y)!.rating);
          M.applyResult(cc.table, x, y, g1, g2);
        }
        const obj = cc.objective?.text ?? '';
        const { done, xp } = M.afterPlayerMatch(cc, rating, st);
        cc.news.unshift(`${myG}-${oppG} מול ${opp!.name} · דירוג ${rating.toFixed(1)}${st.goals ? ` · ${st.goals} שערים` : ''} · יעד "${obj}": ${done ? 'הושג ✓' : 'לא הושג'} · +${xp} ניסיון`);
        cc.round++;
        if (cc.round >= cc.schedule.length) {
          const pos = M.sortTable(cc.table).findIndex((r) => r.id === cc.teamId) + 1;
          cc.news.unshift(`סוף עונה ${cc.season}: ${team.name} במקום ${pos}.`);
          cc.season++;
          cc.round = 0;
          cc.table = M.emptyTable(cc.clubs);
          cc.schedule = M.fixtures(cc.clubs);
          cc.player.age++;
        }
        persist();
        render();
      };
      root.querySelector('[data-sim]')?.addEventListener('click', () => {
        const [g1, g2] = M.simulate(team.rating, opp!.rating);
        const isHome = fx![0] === cc.teamId;
        const goals = Math.random() < (p.pos === 'FWD' ? 0.35 : 0.12) ? 1 : 0;
        after(isHome ? g1 : g2, isHome ? g2 : g1, 6 + Math.random() * 2 + goals, { goals, assists: Math.random() < 0.15 ? 1 : 0, passOk: 5 + Math.floor(Math.random() * 10), onTarget: goals + (Math.random() < 0.5 ? 1 : 0) });
      });
      root.querySelector('[data-play]')?.addEventListener('click', async () => {
        const isHome = fx![0] === cc.teamId;
        const H = isHome ? team : opp!;
        const A = isHome ? opp! : team;
        const xi = M.pCareerXI(cc, team);
        const setup = baseSetup(H, A, { pads: isHome ? [0, null] : [null, 0], careerPlayerId: 'me', title: `קריירת שחקן – ${esc(cc.objective?.text ?? '')}`, time: (['day', 'dusk', 'night'] as TimeOfDay[])[cc.round % 3] });
        if (isHome) setup.homeXI = xi;
        else setup.awayXI = xi;
        const r = await preMatch(setup);
        if (!r) return render();
        const myG = isHome ? r.goals[0] : r.goals[1];
        const oppG = isHome ? r.goals[1] : r.goals[0];
        const st = r.playerStats['me'];
        after(myG, oppG, r.ratings['me'] ?? 6, { goals: st?.goals ?? 0, assists: st?.assists ?? 0, passOk: st?.passOk ?? 0, onTarget: st?.onTarget ?? 0 });
      });
    });
  };
  render();
}

// ---------------------------------------------------------------- ultimate team
const UT_KITS: Kit[] = [
  { shirt: '#111827', sleeve: '#f59e0b', shorts: '#111827', socks: '#f59e0b', number: '#f59e0b' },
  { shirt: '#7c3aed', sleeve: '#ffffff', shorts: '#ffffff', socks: '#7c3aed', number: '#ffffff' },
  { shirt: '#0ea5e9', sleeve: '#0c4a6e', shorts: '#0c4a6e', socks: '#0ea5e9', number: '#0c4a6e' },
  { shirt: '#dc2626', sleeve: '#fde047', shorts: '#111111', socks: '#dc2626', number: '#fde047' },
  { shirt: '#16a34a', sleeve: '#ffffff', shorts: '#16a34a', socks: '#ffffff', number: '#ffffff', stripes: '#ffffff' },
];

function ultimate() {
  let ut = M.load<M.UT | null>('fb-ut', null);
  if (!ut) ut = M.newUT();
  const u = ut;
  let tab = 'squad';
  let kitIdx = M.load('fb-ut-kit', 0);
  let pickSlot: number | null = null;
  const persist = () => M.save('fb-ut', u);
  persist();
  const idx = M.playerIndex();
  const render = () => {
    M.refreshMarket(u);
    persist();
    const chem = M.chemistry(u);
    const slots = FORMATIONS[u.formation];
    const team = M.utTeamData(u, UT_KITS[kitIdx]);
    const tabs = [['squad', 'הקבוצה'], ['packs', 'מארזים'], ['club', `מועדון (${u.club.length})`], ['market', 'שוק העברות'], ['play', 'שחק']];
    let body = '';
    if (tab === 'squad') {
      const rows = new Map<number, number[]>();
      slots.forEach((s, i) => {
        const key = s.pos === 'GK' ? -1 : Math.round(s.depth * 4);
        rows.set(key, [...(rows.get(key) ?? []), i]);
      });
      const order = [...rows.keys()].sort((a, b) => b - a);
      body = `<div class="opts"><label class="field">שם הקבוצה<input data-name value="${esc(u.name)}" maxlength="20"></label>
        <label class="field">מערך<select data-f>${Object.keys(FORMATIONS).map((f) => `<option ${f === u.formation ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <div class="field">תלבושת<div class="swatches">${UT_KITS.map((k, i) => `<button style="background:linear-gradient(90deg, ${k.shirt} 50%, ${k.sleeve} 50%)" class="${i === kitIdx ? 'on' : ''}" data-kit="${i}"></button>`).join('')}</div></div>
        <button class="btn" data-auto>הרכב אוטומטי</button>
        <span class="pill">כימיה: <b>${chem.total}/33</b></span><span class="pill">דירוג: <b>${team?.team.rating ?? '—'}</b></span></div>
        <div class="pitch">${order.map((r) => `<div class="prow">${rows.get(r)!.sort((a, b) => slots[a].w - slots[b].w).map((i) => {
          const c = u.squad[i] ? u.club.find((x) => x.uid === u.squad[i]) : null;
          const p = c ? idx.get(c.pid) : null;
          return `<button class="slot ${pickSlot === i ? 'on' : ''}" data-slot="${i}">${p ? futCard(p, { rare: c!.rare, small: true, chem: chem.per[i] }) : `<div class="empty">+<br>${slots[i].role}</div>`}<small>${slots[i].role}</small></button>`;
        }).join('')}</div>`).join('')}</div>
        ${pickSlot !== null ? `<h4>בחר שחקן לעמדת ${slots[pickSlot].role}</h4><div class="cards">${u.club.filter((c) => idx.get(c.pid)!.pos === slots[pickSlot!].pos && !u.squad.includes(c.uid)).sort((a, b) => M.cardOvr(idx.get(b.pid)!, b.rare) - M.cardOvr(idx.get(a.pid)!, a.rare)).map((c) => futCard(idx.get(c.pid)!, { rare: c.rare, small: true, data: `data-put="${c.uid}"` })).join('') || '<p>אין שחקנים מתאימים במועדון – פתח מארזים או קנה בשוק.</p>'}</div>` : '<p class="tdesc">לחץ על עמדה כדי להחליף שחקן. כימיה: 2+ שחקנים מאותו מועדון, 3+ מאותה ליגה, 2+ מאותו לאום – ושחקן בעמדה הטבעית שלו.</p>'}`;
    } else if (tab === 'packs') {
      body = `<p class="pill big">🪙 ${u.coins.toLocaleString()} מטבעות</p><div class="packs">${(['bronze', 'silver', 'gold'] as M.PackId[]).map((id) => `<button class="pack ${id}" data-pack="${id}" ${u.coins >= M.PACKS[id].price ? '' : 'disabled'}><b>${M.PACKS[id].name}</b><small>${M.PACKS[id].n} קלפים</small><span>🪙 ${M.PACKS[id].price.toLocaleString()}</span></button>`).join('')}</div><ul class="news">${u.log.slice(0, 10).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
    } else if (tab === 'club') {
      const sorted = [...u.club].sort((a, b) => M.cardOvr(idx.get(b.pid)!, b.rare) - M.cardOvr(idx.get(a.pid)!, a.rare));
      body = `<p class="tdesc">מכירה מהירה = 30% מהשווי מיד. רישום בשוק = קונים וירטואליים קונים לאורך זמן (5% עמלה).</p><div class="cards">${sorted.map((c) => {
        const p = idx.get(c.pid)!;
        const v = M.cardValue(p, c.rare);
        const listed = u.listed.find((l) => l.uid === c.uid);
        const inSquad = u.squad.includes(c.uid);
        return `<div class="cardwrap">${futCard(p, { rare: c.rare, small: true })}<small>שווי ~${v}</small>${inSquad ? '<span class="pill">בהרכב</span>' : listed ? `<span class="pill">ברשימה: ${listed.price}</span><button class="btn tiny" data-unlist="${c.uid}">בטל</button>` : `<button class="btn tiny" data-qs="${c.uid}">מכירה מהירה ${Math.round(v * 0.3)}</button><button class="btn tiny" data-list="${c.uid}">לשוק ${v}</button>`}</div>`;
      }).join('')}</div>`;
    } else if (tab === 'market') {
      body = `<p class="pill big">🪙 ${u.coins.toLocaleString()} מטבעות</p><p class="tdesc">השוק מתעדכן כל הזמן – מחירים משתנים ומודעות פגות.</p><div class="cards">${[...u.market].sort((a, b) => a.price - b.price).map((m) => {
        const p = idx.get(m.pid)!;
        const mins = Math.max(0, Math.round((m.until - Date.now()) / 60000));
        return `<div class="cardwrap">${futCard(p, { rare: m.rare, small: true })}<small>⏱ ${mins} דק'</small><button class="btn tiny" data-bn="${m.uid}" ${u.coins >= m.price ? '' : 'disabled'}>קנה עכשיו 🪙${m.price}</button></div>`;
      }).join('')}</div>`;
    } else if (tab === 'play') {
      body = `<div class="cards3">
        <div class="box"><h4>ליגת יריבויות</h4><p>דרג <b>${u.division}</b> · ${u.points} נקודות (${u.played}/5 משחקים)</p><p class="tdesc">7 נקודות = עלייה בדרג. פחות מ-4 אחרי 5 משחקים = ירידה.</p><button class="btn primary" data-rivals ${team ? '' : 'disabled'}>שחק ▶</button></div>
        <div class="box"><h4>אלופים</h4>${u.division <= 3 ? (u.champions ? `<p>${u.champions.wins} ניצחונות מתוך ${u.champions.played} (מתוך 5)</p>` : '<p>הצטרפת לאליטה! סבב של 5 משחקים קשים עם פרסים גדולים.</p>') + `<button class="btn primary" data-champ ${team ? '' : 'disabled'}>שחק ▶</button>` : '<p>נפתח בדרג 3 ומעלה.</p>'}</div>
        <div class="box"><h4>הקבוצה שלך</h4><p>${esc(u.name)} · דירוג ${team?.team.rating ?? '—'} · כימיה ${chem.total}</p>${team ? '' : '<p class="warn">ההרכב לא מלא – השלם 11 שחקנים.</p>'}</div>
      </div><p class="tdesc">המשחקים נגד יריבים וירטואליים (אין שרת רשת במשחק הזה).</p>`;
    }
    screen(`<div class="panel-screen wide">
      <div class="top"><button class="btn" data-back>→ חזרה</button><h2>קבוצת חלומות <small>🪙 ${u.coins.toLocaleString()}</small></h2></div>
      <div class="tabs">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>${body}</div>`, (root) => {
      root.querySelector('[data-back]')!.addEventListener('click', home);
      root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab!; pickSlot = null; render(); }));
      root.querySelector<HTMLInputElement>('[data-name]')?.addEventListener('change', (e) => { u.name = (e.target as HTMLInputElement).value || u.name; persist(); });
      root.querySelector<HTMLSelectElement>('[data-f]')?.addEventListener('change', (e) => { u.formation = (e.target as HTMLSelectElement).value; M.autoSquad(u); render(); });
      root.querySelectorAll<HTMLElement>('[data-kit]').forEach((b) => b.addEventListener('click', () => { kitIdx = +b.dataset.kit!; M.save('fb-ut-kit', kitIdx); render(); }));
      root.querySelector('[data-auto]')?.addEventListener('click', () => { M.autoSquad(u); render(); });
      root.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) => b.addEventListener('click', () => { pickSlot = +b.dataset.slot!; render(); }));
      root.querySelectorAll<HTMLElement>('[data-put]').forEach((b) => b.addEventListener('click', () => { u.squad[pickSlot!] = b.dataset.put!; pickSlot = null; render(); }));
      root.querySelectorAll<HTMLElement>('[data-pack]').forEach((b) => b.addEventListener('click', () => { const cards = M.openPack(u, b.dataset.pack as M.PackId); persist(); packReveal(cards, idx).then(render); }));
      root.querySelectorAll<HTMLElement>('[data-qs]').forEach((b) => b.addEventListener('click', () => {
        const c = u.club.find((x) => x.uid === b.dataset.qs)!;
        const v = Math.round(M.cardValue(idx.get(c.pid)!, c.rare) * 0.3);
        u.coins += v;
        u.club = u.club.filter((x) => x.uid !== c.uid);
        render();
      }));
      root.querySelectorAll<HTMLElement>('[data-list]').forEach((b) => b.addEventListener('click', () => {
        const c = u.club.find((x) => x.uid === b.dataset.list)!;
        const v = M.cardValue(idx.get(c.pid)!, c.rare);
        const price = Math.max(100, Math.round(+(prompt('מחיר "קנה עכשיו"?', String(v)) ?? v) / 50) * 50);
        u.listed.push({ uid: c.uid, price, at: Date.now() });
        render();
      }));
      root.querySelectorAll<HTMLElement>('[data-unlist]').forEach((b) => b.addEventListener('click', () => { u.listed = u.listed.filter((l) => l.uid !== b.dataset.unlist); render(); }));
      root.querySelectorAll<HTMLElement>('[data-bn]').forEach((b) => b.addEventListener('click', () => {
        const m = u.market.find((x) => x.uid === b.dataset.bn)!;
        if (u.coins < m.price) return;
        u.coins -= m.price;
        u.club.push({ uid: m.uid, pid: m.pid, rare: m.rare });
        u.market = u.market.filter((x) => x.uid !== m.uid);
        u.log.unshift(`קנית את ${idx.get(m.pid)!.name} ב-${m.price}`);
        toast('נקנה! השחקן במועדון שלך');
        render();
      }));
      const play = async (champions: boolean) => {
        if (!team) return;
        if (champions && !u.champions) u.champions = { wins: 0, played: 0 };
        const opp = M.utOpponent(u, champions);
        const setup = baseSetup(team.team, opp, { homeXI: team.xi, homeFormation: u.formation, pads: [0, null], title: champions ? 'אלופים' : `ליגת יריבויות – דרג ${u.division}`, weather: Math.random() < 0.2 ? 'rain' : 'clear', time: 'night' });
        const r = await preMatch(setup);
        if (!r) return render();
        const msg = M.utAfterMatch(u, r.goals[0], r.goals[1], champions);
        persist();
        toast(msg);
        render();
      };
      root.querySelector('[data-rivals]')?.addEventListener('click', () => play(false));
      root.querySelector('[data-champ]')?.addEventListener('click', () => play(true));
    });
  };
  render();
}

function packReveal(cards: M.UTCard[], idx: Map<string, PlayerData>): Promise<void> {
  return new Promise((resolve) => {
    const best = cards[0];
    const bp = best ? idx.get(best.pid)! : null;
    const walkout = bp && M.cardOvr(bp, best.rare) >= 82;
    const md = modal(`<div class="reveal">${walkout ? `<div class="walkout"><div class="flag">${NATION_FLAGS[bp!.nation] ?? ''}</div><div class="pos">${esc(bp!.role)}</div><div class="club">${teamBadge(teamById(bp!.clubId)!, 70)}</div></div>` : ''}<div class="cards reveal-cards">${cards.map((c, i) => `<div class="flip" style="animation-delay:${(walkout ? 3.2 : 0.3) + i * 0.18}s">${futCard(idx.get(c.pid)!, { rare: c.rare })}</div>`).join('')}</div><div class="row-btns"><button class="btn primary">לשמור במועדון</button></div></div>`, 'dark');
    if (walkout) audio.roar(0.7);
    md.el.querySelector('button')!.addEventListener('click', () => { md.close(); resolve(); });
  });
}

// ---------------------------------------------------------------- settings & help
function settingsScreen() {
  screen(`<div class="panel-screen">
    <div class="top"><button class="btn" data-back>→ חזרה</button><h2>הגדרות</h2></div>
    <div class="opts col">
      <label class="field">איכות גרפיקה<select data-k="quality"><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>גבוהה (צללים חדים, קהל מלא)</option><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>חסכונית (טלפונים)</option></select></label>
      <label class="field">רמת קושי<select data-k="difficulty">${M.DIFFICULTIES.map((d, i) => `<option value="${i}" ${settings.difficulty === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="field">אורך מחצית<select data-k="halfMinutes">${[2, 3, 4, 6, 8, 10].map((m) => `<option value="${m}" ${settings.halfMinutes === m ? 'selected' : ''}>${m} דקות</option>`).join('')}</select></label>
      <label class="field">עוצמת שמע <input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-k="volume"></label>
      <label class="check"><input type="checkbox" data-k="commentary" ${settings.commentary ? 'checked' : ''}> קריינות קולית בעברית${audio.hasHebrewVoice ? '' : ' (לא נמצא קול עברי בדפדפן – יוצגו כתוביות)'}</label>
      <label class="check"><input type="checkbox" data-k="radar" ${settings.radar ? 'checked' : ''}> מכ"ם</label>
      <label class="check"><input type="checkbox" data-k="guide" ${settings.guide ? 'checked' : ''}> קו עזר למסלול הבעיטה וההגבהה</label>
      <label class="check"><input type="checkbox" data-k="retro" ${settings.retro ? 'checked' : ''}> שידור רטרו (מראה טלוויזיה של שנות ה-80/90)</label>
      <label class="field">זום מצלמה <input type="range" min="0.6" max="1.6" step="0.05" value="${settings.zoom}" data-k="zoom"></label>
      <label class="field">כפתורי מגע<select data-k="touch"><option value="auto" ${settings.touch === 'auto' ? 'selected' : ''}>אוטומטי</option><option value="on" ${settings.touch === 'on' ? 'selected' : ''}>תמיד</option><option value="off" ${settings.touch === 'off' ? 'selected' : ''}>כבוי</option></select></label>
      <p class="tdesc">שינוי איכות הגרפיקה נכנס לתוקף אחרי רענון הדף.</p>
    </div></div>`, (root) => {
    root.querySelector('[data-back]')!.addEventListener('click', home);
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) =>
      el.addEventListener('change', () => {
        const k = el.dataset.k as keyof M.Settings;
        const v = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el instanceof HTMLInputElement && el.type === 'range' ? +el.value : k === 'difficulty' || k === 'halfMinutes' ? +el.value : el.value;
        (settings as unknown as Record<string, unknown>)[k] = v;
        saveSettings();
        audio.setVolume(settings.volume);
        audio.speech = settings.commentary;
        applyRetro();
      }),
    );
  });
}

function controlsModal() {
  const md = modal(`<h2>מקשים ושליטה</h2>
    <table class="list keys"><tr><th>מקלדת</th><th>שלט</th><th>בהתקפה</th><th>בהגנה</th></tr>
    ${CONTROL_HELP.map((r) => `<tr><td><kbd>${esc(r.keys)}</kbd></td><td>${esc(r.pad)}</td><td>${esc(r.attack)}</td><td>${esc(r.defend)}</td></tr>`).join('')}</table>
    <h3>עבירות (בהגנה)</h3>
    <table class="list keys">${FOUL_HELP.map(([k, d]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table>
    <h3>מצבים נייחים</h3>
    <ul class="news">
      <li><b>בעיטה חופשית ישירה:</b> WASD מזיז את הכוונת על השער, החצים קובעים סיבוב (שמאל/ימין = עקמומיות, למעלה = טופ-ספין, למטה = דרייב נמוך), החזק ף לעוצמה ושחרר (ל = הרמה, ך = מסירה). קו העזר מראה את תחילת המסלול – ארוך יותר לבועטים טובים.</li>
      <li><b>קרן:</b> WASD בוחר נקודת נחיתה, חצים לסיבוב, החזק ל להרמה או ך למסירה קצרה.</li>
      <li><b>פנדל:</b> כוון עם WASD, החזק ף לעוצמה ושחרר כשמעגל הריכוז הכי קטן (ירוק). עייפות ולחץ מקשים על הריכוז.</li>
      <li><b>שוער בפנדל נגדך:</b> בחר צד עם A/D לפני הבעיטה.</li>
      <li><b>חומה:</b> ל מחליף קפיצה/עמידה, החזק C + כיוון כדי להזיז את החומה.</li>
    </ul>
    <pre class="diamond">        [ ל ] הגבהה
[ ם ] מגן        [ ף ] בעיטה
        [ ך ] מסירה</pre>
    <p class="tdesc">כפתורי הפעולה מסודרים כמו בשלט נינטנדו סוויץ' (במקלדת אנגלית: K, O, ;, L). מסירת עומק: ן (I). שלט סוויץ' / Xbox / פלייסטיישן מתחבר לפי מיקום הכפתורים.</p>
    <p class="tdesc">שני שחקנים מקומיים: בחר "שני שחקנים" במשחק מהיר – שחקן 1 במקלדת, שחקן 2 בשלט.</p>
    <div class="row-btns"><button class="btn primary">סגור</button></div>`);
  md.el.querySelector('.row-btns button')!.addEventListener('click', md.close);
}

home();
document.getElementById('boot')?.remove();

// Test hook: /football/?debug exposes the running match so automated tests can fast-forward it.
if (location.search.includes('debug')) {
  (window as unknown as Record<string, unknown>).__fb = {
    get match() {
      return match;
    },
    quick(homeId: string, awayId: string, over: Partial<MatchSetup> = {}) {
      return playMatch(baseSetup(teamById(homeId)!, teamById(awayId)!, over));
    },
    input,
    setDebugHook,
    set noRender(v: boolean) {
      debugNoRender = v;
    },
  };
}

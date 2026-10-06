import * as THREE from 'three';
import { FORMATIONS, TACTICS, type Kit, type PlayerData, type Slot, type Tactic, type TacticId, type TeamData } from './data';
import { BALL_R, BallBody, FIELD, G, groundSpeedFor, lobVelocity, predictPath, rollTime, type BallEvent } from './physics';
import { JOINTS, PlayerModel, type ActionKind, type PoseState } from './playerModel';
import { Stadium, type TimeOfDay, type Weather } from './stadium';
import { statsTable, type Hud, type HudTeam } from './hud';
import type { GameAudio } from './audio';
import type { Btn, Input, Pad } from './input';
import { analyst, line, type CEvent } from './commentary';
import { aiThink, aiMove, keeperThink } from './ai';

const V = THREE.Vector3;
type V3 = THREE.Vector3;
const { HL, HW, GOAL_HW, GOAL_H, BOX_D, BOX_HW } = FIELD;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const wrapAng = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const hdist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.z - b.z);
export const angOf = (x: number, z: number) => Math.atan2(x, z);
export function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function rotY(v: V3, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = v.x * c + v.z * s;
  const z = -v.x * s + v.z * c;
  v.x = x;
  v.z = z;
  return v;
}

export interface MatchSetup {
  home: TeamData;
  away: TeamData;
  homeKit: Kit;
  awayKit: Kit;
  homeXI: PlayerData[];
  awayXI: PlayerData[];
  homeFormation: string;
  awayFormation: string;
  homeTactic: TacticId;
  awayTactic: TacticId;
  pads: [number | null, number | null];
  careerPlayerId?: string | null;
  halfSeconds: number;
  difficulty: number;
  weather: Weather;
  time: TimeOfDay;
  knockout: boolean;
  quality: 'high' | 'low';
  cameraZoom: number;
  title: string;
  commentary: boolean;
}

export interface PStats {
  passes: number;
  passOk: number;
  shots: number;
  onTarget: number;
  goals: number;
  assists: number;
  tackles: number;
  saves: number;
  fouls: number;
  conceded: number;
  yellow: number;
  red: boolean;
  minutes: number;
}

export interface TeamStats {
  poss: number;
  shots: number;
  onTarget: number;
  passes: number;
  passOk: number;
  fouls: number;
  yellows: number;
  reds: number;
  corners: number;
  offsides: number;
  tackles: number;
  saves: number;
}

export interface MatchResult {
  goals: [number, number];
  pens: [number, number] | null;
  scorers: { side: number; name: string; minute: number; own: boolean; id: string }[];
  ratings: Record<string, number>;
  playerStats: Record<string, PStats>;
  stats: TeamStats[];
  winner: 0 | 1 | -1;
  quit?: boolean;
}

export type KickType = 'pass' | 'through' | 'lob' | 'cross' | 'shot' | 'clear' | 'gkThrow' | 'gkKick' | 'throwIn';

export interface KickOrder {
  type: KickType;
  power: number;
  dir: V3 | null;
  target?: Plr | null;
  point?: V3;
  finesse?: boolean;
  chip?: boolean;
  timed?: 'green' | 'yellow' | 'red' | null;
  spinX?: number; // set piece contact: + curl to the kicker's left
  spinY?: number; // + topspin, - knuckle / driven
  aim?: { z: number; y: number }; // set piece goal aim
  t: number;
  setPiece?: boolean;
}

interface Action {
  kind: ActionKind;
  t: number;
  dur: number;
  contact: number;
  fired: boolean;
  order?: KickOrder;
  dir?: V3;
  hitBall?: boolean;
  spin?: number;
}

export class Team {
  players: Plr[] = [];
  bench: PlayerData[] = [];
  dir: 1 | -1;
  score = 0;
  controlled: Plr | null = null;
  stats: TeamStats = { poss: 0, shots: 0, onTarget: 0, passes: 0, passOk: 0, fouls: 0, yellows: 0, reds: 0, corners: 0, offsides: 0, tackles: 0, saves: 0 };
  tactic: Tactic;
  slots: Slot[];
  lostBallAt = -10;
  pressHeld = false;
  constructor(public side: 0 | 1, public data: TeamData, public kit: Kit, formation: string, tactic: TacticId, public pad: number | null) {
    this.dir = side === 0 ? 1 : -1;
    this.tactic = TACTICS[tactic];
    this.slots = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  }
  along(p: V3) {
    return p.x * this.dir + HL;
  }
  lat(p: V3) {
    return p.z * this.dir;
  }
  world(a: number, w: number, out = new V()) {
    return out.set((a - HL) * this.dir, 0, w * this.dir);
  }
  get gk() {
    return this.players[0];
  }
  active() {
    return this.players.filter((p) => !p.sent);
  }
  get color() {
    return this.kit.shirt;
  }
}

export class Plr {
  pos = new V();
  vel = new V();
  facing = 0;
  model: PlayerModel;
  stamina = 1;
  action: Action | null = null;
  pending: KickOrder | null = null;
  charge = 0;
  charging: KickType | null = null;
  chargeMods = { finesse: false, chip: false };
  touchCD = 0;
  kickCD = 0;
  stun = 0;
  yellow = 0;
  sent = false;
  phase = Math.random() * 6;
  turn = 0;
  accelF = 0;
  recv: { point: V3; t: number } | null = null;
  ai = {
    target: new V(),
    speed: 0.7,
    sprint: false,
    look: null as V3 | null,
    decide: Math.random() * 0.5,
    run: null as null | { target: V3; t: number; kind: string },
    tackleCD: 1,
    jockey: false,
    role: 'idle' as 'idle' | 'chase' | 'press' | 'carrier' | 'support' | 'mark' | 'hold' | 'keeper',
    mark: null as Plr | null,
  };
  pose: PoseState;
  stats: PStats = { passes: 0, passOk: 0, shots: 0, onTarget: 0, goals: 0, assists: 0, tackles: 0, saves: 0, fouls: 0, conceded: 0, yellow: 0, red: false, minutes: 0 };
  hs: number;
  isGK: boolean;
  celebrate = 0;
  gk = { react: -1, saveTried: false, holdT: 0, diveVel: new V(), ix: 0, iy: 0, iz: 0, it: 0, smother: 0 };

  constructor(public d: PlayerData, public team: Team, public slot: Slot, public idx: number) {
    this.isGK = slot.pos === 'GK';
    this.model = new PlayerModel(d, this.isGK ? team.data.gkKit : team.kit, this.isGK);
    this.hs = d.height / 182;
    this.pose = {
      speed: 0, phase: 0, turn: 0, accel: 0, action: null, actionT: 0, actionDur: 1, contact: 0.5,
      leftFoot: d.foot === 'L', diveSide: 1, diveHigh: 0, jockey: false, isGK: this.isGK, gkReady: false, time: 0, celebrateStyle: 0,
    };
  }

  get s() {
    return this.d.stats;
  }
  dir(out = new V()) {
    return out.set(Math.sin(this.facing), 0, Math.cos(this.facing));
  }
  maxSpeed(sprint: boolean, withBall: boolean) {
    const base = 5.3 + 4.4 * (this.s.pace / 100);
    return base * (sprint ? 1 : 0.68) * (0.78 + 0.22 * this.stamina) * (withBall ? (sprint ? 0.93 : 0.92) : 1);
  }
  busy() {
    return !!this.action && ['slide', 'fallen', 'dive', 'tackle', 'throw', 'celebrate'].includes(this.action.kind);
  }
  down() {
    return !!this.action && (this.action.kind === 'fallen' || (this.action.kind === 'slide' && this.action.t > 0.15) || this.action.kind === 'dive');
  }
}

type Phase = 'intro' | 'play' | 'dead' | 'setpiece' | 'goal' | 'replay' | 'halftime' | 'fulltime' | 'over';

export type SPKind = 'kickoff' | 'throw' | 'corner' | 'goalkick' | 'freekick' | 'penalty';

export interface SetPiece {
  kind: SPKind;
  team: Team;
  spot: V3;
  taker: Plr;
  direct: boolean;
  wall: Plr[];
  t: number;
  aimZ: number;
  aimY: number;
  aimPoint: V3;
  spinX: number;
  spinY: number;
  charging: boolean;
  power: number;
  ringT: number;
  shootout: boolean;
  gkGuess: number | null;
  wallJump: boolean;
  wallShift: number;
  taken: boolean;
}

const REPLAY_FRAMES = 240;
const SNAP = 7 + 22 * (5 + JOINTS);

export class Match {
  stadium: Stadium;
  ball = new BallBody();
  ballMesh: THREE.Mesh;
  teams: [Team, Team];
  all: Plr[] = [];
  owner: Plr | null = null;
  held: Plr | null = null;
  lastTouch: Plr | null = null;
  prevTouch: Plr | null = null;
  possTeam: Team | null = null;
  lastKick: { p: Plr; type: KickType; t: number } | null = null;
  phase: Phase = 'intro';
  phaseT = 0;
  sp: SetPiece | null = null;
  nextSP: (() => SetPiece) | null = null;
  half = 1;
  clock = 0; // real seconds elapsed in the half
  added = 0;
  time = 0;
  kickoffTeam = 0;
  offside: { team: Team; passer: Plr; set: Set<Plr> } | null = null;
  scorers: MatchResult['scorers'] = [];
  shootout: { kicks: [boolean[], boolean[]]; turn: number; order: [Plr[], Plr[]]; idx: [number, number] } | null = null;
  pred: V3[] = [];
  predT = 0;
  excitement = 0.25;
  paused = false;
  done = false;
  onEnd: (r: MatchResult) => void = () => {};
  events: BallEvent[] = [];
  private acc = 0;
  private replayBuf: Float32Array[] = [];
  private replayHead = 0;
  private replayCount = 0;
  private replayPos = 0;
  private replayEnd = 0;
  private recordTick = 0;
  private camPos = new V(0, 30, 60);
  private camLook = new V();
  private camMode: 'broadcast' | 'setpiece' | 'replay' | 'celebrate' | 'intro' = 'intro';
  private rings: THREE.Mesh[] = [];
  private arrows: THREE.Mesh[] = [];
  private aimGroup = new THREE.Group();
  private trajLine: THREE.Line;
  private reticle: THREE.Mesh;
  private compRing: THREE.Mesh;
  private shotAnnounced = false;
  private lastCommentT = -10;
  private possCommentT = 60;
  private goalSide = 0;
  private stickWorld = new V();
  private tmp = new V();
  private tmp2 = new V();
  private skipHeld = 0;
  careerId: string | null;
  callForBall = -1;

  constructor(
    public scene: THREE.Scene,
    public renderer: THREE.WebGLRenderer,
    public camera: THREE.PerspectiveCamera,
    public setup: MatchSetup,
    public hud: Hud,
    public audio: GameAudio,
    public input: Input,
  ) {
    this.careerId = setup.careerPlayerId ?? null;
    this.stadium = new Stadium(scene, renderer, {
      weather: setup.weather,
      time: setup.time,
      quality: setup.quality,
      homeColors: [setup.homeKit.shirt, setup.homeKit.shorts],
      awayColors: [setup.awayKit.shirt, setup.awayKit.shorts],
      name: setup.home.stadium,
    });
    const home = new Team(0, setup.home, setup.homeKit, setup.homeFormation, setup.homeTactic, setup.pads[0]);
    const away = new Team(1, setup.away, setup.awayKit, setup.awayFormation, setup.awayTactic, setup.pads[1]);
    this.teams = [home, away];
    for (const t of this.teams) {
      const xi = t.side === 0 ? setup.homeXI : setup.awayXI;
      t.players = xi.map((d, i) => new Plr(d, t, t.slots[i], i));
      t.bench = (t.side === 0 ? setup.home : setup.away).players.filter((p) => !xi.includes(p));
      for (const p of t.players) {
        this.scene.add(p.model.root);
        this.all.push(p);
      }
    }
    // ball
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 18), new THREE.MeshStandardMaterial({ map: ballTexture(setup.weather === 'snow'), roughness: 0.45 }));
    this.ballMesh.castShadow = true;
    scene.add(this.ballMesh);
    // control indicators
    const ringColors = [0x22d3ee, 0xf43f5e];
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 32), new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0.85, depthWrite: false }));
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      scene.add(r);
      this.rings.push(r);
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 3), new THREE.MeshBasicMaterial({ color: ringColors[i] }));
      a.rotation.x = Math.PI;
      a.visible = false;
      scene.add(a);
      this.arrows.push(a);
    }
    // set-piece aim helpers
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3));
    this.trajLine = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xfde047, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.95, depthTest: false }));
    this.trajLine.frustumCulled = false;
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, depthTest: false, transparent: true }));
    this.compRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.85 }));
    this.aimGroup.add(this.trajLine, this.reticle, this.compRing);
    this.aimGroup.visible = false;
    this.aimGroup.renderOrder = 20;
    scene.add(this.aimGroup);

    for (let i = 0; i < REPLAY_FRAMES; i++) this.replayBuf.push(new Float32Array(SNAP));

    const ht = (t: Team): HudTeam => ({ short: t.data.short, name: t.data.name, color: t.kit.shirt, color2: t.kit.shorts });
    hud.setTeams(ht(home), ht(away));
    this.added = 1 + Math.floor(Math.random() * 3);
    this.kickoffTeam = Math.random() < 0.5 ? 0 : 1;
    this.placeKickoff(this.teams[this.kickoffTeam]);
    this.phase = 'intro';
    this.camMode = 'intro';
    this.phaseT = 0;
    this.updateHudScore();
    for (const t of this.teams) if (t.pad !== null) this.input.splitGamepad = this.setup.pads[0] !== null && this.setup.pads[1] !== null;
    this.audio.crowd(true);
  }

  // ------------------------------------------------------------------ helpers
  opp(t: Team) {
    return this.teams[1 - t.side];
  }
  env() {
    return this.stadium.env;
  }
  get minute() {
    return Math.min(45 + this.added, (this.clock / this.setup.halfSeconds) * 45) + (this.half - 1) * 45;
  }
  isHuman(p: Plr) {
    if (p.team.pad === null) return false;
    if (this.careerId) return p.d.id === this.careerId;
    if (p.isGK && this.phase !== 'setpiece') return false;
    return p.team.controlled === p;
  }
  padOf(t: Team): Pad | null {
    return t.pad === null ? null : this.input.pad(t.pad);
  }
  inBox(t: Team, pos: V3) {
    // t's own penalty area
    return t.along(pos) < BOX_D + 0.1 && Math.abs(pos.z) < BOX_HW + 0.1;
  }
  stickToWorld(mx: number, my: number, out: V3) {
    const cam = this.camera;
    const f = this.tmp2.set(0, 0, -1).applyQuaternion(cam.quaternion);
    f.y = 0;
    f.normalize();
    const r = new V(-f.z, 0, f.x); // right of forward on the ground
    return out.set(0, 0, 0).addScaledVector(r, mx).addScaledVector(f, my);
  }
  pressureOn(p: Plr) {
    let best = 9;
    for (const q of this.opp(p.team).players) if (!q.sent) best = Math.min(best, hdist(q.pos, p.pos));
    return clamp((2.6 - best) / 2, 0, 1);
  }
  comment(ev: CEvent, vars: Record<string, string | number> = {}, priority = false) {
    if (!priority && this.time - this.lastCommentT < 3) return;
    this.lastCommentT = this.time;
    const s = line(ev, vars);
    this.hud.comment(s);
    if (this.setup.commentary) this.audio.say(s.replace(/[!?]/g, ''), priority);
    const a = analyst(ev);
    if (a) setTimeout(() => !this.done && this.hud.comment(a), 2600);
  }
  updateHudScore() {
    const m = Math.floor(this.minute);
    const base = (this.half - 1) * 45 + 45;
    const extra = m >= base && this.phase === 'play' ? `+${this.added}` : '';
    const clock = m >= base ? `${base}'` : `${m}'`;
    this.hud.setScore(this.teams[0].score, this.teams[1].score, this.shootout ? 'פנדלים' : clock, this.shootout ? '' : extra);
  }

  // ------------------------------------------------------------------ main loop
  update(frameDt: number) {
    const dt = Math.min(frameDt, 0.1);
    this.input.poll();
    this.hud.update(dt);
    this.handleStart();
    if (this.paused || this.done) {
      this.render(dt);
      return;
    }
    if (this.phase === 'play' || this.phase === 'setpiece') this.handleHumans(dt);
    this.acc += dt;
    const step = 1 / 60;
    while (this.acc >= step) {
      this.acc -= step;
      this.step(step);
    }
    this.render(dt);
  }

  private handleStart() {
    for (const t of this.teams) {
      const pad = this.padOf(t);
      if (pad?.pressed.has('START') && !this.hud.panelOpen) this.onPause?.();
    }
    // skip intro / replay with A; A also closes the half-time / full-time panel
    const p0 = this.input.pad(0);
    if (this.hud.panelOpen && this.hud.panelAge() > 0.8 && (p0.pressed.has('A') || p0.pressed.has('B'))) this.hud.panelResolve?.();
    if ((this.phase === 'intro' || this.phase === 'replay' || (this.phase === 'goal' && this.phaseT > 1.2)) && (p0.pressed.has('A') || p0.pressed.has('B'))) {
      this.skipHeld = 1;
    }
  }
  onPause: (() => void) | null = null;

  private step(dt: number) {
    this.time += dt;
    this.phaseT += dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 6 || this.skipHeld) {
          this.skipHeld = 0;
          this.beginSetPiece(this.makeKickoff(this.teams[this.kickoffTeam]));
          this.comment('kickoff', { team: this.teams[this.kickoffTeam].data.name, stadium: this.setup.home.stadium }, true);
          this.audio.whistle('short');
        }
        this.animatePlayers(dt);
        return;
      case 'replay':
        this.stepReplay(dt);
        return;
      case 'halftime':
      case 'fulltime':
      case 'over':
        this.animatePlayers(dt);
        return;
    }

    if (this.phase === 'play' || this.phase === 'dead' || this.phase === 'goal' || this.phase === 'setpiece') {
      aiThink(this, dt);
    }
    for (const p of this.all) if (!p.sent) this.stepPlayer(p, dt);
    for (const t of this.teams) for (const p of t.players) if (p.isGK && !p.sent) keeperThink(this, p, dt);
    this.stepBall(dt);
    this.collisions(dt);
    if (this.phase === 'play') this.rules(dt);
    this.animatePlayers(dt);

    if (this.phase === 'play') {
      this.clock += dt;
      if (this.possTeam) this.possTeam.stats.poss += dt;
      for (const p of this.all) if (!p.sent) p.stats.minutes += (dt / this.setup.halfSeconds) * 45;
      if (this.clock >= this.setup.halfSeconds * (1 + this.added / 45) && !this.shootout) this.endHalf();
      this.possCommentT -= dt;
      if (this.possCommentT < 0) {
        this.possCommentT = 70 + Math.random() * 40;
        const [a, b] = [this.teams[0].stats.poss, this.teams[1].stats.poss];
        const tot = a + b || 1;
        const lead = a > b ? 0 : 1;
        this.comment('possession', { team: this.teams[lead].data.name, pct: Math.round((Math.max(a, b) / tot) * 100) });
      }
    } else if (this.phase === 'dead') {
      if (this.phaseT > 1.4 && this.nextSP) {
        const mk = this.nextSP;
        this.nextSP = null;
        this.beginSetPiece(mk());
      }
    } else if (this.phase === 'goal') {
      if (this.phaseT > 4.2 || (this.skipHeld && this.phaseT > 1.2)) {
        this.skipHeld = 0;
        if (this.shootout) this.nextShootoutKick();
        else this.startReplay();
      }
    } else if (this.phase === 'setpiece') {
      this.stepSetPiece(dt);
    }
    // excitement for crowd and audio
    const bx = this.ball.pos.x;
    const near = clamp((Math.abs(bx) - 25) / 25, 0, 1);
    this.excitement += (0.2 + near * 0.45 - this.excitement) * dt * 0.6;
    this.recordTick++;
    if (this.recordTick % 2 === 0 && (this.phase === 'play' || this.phase === 'dead' || (this.phase === 'goal' && this.phaseT < 1))) this.record();
  }

  // ------------------------------------------------------------------ human control
  private handleHumans(dt: number) {
    if (this.paused) return;
    for (const t of this.teams) {
      const pad = this.padOf(t);
      if (!pad) continue;
      if (this.phase === 'setpiece') {
        this.humanSetPiece(t, pad, dt);
        continue;
      }
      if (this.phase !== 'play') continue;
      this.humanButtons(t, pad);
    }
    this.handleHumansContinuous(dt);
  }

  private handleHumansContinuous(dt: number) {
    for (const t of this.teams) {
      const pad = this.padOf(t);
      if (!pad || this.phase !== 'play') continue;
      let p = this.careerId ? t.players.find((q) => q.d.id === this.careerId) ?? null : t.controlled;
      if (!this.careerId && (!p || p.sent || p.isGK)) {
        this.switchPlayer(t, null);
        p = t.controlled;
      }
      if (!p || p.sent) continue;
      if (p.charging) p.charge = Math.min(1, p.charge + dt / 0.9);
      // auto-switch to a much closer teammate when the ball is loose
      this.autoSwitchT -= dt;
      if (!this.careerId && !this.owner && !this.held && !p.recv && !p.charging && !p.pending && this.autoSwitchT <= 0) {
        const myD = hdist(p.pos, this.ball.pos);
        if (myD > 10) {
          let best: Plr | null = null;
          let bd = myD * 0.45;
          for (const q of t.players) {
            if (q === p || q.sent || q.isGK) continue;
            const d = hdist(q.pos, this.ball.pos);
            if (d < bd) { bd = d; best = q; }
          }
          if (best) {
            t.controlled = best;
            this.autoSwitchT = 1.2;
          }
        }
      }
    }
  }
  private autoSwitchT = 0;

  private attackingContext(p: Plr) {
    if (this.owner) return this.owner.team === p.team;
    if (this.held) return this.held.team === p.team;
    if (p.recv) return true;
    // loose ball: whoever is close
    const d = hdist(p.pos, this.ball.pos);
    if (d < 3 && this.ball.pos.y < 2.5) return true;
    if (this.lastKick && this.lastKick.p.team === p.team && this.time - this.lastKick.t < 2.5 && this.lastKick.type !== 'shot') return true;
    return false;
  }

  private humanButtons(t: Team, pad: Pad) {
    let p = this.careerId ? t.players.find((q) => q.d.id === this.careerId) ?? null : t.controlled;
    if (!p || p.sent) {
      if (!this.careerId) this.switchPlayer(t, null);
      p = t.controlled;
      if (!p) return;
    }
    this.stickToWorld(pad.mx, pad.my, this.stickWorld);
    const stick = this.stickWorld.lengthSq() > 0.05 ? this.stickWorld.clone().normalize() : null;
    const attacking = this.attackingContext(p);
    const has = (b: Btn) => pad.pressed.has(b);
    const rel = (b: Btn) => pad.released.has(b);

    if (this.careerId && this.owner && this.owner !== p && this.owner.team === p.team && has('A')) this.callForBall = this.time + 1.6;
    if (attacking) {
      // shooting & passing: hold to charge, release to execute (buffered until the ball is playable)
      const start = (type: KickType, b: Btn) => {
        if (has(b) && !p!.charging) {
          // timed finishing: second tap of B during the shot wind-up
          if (b === 'B' && p!.action && p!.action.order?.type === 'shot' && !p!.action.fired) {
            const left = p!.action.dur * p!.action.contact - p!.action.t;
            const res = left <= 0.065 ? 'green' : left <= 0.15 ? 'yellow' : 'red';
            p!.action.order.timed = res;
            const sc = this.toScreen(p!.pos, 2.2);
            this.hud.timed(res, sc.x, sc.y);
            return;
          }
          if (b === 'B' && p!.pending?.type === 'shot') return;
          p!.charging = type;
          p!.charge = 0;
          p!.chargeMods = { finesse: pad.held.RB, chip: pad.held.LB };
        }
        if (rel(b) && p!.charging === type) {
          const order: KickOrder = { type, power: p!.charge, dir: stick, t: 0.9 };
          if (type === 'shot') {
            order.finesse = p!.chargeMods.finesse || pad.held.RB;
            order.chip = p!.chargeMods.chip || pad.held.LB;
          }
          if (type !== 'shot') order.target = this.choosePassTarget(p!, stick, type);
          p!.charging = null;
          p!.pending = order;
        }
      };
      start('pass', 'A');
      start('lob', 'X');
      start('through', 'Y');
      start('shot', 'B');
      // skill moves with the right stick while dribbling
      if (this.owner === p && !p.action) {
        const flick = has('RLEFT') ? [-1, 0] : has('RRIGHT') ? [1, 0] : has('RUP') ? [0, 1] : has('RDOWN') ? [0, -1] : null;
        if (flick) this.skillMove(p, this.stickToWorld(flick[0], flick[1], new V()).normalize());
        if (has('R3')) this.skillMove(p, null);
      }
    } else {
      // defending
      if (has('B') && !p.busy()) this.standingTackle(p);
      if (has('X') && !p.busy()) this.slideTackle(p, stick);
      if (has('LB') && !this.careerId) this.switchPlayer(t, null);
      if (!this.careerId) {
        const flick = has('RLEFT') ? [-1, 0] : has('RRIGHT') ? [1, 0] : has('RUP') ? [0, 1] : has('RDOWN') ? [0, -1] : null;
        if (flick) this.switchPlayer(t, this.stickToWorld(flick[0], flick[1], new V()).normalize());
      }
      p.charging = null;
    }
    t.pressHeld = pad.held.RB && !attacking;
  }

  // Desired velocity for a human-controlled player.
  humanMove(p: Plr, pad: Pad, out: V3): { sprint: boolean; jockey: boolean; face: V3 | null } {
    const stick = this.stickToWorld(pad.mx, pad.my, new V());
    const mag = Math.min(1, stick.length());
    const sprint = pad.held.RT && mag > 0.2;
    const withBall = this.owner === p;
    let jockey = false;
    let face: V3 | null = null;
    const close = withBall && pad.held.LB;
    const shield = withBall && pad.held.LT;
    let speed = p.maxSpeed(sprint && !close, withBall) * (mag < 0.5 ? mag * 1.4 : mag);
    if (close) speed = Math.min(speed, p.maxSpeed(false, true) * 0.6);
    if (!withBall && !this.attackingContext(p)) {
      const carrier = this.owner;
      if (pad.held.LT && carrier) {
        // jockey: face the ball carrier, shuffle, stay goal-side
        jockey = true;
        face = carrier.pos;
        speed = Math.min(speed, p.maxSpeed(false, false) * 0.55);
        const own = new V(-p.team.dir * HL, 0, 0);
        const goalSide = carrier.pos.clone().add(own.sub(carrier.pos).normalize().multiplyScalar(1.9));
        if (mag < 0.2) {
          stick.copy(goalSide).sub(p.pos);
          if (stick.length() > 0.3) stick.normalize().multiplyScalar(0.6);
          else stick.set(0, 0, 0);
          speed = p.maxSpeed(false, false) * 0.5;
        }
      } else if (pad.held.A && (carrier || this.ball)) {
        // contain: close down the ball automatically
        const tgt = carrier ? carrier.pos.clone().addScaledVector(new V(-p.team.dir, 0, 0), 1.2) : this.ball.pos.clone();
        if (mag < 0.2) {
          stick.copy(tgt).sub(p.pos).setY(0);
          if (stick.length() > 0.5) stick.normalize();
          speed = p.maxSpeed(pad.held.RT, false) * 0.95;
        }
        face = carrier ? carrier.pos : this.ball.pos;
      }
    }
    if (shield) {
      // shield the ball: slow, back to the nearest defender
      let near: Plr | null = null;
      let nd = 9;
      for (const q of this.opp(p.team).players) {
        const d = hdist(q.pos, p.pos);
        if (d < nd) { nd = d; near = q; }
      }
      if (near) face = p.pos.clone().multiplyScalar(2).sub(near.pos);
      speed = Math.min(speed, 2.2);
    }
    // receiving a pass with a neutral stick: run onto it
    if (mag < 0.15 && p.recv && !this.owner) {
      stick.copy(p.recv.point).sub(p.pos).setY(0);
      const d = stick.length();
      if (d > 0.4) stick.normalize();
      else stick.set(0, 0, 0);
      speed = p.maxSpeed(d > 6, false) * 0.9;
    }
    if (stick.lengthSq() > 1e-4) stick.normalize();
    out.copy(stick).multiplyScalar(speed);
    return { sprint, jockey, face };
  }

  switchPlayer(t: Team, dir: V3 | null) {
    const cur = t.controlled;
    let best: Plr | null = null;
    let bs = Infinity;
    const ref = cur ?? t.players[0];
    for (const p of t.players) {
      if (p.sent || p.isGK || p === cur) continue;
      let s: number;
      if (dir) {
        const v = p.pos.clone().sub(ref.pos).setY(0);
        const d = v.length();
        const c = v.normalize().dot(dir);
        if (c < 0.45) continue;
        s = d * (2 - c);
      } else {
        const d = hdist(p.pos, this.ball.pos);
        // prefer players goal-side of the ball
        const goalSide = (p.pos.x - this.ball.pos.x) * -t.dir > 0 ? 0 : 6;
        s = d + goalSide;
      }
      if (s < bs) { bs = s; best = p; }
    }
    if (best) {
      if (cur) cur.charging = null;
      t.controlled = best;
    }
  }

  // ------------------------------------------------------------------ passing & shooting
  choosePassTarget(p: Plr, dir: V3 | null, type: KickType): Plr | null {
    const f = dir ?? p.dir();
    let best: Plr | null = null;
    let bs = -Infinity;
    for (const m of p.team.players) {
      if (m === p || m.sent) continue;
      const v = m.pos.clone().sub(p.pos).setY(0);
      const d = v.length();
      if (d < 2) continue;
      v.normalize();
      const c = v.dot(f);
      if (c < 0.35) continue;
      let s = c * 4 - d * (type === 'lob' ? -0.01 : 0.045);
      if (type === 'through') s += clamp((p.team.along(m.pos) - p.team.along(p.pos)) / 20, -1, 1);
      if (m.isGK) s -= 2.5;
      s += this.laneOpenness(p.pos, m.pos, p.team) * (type === 'lob' ? 0.3 : 1.4);
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }

  laneOpenness(a: V3, b: V3, t: Team) {
    // 0 = blocked, 1 = clear
    let min = 10;
    const ab = this.tmp.copy(b).sub(a).setY(0);
    const len2 = ab.lengthSq() || 1;
    const len = Math.sqrt(len2);
    for (const q of this.opp(t).players) {
      if (q.sent) continue;
      const tt = clamp(((q.pos.x - a.x) * ab.x + (q.pos.z - a.z) * ab.z) / len2, 0, 1);
      const px = a.x + ab.x * tt - q.pos.x;
      const pz = a.z + ab.z * tt - q.pos.z;
      // defenders further along the lane have more time to step across
      const d = Math.hypot(px, pz) - tt * len * 0.045;
      min = Math.min(min, d);
    }
    return clamp((min - 0.5) / 2.6, 0, 1);
  }

  // Whether p can play the ball right now (foot, volley or head).
  reach(p: Plr, extra = 0): 'foot' | 'volley' | 'head' | null {
    if (this.held && this.held !== p) return null;
    const b = this.ball.pos;
    const d = hdist(b, p.pos);
    // a running player reaches further (the stride carries him onto the ball)
    const stride = Math.min(0.65, p.vel.length() * 0.075);
    if (d > 1.05 + stride + extra) return null;
    if (b.y < 0.75) return 'foot';
    if (b.y < 1.3) return 'volley';
    if (b.y < 2.25 * p.hs + 0.45 && d < 0.95 + extra) return 'head';
    return null;
  }

  startKick(p: Plr, o: KickOrder) {
    const r = this.reach(p, o.setPiece ? 0.6 : 0.15) ?? 'foot';
    const head = r === 'head';
    let kind: ActionKind = head ? 'header' : ['lob', 'cross', 'clear', 'gkKick'].includes(o.type) ? 'lob' : 'kick';
    let dur = o.type === 'shot' ? 0.42 : 0.32;
    if (o.setPiece) dur = o.type === 'shot' || o.type === 'cross' || o.type === 'lob' ? 0.85 : 0.6;
    if (o.type === 'throwIn') {
      kind = 'throw';
      dur = 0.7;
    }
    if (head) dur = 0.5;
    if (o.type === 'gkThrow') {
      kind = 'throw';
      dur = 0.6;
    }
    // which foot: preferred foot unless the ball sits clearly on the other side
    const side = this.tmp.copy(this.ball.pos).sub(p.pos);
    const right = new V(-Math.cos(p.facing), 0, Math.sin(p.facing));
    const lat = side.dot(right);
    p.pose.leftFoot = Math.abs(lat) > 0.3 ? lat < 0 : p.d.foot === 'L';
    p.action = { kind, t: 0, dur, contact: kind === 'throw' ? 0.62 : 0.6, fired: false, order: o };
    p.pending = null;
  }

  private fireKick(p: Plr, o: KickOrder) {
    const b = this.ball;
    const env = this.env();
    const from = b.pos.clone();
    const head = from.y > 1.3;
    const volley = !head && from.y > 0.75;
    const vel = new V();
    const spin = new V();
    const s = p.s;
    const press = o.setPiece ? 0 : this.pressureOn(p);
    const fat = 1 + (1 - p.stamina) * 0.6;
    const weak = !o.setPiece && (p.pose.leftFoot ? p.d.foot === 'R' : p.d.foot === 'L') ? 1.25 : 1;
    const diffMul = p.team.pad === null ? [1.45, 1.15, 1, 0.9][this.setup.difficulty] ?? 1 : 1;
    let type = o.type;
    if (type === 'throwIn') {
      from.copy(p.pos).add(p.dir(this.tmp).multiplyScalar(0.3));
      from.y = 2.2;
      b.pos.copy(from);
    }
    if (type === 'gkThrow') {
      from.copy(p.pos).add(p.dir(this.tmp).multiplyScalar(0.5));
      from.y = 1.6;
      b.pos.copy(from);
    }

    if (type === 'pass' || type === 'through') {
      const tp = this.passPoint(p, o, from);
      const dist = hdist(from, tp);
      const arrive = type === 'through' ? 4.5 + o.power * 4 : 8.5 + o.power * 5 + Math.max(0, dist - 18) * 0.12;
      let v0 = clamp(groundSpeedFor(dist, arrive, env), 9.5, 32);
      if (head) v0 = Math.min(v0, 13);
      const err = (0.01 + (1 - s.passing / 100) * 0.07) * (1 + press * 0.7) * fat * weak * diffMul * (head ? 1.8 : volley ? 1.4 : 1) * (1 + v0 / 70);
      const dir = tp.clone().sub(from).setY(0).normalize();
      rotY(dir, gauss() * err);
      vel.copy(dir).multiplyScalar(v0 * (1 + gauss() * err * 0.4));
      vel.y = head ? 2 : volley ? 1 : 0;
      this.setReceiver(o.target ?? null, tp, rollTime(dist, v0, env));
    } else if (type === 'lob' || type === 'cross' || type === 'clear' || type === 'gkKick' || type === 'gkThrow' || type === 'throwIn') {
      const tp = this.passPoint(p, o, from);
      const dist = Math.max(4, hdist(from, tp));
      const T =
        type === 'cross' ? 0.95 + dist * 0.026 :
        type === 'clear' ? 1.6 + dist * 0.02 :
        type === 'gkThrow' ? 0.45 + dist * 0.035 :
        type === 'throwIn' ? 0.5 + dist * 0.045 :
        type === 'gkKick' ? 1.2 + dist * 0.03 :
        0.75 + dist * (0.03 + o.power * 0.012);
      const land = tp.clone();
      land.y = type === 'cross' ? 1.2 : type === 'gkThrow' || type === 'throwIn' ? 0.3 : 0.1;
      lobVelocity(from, land, T, vel);
      const skill = type === 'cross' || type === 'lob' ? s.passing : type === 'clear' ? s.defending : s.gk;
      const err = (0.012 + (1 - skill / 100) * 0.07) * (1 + press * 0.6) * fat * weak * diffMul * (head ? 1.6 : 1);
      rotY(vel, gauss() * err);
      vel.multiplyScalar(1 + gauss() * err * 0.6);
      const dirH = vel.clone().setY(0).normalize();
      const back = new V().crossVectors(dirH, new V(0, 1, 0)).multiplyScalar(type === 'cross' ? 4 : 6);
      spin.copy(back);
      if (o.spinX) spin.y -= o.spinX * 32;
      if (type === 'cross' && !o.spinX) {
        // whipped in: curl towards goal
        const toGoal = new V(p.team.dir * HL, 0, 0).sub(from);
        const perp = new V(dirH.z, 0, -dirH.x);
        spin.y += Math.sign(toGoal.dot(perp)) * 18;
      }
      this.setReceiver(o.target ?? null, tp, T);
    } else if (type === 'shot') {
      this.fireShot(p, o, from, vel, spin, { press, fat, weak, diffMul, head, volley });
    }
    this.kickBall(p, vel, spin, type);
  }

  private fireShot(p: Plr, o: KickOrder, from: V3, vel: V3, spin: V3, f: { press: number; fat: number; weak: number; diffMul: number; head: boolean; volley: boolean }) {
    const s = p.s;
    const goal = new V(p.team.dir * HL, 0, 0);
    const toGoal = goal.clone().sub(from).setY(0);
    const D = toGoal.length();
    toGoal.normalize();
    const perp = new V(toGoal.z, 0, -toGoal.x);
    let zAim: number;
    let yAim: number;
    const power = o.power;
    if (o.aim) {
      zAim = o.aim.z;
      yAim = o.aim.y;
    } else {
      if (o.dir && Math.abs(o.dir.dot(perp)) > 0.15) zAim = clamp(o.dir.dot(perp) * 1.6, -1, 1) * Math.sign(perp.z || 1) * (GOAL_HW - 0.35);
      else zAim = -Math.sign(from.z || Math.random() - 0.5) * (GOAL_HW - 0.55);
      yAim = 0.25 + power * 1.45;
      if (power > 0.8) yAim += (power - 0.8) * 7 * (1.2 - s.shooting / 100);
    }
    let speed = (12 + power * 22) * (0.72 + 0.28 * (s.shooting / 100));
    let err = (0.016 + (1 - s.shooting / 100) * 0.08) * (1 + f.press * 0.9) * f.fat * f.weak * f.diffMul * (1 + D / 45) * (1 + (1 - s.composure / 100) * 0.3);
    if (f.volley) err *= 1.6;
    if (f.head) {
      speed = 9 + power * 8 + s.physical * 0.04;
      yAim = 0.3 + power * 0.9;
      err *= 1.4;
    }
    if (o.timed === 'green') {
      err *= 0.35;
      speed *= 1.06;
    } else if (o.timed === 'red') {
      err *= 2.4;
      speed *= 0.93;
    }
    if (o.setPiece) {
      speed = 17 + power * 14;
      err = (0.006 + (1 - s.freeKick / 100) * 0.05) * (1 + Math.max(0, power - 0.75) * 3);
    }
    const target = new V(goal.x, yAim, zAim);
    if (o.chip && !o.setPiece) {
      const T = 0.8 + D * 0.021;
      target.y = 1.6;
      target.z *= 0.7;
      lobVelocity(from, target, T, vel);
      rotY(vel, gauss() * err);
      spin.copy(new V().crossVectors(vel.clone().setY(0).normalize(), new V(0, 1, 0)).multiplyScalar(5));
    } else {
      let curl = 0;
      if (o.finesse && !o.setPiece) {
        speed *= 0.8;
        err *= 0.65;
        target.y = 0.5 + power * 1.0;
        curl = 42;
      }
      if (o.setPiece && o.spinX) curl = o.spinX * 55;
      const dirH = target.clone().sub(from).setY(0);
      const Dh = dirH.length();
      dirH.normalize();
      const pp = new V(dirH.z, 0, -dirH.x);
      if (curl !== 0) {
        // curl back towards the middle (or as set by the free-kick spin)
        const side = Math.sign(-zAim * Math.sign(pp.z || 1)) || 1;
        const wy = o.setPiece ? -(o.spinX ?? 0) * 55 : side * Math.abs(curl);
        spin.set(0, wy, 0);
        // start it wide by the expected drift
        const T = Dh / speed;
        const drift = 0.5 * 0.0048 * Math.abs(wy) * speed * T * T * 0.55;
        const aimed = target.clone().addScaledVector(pp, -Math.sign(wy) * drift);
        dirH.copy(aimed.sub(from).setY(0).normalize());
      }
      rotY(dirH, gauss() * err);
      const T = Dh / speed;
      vel.copy(dirH).multiplyScalar(speed);
      vel.y = (target.y - from.y) / T + 0.5 * G * T * 0.9 + gauss() * err * speed * 0.5;
      // topspin dips power shots; knuckle has little spin
      const top = o.setPiece ? (o.spinY ?? 0) * 30 : 6 + power * 6;
      spin.addScaledVector(new V().crossVectors(dirH, new V(0, 1, 0)), -top);
      if (o.setPiece && (o.spinY ?? 0) < -0.3) spin.multiplyScalar(0.15);
    }
    p.stats.shots++;
    p.team.stats.shots++;
    // on target?
    const tb = new BallBody();
    tb.pos.copy(from);
    tb.vel.copy(vel);
    tb.spin.copy(spin);
    const path = predictPath(tb, this.env(), 1 / 30, 75, []);
    for (const q of path) {
      if (Math.abs(q.x) >= HL) {
        if (Math.abs(q.z) < GOAL_HW && q.y < GOAL_H) {
          p.stats.onTarget++;
          p.team.stats.onTarget++;
        }
        break;
      }
    }
    this.shotAnnounced = false;
    if (D < 25 || o.setPiece) this.comment('shot', { player: p.d.name });
  }

  private passPoint(p: Plr, o: KickOrder, from: V3): V3 {
    if (o.point) return o.point.clone();
    const m = o.target;
    if (!m) {
      const d = o.dir ?? p.dir();
      return from.clone().addScaledVector(d, o.type === 'lob' ? 25 : 14).setY(0);
    }
    const env = this.env();
    if (o.type === 'through') {
      const attack = new V(p.team.dir, 0, 0);
      const run = m.vel.lengthSq() > 4 ? m.vel.clone().normalize().lerp(attack, 0.5).normalize() : attack;
      const lead = 5 + o.power * 12;
      const pt = m.pos.clone().addScaledVector(run, lead);
      pt.x = clamp(pt.x, -HL + 3, HL - 3);
      pt.z = clamp(pt.z, -HW + 1.5, HW - 1.5);
      return pt.setY(0);
    }
    let pt = m.pos.clone();
    for (let i = 0; i < 2; i++) {
      const dist = hdist(from, pt);
      let t: number;
      if (o.type === 'pass') t = rollTime(dist, clamp(groundSpeedFor(dist, 8.5 + o.power * 5 + Math.max(0, dist - 18) * 0.12, env), 9.5, 32), env);
      else t = 0.75 + dist * 0.032;
      if (!isFinite(t)) t = 2;
      pt = m.pos.clone().addScaledVector(m.vel, Math.min(t, 2.2) * 0.85);
    }
    pt.x = clamp(pt.x, -HL + 0.5, HL - 0.5);
    pt.z = clamp(pt.z, -HW + 0.5, HW - 0.5);
    return pt.setY(0);
  }

  private setReceiver(m: Plr | null, point: V3, t: number) {
    for (const q of this.all) q.recv = null;
    if (!m) return;
    m.recv = { point: point.clone(), t: this.time + (isFinite(t) ? t : 2) + 1.2 };
    // a human pass hands control to the receiver straight away
    if (m.team.pad !== null && !this.careerId) m.team.controlled = m;
  }

  kickBall(p: Plr, vel: V3, spin: V3, type: KickType) {
    const b = this.ball;
    b.vel.copy(vel);
    b.spin.copy(spin);
    if (b.pos.y < BALL_R) b.pos.y = BALL_R;
    this.owner = null;
    this.held = null;
    p.kickCD = 0.3;
    this.onTouch(p);
    this.lastKick = { p, type, t: this.time };
    this.audio.kick(vel.length());
    if (type !== 'shot' && type !== 'clear') {
      p.stats.passes++;
      p.team.stats.passes++;
      // offside snapshot (not from throw-ins, goal kicks or corners)
      const sp = this.sp?.kind;
      if (!(this.phase === 'setpiece' && (sp === 'throw' || sp === 'goalkick' || sp === 'corner'))) this.snapshotOffside(p);
    }
    if (type === 'shot') this.offside = null;
    this.excitement = Math.max(this.excitement, type === 'shot' ? 0.9 : 0.3);
  }

  private snapshotOffside(passer: Plr) {
    const t = passer.team;
    const o = this.opp(t);
    const alongs = o.active().map((q) => t.along(q.pos)).sort((a, b) => b - a);
    const second = alongs[1] ?? 105;
    const ballA = t.along(this.ball.pos);
    const set = new Set<Plr>();
    for (const m of t.players) {
      if (m === passer || m.sent) continue;
      const a = t.along(m.pos);
      if (a > HL && a > second + 0.15 && a > ballA + 0.15) set.add(m);
    }
    this.offside = { team: t, passer, set };
  }

  // Every touch passes through here: offside calls, pass completion stats, possession.
  onTouch(p: Plr) {
    const prev = this.lastTouch;
    if (this.offside) {
      if (p.team === this.offside.team && p !== this.offside.passer && this.offside.set.has(p)) {
        this.callOffside(p);
        return;
      }
      if (p !== this.offside.passer) this.offside = null;
    }
    if (prev && prev !== p && this.lastKick && this.lastKick.p === prev && this.lastKick.type !== 'shot') {
      if (prev.team === p.team) {
        prev.stats.passOk++;
        prev.team.stats.passOk++;
      }
    }
    if (prev && prev.team !== p.team) p.team.lostBallAt = -10;
    if (prev && prev.team !== p.team) prev.team.lostBallAt = this.time;
    if (prev !== p) this.prevTouch = prev;
    this.lastTouch = p;
    this.possTeam = p.team;
    if (p.recv) p.recv = null;
  }

  // ------------------------------------------------------------------ skills & tackles
  skillMove(p: Plr, d: V3 | null) {
    const f = p.dir();
    const b = this.ball;
    if (!d) {
      p.action = { kind: 'roulette', t: 0, dur: 0.6, contact: 1, fired: false, spin: p.facing };
      p.touchCD = 0.6;
      return;
    }
    const c = d.dot(f);
    if (c > 0.6) {
      // knock-on
      b.vel.copy(f).multiplyScalar(p.vel.length() + 7.5);
      p.touchCD = 0.9;
      this.owner = null;
      this.onTouch(p);
      p.ai.sprint = true;
    } else if (c < -0.6) {
      // drag-back
      b.vel.copy(f).multiplyScalar(-2.4).addScaledVector(p.vel, 0.2);
      p.vel.multiplyScalar(0.2);
      p.facing = wrapAng(p.facing + Math.PI);
      p.action = { kind: 'skill', t: 0, dur: 0.4, contact: 1, fired: false };
      p.touchCD = 0.35;
    } else {
      // feint / ball roll to the side
      p.vel.addScaledVector(d, 3.2);
      b.vel.copy(p.vel).addScaledVector(d, 0.6);
      p.action = { kind: 'skill', t: 0, dur: 0.45, contact: 1, fired: false };
      p.touchCD = 0.3;
      if (this.pressureOn(p) > 0.4 && p.s.dribbling > 70) this.comment('skill', { player: p.d.name });
    }
  }

  standingTackle(p: Plr) {
    p.action = { kind: 'tackle', t: 0, dur: 0.5, contact: 0.4, fired: false };
    // lunge towards the ball
    const to = this.tmp.copy(this.ball.pos).sub(p.pos).setY(0);
    if (to.length() < 4) p.facing = angOf(to.x, to.z);
    p.vel.addScaledVector(p.dir(), 1.5);
  }

  slideTackle(p: Plr, dir: V3 | null) {
    const d = dir ? dir.clone() : this.ball.pos.clone().sub(p.pos).setY(0).normalize();
    p.facing = angOf(d.x, d.z);
    p.vel.copy(d).multiplyScalar(Math.max(p.vel.length(), 6.5));
    p.action = { kind: 'slide', t: 0, dur: 1.35, contact: 1, fired: false, dir: d, hitBall: false };
    this.stadium.wear(p.pos.x + d.x * 2, p.pos.z + d.z * 2, 0.6, 0.35);
  }

  private resolveTackle(p: Plr) {
    const foot = p.pos.clone().addScaledVector(p.dir(), 0.85);
    const b = this.ball;
    const owner = this.owner;
    const victim = owner && owner.team !== p.team ? owner : null;
    if (hdist(foot, b.pos) < 0.8 && b.pos.y < 0.6) {
      const drib = victim ? victim.s.dribbling : 50;
      let chance = 0.47 + (p.s.defending - drib) / 100 * 0.9;
      if (victim?.action?.kind === 'roulette' || victim?.action?.kind === 'skill') chance -= 0.3;
      if (victim && victim.team.pad !== null && this.input.pad(victim.team.pad).held.LT) chance -= 0.15 * (victim.s.physical / 100);
      if (p.team.pad === null) chance *= [0.75, 0.9, 1, 1.1][this.setup.difficulty] ?? 1;
      if (Math.random() < clamp(chance, 0.12, 0.93)) {
        this.owner = null;
        if (Math.random() < p.s.defending / 140) {
          b.vel.copy(p.vel).multiplyScalar(0.8);
          this.owner = p;
        } else b.vel.copy(p.dir()).multiplyScalar(4 + Math.random() * 3).add(new V(gauss() * 1.5, 0, gauss() * 1.5));
        this.onTouch(p);
        p.stats.tackles++;
        p.team.stats.tackles++;
        if (victim) victim.stun = 0.35;
        if (Math.random() < 0.3) this.comment('tackle', { player: p.d.name });
        return;
      }
      p.stun = 0.45;
      return;
    }
    if (victim && hdist(foot, victim.pos) < 0.75) {
      const behind = p.dir().dot(victim.dir()) > 0.5;
      if (Math.random() < 0.45 + (behind ? 0.3 : 0)) this.foul(p, victim, behind ? 0.5 : 0.25);
    }
  }

  private slideStep(p: Plr) {
    const a = p.action!;
    if (a.t > 0.75) return;
    const d = a.dir!;
    const foot = p.pos.clone().addScaledVector(d, 0.95);
    const b = this.ball;
    if (!a.hitBall && hdist(foot, b.pos) < 0.7 && b.pos.y < 0.5) {
      a.hitBall = true;
      const lateral = new V(-d.z, 0, d.x).multiplyScalar(gauss() * 3);
      b.vel.copy(d).multiplyScalar(6 + Math.random() * 4).add(lateral);
      this.owner = null;
      this.onTouch(p);
      p.stats.tackles++;
      p.team.stats.tackles++;
    }
    for (const q of this.opp(p.team).players) {
      if (q.sent || q.down()) continue;
      if (hdist(foot, q.pos) < 0.7 || hdist(p.pos, q.pos) < 0.6) {
        const behind = d.dot(q.dir()) > 0.55;
        q.action = { kind: 'fallen', t: 0, dur: 1.6, contact: 1, fired: false };
        if (this.owner === q) this.owner = null;
        if (!a.hitBall) this.foul(p, q, 0.55 + (behind ? 0.4 : 0) + p.vel.length() * 0.02);
        else if (behind && Math.random() < 0.25) this.foul(p, q, 0.6);
        return;
      }
    }
  }

  // ------------------------------------------------------------------ per-player simulation
  private stepPlayer(p: Plr, dt: number) {
    p.kickCD = Math.max(0, p.kickCD - dt);
    p.touchCD = Math.max(0, p.touchCD - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.ai.tackleCD = Math.max(0, p.ai.tackleCD - dt);
    if (p.recv && this.time > p.recv.t) p.recv = null;

    // pending (buffered) kicks fire once the ball is playable
    if (p.pending) {
      p.pending.t -= dt;
      if (p.pending.t <= 0) p.pending = null;
      else if (!p.action || p.action.kind === 'trap') {
        if (this.reach(p, 0.1) && (this.owner === p || !this.owner || this.owner.team !== p.team)) this.startKick(p, p.pending);
      }
    }

    // actions
    const a = p.action;
    if (a) {
      a.t += dt;
      if ((a.kind === 'kick' || a.kind === 'lob' || a.kind === 'header' || a.kind === 'throw') && !a.fired && a.t >= a.dur * a.contact) {
        a.fired = true;
        if (a.order && (this.reach(p, a.order.setPiece ? 0.9 : 0.4) || a.order.type === 'throwIn' || a.order.type === 'gkThrow' || this.held === p)) this.fireKick(p, a.order);
      }
      if (a.kind === 'tackle' && !a.fired && a.t >= a.dur * a.contact) {
        a.fired = true;
        this.resolveTackle(p);
      }
      if (a.kind === 'slide') this.slideStep(p);
      if (a.kind === 'roulette') p.facing = wrapAng((a.spin ?? 0) + (a.t / a.dur) * Math.PI * 2);
      if (a.t >= a.dur) {
        if (a.kind === 'slide') p.stun = 0.25;
        p.action = null;
      }
    }

    // movement
    const desired = this.tmp.set(0, 0, 0);
    let sprint = false;
    let jockey = false;
    let face: V3 | null = null;
    const pad = this.padOf(p.team);
    if (pad && this.isHuman(p) && this.phase === 'play') {
      const r = this.humanMove(p, pad, desired);
      sprint = r.sprint;
      jockey = r.jockey;
      face = r.face;
    } else {
      const r = aiMove(this, p, desired);
      sprint = r.sprint;
      jockey = r.jockey;
      face = r.face;
    }
    p.pose.jockey = jockey;

    if (p.action) {
      const k = p.action.kind;
      if (k === 'kick' || k === 'lob' || k === 'header' || k === 'trap' || k === 'chest' || k === 'catch' || k === 'throw') {
        if (!p.action.fired && p.action.order && k !== 'throw') {
          // step into the ball for the strike
          const tc = Math.max(0.05, p.action.dur * p.action.contact - p.action.t);
          const spot = this.ball.pos.clone().addScaledVector(this.ball.vel, tc).addScaledVector(p.dir(), -0.5).setY(0);
          desired.copy(spot.sub(p.pos)).divideScalar(tc);
          const lim = p.maxSpeed(true, false);
          if (desired.length() > lim) desired.setLength(lim);
        } else desired.multiplyScalar(0.3);
      } else if (k === 'slide') {
        desired.copy(p.action.dir!).multiplyScalar(Math.max(0, 8 * (1 - p.action.t / 0.8)));
      } else if (k === 'tackle') desired.copy(p.vel).multiplyScalar(0.6);
      else if (k === 'dive') desired.copy(p.gk.diveVel).multiplyScalar(p.action.t < 0.55 ? 1 : 0.15);
      else if (k === 'fallen') desired.set(0, 0, 0); else if (k === 'skill' || k === 'roulette') desired.copy(p.vel);
    }
    if (p.stun > 0) desired.multiplyScalar(0.25);
    if (p.charging && this.owner !== p) desired.multiplyScalar(0.9);

    const grip = this.setup.weather === 'rain' ? 0.85 : this.setup.weather === 'snow' ? 0.8 : 1;
    const acc = (4.2 + 6 * (p.s.accel / 100)) * grip * (0.75 + 0.25 * p.stamina);
    const dec = 12 * grip;
    const diff = this.tmp2.copy(desired).sub(p.vel).setY(0);
    const braking = desired.length() < p.vel.length() - 0.1;
    let lim = (braking ? dec : acc) * dt;
    // turning at speed costs more (agility)
    if (p.vel.lengthSq() > 4 && desired.lengthSq() > 1) {
      const turnCos = p.vel.clone().normalize().dot(desired.clone().normalize());
      if (turnCos < 0.7) lim *= 0.55 + 0.45 * (p.s.agility / 100);
    }
    if (p.action?.kind === 'slide' || p.action?.kind === 'dive') lim = 40 * dt;
    if (diff.length() > lim) diff.setLength(lim);
    const prevSpeed = p.vel.length();
    p.vel.add(diff);
    p.pos.addScaledVector(p.vel, dt);
    p.pos.x = clamp(p.pos.x, -HL - 6, HL + 6);
    p.pos.z = clamp(p.pos.z, -HW - 5, HW + 5);
    const speed = p.vel.length();
    p.accelF = (speed - prevSpeed) / dt;

    // facing
    let tf = p.facing;
    if (face) tf = angOf(face.x - p.pos.x, face.z - p.pos.z);
    else if (speed > 0.4 && !(p.action && ['slide', 'dive', 'fallen', 'roulette'].includes(p.action.kind))) tf = angOf(p.vel.x, p.vel.z);
    if (p.action && !p.action.fired && p.action.order && (p.action.kind === 'kick' || p.action.kind === 'lob' || p.action.kind === 'header')) {
      const aimDir = this.aimDirection(p, p.action.order);
      if (aimDir) tf = angOf(aimDir.x, aimDir.z);
    }
    const rate = (5 + 7 * (p.s.agility / 100)) * (1 - 0.4 * Math.min(1, speed / 9)) * (this.owner === p ? 0.85 : 1) * (p.action?.kind === 'kick' ? 2.5 : 1);
    const dA = wrapAng(tf - p.facing);
    const stepA = clamp(dA, -rate * dt, rate * dt);
    if (!(p.action && ['slide', 'dive', 'fallen', 'roulette'].includes(p.action.kind))) p.facing = wrapAng(p.facing + stepA);
    p.turn = stepA / dt;

    // gait phase
    const cycle = 1.2 + speed * 0.32;
    p.phase += (speed / cycle) * Math.PI * 2 * dt;

    // stamina
    if (sprint && speed > 6) p.stamina = Math.max(0.05, p.stamina - dt * 0.012 * (1.45 - p.s.stamina / 100) * (60 / this.setup.halfSeconds) * 0.5);
    else if (speed < 4) p.stamina = Math.min(1, p.stamina + dt * 0.006);

    // pitch wear and slipping on wet grass
    if (speed > 6.5 && Math.random() < dt * 1.5) this.stadium.wear(p.pos.x, p.pos.z, 0.22, 0.07);
    if (Math.abs(p.turn) > 3.2 && speed > 6.5 && Math.random() < dt * 4) this.stadium.wear(p.pos.x, p.pos.z, 0.35, 0.12);
    if (this.setup.weather === 'rain' && Math.abs(p.turn) > 3.5 && speed > 7.5 && !p.action && Math.random() < dt * 0.5) {
      p.action = { kind: 'fallen', t: 0, dur: 1.2, contact: 1, fired: false };
      if (this.owner === p) this.owner = null;
    }
  }

  private aimDirection(p: Plr, o: KickOrder): V3 | null {
    if (o.type === 'shot') return new V(p.team.dir * HL, 0, o.aim?.z ?? 0).sub(p.pos).setY(0).normalize();
    if (o.point) return o.point.clone().sub(p.pos).setY(0).normalize();
    if (o.target) return o.target.pos.clone().sub(p.pos).setY(0).normalize();
    return o.dir;
  }

  // ------------------------------------------------------------------ ball
  private stepBall(dt: number) {
    const b = this.ball;
    if (this.held) {
      const h = this.held;
      const f = h.dir();
      if (this.phase === 'setpiece' && this.sp?.kind === 'throw') b.pos.copy(h.pos).addScaledVector(f, -0.05).setY(2.25 * h.hs);
      else b.pos.copy(h.pos).addScaledVector(f, 0.32).setY(1.05 * h.hs);
      b.vel.copy(h.vel);
      b.spin.set(0, 0, 0);
      return;
    }
    if (this.phase === 'setpiece' && !this.sp?.taken) {
      b.vel.set(0, 0, 0);
      b.spin.set(0, 0, 0);
      return;
    }
    this.dribble(dt);
    this.events.length = 0;
    b.step(dt, this.env(), this.events);
    for (const e of this.events) {
      if (e.type === 'post' || e.type === 'bar') {
        if (e.speed > 6) {
          this.audio.post();
          this.comment('post', {}, true);
          this.excitement = 1;
        }
        this.lastKick = null;
      } else if (e.type === 'net') {
        if (e.speed > 3) this.audio.net();
        this.stadium.netImpact(Math.sign(b.pos.x), b.pos.z, b.pos.y, e.speed + 4);
      } else if (e.type === 'splash' && e.speed > 3) this.stadium.wear(e.x, e.z, 0.4, 0.15);
    }
    // loose ball: players gain control
    if (!this.owner && this.phase !== 'goal') {
      let best: Plr | null = null;
      let bd = 1.0;
      for (const p of this.all) {
        if (p.sent || p.kickCD > 0 || p.down() || p.busy() || (p.action && p.action.kind === 'kick')) continue;
        if (p.isGK && p.action?.kind === 'catch') continue;
        const d = hdist(p.pos, b.pos);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) this.tryControl(best);
    }
  }

  private tryControl(p: Plr) {
    const b = this.ball;
    const y = b.pos.y;
    const rel = this.tmp.copy(b.vel).sub(p.vel).setY(0).length() + Math.abs(b.vel.y) * 0.3;
    if (y > 1.7 * p.hs) return;
    if (p.isGK && this.inBox(p.team, p.pos) && !(this.lastKick && this.lastKick.p.team === p.team && this.lastKick.type !== 'shot')) {
      // keepers gather with their hands
      if (rel < 26) {
        this.gkCatch(p);
        return;
      }
    }
    // a teammate with a pending kick will strike first
    if (p.pending && this.reach(p, 0.1)) return;
    const limit = 13 + p.s.dribbling * 0.06;
    if (rel > limit) {
      // too hot to handle: it bounces off
      const n = this.tmp2.copy(b.pos).sub(p.pos).setY(0).normalize();
      const vn = b.vel.dot(n);
      if (vn < 0) b.vel.addScaledVector(n, -1.4 * vn).multiplyScalar(0.5);
      p.kickCD = 0.15;
      this.onTouch(p);
      return;
    }
    if (y > 0.75) {
      p.action = { kind: 'chest', t: 0, dur: 0.4, contact: 1, fired: false };
      b.vel.copy(p.vel).multiplyScalar(0.6);
      b.vel.y = -1;
    } else {
      if (rel > 7) p.action = { kind: 'trap', t: 0, dur: 0.3, contact: 1, fired: false };
      const err = rel * (1 - p.s.dribbling / 100) * 0.13 * (1 + this.pressureOn(p) * 0.5);
      b.vel.copy(p.vel).multiplyScalar(0.92).addScaledVector(p.dir(), 0.5).add(new V(gauss() * err, 0, gauss() * err));
      b.vel.y = 0;
    }
    b.spin.multiplyScalar(0.2);
    this.owner = p;
    p.touchCD = 0.18;
    // first touch, then look up before the next decision
    p.ai.decide = 0.35 + Math.random() * 0.5;
    this.onTouch(p);
    if (p.team.pad !== null && !this.careerId) p.team.controlled = p;
  }

  private dribble(dt: number) {
    const p = this.owner;
    if (!p) return;
    const b = this.ball;
    const d = hdist(p.pos, b.pos);
    if (d > 1.6 || b.pos.y > 1.8 || (b.pos.y > 1.0 && b.vel.y > 1.5) || p.down()) {
      this.owner = null;
      return;
    }
    if (p.action && (p.action.kind === 'kick' || p.action.kind === 'lob' || p.action.kind === 'header')) return;
    const pad = this.padOf(p.team);
    const human = pad && this.isHuman(p);
    const close = human ? pad!.held.LB : p.ai.speed < 0.6;
    const sprint = human ? pad!.held.RT : p.ai.sprint;
    const shield = human ? pad!.held.LT : false;
    const f = p.dir();
    const speed = p.vel.length();
    const ahead = shield ? 0.35 : 0.42 + speed * 0.05 + (sprint ? 0.25 : 0) - (close ? 0.15 : 0);
    const spot = p.pos.clone().addScaledVector(f, ahead);
    const toSpot = spot.clone().sub(b.pos).setY(0);
    // soft steering keeps the ball near the foot between touches (better dribblers: tighter)
    const k = (1.5 + p.s.dribbling / 25) * (close ? 2 : 1) * (speed < 1 ? 2.5 : 1);
    b.vel.x += (toSpot.x * k + (p.vel.x - b.vel.x) * 0.8) * dt * 2;
    b.vel.z += (toSpot.z * k + (p.vel.z - b.vel.z) * 0.8) * dt * 2;
    if (p.touchCD <= 0 && speed > 1 && d < 1.1) {
      const along = this.tmp.copy(b.pos).sub(p.pos).setY(0).dot(f);
      if (along < ahead + 0.1) {
        const push = sprint ? 2.6 : close ? 0.55 : 1.3;
        const err = (1 - p.s.dribbling / 100) * 0.16 * (speed / 9) * (sprint ? 1.4 : 1);
        const dir = f.clone();
        rotY(dir, gauss() * err);
        b.vel.copy(p.vel).addScaledVector(dir, push);
        b.vel.y = 0;
        p.touchCD = sprint ? 0.48 : close ? 0.2 : 0.32;
        if (this.lastTouch !== p) this.onTouch(p);
      }
    }
  }

  gkCatch(p: Plr) {
    this.held = p;
    this.owner = null;
    this.ball.vel.set(0, 0, 0);
    this.onTouch(p);
    p.gk.holdT = 0;
    p.action = { kind: 'catch', t: 0, dur: 0.6, contact: 1, fired: false };
    for (const q of this.all) q.recv = null;
  }

  // ------------------------------------------------------------------ collisions
  private collisions(dt: number) {
    const ps = this.all;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.sent) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.sent) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const r = 0.62;
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r || d2 < 1e-6) continue;
        if (a.down() || b.down()) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const nz = dz / d;
        const ma = a.d.weight * (0.6 + a.s.physical / 250);
        const mb = b.d.weight * (0.6 + b.s.physical / 250);
        const pen = r - d;
        a.pos.x -= nx * pen * (mb / (ma + mb));
        a.pos.z -= nz * pen * (mb / (ma + mb));
        b.pos.x += nx * pen * (ma / (ma + mb));
        b.pos.z += nz * pen * (ma / (ma + mb));
        const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rv < 0) {
          const jimp = (-(1 + 0.1) * rv) / (1 / ma + 1 / mb);
          a.vel.x -= (jimp / ma) * nx;
          a.vel.z -= (jimp / ma) * nz;
          b.vel.x += (jimp / mb) * nx;
          b.vel.z += (jimp / mb) * nz;
        }
        // shoulder to shoulder for the ball
        if (a.team !== b.team && (this.owner === a || this.owner === b) && this.phase === 'play') {
          const own = this.owner === a ? a : b;
          const ch = own === a ? b : a;
          const so = own.d.weight * (0.5 + own.s.physical / 100) * (1 + own.vel.length() / 30);
          const sc = ch.d.weight * (0.5 + ch.s.physical / 100) * (1 + ch.vel.length() / 30);
          if (sc > so * (1.05 + Math.random() * 0.5) && Math.random() < dt * 2.2) {
            this.owner = null;
            own.stun = 0.3;
            this.ball.vel.addScaledVector(new V(nx, 0, nz).multiplyScalar(own === a ? 1 : -1), 1.5);
            if (sc > so * 1.5 && Math.random() < 0.3) own.action = { kind: 'fallen', t: 0, dur: 1.2, contact: 1, fired: false };
          }
        }
      }
    }
    // ball against bodies (deflections, blocks, handballs)
    const b = this.ball;
    const bs = b.vel.length();
    if (bs < 5 || this.held) return;
    for (const p of ps) {
      if (p.sent || p === this.owner || p.kickCD > 0) continue;
      if (p.isGK && p.action?.kind === 'dive') continue;
      const top = 1.85 * p.hs;
      if (b.pos.y > top) continue;
      const dx = b.pos.x - p.pos.x;
      const dz = b.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      const rad = p.down() ? 0.5 : 0.3;
      if (d > rad + BALL_R) continue;
      const n = new V(dx / (d || 1), 0, dz / (d || 1));
      const vn = b.vel.dot(n);
      if (vn >= 0) continue;
      b.vel.addScaledVector(n, -1.35 * vn);
      b.vel.multiplyScalar(0.55);
      b.spin.multiplyScalar(0.3);
      p.kickCD = 0.2;
      // arm height: handball?
      const armBand = b.pos.y > 0.95 * p.hs && b.pos.y < 1.5 * p.hs;
      const keeperHands = p.isGK && this.inBox(p.team, p.pos);
      if (armBand && !keeperHands && this.phase === 'play' && Math.random() < 0.18 && this.lastTouch && this.lastTouch.team !== p.team) {
        this.comment('handball', {}, true);
        this.foul(p, this.lastTouch, 0.2, true);
        return;
      }
      if (keeperHands && bs < 24) {
        this.gkCatch(p);
        return;
      }
      this.onTouch(p);
      if (this.lastKick?.type === 'shot' && p.team !== this.lastKick.p.team) this.comment(p.isGK ? 'saved' : 'tackle', { player: p.d.name });
      return;
    }
  }

  // ------------------------------------------------------------------ rules
  private rules(_dt: number) {
    const b = this.ball;
    // goal
    if (b.inNet && Math.abs(b.pos.x) > HL + BALL_R) {
      const side = Math.sign(b.pos.x);
      const scoring = this.teams.find((t) => t.dir === side)!;
      this.goal(scoring);
      return;
    }
    if (this.shootout) return;
    // out over the touchline
    if (Math.abs(b.pos.z) > HW + BALL_R) {
      const last = this.lastTouch;
      const team = last ? this.opp(last.team) : this.teams[0];
      const spot = new V(clamp(b.pos.x, -HL + 1, HL - 1), 0, Math.sign(b.pos.z) * (HW + 0.3));
      this.dead(() => this.makeThrow(team, spot));
      this.comment('throw', { team: team.data.name });
      return;
    }
    // out over the goal line
    if (Math.abs(b.pos.x) > HL + BALL_R && !b.inNet) {
      const side = Math.sign(b.pos.x);
      const defending = this.teams.find((t) => t.dir === -side)!;
      const attacking = this.opp(defending);
      const last = this.lastTouch;
      const wasShot = this.lastKick?.type === 'shot' && this.time - this.lastKick.t < 3;
      if (wasShot && !this.shotAnnounced) {
        this.shotAnnounced = true;
        this.comment('miss', {}, true);
        this.audio.groan();
      }
      if (last && last.team === defending) {
        attacking.stats.corners++;
        const spot = new V(side * (HL - 0.4), 0, Math.sign(b.pos.z || 1) * (HW - 0.4));
        this.dead(() => this.makeCorner(attacking, spot));
        this.comment('corner', { team: attacking.data.name });
      } else {
        const spot = new V(side * (HL - 5.5), 0, Math.sign(b.pos.z || 1) * 5);
        this.dead(() => this.makeGoalKick(defending, spot));
        this.comment('goalkick');
      }
    }
  }

  private dead(next: () => SetPiece) {
    this.phase = 'dead';
    this.phaseT = 0;
    this.nextSP = next;
    this.owner = null;
    this.audio.whistle('short');
    for (const p of this.all) {
      p.pending = null;
      p.charging = null;
      p.recv = null;
    }
  }

  foul(off: Plr, victim: Plr, severity: number, handball = false) {
    if (this.phase !== 'play') return;
    off.stats.fouls++;
    off.team.stats.fouls++;
    if (!victim.down() && !handball) victim.action = { kind: 'fallen', t: 0, dur: 1.5, contact: 1, fired: false };
    const spot = handball ? this.ball.pos.clone().setY(0) : victim.pos.clone().setY(0);
    spot.x = clamp(spot.x, -HL + 0.5, HL - 0.5);
    spot.z = clamp(spot.z, -HW + 0.5, HW - 0.5);
    const t = victim.team;
    const pen = this.inBox(off.team, spot);
    // cards
    const r = Math.random();
    if (severity > 1 && r < 0.3) this.card(off, 'red');
    else if (r < severity * 0.42) this.card(off, 'yellow');
    else if (!handball) this.comment('foul', { player: off.d.name });
    if (pen) {
      this.dead(() => this.makePenalty(t, false));
      this.comment('penalty', { team: t.data.name }, true);
      this.hud.banner('פנדל!', t.data.name, 'big');
      this.excitement = 1;
    } else {
      this.dead(() => this.makeFreeKick(t, spot, true));
      const dGoal = Math.hypot(spot.x - t.dir * HL, spot.z);
      if (dGoal < 32) this.comment('freekick', { team: t.data.name });
    }
    this.audio.whistle('long');
  }

  card(p: Plr, kind: 'yellow' | 'red') {
    if (kind === 'yellow') {
      p.yellow++;
      p.stats.yellow++;
      p.team.stats.yellows++;
      if (p.yellow >= 2) {
        this.hud.banner('כרטיס צהוב שני – אדום', p.d.name, 'red', 3);
        this.sendOff(p);
        return;
      }
      this.hud.banner('כרטיס צהוב', `${p.d.name} (${p.team.data.short})`, 'yellow', 2.5);
      this.comment('yellow', { player: p.d.name }, true);
    } else {
      this.hud.banner('כרטיס אדום!', `${p.d.name} (${p.team.data.short})`, 'red', 3);
      this.comment('red', { player: p.d.name, team: p.team.data.name }, true);
      this.sendOff(p);
    }
  }

  private sendOff(p: Plr) {
    p.sent = true;
    p.stats.red = true;
    p.team.stats.reds++;
    p.model.root.visible = false;
    p.pos.set(0, 0, -HW - 8);
    if (p.team.controlled === p) p.team.controlled = null;
    if (this.owner === p) this.owner = null;
    if (p.isGK) {
      // an outfield player goes in goal
      const sub = p.team.players.find((q) => !q.sent && !q.isGK && q.slot.pos === 'DEF') ?? p.team.players.find((q) => !q.sent && !q.isGK);
      if (sub) {
        const i = p.team.players.indexOf(sub);
        const gi = p.team.players.indexOf(p);
        p.team.players[gi] = sub;
        p.team.players[i] = p;
        sub.isGK = true;
        sub.pose.isGK = true;
        sub.slot = p.team.slots[0];
      }
    }
  }

  private callOffside(p: Plr) {
    const t = this.opp(p.team);
    p.team.stats.offsides++;
    this.offside = null;
    this.hud.banner('נבדל', p.d.name, 'info', 1.8);
    this.comment('offside', { player: p.d.name }, true);
    const spot = p.pos.clone().setY(0);
    spot.x = clamp(spot.x, -HL + 1, HL - 1);
    spot.z = clamp(spot.z, -HW + 1, HW - 1);
    this.dead(() => this.makeFreeKick(t, spot, false));
  }

  private goal(scoring: Team) {
    const last = this.lastTouch;
    const own = !!last && last.team !== scoring;
    scoring.score++;
    const scorer = last ?? scoring.players[10];
    const minute = Math.max(1, Math.ceil(this.minute));
    if (this.shootout) {
      this.phase = 'goal';
      this.phaseT = 0;
      this.shootoutResult(true);
      return;
    }
    if (!own) {
      scorer.stats.goals++;
      const assist = this.prevTouch && this.prevTouch.team === scoring && this.prevTouch !== scorer ? this.prevTouch : null;
      if (assist) assist.stats.assists++;
    }
    for (const p of this.opp(scoring).players) if (p.isGK) p.stats.conceded++;
    this.scorers.push({ side: scoring.side, name: scorer.d.name, minute, own, id: scorer.d.id });
    this.phase = 'goal';
    this.phaseT = 0;
    this.goalSide = scoring.side;
    this.owner = null;
    this.excitement = 1;
    this.audio.roar(1);
    this.audio.whistle('short');
    const [h, a] = [this.teams[0].score, this.teams[1].score];
    this.hud.banner(own ? 'שער עצמי!' : 'גוווול!', `${scorer.d.name} ${minute}'  ·  ${h} - ${a}`, 'goal', 3.5);
    if (own) this.comment('ownGoal', { player: scorer.d.name }, true);
    else this.comment('goal', { player: scorer.d.name, team: scoring.data.name }, true);
    if (h === a) setTimeout(() => !this.done && this.comment('equalizer', {}, true), 3000);
    this.updateHudScore();
    // celebration: scorer runs to the corner, teammates follow
    const cel = own ? null : scorer;
    if (cel) {
      cel.celebrate = Math.floor(Math.random() * 3);
      cel.action = { kind: 'celebrate', t: 0, dur: 4.5, contact: 1, fired: false };
      cel.pose.celebrateStyle = cel.celebrate;
    }
    this.goalScorer = cel;
    this.replayEnd = this.replayCount;
  }
  goalScorer: Plr | null = null;

  private endHalf() {
    this.audio.whistle(this.half === 1 ? 'end' : 'end');
    this.owner = null;
    this.held = null;
    const [h, a] = [this.teams[0].score, this.teams[1].score];
    const score = `${this.teams[0].data.name} ${h} - ${a} ${this.teams[1].data.name}`;
    if (this.half === 1) {
      this.phase = 'halftime';
      this.comment('halftime', { score }, true);
      this.hud.showPanel(this.statsHtml('מחצית'), 'למחצית השנייה').then(() => {
        this.half = 2;
        this.clock = 0;
        this.added = 2 + Math.floor(Math.random() * 4);
        for (const t of this.teams) t.dir = (t.dir * -1) as 1 | -1;
        const kt = this.teams[1 - this.kickoffTeam];
        this.beginSetPiece(this.makeKickoff(kt));
        this.comment('secondHalf', {}, true);
        this.audio.whistle('short');
      });
      return;
    }
    if (this.setup.knockout && h === a) {
      this.startShootout();
      return;
    }
    this.finish();
  }

  private finish() {
    this.phase = 'fulltime';
    const [h, a] = [this.teams[0].score, this.teams[1].score];
    const score = `${this.teams[0].data.name} ${h} - ${a} ${this.teams[1].data.name}`;
    this.comment('fulltime', { score }, true);
    this.audio.roar(0.6);
    const res = this.result();
    let extra = '';
    if (res.pens) extra = `<p class="pens">פנדלים: ${res.pens[0]} - ${res.pens[1]}</p>`;
    this.hud.showPanel(this.statsHtml('סיום המשחק', extra), 'המשך').then(() => {
      this.done = true;
      this.onEnd(res);
    });
  }

  statsHtml(title: string, extra = '') {
    const [H, A] = this.teams;
    const tot = H.stats.poss + A.stats.poss || 1;
    const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');
    const ht = (t: Team): HudTeam => ({ short: t.data.short, name: t.data.name, color: t.kit.shirt, color2: t.kit.shorts });
    const sc = (side: number) => this.scorers.filter((s) => s.side === side).map((s) => `${s.name} ${s.minute}'${s.own ? ' (ע)' : ''}`).join('<br>') || '&nbsp;';
    const goals = `<div class="scorers"><div>${sc(0)}</div><div class="big">${H.score} - ${A.score}</div><div>${sc(1)}</div></div>`;
    return statsTable(title, ht(H), ht(A), [
      ['החזקה בכדור', pct(H.stats.poss, tot), pct(A.stats.poss, tot)],
      ['בעיטות', H.stats.shots, A.stats.shots],
      ['למסגרת', H.stats.onTarget, A.stats.onTarget],
      ['מסירות', H.stats.passes, A.stats.passes],
      ['דיוק מסירות', pct(H.stats.passOk, H.stats.passes), pct(A.stats.passOk, A.stats.passes)],
      ['תיקולים', H.stats.tackles, A.stats.tackles],
      ['הצלות', H.stats.saves, A.stats.saves],
      ['קרנות', H.stats.corners, A.stats.corners],
      ['עבירות', H.stats.fouls, A.stats.fouls],
      ['נבדלים', H.stats.offsides, A.stats.offsides],
      ['צהובים / אדומים', `${H.stats.yellows} / ${H.stats.reds}`, `${A.stats.yellows} / ${A.stats.reds}`],
    ], goals + extra);
  }

  result(): MatchResult {
    const [H, A] = this.teams;
    const ratings: Record<string, number> = {};
    const playerStats: Record<string, PStats> = {};
    for (const p of this.all) {
      const s = p.stats;
      const win = p.team.score > this.opp(p.team).score ? 0.4 : p.team.score < this.opp(p.team).score ? -0.3 : 0;
      let r = 6.2 + s.goals * 1.1 + s.assists * 0.7 + s.passOk * 0.04 - (s.passes - s.passOk) * 0.06 + s.tackles * 0.15 + s.saves * 0.35 + s.onTarget * 0.12 - s.conceded * (p.isGK ? 0.35 : 0.05) - s.yellow * 0.3 - (s.red ? 1.5 : 0) + win;
      if (p.isGK && s.conceded === 0) r += 0.6;
      ratings[p.d.id] = Math.round(clamp(r, 3, 10) * 10) / 10;
      playerStats[p.d.id] = { ...s };
    }
    let pens: [number, number] | null = null;
    let winner: 0 | 1 | -1 = H.score > A.score ? 0 : A.score > H.score ? 1 : -1;
    if (this.shootout) {
      const k = this.shootout.kicks;
      pens = [k[0].filter(Boolean).length, k[1].filter(Boolean).length];
      winner = pens[0] > pens[1] ? 0 : 1;
    }
    return { goals: [H.score, A.score], pens, scorers: this.scorers, ratings, playerStats, stats: [H.stats, A.stats], winner };
  }

  // ------------------------------------------------------------------ set pieces
  makeKickoff(t: Team): SetPiece {
    const taker = t.players.filter((p) => !p.sent && p.slot.pos === 'FWD')[0] ?? t.players[10];
    return this.newSP('kickoff', t, new V(0, 0, 0), taker, false);
  }
  private makeThrow(t: Team, spot: V3): SetPiece {
    return this.newSP('throw', t, spot, this.nearestOutfield(t, spot), false);
  }
  private makeCorner(t: Team, spot: V3): SetPiece {
    const taker = [...t.active()].filter((p) => !p.isGK).sort((a, b) => b.s.passing + b.s.freeKick - (a.s.passing + a.s.freeKick))[0];
    return this.newSP('corner', t, spot, taker, false);
  }
  private makeGoalKick(t: Team, spot: V3): SetPiece {
    return this.newSP('goalkick', t, spot, t.gk, false);
  }
  private makeFreeKick(t: Team, spot: V3, direct: boolean): SetPiece {
    const dGoal = Math.hypot(spot.x - t.dir * HL, spot.z);
    const taker = dGoal < 35 ? [...t.active()].filter((p) => !p.isGK).sort((a, b) => b.s.freeKick - a.s.freeKick)[0] : this.nearestOutfield(t, spot);
    return this.newSP('freekick', t, spot, taker, direct);
  }
  private makePenalty(t: Team, shootout: boolean, taker?: Plr): SetPiece {
    const spot = new V(t.dir * (HL - FIELD.PEN_D), 0, 0);
    const k = taker ?? [...t.active()].filter((p) => !p.isGK).sort((a, b) => b.s.shooting + b.s.composure - (a.s.shooting + a.s.composure))[0];
    const sp = this.newSP('penalty', t, spot, k, true);
    sp.shootout = shootout;
    return sp;
  }
  private nearestOutfield(t: Team, spot: V3) {
    let best = t.players[1];
    let bd = Infinity;
    for (const p of t.players) {
      if (p.sent || p.isGK) continue;
      const d = hdist(p.pos, spot);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  private newSP(kind: SPKind, team: Team, spot: V3, taker: Plr, direct: boolean): SetPiece {
    return {
      kind, team, spot, taker, direct, wall: [], t: 0, aimZ: 0, aimY: 1.2, aimPoint: new V(), spinX: 0, spinY: 0,
      charging: false, power: 0, ringT: Math.random() * 3, shootout: false, gkGuess: null, wallJump: false, wallShift: 0, taken: false,
    };
  }

  placeKickoff(t: Team) {
    this.beginSetPiece(this.makeKickoff(t), true);
  }

  beginSetPiece(sp: SetPiece, silent = false) {
    this.sp = sp;
    this.phase = silent ? this.phase : 'setpiece';
    this.phaseT = 0;
    this.owner = null;
    this.held = null;
    this.offside = null;
    this.lastKick = null;
    const b = this.ball;
    b.pos.copy(sp.spot).setY(BALL_R);
    b.vel.set(0, 0, 0);
    b.spin.set(0, 0, 0);
    b.inNet = 0;
    for (const p of this.all) {
      p.action = null;
      p.pending = null;
      p.charging = null;
      p.recv = null;
      p.ai.run = null;
      p.vel.set(0, 0, 0);
      p.stun = 0;
    }
    this.positionForSetPiece(sp);
    for (const p of this.all) {
      if (p.sent) continue;
      p.ai.target.copy(p.pos);
      p.model.root.position.copy(p.pos);
      p.model.root.rotation.y = p.facing;
    }
    if (sp.kind === 'throw') {
      this.held = sp.taker;
      sp.taker.pose.isGK = sp.taker.isGK;
    }
    const t = sp.team;
    // human control goes to the taker
    if (t.pad !== null && !this.careerId) t.controlled = sp.taker;
    const o = this.opp(t);
    if (o.pad !== null && !this.careerId) {
      o.controlled = sp.kind === 'penalty' ? o.gk : this.nearestOutfield(o, sp.spot);
    }
    // default aims
    const goal = new V(t.dir * HL, 0, 0);
    if (sp.kind === 'freekick' && sp.direct && hdist(sp.spot, goal) < 34) {
      sp.aimZ = -Math.sign(sp.spot.z || 1) * 2.4;
      sp.aimY = 1.6;
    } else if (sp.kind === 'penalty') {
      sp.aimZ = (Math.random() < 0.5 ? -1 : 1) * 2;
      sp.aimY = 0.8;
    } else if (sp.kind === 'corner') {
      sp.aimPoint.set(t.dir * (HL - 9), 0, -Math.sign(sp.spot.z) * 1.5);
      sp.spinX = 0.6 * -Math.sign(sp.spot.z) * t.dir;
    }
    this.camMode = sp.kind === 'kickoff' || sp.kind === 'throw' || sp.kind === 'goalkick' ? 'broadcast' : 'setpiece';
    if (sp.kind === 'penalty' && !sp.shootout) this.audio.whistle('short');
  }

  private positionForSetPiece(sp: SetPiece) {
    const t = sp.team;
    const o = this.opp(t);
    const goal = new V(t.dir * HL, 0, 0);
    const toGoal = goal.clone().sub(sp.spot).setY(0).normalize();
    const place = (p: Plr, pos: V3, look?: V3) => {
      p.pos.copy(pos).setY(0);
      p.pos.x = clamp(p.pos.x, -HL - 3, HL + 3);
      p.pos.z = clamp(p.pos.z, -HW - 2, HW + 2);
      const l = look ?? this.ball.pos;
      p.facing = angOf(l.x - p.pos.x, l.z - p.pos.z);
    };
    // everyone starts from formation positions relative to the ball
    for (const team of this.teams) {
      const attacking = team === t;
      for (const p of team.players) {
        if (p.sent) continue;
        const pos = this.formationSpot(p, attacking, sp.spot);
        place(p, pos);
      }
    }
    const keepAway = (team: Team, r: number, except?: Plr[]) => {
      for (const p of team.players) {
        if (p.sent || except?.includes(p)) continue;
        const d = hdist(p.pos, sp.spot);
        if (d < r) {
          const away = p.pos.clone().sub(sp.spot).setY(0);
          if (away.lengthSq() < 0.01) away.set(-team.dir, 0, 0);
          p.pos.copy(sp.spot).addScaledVector(away.normalize(), r + 0.3);
        }
      }
    };
    switch (sp.kind) {
      case 'kickoff': {
        for (const team of this.teams) {
          for (const p of team.players) {
            if (p.sent) continue;
            const a = Math.min(team.along(p.pos), HL - 1);
            const pos = team.world(p.isGK ? 1.5 : Math.min(a, HL - 1.2), team.lat(p.pos));
            place(p, pos, new V(0, 0, 0));
          }
          if (team !== t) keepAway(team, 9.4);
        }
        place(sp.taker, new V(-t.dir * 0.35, 0, 0.3), new V(-t.dir * 10, 0, 0));
        const mate = t.players.find((p) => !p.sent && p !== sp.taker && p.slot.pos !== 'GK' && p.slot.pos !== 'DEF' && p.slot.depth > 0.6) ?? t.players[6];
        if (mate) place(mate, new V(-t.dir * 2, 0, -6), new V(0, 0, 0));
        break;
      }
      case 'throw': {
        place(sp.taker, sp.spot.clone(), new V(sp.spot.x, 0, 0));
        keepAway(o, 2.5);
        break;
      }
      case 'goalkick': {
        place(sp.taker, sp.spot.clone().addScaledVector(toGoal, -1.2), goal);
        for (const p of o.players) {
          if (p.sent) continue;
          if (this.inBox(t, p.pos)) p.pos.copy(t.world(BOX_D + 2 + Math.random() * 6, t.lat(p.pos)));
        }
        break;
      }
      case 'corner': {
        place(sp.taker, sp.spot.clone().add(new V(t.dir * 0.8, 0, Math.sign(sp.spot.z) * 0.8)));
        const spots = [[3, -2], [5.5, 2.5], [8, -1], [11, 1.5], [7, 4.5], [13, -3]];
        const attackers = t.players.filter((p) => !p.sent && !p.isGK && p !== sp.taker).sort((a, b) => b.d.height + b.s.physical - (a.d.height + a.s.physical));
        attackers.slice(0, 6).forEach((p, i) => place(p, t.world(105 - spots[i][0], spots[i][1] * -Math.sign(t.lat(sp.spot)) * 1.2)));
        attackers.slice(6).forEach((p, i) => place(p, t.world(70 - i * 8, (i - 1) * 12)));
        const defenders = o.players.filter((p) => !p.sent && !p.isGK);
        defenders.forEach((p, i) => {
          if (i < attackers.length - 2 && i < 8) {
            const m = attackers[i];
            place(p, m.pos.clone().add(new V(t.dir * 0.8, 0, 0.3)));
          } else place(p, o.world(35 + i * 2, (i % 2 ? 1 : -1) * 8));
        });
        place(o.gk, o.world(0.6, Math.sign(o.lat(sp.spot)) * 0.8));
        keepAway(o, 9.15);
        break;
      }
      case 'freekick': {
        place(sp.taker, sp.spot.clone().addScaledVector(toGoal, -1.6).add(new V(0, 0, sp.taker.d.foot === 'L' ? 0.6 : -0.6)), goal);
        const dGoal = hdist(sp.spot, goal);
        if (sp.direct && dGoal < 34) {
          // wall 9.15 m away, covering the near post
          const n = dGoal < 20 ? 5 : dGoal < 26 ? 4 : 3;
          const nearPost = new V(goal.x, 0, Math.sign(sp.spot.z || 1) * GOAL_HW * 0.5);
          const wdir = nearPost.sub(sp.spot).setY(0).normalize();
          const center = sp.spot.clone().addScaledVector(wdir, 9.15);
          const perp = new V(-wdir.z, 0, wdir.x);
          const wallers = o.players.filter((p) => !p.sent && !p.isGK).sort((a, b) => b.d.height - a.d.height).slice(0, n);
          wallers.forEach((p, i) => place(p, center.clone().addScaledVector(perp, (i - (n - 1) / 2) * 0.62), sp.spot));
          sp.wall = wallers;
          const attackers = t.players.filter((p) => !p.sent && !p.isGK && p !== sp.taker);
          attackers.slice(0, 5).forEach((p, i) => place(p, t.world(105 - 9 - (i % 3) * 3, (i - 2) * 4)));
          const markers = o.players.filter((p) => !p.sent && !p.isGK && !wallers.includes(p));
          markers.forEach((p, i) => {
            const m = attackers[i];
            if (m && i < 5) place(p, m.pos.clone().add(new V(t.dir * 0.9, 0, 0.4)));
          });
          place(o.gk, o.world(0.6, o.lat(sp.spot) * 0.04 + -Math.sign(o.lat(sp.spot) || 1) * 0.8));
        }
        keepAway(o, 9.15, sp.wall);
        break;
      }
      case 'penalty': {
        place(sp.taker, sp.spot.clone().addScaledVector(toGoal, -2.2), goal);
        for (const team of this.teams)
          for (const p of team.players) {
            if (p.sent || p === sp.taker || (p.isGK && team === o)) continue;
            if (sp.shootout) {
              place(p, new V((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 10), sp.spot);
              continue;
            }
            const a = t.along(p.pos);
            if (a > 105 - BOX_D - 1 || Math.abs(p.pos.z) < BOX_HW + 1) {
              const lat = (p.idx % 2 ? 1 : -1) * (6 + (p.idx % 5) * 3);
              place(p, t.world(105 - BOX_D - 3 - (p.idx % 3) * 2, lat));
            }
          }
        place(o.gk, new V(t.dir * (HL - 0.1), 0, 0), sp.spot);
        break;
      }
    }
    if (sp.kind !== 'kickoff' && sp.kind !== 'penalty') {
      // a teammate offers a short option
      const near = t.players.filter((p) => !p.sent && p !== sp.taker && !p.isGK).sort((a, b) => hdist(a.pos, sp.spot) - hdist(b.pos, sp.spot))[0];
      if (near && hdist(near.pos, sp.spot) > 12 && sp.kind !== 'corner') {
        const off = new V(-t.dir * 4, 0, sp.spot.z > 0 ? -7 : 7);
        near.pos.copy(sp.spot).add(off);
        near.pos.z = clamp(near.pos.z, -HW + 1, HW - 1);
      }
    }
  }

  // Formation slot position for a team given where the ball is.
  formationSpot(p: Plr, attacking: boolean, ballPos: V3): V3 {
    const t = p.team;
    const tac = t.tactic;
    const ballA = t.along(ballPos);
    const ballW = t.lat(ballPos);
    if (p.isGK) return t.world(attacking ? 8 : clamp(ballA * 0.08, 0.8, 5), clamp(ballW * 0.08, -2.5, 2.5));
    let defLine: number;
    let span: number;
    if (attacking) {
      defLine = clamp(ballA - 24 + tac.lineHeight * 10, 14 + tac.lineHeight * 26, 62);
      span = 27 + tac.depth * 14;
    } else {
      defLine = clamp(ballA - 16 - (1 - tac.lineHeight) * 8, 8 + tac.lineHeight * 22, 26 + tac.lineHeight * 16);
      span = 17 + tac.depth * 13;
    }
    const slot = p.slot;
    let a = defLine + Math.max(0, slot.depth) * span;
    if (!attacking && tac.forwardsStayHigh && slot.pos === 'FWD') a = Math.max(a, 50);
    const width = attacking ? 22 + tac.width * 9 : 13 + tac.width * 5;
    let w = slot.w * width + ballW * (attacking ? 0.2 : 0.42);
    w = clamp(w, -HW + 2, HW - 2);
    if (attacking) {
      const off = this.offsideLineFor(t);
      a = Math.min(a, off - 0.8);
    }
    a = clamp(a, 3, 103);
    return t.world(a, w);
  }

  offsideLineFor(t: Team) {
    const o = this.opp(t);
    const alongs = o.active().map((q) => t.along(q.pos)).sort((x, y) => y - x);
    return Math.max(alongs[1] ?? 105, t.along(this.ball.pos), HL);
  }

  // ------------------------------------------------------------------ set piece play
  private stepSetPiece(dt: number) {
    const sp = this.sp!;
    sp.t += dt;
    sp.ringT += dt;
    // the taker steps into place
    const tk = sp.taker;
    if (sp.taken) {
      if (tk.action && !tk.action.fired) return;
      this.phase = 'play';
      this.phaseT = 0;
      this.aimGroup.visible = false;
      this.hud.hint(null);
      this.hud.power(false);
      this.camMode = 'broadcast';
      if (sp.kind === 'penalty') {
        this.penaltyKeeper(sp);
        this.penaltyWatch = sp.shootout ? 3.5 : 0;
      }
      return;
    }
    const human = sp.team.pad !== null && (!this.careerId || tk.d.id === this.careerId);
    if (human) {
      this.updateAimVisuals(sp);
      return;
    }
    // AI taker
    const wait = sp.kind === 'penalty' ? 1.8 : sp.kind === 'kickoff' ? 0.8 : 1.4;
    this.updateAimVisuals(sp, true);
    if (sp.t > wait) this.aiTakeSetPiece(sp);
  }
  penaltyWatch = 0;

  private aiTakeSetPiece(sp: SetPiece) {
    const t = sp.team;
    const tk = sp.taker;
    const goal = new V(t.dir * HL, 0, 0);
    const mates = t.players.filter((p) => !p.sent && p !== tk);
    const open = (p: Plr) => this.laneOpenness(sp.spot, p.pos, t) + clamp(this.nearestOpp(p) / 6, 0, 1);
    switch (sp.kind) {
      case 'kickoff': {
        const tgt = mates.filter((p) => t.along(p.pos) < HL).sort((a, b) => hdist(a.pos, sp.spot) - hdist(b.pos, sp.spot))[0];
        this.takeSP(sp, { type: 'pass', power: 0.2, dir: null, target: tgt, t: 1, setPiece: true });
        break;
      }
      case 'throw': {
        const tgt = mates.filter((p) => !p.isGK && hdist(p.pos, sp.spot) < 25).sort((a, b) => open(b) - hdist(b.pos, sp.spot) * 0.05 - (open(a) - hdist(a.pos, sp.spot) * 0.05))[0];
        this.takeSP(sp, { type: 'throwIn', power: 0.4, dir: null, target: tgt, t: 1, setPiece: true });
        break;
      }
      case 'goalkick': {
        const short = t.tactic.directness < 0.5 && Math.random() < 0.7;
        if (short) {
          const cb = mates.filter((p) => p.slot.pos === 'DEF').sort((a, b) => open(b) - open(a))[0];
          this.takeSP(sp, { type: 'pass', power: 0.3, dir: null, target: cb, t: 1, setPiece: true });
        } else {
          const fw = mates.filter((p) => p.slot.pos !== 'DEF' && !p.isGK).sort((a, b) => t.along(b.pos) - t.along(a.pos))[Math.floor(Math.random() * 3)];
          this.takeSP(sp, { type: 'gkKick', power: 0.8, dir: null, target: fw, t: 1, setPiece: true });
        }
        break;
      }
      case 'corner': {
        if (Math.random() < 0.15) {
          const near = mates.sort((a, b) => hdist(a.pos, sp.spot) - hdist(b.pos, sp.spot))[0];
          this.takeSP(sp, { type: 'pass', power: 0.2, dir: null, target: near, t: 1, setPiece: true });
        } else {
          const pts = [[6, -2], [11, 0], [5, 3]];
          const pk = pts[Math.floor(Math.random() * pts.length)];
          const pt = t.world(105 - pk[0], pk[1] * -Math.sign(t.lat(sp.spot)));
          this.takeSP(sp, { type: 'cross', power: 0.7, dir: null, point: pt, t: 1, setPiece: true, spinX: sp.spinX });
        }
        break;
      }
      case 'freekick': {
        const d = hdist(sp.spot, goal);
        const angle = Math.abs(Math.atan2(sp.spot.z, Math.abs(goal.x - sp.spot.x)));
        if (sp.direct && d < 30 && angle < 0.9 && Math.random() < 0.35 + tk.s.freeKick / 200) {
          const z = -Math.sign(sp.spot.z || (Math.random() - 0.5)) * (GOAL_HW - 0.6) * (Math.random() < 0.75 ? 1 : -1);
          const curl = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4);
          this.takeSP(sp, { type: 'shot', power: 0.55 + Math.random() * 0.15, dir: null, aim: { z, y: 1.9 + Math.random() * 0.4 }, spinX: curl, spinY: 0.5, t: 1, setPiece: true });
        } else if (d < 40 && sp.direct) {
          const pt = t.world(105 - 8 - Math.random() * 4, (Math.random() - 0.5) * 10);
          this.takeSP(sp, { type: 'cross', power: 0.6, dir: null, point: pt, t: 1, setPiece: true });
        } else {
          const tgt = mates.filter((p) => !p.isGK && hdist(p.pos, sp.spot) < 30).sort((a, b) => open(b) + t.along(b.pos) * 0.02 - (open(a) + t.along(a.pos) * 0.02))[0];
          this.takeSP(sp, { type: 'pass', power: 0.4, dir: null, target: tgt, t: 1, setPiece: true });
        }
        break;
      }
      case 'penalty': {
        const s = tk.s;
        const z = (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 1.6);
        const y = 0.3 + Math.random() * 1.5;
        const errR = (1 - s.composure / 100) * 0.9 + (1 - s.shooting / 100) * 0.5 + (sp.shootout ? 0.2 : 0);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * errR;
        this.takeSP(sp, { type: 'shot', power: 0.65 + Math.random() * 0.15, dir: null, aim: { z: z + Math.cos(a) * r, y: clamp(y + Math.sin(a) * r, 0.1, 3) }, t: 1, setPiece: true });
        break;
      }
    }
  }

  nearestOpp(p: Plr) {
    let d = 99;
    for (const q of this.opp(p.team).players) if (!q.sent) d = Math.min(d, hdist(q.pos, p.pos));
    return d;
  }

  private takeSP(sp: SetPiece, o: KickOrder) {
    sp.taken = true;
    const tk = sp.taker;
    if (o.target) tk.facing = angOf(o.target.pos.x - tk.pos.x, o.target.pos.z - tk.pos.z);
    if (sp.kind === 'throw') {
      this.held = tk;
      o.type = o.type === 'pass' ? 'throwIn' : o.type === 'lob' ? 'throwIn' : o.type;
    }
    if (sp.kind === 'goalkick' && o.type === 'lob') o.type = 'gkKick';
    if (sp.kind === 'penalty' && o.type === 'shot') {
      this.penaltyGkCommit(sp);
    }
    this.startKick(tk, o);
    if (sp.kind === 'throw') tk.action!.kind = 'throw';
    // walls jump when the kick is struck (AI: usually)
    if (sp.wall.length && (sp.wallJump || this.opp(sp.team).pad === null)) {
      const jump = this.opp(sp.team).pad === null ? Math.random() < 0.7 : sp.wallJump;
      if (jump) setTimeout(() => {
        for (const w of sp.wall) if (!w.sent) w.action = { kind: 'wallJump', t: 0, dur: 0.7, contact: 1, fired: false };
      }, (tk.action!.dur * tk.action!.contact - 0.1) * 1000);
    }
  }

  // Keeper's penalty guess, decided at the strike.
  private penaltyGkCommit(sp: SetPiece) {
    const o = this.opp(sp.team);
    const gk = o.gk;
    let guess = sp.gkGuess;
    if (guess === null) guess = Math.random() < 0.18 ? 0 : Math.random() < 0.5 ? -1 : 1;
    sp.gkGuess = guess;
    gk.gk.react = -2; // scripted
  }

  private penaltyKeeper(sp: SetPiece) {
    const o = this.opp(sp.team);
    const gk = o.gk;
    const guess = sp.gkGuess ?? 0;
    if (guess === 0) return;
    // dive to the guessed side (world z)
    const side = guess;
    gk.gk.diveVel.set(0, 0, side * (4.2 + gk.s.gk / 60));
    gk.action = { kind: 'dive', t: 0, dur: 1.2, contact: 1, fired: false };
    const right = new V(-Math.cos(gk.facing), 0, Math.sin(gk.facing));
    gk.pose.diveSide = right.z * side > 0 ? 1 : -1;
    gk.pose.diveHigh = 0.4;
    gk.gk.saveTried = false;
  }

  // Human controls during a set piece.
  private humanSetPiece(t: Team, pad: Pad, dt: number) {
    const sp = this.sp!;
    if (sp.taken) return;
    const attacking = sp.team === t;
    const tk = sp.taker;
    const has = (b: Btn) => pad.pressed.has(b);
    const held = (b: Btn) => pad.held[b];
    const stick = this.stickToWorld(pad.mx, pad.my, new V());
    const goal = new V(sp.team.dir * HL, 0, 0);
    if (!attacking) {
      if (this.careerId) return;
      // defending: penalty dive choice or wall control
      if (sp.kind === 'penalty') {
        if (stick.lengthSq() > 0.1) sp.gkGuess = Math.abs(stick.z) > 0.3 ? Math.sign(stick.z) : 0;
        if (has('B') || has('A') || has('X')) {
          this.hud.hint(`<b>השוער</b>: ${sp.gkGuess === null ? 'נשאר במרכז' : sp.gkGuess === 0 ? 'נשאר במרכז' : 'יזנק לצד שבחרת'}`);
        }
      } else if (sp.wall.length) {
        if (has('X')) sp.wallJump = !sp.wallJump;
        if (held('LT')) {
          for (const w of sp.wall) w.pos.addScaledVector(stick, 1.2 * dt);
        }
      }
      return;
    }
    if (this.careerId && tk.d.id !== this.careerId) return;
    const spin = (pad.rx || pad.ry) ? { x: pad.rx, y: pad.ry } : null;
    if (spin) {
      sp.spinX = clamp(sp.spinX + spin.x * dt * 1.8, -1, 1);
      sp.spinY = clamp(sp.spinY + spin.y * dt * 1.8, -1, 1);
    }
    const shootable = (sp.kind === 'freekick' && sp.direct && hdist(sp.spot, goal) < 36) || sp.kind === 'penalty';
    const cross = sp.kind === 'corner' || (sp.kind === 'freekick' && !shootable && hdist(sp.spot, goal) < 45);
    if (shootable) {
      // move the reticle over the goal
      const lat = new V(0, 0, 1);
      const zMove = stick.dot(lat) * (sp.team.dir > 0 ? 1 : 1);
      sp.aimZ = clamp(sp.aimZ + zMove * dt * 3.2, -GOAL_HW - 1, GOAL_HW + 1);
      sp.aimY = clamp(sp.aimY + pad.my * dt * 1.8 * (Math.abs(stick.x) > Math.abs(stick.z) ? 1 : 1), 0.1, 3.4);
      if (sp.kind === 'penalty') sp.aimY = clamp(sp.aimY, 0.1, 3.4);
    } else if (cross) {
      sp.aimPoint.addScaledVector(stick, dt * 14);
      sp.aimPoint.x = clamp(sp.aimPoint.x, -HL + 1, HL - 1);
      sp.aimPoint.z = clamp(sp.aimPoint.z, -HW + 1, HW - 1);
    }
    // power: hold B (shot) or X (cross) to charge, release to strike
    for (const b of ['B', 'X'] as Btn[]) {
      if (has(b)) {
        sp.charging = true;
        sp.power = 0;
      }
    }
    if (sp.charging) sp.power = Math.min(1, sp.power + dt / 1.0);
    const rel = (b: Btn) => pad.released.has(b) && sp.charging;
    if (rel('B') && shootable) {
      sp.charging = false;
      let z = sp.aimZ;
      let y = sp.aimY;
      if (sp.kind === 'penalty') {
        const r = this.compRadius(sp) * 1.2;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * r;
        z += Math.cos(a) * rr;
        y += Math.sin(a) * rr + Math.max(0, sp.power - 0.85) * 4;
      }
      this.takeSP(sp, { type: 'shot', power: sp.power, dir: null, aim: { z, y }, spinX: sp.kind === 'penalty' ? 0 : sp.spinX, spinY: sp.spinY, t: 1, setPiece: true });
      return;
    }
    if ((rel('X') || rel('B')) && (cross || sp.kind === 'freekick')) {
      sp.charging = false;
      const pt = cross ? sp.aimPoint.clone() : this.choosePassTarget(tk, stick.lengthSq() > 0.05 ? stick.clone().normalize() : null, 'lob')?.pos.clone() ?? tk.pos.clone().addScaledVector(tk.dir(), 25);
      this.takeSP(sp, { type: sp.kind === 'corner' || cross ? 'cross' : 'lob', power: sp.power, dir: null, point: pt, spinX: sp.spinX, t: 1, setPiece: true });
      return;
    }
    if (rel('X') && sp.kind === 'goalkick') {
      sp.charging = false;
      const tgt = this.choosePassTarget(tk, stick.lengthSq() > 0.05 ? stick.clone().normalize() : null, 'lob');
      this.takeSP(sp, { type: 'gkKick', power: sp.power, dir: stick.clone().normalize(), target: tgt, t: 1, setPiece: true });
      return;
    }
    if (rel('X') && sp.kind === 'throw') {
      sp.charging = false;
      const tgt = this.choosePassTarget(tk, stick.lengthSq() > 0.05 ? stick.clone().normalize() : null, 'lob');
      this.takeSP(sp, { type: 'throwIn', power: sp.power, dir: null, target: tgt, t: 1, setPiece: true });
      return;
    }
    if (has('A') && sp.kind !== 'penalty') {
      const dir = stick.lengthSq() > 0.05 ? stick.clone().normalize() : null;
      const tgt = this.choosePassTarget(tk, dir, 'pass');
      this.takeSP(sp, { type: sp.kind === 'throw' ? 'throwIn' : 'pass', power: 0.3, dir, target: tgt, t: 1, setPiece: true });
      return;
    }
    if (has('Y') && sp.kind !== 'penalty' && sp.kind !== 'throw') {
      const dir = stick.lengthSq() > 0.05 ? stick.clone().normalize() : null;
      const tgt = this.choosePassTarget(tk, dir, 'through');
      this.takeSP(sp, { type: 'through', power: 0.5, dir, target: tgt, t: 1, setPiece: true });
    }
  }

  compRadius(sp: SetPiece) {
    const tk = sp.taker;
    const base = 0.25 + (1 - tk.s.composure / 100) * 0.9 + (1 - tk.stamina) * 0.4 + (sp.shootout ? 0.15 : 0);
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin(sp.ringT * 1.7));
    const jitter = (1 - tk.s.composure / 100) * 0.15 * Math.sin(sp.ringT * 13);
    return Math.max(0.12, base * pulse + jitter);
  }

  private updateAimVisuals(sp: SetPiece, aiOnly = false) {
    const goal = new V(sp.team.dir * HL, 0, 0);
    const shootable = (sp.kind === 'freekick' && sp.direct && hdist(sp.spot, goal) < 36) || sp.kind === 'penalty';
    const cross = sp.kind === 'corner' || (sp.kind === 'freekick' && !shootable && hdist(sp.spot, goal) < 45);
    const tk = sp.taker;
    if (aiOnly) {
      this.aimGroup.visible = false;
      const o = this.opp(sp.team);
      if (o.pad !== null && sp.kind === 'penalty') this.hud.hint('<b>פנדל נגדך</b> · בחר צד לזינוק עם <kbd>A</kbd>/<kbd>D</kbd> (או השאר במרכז)');
      else if (o.pad !== null && sp.wall.length) this.hud.hint(`<b>חומה</b> · <kbd>K</kbd> קפיצה (${sp.wallJump ? 'כן' : 'לא'}) · החזק <kbd>C</kbd> + כיוון להזיז את החומה`);
      else this.hud.hint(null);
      return;
    }
    this.aimGroup.visible = shootable || cross;
    this.reticle.visible = true;
    this.compRing.visible = sp.kind === 'penalty';
    const sc = this.toScreen(tk.pos, 2.3);
    if (sp.charging) this.hud.power(true, sp.power, sc.x, sc.y, 'עוצמה');
    else this.hud.power(false);
    if (shootable) {
      this.reticle.position.set(goal.x - sp.team.dir * 0.05, sp.aimY, sp.aimZ);
      this.reticle.rotation.set(0, Math.PI / 2, 0);
      if (sp.kind === 'penalty') {
        const r = this.compRadius(sp);
        this.compRing.position.copy(this.reticle.position);
        this.compRing.rotation.copy(this.reticle.rotation);
        this.compRing.scale.setScalar(r);
        (this.compRing.material as THREE.MeshBasicMaterial).color.set(r < 0.35 ? 0x4ade80 : r < 0.6 ? 0xfacc15 : 0xf87171);
        this.trajLine.visible = false;
        this.hud.hint('<b>פנדל</b> · <kbd>WASD</kbd> כיוון · החזק <kbd>L</kbd> לעוצמה ושחרר כשמעגל הריכוז קטן');
      } else {
        this.trajLine.visible = true;
        this.drawTrajectory(sp, { type: 'shot', power: sp.charging ? sp.power : 0.6, dir: null, aim: { z: sp.aimZ, y: sp.aimY }, spinX: sp.spinX, spinY: sp.spinY, t: 1, setPiece: true });
        this.hud.hint(`<b>בעיטה חופשית</b> · <kbd>WASD</kbd> כוונון · חצים: סיבוב (${Math.round(sp.spinX * 100)}) / טופ-ספין (${Math.round(sp.spinY * 100)}) · החזק <kbd>L</kbd> בעיטה · <kbd>K</kbd> הרמה · <kbd>J</kbd> מסירה`);
      }
    } else if (cross) {
      this.reticle.position.copy(sp.aimPoint).setY(0.05);
      this.reticle.rotation.set(-Math.PI / 2, 0, 0);
      this.trajLine.visible = true;
      this.drawTrajectory(sp, { type: 'cross', power: sp.charging ? sp.power : 0.6, dir: null, point: sp.aimPoint.clone(), spinX: sp.spinX, t: 1, setPiece: true });
      this.hud.hint(`<b>${sp.kind === 'corner' ? 'קרן' : 'בעיטה חופשית'}</b> · <kbd>WASD</kbd> נקודת נחיתה · חצים: סיבוב · החזק <kbd>K</kbd> הרמה · <kbd>J</kbd> מסירה קצרה`);
    } else {
      const names: Record<SPKind, string> = { kickoff: 'פתיחה', throw: 'זריקת חוץ', corner: 'קרן', goalkick: 'בעיטת שער', freekick: 'בעיטה חופשית', penalty: 'פנדל' };
      this.hud.hint(`<b>${names[sp.kind]}</b> · כיוון + <kbd>J</kbd> קצרה · <kbd>K</kbd> ארוכה${sp.kind !== 'throw' ? ' · <kbd>I</kbd> עומק' : ''}`);
    }
  }

  private drawTrajectory(sp: SetPiece, o: KickOrder) {
    // simulate the kick with the taker's skill; show more of the path for better kickers
    const tk = sp.taker;
    const saveB = new BallBody();
    saveB.copyFrom(this.ball);
    const vel = new V();
    const spin = new V();
    const from = this.ball.pos.clone();
    if (o.type === 'shot') {
      const goal = new V(sp.team.dir * HL, 0, 0);
      const target = new V(goal.x, o.aim!.y, o.aim!.z);
      const speed = 17 + o.power * 14;
      const curl = (o.spinX ?? 0) * 55;
      const dirH = target.clone().sub(from).setY(0);
      const Dh = dirH.length();
      dirH.normalize();
      const pp = new V(dirH.z, 0, -dirH.x);
      if (curl) {
        const wy = -(o.spinX ?? 0) * 55;
        spin.set(0, wy, 0);
        const T = Dh / speed;
        const drift = 0.5 * 0.0048 * Math.abs(wy) * speed * T * T * 0.55;
        dirH.copy(target.clone().addScaledVector(pp, -Math.sign(wy) * drift).sub(from).setY(0).normalize());
      }
      const T = Dh / speed;
      vel.copy(dirH).multiplyScalar(speed);
      vel.y = (target.y - from.y) / T + 0.5 * G * T * 0.9;
      spin.addScaledVector(new V().crossVectors(dirH, new V(0, 1, 0)), -(o.spinY ?? 0) * 30);
      if ((o.spinY ?? 0) < -0.3) spin.multiplyScalar(0.15);
    } else {
      const tp = o.point!;
      const dist = Math.max(4, hdist(from, tp));
      const T = 0.95 + dist * 0.026;
      lobVelocity(from, tp.clone().setY(1.2), T, vel);
      const dirH = vel.clone().setY(0).normalize();
      spin.copy(new V().crossVectors(dirH, new V(0, 1, 0)).multiplyScalar(4));
      spin.y -= (o.spinX ?? 0) * 32;
    }
    const b = new BallBody();
    b.pos.copy(from);
    b.vel.copy(vel);
    b.spin.copy(spin);
    const pts = predictPath(b, this.env(), 1 / 40, 80, []);
    const show = Math.floor(80 * (0.3 + (tk.s.freeKick / 100) * 0.45));
    const arr = (this.trajLine.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < 80; i++) {
      const q = pts[Math.min(i, show)];
      arr[i * 3] = q.x;
      arr[i * 3 + 1] = q.y;
      arr[i * 3 + 2] = q.z;
    }
    this.trajLine.geometry.attributes.position.needsUpdate = true;
    this.trajLine.geometry.setDrawRange(0, show);
    this.trajLine.computeLineDistances();
    this.ball.copyFrom(saveB);
  }

  // ------------------------------------------------------------------ shootout
  private startShootout() {
    const order = this.teams.map((t) => [...t.active()].filter((p) => !p.isGK).sort((a, b) => b.s.shooting + b.s.composure - (a.s.shooting + a.s.composure))) as [Plr[], Plr[]];
    this.shootout = { kicks: [[], []], turn: this.kickoffTeam, order, idx: [0, 0] };
    this.phase = 'dead';
    this.phaseT = 0;
    this.nextSP = null;
    this.owner = null;
    this.hud.banner('דו-קרב פנדלים', 'מי ינצח?', 'big', 3);
    this.updateHudScore();
    // shootout at one end: the side the home team attacks
    for (const t of this.teams) t.dir = (t.side === 0 ? 1 : -1) as 1 | -1;
    setTimeout(() => this.nextShootoutKick(true), 1500);
  }

  private shootoutResult(scored: boolean) {
    const so = this.shootout!;
    if (so.kicks[so.turn].length > so.kicks[1 - so.turn].length) return; // already counted
    so.kicks[so.turn].push(scored);
    this.hud.banner(scored ? 'גול!' : 'הוחמץ!', `${so.kicks[0].filter(Boolean).length} - ${so.kicks[1].filter(Boolean).length}`, scored ? 'goal' : 'info', 2.2);
    this.comment(scored ? 'penScored' : 'penMissed', {}, true);
    if (scored) this.audio.roar(0.8);
    else this.audio.groan();
    // undo the goal count in the match score
    if (scored) this.teams[so.turn].score--;
    so.turn = 1 - so.turn;
    this.phase = 'goal';
    this.phaseT = 0;
  }

  private nextShootoutKick(first = false) {
    const so = this.shootout!;
    if (!first) {
      const [a, b] = [so.kicks[0], so.kicks[1]];
      const sa = a.filter(Boolean).length;
      const sb = b.filter(Boolean).length;
      const ra = Math.max(0, 5 - a.length);
      const rb = Math.max(0, 5 - b.length);
      const decided = (a.length >= 5 && b.length >= 5 && a.length === b.length && sa !== sb) || sa + ra < sb || sb + rb < sa;
      if (decided) {
        this.finish();
        return;
      }
    }
    const t = this.teams[so.turn];
    const list = so.order[t.side];
    const taker = list[so.idx[t.side] % list.length];
    so.idx[t.side]++;
    for (const tm of this.teams) for (const p of tm.players) p.action = null;
    this.beginSetPiece(this.makePenalty(t, true, taker));
  }

  // ------------------------------------------------------------------ replay
  private record() {
    const f = this.replayBuf[this.replayHead];
    const b = this.ball;
    f[0] = b.pos.x;
    f[1] = b.pos.y;
    f[2] = b.pos.z;
    f[3] = b.quat.x;
    f[4] = b.quat.y;
    f[5] = b.quat.z;
    f[6] = b.quat.w;
    let o = 7;
    for (const p of this.all) {
      f[o] = p.pos.x;
      f[o + 1] = p.model.root.position.y;
      f[o + 2] = p.pos.z;
      f[o + 3] = p.facing;
      f[o + 4] = p.sent ? 0 : 1;
      f.set(p.model.joints, o + 5);
      o += 5 + JOINTS;
    }
    this.replayHead = (this.replayHead + 1) % REPLAY_FRAMES;
    this.replayCount++;
  }

  private startReplay() {
    const avail = Math.min(REPLAY_FRAMES, this.replayCount);
    const goalFrame = this.replayEnd;
    const frames = Math.min(avail, 210);
    // play from ~6 s before the goal to 1 s after
    const endFrame = Math.min(this.replayCount, goalFrame + 30);
    this.replayPos = Math.max(this.replayCount - avail, endFrame - frames);
    this.replayEnd = endFrame;
    this.phase = 'replay';
    this.phaseT = 0;
    this.camMode = 'replay';
    this.hud.replay(true);
  }

  private stepReplay(dt: number) {
    this.replayPos += dt * 30 * 0.6; // slow motion
    if (this.replayPos >= this.replayEnd - 1 || this.skipHeld) {
      this.skipHeld = 0;
      this.hud.replay(false);
      this.camMode = 'broadcast';
      const conceding = this.teams[1 - this.goalSide];
      for (const p of this.all) p.action = null;
      this.beginSetPiece(this.makeKickoff(conceding));
      this.audio.whistle('short');
      return;
    }
    const i = Math.floor(this.replayPos);
    const f = this.replayBuf[i % REPLAY_FRAMES];
    this.ballMesh.position.set(f[0], f[1], f[2]);
    this.ballMesh.quaternion.set(f[3], f[4], f[5], f[6]);
    let o = 7;
    for (const p of this.all) {
      p.model.root.position.set(f[o], f[o + 1], f[o + 2]);
      p.model.root.rotation.y = f[o + 3];
      p.model.root.visible = f[o + 4] > 0.5;
      p.model.apply(f.subarray(o + 5, o + 5 + JOINTS));
      o += 5 + JOINTS;
    }
  }

  // ------------------------------------------------------------------ animation & render
  private animatePlayers(dt: number) {
    for (const p of this.all) {
      if (p.sent) continue;
      const ps = p.pose;
      ps.speed = p.vel.length();
      ps.phase = p.phase;
      ps.turn = p.turn;
      ps.accel = p.accelF;
      ps.time = this.time + p.idx;
      ps.action = p.action?.kind ?? null;
      ps.actionT = p.action?.t ?? 0;
      ps.actionDur = p.action?.dur ?? 1;
      ps.contact = p.action?.contact ?? 0.5;
      ps.gkReady = p.isGK && hdist(this.ball.pos, p.pos) < 30;
      if (this.phase === 'goal' && p.team.side === this.goalSide && p !== this.goalScorer && !p.isGK) {
        ps.action = 'celebrate';
        ps.celebrateStyle = 1;
      }
      p.model.setTarget(ps);
      const fast = p.action && ['kick', 'lob', 'header', 'tackle', 'dive', 'throw'].includes(p.action.kind);
      p.model.blend(dt, fast ? 26 : 12);
      p.model.root.position.copy(p.pos);
      p.model.root.rotation.y = p.facing;
    }
    if (this.phase === 'replay') return;
    this.ballMesh.position.copy(this.ball.pos);
    this.ballMesh.quaternion.copy(this.ball.quat);
  }

  toScreen(pos: V3, up = 0) {
    const v = pos.clone();
    v.y += up;
    v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width + r.left, y: ((1 - v.y) / 2) * r.height + r.top };
  }

  private render(dt: number) {
    this.stadium.update(dt, this.excitement);
    this.audio.update(dt, this.excitement);
    this.updateCamera(dt);
    // control indicators
    for (let i = 0; i < 2; i++) {
      this.rings[i].visible = false;
      this.arrows[i].visible = false;
    }
    let hudShown = false;
    for (const t of this.teams) {
      if (t.pad === null) continue;
      const p = this.careerId ? t.players.find((q) => q.d.id === this.careerId) : t.controlled;
      if (!p || p.sent || this.phase === 'replay' || this.phase === 'intro') continue;
      const i = t.pad;
      const ring = this.rings[i];
      ring.visible = true;
      ring.position.set(p.pos.x, 0.03, p.pos.z);
      const arrow = this.arrows[i];
      arrow.visible = this.camMode !== 'setpiece';
      arrow.position.set(p.pos.x, 2.35 * p.hs + Math.sin(this.time * 6) * 0.06, p.pos.z);
      if (!hudShown) {
        this.hud.player(p.d.name, p.d.num, p.stamina, t.kit.shirt, this.careerId ? 'אתה' : '');
        hudShown = true;
      }
      // power bar
      if (p.charging && this.phase === 'play') {
        const sc = this.toScreen(p.pos, 2.4);
        const names: Record<string, string> = { pass: 'מסירה', lob: 'הגבהה', through: 'עומק', shot: p.chargeMods.finesse ? 'פינס' : p.chargeMods.chip ? 'צ\'יפ' : 'בעיטה' };
        this.hud.power(true, p.charge, sc.x, sc.y, names[p.charging] ?? '', p.charging === 'shot' ? 0.82 : 0.95);
      } else if (this.phase === 'play') this.hud.power(false);
    }
    if (!hudShown) this.hud.hidePlayer();
    // radar (hidden behind the ball during set-piece close-ups)
    this.hud.radarHidden(this.camMode === 'setpiece');
    const dots = this.all.filter((p) => !p.sent).map((p) => ({ x: p.pos.x, z: p.pos.z, side: p.team.side, me: this.isHuman(p) }));
    this.hud.drawRadar(dots, this.ball.pos, [this.teams[0].kit.shirt, this.teams[1].kit.shirt]);
    if (Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) this.updateHudScore();
    if (this.phase === 'play' && this.penaltyWatch > 0 && this.shootout) {
      this.penaltyWatch -= dt;
      const b = this.ball;
      if (this.penaltyWatch <= 0 || this.held || (b.vel.length() < 0.5 && this.phaseT > 1) || Math.abs(b.pos.x) > HL + 1 || Math.abs(b.pos.z) > HW) {
        this.penaltyWatch = 0;
        this.shootoutResult(false);
      }
    }
  }

  private updateCamera(dt: number) {
    const cam = this.camera;
    const b = this.ballMesh.position;
    const zoom = this.setup.cameraZoom;
    const want = new V();
    const look = new V();
    switch (this.camMode) {
      case 'intro': {
        const a = this.phaseT * 0.22 - 0.4;
        want.set(Math.sin(a) * 48, 20 - this.phaseT * 1.6, Math.cos(a) * 32);
        look.set(0, 1, 0);
        break;
      }
      case 'broadcast': {
        let fx = b.x;
        let fz = b.z;
        if (this.careerId) {
          const me = this.all.find((p) => p.d.id === this.careerId);
          if (me) {
            fx = lerp(fx, me.pos.x, 0.35);
            fz = lerp(fz, me.pos.z, 0.35);
          }
        }
        fx += this.ball.vel.x * 0.25;
        want.set(clamp(fx * 0.92, -46, 46), 19 * zoom, clamp(fz * 0.35, -6, 18) + 33 * zoom);
        look.set(clamp(fx, -50, 50), 0, fz * 0.75 - 2);
        break;
      }
      case 'setpiece': {
        const sp = this.sp;
        if (!sp) break;
        const goal = new V(sp.team.dir * HL, 0, sp.kind === 'corner' ? 0 : 0);
        const dir = goal.clone().sub(sp.spot).setY(0).normalize();
        if (sp.kind === 'corner') {
          want.copy(sp.spot).addScaledVector(dir, -9).setY(7);
          want.z = clamp(want.z, -HW - 6, HW + 6);
          look.set(sp.team.dir * (HL - 10), 0, 0);
        } else {
          want.copy(sp.spot).addScaledVector(dir, sp.kind === 'penalty' ? -6 : -8).setY(sp.kind === 'penalty' ? 2.4 : 3.6);
          look.copy(goal).setY(1.2).lerp(sp.spot, 0.15);
        }
        if (sp.taken) {
          want.lerp(new V(b.x * 0.9, 16, b.z * 0.3 + 30), 0.02);
        }
        break;
      }
      case 'replay': {
        const side = this.teams[this.goalSide].dir;
        const flip = Math.floor(this.phaseT / 3.5) % 2;
        if (flip) {
          want.set(side * (HL + 2.8), 2.3, b.z * 0.4 + 5);
          look.copy(b);
        } else {
          want.set(b.x - side * 6, 2.5, b.z + 9);
          look.copy(b);
        }
        break;
      }
      case 'celebrate':
        break;
    }
    if (this.phase === 'goal' && this.goalScorer) {
      const s = this.goalScorer;
      want.set(s.pos.x + 4, 2.6, s.pos.z + 7);
      look.copy(s.pos).setY(1.2);
    }
    const k = this.camMode === 'replay' ? 1 : 1 - Math.exp(-dt * (this.camMode === 'setpiece' ? 4 : 3));
    this.camPos.lerp(want, this.phase === 'goal' ? 1 - Math.exp(-dt * 2) : k);
    this.camLook.lerp(look, this.camMode === 'replay' ? 1 : 1 - Math.exp(-dt * 5));
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
  }

  // ------------------------------------------------------------------ AI hooks into the engine
  aiKick(p: Plr, o: KickOrder) {
    if (p.action && p.action.kind !== 'trap') return;
    p.pending = o;
    if (this.reach(p, 0.1)) this.startKick(p, o);
  }

  dispose() {
    this.done = true;
    for (const p of this.all)
      p.model.root.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mat?.userData?.own) {
          mat.map?.dispose();
          mat.dispose();
        }
      });
    this.audio.stopSpeech();
    this.hud.power(false);
    this.hud.hint(null);
    this.stadium.dispose();
    for (const p of this.all) this.scene.remove(p.model.root);
    this.scene.remove(this.ballMesh, this.aimGroup, ...this.rings, ...this.arrows);
  }
}

function ballTexture(orange: boolean) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = orange ? '#ff7a1a' : '#f8f8f8';
  g.fillRect(0, 0, 512, 256);
  const col = orange ? '#1f2937' : '#111827';
  const accent = orange ? '#fde047' : '#e11d48';
  // equirectangular "panels": staggered hexagon-ish patches
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i < 6; i++) {
      const x = i * 85 + (row % 2) * 42;
      const y = 26 + row * 51;
      g.fillStyle = (row + i) % 3 === 0 ? accent : col;
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 14);
      }
      g.closePath();
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.moveTo(i * 43, 0);
    g.bezierCurveTo(i * 43 + 20, 90, i * 43 - 20, 170, i * 43, 256);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

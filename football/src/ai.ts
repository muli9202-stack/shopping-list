import * as THREE from 'three';
import { FIELD, predictPath } from './physics';
import { clamp, gauss, hdist, lerp, type KickOrder, type Match, type Plr, type Team } from './match';

const V = THREE.Vector3;
type V3 = THREE.Vector3;
const { HL, HW, GOAL_HW, GOAL_H, BOX_D, BOX_HW } = FIELD;

let tick = 0;
export let debugHook: ((p: Plr, a: number, scores: number[], chosen: number, labels: string[]) => void) | null = null;
export function setDebugHook(f: typeof debugHook) {
  debugHook = f;
}

// Fastest way for p to reach the predicted ball path.
function intercept(m: Match, p: Plr): { t: number; point: V3 } {
  const sp = p.maxSpeed(true, false);
  for (let k = 0; k < m.pred.length; k++) {
    const q = m.pred[k];
    if (q.y > 2.3) continue;
    const need = Math.max(0, hdist(p.pos, q) - 0.7) / sp + 0.15;
    if (need <= k * 0.1) return { t: k * 0.1, point: q.clone().setY(0) };
  }
  const last = m.pred[m.pred.length - 1] ?? m.ball.pos;
  return { t: 3 + hdist(p.pos, last) / sp, point: last.clone().setY(0) };
}

function possessing(m: Match, t: Team) {
  if (m.owner) return m.owner.team === t;
  if (m.held) return m.held.team === t;
  if (m.lastKick && m.lastKick.type !== 'shot' && m.lastKick.type !== 'clear' && m.time - m.lastKick.t < 2.5) return m.lastKick.p.team === t;
  return m.possTeam === t;
}

export function aiThink(m: Match, dt: number) {
  if (m.pred.length === 0 || (m.predT -= dt) <= 0) {
    m.predT = 0.1;
    predictPath(m.ball, m.env(), 0.1, 30, m.pred);
  }
  const ball = m.ball.pos;
  if (m.shootout) {
    for (const p of m.all) {
      p.ai.role = p.isGK ? 'keeper' : 'hold';
      if (!p.isGK) p.ai.target.copy(p.pos);
    }
    return;
  }
  if (m.phase === 'setpiece') {
    for (const p of m.all) {
      p.ai.role = 'hold';
      p.ai.target.copy(p.pos);
      p.ai.look = ball;
    }
    return;
  }
  if (m.phase === 'goal') {
    const s = m.goalScorer;
    for (const p of m.all) {
      p.ai.sprint = false;
      p.ai.role = 'hold';
      if (s && p === s) {
        p.ai.target.set(p.team.dir * (HL - 2), 0, Math.sign(p.pos.z || 1) * (HW - 2));
        p.ai.speed = 0.85;
        p.ai.sprint = true;
      } else if (s && p.team === s.team && !p.isGK) {
        p.ai.target.copy(s.pos);
        p.ai.speed = 0.8;
      } else {
        p.ai.target.copy(m.formationSpot(p, false, new V(0, 0, 0)));
        p.ai.speed = 0.3;
      }
    }
    return;
  }
  if (m.phase === 'dead') {
    for (const p of m.all) {
      p.ai.role = 'hold';
      p.ai.sprint = false;
      p.ai.speed = 0.35;
      // players who crowd the referee after a whistle
      const arg = m.arguers.find((a) => a.p === p && a.until > m.time);
      if (arg) {
        p.ai.target.copy(arg.spot);
        p.ai.speed = 0.7;
        continue;
      }
      p.ai.target.copy(m.formationSpot(p, false, ball));
    }
    return;
  }

  tick++;
  for (const t of m.teams) {
    const o = m.opp(t);
    const attacking = possessing(m, t);
    const tac = t.tactic;
    const active = t.active();

    // ---- ball winner / chaser ----
    let chaser: Plr | null = null;
    // defenders need a moment to read a pass before going for the interception
    const justPassed = !!m.lastKick && m.lastKick.p.team !== t && m.time - m.lastKick.t < 0.32 && m.lastKick.type !== 'shot';
    if (!m.owner && !m.held) {
      let best = Infinity;
      for (const p of active) {
        if (p.isGK && !m.inBox(t, ball)) continue;
        if (p.down()) continue;
        if (justPassed && hdist(p.pos, ball) > 3) continue;
        let { t: it } = intercept(m, p);
        if (p.recv) it -= 0.6;
        if (it < best) {
          best = it;
          chaser = p;
        }
      }
    }

    // ---- pressers ----
    const pressers = new Set<Plr>();
    const carrier = m.owner && m.owner.team !== t ? m.owner : null;
    if (carrier) {
      const cA = t.along(carrier.pos);
      const human = t.pad !== null;
      const ctrl = human ? (m.careerId ? t.players.find((q) => q.d.id === m.careerId) : t.controlled) : null;
      let n = 0;
      const pressLine = lerp(45, 104, tac.press);
      const danger = cA < 35;
      const recentLoss = m.time - t.lostBallAt < 4 && tac.press > 0.8;
      if (!human) n = cA < pressLine || danger ? tac.pressers + (recentLoss ? 1 : 0) : 0;
      else {
        if (t.pressHeld) n = 1;
        else if (danger && ctrl && hdist(ctrl.pos, carrier.pos) > 7) n = 1;
      }
      if (!human && cA < pressLine) n = Math.max(n, 1);
      const cands = active.filter((p) => !p.isGK && p !== ctrl && !p.down()).sort((a, b) => hdist(a.pos, carrier.pos) - hdist(b.pos, carrier.pos));
      for (let i = 0; i < Math.min(n, cands.length); i++) pressers.add(cands[i]);
    }

    // marking assignment (one marker per attacker)
    const marked = new Set<Plr>();

    for (const p of active) {
      if (p.isGK) {
        p.ai.role = 'keeper';
        continue;
      }
      if (m.isHuman(p) && m.phase === 'play') continue;
      const ai = p.ai;
      ai.look = null;
      ai.jockey = false;
      if (m.owner === p) {
        ai.role = 'carrier';
        carrierThink(m, p, dt);
        continue;
      }
      if (p === chaser || (p.recv && !m.owner)) {
        ai.role = 'chase';
        let ic: { point: V3 } = intercept(m, p);
        if (p.recv && hdist(p.pos, p.recv.point) < hdist(p.pos, ic.point) - 4) ic = { point: p.recv.point };
        ai.target.copy(ic.point);
        ai.sprint = hdist(p.pos, ic.point) > 3;
        ai.speed = 1;
        continue;
      }
      if (pressers.has(p) && carrier) {
        ai.role = 'press';
        const own = new V(-t.dir * HL, 0, 0);
        const gs = own.sub(carrier.pos).setY(0).normalize();
        const d = hdist(p.pos, carrier.pos);
        ai.target.copy(carrier.pos).addScaledVector(carrier.vel, 0.3).addScaledVector(gs, d > 4 ? 1.4 : 0.9);
        ai.sprint = d > 6;
        ai.speed = d > 3 ? 1 : 0.6;
        ai.look = carrier.pos;
        ai.jockey = d < 3 && tac.press < 0.8;
        // tackles
        if (tick % 6 === p.idx % 6 && ai.tackleCD <= 0 && !p.action) {
          const diffF = t.pad === null ? [0.6, 0.85, 1, 1.2][m.setup.difficulty] ?? 1 : 0.9;
          const danger = t.along(carrier.pos) < 35;
          if (d < 1.4 && Math.random() < (danger ? 0.28 : 0.16) * (p.s.defending / 100) * diffF) {
            m.standingTackle(p);
            ai.tackleCD = 1.1;
          } else if (d > 1.8 && d < 3.2 && t.along(carrier.pos) < 40 && !m.inBox(t, carrier.pos) && Math.random() < 0.05 * diffF) {
            m.slideTackle(p, carrier.pos.clone().addScaledVector(carrier.vel, 0.35).sub(p.pos).setY(0).normalize());
            ai.tackleCD = 3;
          }
        }
        continue;
      }
      // ---- shape ----
      const zone = m.formationSpot(p, attacking, ball);
      if (attacking) {
        ai.role = 'support';
        ai.sprint = false;
        ai.speed = 0.85;
        // runs off the ball
        const r = ai.run;
        if (r) {
          r.t -= dt;
          if (r.t <= 0) ai.run = null;
        }
        const runner = ['ST', 'LW', 'RW', 'LM', 'RM', 'CAM'].includes(p.slot.role) || (p.slot.pos === 'DEF' && Math.abs(p.slot.w) > 0.7);
        const holder = m.owner ?? m.held;
        if (!ai.run && runner && holder && holder !== p && tick % 10 === p.idx % 10 && Math.random() < tac.runs * 0.18) {
          const off = m.offsideLineFor(t);
          const a = t.along(p.pos);
          const roll = Math.random();
          if (roll < 0.5 && a > off - 10 && p.slot.pos !== 'DEF') {
            ai.run = { target: t.world(Math.min(102, off + 14), t.lat(p.pos) * 0.8), t: 2.6, kind: 'deep' };
          } else if (roll < 0.75) {
            ai.run = { target: t.world(Math.min(off - 1, a + 8), t.lat(p.pos) * 0.35), t: 2.2, kind: 'inside' };
          } else {
            ai.run = { target: holder.pos.clone().add(t.world(HL + 7, Math.sign(t.lat(p.pos) - t.lat(holder.pos) || 1) * 6).setY(0)), t: 1.6, kind: 'short' };
          }
          if (p.slot.pos === 'DEF') ai.run = { target: t.world(Math.min(off - 1, t.along(holder.pos) + 12), Math.sign(p.slot.w) * (HW - 3)), t: 3, kind: 'overlap' };
        }
        // ball out wide in the final third: attack the box for the cross
        const bA = t.along(ball);
        const bW = t.lat(ball);
        if (!ai.run && bA > 72 && Math.abs(bW) > 14 && (p.slot.pos === 'FWD' || p.slot.role === 'CAM' || (p.slot.pos === 'MID' && Math.abs(p.slot.w) > 0.6 && Math.sign(p.slot.w) !== Math.sign(bW)))) {
          const spots = [[99, 2.5], [96, -3.5], [93, 0], [90, -7]];
          const sp = spots[p.idx % spots.length];
          ai.target.copy(t.world(Math.min(sp[0], m.offsideLineFor(t) - 0.5), -Math.sign(bW) * sp[1] * (sp[1] < 0 ? -1 : 1) * (p.idx % 2 ? 1 : -1)));
          ai.sprint = hdist(p.pos, ai.target) > 5;
          ai.speed = 1;
          ai.look = ball;
          continue;
        }
        if (ai.run) {
          ai.target.copy(ai.run.target);
          ai.sprint = ai.run.kind === 'deep' || ai.run.kind === 'overlap';
          ai.speed = 1;
          // don't drift offside before the pass unless the run is a timed dash
          if (ai.run.kind !== 'deep') {
            const off = m.offsideLineFor(t);
            if (t.along(ai.target) > off - 0.5) ai.target.copy(t.world(off - 0.8, t.lat(ai.target)));
          }
        } else {
          ai.target.copy(zone);
          ai.sprint = hdist(p.pos, zone) > 12;
        }
        ai.look = ball;
      } else {
        ai.role = 'mark';
        ai.run = null;
        let target = zone;
        if (p.slot.pos === 'DEF' || p.slot.pos === 'MID') {
          let mk: Plr | null = null;
          let md = p.slot.pos === 'DEF' ? 9 : 6;
          for (const q of o.active()) {
            if (q.isGK || marked.has(q) || q === m.owner) continue;
            const d = hdist(q.pos, zone);
            if (d < md) {
              md = d;
              mk = q;
            }
          }
          if (mk) {
            marked.add(mk);
            const own = new V(-t.dir * HL, 0, 0);
            const markPos = mk.pos.clone().addScaledVector(own.sub(mk.pos).setY(0).normalize(), 1.6);
            target = zone.clone().lerp(markPos, p.slot.pos === 'DEF' ? 0.42 : 0.3);
            // the back line holds together (offside trap) unless the ball is already behind it
            if (p.slot.pos === 'DEF') {
              const lineA = t.along(zone);
              if (t.along(target) < lineA - 1 && t.along(ball) > lineA) target.copy(t.world(lineA - 1, t.lat(target)));
            }
          }
        }
        ai.target.copy(target);
        const d = hdist(p.pos, target);
        ai.sprint = d > 8 || t.along(p.pos) > t.along(ball) + 6;
        ai.speed = d > 2 ? 0.95 : 0.6;
        ai.look = ball;
      }
    }
  }
}

// The AI ball carrier: dribble, pass, cross, shoot or clear.
export function carrierThink(m: Match, p: Plr, dt: number) {
  const ai = p.ai;
  const t = p.team;
  const tac = t.tactic;
  ai.decide -= dt;
  if (p.pending || (p.action && p.action.order)) return;
  const pos = p.pos;
  const goal = new V(t.dir * HL, 0, 0);
  const a = t.along(pos);
  const w = t.lat(pos);
  const press = m.pressureOn(p);
  if (ai.decide > 0 && press < 0.85) {
    dribbleTarget(m, p);
    return;
  }
  const diff = t.pad === null ? m.setup.difficulty : 2;
  const noise = [0.4, 0.25, 0.14, 0.07][diff] ?? 0.14;
  const options: { s: number; go: () => void; k: string }[] = [];

  const dGoal = hdist(pos, goal);

  // shoot
  if (dGoal < 34 && a > 66) {
    const ang = Math.abs(Math.atan2(pos.z, Math.abs(goal.x - pos.x)));
    const lane = m.laneOpenness(pos, goal, t);
    let s = (1 - dGoal / 40) * 2.2 * (1 - ang / 1.6) + lane * 0.5 + (p.s.shooting - 65) / 60 + (press > 0.5 && dGoal < 22 ? 0.2 : 0);
    if (dGoal < 28 && p.s.shooting > 72) s += 0.15;
    if (dGoal < 13) s += 0.45;
    if (dGoal < 8) s += 0.4;
    options.push({
      s,
      k: 'shot',
      go: () => {
        const finesse = dGoal > 14 && dGoal < 26 && p.s.shooting > 72 && Math.random() < 0.4;
        const chip = dGoal < 16 && m.opp(t).gk && t.along(m.opp(t).gk.pos) < 97 && Math.random() < 0.3;
        const far = -Math.sign(pos.z || Math.random() - 0.5);
        const z = (Math.random() < 0.7 ? far : -far) * (GOAL_HW - 0.5);
        const dir = new V(goal.x, 0, z).sub(pos).setY(0).normalize();
        const perp = new V(dir.z, 0, -dir.x);
        const toGoal = goal.clone().sub(pos).setY(0).normalize();
        const tp = new V(toGoal.z, 0, -toGoal.x);
        void perp;
        const stick = toGoal.clone().addScaledVector(tp, (z * Math.sign(tp.z || 1)) / 3.2);
        m.aiKick(p, { type: 'shot', power: clamp(0.45 + dGoal / 45 + gauss() * 0.06, 0.4, 0.86), dir: stick.normalize(), finesse, chip, t: 0.8 });
      },
    });
  }

  // passes
  const off = m.offsideLineFor(t);
  for (const q of t.players) {
    if (q === p || q.sent) continue;
    const d = hdist(pos, q.pos);
    if (d < 4 || d > 52) continue;
    const qa = t.along(q.pos);
    if (qa > off && qa > HL && !(q.ai.run?.kind === 'deep')) continue;
    const lane = m.laneOpenness(pos, q.pos, t);
    const space = clamp(m.nearestOpp(q) / 6, 0, 1);
    const prog = clamp((qa - a) / 25, -1, 1);
    const tight = m.nearestOpp(q);
    let s = 0.05 + prog * (0.6 + tac.directness * 0.6) + lane * 0.65 + space * 0.6 - (d > 35 ? 0.25 : 0) - (Math.abs(prog) < 0.15 ? 0.1 : 0) - (prog < 0 && a > 40 ? 0.15 : 0);
    if (tight < 2.2 && d > 9) s -= 0.4; // don't hit a tightly marked man from distance
    if (q.isGK) s -= press > 0.6 ? 0.2 : 0.9;
    if (prog < 0 && tac.directness > 0.6) s -= 0.15;
    if (prog < 0 && a < 30) s -= 0.3;
    s += press * 0.35;
    if (m.careerId && q.d.id === m.careerId) {
      s += 0.25;
      if (m.callForBall > m.time && lane > 0.25) s += 1.2;
    }
    const type: KickOrder['type'] = lane > 0.4 || d < 18 ? 'pass' : 'lob';
    options.push({ k: type, s: s + (type === 'lob' ? -0.3 : 0), go: () => m.aiKick(p, { type, power: clamp(d / 50, 0.1, 0.8), dir: null, target: q, t: 0.8 }) });
    if (q.ai.run?.kind === 'deep' || q.ai.run?.kind === 'overlap' || (q.slot.pos === 'FWD' && qa > a + 8 && q.vel.dot(new V(t.dir, 0, 0)) > 3)) {
      const into = q.pos.clone().add(new V(t.dir * 9, 0, 0));
      const laneInto = m.laneOpenness(pos, into, t);
      const st = 0.3 + tac.runs * 0.45 + prog * 0.45 + laneInto * 0.5 + (p.s.passing - 65) / 100;
      options.push({ k: 'through', s: st, go: () => m.aiKick(p, { type: 'through', power: clamp(0.3 + Math.random() * 0.4, 0, 1), dir: null, target: q, t: 0.8 }) });
    }
  }

  // balls over the top / in behind a high line
  const line = m.offsideLineFor(t);
  if (line - a > 10 && 105 - line > 14) {
    for (const q of t.players) {
      if (q === p || q.sent || q.slot.pos === 'GK' || q.slot.pos === 'DEF') continue;
      const qa = t.along(q.pos);
      if (qa > line || qa < a + 4) continue;
      const pt = t.world(Math.min(99, line + 8 + Math.random() * 4), clamp(t.lat(q.pos) * 0.85, -HW + 4, HW - 4));
      const reachT = hdist(q.pos, pt) / q.maxSpeed(true, false) + 0.25;
      let defT = Infinity;
      for (const o of m.opp(t).players) if (!o.sent) defT = Math.min(defT, hdist(o.pos, pt) / o.maxSpeed(true, false) + (o.isGK ? 0.3 : 0));
      if (reachT > defT + 0.4) continue;
      const dist = hdist(pos, pt);
      const ground = m.laneOpenness(pos, pt, t) > 0.6 && dist < 30;
      const st = 0.45 + tac.directness * 0.45 + clamp((defT - reachT) * 0.35, -0.2, 0.5) + (p.s.passing - 65) / 90 - press * 0.1;
      options.push({ k: 'behind', s: st, go: () => m.aiKick(p, { type: ground ? 'through' : 'lob', power: ground ? 0.6 : 0.5, dir: null, target: q, point: pt, t: 0.8 }) });
    }
  }

  // switch of play: a long diagonal to the free man on the far side
  if (Math.abs(w) > 9 && a > 30 && a < 85) {
    for (const q of t.players) {
      if (q === p || q.sent || q.isGK) continue;
      const qw = t.lat(q.pos);
      if (Math.sign(qw) === Math.sign(w) || Math.abs(qw) < 16) continue;
      const space = clamp(m.nearestOpp(q) / 7, 0, 1);
      if (space < 0.45) continue;
      const tp = q.pos.clone().add(new V(t.dir * 4, 0, 0));
      options.push({ k: 'switch', s: 0.3 + space * 0.55 + tac.width * 0.3 + (p.s.passing - 65) / 90 - press * 0.15, go: () => m.aiKick(p, { type: 'lob', power: 0.7, dir: null, target: q, point: tp, t: 0.8 }) });
    }
  }

  // cross from wide areas
  if (a > 76 && Math.abs(w) > 13) {
    const inBox = t.players.filter((q) => !q.sent && q !== p && t.along(q.pos) > 86 && Math.abs(q.pos.z) < 16);
    if (inBox.length) {
      const tgt = inBox[Math.floor(Math.random() * inBox.length)];
      options.push({ k: 'cross', s: 0.75 + inBox.length * 0.14 + (p.s.passing - 65) / 100, go: () => m.aiKick(p, { type: 'cross', power: 0.6, dir: null, point: tgt.pos.clone().add(new V(t.dir * 1.5, 0, 0)), target: tgt, t: 0.8 }) });
    }
  }

  // dribble
  const ahead = spaceAhead(m, p);
  let sd = 0.35 + clamp(ahead / 10, 0, 1) * 0.65 + (p.s.dribbling - 65) / 100 - press * 0.55 - tac.tempo * 0.1 - (1 - tac.directness) * 0.05;
  if (a < 28) sd -= 0.2;
  if (a > 55 && a < 90 && ahead > 5) sd += 0.25; // drive at the defence
  if (a > 70 && p.slot.pos !== 'DEF') sd += 0.1;
  options.push({
    k: 'dribble',
    s: sd,
    go: () => {
      ai.decide = lerp(0.8, 0.3, tac.tempo) * (0.7 + Math.random() * 0.6);
      dribbleTarget(m, p);
      if (press > 0.6 && p.s.dribbling > 74 && Math.random() < 0.18) {
        const side = new V(-Math.cos(p.facing), 0, Math.sin(p.facing)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
        m.skillMove(p, side);
      }
    },
  });

  // clearance under pressure deep in our half
  if (a < 22 && press > 0.55) {
    options.push({ k: 'clear', s: 0.85, go: () => m.aiKick(p, { type: 'clear', power: 1, dir: null, point: t.world(60 + Math.random() * 15, Math.sign(w || 1) * (20 + Math.random() * 10)), t: 0.8 }) });
  }

  let best = options[0];
  let bs = -Infinity;
  for (const o of options) {
    const s = o.s + gauss() * noise;
    if (s > bs) {
      bs = s;
      best = o;
    }
  }
  if (debugHook) debugHook(p, a, options.map((o) => o.s), options.indexOf(best), options.map((o) => o.k));
  ai.decide = Math.max(ai.decide, 0.5);
  best.go();
}

function spaceAhead(m: Match, p: Plr) {
  const f = new V(p.team.dir, 0, 0);
  let min = 20;
  for (const q of m.opp(p.team).players) {
    if (q.sent) continue;
    const v = q.pos.clone().sub(p.pos).setY(0);
    const d = v.length();
    if (d < 0.1) continue;
    if (v.normalize().dot(f) > 0.4) min = Math.min(min, d);
  }
  return min;
}

function dribbleTarget(m: Match, p: Plr) {
  const t = p.team;
  const pos = p.pos;
  const goal = new V(t.dir * HL, 0, 0);
  const a = t.along(pos);
  const wide = Math.abs(pos.z) > 18 && a < 85;
  const dir = wide ? new V(t.dir, 0, -Math.sign(pos.z) * 0.15) : goal.clone().sub(pos).setY(0).normalize().lerp(new V(t.dir, 0, 0), 0.3);
  for (const q of m.opp(t).players) {
    if (q.sent) continue;
    const v = q.pos.clone().sub(pos).setY(0);
    const d = v.length();
    if (d > 6 || d < 0.01) continue;
    v.normalize();
    if (v.dot(dir) < -0.2) continue;
    dir.addScaledVector(v, (-(6 - d) / 6) * 1.3);
  }
  if (Math.abs(pos.z) > HW - 4) dir.z -= Math.sign(pos.z) * 0.8;
  if (dir.lengthSq() < 0.01) dir.set(t.dir, 0, 0);
  dir.normalize();
  p.ai.target.copy(pos).addScaledVector(dir, 6);
  p.ai.sprint = spaceAhead(m, p) > 7 && p.stamina > 0.3;
  p.ai.speed = p.ai.sprint ? 1 : 0.8;
}

// Converts AI targets to a desired velocity.
export function aiMove(m: Match, p: Plr, out: V3): { sprint: boolean; jockey: boolean; face: V3 | null } {
  const ai = p.ai;
  if (m.phase === 'setpiece' || m.phase === 'intro' || m.phase === 'halftime' || m.phase === 'fulltime') {
    out.set(0, 0, 0);
    return { sprint: false, jockey: false, face: m.ball.pos };
  }
  const to = ai.target.clone().sub(p.pos).setY(0);
  const d = to.length();
  if (d < 0.35) {
    out.set(0, 0, 0);
    return { sprint: false, jockey: false, face: ai.look ?? (m.owner === p ? null : m.ball.pos) };
  }
  const max = p.maxSpeed(ai.sprint, m.owner === p) * (ai.sprint ? 1 : Math.min(1, ai.speed / 0.7));
  const speed = Math.min(max, d * 2.2 + 0.4);
  out.copy(to).multiplyScalar(speed / d);
  const face = ai.jockey ? ai.look : speed < 2.5 && ai.look ? ai.look : null;
  return { sprint: ai.sprint && speed > 6, jockey: ai.jockey, face };
}

// Goalkeeper positioning, shot stopping, crosses, 1v1s and distribution.
export function keeperThink(m: Match, gk: Plr, dt: number) {
  const t = gk.team;
  const ai = gk.ai;
  const b = m.ball;
  const own = new V(-t.dir * HL, 0, 0);
  ai.look = b.pos;
  ai.sprint = false;
  ai.speed = 0.8;

  const scripted = gk.gk.react === -2;
  if (gk.action?.kind === 'dive') {
    saveCheck(m, gk);
    return;
  }
  if (m.phase !== 'play') {
    if (m.phase !== 'setpiece' || m.sp?.kind !== 'penalty') gk.gk.react = scripted ? -2 : -1;
    return;
  }
  if (m.isHuman(gk)) return;
  // ball at the keeper's feet (back pass): play it like an outfield player
  if (m.owner === gk) {
    carrierThink(m, gk, dt);
    return;
  }

  // holding the ball: distribute
  if (m.held === gk) {
    gk.gk.holdT += dt;
    ai.target.copy(gk.pos);
    if (gk.gk.holdT > 1.6 && !gk.action) {
      const mates = t.players.filter((q) => !q.sent && q !== gk);
      const short = mates
        .filter((q) => hdist(q.pos, gk.pos) < 32 && m.laneOpenness(gk.pos, q.pos, t) > 0.55 && m.nearestOpp(q) > 5)
        .sort((x, y) => t.along(y.pos) - t.along(x.pos))[0];
      gk.facing = Math.atan2(t.dir, 0);
      if (short && (t.tactic.directness < 0.7 || Math.random() < 0.5)) m.aiKick(gk, { type: 'gkThrow', power: 0.4, dir: null, target: short, t: 1 });
      else {
        const fw = mates.filter((q) => q.slot.pos !== 'DEF').sort((x, y) => t.along(y.pos) - t.along(x.pos))[Math.floor(Math.random() * 3)];
        m.aiKick(gk, { type: 'gkKick', power: 0.8, dir: null, target: fw, t: 1 });
      }
    }
    return;
  }

  // shot stopping
  const towards = b.vel.x * -t.dir > 4 && b.vel.length() > 8 && !m.owner;
  if (towards || scripted) {
    if (gk.gk.react === -1) {
      // a new threat: where does it cross our line?
      const path = predictPath(b, m.env(), 1 / 60, 120, []);
      let hit: V3 | null = null;
      let k = 0;
      const planeX = Math.abs(gk.pos.x);
      for (; k < path.length; k++) {
        if (Math.abs(path[k].x) >= planeX - 0.2 && Math.sign(path[k].x) === Math.sign(own.x)) {
          hit = path[k];
          break;
        }
      }
      if (hit && Math.abs(hit.z) < GOAL_HW + 1.2 && hit.y < GOAL_H + 0.6) {
        let screens = 0;
        for (const q of m.all) {
          if (q === gk || q.sent) continue;
          const seg = distToSegment(q.pos, b.pos, gk.pos);
          if (seg < 0.8 && hdist(q.pos, gk.pos) > 2) screens++;
        }
        const diffAdj = m.lastKick && m.lastKick.p.team.pad !== null && t.pad === null ? [0.12, 0.05, 0, -0.03][m.setup.difficulty] ?? 0 : 0;
        gk.gk.react = lerp(0.36, 0.12, gk.s.gk / 100) + screens * 0.08 + diffAdj;
        gk.gk.ix = hit.x;
        gk.gk.iy = hit.y;
        gk.gk.iz = hit.z;
        gk.gk.it = k / 60;
        gk.gk.saveTried = false;
      } else gk.gk.react = -3; // not on target: just watch
    } else if (gk.gk.react > 0) {
      gk.gk.react -= dt;
      gk.gk.it -= dt;
      if (gk.gk.react <= 0) {
        gk.gk.react = -3;
        const dz = gk.gk.iz - gk.pos.z;
        const tLeft = Math.max(0.12, gk.gk.it);
        if (Math.abs(dz) < 0.75 && gk.gk.iy < 1.9) {
          ai.target.set(gk.pos.x, 0, gk.gk.iz);
          ai.sprint = true;
        } else {
          const maxV = 4.5 + (gk.s.gk / 100) * 3.5;
          const need = Math.abs(dz) - 1.1;
          const v = clamp(need / tLeft, 2.5, maxV);
          gk.gk.diveVel.set(0, 0, Math.sign(dz) * v);
          gk.action = { kind: 'dive', t: 0, dur: 1.3, contact: 1, fired: false };
          const right = new V(-Math.cos(gk.facing), 0, Math.sin(gk.facing));
          gk.pose.diveSide = right.z * Math.sign(dz) > 0 ? 1 : -1;
          gk.pose.diveHigh = clamp(gk.gk.iy / 2.4, 0, 1);
        }
      }
    }
  } else gk.gk.react = -1;

  // positioning on the angle
  const toBall = b.pos.clone().sub(own).setY(0);
  const dist = toBall.length();
  const along = t.along(b.pos);
  let d = clamp(0.8 + dist * 0.07, 0.8, 4.5);
  if (along > 60) d = clamp(dist * 0.12, 3, 16); // sweeper keeper when play is far away
  const dir = toBall.normalize();
  ai.target.copy(own).addScaledVector(dir, d);
  ai.target.z = clamp(ai.target.z, -GOAL_HW + 0.4, GOAL_HW - 0.4);
  if (t.along(ai.target) < 0.6) ai.target.copy(t.world(0.6, t.lat(ai.target)));

  // 1v1: rush out and smother
  const carrier = m.owner && m.owner.team !== t ? m.owner : null;
  if (carrier && m.inBox(t, carrier.pos)) {
    const defendersBetween = t.players.filter((q) => !q.sent && q !== gk && t.along(q.pos) < t.along(carrier.pos)).length;
    const cd = hdist(carrier.pos, own);
    if (defendersBetween === 0 || cd < 12) {
      ai.target.copy(carrier.pos).lerp(own, 0.2);
      ai.sprint = true;
      ai.speed = 1;
      gk.gk.smother -= dt;
      if (hdist(gk.pos, b.pos) < 1.3 && gk.gk.smother <= 0) {
        gk.gk.smother = 0.8;
        if (Math.random() < 0.25 + gk.s.gk / 250) {
          m.owner = null;
          m.gkCatch(gk);
          gk.team.stats.saves++;
          gk.stats.saves++;
          m.comment('saved', { player: gk.d.name });
        }
      }
    }
  }
  // loose balls and crosses into the box
  if (!m.owner && !m.held) {
    const inBox = (q: V3) => t.along(q) < BOX_D - 2 && Math.abs(q.z) < BOX_HW - 4;
    for (let k = 0; k < m.pred.length; k += 1) {
      const q = m.pred[k];
      if (!inBox(q) || q.y > 2.6) continue;
      const need = hdist(gk.pos, q) / gk.maxSpeed(true, false) + 0.2;
      if (need < k * 0.1 + 0.15) {
        // beat attackers to it?
        let rival = Infinity;
        for (const r of m.opp(t).players) if (!r.sent) rival = Math.min(rival, hdist(r.pos, q) / r.maxSpeed(true, false));
        if (rival > need - 0.2 || q.y > 1.6) {
          ai.target.copy(q).setY(0);
          ai.sprint = true;
          ai.speed = 1;
        }
        break;
      }
    }
    // claim high balls with the hands (punch if crowded)
    const bp = b.pos;
    const hd = hdist(gk.pos, bp);
    if (m.inBox(t, bp) && hd < 1.2 && bp.y > 0.9 && bp.y < 2.75 && !(m.lastKick && m.lastKick.p.team === t)) {
      let crowd = 0;
      for (const r of m.opp(t).players) if (!r.sent && hdist(r.pos, bp) < 1.4) crowd++;
      if (crowd >= 2 || b.vel.length() > 22) {
        b.vel.set(t.dir * 10, 6, Math.sign(bp.z || 1) * 5);
        m.onTouch(gk);
        gk.action = { kind: 'header', t: 0, dur: 0.5, contact: 0.5, fired: true };
      } else {
        m.gkCatch(gk);
        m.comment('catch', { player: gk.d.name });
      }
    }
  }
}

function saveCheck(m: Match, gk: Plr) {
  if (gk.gk.saveTried) return;
  const b = m.ball;
  if (m.held) return;
  const up = 0.6 + gk.pose.diveHigh * 1.5;
  const side = gk.gk.diveVel.clone().setY(0);
  if (side.lengthSq() > 0) side.normalize();
  const hand = gk.pos.clone().add(new V(0, up, 0)).addScaledVector(side, 1.0);
  const foot = gk.pos.clone().add(new V(0, 0.25, 0)).addScaledVector(side, -0.4);
  const d = distToSegment3(b.pos, foot, hand);
  if (d > 0.55) return;
  gk.gk.saveTried = true;
  const speed = b.vel.length();
  const chance = clamp(0.35 + (gk.s.gk / 100) * 0.62 - Math.max(0, speed - 20) * 0.02 + (d < 0.3 ? 0.1 : 0), 0.12, 0.96);
  if (Math.random() < chance) {
    gk.stats.saves++;
    gk.team.stats.saves++;
    if (speed < 19 && Math.random() < gk.s.gk / 140) {
      m.gkCatch(gk);
      gk.action = { kind: 'dive', t: 0.6, dur: 1.3, contact: 1, fired: false };
    } else {
      const t = gk.team;
      const nearPost = Math.abs(b.pos.z) > 2.3;
      const high = b.pos.y > 1.8;
      if ((nearPost || high) && Math.random() < 0.65) {
        // fingertips: over the bar or around the post for a corner
        b.vel.set(-t.dir * (3 + Math.random() * 2), high ? 4.5 + Math.random() * 2 : 1 + Math.random(), Math.sign(b.pos.z || 1) * (high ? 1.5 : 6 + Math.random() * 3));
        m.comment('parry', { player: gk.d.name }, true);
      } else {
        b.vel.set(t.dir * (3 + Math.random() * 4), 2 + Math.random() * 3, Math.sign(b.pos.z || side.z || 1) * (5 + Math.random() * 5));
        m.comment('saved', { player: gk.d.name }, true);
      }
      b.spin.set(0, 0, 0);
      m.onTouch(gk);
      gk.kickCD = 0.6;
      m.audio.roar(0.45);
      return;
    }
    m.comment('saved', { player: gk.d.name }, true);
    m.audio.roar(0.45);
  } else {
    // fingertips: a touch that barely changes it
    b.vel.multiplyScalar(0.92);
  }
}

function distToSegment(p: V3, a: V3, b: V3) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const l2 = abx * abx + abz * abz || 1;
  const t = clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / l2, 0, 1);
  return Math.hypot(a.x + abx * t - p.x, a.z + abz * t - p.z);
}

function distToSegment3(p: V3, a: V3, b: V3) {
  const ab = b.clone().sub(a);
  const t = clamp(p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}

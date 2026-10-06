import * as THREE from 'three';

export const FIELD = {
  L: 105,
  W: 68,
  HL: 52.5,
  HW: 34,
  GOAL_HW: 3.66,
  GOAL_H: 2.44,
  GOAL_D: 2.2,
  BOX_D: 16.5,
  BOX_HW: 20.16,
  SIX_D: 5.5,
  SIX_HW: 9.16,
  PEN_D: 11,
};
export const BALL_R = 0.11;
export const G = 9.81;
const POST_R = 0.06;

export interface PitchEnv {
  rollMu: number; // rolling resistance coefficient
  grassDrag: number; // speed-proportional loss on the ground (1/s)
  bounce: number; // vertical restitution
  bounceFriction: number; // tangential friction on bounce
  puddle(x: number, z: number): number; // extra deceleration (m/s^2) from standing water
}

export type BallEvent = { type: 'post' | 'bar' | 'net' | 'bounce' | 'splash'; speed: number; x: number; y: number; z: number };

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const segA = new THREE.Vector3();
const segB = new THREE.Vector3();

function closestOnSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
  tmp2.subVectors(b, a);
  const t = Math.max(0, Math.min(1, tmp.subVectors(p, a).dot(tmp2) / tmp2.lengthSq()));
  return out.copy(a).addScaledVector(tmp2, t);
}

export class BallBody {
  pos = new THREE.Vector3(0, BALL_R, 0);
  vel = new THREE.Vector3();
  spin = new THREE.Vector3(); // angular velocity, rad/s
  inNet = 0; // 0 none, +1 / -1 inside the goal at +x / -x
  quat = new THREE.Quaternion();

  copyFrom(o: BallBody) {
    this.pos.copy(o.pos);
    this.vel.copy(o.vel);
    this.spin.copy(o.spin);
    this.inNet = o.inNet;
  }

  get onGround() {
    return this.pos.y <= BALL_R + 0.02 && Math.abs(this.vel.y) < 0.8;
  }

  step(dt: number, env: PitchEnv, events?: BallEvent[]) {
    const speed = this.vel.length();
    const sub = speed > 22 ? 4 : speed > 10 ? 2 : 1;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) this.substep(h, env, events);
    // visual rotation
    const w = this.spin.length();
    if (w > 1e-4) {
      tmp.copy(this.spin).divideScalar(w);
      const q = new THREE.Quaternion().setFromAxisAngle(tmp, w * dt);
      this.quat.premultiply(q);
    }
  }

  private substep(h: number, env: PitchEnv, events?: BallEvent[]) {
    const v = this.vel;
    const p = this.pos;
    const airborne = p.y > BALL_R + 0.005 || v.y > 0.05;
    if (airborne) {
      const s = v.length();
      // aerodynamic drag
      v.addScaledVector(v, -0.0125 * s * h);
      // Magnus effect: spin x velocity bends the flight (curl, dip, float)
      tmp.crossVectors(this.spin, v).multiplyScalar(0.0048 * h);
      v.add(tmp);
      v.y -= G * h;
      this.spin.multiplyScalar(Math.exp(-0.25 * h));
    } else {
      // rolling on grass
      p.y = BALL_R;
      v.y = 0;
      const s = Math.hypot(v.x, v.z);
      if (s > 0) {
        const decel = env.rollMu * G + env.grassDrag * s + env.puddle(p.x, p.z);
        const ns = Math.max(0, s - decel * h);
        v.x *= ns / s;
        v.z *= ns / s;
        // side spin still curls a rolling ball a little
        tmp.set(0, this.spin.y, 0).cross(v).multiplyScalar(0.0012 * h);
        v.add(tmp);
      }
      // spin relaxes to pure rolling
      const rx = v.z / BALL_R;
      const rz = -v.x / BALL_R;
      const f = 1 - Math.exp(-10 * h);
      this.spin.x += (rx - this.spin.x) * f;
      this.spin.z += (rz - this.spin.z) * f;
      this.spin.y *= Math.exp(-2.5 * h);
    }
    p.addScaledVector(v, h);

    // ground contact
    if (p.y < BALL_R) {
      p.y = BALL_R;
      if (v.y < 0) {
        const impact = -v.y;
        if (impact > 0.7) {
          v.y = impact * env.bounce;
          // friction at the contact point exchanges linear and angular velocity (backspin bites)
          const ux = v.x + this.spin.z * BALL_R;
          const uz = v.z - this.spin.x * BALL_R;
          const mu = env.bounceFriction;
          const dx = -ux * mu;
          const dz = -uz * mu;
          v.x += dx;
          v.z += dz;
          this.spin.x += (-1.5 * dz) / BALL_R;
          this.spin.z += (1.5 * dx) / BALL_R;
          if (events && impact > 2) {
            const wet = env.puddle(p.x, p.z) > 0;
            events.push({ type: wet ? 'splash' : 'bounce', speed: impact, x: p.x, y: p.y, z: p.z });
          }
        } else v.y = 0;
      }
    }
    this.goalFrame(events);
  }

  private goalFrame(events?: BallEvent[]) {
    const p = this.pos;
    const v = this.vel;
    const { HL, GOAL_HW, GOAL_H, GOAL_D } = FIELD;
    if (Math.abs(p.x) < HL - 1.5) {
      this.inNet = 0;
      return;
    }
    const side = Math.sign(p.x) || 1;
    const lineX = side * HL;
    const postX = lineX + side * POST_R;
    // posts and crossbar
    const segs: [number, number, number, number, number, number, 'post' | 'bar'][] = [
      [postX, 0, -GOAL_HW - POST_R, postX, GOAL_H + POST_R, -GOAL_HW - POST_R, 'post'],
      [postX, 0, GOAL_HW + POST_R, postX, GOAL_H + POST_R, GOAL_HW + POST_R, 'post'],
      [postX, GOAL_H + POST_R, -GOAL_HW - POST_R, postX, GOAL_H + POST_R, GOAL_HW + POST_R, 'bar'],
    ];
    for (const s of segs) {
      segA.set(s[0], s[1], s[2]);
      segB.set(s[3], s[4], s[5]);
      const q = closestOnSegment(p, segA, segB, new THREE.Vector3());
      const d = tmp.subVectors(p, q);
      const dist = d.length();
      if (dist < BALL_R + POST_R && dist > 1e-6) {
        d.divideScalar(dist);
        p.copy(q).addScaledVector(d, BALL_R + POST_R + 1e-3);
        const vn = v.dot(d);
        if (vn < 0) {
          v.addScaledVector(d, -1.72 * vn);
          v.multiplyScalar(0.92);
          this.spin.multiplyScalar(0.5);
          events?.push({ type: s[6], speed: -vn, x: p.x, y: p.y, z: p.z });
        }
      }
    }
    // entering the goal mouth
    const beyond = (p.x - lineX) * side; // > 0 behind the goal line
    if (!this.inNet && beyond > 0 && Math.abs(p.z) < GOAL_HW && p.y < GOAL_H) this.inNet = side;
    if (this.inNet === side) {
      let hit = false;
      if (beyond > GOAL_D - BALL_R) {
        p.x = lineX + side * (GOAL_D - BALL_R);
        if (v.x * side > 0) { v.x *= -0.12; hit = true; }
      }
      if (Math.abs(p.z) > GOAL_HW - BALL_R) {
        p.z = Math.sign(p.z) * (GOAL_HW - BALL_R);
        v.z *= -0.15;
        hit = true;
      }
      // the net slopes from the crossbar down to 1.0 m at the back
      const roof = GOAL_H - (Math.max(0, beyond) / GOAL_D) * (GOAL_H - 1.0);
      if (p.y > roof - BALL_R) {
        p.y = roof - BALL_R;
        if (v.y > 0) v.y *= -0.15;
        hit = true;
      }
      if (hit) {
        v.multiplyScalar(0.55);
        this.spin.multiplyScalar(0.3);
        events?.push({ type: 'net', speed: v.length(), x: p.x, y: p.y, z: p.z });
      }
      if (beyond < -0.5) this.inNet = 0;
    } else if (beyond > 0 && beyond < GOAL_D + 0.2) {
      // outside of the side netting / roof: bounce off
      const az = Math.abs(p.z);
      if (az < GOAL_HW + BALL_R + 0.05 && az > GOAL_HW - 0.2 && p.y < GOAL_H) {
        p.z = Math.sign(p.z) * (GOAL_HW + BALL_R + 0.05);
        if (v.z * Math.sign(p.z) < 0) v.z *= -0.15;
        v.multiplyScalar(0.6);
        events?.push({ type: 'net', speed: v.length(), x: p.x, y: p.y, z: p.z });
      } else if (az < GOAL_HW && p.y < GOAL_H + BALL_R + 0.1 && p.y > GOAL_H - 0.3 && v.y < 0) {
        p.y = GOAL_H + BALL_R + 0.1;
        v.y *= -0.2;
        v.multiplyScalar(0.6);
        events?.push({ type: 'net', speed: v.length(), x: p.x, y: p.y, z: p.z });
      }
    }
  }
}

// Predicts the ball's path (without players) for AI and keepers.
export function predictPath(ball: BallBody, env: PitchEnv, dt: number, steps: number, out: THREE.Vector3[]) {
  const b = new BallBody();
  b.copyFrom(ball);
  for (let i = 0; i < steps; i++) {
    if (!out[i]) out[i] = new THREE.Vector3();
    out[i].copy(b.pos);
    b.step(dt, env);
  }
  return out;
}

// Ground pass speed needed so the ball still has `arrive` m/s after rolling `dist` metres.
export function groundSpeedFor(dist: number, arrive: number, env: PitchEnv): number {
  const c = env.rollMu * G;
  const k = env.grassDrag;
  const xOf = (v0: number, v1: number) => {
    const F = (v: number) => v / k - (c / (k * k)) * Math.log(c + k * v);
    return F(v0) - F(v1);
  };
  let lo = arrive;
  let hi = 45;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (xOf(mid, arrive) < dist) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Time for a ground pass to roll `dist` metres from speed v0 (Infinity if it stops first).
export function rollTime(dist: number, v0: number, env: PitchEnv): number {
  let x = 0;
  let v = v0;
  let t = 0;
  const h = 1 / 30;
  while (x < dist) {
    v -= (env.rollMu * G + env.grassDrag * v) * h;
    if (v <= 0) return Infinity;
    x += v * h;
    t += h;
    if (t > 8) return Infinity;
  }
  return t;
}

// Launch velocity that lands the ball at `target` after `T` seconds (drag compensated roughly).
export function lobVelocity(from: THREE.Vector3, target: THREE.Vector3, T: number, out: THREE.Vector3) {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const dy = target.y - from.y;
  const comp = 1 + 0.012 * Math.hypot(dx, dz) / T * T * 0.5;
  out.set((dx / T) * comp, dy / T + 0.5 * G * T, (dz / T) * comp);
  return out;
}

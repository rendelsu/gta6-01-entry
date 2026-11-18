// Cars: arcade physics, damage, and the traffic/police/pedestrian car roles.
// A car is a rectangle with a heading; its front is +x of its local frame.
import { clamp, lerp, angleDiff, turnToward, dist } from './utils.js';

export const CAR_TYPES = {
  sedan:   { w: 46, h: 22, accel: 340, top: 330, grip: 3.4, color: '#c8c8d0', name: 'Sedan' },
  taxi:    { w: 46, h: 22, accel: 330, top: 320, grip: 3.4, color: '#f2c230', name: 'Taxi' },
  sports:  { w: 48, h: 21, accel: 520, top: 470, grip: 4.6, color: '#d92a3a', name: 'Comet GT' },
  truck:   { w: 62, h: 26, accel: 240, top: 250, grip: 2.6, color: '#7a8a9a', name: 'Hauler' },
  van:     { w: 54, h: 24, accel: 280, top: 280, grip: 3.0, color: '#8a9a7a', name: 'Van' },
  police:  { w: 48, h: 22, accel: 460, top: 430, grip: 4.2, color: '#1a2a4a', name: 'VHPD Cruiser' },
  muscle:  { w: 50, h: 23, accel: 430, top: 400, grip: 3.8, color: '#2a6a4a', name: 'Bandit' },
  compact: { w: 40, h: 20, accel: 300, top: 300, grip: 3.6, color: '#c98ad9', name: 'City Car' },
};

let nextId = 1;

export class Car {
  constructor(type, x, y, angle, role) {
    this.id = nextId++;
    this.type = type;
    this.spec = CAR_TYPES[type] || CAR_TYPES.sedan;
    this.x = x; this.y = y;
    this.angle = angle || 0;
    this.vx = 0; this.vy = 0;
    this.speed = 0; // signed forward speed
    this.steer = 0;
    this.role = role || 'traffic'; // traffic | parked | player | police | mission
    this.health = 100;
    this.smoking = false;
    this.dead = false;
    this.color = this.spec.color;
    this.occupied = false; // a pedestrian "driver" sits inside
    this.honkCooldown = 0;
    this.crashCooldown = 0;
    this.stuckTimer = 0;
    this.targetAngle = this.angle;
    this.cruiseSpeed = 0;
    this.skid = 0;
  }
  get w() { return this.spec.w; }
  get h() { return this.spec.h; }
  forwardSpeed() { return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle); }
  // Arcade drive: throttle -1..1, steer -1..1, dt seconds.
  drive(throttle, steer, dt) {
    const fwd = this.forwardSpeed();
    const accel = throttle >= 0 ? this.spec.accel : this.spec.accel * 0.75;
    this.speed = fwd + accel * throttle * dt;
    if (throttle === 0) this.speed = lerp(this.speed, 0, 2.2 * dt);
    const maxF = this.spec.top, maxR = this.spec.top * 0.45;
    this.speed = clamp(this.speed, -maxR, maxF);
    const steerTarget = steer * clamp(Math.abs(this.speed) / 90, 0, 1) * 2.4;
    this.angle += steerTarget * dt * (this.speed >= 0 ? 1 : -1);
    // Grip: kill lateral velocity, keep forward velocity.
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const lat = -this.vx * fy + this.vy * fx;
    const keep = Math.exp(-this.spec.grip * dt);
    this.vx = fx * this.speed - fy * lat * keep;
    this.vy = fy * this.speed + fx * lat * keep;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.skid = Math.abs(lat) > 120 ? 1 : Math.max(0, this.skid - dt * 3);
  }
  damage(amount) {
    this.health -= amount;
    if (this.health <= 40) this.smoking = true;
    if (this.health <= 0) { this.dead = true; this.health = 0; }
  }
  // Simple traffic brain: follow the road graph one intersection at a time.
  trafficUpdate(dt, city, cars, playerPos) {
    if (this.role !== 'traffic') return;
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    // Pick a new heading at intersections (snap to axis).
    const nearX = Math.abs(this.x - Math.round(this.x / 320) * 320 - 160) < 9999;
    void nearX;
    // Lane keeping: steer toward the nearest road centre line.
    const rp = this.nearestLane(city);
    const target = Math.atan2(rp.y - this.y, rp.x - this.x);
    let steer = clamp(angleDiff(this.angle, target) * 1.6, -1, 1);
    // Slow down for the car ahead.
    let throttle = 0.55;
    for (const o of cars) {
      if (o === this) continue;
      const dx = o.x - this.x, dy = o.y - this.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (ahead > 0 && ahead < 70 && side < 26) { throttle = -0.4; break; }
    }
    if (playerPos) {
      const d = dist(this.x, this.y, playerPos.x, playerPos.y);
      if (d < 60) throttle = -0.5;
    }
    this.drive(throttle, steer, dt);
  }
  nearestLane(city) {
    // Find the closest road centre: project onto nearest avenue or street.
    let best = null, bd = 1e18;
    for (let i = 0; i < 12; i++) {
      const ax = 160 + i * 320;
      const d = Math.abs(this.x - ax);
      if (d < bd) { bd = d; best = { x: ax + (this.angle > -Math.PI / 2 && this.angle < Math.PI / 2 ? 18 : -18), y: this.y + 120 * Math.sin(this.angle), vertical: true }; }
    }
    for (let j = 0; j < 9; j++) {
      const sy = 160 + j * 320;
      const d = Math.abs(this.y - sy);
      if (d < bd) { bd = d; best = { x: this.x + 120 * Math.cos(this.angle), y: sy + (this.angle > 0 && this.angle < Math.PI ? 18 : -18), vertical: false }; }
    }
    return best;
  }
}

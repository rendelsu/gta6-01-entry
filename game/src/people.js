// People on foot: the player and the pedestrians who fill the sidewalks.
import { clamp, dist, angleTo, turnToward, randRange, pick } from './utils.js';

export const PED_SHIRTS = ['#e85a5a', '#5a8ae8', '#5ae88a', '#e8d45a', '#b45ae8', '#e8a05a', '#5ad9e8', '#e85aa8'];
export const PED_SKINS = ['#f0c8a0', '#c89878', '#8a5a3a', '#f0d0b0', '#a06a42'];

export class Pedestrian {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = randRange(rng, 45, 75);
    this.walkPhase = rng() * 6;
    this.shirt = pick(rng, PED_SHIRTS);
    this.skin = pick(rng, PED_SKINS);
    this.pants = pick(rng, ['#2a2a3a', '#3a3a4a', '#5a4a3a', '#1a3a2a']);
    this.dead = false;
    this.down = 0; // knocked down timer
    this.fleeing = 0;
    this.fleeX = 0; this.fleeY = 0;
    this.targetX = x; this.targetY = y;
    this.wait = 0;
    this.r = 11;
  }
  update(dt, city, danger) {
    if (this.dead) return;
    if (this.down > 0) { this.down -= dt; return; }
    this.walkPhase += dt * this.speed * 0.12;
    if (danger) {
      const d = dist(this.x, this.y, danger.x, danger.y);
      if (d < 260 && this.fleeing <= 0) {
        this.fleeing = 2.5;
        const a = angleTo(danger.x, danger.y, this.x, this.y);
        this.fleeX = this.x + Math.cos(a) * 300;
        this.fleeY = this.y + Math.sin(a) * 300;
      }
    }
    if (this.fleeing > 0) {
      this.fleeing -= dt;
      this.angle = turnToward(this.angle, angleTo(this.x, this.y, this.fleeX, this.fleeY), 6 * dt);
      this.move(dt, city, this.speed * 2.1);
      return;
    }
    if (this.wait > 0) { this.wait -= dt; return; }
    const d = dist(this.x, this.y, this.targetX, this.targetY);
    if (d < 12) {
      // pick a new sidewalk waypoint along the nearest road
      const vertical = Math.random() < 0.5;
      const lane = vertical
        ? { x: this.x + (Math.random() < 0.5 ? 46 : -46), y: this.y + (Math.random() < 0.5 ? 1 : -1) * (120 + Math.random() * 260) }
        : { x: this.x + (Math.random() < 0.5 ? 1 : -1) * (120 + Math.random() * 260), y: this.y + (Math.random() < 0.5 ? 46 : -46) };
      this.targetX = clamp(lane.x, 60, 3540);
      this.targetY = clamp(lane.y, 60, 2820);
      if (Math.random() < 0.3) this.wait = 1 + Math.random() * 3;
      return;
    }
    this.angle = turnToward(this.angle, angleTo(this.x, this.y, this.targetX, this.targetY), 5 * dt);
    this.move(dt, city, this.speed);
  }
  move(dt, city, speed) {
    const nx = this.x + Math.cos(this.angle) * speed * dt;
    const ny = this.y + Math.sin(this.angle) * speed * dt;
    if (city.insideBuilding(nx, ny)) return;
    const hit = city.collideCircle(nx, ny, this.r);
    this.x = hit.x; this.y = hit.y;
  }
  knockDown() { this.down = 2.2; this.fleeing = 0; }
}

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;
    this.r = 13;
    this.health = 100;
    this.maxHealth = 100;
    this.cash = 250;
    this.onFoot = true;
    this.car = null;
    this.walkPhase = 0;
    this.speed = 0;
    this.weapon = 'fists'; // fists | pistol
    this.ammo = 12;
    this.ammoReserve = 48;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.hurtFlash = 0;
    this.dead = false;
  }
  update(dt, input, city) {
    if (this.dead || !this.onFoot) return;
    let mx = 0, my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    const run = input.run ? 1.55 : 1;
    const len = Math.hypot(mx, my) || 1;
    const speed = 175 * run;
    this.speed = (mx || my) ? speed : 0;
    if (mx || my) {
      this.angle = Math.atan2(my / len, mx / len);
      this.walkPhase += dt * speed * 0.09;
      const nx = this.x + (mx / len) * speed * dt;
      const ny = this.y + (my / len) * speed * dt;
      const hit = city.collideCircle(nx, ny, this.r);
      this.x = clamp(hit.x, 20, 3820);
      this.y = clamp(hit.y, 20, 2860);
    }
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
  }
  hurt(amount) {
    if (this.dead) return;
    this.health -= amount;
    this.hurtFlash = 1;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }
  heal(amount) { this.health = clamp(this.health + amount, 0, this.maxHealth); }
}

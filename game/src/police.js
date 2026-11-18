// Wanted level and the Vice Harbor Police Department: cruisers that chase and
// ram, and officers on foot who try to bust the player.
import { clamp, dist, angleTo, turnToward } from './utils.js';
import { nearestRoadPoint } from './city.js';
import { Car } from './vehicles.js';

export class CopPed {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = 0;
    this.r = 12;
    this.hp = 50;
    this.dead = false;
    this.walkPhase = 0;
  }
  hurt(amount) {
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
  update(dt, player, city) {
    if (this.dead) return;
    this.walkPhase += dt * 10;
    const d = dist(this.x, this.y, player.x, player.y);
    this.angle = angleTo(this.x, this.y, player.x, player.y);
    if (d > 16) {
      const sp = 150;
      const nx = this.x + Math.cos(this.angle) * sp * dt;
      const ny = this.y + Math.sin(this.angle) * sp * dt;
      if (!city.insideBuilding(nx, ny)) { this.x = nx; this.y = ny; }
    }
  }
}

export class Police {
  constructor(game) {
    this.game = game;
    this.wanted = 0; // 0..5
    this.cars = [];
    this.cops = [];
    this.spawnTimer = 0;
    this.decayTimer = 0;
    this.bustMeter = 0;
    this.lastSeenTimer = 0;
    this.sirenPhase = 0;
  }
  addWanted(n) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, 5);
    if (this.wanted > before) {
      this.decayTimer = 0;
      this.game.particles.addText(this.game.player.x, this.game.player.y - 30, 'WANTED +' + n, '#ff5a4a');
    }
  }
  clearWanted() {
    this.wanted = 0;
    for (const c of this.cars) c.dead = true;
    this.cops = this.cops.filter((c) => !c.dead);
    this.cops = [];
    this.bustMeter = 0;
  }
  desiredUnits() {
    return [0, 1, 2, 3, 4, 6][this.wanted];
  }
  update(dt) {
    const g = this.game;
    const p = g.player;
    const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    this.sirenPhase += dt;
    g.sound.siren(this.wanted > 0 && g.state === 'playing');
    // Spawn cruisers up to the wanted level's count.
    this.spawnTimer -= dt;
    const alive = this.cars.filter((c) => !c.dead).length;
    if (this.wanted > 0 && alive < this.desiredUnits() && this.spawnTimer <= 0) {
      this.spawnTimer = 2.2;
      const a = Math.random() * Math.PI * 2;
      let sx = px + Math.cos(a) * 700;
      let sy = py + Math.sin(a) * 700;
      const rp = nearestRoadPoint(sx, sy);
      sx = rp.x; sy = rp.y;
      const car = new Car('police', clamp(sx, 80, 3760), clamp(sy, 80, 2800), angleTo(sx, sy, px, py), 'police');
      car.cruiseSpeed = 380 + this.wanted * 18;
      this.cars.push(car);
      g.cars.push(car);
    }
    // Wanted decays when no cruiser is close for a while.
    let nearest = 1e9;
    for (const c of this.cars) if (!c.dead) nearest = Math.min(nearest, dist(c.x, c.y, px, py));
    if (this.wanted > 0 && nearest > 620) {
      this.decayTimer += dt;
      if (this.decayTimer > 7) { this.decayTimer = 0; this.wanted = Math.max(0, this.wanted - 1); }
    } else {
      this.decayTimer = 0;
    }
    // Cruiser pursuit: steer at the player, ram, and push.
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = dist(c.x, c.y, px, py);
      const target = angleTo(c.x, c.y, px, py);
      c.angle = turnToward(c.angle, target, 2.6 * dt);
      let throttle = 1;
      if (d < 46) throttle = 0.55; // keep pushing into the target
      c.drive(throttle, clamp((target - c.angle) * 1.4, -1, 1), dt);
      const hit = g.city.collideCircle(c.x, c.y, 20);
      c.x = hit.x; c.y = hit.y;
      if (hit.hit) c.damage(2);
      // Ram the player's car / knock the player.
      if (p.car && !p.car.dead && d < 44) {
        p.car.damage(6 * dt * 10);
        const push = 260 * dt;
        p.car.x += Math.cos(c.angle) * push;
        p.car.y += Math.sin(c.angle) * push;
        if (Math.random() < dt * 4) { g.sound.crash(); g.particles.sparks(p.car.x, p.car.y); g.shake(5); }
      }
      if (p.onFoot && d < 26) {
        this.bustMeter += dt;
        if (this.bustMeter > 1.6) {
          g.busted();
          return;
        }
      }
      // A cruiser far away for too long gives up and despawns.
      if (d > 1500 && this.wanted === 0) c.dead = true;
    }
    if (p.onFoot) this.bustMeter = Math.max(0, this.bustMeter - dt * 0.7);
    // Officers on foot: one per cruiser once the player is on foot and wanted >= 2.
    if (this.wanted >= 2 && p.onFoot) {
      const want = Math.min(2, this.wanted - 1);
      const aliveCops = this.cops.filter((c) => !c.dead).length;
      if (aliveCops < want && Math.random() < dt * 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.cops.push(new CopPed(px + Math.cos(a) * 260, py + Math.sin(a) * 260));
      }
    }
    for (const cop of this.cops) {
      cop.update(dt, p, g.city);
      if (!cop.dead && p.onFoot && dist(cop.x, cop.y, p.x, p.y) < 24) {
        this.bustMeter += dt * 1.4;
        if (this.bustMeter > 1.6) { g.busted(); return; }
      }
    }
    this.cops = this.cops.filter((c) => !c.dead);
    this.cars = this.cars.filter((c) => !c.dead);
  }
}

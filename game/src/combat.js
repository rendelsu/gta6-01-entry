// Combat: fists, pistol, bullets, and the rival gang members who fight back.
import { clamp, dist, angleTo } from './utils.js';

export class Bullet {
  constructor(x, y, angle, fromPlayer, damage) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * 780;
    this.vy = Math.sin(angle) * 780;
    this.fromPlayer = fromPlayer;
    this.damage = damage || 34;
    this.life = 0.9;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}

export class Rival {
  constructor(x, y, hp) {
    this.x = x; this.y = y;
    this.angle = 0;
    this.hp = hp || 60;
    this.maxHp = this.hp;
    this.r = 13;
    this.dead = false;
    this.shootTimer = 0.8 + Math.random();
    this.moveTimer = 0;
    this.targetX = x; this.targetY = y;
    this.shirt = '#c22a2a';
    this.skin = '#f0c8a0';
    this.walkPhase = Math.random() * 6;
  }
  update(dt, player, city, spawnBullet) {
    if (this.dead) return;
    this.walkPhase += dt * 8;
    const d = dist(this.x, this.y, player.x, player.y);
    this.angle = angleTo(this.x, this.y, player.x, player.y);
    if (d > 260) {
      // close the distance
      const nx = this.x + Math.cos(this.angle) * 110 * dt;
      const ny = this.y + Math.sin(this.angle) * 110 * dt;
      if (!city.insideBuilding(nx, ny)) { this.x = nx; this.y = ny; }
    } else if (d < 150) {
      // back off a little
      const nx = this.x - Math.cos(this.angle) * 60 * dt;
      const ny = this.y - Math.sin(this.angle) * 60 * dt;
      if (!city.insideBuilding(nx, ny)) { this.x = nx; this.y = ny; }
    }
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && d < 420 && !player.dead) {
      this.shootTimer = 1.1 + Math.random() * 0.7;
      const spread = (Math.random() - 0.5) * 0.22;
      spawnBullet(this.x, this.y, this.angle + spread, false, 9);
    }
  }
  hurt(amount) {
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
}

export class Combat {
  constructor() {
    this.bullets = [];
    this.rivals = [];
  }
  fireBullet(x, y, angle, fromPlayer, damage) {
    this.bullets.push(new Bullet(x, y, angle, fromPlayer, damage));
  }
  spawnRivals(x, y, n, hp) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.rivals.push(new Rival(x + Math.cos(a) * 90, y + Math.sin(a) * 90, hp));
    }
  }
  clearRivals() { this.rivals = []; }
  rivalsAlive() { return this.rivals.filter((r) => !r.dead).length; }
  update(dt, game) {
    const { player, city, particles, police } = game;
    for (const r of this.rivals) {
      r.update(dt, player, city, (x, y, a, fp, dmg) => this.fireBullet(x, y, a, fp, dmg));
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);
      if (b.dead) { this.bullets.splice(i, 1); continue; }
      const wall = city.insideBuilding(b.x, b.y);
      if (wall) {
        particles.sparks(b.x, b.y);
        this.bullets.splice(i, 1);
        continue;
      }
      if (b.fromPlayer) {
        let hit = false;
        for (const r of this.rivals) {
          if (!r.dead && dist(b.x, b.y, r.x, r.y) < r.r + 4) {
            r.hurt(b.damage);
            particles.burst(b.x, b.y, 6, '#ff5a4a', 160, 0.35, 3);
            if (r.dead) {
              player.cash += 60;
              particles.addText(r.x, r.y - 20, '+$60', '#7dff8a');
              game.sound.cash();
            }
            hit = true;
            break;
          }
        }
        if (hit) { this.bullets.splice(i, 1); continue; }
        // shooting a cop ped raises wanted
        for (const cop of police.cops) {
          if (!cop.dead && dist(b.x, b.y, cop.x, cop.y) < cop.r + 4) {
            cop.hurt(40);
            police.addWanted(1);
            hit = true;
            break;
          }
        }
        if (hit) { this.bullets.splice(i, 1); continue; }
      } else {
        // enemy bullet vs player (on foot or in car)
        const px = player.onFoot ? player.x : player.car ? player.car.x : player.x;
        const py = player.onFoot ? player.y : player.car ? player.car.y : player.y;
        const pr = player.onFoot ? player.r : 20;
        if (dist(b.x, b.y, px, py) < pr + 4) {
          if (player.onFoot) player.hurt(b.damage);
          else if (player.car) { player.car.damage(b.damage * 0.4); }
          particles.burst(b.x, b.y, 5, '#ff8a4a', 140, 0.3, 3);
          this.bullets.splice(i, 1);
          continue;
        }
      }
    }
    this.rivals = this.rivals.filter((r) => !r.dead || r.hp > -999);
  }
  // Player melee: an arc in front of the player.
  punch(game) {
    const { player, particles, police } = game;
    if (player.punchCooldown > 0 || !player.onFoot) return;
    player.punchCooldown = 0.38;
    game.sound.punch();
    const reach = 34;
    const px = player.x + Math.cos(player.angle) * reach;
    const py = player.y + Math.sin(player.angle) * reach;
    particles.burst(px, py, 4, '#ffffff', 120, 0.2, 2.5);
    for (const r of this.rivals) {
      if (!r.dead && dist(px, py, r.x, r.y) < r.r + 16) {
        r.hurt(26);
        particles.addText(r.x, r.y - 18, 'WHAM', '#ffffff');
        if (r.dead) { player.cash += 60; particles.addText(r.x, r.y - 20, '+$60', '#7dff8a'); }
        return;
      }
    }
    for (const p of game.peds) {
      if (!p.dead && p.down <= 0 && dist(px, py, p.x, p.y) < p.r + 16) {
        p.knockDown();
        police.addWanted(1);
        return;
      }
    }
    for (const cop of police.cops) {
      if (!cop.dead && dist(px, py, cop.x, cop.y) < cop.r + 16) {
        cop.hurt(30);
        police.addWanted(1);
        return;
      }
    }
  }
}

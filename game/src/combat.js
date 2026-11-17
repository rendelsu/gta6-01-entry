// Combat: the player's pistol, enemy shooters, bullets and the wanted level
// that crimes feed. Shooting, stealing and running people over all raise heat;
// heat fades only when no police can see the player.
import { BULLET_SPEED, PISTOL_DAMAGE, MAX_WANTED } from './config.js';
import { dist, clamp } from './random.js';
import { buildingAt } from './city.js';
import { hurtPlayer, addWanted, spawnExplosion } from './entities.js';

export function firePistol(G) {
  const p = G.player;
  if (p.fireCooldown > 0 || G.ammo <= 0) {
    if (G.ammo <= 0 && p.fireCooldown <= 0) {
      p.fireCooldown = 0.3;
      G.audio.denied();
      G.flashMessage('NO AMMO — FIND AMMO', '#e74c3c');
    }
    return;
  }
  p.fireCooldown = 0.22;
  G.ammo -= 1;
  G.gunfireTimer = 1.2;
  const a = p.aimAngle;
  const mx = p.x + Math.cos(a) * 22;
  const my = p.y + Math.sin(a) * 22;
  G.bullets.push({ x: mx, y: my, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: 0.7, from: 'player' });
  G.audio.shot();
  G.shake = Math.min(G.shake + 0.12, 0.4);
  G.particles.push({ x: mx, y: my, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.08, maxLife: 0.08, size: 7, color: '#f9e79f', type: 'flash' });
  // Firing in public draws the law.
  if (G.wanted < 1) addWanted(G, 1);
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && buildingAt(G.city, b.x, b.y)) {
      dead = true;
      G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, maxLife: 0.2, size: 3, color: '#f1c40f', type: 'spark' });
    }
    if (!dead && b.from === 'player') {
      // Hit an enemy shooter or a gang member first.
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (dist(b.x, b.y, e.x, e.y) < 16) {
          e.hp -= PISTOL_DAMAGE;
          dead = true;
          G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, size: 5, color: '#c0392b', type: 'dust' });
          if (e.hp <= 0) {
            e.dead = true;
            G.stats.kills = (G.stats.kills || 0) + 1;
            if (G.mission) G.mission.kills = (G.mission.kills || 0) + 1;
          }
          break;
        }
      }
      // Then pedestrians (a crime) and officers (a bigger crime).
      if (!dead) {
        for (const ped of G.peds) {
          if (ped.dead) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 13) {
            ped.dead = true;
            dead = true;
            addWanted(G, 1);
            G.stats.pedsHit = (G.stats.pedsHit || 0) + 1;
            break;
          }
        }
      }
      if (!dead) {
        for (const o of G.officers) {
          if (o.dead) continue;
          if (dist(b.x, b.y, o.x, o.y) < 14) {
            o.dead = true;
            dead = true;
            addWanted(G, 2);
            G.flashMessage('COP DOWN — HEAT UP!', '#e74c3c');
            break;
          }
        }
      }
      if (!dead) {
        for (const car of G.cars) {
          if (car.dead || car.kind === 'player') continue;
          const dx = b.x - car.x, dy = b.y - car.y;
          const along = Math.abs(Math.cos(car.angle) * dx + Math.sin(car.angle) * dy);
          const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
          if (along < 28 && side < 16) {
            car.hp -= PISTOL_DAMAGE;
            dead = true;
            if (car.hp <= 0 && !car.dead) {
              car.dead = true;
              spawnExplosion(G, car.x, car.y);
              if (car.kind === 'police') { addWanted(G, 1); G.cops.splice(G.cops.indexOf(car), 1); }
              G.cars.splice(G.cars.indexOf(car), 1);
            }
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      const p = G.player;
      if (dist(b.x, b.y, p.x, p.y) < (p.inCar ? 24 : 13)) {
        dead = true;
        hurtPlayer(G, 9);
        if (p.inCar && p.car) p.car.hp -= 4;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

// Enemy shooters: rival gang members that stand their ground and fire.
export function makeEnemy(x, y, hp = 100) {
  return {
    x, y, angle: 0, speed: 0, state: 'guard', hp, dead: false,
    shirt: '#8e44ad', name: 'Rival', tx: x, ty: y, wait: 0,
    fireTimer: 1.2, isCop: false, fleeTimer: 0,
  };
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    const target = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = target;
    if (d < 420 && d > 60) {
      // Strafe into range, then hold and shoot.
      e.x += Math.cos(target) * 55 * dt;
      e.y += Math.sin(target) * 55 * dt;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && !buildingAt(G.city, (e.x + p.x) / 2, (e.y + p.y) / 2)) {
        e.fireTimer = 0.9 + G.rng() * 0.6;
        G.bullets.push({
          x: e.x + Math.cos(target) * 18, y: e.y + Math.sin(target) * 18,
          vx: Math.cos(target) * BULLET_SPEED * 0.8, vy: Math.sin(target) * BULLET_SPEED * 0.8,
          life: 0.8, from: 'enemy',
        });
        G.audio.enemyShot();
        G.particles.push({ x: e.x + Math.cos(target) * 18, y: e.y + Math.sin(target) * 18, vx: 0, vy: 0, life: 0.08, maxLife: 0.08, size: 6, color: '#f9e79f', type: 'flash' });
      }
    }
  }
  G.enemies = G.enemies.filter((e) => !e.dead);
}

// Wanted decay: when no cop is near and the player is out of sight, heat fades.
export function updateWanted(G, dt) {
  if (G.wanted <= 0) return;
  let seen = false;
  const p = G.player;
  for (const cop of G.cops) if (dist(cop.x, cop.y, p.x, p.y) < 560) { seen = true; break; }
  if (!seen) for (const o of G.officers) if (dist(o.x, o.y, p.x, p.y) < 420) { seen = true; break; }
  if (seen) {
    G.wantedTimer = 0;
  } else {
    G.wantedTimer += dt;
    if (G.wantedTimer > 18) {
      G.wanted -= 1;
      G.wantedTimer = 0;
      G.flashMessage('HEAT DYING DOWN…', '#2ecc71');
    }
  }
  G.wanted = clamp(G.wanted, 0, MAX_WANTED);
}

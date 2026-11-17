// The player, on foot and behind the wheel. Driving is arcade physics:
// throttle, steering that scales with speed, a handbrake for slides, and
// collisions that cost the car health and throw sparks.
import {
  PLAYER_WALK, PLAYER_RUN, PLAYER_RADIUS, CAR_LENGTH, CAR_WIDTH,
  CAR_MAX_SPEED, CAR_ACCEL, CAR_BRAKE, CAR_DRAG, CAR_STEER, WORLD_W, WORLD_H,
} from './config.js';
import { clamp, dist, angleDiff, turnToward } from './random.js';
import { collideBuildings, isWater, buildingAt } from './city.js';
import { makeCar, addWanted, spawnExplosion } from './entities.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    inCar: false, car: null,
    invuln: 0,
    running: false,
    aimAngle: -Math.PI / 2,
    fireCooldown: 0,
    enterCooldown: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.enterCooldown > 0) p.enterCooldown -= dt;

  if (p.inCar && p.car) updateDriving(G, dt);
  else updateOnFoot(G, dt);

  // Entering / leaving a car.
  if (input.pressed('KeyE') && p.enterCooldown <= 0) {
    if (p.inCar) exitCar(G);
    else tryEnterCar(G);
  }

  p.x = clamp(p.x, 20, WORLD_W - 20);
  p.y = clamp(p.y, 20, WORLD_H - 70); // the water at the south edge is not walkable
  if (isWater(p.x, p.y)) p.y = WORLD_H - 72;
}

function updateOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const mv = input.moveVector();
  const run = input.down('ShiftLeft', 'ShiftRight');
  p.running = run && (mv.x !== 0 || mv.y !== 0);
  const speed = run ? PLAYER_RUN : PLAYER_WALK;
  const vx = mv.x * speed;
  const vy = mv.y * speed;
  p.x += vx * dt;
  p.y += vy * dt;
  collideBuildings(G.city, p, PLAYER_RADIUS);
  if (mv.x !== 0 || mv.y !== 0) {
    p.angle = Math.atan2(vy, vx);
  }
  // Aim follows the mouse when the pistol is out.
  if (G.weapon === 'pistol') {
    const wx = G.camera.x + input.mouseX / G.camera.zoom;
    const wy = G.camera.y + input.mouseY / G.camera.zoom;
    p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  } else {
    p.aimAngle = p.angle;
  }
  // Footstep dust when running.
  if (p.running && G.rng() < 0.25) {
    G.particles.push({
      x: p.x, y: p.y + 8, vx: -vx * 0.08, vy: -vy * 0.08,
      life: 0.4, maxLife: 0.4, size: 3, color: '#d8cbb0', type: 'dust',
    });
  }
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = G.input;
  let throttle = input.down('KeyW', 'ArrowUp') ? 1 : input.down('KeyS', 'ArrowDown') ? -1 : 0;
  let steer = (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0);
  const handbrake = input.down('Space');
  if (G.shotMode === 1) {
    // Cover-shot autopilot: throttle down, steer back onto the road line,
    // and cap speed so the pursuing police stay in frame.
    throttle = 1;
    const desired = Math.atan2(1120 - car.y, 300);
    steer = clamp(angleDiff(car.angle, desired) * 2.5, -1, 1);
    if (car.speed > 300) car.speed = 300;
  }

  const top = car.model.top * (car.hp < 30 ? 0.55 : 1);
  if (throttle > 0) car.speed += CAR_ACCEL * (car.model.accel / 400) * dt;
  else if (throttle < 0) {
    if (car.speed > 20) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.5 * dt; // reverse
  } else {
    car.speed -= car.speed * CAR_DRAG * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (car.speed > top) car.speed = top;
  if (car.speed < -140) car.speed = -140;

  const steerAuthority = clamp(Math.abs(car.speed) / 160, 0, 1) * CAR_STEER * (car.model.grip / 2.6);
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.angle += steer * steerAuthority * dirSign * dt * (handbrake ? 1.7 : 1);
  if (handbrake) car.speed *= (1 - 1.8 * dt);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const beforeX = car.x, beforeY = car.y;
  car.x = nx; car.y = ny;
  p.x = car.x; p.y = car.y; p.angle = car.angle;

  // Building collision: slide along the wall, lose speed, throw sparks.
  // Damage is rate-limited so grinding along a wall cannot insta-wreck a car.
  const hit = collideBuildings(G.city, car, CAR_LENGTH * 0.55);
  if (hit) {
    const impact = Math.abs(car.speed);
    if (impact > 140 && (!car.crashCd || car.crashCd <= 0)) {
      car.hp -= impact * 0.04;
      car.crashCd = 0.6;
      G.audio.crash();
      G.shake = Math.min(G.shake + impact / 500, 1);
      for (let i = 0; i < 8; i++) {
        G.particles.push({
          x: car.x, y: car.y, vx: (G.rng() - 0.5) * 200, vy: (G.rng() - 0.5) * 200,
          life: 0.3, maxLife: 0.3, size: 2, color: '#f1c40f', type: 'spark',
        });
      }
    }
    car.speed *= 0.45;
    car.x = beforeX + (car.x - beforeX) * 0.3;
    car.y = beforeY + (car.y - beforeY) * 0.3;
  }
  if (car.crashCd) car.crashCd -= dt;
  // Bumping other cars.
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 46 && d > 0.01) {
      const push = (46 - d) / 2;
      const ux = (car.x - other.x) / d, uy = (car.y - other.y) / d;
      car.x += ux * push; car.y += uy * push;
      if (other.kind !== 'parked') { other.x -= ux * push; other.y -= uy * push; }
      // Impact damage and the speed cut happen once per impact, not once
      // per frame while the cars stay overlapped (that would pin the car).
      if (Math.abs(car.speed) > 200 && (!car.bumpCd || car.bumpCd <= 0)) {
        other.hp -= 12;
        car.hp -= 6;
        car.bumpCd = 0.6;
        car.speed *= 0.7;
        G.audio.crash();
        if (other.kind === 'police') addWanted(G, 0);
      }
    }
  }
  if (car.bumpCd) car.bumpCd -= dt;
  // Hitting a pedestrian while driving is a crime.
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const d = dist(car.x, car.y, ped.x, ped.y);
    if (d < 30 && Math.abs(car.speed) > 60) {
      ped.dead = true;
      G.stats.pedsHit = (G.stats.pedsHit || 0) + 1;
      addWanted(G, 1);
      G.audio.crash();
      G.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 8, color: '#c0392b', type: 'dust' });
      car.speed *= 0.85;
    }
  }
  // Smoke when the car is wrecked, explosion at zero health.
  if (car.hp < 35 && G.rng() < 0.3) {
    G.particles.push({
      x: car.x + (G.rng() - 0.5) * 20, y: car.y - 8,
      vx: 0, vy: -40, life: 0.9, maxLife: 0.9, size: 7, color: '#5d6d7e', type: 'smoke',
    });
  }
  if (car.hp <= 0) {
    spawnExplosion(G, car.x, car.y);
    G.cars.splice(G.cars.indexOf(car), 1);
    p.inCar = false;
    p.car = null;
    p.x = car.x + 40; p.y = car.y + 40;
    G.stats.carsWrecked = (G.stats.carsWrecked || 0) + 1;
  }
  // Engine sound follows speed.
  G.audio.setEngine(Math.abs(car.speed) / CAR_MAX_SPEED, true);
  // Skid marks on hard turns.
  if (handbrake && Math.abs(car.speed) > 120 && G.rng() < 0.6) {
    G.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 3 });
    if (G.skids.length > 220) G.skids.shift();
  }
}

function tryEnterCar(G) {
  const p = G.player;
  let best = null;
  let bestD = 70;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  // Stealing a car with a driver (or a police car) raises the wanted level.
  if (best.kind === 'police') {
    addWanted(G, 2);
    G.flashMessage('STOLE A POLICE CRUISER!', '#e74c3c');
  } else if (best.driver) {
    addWanted(G, 1);
    G.flashMessage('CAR JACKED!', '#f1c40f');
    // The driver bails out and runs.
    const driver = {
      x: best.x + 34, y: best.y + 10, angle: 0, speed: 90, state: 'flee',
      name: 'Driver', shirt: '#e67e22', tx: 0, ty: 0, wait: 0, dead: false, fleeTimer: 3,
    };
    G.peds.push(driver);
    G.stats.carsStolen = (G.stats.carsStolen || 0) + 1;
  }
  best.kind = 'player';
  best.driver = true;
  p.inCar = true;
  p.car = best;
  p.x = best.x; p.y = best.y;
  p.enterCooldown = 0.5;
  G.audio.setEngine(0, true);
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  car.kind = 'parked';
  car.speed = 0;
  p.inCar = false;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.enterCooldown = 0.5;
  G.audio.setEngine(0, false);
}

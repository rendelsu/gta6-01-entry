// Vehicles, pedestrians and police: what moves through Vice Harbor.
import { makeRng, pick, clamp, angleDiff, turnToward, dist } from './util.js';
import { WORLD_W, WORLD_H, avenueX, streetY, randomRoadPoint } from './city.js';

export const VEHICLE_TYPES = [
  { id: 'sedan', name: 'Marlow Sedan', top: 240, accel: 170, turn: 2.6, color: '#7a8ba0', w: 44, h: 20 },
  { id: 'taxi', name: 'Harbor Taxi', top: 250, accel: 180, turn: 2.7, color: '#e8b800', w: 44, h: 20 },
  { id: 'coupe', name: 'Veloce Coupe', top: 330, accel: 240, turn: 3.1, color: '#c03030', w: 46, h: 19 },
  { id: 'pickup', name: 'Bison Pickup', top: 220, accel: 160, turn: 2.4, color: '#4a6a8a', w: 48, h: 22 },
  { id: 'van', name: 'Courier Van', top: 200, accel: 140, turn: 2.2, color: '#d8d8d0', w: 50, h: 23 },
  { id: 'bus', name: 'City Bus', top: 170, accel: 110, turn: 1.9, color: '#2a7a5a', w: 62, h: 24 },
  { id: 'bike', name: 'Street Bike', top: 310, accel: 280, turn: 3.6, color: '#222226', w: 34, h: 12 },
  { id: 'cruiser', name: 'VHPD Cruiser', top: 300, accel: 230, turn: 3.0, color: '#1a2a4a', w: 46, h: 20 },
];

const PED_COLORS = ['#d86a5a', '#5a8ad8', '#6ad86a', '#d8b85a', '#b85ad8', '#5ad8c8', '#e8e8e8', '#8a5a3a'];
const PED_NAMES = ['Rosa', 'Ken', 'Priya', 'Marco', 'Ana', 'Tom', 'Lena', 'Omar', 'Ivy', 'Sam'];

export function makeVehicle(typeId, x, y, angle, rng) {
  const t = VEHICLE_TYPES.find((v) => v.id === typeId) || VEHICLE_TYPES[0];
  return {
    kind: 'car', type: t.id, name: t.name, top: t.top, accel: t.accel, turn: t.turn,
    color: t.color, w: t.w, h: t.h, x, y, angle, speed: 0,
    driver: rng ? rng() < 0.75 : true, taxi: t.id === 'taxi', police: t.id === 'cruiser',
    siren: 0, targetSpeed: 0, wander: rng ? rng() * Math.PI * 2 : 0,
  };
}

export function spawnTraffic(n, rng, avoidX, avoidY) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng);
    if (avoidX !== undefined && dist(p.x, p.y, avoidX, avoidY) < 500) continue;
    const type = pick(rng, VEHICLE_TYPES.filter((v) => v.id !== 'cruiser'));
    const angle = p.vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const c = makeVehicle(type.id, p.x, p.y, angle, rng);
    c.speed = 60 + rng() * 80;
    c.targetSpeed = c.speed;
    cars.push(c);
  }
  return cars;
}

export function spawnPedestrians(n, rng, avoidX, avoidY) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const x = 80 + rng() * (WORLD_W - 160);
    const y = 80 + rng() * (WORLD_H - 160);
    if (avoidX !== undefined && dist(x, y, avoidX, avoidY) < 400) continue;
    peds.push({
      kind: 'ped', name: pick(rng, PED_NAMES), color: pick(rng, PED_COLORS),
      x, y, angle: rng() * Math.PI * 2, speed: 22 + rng() * 26,
      walkPhase: rng() * Math.PI * 2, panic: 0, state: 'walk',
      destX: x, destY: y,
    });
  }
  return peds;
}

// Traffic cars follow the road grid: drive along their axis, turn at
// intersections at random, keep a gap from the car ahead.
export function updateTraffic(cars, dt, rng, player) {
  for (const c of cars) {
    if (c.policeChase) continue;
    const onAvenue = Math.abs(Math.sin(c.angle)) > 0.7;
    const nearX = Math.abs(c.x - avenueX(Math.round(c.x / 320 - 0.5))) < 30;
    const nearY = Math.abs(c.y - streetY(Math.round(c.y / 320 - 0.5))) < 30;
    if ((onAvenue && nearY) || (!onAvenue && nearX)) {
      if (rng() < dt * 0.35) {
        c.angle = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
    }
    let blocked = false;
    for (const o of cars) {
      if (o === c) continue;
      const d = dist(c.x, c.y, o.x, o.y);
      if (d < 70 && Math.abs(angleDiff(c.angle, Math.atan2(o.y - c.y, o.x - c.x))) < 0.6) {
        blocked = true;
        break;
      }
    }
    if (player && player.inCar === c) blocked = false;
    const want = blocked ? 0 : c.targetSpeed;
    c.speed += clamp(want - c.speed, -260 * dt, 150 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < 30) { c.x = 30; c.angle = 0; }
    if (c.x > WORLD_W - 30) { c.x = WORLD_W - 30; c.angle = Math.PI; }
    if (c.y < 30) { c.y = 30; c.angle = Math.PI / 2; }
    if (c.y > WORLD_H - 30) { c.y = WORLD_H - 30; c.angle = -Math.PI / 2; }
  }
}

export function updatePedestrians(peds, dt, rng, danger) {
  for (const p of peds) {
    p.walkPhase += dt * 8;
    if (danger && dist(p.x, p.y, danger.x, danger.y) < 260) p.panic = 2.5;
    if (p.panic > 0) {
      p.panic -= dt;
      const away = Math.atan2(p.y - danger.y, p.x - danger.x);
      p.angle = turnToward(p.angle, away, 6 * dt);
      const sp = 130;
      p.x = clamp(p.x + Math.cos(p.angle) * sp * dt, 30, WORLD_W - 30);
      p.y = clamp(p.y + Math.sin(p.angle) * sp * dt, 30, WORLD_H - 30);
      continue;
    }
    if (dist(p.x, p.y, p.destX, p.destY) < 12 || rng() < dt * 0.02) {
      p.destX = clamp(p.x + (rng() - 0.5) * 700, 40, WORLD_W - 40);
      p.destY = clamp(p.y + (rng() - 0.5) * 700, 40, WORLD_H - 40);
    }
    const target = Math.atan2(p.destY - p.y, p.destX - p.x);
    p.angle = turnToward(p.angle, target, 4 * dt);
    p.x = clamp(p.x + Math.cos(p.angle) * p.speed * dt, 30, WORLD_W - 30);
    p.y = clamp(p.y + Math.sin(p.angle) * p.speed * dt, 30, WORLD_H - 30);
  }
}

// Police cruisers chase the player, ram, and give up slowly when the
// player breaks line of sight for a while.
export function updatePolice(police, dt, player, rng) {
  for (const c of police) {
    c.siren += dt;
    const target = Math.atan2(player.y - c.y, player.x - c.x);
    c.angle = turnToward(c.angle, target, c.turn * 0.9 * dt);
    const d = dist(c.x, c.y, player.x, player.y);
    const want = d > 90 ? c.top : c.top * 0.45;
    c.speed += clamp(want - c.speed, -320 * dt, 260 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.x = clamp(c.x, 30, WORLD_W - 30);
    c.y = clamp(c.y, 30, WORLD_H - 30);
    if (d < 60 && player.inCar) {
      player.ramCooldown = 0.4;
    }
  }
}

export function spawnPolice(n, x, y, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const px = clamp(x + Math.cos(a) * (500 + rng() * 300), 40, WORLD_W - 40);
    const py = clamp(y + Math.sin(a) * (500 + rng() * 300), 40, WORLD_H - 40);
    const c = makeVehicle('cruiser', px, py, Math.atan2(y - py, x - px), rng);
    c.policeChase = true;
    c.speed = 180;
    out.push(c);
  }
  return out;
}

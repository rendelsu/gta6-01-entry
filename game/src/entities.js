// SOLMAR — Vice Harbor (r6): vehicles, pedestrians, police and the helicopter.
// Everything here is a plain data object plus small factory/update helpers;
// the Game owns the lists and the rules that move them.
import { clamp, dist, angleDiff, pick, randRange } from './util.js';
import { avenueX, streetY, randomRoadPoint, WORLD_W, WORLD_H } from './city.js';

export const VEHICLE_TYPES = [
  { id: 'sedan', name: 'Solmar Sedan', top: 150, accel: 90, grip: 2.6, colors: ['#c0392b', '#2e6fb0', '#e0e0e0', '#3a3a3a'] },
  { id: 'taxi', name: 'Vice Taxi', top: 145, accel: 88, grip: 2.6, colors: ['#f5c518'] },
  { id: 'coupe', name: 'Palma Coupe', top: 175, accel: 110, grip: 3.0, colors: ['#8e44ad', '#16a085', '#d35400'] },
  { id: 'pickup', name: 'Bay Pickup', top: 140, accel: 80, grip: 2.4, colors: ['#7f8c8d', '#5d6d7e', '#935116'] },
  { id: 'van', name: 'Dock Van', top: 120, accel: 62, grip: 2.2, colors: ['#aeb6bf', '#f0f0f0', '#2c3e50'] },
  { id: 'sports', name: 'Comet GT', top: 205, accel: 140, grip: 3.4, colors: ['#e74c3c', '#f39c12', '#1abc9c'] },
  { id: 'muscle', name: 'V8 Bruto', top: 185, accel: 125, grip: 2.8, colors: ['#922b21', '#1a5276', '#7d6608'] },
  { id: 'truck', name: 'Hauler 18', top: 105, accel: 55, grip: 2.0, colors: ['#5b2c6f', '#6e2c00', '#145a32'] },
];

export function makeCar(rng, typeId, x, y, angle) {
  const t = VEHICLE_TYPES.find(v => v.id === typeId) || VEHICLE_TYPES[0];
  return {
    kind: 'car', type: t, x, y, angle: angle ?? 0,
    speed: 0, color: pick(rng, t.colors),
    hp: 100, burning: false, driver: null, // 'traffic' | 'player' | 'police' | null (parked)
    targetSpeed: 0, honk: 0, id: Math.floor(rng() * 1e9),
  };
}

export function spawnTraffic(rng, n) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng);
    const typeId = pick(rng, VEHICLE_TYPES).id;
    const c = makeCar(rng, typeId, p.x, p.y, rng() < 0.5 ? 0 : Math.PI / 2);
    c.driver = 'traffic';
    c.targetSpeed = randRange(rng, 35, 70);
    cars.push(c);
  }
  return cars;
}

export function spawnPoliceCar(rng, x, y) {
  const c = makeCar(rng, 'sedan', x, y, 0);
  c.color = '#1a1a2e';
  c.driver = 'police';
  c.type = { ...c.type, top: 190, accel: 130, grip: 3.2 };
  c.siren = true;
  return c;
}

export function makePed(rng, x, y) {
  return {
    kind: 'ped', x, y,
    angle: rng() * Math.PI * 2,
    speed: randRange(rng, 18, 42),
    color: pick(rng, ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50']),
    skin: pick(rng, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
    panic: 0, walkPhase: rng() * 6.28, dest: null,
    id: Math.floor(rng() * 1e9),
  };
}

export function spawnPeds(rng, n) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng);
    peds.push(makePed(rng, p.x + randRange(rng, -50, 50), p.y + randRange(rng, -50, 50)));
  }
  return peds;
}

export function makeHeli(x, y) {
  return { kind: 'heli', x, y, z: 260, angle: 0, speed: 0, search: 0 };
}

// --- movement helpers used by game.js ---------------------------------------
export function driveCar(c, dt, steer, throttle) {
  const t = c.type;
  c.angle += steer * t.grip * dt * clamp(Math.abs(c.speed) / 40, 0.25, 1) * (c.speed >= 0 ? 1 : -1);
  c.speed += throttle * t.accel * dt;
  if (throttle === 0) c.speed *= Math.pow(0.4, dt); // coast
  c.speed = clamp(c.speed, -t.top * 0.45, t.top);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  c.x = clamp(c.x, 40, WORLD_W - 40);
  c.y = clamp(c.y, 40, WORLD_H - 40);
}

export function trafficThink(c, dt, rng, game) {
  // Traffic follows the grid: pick the nearest road axis and cruise on it.
  const nearAve = Math.abs(c.x - avenueX(Math.round((c.x - 160) / 320))) < 46;
  const nearSt = Math.abs(c.y - streetY(Math.round((c.y - 160) / 320))) < 46;
  let want = c.angle;
  if (nearAve && Math.abs(Math.sin(c.angle)) > 0.7) want = Math.sin(c.angle) > 0 ? Math.PI / 2 : -Math.PI / 2;
  else if (nearSt && Math.abs(Math.cos(c.angle)) > 0.7) want = Math.cos(c.angle) > 0 ? 0 : Math.PI;
  else if (nearAve) want = Math.abs(c.angle) < Math.PI / 2 ? 0 : Math.PI;
  else if (nearSt) want = Math.abs(c.angle - Math.PI / 2) < Math.PI / 2 ? Math.PI / 2 : -Math.PI / 2;
  // Slow down for the car ahead.
  let slow = false;
  for (const o of game.cars) {
    if (o === c || o.driver !== 'traffic') continue;
    const d = dist(c.x, c.y, o.x, o.y);
    if (d < 70 && Math.abs(angleDiff(c.angle, Math.atan2(o.y - c.y, o.x - c.x))) < 0.6) { slow = true; break; }
  }
  const target = slow ? 0 : c.targetSpeed;
  c.speed += clamp(target - c.speed, -90 * dt, 60 * dt);
  c.angle += clamp(angleDiff(c.angle, want), -1.6 * dt, 1.6 * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  c.x = clamp(c.x, 40, WORLD_W - 40);
  c.y = clamp(c.y, 40, WORLD_H - 40);
  if (rng() < 0.002) c.targetSpeed = randRange(rng, 35, 70);
}

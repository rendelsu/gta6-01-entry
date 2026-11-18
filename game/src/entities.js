// Vehicles, traffic, pedestrians and police for SOLMAR — Vice Harbor.
import { clamp, dist, rand, randInt, pick, angleDiff, hash2 } from './util.js';
import { avenueX, streetY, AVENUES, STREETS, WORLD_W, WORLD_H, onRoad, nearestAvenue, nearestStreet } from './city.js';

export const VEHICLE_TYPES = {
  sedan:  { name: 'Sedan',    len: 52, wid: 26, top: 330, accel: 420, max: 330, turn: 2.6, colors: ['#c0392b', '#2c3e50', '#7f8c8d', '#16a085'] },
  taxi:   { name: 'Taxi',     len: 52, wid: 26, top: 300, accel: 400, max: 300, turn: 2.6, colors: ['#f1c40f'] },
  coupe:  { name: 'Coupe',    len: 50, wid: 25, top: 380, accel: 480, max: 380, turn: 2.9, colors: ['#8e44ad', '#e74c3c', '#ecf0f1'] },
  sports: { name: 'Sports',   len: 54, wid: 26, top: 460, accel: 560, max: 460, turn: 3.2, colors: ['#e67e22', '#c0392b', '#f39c12'] },
  muscle: { name: 'Muscle',   len: 56, wid: 28, top: 400, accel: 500, max: 400, turn: 2.4, colors: ['#2c3e50', '#7b241c', '#1a5276'] },
  truck:  { name: 'Truck',    len: 72, wid: 30, top: 260, accel: 300, max: 260, turn: 1.9, colors: ['#5d6d7e', '#935116', '#7d6608'] },
  van:    { name: 'Van',      len: 60, wid: 28, top: 280, accel: 340, max: 280, turn: 2.1, colors: ['#aab7b8', '#5d6d7e', '#2e86c1'] },
  police: { name: 'VHPD Cruiser', len: 54, wid: 27, top: 420, accel: 540, max: 420, turn: 3.0, colors: ['#1a1a2e'] },
};

let nextId = 1;

export function makeVehicle(type, x, y, angle, opts = {}) {
  const t = VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
  return {
    id: nextId++, type, name: t.name, len: t.len, wid: t.wid,
    top: t.top, accel: t.accel, max: t.max, turn: t.turn,
    color: opts.color || pick(t.colors),
    x, y, angle, speed: 0,
    parked: !!opts.parked, traffic: !!opts.traffic, police: type === 'police',
    // traffic AI
    lane: opts.lane || 0, vertical: !!opts.vertical, dir: opts.dir || 1,
    targetSpeed: opts.targetSpeed || rand(120, 200),
    stuck: 0, siren: false, target: opts.target || null,
    damage: 0, brakeLight: false, blinker: 0,
  };
}

export function spawnTrafficCar(state) {
  const vertical = Math.random() < 0.5;
  const type = pick(['sedan', 'sedan', 'taxi', 'coupe', 'van', 'truck', 'muscle']);
  let x, y, angle, dir;
  if (vertical) {
    const av = avenueX(randInt(0, AVENUES - 1));
    dir = Math.random() < 0.5 ? 1 : -1;
    x = av + (dir > 0 ? 16 : -16);
    y = rand(100, WORLD_H - 100);
    angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const st = streetY(randInt(0, STREETS - 1));
    dir = Math.random() < 0.5 ? 1 : -1;
    y = st + (dir > 0 ? 16 : -16);
    x = rand(100, WORLD_W - 100);
    angle = dir > 0 ? 0 : Math.PI;
  }
  return makeVehicle(type, x, y, angle, { traffic: true, vertical, dir });
}

export function updateTraffic(state, dt) {
  const p = state.player;
  for (const v of state.traffic) {
    if (v.parked) continue;
    // Slow down if a car is ahead or the player blocks the lane.
    let ahead = false;
    const look = 70;
    const fx = v.x + Math.cos(v.angle) * look, fy = v.y + Math.sin(v.angle) * look;
    for (const o of state.traffic) {
      if (o === v || o.parked) continue;
      if (dist(fx, fy, o.x, o.y) < 40) { ahead = true; break; }
    }
    if (!ahead && state.playerCar === v) ahead = false;
    if (!ahead && p.inCar === false && dist(fx, fy, p.x, p.y) < 34) ahead = true;
    if (!ahead && state.playerCar && state.playerCar !== v && dist(fx, fy, state.playerCar.x, state.playerCar.y) < 42) ahead = true;
    const want = ahead ? 0 : v.targetSpeed;
    v.speed += clamp(want - v.speed, -500 * dt, 260 * dt);
    v.x += Math.cos(v.angle) * v.speed * dt;
    v.y += Math.sin(v.angle) * v.speed * dt;
    // Wrap around the world edges so traffic never runs out.
    if (v.x < 40) { v.x = WORLD_W - 60; }
    if (v.x > WORLD_W - 40) { v.x = 60; }
    if (v.y < 40) { v.y = WORLD_H - 60; }
    if (v.y > WORLD_H - 40) { v.y = 60; }
    // Gentle lane keeping: drift back to the road centre line.
    if (v.vertical) {
      const laneX = nearestAvenue(v.x) + (v.dir > 0 ? 16 : -16);
      v.x += clamp(laneX - v.x, -30 * dt, 30 * dt);
    } else {
      const laneY = nearestStreet(v.y) + (v.dir > 0 ? 16 : -16);
      v.y += clamp(laneY - v.y, -30 * dt, 30 * dt);
    }
  }
}

// --- Pedestrians -----------------------------------------------------------
const PED_SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c'];
const PED_SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function makePed(x, y) {
  return {
    id: nextId++, x, y, angle: rand(0, Math.PI * 2), speed: rand(28, 55),
    shirt: pick(PED_SHIRTS), skin: pick(PED_SKINS),
    walkPhase: rand(0, 6), panic: 0, onSidewalk: true,
    target: null, dead: false, down: 0,
  };
}

export function spawnPed(state) {
  // Spawn on a sidewalk near the camera, on a road edge.
  const cam = state.camera;
  const vertical = Math.random() < 0.5;
  let x, y;
  if (vertical) {
    x = avenueX(randInt(0, AVENUES - 1)) + pick([-44, 44]);
    y = clamp(cam.y + rand(-300, 300), 80, WORLD_H - 80);
  } else {
    y = streetY(randInt(0, STREETS - 1)) + pick([-44, 44]);
    x = clamp(cam.x + rand(-400, 400), 80, WORLD_W - 80);
  }
  return makePed(x, y);
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.dead) { ped.down += dt; continue; }
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += Math.cos(ped.angle) * 150 * dt;
      ped.y += Math.sin(ped.angle) * 150 * dt;
    } else {
      // Stroll along the sidewalk; pick a new heading at intersections.
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 12) {
        const vertical = Math.random() < 0.5;
        if (vertical) ped.target = { x: nearestAvenue(ped.x) + pick([-44, 44]), y: clamp(ped.y + rand(-500, 500), 60, WORLD_H - 60) };
        else ped.target = { x: clamp(ped.x + rand(-500, 500), 60, WORLD_W - 60), y: nearestStreet(ped.y) + pick([-44, 44]) };
      }
      const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.y += Math.sin(a) * ped.speed * dt;
    }
    ped.walkPhase += dt * 8;
    ped.x = clamp(ped.x, 30, WORLD_W - 30);
    ped.y = clamp(ped.y, 30, WORLD_H - 30);
  }
  // Cull the dead-and-gone and the far away; keep the crowd near the player.
  state.peds = state.peds.filter((ped) => !(ped.dead && ped.down > 6) && dist(ped.x, ped.y, state.player.x, state.player.y) < 1600);
}

// --- Police -----------------------------------------------------------------
export function spawnPolice(state) {
  const p = state.player;
  const ang = rand(0, Math.PI * 2);
  const x = clamp(p.x + Math.cos(ang) * 700, 80, WORLD_W - 80);
  const y = clamp(p.y + Math.sin(ang) * 700, 80, WORLD_H - 80);
  const rp = { x: nearestAvenue(x), y: nearestStreet(y) };
  const car = makeVehicle('police', rp.x, rp.y, 0, { police: true });
  car.siren = true;
  car.vertical = Math.abs(x - rp.x) < Math.abs(y - rp.y);
  return car;
}

export function updatePolice(state, dt) {
  const p = state.player;
  const target = state.playerCar || null;
  const tx = target ? target.x : p.x;
  const ty = target ? target.y : p.y;
  for (const cop of state.police) {
    const want = Math.atan2(ty - cop.y, tx - cop.x);
    const diff = angleDiff(cop.angle, want);
    cop.angle += clamp(diff, -cop.turn * dt * 1.4, cop.turn * dt * 1.4);
    const d = dist(cop.x, cop.y, tx, ty);
    const wantSpeed = d > 260 ? cop.max : (d > 60 ? cop.max * 0.7 : cop.max * 0.35);
    cop.speed += clamp(wantSpeed - cop.speed, -600 * dt, 500 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // Ram the player's car.
    if (target && d < (cop.len + target.len) / 2 - 4) {
      target.damage = (target.damage || 0) + 30 * dt;
      cop.speed *= 0.6;
      state.shake = Math.max(state.shake, 4);
      if (state.audio) state.audio.thud();
    }
    // On foot: a cop close by busts the player.
    if (!target && d < 46) {
      state.bustedTimer += dt;
      if (state.bustedTimer > 1.6) state.busted = true;
    } else if (!target) {
      state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);
    }
  }
  // Wanted decay: out of every cop's sight for a while cools the heat.
  if (state.wanted > 0) {
    let seen = false;
    for (const cop of state.police) if (dist(cop.x, cop.y, p.x, p.y) < 520) { seen = true; break; }
    if (!seen) state.coolTimer += dt;
    else state.coolTimer = 0;
    if (state.coolTimer > 14) {
      state.wanted = Math.max(0, state.wanted - 1);
      state.coolTimer = 0;
      if (state.wanted === 0) state.police = [];
    }
  }
}

export function wantedFor(crime) {
  return { steal: 1, hitPed: 1, punch: 1, shoot: 2, killCop: 2, ram: 1 }[crime] || 1;
}

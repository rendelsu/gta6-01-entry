// SOLMAR — Vice Harbor: vehicles, pedestrians and the VHPD police.
// Traffic drives the road grid; police chase the player when wanted.

const VEHICLE_TYPES = [
  { id: 'sedan',   name: 'Bayside Sedan',   w: 46, h: 22, top: 240, accel: 210, color: '#c8b060', chance: 0.24 },
  { id: 'taxi',    name: 'Harbor Taxi',     w: 46, h: 22, top: 230, accel: 200, color: '#e8b820', chance: 0.14 },
  { id: 'coupe',   name: 'Cortez Coupe',    w: 44, h: 20, top: 260, accel: 260, color: '#c84040', chance: 0.12 },
  { id: 'sports',  name: 'Vultura GT',      w: 46, h: 20, top: 320, accel: 330, color: '#e87020', chance: 0.08 },
  { id: 'truck',   name: 'Dock Truck',      w: 60, h: 24, top: 170, accel: 150, color: '#5a7a9a', chance: 0.12 },
  { id: 'van',     name: 'Marina Van',      w: 52, h: 23, top: 190, accel: 170, color: '#8a8a7a', chance: 0.12 },
  { id: 'bus',     name: 'City Bus',        w: 72, h: 26, top: 150, accel: 130, color: '#3a9a7a', chance: 0.08 },
  { id: 'police',  name: 'VHPD Cruiser',    w: 48, h: 22, top: 300, accel: 300, color: '#20386a', chance: 0.10 },
];

function pickVehicleType(excludePolice) {
  let total = 0;
  for (const t of VEHICLE_TYPES) if (!excludePolice || t.id !== 'police') total += t.chance;
  let r = Math.random() * total;
  for (const t of VEHICLE_TYPES) {
    if (excludePolice && t.id === 'police') continue;
    r -= t.chance;
    if (r <= 0) return t;
  }
  return VEHICLE_TYPES[0];
}

function makeCar(x, y, angle, type, opts) {
  const o = opts || {};
  return {
    x, y, angle, type,
    speed: o.speed || 0,
    color: o.color || type.color,
    traffic: !!o.traffic,        // NPC traffic car following the roads
    police: !!o.police,          // VHPD cruiser chasing the player
    driver: o.driver !== false,  // someone inside (stealable when parked)
    axis: o.axis || 'h',         // traffic axis: 'h' along a street, 'v' along an avenue
    dir: o.dir || 1,
    lane: o.lane || 0,           // lateral lane offset on its road
    targetSpeed: o.targetSpeed || rand(50, 95),
    honkT: rand(0, 6), dead: false, stuckT: 0,
  };
}

// --- traffic ---------------------------------------------------------------
function spawnTrafficCar(state) {
  const p = randomRoadPoint();
  const vertical = Math.abs(p.x - avenueX(nearestAvenue(p.x))) < 4;
  const type = pickVehicleType(true);
  const car = makeCar(p.x, p.y, vertical ? (chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (chance(0.5) ? 0 : Math.PI),
    type, { traffic: true, axis: vertical ? 'v' : 'h', dir: chance(0.5) ? 1 : -1, lane: rand(-14, 14) });
  // Keep traffic clear of the player and of mission markers.
  if (dist(car.x, car.y, state.player.x, state.player.y) < 420) return;
  state.traffic.push(car);
}

function updateTrafficCar(state, car, dt) {
  // Cruise along its road; slow for the car ahead; turn at intersections.
  let ahead = null, aheadD = 1e9;
  for (const o of state.traffic) {
    if (o === car || o.dead) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d < aheadD) { aheadD = d; ahead = o; }
  }
  const nearPlayerCar = state.player.car && dist(car.x, car.y, state.player.car.x, state.player.car.y) < 120;
  let want = car.targetSpeed;
  if ((ahead && aheadD < 110) || nearPlayerCar) want = 0;
  if (state.player.car && dist(car.x, car.y, state.player.car.x, state.player.car.y) < 46) want = 0;
  car.speed = lerp(car.speed, want, dt * 1.6);
  const step = car.speed * dt * car.dir;
  if (car.axis === 'h') { car.y = streetY(nearestStreet(car.y)) + car.lane; car.x += step; car.angle = car.dir > 0 ? 0 : Math.PI; }
  else { car.x = avenueX(nearestAvenue(car.x)) + car.lane; car.y += step; car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  // Turn at an intersection sometimes, or wrap around the city edge.
  const onH = Math.abs(car.y - streetY(nearestStreet(car.y))) < 6;
  const onV = Math.abs(car.x - avenueX(nearestAvenue(car.x))) < 6;
  if (onH && onV && chance(dt * 0.35)) {
    if (car.axis === 'h' && chance(0.5)) { car.axis = 'v'; car.dir = chance(0.5) ? 1 : -1; }
    else if (car.axis === 'v' && chance(0.5)) { car.axis = 'h'; car.dir = chance(0.5) ? 1 : -1; }
  }
  if (car.x < 30 || car.x > CITY_W - 30 || car.y < 30 || car.y > CITY_H - 30) {
    const p = randomRoadPoint();
    car.x = p.x; car.y = p.y; car.speed = 0;
  }
}

// --- pedestrians -----------------------------------------------------------
const PED_NAMES = ['Rosa', 'Dee', 'Marcus', 'Lena', 'Tomas', 'Priya', 'Otis', 'Carmen', 'Jules', 'Nadia', 'Frank', 'Ivy'];
const PED_COLORS = ['#e8a0a0', '#a0c8e8', '#e8d0a0', '#a0e8b0', '#d0a0e8', '#e8e8a0', '#c0c0c0', '#f0b070'];

function spawnPed(state, x, y) {
  const p = x !== undefined ? { x, y } : randomSidewalkPoint();
  return {
    x: p.x, y: p.y, angle: rand(0, Math.PI * 2), speed: rand(28, 52),
    name: pick(PED_NAMES), color: pick(PED_COLORS), panic: 0,
    walkT: rand(0, 4), dead: false, thug: false, cop: false, hp: 30,
  };
}

function updatePed(state, ped, dt) {
  if (ped.dead) return;
  ped.walkT -= dt;
  if (ped.walkT <= 0) { ped.walkT = rand(2, 6); ped.angle = rand(0, Math.PI * 2); }
  const flee = state.player.car || ped.panic > 0;
  let ax = Math.cos(ped.angle), ay = Math.sin(ped.angle);
  if (ped.panic > 0) {
    const a = angleTo(state.player.x, state.player.y, ped.x, ped.y);
    ax = Math.cos(a); ay = Math.sin(a);
    ped.speed = 130;
  } else if (flee && state.player.car && dist(ped.x, ped.y, state.player.car.x, state.player.car.y) < 90) {
    const a = angleTo(state.player.car.x, state.player.car.y, ped.x, ped.y);
    ax = Math.cos(a); ay = Math.sin(a);
    ped.speed = 120;
  }
  ped.x += ax * ped.speed * dt;
  ped.y += ay * ped.speed * dt;
  ped.x = clamp(ped.x, 30, CITY_W - 30);
  ped.y = clamp(ped.y, 30, CITY_H - 30);
  const fixed = collideBuildings(ped.x, ped.y, 10);
  ped.x = fixed.x; ped.y = fixed.y;
  if (ped.panic > 0) ped.panic -= dt;
}

// --- police ----------------------------------------------------------------
function spawnPolice(state) {
  const a = rand(0, Math.PI * 2);
  const px = clamp(state.player.x + Math.cos(a) * 700, 60, CITY_W - 60);
  const py = clamp(state.player.y + Math.sin(a) * 700, 60, CITY_H - 60);
  const type = VEHICLE_TYPES.find((t) => t.id === 'police');
  const car = makeCar(px, py, angleTo(px, py, state.player.x, state.player.y), type,
    { police: true, driver: true, targetSpeed: 300 });
  state.police.push(car);
  return car;
}

function updatePoliceCar(state, car, dt) {
  const tx = state.player.car ? state.player.car.x : state.player.x;
  const ty = state.player.car ? state.player.car.y : state.player.y;
  const wantAngle = angleTo(car.x, car.y, tx, ty);
  const d = dist(car.x, car.y, tx, ty);
  car.angle += clamp(angleDiff(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
  const target = d > 320 ? car.type.top : car.type.top * 0.82;
  car.speed = lerp(car.speed, target, dt * 1.4);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(car.x, car.y, 20);
  car.x = fixed.x; car.y = fixed.y;
  car.x = clamp(car.x, 20, CITY_W - 20);
  car.y = clamp(car.y, 20, CITY_H - 20);
  // Ram the player: a hard hit hurts and shakes the camera (once a second
  // per cruiser, so a long shove does not drain the whole health bar).
  if (car.ramT === undefined) car.ramT = 0;
  car.ramT -= dt;
  if (d < 52 && car.ramT <= 0) {
    car.ramT = 1.0;
    if (state.player.car) {
      state.player.car.speed *= 0.55;
      state.shake = 10;
      if (state.player.hp > 0) state.player.hp = Math.max(1, state.player.hp - 2);
    } else if (state.hitCooldown <= 0) {
      state.player.hp = Math.max(0, state.player.hp - 12);
      state.hitCooldown = 0.8;
      state.shake = 12;
      AudioSys.punch();
    }
  }
  if (d > 1600) { car.dead = true; }
}

function spawnFootCop(state) {
  const a = rand(0, Math.PI * 2);
  const ped = spawnPed(state, clamp(state.player.x + Math.cos(a) * 320, 40, CITY_W - 40),
    clamp(state.player.y + Math.sin(a) * 320, 40, CITY_H - 40));
  ped.cop = true; ped.name = 'VHPD Officer'; ped.color = '#20386a'; ped.hp = 60; ped.speed = 95;
  state.peds.push(ped);
  return ped;
}

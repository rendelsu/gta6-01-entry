// Traffic, pedestrians and police. All three are simple agents that live on
// the road grid: traffic follows lanes and turns at intersections, peds walk
// the sidewalks and flee from gunfire, police hunt the player when wanted.
import {
  ROAD_XS, ROAD_YS, ROAD_WIDTH, LANE, CAR_LENGTH, CAR_WIDTH,
  CAR_MODELS, PED_NAMES, PED_SHIRTS, WORLD_W, WORLD_H,
} from './config.js';
import { mulberry32, range, rangeInt, pick, chance, clamp, angleDiff, turnToward, dist } from './random.js';
import { isOnRoad, isWater, buildingAt, nearestRoadX, nearestRoadY } from './city.js';

export function makeCar(x, y, angle, modelIdx, opts = {}) {
  const model = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    kind: opts.kind || 'traffic',
    x, y, angle, speed: opts.speed || 0,
    modelIdx, model,
    color: opts.color || model.color,
    hp: 100,
    driver: opts.driver !== undefined ? opts.driver : true,
    road: opts.road || 'v', // 'v' drives along a vertical road, 'h' horizontal
    dir: opts.dir || 1,
    lane: opts.lane || 1,
    turnAt: null,
    dead: false,
    smoke: 0,
    honkTimer: rangeInt(mulberry32((Math.random() * 1e9) | 0), 200, 900),
  };
}

export function spawnTraffic(G, count) {
  const rng = G.rng;
  G.cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = chance(rng, 0.5);
    const road = vertical ? pick(rng, ROAD_XS) : pick(rng, ROAD_YS);
    const along = range(rng, 100, WORLD_W - 100);
    const dir = chance(rng, 0.5) ? 1 : -1;
    const lane = chance(rng, 0.5) ? 1 : -1;
    const x = vertical ? road + lane * LANE * dir : along;
    const y = vertical ? along : road + lane * LANE * dir;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const modelIdx = rangeInt(rng, 0, CAR_MODELS.length - 2);
    const car = makeCar(x, y, angle, modelIdx, { road: vertical ? 'v' : 'h', dir, lane, speed: range(rng, 110, 170) });
    G.cars.push(car);
  }
  // Parked cars along the kerb, free to steal.
  for (const spot of G.city.parkedSpots.slice(0, 26)) {
    const modelIdx = rangeInt(rng, 0, CAR_MODELS.length - 2);
    const car = makeCar(spot.x, spot.y, spot.angle, modelIdx, { kind: 'parked', driver: false, speed: 0 });
    G.cars.push(car);
  }
}

export function spawnPeds(G, count) {
  const rng = G.rng;
  G.peds = [];
  for (let i = 0; i < count; i++) {
    const rx = pick(rng, ROAD_XS);
    const ry = pick(rng, ROAD_YS);
    const onVertical = chance(rng, 0.5);
    const x = onVertical ? rx + (chance(rng, 0.5) ? 1 : -1) * (ROAD_WIDTH / 2 + 12) : range(rng, 80, WORLD_W - 80);
    const y = onVertical ? range(rng, 80, WORLD_H - 80) : ry + (chance(rng, 0.5) ? 1 : -1) * (ROAD_WIDTH / 2 + 12);
    G.peds.push({
      x, y, angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 28, 52),
      state: 'walk',
      name: pick(rng, PED_NAMES),
      shirt: pick(rng, PED_SHIRTS),
      tx: x, ty: y, // wander target
      wait: 0,
      dead: false,
      fleeTimer: 0,
    });
  }
}

// --- Traffic ----------------------------------------------------------------

function nearestIntersectionCoord(v, roads) {
  let best = roads[0];
  for (const r of roads) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  return best;
}

export function updateTraffic(G, dt) {
  const player = G.player;
  for (const car of G.cars) {
    if (car.kind === 'parked' || car.kind === 'player' || car.kind === 'police' || car.dead) continue;
    // Cruise speed with a little per-car character.
    const target = car.cruise || (car.cruise = 120 + (car.modelIdx * 13) % 60);
    car.speed += (target - car.speed) * dt * 0.8;
    // Brake for the car ahead on the same lane.
    for (const other of G.cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
      if (ahead > 0 && ahead < 70 && side < 24) { car.speed = Math.min(car.speed, other.speed * 0.9); break; }
    }
    // Brake for the player standing in the road.
    if (!player.inCar) {
      const dx = player.x - car.x, dy = player.y - car.y;
      const ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
      if (ahead > 0 && ahead < 60 && side < 22) {
        car.speed = Math.max(0, car.speed - 300 * dt);
        if (car.honkTimer-- <= 0) { G.audio.honk(); car.honkTimer = 600; }
      }
    }
    // Advance along the current road.
    const step = car.speed * dt;
    car.x += Math.cos(car.angle) * step;
    car.y += Math.sin(car.angle) * step;
    // At an intersection, sometimes turn onto the cross road.
    const roads = car.road === 'v' ? ROAD_YS : ROAD_XS;
    const along = car.road === 'v' ? car.y : car.x;
    const cross = nearestIntersectionCoord(along, roads);
    if (Math.abs(along - cross) < 4 && !car.turnAt) {
      car.turnAt = cross;
      if (chance(G.rng, 0.3)) {
        const left = chance(G.rng, 0.5);
        const turn = car.road === 'v'
          ? (car.dir > 0 ? (left ? Math.PI : 0) : (left ? 0 : Math.PI))
          : (car.dir > 0 ? (left ? Math.PI / 2 : -Math.PI / 2) : (left ? -Math.PI / 2 : Math.PI / 2));
        car.targetAngle = turn;
        car.turning = true;
      }
    }
    if (car.turning) {
      car.angle = turnToward(car.angle, car.targetAngle, 3.2 * dt);
      if (Math.abs(angleDiff(car.angle, car.targetAngle)) < 0.05) {
        car.turning = false;
        car.turnAt = null;
        // After the turn the car is on the other axis.
        car.road = car.road === 'v' ? 'h' : 'v';
        car.dir = Math.abs(Math.cos(car.angle)) > 0.5 ? Math.sign(Math.cos(car.angle)) : Math.sign(Math.sin(car.angle));
        if (car.road === 'v') car.x = nearestRoadX(car.x) + car.lane * LANE * car.dir;
        else car.y = nearestRoadY(car.y) + car.lane * LANE * car.dir;
      }
    } else if (Math.abs(along - cross) > 30) {
      car.turnAt = null;
    }
    // Wrap around the world edge instead of despawning mid-screen.
    if (car.x < -80) car.x = WORLD_W + 60;
    if (car.x > WORLD_W + 80) car.x = -60;
    if (car.y < -80) car.y = WORLD_H + 60;
    if (car.y > WORLD_H + 80) car.y = -60;
  }
}

// --- Pedestrians ------------------------------------------------------------

export function updatePeds(G, dt) {
  const player = G.player;
  for (const p of G.peds) {
    if (p.dead) continue;
    // Flee from gunfire or a speeding car nearby.
    const dPlayer = dist(p.x, p.y, player.x, player.y);
    const scared = (G.gunfireTimer > 0 && dPlayer < 320) || (player.inCar && player.car && dist(p.x, p.y, player.car.x, player.car.y) < 90 && Math.abs(player.car.speed) > 200);
    if (scared && p.state !== 'flee') { p.state = 'flee'; p.fleeTimer = 2.5; }
    if (p.state === 'flee') {
      p.fleeTimer -= dt;
      const away = Math.atan2(p.y - player.y, p.x - player.x);
      p.angle = turnToward(p.angle, away, 6 * dt);
      p.x += Math.cos(p.angle) * 150 * dt;
      p.y += Math.sin(p.angle) * 150 * dt;
      if (p.fleeTimer <= 0) p.state = 'walk';
    } else {
      if (p.wait > 0) { p.wait -= dt; continue; }
      const d = dist(p.x, p.y, p.tx, p.ty);
      if (d < 12) {
        // Pick a new wander target on a nearby sidewalk.
        const rx = nearestRoadX(p.x), ry = nearestRoadY(p.y);
        if (chance(G.rng, 0.5)) { p.tx = clamp(rx + (chance(G.rng, 0.5) ? 1 : -1) * (ROAD_WIDTH / 2 + 12), 40, WORLD_W - 40); p.ty = clamp(p.y + range(G.rng, -260, 260), 40, WORLD_H - 40); }
        else { p.ty = clamp(ry + (chance(G.rng, 0.5) ? 1 : -1) * (ROAD_WIDTH / 2 + 12), 40, WORLD_H - 40); p.tx = clamp(p.x + range(G.rng, -260, 260), 40, WORLD_W - 40); }
        if (chance(G.rng, 0.25)) p.wait = range(G.rng, 1, 4);
        continue;
      }
      const target = Math.atan2(p.ty - p.y, p.tx - p.x);
      p.angle = turnToward(p.angle, target, 5 * dt);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
    }
    p.x = clamp(p.x, 30, WORLD_W - 30);
    p.y = clamp(p.y, 30, WORLD_H - 60);
    // Peds never walk through buildings.
    if (buildingAt(G.city, p.x, p.y)) { p.x -= Math.cos(p.angle) * p.speed * dt * 2; p.y -= Math.sin(p.angle) * p.speed * dt * 2; p.tx = p.x; p.ty = p.y; }
  }
}

// --- Police -----------------------------------------------------------------

export function wantedPoliceCount(wanted) {
  return Math.min(1 + wanted, 6);
}

export function updatePolice(G, dt) {
  const player = G.player;
  const want = wantedPoliceCount(G.wanted);
  // Spawn police cars at the map edge until the wanted level is matched.
  if (G.wanted > 0 && G.cops.length < want && G.policeSpawnTimer <= 0) {
    const edge = rangeInt(G.rng, 0, 3);
    let x = 0, y = 0;
    if (edge === 0) { x = player.x + range(G.rng, -700, 700); y = 120; }
    if (edge === 1) { x = player.x + range(G.rng, -700, 700); y = WORLD_H - 160; }
    if (edge === 2) { x = 120; y = player.y + range(G.rng, -700, 700); }
    if (edge === 3) { x = WORLD_W - 120; y = player.y + range(G.rng, -700, 700); }
    x = clamp(x, 60, WORLD_W - 60); y = clamp(y, 60, WORLD_H - 80);
    const cop = makeCar(x, y, Math.atan2(player.y - y, player.x - x), 7, { kind: 'police', speed: 200 });
    cop.hp = 120;
    G.cops.push(cop);
    G.cars.push(cop);
    G.policeSpawnTimer = 2.5;
  }
  G.policeSpawnTimer -= dt;
  // On-foot officers appear when the player is on foot and wanted.
  // (Staged screenshot scenes skip them: a still subject would be busted.)
  if (G.wanted > 0 && !player.inCar && !G.shotMode && G.officers.length < Math.min(G.wanted, 3) && G.officerSpawnTimer <= 0) {
    G.officers.push({
      x: player.x + range(G.rng, -260, 260), y: player.y + range(G.rng, -260, 260),
      angle: 0, speed: 150, state: 'chase', shirt: '#1f4e9c', name: 'Officer',
      tx: 0, ty: 0, wait: 0, dead: false, bustTimer: 0, isCop: true,
    });
    G.officerSpawnTimer = 4;
  }
  G.officerSpawnTimer -= dt;

  for (const cop of G.cops) {
    if (cop.dead) continue;
    const target = Math.atan2(player.y - cop.y, player.x - cop.x);
    const top = 300 + G.wanted * 45;
    cop.speed = Math.min(cop.speed + 260 * dt, top);
    cop.angle = turnToward(cop.angle, target, 2.4 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // Police bounce off buildings instead of driving through them.
    if (buildingAt(G.city, cop.x, cop.y)) {
      cop.x -= Math.cos(cop.angle) * cop.speed * dt * 2;
      cop.y -= Math.sin(cop.angle) * cop.speed * dt * 2;
      cop.angle += Math.PI / 2;
      cop.speed *= 0.5;
    }
    // Ramming the player hurts.
    const d = dist(cop.x, cop.y, player.x, player.y);
    if (d < 46) {
      if (player.inCar && player.car) {
        player.car.hp -= 10 * dt;
        G.shake = Math.min(G.shake + 0.4, 1);
        if (cop.ramTimer === undefined || cop.ramTimer <= 0) { G.audio.crash(); cop.ramTimer = 0.8; }
      } else if (!player.invuln) {
        hurtPlayer(G, 22);
        player.x += Math.cos(target) * 26;
        player.y += Math.sin(target) * 26;
      }
    }
    if (cop.ramTimer !== undefined) cop.ramTimer -= dt;
  }
  // Remove wrecked police cars.
  for (let i = G.cops.length - 1; i >= 0; i--) {
    if (G.cops[i].dead || G.cops[i].hp <= 0) {
      G.cops[i].dead = true;
      spawnExplosion(G, G.cops[i].x, G.cops[i].y);
      G.cars.splice(G.cars.indexOf(G.cops[i]), 1);
      G.cops.splice(i, 1);
    }
  }
}

export function updateOfficers(G, dt) {
  const player = G.player;
  for (const o of G.officers) {
    if (o.dead) continue;
    const d = dist(o.x, o.y, player.x, player.y);
    const target = Math.atan2(player.y - o.y, player.x - o.x);
    o.angle = turnToward(o.angle, target, 6 * dt);
    if (d > 34) {
      o.x += Math.cos(o.angle) * o.speed * dt;
      o.y += Math.sin(o.angle) * o.speed * dt;
      o.bustTimer = 0;
    } else {
      // Caught: stand still and bust the player after a short struggle.
      o.bustTimer += dt;
      if (o.bustTimer > 1.4) {
        G.mode = 'busted';
        G.audio.failSting();
      }
    }
    if (buildingAt(G.city, o.x, o.y)) { o.x -= Math.cos(o.angle) * o.speed * dt * 2; o.y -= Math.sin(o.angle) * o.speed * dt * 2; }
  }
  G.officers = G.officers.filter((o) => !o.dead);
}

// --- Shared combat helpers --------------------------------------------------

export function hurtPlayer(G, amount) {
  if (G.player.invuln > 0 || G.mode !== 'playing') return;
  let left = amount;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, left * 0.7);
    G.armor -= absorbed;
    left -= absorbed;
  }
  G.health -= left;
  G.player.invuln = 0.4;
  G.shake = Math.min(G.shake + 0.5, 1);
  G.damageFlash = 0.5;
  if (G.health <= 0) {
    G.health = 0;
    G.mode = 'wasted';
    G.audio.failSting();
  }
}

export function addWanted(G, stars) {
  G.wanted = Math.min(5, G.wanted + stars);
  G.wantedTimer = 0;
  G.policeSpawnTimer = Math.min(G.policeSpawnTimer, 0.5);
}

export function spawnExplosion(G, x, y) {
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + G.rng() * 0.5;
    const sp = 60 + G.rng() * 220;
    G.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + G.rng() * 0.7, maxLife: 1.2, size: 3 + G.rng() * 6,
      color: ['#f39c12', '#e74c3c', '#f1c40f', '#7f8c8d'][i % 4], type: 'spark',
    });
  }
  G.audio.crash();
  G.shake = 1;
}

export function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - 1.6 * dt);
    p.vy *= (1 - 1.6 * dt);
  }
}

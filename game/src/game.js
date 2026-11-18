// SOLMAR — Vice Harbor: game state, input, update loop, wanted system,
// combat, car stealing, taxi fares and saving.

const SAVE_KEY = 'solmar-vice-harbor-v1';

function newGameState() {
  return {
    started: false, wasted: false,
    player: { x: 1760, y: 1760, angle: -Math.PI / 2, speed: 0, hp: 100, car: null, moving: false },
    cash: 250, debtPaid: 0, missionsDone: 0, storyDone: false,
    missionIndex: 0, missionStep: 0, missionActive: false, nextMissionAt: 0,
    dialog: null, toast: null, wanted: 0, wantedTimer: 0, crimeTimer: 0,
    clock: 17 * 60 + 30, // 5:30 PM — golden hour over the harbor
    rain: false, rainDrops: [],
    traffic: [], peds: [], police: [], parked: [],
    shake: 0, hitCooldown: 0, missionTimer: 0, thugsLeft: 0,
    fare: null, farePassenger: null, time: 0, camX: 0, camY: 0,
    saveExists: false, errors: 0,
  };
}

function loadSave(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    state.cash = s.cash ?? 250;
    state.debtPaid = s.debtPaid ?? 0;
    state.missionsDone = s.missionsDone ?? 0;
    state.missionIndex = s.missionIndex ?? 0;
    state.player.x = s.x ?? 1760;
    state.player.y = s.y ?? 1760;
    state.clock = s.clock ?? 1050;
    state.storyDone = !!s.storyDone;
    return true;
  } catch (e) { return false; }
}

function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash, debtPaid: state.debtPaid, missionsDone: state.missionsDone,
      missionIndex: state.missionIndex, x: state.player.x, y: state.player.y,
      clock: state.clock, storyDone: state.storyDone,
    }));
  } catch (e) {}
}

function addWanted(state, n, reason) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + n, 0, 5);
  state.crimeTimer = 0;
  if (state.wanted > before) {
    AudioSys.wantedUp();
    if (reason) state.toast = { text: reason + ' — WANTED LEVEL ' + state.wanted, t: 3 };
  }
}

function nearestCar(state, x, y, maxD) {
  let best = null, bestD = maxD;
  const all = state.traffic.concat(state.parked, state.police);
  for (const c of all) {
    if (c.dead) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function enterCar(state, car) {
  const p = state.player;
  p.car = car;
  car.traffic = false; car.police = false; car.driver = true;
  const idx = state.traffic.indexOf(car);
  if (idx >= 0) state.traffic.splice(idx, 1);
  const pi = state.parked.indexOf(car);
  if (pi >= 0) state.parked.splice(pi, 1);
  const pol = state.police.indexOf(car);
  if (pol >= 0) state.police.splice(pol, 1);
  p.angle = car.angle;
  if (!car.wasOwned) { car.wasOwned = true; addWanted(state, 1, 'CAR STOLEN'); }
  // Mission step: steal a specific vehicle type.
  const step = currentStep(state);
  if (step && step.type === 'steal' && car.type.id === step.vehicle) advanceStep(state);
  AudioSys.pickup();
}

function exitCar(state) {
  const p = state.player;
  if (!p.car) return;
  const car = p.car;
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  p.car = null;
  state.parked.push(car);
}

function punch(state) {
  const p = state.player;
  if (p.car) return;
  AudioSys.punch();
  const px = p.x + Math.cos(p.angle) * 34;
  const py = p.y + Math.sin(p.angle) * 34;
  let hitAny = false;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (dist(px, py, ped.x, ped.y) < 34) {
      hitAny = true;
      ped.hp -= 25;
      ped.panic = 3;
      const a = angleTo(p.x, p.y, ped.x, ped.y);
      ped.x += Math.cos(a) * 22; ped.y += Math.sin(a) * 22;
      if (ped.hp <= 0) {
        ped.dead = true;
        if (ped.cop) { addWanted(state, 2, 'OFFICER DOWN'); }
        else if (ped.thug) {
          state.thugsLeft--;
          const step = currentStep(state);
          if (step && step.type === 'beat' && state.thugsLeft <= 0) advanceStep(state);
        } else { addWanted(state, 1, 'PEDESTRIAN HIT'); }
      } else if (ped.cop) {
        addWanted(state, 1, 'ASSAULTED AN OFFICER');
      }
    }
  }
  if (!hitAny) state.toast = { text: 'You swing at the air.', t: 1.2 };
}

function updatePlayer(state, keys, dt) {
  const p = state.player;
  p.moving = false;
  if (p.car) {
    const car = p.car;
    // Screenshot scenes keep the car rolling on its own (autodrive).
    const auto = !!state.autodrive;
    const fwd = ((keys.w || keys.up || auto) ? 1 : 0) - (keys.s || keys.down ? 0.7 : 0);
    const steer = (keys.a || keys.left ? -1 : 0) + (keys.d || keys.right ? 1 : 0);
    const spd = car.speed / car.type.top;
    car.speed += fwd * car.type.accel * dt;
    if (!fwd) car.speed = lerp(car.speed, 0, dt * 0.9);
    if (keys.space) car.speed = lerp(car.speed, 0, dt * 5);
    car.speed = clamp(car.speed, -car.type.top * 0.4, car.type.top);
    car.angle += steer * 1.9 * dt * clamp(Math.abs(spd) * 1.4, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideBuildings(car.x, car.y, 22);
    if (fixed.hit && Math.abs(car.speed) > 120) { AudioSys.crash(); state.shake = 8; car.speed *= 0.4; }
    car.x = fixed.x; car.y = fixed.y;
    car.x = clamp(car.x, 24, CITY_W - 24);
    car.y = clamp(car.y, 24, CITY_H - 24);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // Running over pedestrians.
    for (const ped of state.peds) {
      if (!ped.dead && dist(ped.x, ped.y, car.x, car.y) < 26 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        ped.hp = 0;
        if (ped.cop) addWanted(state, 2, 'OFFICER RUN OVER');
        else if (ped.thug) {
          state.thugsLeft--;
          const step = currentStep(state);
          if (step && step.type === 'beat' && state.thugsLeft <= 0) advanceStep(state);
        } else addWanted(state, 1, 'PEDESTRIAN RUN OVER');
        AudioSys.crash();
        state.shake = 7;
      }
    }
    AudioSys.setEngine(Math.abs(car.speed) / car.type.top, true);
  } else {
    const mx = (keys.d || keys.right ? 1 : 0) - (keys.a || keys.left ? 1 : 0);
    const my = (keys.s || keys.down ? 1 : 0) - (keys.w || keys.up ? 1 : 0);
    const run = keys.shift ? 1.55 : 1;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.angle = Math.atan2(my / len, mx / len);
      p.x += (mx / len) * 185 * run * dt;
      p.y += (my / len) * 185 * run * dt;
      p.moving = true;
    }
    const fixed = collideBuildings(p.x, p.y, 11);
    p.x = fixed.x; p.y = fixed.y;
    p.x = clamp(p.x, 24, CITY_W - 24);
    p.y = clamp(p.y, 24, CITY_H - 24);
    AudioSys.setEngine(0, false);
  }
  if (state.hitCooldown > 0) state.hitCooldown -= dt;
}

function updateWanted(state, dt) {
  // Police presence matches the wanted level.
  const wantPolice = state.wanted >= 1 ? Math.min(state.wanted, 3) + (state.wanted >= 4 ? 2 : 0) : 0;
  const live = state.police.filter((c) => !c.dead);
  if (live.length < wantPolice && state.wanted > 0) spawnPolice(state);
  if (state.wanted >= 2 && state.peds.filter((p) => p.cop && !p.dead).length < 2 && chance(dt * 0.3)) spawnFootCop(state);
  // Foot cops chase and punch the player on foot.
  for (const ped of state.peds) {
    if (!ped.cop || ped.dead) continue;
    const d = dist(ped.x, ped.y, state.player.x, state.player.y);
    if (d < 500) {
      ped.angle = angleTo(ped.x, ped.y, state.player.x, state.player.y);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (d < 30 && state.hitCooldown <= 0 && !state.player.car) {
        state.player.hp = Math.max(0, state.player.hp - 10);
        state.hitCooldown = 0.9;
        state.shake = 8;
        AudioSys.punch();
      }
    }
  }
  // Wanted decays when no new crime for a while.
  state.crimeTimer += dt;
  if (state.wanted > 0 && state.crimeTimer > 25) {
    state.wantedTimer += dt;
    if (state.wantedTimer > 6) { state.wanted--; state.wantedTimer = 0; state.crimeTimer = 20; }
  } else state.wantedTimer = 0;
  AudioSys.setSiren(state.wanted >= 1);
  // Busted: hp hits zero.
  if (state.player.hp <= 0 && !state.wasted) {
    state.wasted = true;
    state.cash = Math.max(0, state.cash - 200);
    state.toast = { text: 'BUSTED — the VHPD took $200 in fines.', t: 4 };
  }
}

function updateMissions(state, dt) {
  if (state.nextMissionAt > 0) {
    state.nextMissionAt -= dt;
    if (state.nextMissionAt <= 0 && state.missionIndex + 1 < MISSIONS.length && !state.missionActive) {
      startMission(state, state.missionIndex + 1);
    }
  }
  const step = currentStep(state);
  if (!step) return;
  const p = state.player;
  if (step.type === 'taxi') {
    // Mission 1 opens in a taxi: step on once the player is driving one.
    if (p.car && p.car.type.id === 'taxi') advanceStep(state);
  } else if (step.type === 'goto') {
    const at = dist(p.x, p.y, step.x, step.y) < step.r;
    if (at && (!step.needCar || p.car)) {
      if (state.missionIndex === 0 && state.missionStep === 1 && state.fare) { /* fare pickup handled below */ }
      advanceStep(state);
    }
  } else if (step.type === 'wanted') {
    if (state.wanted >= step.level) { state.missionTimer = 0; advanceStep(state); }
  } else if (step.type === 'survive') {
    state.missionTimer += dt;
    if (state.missionTimer >= step.seconds) advanceStep(state);
  } else if (step.type === 'clean') {
    if (state.wanted === 0) advanceStep(state);
  }
  // Mission 1 is a taxi job: the fare system drives its pickup/drop-off.
  if (state.missionIndex === 0 && state.missionActive && !state.fare && state.missionStep === 1) {
    state.fare = { stage: 'pickup', x: 480, y: 480, dx: 1760, dy: 1760, pay: 0, t: 0, missionFare: true };
  }
}

function updateFare(state, dt) {
  const f = state.fare;
  if (!f) return;
  const p = state.player;
  const tx = f.stage === 'pickup' ? f.x : f.dx;
  const ty = f.stage === 'pickup' ? f.y : f.dy;
  if (dist(p.x, p.y, tx, ty) < 80 && p.car) {
    if (f.stage === 'pickup') {
      f.stage = 'dropoff';
      state.farePassenger = true;
      state.toast = { text: 'Passenger aboard — drive to the yellow marker.', t: 3 };
      AudioSys.pickup();
    } else {
      const pay = f.missionFare ? 0 : f.pay;
      if (pay > 0) { state.cash += pay; AudioSys.cash(); state.toast = { text: 'FARE COMPLETE — +' + fmtMoney(pay), t: 3 }; }
      state.fare = null;
      state.farePassenger = false;
      const step = currentStep(state);
      if (step && state.missionIndex === 0 && state.missionStep === 2) advanceStep(state);
    }
  }
}

function updateGame(state, keys, dt) {
  state.time += dt;
  state.clock = (state.clock + dt * 0.5) % 1440; // 1 real second = 30 game-seconds
  if (state.toast && state.toast.t > 0) state.toast.t -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
  // Rain drops drift across the camera view.
  if (state.rain) {
    if (state.rainDrops.length < 90) {
      state.rainDrops.push({ x: state.camX + rand(0, 1280), y: state.camY + rand(0, 720) });
    }
    for (const d of state.rainDrops) { d.y += 620 * dt; d.x -= 120 * dt; if (d.y > state.camY + 760) { d.y = state.camY - 10; d.x = state.camX + rand(0, 1280); } }
  }
  updatePlayer(state, keys, dt);
  for (const car of state.traffic) updateTrafficCar(state, car, dt);
  state.traffic = state.traffic.filter((c) => !c.dead);
  while (state.traffic.length < 26) spawnTrafficCar(state);
  for (const ped of state.peds) updatePed(state, ped, dt);
  state.peds = state.peds.filter((p) => !p.dead || p.thug || p.cop);
  while (state.peds.length < 34) state.peds.push(spawnPed(state));
  for (const car of state.police) updatePoliceCar(state, car, dt);
  state.police = state.police.filter((c) => !c.dead);
  for (const car of state.parked) { if (car.dead) continue; }
  updateWanted(state, dt);
  updateMissions(state, dt);
  updateFare(state, dt);
  // Slow health regen on foot, away from trouble.
  if (!state.player.car && state.wanted === 0 && state.player.hp > 0) {
    state.player.hp = Math.min(100, state.player.hp + dt * 1.5);
  }
  // Autosave every ~20 seconds.
  if (Math.floor(state.time) % 20 === 0 && !state._savedTick) { state._savedTick = true; saveGame(state); }
  if (Math.floor(state.time) % 20 !== 0) state._savedTick = false;
}

// --- scene presets for screenshots (real gameplay states, set by ?shot=N) ---
function applyShotPreset(state, shot) {
  state.started = true;
  state.saveExists = false;
  if (shot === 1) {
    // Cover: dusk chase — wanted 3, police cruisers + traffic + peds + mission.
    state.clock = 17 * 60 + 48;
    state.wanted = 3;
    state.player.x = 1760; state.player.y = 1760;
    const type = VEHICLE_TYPES.find((t) => t.id === 'sports');
    const car = makeCar(1760, 1760, 0, type, { driver: true });
    car.speed = 150;
    state.player.car = car;
    state.autodrive = true;
    state.parked.push(car);
    for (let i = 0; i < 3; i++) spawnPolice(state);
    startMission(state, 0);
    state.dialog = null;
    state.missionStep = 0;
  } else if (shot === 2) {
    // Mission dialog + combat: Mara briefs mission 3, thugs at the store.
    state.clock = 13 * 60 + 20;
    state.wanted = 1;
    state.player.x = 2000; state.player.y = 2000;
    startMission(state, 2);
    state.missionStep = 1;
    state.dialog = { speaker: 'MARA VOSS', text: MISSIONS[2].brief, mission: 'Knockout', open: true };
  } else if (shot === 3) {
    // Night drive in the rain: taxi headlights, traffic, wet streets.
    state.clock = 22 * 60 + 10;
    state.rain = true;
    state.wanted = 0;
    state.player.x = 1440; state.player.y = 1440;
    const type = VEHICLE_TYPES.find((t) => t.id === 'taxi');
    const car = makeCar(1440, 1440, 0, type, { driver: true });
    car.speed = 190;
    state.player.car = car;
    state.autodrive = true;
    state.parked.push(car);
    state.fare = { stage: 'dropoff', x: 1440, y: 1440, dx: 2080, dy: 2080, pay: 180, t: 0 };
    state.farePassenger = true;
  } else if (shot === 4) {
    // On foot downtown: peds, storefronts, minimap, one wanted star.
    state.clock = 10 * 60 + 5;
    state.wanted = 1;
    state.player.x = 2080; state.player.y = 2080;
    state.player.angle = Math.PI / 4;
    for (let i = 0; i < 2; i++) spawnPolice(state);
    state.missionActive = false;
    state.toast = { text: 'Downtown — lay low, the VHPD is watching.', t: 5 };
  }
  // Dense life around the player for every shot.
  for (let i = 0; i < 10; i++) {
    const ped = spawnPed(state, state.player.x + rand(-420, 420), state.player.y + rand(-300, 300));
    state.peds.push(ped);
  }
}

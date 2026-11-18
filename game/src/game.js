// Game state, input, update loop and save for SOLMAR — Vice Harbor.
import { clamp, dist, angleDiff, rand, pick } from './util.js';
import { WORLD_W, WORLD_H, DISTRICTS, buildCity, collideBuildings, onRoad, nearestRoadPoint, avenueX, streetY } from './city.js';
import { makeVehicle, spawnTrafficCar, updateTraffic, makePed, spawnPed, updatePeds, spawnPolice, updatePolice, wantedFor, VEHICLE_TYPES } from './entities.js';
import { newMissionState, missionList, currentMission, currentStep, missionObjectiveText, startMission, updateMissions, tryInteract, newTaxiState, updateTaxi, showDialog, ensurePolice } from './missions.js';
import { AudioEngine } from './audio.js';
import { drawWorld, drawHUD, drawStartScreen, drawPauseScreen, drawHelpScreen, VIEW_W, VIEW_H } from './render.js';

const SAVE_KEY = 'solmar-vice-harbor-save-v3';

export function createState() {
  const city = buildCity();
  const state = {
    time: 0, hour: 10.5, rain: 0,
    cash: 250, wanted: 0, coolTimer: 0, bustedTimer: 0,
    busted: false, wasted: false, bustedAt: 0, wastedAt: 0,
    paused: false, started: false, help: false,
    shake: 0, punchTimer: 0, shootCooldown: 0,
    city, cityDistricts: DISTRICTS,
    camera: { x: 1920, y: 1440 },
    player: { x: 1920, y: 1440, angle: 0, health: 100, moving: false, speed: 0 },
    playerCar: null,
    traffic: [], police: [], peds: [],
    bullets: [], particles: [],
    missions: newMissionState(),
    taxi: newTaxiState(),
    audio: null,
    keys: {},
    mouse: { x: 0, y: 0, down: false },
    missionObjectiveText: '',
    saveGame: null,
    __entities: { spawnPolice, makeVehicle, makePed },
  };
  state.missions.list = missionList();
  state.saveGame = () => saveGame(state);
  return state;
}

export function loadSave(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (typeof s.cash === 'number') state.cash = s.cash;
    if (typeof s.debtPaid === 'number') state.missions.debtPaid = s.debtPaid;
    if (Array.isArray(s.done)) state.missions.done = s.done;
    if (typeof s.index === 'number') state.missions.index = Math.min(s.index, 4);
    if (typeof s.hour === 'number') state.hour = s.hour;
    if (typeof s.px === 'number') { state.player.x = s.px; state.player.y = s.py; }
    return true;
  } catch (e) { return false; }
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash, debtPaid: state.missions.debtPaid, done: state.missions.done,
      index: state.missions.index, hour: state.hour,
      px: state.player.x, py: state.player.y,
    }));
  } catch (e) { /* storage may be unavailable */ }
}

// --- Spawning ---------------------------------------------------------------
function seedWorld(state) {
  // Parked cars around the city, including a taxi near the start.
  for (let i = 0; i < 26; i++) {
    const type = pick(['sedan', 'sedan', 'coupe', 'van', 'truck', 'muscle', 'taxi']);
    const vertical = Math.random() < 0.5;
    let x, y, angle;
    if (vertical) {
      x = avenueX(1 + Math.floor(rand(0, 10))) + pick([-40, 40]);
      y = rand(200, WORLD_H - 200);
      angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = streetY(1 + Math.floor(rand(0, 7))) + pick([-40, 40]);
      x = rand(200, WORLD_W - 200);
      angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    state.traffic.push(makeVehicle(type, x, y, angle, { parked: true }));
  }
  for (let i = 0; i < 14; i++) state.traffic.push(spawnTrafficCar(state));
  for (let i = 0; i < 26; i++) state.peds.push(makePed(rand(300, WORLD_W - 300), rand(300, WORLD_H - 300)));
}

// --- Player actions -----------------------------------------------------------
function nearestCar(state, maxD) {
  const p = state.player;
  let best = null, bd = maxD;
  for (const v of state.traffic) {
    const d = dist(p.x, p.y, v.x, v.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function enterCar(state, car) {
  state.playerCar = car;
  car.parked = false;
  car.traffic = false;
  if (car.police) { /* stealing a cruiser is a crime too */ }
  else if (!car.stolen) {
    car.stolen = true;
    raiseWanted(state, wantedFor('steal'));
    if (state.audio) state.audio.horn();
  }
  showDialog(state, 'Mengemudi ' + car.name + ' — WASD untuk gas/rem/belok, E untuk keluar.', 4);
}

function exitCar(state) {
  const car = state.playerCar;
  if (!car) return;
  car.speed = 0;
  const px = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  const py = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  state.player.x = px; state.player.y = py;
  state.player.angle = car.angle;
  state.playerCar = null;
}

function raiseWanted(state, n) {
  if (state.wanted >= 5) return;
  state.wanted = Math.min(5, state.wanted + n);
  state.coolTimer = 0;
  ensurePolice(state);
  if (state.audio) state.audio.setSiren(state.wanted > 0);
}

function punch(state) {
  const p = state.player;
  state.punchTimer = 0.22;
  if (state.audio) state.audio.punch();
  const hx = p.x + Math.cos(p.angle) * 30, hy = p.y + Math.sin(p.angle) * 30;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (dist(hx, hy, ped.x, ped.y) < 26) {
      if (ped.thug) {
        ped.health -= 1;
        ped.panic = 1;
        ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
        if (ped.health <= 0) { ped.dead = true; }
        addParticles(state, ped.x, ped.y, '#ff5555', 8);
      } else {
        ped.dead = true;
        addParticles(state, ped.x, ped.y, '#ff8888', 10);
        raiseWanted(state, wantedFor('hitPed'));
      }
      return;
    }
  }
  for (const cop of state.police) {
    if (dist(hx, hy, cop.x, cop.y) < 30) {
      cop.damage = (cop.damage || 0) + 20;
      raiseWanted(state, wantedFor('killCop'));
      return;
    }
  }
}

function shoot(state) {
  if (state.shootCooldown > 0 || state.playerCar) return;
  state.shootCooldown = 0.28;
  const p = state.player;
  const wx = state.mouse.x + state.camera.x - VIEW_W / 2;
  const wy = state.mouse.y + state.camera.y - VIEW_H / 2;
  const a = Math.atan2(wy - p.y, wx - p.x);
  p.angle = a;
  state.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.6 });
  if (state.audio) state.audio.shoot();
  raiseWanted(state, wantedFor('shoot'));
}

function addParticles(state, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, y, vx: rand(-120, 120), vy: rand(-120, 120),
      life: rand(0.3, 0.7), max: 0.7, size: rand(2, 5), color,
    });
  }
}

function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (dist(b.x, b.y, ped.x, ped.y) < 14) {
        b.life = 0;
        if (ped.thug) {
          ped.health -= 1;
          if (ped.health <= 0) ped.dead = true;
          addParticles(state, ped.x, ped.y, '#ff5555', 8);
        } else {
          ped.dead = true;
          addParticles(state, ped.x, ped.y, '#ff8888', 10);
          raiseWanted(state, wantedFor('hitPed'));
        }
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

// --- Update -------------------------------------------------------------------
function updatePlayer(state, dt) {
  const p = state.player;
  const k = state.keys;
  if (state.playerCar) {
    const car = state.playerCar;
    const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    const steer = (k['KeyA'] || k['ArrowLeft'] ? -1 : 0) + (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
    if (fwd > 0) car.speed += car.accel * dt;
    else if (fwd < 0) car.speed -= car.accel * 0.9 * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
    car.speed = clamp(car.speed, -car.max * 0.45, car.max);
    const dirSign = car.speed >= 0 ? 1 : -1;
    car.angle += steer * car.turn * dt * dirSign * clamp(Math.abs(car.speed) / 120, 0, 1);
    car.brakeLight = fwd < 0;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 60, WORLD_W - 60);
    car.y = clamp(car.y, 60, WORLD_H - 60);
    // Building collision: slide along walls, damage on hard hits.
    const push = collideBuildings(car.x, car.y, car.len / 2 - 4, state.city.buildings);
    if (push.x || push.y) {
      const impact = Math.abs(car.speed);
      car.x += push.x; car.y += push.y;
      if (impact > 180) {
        car.damage += impact * 0.05;
        car.speed *= 0.4;
        state.shake = Math.max(state.shake, 5);
        if (state.audio) state.audio.thud();
        if (car.damage > 30) raiseWanted(state, wantedFor('ram'));
      } else {
        car.speed *= 0.85;
      }
    }
    // Hit pedestrians while driving.
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        addParticles(state, ped.x, ped.y, '#ff8888', 10);
        raiseWanted(state, wantedFor('hitPed'));
        state.shake = Math.max(state.shake, 4);
      } else if (dist(car.x, car.y, ped.x, ped.y) < 40) {
        ped.panic = 1.2;
        ped.angle = Math.atan2(ped.y - car.y, ped.x - car.x);
      }
    }
    // Car wrecked?
    if (car.damage >= 100) {
      addParticles(state, car.x, car.y, '#555', 24);
      showDialog(state, 'Mobil hancur! Keluar dan cari kendaraan lain.', 4);
      exitCar(state);
      state.traffic = state.traffic.filter((v) => v !== car);
    }
    if (state.audio) state.audio.setEngine(true, Math.abs(car.speed) / car.max);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
  } else {
    let mx = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
    let my = (k['KeyS'] || k['ArrowDown'] ? 1 : 0) - (k['KeyW'] || k['ArrowUp'] ? 1 : 0);
    const len = Math.hypot(mx, my);
    p.moving = len > 0;
    if (len > 0) {
      mx /= len; my /= len;
      const sp = 230;
      p.x += mx * sp * dt;
      p.y += my * sp * dt;
      p.angle = Math.atan2(my, mx);
      p.speed = sp;
      const push = collideBuildings(p.x, p.y, 12, state.city.buildings);
      p.x += push.x; p.y += push.y;
    } else p.speed = 0;
    p.x = clamp(p.x, 30, WORLD_W - 30);
    p.y = clamp(p.y, 30, WORLD_H - 30);
    if (state.audio) state.audio.setEngine(false, 0);
  }
}

function updateCamera(state, dt) {
  const p = state.player;
  const tx = clamp(p.x, VIEW_W / 2, WORLD_W - VIEW_W / 2);
  const ty = clamp(p.y, VIEW_H / 2, WORLD_H - VIEW_H / 2);
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 6);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 6);
}

function update(state, dt) {
  state.time += dt;
  state.hour = (state.hour + dt / 240) % 24; // a full day in 4 minutes of play
  state.shake = Math.max(0, state.shake - dt * 30);
  state.punchTimer = Math.max(0, state.punchTimer - dt);
  state.shootCooldown = Math.max(0, state.shootCooldown - dt);
  if (state.busted) {
    if (state.time - state.bustedAt > 2.2) {
      state.busted = false;
      state.cash = Math.max(0, state.cash - 200);
      state.wanted = 0;
      state.police = [];
      state.player.x = avenueX(6); state.player.y = streetY(4);
      if (state.playerCar) { state.playerCar = null; }
      state.player.health = 100;
      if (state.audio) state.audio.setSiren(false);
      saveGame(state);
    }
    return;
  }
  if (state.wasted) {
    if (state.time - state.wastedAt > 2.2) {
      state.wasted = false;
      state.cash = Math.max(0, state.cash - 150);
      state.wanted = Math.max(0, state.wanted - 1);
      state.player.x = avenueX(6); state.player.y = streetY(4);
      state.player.health = 100;
      if (state.playerCar) state.playerCar = null;
      saveGame(state);
    }
    return;
  }
  updatePlayer(state, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateMissions(state, dt);
  updateTaxi(state, dt);
  updateBullets(state, dt);
  // Particles.
  for (const pt of state.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  // Keep the crowd topped up near the player.
  if (state.peds.length < 30 && Math.random() < dt * 2) state.peds.push(spawnPed(state));
  if (state.traffic.filter((v) => v.traffic).length < 12 && Math.random() < dt * 1.5) {
    state.traffic.push(spawnTrafficCar(state));
  }
  // Police presence follows the wanted level.
  const wantCops = state.wanted === 0 ? 0 : Math.min(2 + state.wanted, 6);
  if (state.police.length < wantCops) state.police.push(spawnPolice(state));
  if (state.wanted === 0 && state.police.length > 0) state.police = [];
  // Thugs chase the player during the fight step.
  const ms = state.missions;
  if (ms.active) {
    const step = currentStep(ms);
    if (step && step.kind === 'fight') {
      for (const id of ms.enemies) {
        const e = state.peds.find((x) => x.id === id);
        if (!e || e.dead) continue;
        const a = Math.atan2(state.player.y - e.y, state.player.x - e.x);
        e.angle = a;
        const d = dist(e.x, e.y, state.player.x, state.player.y);
        if (d > 26) { e.x += Math.cos(a) * 90 * dt; e.y += Math.sin(a) * 90 * dt; }
        else if (Math.random() < dt * 1.2) {
          state.player.health -= 6;
          state.shake = Math.max(state.shake, 3);
          if (state.audio) state.audio.thud();
        }
      }
    }
  }
  if (state.player.health <= 0) {
    state.wasted = true;
    state.wastedAt = state.time;
    if (state.audio) state.audio.busted();
  }
  updateCamera(state, dt);
  state.missionObjectiveText = missionObjectiveText(ms);
  // Autosave every ~20 seconds of play.
  if (Math.floor(state.time) % 20 === 0 && Math.random() < dt) saveGame(state);
}

// --- Input --------------------------------------------------------------------
function bindInput(state, canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    state.keys[e.code] = true;
    if (e.code === 'Enter' && !state.started) { startGame(state); return; }
    if (!state.started) return;
    if (e.code === 'KeyP') state.paused = !state.paused;
    if (e.code === 'KeyH') state.help = !state.help;
    if (e.code === 'KeyN' && state.audio) state.audio.toggleMute();
    if (e.code === 'KeyM') {
      if (!state.missions.active) startMission(state);
    }
    if (e.code === 'KeyR' && state.paused) { loadSave(state); state.paused = false; }
    if (e.code === 'KeyE') {
      if (state.playerCar) exitCar(state);
      else if (!tryInteract(state)) {
        const car = nearestCar(state, 70);
        if (car) enterCar(state, car);
      }
    }
    if (e.code === 'Space') {
      if (!state.playerCar) punch(state);
      e.preventDefault();
    }
    if (e.code === 'KeyT' && state.audio) state.audio.horn();
  });
  window.addEventListener('keyup', (e) => { state.keys[e.code] = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (!state.started) { startGame(state); return; }
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = (e.clientX - rect.left) * (VIEW_W / rect.width);
    state.mouse.y = (e.clientY - rect.top) * (VIEW_H / rect.height);
    shoot(state);
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = (e.clientX - rect.left) * (VIEW_W / rect.width);
    state.mouse.y = (e.clientY - rect.top) * (VIEW_H / rect.height);
  });
}

function startGame(state) {
  state.started = true;
  if (!state.audio) state.audio = new AudioEngine();
  state.audio.ensure();
  state.audio.resume();
  loadSave(state);
  state.camera.x = clamp(state.player.x, VIEW_W / 2, WORLD_W - VIEW_W / 2);
  state.camera.y = clamp(state.player.y, VIEW_H / 2, WORLD_H - VIEW_H / 2);
}

// --- Debug scene API (used by the screenshot maker) ---------------------------
export function installDebugApi(state) {
  window.__SOLMAR__ = {
    state,
    start() { startGame(state); return 'started'; },
    started() { return state.started; },
    scene(name) { return applyScene(state, name); },
    setHour(h) { state.hour = h; return state.hour; },
    setWanted(n) { state.wanted = n; ensurePolice(state); if (state.audio) state.audio.setSiren(n > 0); return n; },
    setRain(r) { state.rain = r; return r; },
    teleport(x, y) { state.player.x = x; state.player.y = y; state.camera.x = x; state.camera.y = y; return [x, y]; },
    giveCar(type) {
      const car = makeVehicle(type || 'sports', state.player.x + 60, state.player.y, 0, {});
      state.traffic.push(car);
      enterCar(state, car);
      return car.type;
    },
    mission(n) { state.missions.index = (n || 1) - 1; state.missions.active = false; return startMission(state); },
    dialog(text, seconds) { showDialog(state, text, seconds || 8); return true; },
    spawnCops(n) { for (let i = 0; i < (n || 3); i++) state.police.push(spawnPolice(state)); return state.police.length; },
    spawnTraffic(n) { for (let i = 0; i < (n || 6); i++) state.traffic.push(spawnTrafficCar(state)); return state.traffic.length; },
    errors() { return window.__SOLMAR_ERRORS__ || []; },
  };
  window.__SOLMAR_ERRORS__ = [];
  window.addEventListener('error', (e) => window.__SOLMAR_ERRORS__.push(String(e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => window.__SOLMAR_ERRORS__.push('rejection: ' + String(e.reason)));
}

function applyScene(state, name) {
  const p = state.player;
  // Fresh mission + fresh dialog for every scene: no stale text from the last one.
  state.missions.dialog = null;
  if (name === 'chase-dusk') {
    state.hour = 17.8; state.rain = 0;
    if (!state.playerCar) {
      const car = makeVehicle('sports', avenueX(6), streetY(4) + 16, 0, { color: '#e67e22' });
      state.traffic.push(car);
      enterCar(state, car);
    }
    state.playerCar.speed = 260;
    state.wanted = 3;
    state.police = [];
    for (let i = 0; i < 3; i++) state.police.push(spawnPolice(state));
    // Chase pack staged behind the player car, not on top of it yet.
    state.police[0].x = state.playerCar.x - 260; state.police[0].y = state.playerCar.y + 12; state.police[0].angle = 0; state.police[0].speed = 180;
    state.police[1].x = state.playerCar.x - 380; state.police[1].y = state.playerCar.y - 24; state.police[1].angle = 0; state.police[1].speed = 180;
    state.police[2].x = state.playerCar.x + 300; state.police[2].y = state.playerCar.y - 16; state.police[2].angle = Math.PI; state.police[2].speed = 120;
    for (let i = 0; i < 5; i++) state.traffic.push(spawnTrafficCar(state));
    state.missions.active = false; state.missions.index = 1; startMission(state);
    state.camera.x = state.playerCar.x; state.camera.y = state.playerCar.y;
    return 'chase-dusk';
  }
  if (name === 'mission-combat') {
    state.hour = 13; state.rain = 0;
    state.wanted = 1;
    if (state.playerCar) exitCar(state);
    p.x = avenueX(5) + 40; p.y = streetY(4) - 40; p.angle = 0;
    state.camera.x = p.x; state.camera.y = p.y;
    state.missions.active = false; state.missions.index = 1;
    startMission(state);
    // A thug to fight, plus a cop and crowd on the street.
    spawnThugNear(state, p.x + 80, p.y + 20);
    for (let i = 0; i < 4; i++) state.peds.push(makePed(p.x + rand(-160, 160), p.y + rand(-120, 120)));
    state.police = [spawnPolice(state)];
    state.police[0].x = p.x + 300; state.police[0].y = p.y + 60;
    return 'mission-combat';
  }
  if (name === 'night-rain') {
    state.hour = 22.5; state.rain = 1;
    if (!state.playerCar) {
      const car = makeVehicle('sedan', avenueX(7), streetY(5) + 16, 0, {});
      state.traffic.push(car);
      enterCar(state, car);
    }
    state.playerCar.speed = 200;
    state.wanted = 0;
    state.camera.x = state.playerCar.x; state.camera.y = state.playerCar.y;
    for (let i = 0; i < 7; i++) state.traffic.push(spawnTrafficCar(state));
    showDialog(state, 'VICE HARBOR, 22:30 — hujan, lampu kota, lalu lintas malam.', 6);
    return 'night-rain';
  }
  if (name === 'walk-day') {
    state.hour = 10.5; state.rain = 0;
    if (state.playerCar) exitCar(state);
    p.x = avenueX(6) + 44; p.y = streetY(3) + 44; p.angle = Math.PI / 4;
    state.camera.x = p.x; state.camera.y = p.y;
    state.wanted = 1;
    state.police = [];
    for (let i = 0; i < 8; i++) state.peds.push(makePed(p.x + rand(-260, 260), p.y + rand(-180, 180)));
    state.missions.active = false; state.missions.index = 0; startMission(state);
    return 'walk-day';
  }
  return 'unknown scene: ' + name;
}

function spawnThugNear(state, x, y) {
  const e = makePed(x, y);
  e.thug = true; e.health = 3; e.shirt = '#222222';
  state.peds.push(e);
  state.missions.enemies.push(e.id);
  return e;
}

// --- Boot -----------------------------------------------------------------------
export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = createState();
  seedWorld(state);
  bindInput(state, canvas);
  installDebugApi(state);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.started && !state.paused && !state.help) update(state, dt);
    else state.time += dt;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (!state.started) drawStartScreen(ctx, state);
    else {
      drawWorld(ctx, state);
      drawHUD(ctx, state);
      if (state.paused) drawPauseScreen(ctx, state);
      if (state.help) drawHelpScreen(ctx, state);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return state;
}

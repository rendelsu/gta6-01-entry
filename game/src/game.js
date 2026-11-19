// SOLMAR — Vice Harbor: game state, input, wanted level, combat, stealing,
// mission flow, taxi fares and saving. The render module only draws this.
import { clamp, dist, angleDiff, turnToward, makeRng, fmtMoney } from './util.js';
import {
  WORLD_W, WORLD_H, avenueX, streetY, districtAt, buildCity, clampToWorld,
} from './city.js';
import {
  VEHICLE_TYPES, makeVehicle, spawnTraffic, spawnPedestrians,
  updateTraffic, updatePedestrians, updatePolice, spawnPolice,
} from './entities.js';
import { makeAudio } from './audio.js';
import { makeMissions, missionState, startMission, currentStep, advanceStep, offerFare } from './missions.js';
import { daylight } from './render.js';

const SAVE_KEY = 'solmar-vice-harbor-save-v1';

export function createGame() {
  const rng = makeRng(987654321);
  const city = buildCity();
  const missions = makeMissions();
  const ms = missionState();
  const audio = makeAudio();
  const startX = avenueX(2);
  const startY = streetY(7);
  const state = {
    city,
    cityDistricts: [
      { name: 'Old Harbor', x0: 0, y0: 1920, x1: 1280, y1: 2880, base: '#3d5a66' },
      { name: 'Marina Bay', x0: 1280, y0: 1920, x1: 2560, y1: 2880, base: '#2e6f7a' },
      { name: 'Eastside', x0: 2560, y0: 1920, x1: 3840, y1: 2880, base: '#6b4a3a' },
      { name: 'Downtown', x0: 1280, y0: 640, x1: 2560, y1: 1920, base: '#4a4a58' },
      { name: 'North Hills', x0: 0, y0: 0, x1: 3840, y1: 640, base: '#3f5a3a' },
    ],
    missions, ms, audio, rng,
    player: {
      x: startX, y: startY, angle: -Math.PI / 2, health: 100,
      inCar: null, hasGun: false, ramCooldown: 0, punchCooldown: 0,
      shootCooldown: 0, walkPhase: 0,
    },
    traffic: spawnTraffic(26, rng, startX, startY),
    peds: spawnPedestrians(34, rng, startX, startY),
    police: [],
    thugs: [],
    effects: [],
    wanted: 0,
    wantedHeat: 0,
    cash: 120,
    debt: 10000,
    missionsDone: 0,
    hour: 17.6,
    rain: 0,
    screen: 'start',
    paused: false,
    storyDone: false,
    busted: false,
    camera: { x: startX - 640, y: startY - 360 },
    keys: {},
    mouse: { x: 640, y: 360, down: false },
    time: 0,
    hideT: 0,
    saveT: 0,
    shotMode: null,
  };
  loadSave(state);
  return state;
}

export function saveGame(s) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: s.cash, debt: s.debt, missionsDone: s.missionsDone,
      hasGun: s.player.hasGun, index: s.ms.index,
    }));
  } catch (e) {}
}

export function loadSave(s) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (typeof d.cash === 'number') s.cash = d.cash;
    if (typeof d.debt === 'number') s.debt = d.debt;
    if (typeof d.missionsDone === 'number') s.missionsDone = d.missionsDone;
    if (d.hasGun) s.player.hasGun = true;
    if (typeof d.index === 'number') s.ms.index = Math.min(d.index, 4);
  } catch (e) {}
}

export function addWanted(s, n) {
  s.wanted = clamp(s.wanted + n, 0, 5);
  s.wantedHeat = 6;
  syncPolice(s);
}

export function syncPolice(s) {
  const want = s.wanted === 0 ? 0 : s.wanted + 1;
  while (s.police.length < want) {
    s.police.push(...spawnPolice(1, s.player.x, s.player.y, s.rng));
  }
  while (s.police.length > want) {
    const gone = s.police.pop();
    if (gone && gone.policeChase === true) { /* removed */ }
  }
  s.audio.siren(s.police.length > 0);
}

function nearestCar(s, maxD) {
  let best = null;
  let bestD = maxD;
  const all = s.traffic.concat(s.police);
  for (const c of all) {
    const d = dist(s.player.x, s.player.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function tryEnterCar(s) {
  const pl = s.player;
  if (pl.inCar) {
    const car = pl.inCar;
    pl.inCar = null;
    pl.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    pl.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    pl.angle = car.angle;
    // The car stays in the world so the player can get back in.
    if (car.police) s.police.push(car);
    else s.traffic.push(car);
    s.audio.engine(false, 0);
    s.audio.click();
    return 'exit';
  }
  const car = nearestCar(s, 70);
  if (!car) return null;
  if (car.police) {
    addWanted(s, 2);
    s.ms.banner = 'You stole a VHPD cruiser!';
    s.ms.bannerT = 3;
  } else if (car.driver) {
    car.driver = false;
    addWanted(s, 1);
    s.ms.banner = 'Car stolen — the owner called the VHPD!';
    s.ms.bannerT = 3;
  }
  pl.inCar = car;
  car.speed = 0;
  s.traffic = s.traffic.filter((c) => c !== car);
  s.police = s.police.filter((c) => c !== car);
  s.audio.click();
  // Mission 1 needs the taxi specifically.
  const step = currentStep(s.ms, s.missions);
  if (step && step.type === 'enterTaxi' && car.taxi) {
    advanceStep(s.ms, s.missions, s.audio);
  }
  // Mission 3 needs the red coupe at the docks.
  if (step && step.type === 'stealCoupe' && car.type === 'coupe') {
    if (s.missions[s.ms.index].wantedOnSteal) addWanted(s, s.missions[s.ms.index].wantedOnSteal);
    advanceStep(s.ms, s.missions, s.audio);
  }
  return 'enter';
}

function shoot(s) {
  const pl = s.player;
  if (!pl.hasGun || pl.shootCooldown > 0 || pl.inCar) return;
  pl.shootCooldown = 0.35;
  s.audio.gunshot();
  const tx = s.camera.x + s.mouse.x;
  const ty = s.camera.y + s.mouse.y;
  const a = Math.atan2(ty - pl.y, tx - pl.x);
  pl.angle = a;
  s.effects.push({ x: pl.x + Math.cos(a) * 22, y: pl.y + Math.sin(a) * 22, size: 7, color: '#ffe14a', life: 0.12, max: 0.12 });
  let hit = null;
  let bestD = 520;
  for (const t of s.thugs) {
    const d = dist(pl.x, pl.y, t.x, t.y);
    if (d < bestD && Math.abs(angleDiff(a, Math.atan2(t.y - pl.y, t.x - pl.x))) < 0.25) {
      bestD = d; hit = t;
    }
  }
  if (hit) {
    hit.health -= 34;
    s.effects.push({ x: hit.x, y: hit.y, size: 10, color: '#ff5a5a', life: 0.25, max: 0.25 });
    if (hit.health <= 0) {
      s.thugs = s.thugs.filter((t) => t !== hit);
      s.ms.combatLeft--;
      s.audio.crash();
      checkCombatDone(s);
    }
  } else {
    addWanted(s, 0);
    s.wantedHeat = Math.max(s.wantedHeat, 3);
    if (s.wanted === 0) addWanted(s, 1);
  }
}

function punch(s) {
  const pl = s.player;
  if (pl.punchCooldown > 0 || pl.inCar) return;
  pl.punchCooldown = 0.4;
  s.audio.punch();
  let hit = null;
  let bestD = 46;
  for (const t of s.thugs) {
    const d = dist(pl.x, pl.y, t.x, t.y);
    if (d < bestD) { bestD = d; hit = t; }
  }
  if (hit) {
    hit.health -= 20;
    if (hit.health <= 0) {
      s.thugs = s.thugs.filter((t) => t !== hit);
      s.ms.combatLeft--;
      checkCombatDone(s);
    }
  }
}

function checkCombatDone(s) {
  const step = currentStep(s.ms, s.missions);
  if (step && step.type === 'combat' && s.ms.combatLeft <= 0 && s.thugs.length === 0) {
    const done = advanceStep(s.ms, s.missions, s.audio);
    if (!done) {
      const next = currentStep(s.ms, s.missions);
      if (next && next.type === 'combat') startCombatWave(s, next.wave);
    } else {
      finishMission(s);
    }
  }
}

function startCombatWave(s, wave) {
  s.ms.combatWave = wave;
  const gx = avenueX(5);
  const gy = streetY(4);
  const n = 2 + wave;
  s.thugs = [];
  for (let i = 0; i < n; i++) {
    const a = s.rng() * Math.PI * 2;
    s.thugs.push({
      kind: 'thug', x: gx + Math.cos(a) * (160 + s.rng() * 120),
      y: gy + Math.sin(a) * (160 + s.rng() * 120),
      angle: 0, speed: 95 + wave * 12, health: 60, shootT: 1 + s.rng() * 2,
      color: '#3a2a2a', walkPhase: 0,
    });
  }
  s.ms.combatLeft = n;
  s.ms.banner = 'WAVE ' + wave + ' — ' + n + ' thugs incoming!';
  s.ms.bannerT = 3;
}

function finishMission(s) {
  const m = s.missions[s.ms.index];
  s.cash += m.reward;
  s.debt = m.debtAfter;
  s.missionsDone++;
  if (m.givesGun) s.player.hasGun = true;
  s.ms.index++;
  if (s.ms.index >= s.missions.length) {
    s.storyDone = true;
    s.screen = 'over';
    s.ms.banner = null;
  }
  saveGame(s);
}

function updateThugs(s, dt) {
  const pl = s.player;
  for (const t of s.thugs) {
    t.walkPhase += dt * 8;
    const d = dist(t.x, t.y, pl.x, pl.y);
    const a = Math.atan2(pl.y - t.y, pl.x - t.x);
    t.angle = a;
    if (d > 260) {
      t.x += Math.cos(a) * t.speed * dt;
      t.y += Math.sin(a) * t.speed * dt;
    } else if (d > 60) {
      t.x += Math.cos(a) * t.speed * 0.7 * dt;
      t.y += Math.sin(a) * t.speed * 0.7 * dt;
    } else {
      // Close range: thug punches the player.
      t.shootT -= dt;
      if (t.shootT <= 0) {
        t.shootT = 1.1;
        pl.health -= 7;
        s.audio.punch();
        s.effects.push({ x: pl.x, y: pl.y, size: 9, color: '#ff8a5a', life: 0.2, max: 0.2 });
      }
    }
  }
}

export function update(s, dt) {
  s.time += dt;
  const pl = s.player;
  if (s.screen !== 'play' || s.paused) return;
  // Clock: one game hour per 100 real seconds.
  s.hour = (s.hour + dt / 100) % 24;
  if (s.ms.bannerT > 0) s.ms.bannerT -= dt;
  if (pl.ramCooldown > 0) pl.ramCooldown -= dt;
  if (pl.punchCooldown > 0) pl.punchCooldown -= dt;
  if (pl.shootCooldown > 0) pl.shootCooldown -= dt;
  if (s.ms.dialogT !== undefined) s.ms.dialogT += dt;

  // --- Player movement ---
  const k = s.keys;
  if (pl.inCar) {
    const car = pl.inCar;
    const fwd = (k['arrowup'] || k['w'] ? 1 : 0) - (k['arrowdown'] || k['s'] ? 1 : 0);
    const steer = (k['arrowleft'] || k['a'] ? -1 : 0) + (k['arrowright'] || k['d'] ? 1 : 0);
    if (fwd !== 0) {
      car.speed += fwd * car.accel * dt;
      car.speed = clamp(car.speed, -car.top * 0.45, car.top);
    } else {
      car.speed *= Math.pow(0.4, dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * car.turn * dt * clamp(Math.abs(car.speed) / 60, 0, 1) * dir;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const c = clampToWorld(car.x, car.y);
    if (c.x !== car.x || c.y !== car.y) { car.speed *= -0.3; s.audio.crash(); }
    car.x = c.x; car.y = c.y;
    pl.x = car.x; pl.y = car.y; pl.angle = car.angle;
    s.audio.engine(true, Math.abs(car.speed) / car.top);
    // Crash into traffic?
    for (const o of s.traffic) {
      if (dist(car.x, car.y, o.x, o.y) < 44 && Math.abs(car.speed) > 120 && pl.ramCooldown <= 0) {
        pl.ramCooldown = 0.6;
        o.speed = car.speed * 0.4;
        o.angle = Math.atan2(o.y - car.y, o.x - car.x);
        car.speed *= 0.55;
        s.audio.crash();
        s.effects.push({ x: o.x, y: o.y, size: 12, color: '#ffb85a', life: 0.3, max: 0.3 });
        addWanted(s, 0);
        if (s.wanted === 0 && s.rng() < 0.5) addWanted(s, 1);
      }
    }
    // Police ram damage.
    for (const pc of s.police) {
      if (dist(car.x, car.y, pc.x, pc.y) < 48 && pl.ramCooldown <= 0) {
        pl.ramCooldown = 0.8;
        pl.health -= 4;
        car.speed *= 0.7;
        s.audio.crash();
      }
    }
    // Running over pedestrians is a crime.
    for (const p of s.peds) {
      if (dist(car.x, car.y, p.x, p.y) < 26 && Math.abs(car.speed) > 60) {
        p.panic = 3;
        addWanted(s, 1);
        s.audio.crash();
      }
    }
  } else {
    const mx = (k['arrowright'] || k['d'] ? 1 : 0) - (k['arrowleft'] || k['a'] ? 1 : 0);
    const my = (k['arrowdown'] || k['s'] ? 1 : 0) - (k['arrowup'] || k['w'] ? 1 : 0);
    const sp = 210;
    if (mx !== 0 || my !== 0) {
      const len = Math.sqrt(mx * mx + my * my);
      pl.x += (mx / len) * sp * dt;
      pl.y += (my / len) * sp * dt;
      pl.angle = Math.atan2(my, mx);
      pl.walkPhase += dt * 10;
    }
    const c = clampToWorld(pl.x, pl.y);
    pl.x = c.x; pl.y = c.y;
    s.audio.engine(false, 0);
    if (s.mouse.down) shoot(s);
  }

  // --- Traffic, pedestrians, police ---
  updateTraffic(s.traffic, dt, s.rng, pl);
  updatePedestrians(s.peds, dt, s.rng, pl.inCar ? pl.inCar : pl);
  if (s.police.length > 0) updatePolice(s.police, dt, pl, s.rng);
  updateThugs(s, dt);

  // Wanted decay: hide from the VHPD and the heat cools off.
  if (s.wanted > 0) {
    const nearest = s.police.reduce((m, c) => Math.min(m, dist(c.x, c.y, pl.x, pl.y)), Infinity);
    if (nearest > 700) {
      s.hideT += dt;
      if (s.hideT > 5) {
        s.wanted--;
        s.hideT = 0;
        syncPolice(s);
        s.ms.banner = 'Heat cooling off… wanted ' + s.wanted;
        s.ms.bannerT = 2;
      }
    } else {
      s.hideT = 0;
    }
  }
  if (s.wantedHeat > 0) s.wantedHeat -= dt;

  // Busted: a cop catches you on foot at wanted 3+.
  if (!pl.inCar && s.wanted >= 3) {
    for (const pc of s.police) {
      if (dist(pc.x, pc.y, pl.x, pl.y) < 42) {
        s.busted = true;
        s.screen = 'over';
        s.audio.fail();
        s.audio.siren(false);
        return;
      }
    }
  }
  if (pl.health <= 0) {
    pl.health = 0;
    s.busted = true;
    s.screen = 'over';
    s.audio.fail();
    s.audio.siren(false);
    return;
  }

  // --- Mission step checks ---
  const step = currentStep(s.ms, s.missions);
  if (step) {
    if (step.type === 'goto') {
      if (dist(pl.x, pl.y, step.x, step.y) < step.r) {
        const done = advanceStep(s.ms, s.missions, s.audio);
        if (done) finishMission(s);
        else {
          const nx = currentStep(s.ms, s.missions);
          if (nx && nx.type === 'combat') startCombatWave(s, nx.wave);
        }
      }
    } else if (step.type === 'escape') {
      if (s.wanted === 0) {
        const done = advanceStep(s.ms, s.missions, s.audio);
        if (done) finishMission(s);
      }
    }
  }

  // --- Taxi fare ---
  const fare = s.ms.taxiFare;
  if (fare) {
    if (fare.stage === 'pickup' && dist(pl.x, pl.y, fare.px, fare.py) < 80) {
      fare.stage = 'drop';
      s.ms.banner = 'Passenger aboard — take them to ' + fare.dname;
      s.ms.bannerT = 3;
      s.audio.pickup();
    } else if (fare.stage === 'drop' && dist(pl.x, pl.y, fare.dx, fare.dy) < 80) {
      s.cash += fare.pay;
      s.ms.banner = 'Fare complete: +' + fmtMoney(fare.pay);
      s.ms.bannerT = 3;
      s.ms.taxiFare = null;
      s.audio.cash();
      saveGame(s);
    }
  }

  // --- Effects + camera ---
  for (const e of s.effects) e.life -= dt;
  s.effects = s.effects.filter((e) => e.life > 0);
  const tx = clamp(pl.x - 640, 0, WORLD_W - 1280);
  const ty = clamp(pl.y - 360, 0, WORLD_H - 720);
  s.camera.x += (tx - s.camera.x) * Math.min(1, dt * 5);
  s.camera.y += (ty - s.camera.y) * Math.min(1, dt * 5);

  s.saveT += dt;
  if (s.saveT > 10) { s.saveT = 0; saveGame(s); }
}

// Derived display strings, recomputed each frame by main.js.
export function deriveDisplay(s) {
  s.cashText = fmtMoney(s.cash);
  s.debtText = fmtMoney(s.debt);
  const d = districtAt(s.player.x, s.player.y);
  s.districtName = d.name;
  const dl = daylight(s.hour);
  const hh = Math.floor(s.hour);
  const mm = Math.floor((s.hour - hh) * 60);
  s.timeText = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ' ' + dl.name;
  const step = currentStep(s.ms, s.missions);
  s.currentStep = step;
  s.missionTitle = s.ms.index < s.missions.length ? 'M' + s.missions[s.ms.index].id : '';
  s.objectiveText = null;
  if (s.ms.active && step) {
    s.objectiveText = 'M' + s.missions[s.ms.index].id + ' — ' + step.text;
  } else if (!s.ms.active && !s.storyDone) {
    s.objectiveText = 'Press M to start Mission ' + (s.ms.index + 1);
  }
  if (s.ms.taxiFare) {
    const f = s.ms.taxiFare;
    s.objectiveText = (s.objectiveText ? s.objectiveText + '   •   ' : '') +
      'FARE: ' + (f.stage === 'pickup' ? 'pick up in ' + f.pname : 'drop off in ' + f.dname);
  }
}

export function handleKey(s, code, down) {
  const key = code.toLowerCase().replace('key', '');
  if (down) s.keys[key] = true;
  else delete s.keys[key];
  if (!down) return;
  if (s.screen === 'start' && (code === 'Enter' || code === 'Space')) {
    startPlay(s);
    return;
  }
  if (s.screen === 'over' && code === 'KeyR') {
    resetRun(s);
    return;
  }
  if (s.screen !== 'play') return;
  if (s.ms.dialog) {
    if (code === 'Enter' || code === 'Space') s.ms.dialog = null;
    return;
  }
  if (code === 'KeyE') tryEnterCar(s);
  if (code === 'KeyF') punch(s);
  if (code === 'KeyM') {
    if (!s.ms.active && s.ms.index < s.missions.length) {
      const w = startMission(s.ms, s.missions, s.audio);
      if (w) addWanted(s, w);
      const step = currentStep(s.ms, s.missions);
      if (step && step.type === 'combat') startCombatWave(s, step.wave);
    }
  }
  if (code === 'KeyN' && !s.ms.taxiFare) offerFare(s, s.rng);
  if (code === 'KeyP') s.paused = !s.paused;
  if (code === 'KeyH') {
    s.ms.banner = 'WASD move • E steal car • F punch • Click shoot • M mission • N fare';
    s.ms.bannerT = 5;
  }
  if (code === 'KeyR' && s.rain === 0) s.rain = 1;
  else if (code === 'KeyR' && s.rain > 0) s.rain = 0;
}

export function startPlay(s) {
  s.screen = 'play';
  s.audio.unlock();
  s.audio.startMusic();
  s.ms.banner = 'Welcome to Vice Harbor — press M to start Mission 1';
  s.ms.bannerT = 4;
}

export function resetRun(s) {
  const keepCash = s.cash;
  s.player.health = 100;
  s.player.x = avenueX(2);
  s.player.y = streetY(7);
  s.player.inCar = null;
  s.wanted = 0;
  s.police = [];
  s.thugs = [];
  s.busted = false;
  s.storyDone = false;
  s.screen = 'play';
  s.audio.siren(false);
  s.cash = keepCash;
  saveGame(s);
}

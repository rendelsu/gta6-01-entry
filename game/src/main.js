// SOLMAR — Vice Harbor. Main loop, game state and the wiring between systems.
// Fixed timestep (60 Hz) decoupled from rendering; one state object (G) that
// every system reads and writes; nothing is allocated in the hot loop.
import { DT, VIEW_W, VIEW_H, WORLD_W, WORLD_H, LANDMARKS, HIDDEN_PACKAGES, GAME_TITLE, PLAYER_SPAWN } from './config.js';
import { mulberry32, clamp, dist } from './random.js';
import { generateCity } from './city.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { makePlayer, updatePlayer } from './player.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds, updatePolice, updateOfficers, updateParticles } from './entities.js';
import { firePistol, updateBullets, updateEnemies, updateWanted } from './combat.js';
import { MISSIONS, startMission, updateMission, currentObjective, currentWaypoint } from './missions.js';
import { initGround, drawWorld } from './render.js';
import { initMinimap, drawHUD, drawTitle, drawPause, drawEndScreen } from './hud.js';
import { saveGame, loadSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(location.search);
const shotParam = params.get('shot');
const shotNum = shotParam ? parseInt(shotParam, 10) : 0;

// --- The one state object ---------------------------------------------------
const G = {
  mode: 'title', // title | playing | paused | busted | wasted
  time: 0,
  playSeconds: 0,
  rng: mulberry32(20261117),
  city: null,
  groundTiles: null,
  gradeCanvas: null,
  minimapCanvas: null,
  input: new Input(canvas),
  audio: new AudioSys(),
  player: makePlayer(PLAYER_SPAWN.x, PLAYER_SPAWN.y),
  cars: [], peds: [], cops: [], officers: [], enemies: [],
  bullets: [], particles: [], skids: [],
  pickups: [],
  packagesLeft: HIDDEN_PACKAGES.map((p) => ({ ...p })),
  packages: 0,
  cash: 150,
  health: 100,
  armor: 0,
  ammo: 60,
  weapon: 'pistol',
  wanted: 0,
  wantedTimer: 0,
  policeSpawnTimer: 0,
  officerSpawnTimer: 0,
  gunfireTimer: 0,
  mission: null,
  missionIndex: 0,
  missionsDone: 0,
  missionOffer: 0,
  missionBanner: null,
  taxi: null,
  stats: { carsStolen: 0, fares: 0, kills: 0, pedsHit: 0, carsWrecked: 0 },
  camera: { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, zoom: 1.0 },
  shake: 0,
  damageFlash: 0,
  flash: null,
  waypoint: null,
  objectiveText: '',
  menuIndex: 0,
  menuHelp: false,
  hasSave: false,
  showMissions: false,
  shotMode: 0,
  shotTicks: 0,
};

G.flashMessage = (text, color = '#ffe9a8') => { G.flash = { text, color, t: 2.6 }; };

function spawnPickups() {
  G.pickups = [
    { x: 700, y: 700, type: 'health', respawn: 0 },
    { x: 1600, y: 1500, type: 'armor', respawn: 0 },
    { x: 1280, y: 700, type: 'ammo', respawn: 0 },
    { x: 480, y: 1760, type: 'health', respawn: 0 },
    { x: 2080, y: 1120, type: 'ammo', respawn: 0 },
    { x: 1120, y: 2080, type: 'armor', respawn: 0 },
  ];
}

function resetWorld() {
  G.city = generateCity(20261117);
  initGround(G);
  initMinimap(G);
  spawnTraffic(G, 18);
  spawnPeds(G, 30);
  spawnPickups();
  G.cops = [];
  G.officers = [];
  G.enemies = [];
  G.bullets = [];
  G.particles = [];
  G.skids = [];
  G.packagesLeft = HIDDEN_PACKAGES.map((p) => ({ ...p }));
  G.taxi = null;
}

function newGame() {
  G.cash = 150;
  G.health = 100;
  G.armor = 0;
  G.ammo = 60;
  G.missionIndex = 0;
  G.missionsDone = 0;
  G.packages = 0;
  G.stats = { carsStolen: 0, fares: 0, kills: 0, pedsHit: 0, carsWrecked: 0 };
  G.playSeconds = 0;
  G.player = makePlayer(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
  G.wanted = 0;
  resetWorld();
  G.mode = 'playing';
  G.mission = null;
  G.missionOffer = 1; // offered until taken
  G.flashMessage('Welcome to Solmar. Mama Lou has work for you.', '#ffe9a8');
}

function continueGame() {
  const s = loadSave();
  if (!s) { newGame(); return; }
  G.cash = s.cash;
  G.missionIndex = s.missionIndex;
  G.missionsDone = s.missionsDone;
  G.packages = s.packages;
  G.stats = s.stats || G.stats;
  G.playSeconds = s.playSeconds || 0;
  G.player = makePlayer(s.player.x, s.player.y); // saved spot, always a legal one
  G.health = 100;
  G.armor = 0;
  G.ammo = 60;
  G.wanted = 0;
  resetWorld();
  G.mode = 'playing';
  G.mission = null;
  G.missionOffer = 1; // offered until taken
  G.flashMessage('Welcome back to Solmar.', '#ffe9a8');
}

function respawnAfterEnd(kind) {
  const fine = kind === 'busted' ? 150 : 200;
  G.cash = Math.max(0, G.cash - fine);
  G.health = 100;
  G.armor = 0;
  G.wanted = 0;
  G.cops = [];
  G.officers = [];
  G.enemies = [];
  G.player = makePlayer(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
  G.mode = 'playing';
  G.missionOffer = 1; // offered until taken
  saveGame(G);
}

// --- Fixed-step update ------------------------------------------------------

function update(dt) {
  G.time += dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2.2);
  if (G.damageFlash > 0) G.damageFlash = Math.max(0, G.damageFlash - dt * 1.4);
  if (G.gunfireTimer > 0) G.gunfireTimer -= dt;
  if (G.flash) { G.flash.t -= dt; if (G.flash.t <= 0) G.flash = null; }
  if (G.missionBanner) { G.missionBanner.t -= dt; if (G.missionBanner.t <= 0) G.missionBanner = null; }
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);

  if (G.mode === 'title') {
    // The city lives behind the menu.
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updateParticles(G, dt);
    if (G.shotMode) G.shotTicks += 1;
    G.camera.x = 1120 + Math.sin(G.time * 0.05) * 260;
    G.camera.y = 1120 + Math.cos(G.time * 0.04) * 180;
    if (G.shotMode === 4) G.camera.zoom = 0.62;
    const input = G.input;
    const menuCount = G.hasSave ? 3 : 2; // continue, new game, how to play
    if (input.pressed('ArrowUp', 'KeyW')) { G.menuIndex = (G.menuIndex + menuCount - 1) % menuCount; G.audio.blip(500, 0.06); }
    if (input.pressed('ArrowDown', 'KeyS')) { G.menuIndex = (G.menuIndex + 1) % menuCount; G.audio.blip(500, 0.06); }
    if (input.pressed('Enter', 'Space') || input.pressedMouse()) {
      G.audio.resume();
      if (G.menuHelp) { G.menuHelp = false; return; }
      const has = !!loadSave();
      const idx = G.menuIndex;
      if (has && idx === 0) continueGame();
      else if (has && idx === 1) newGame();
      else if (!has && idx === 0) newGame();
      else if (has && idx === 2) G.menuHelp = true;
      else if (!has && idx === 1) G.menuHelp = true;
    }
    if (input.pressed('Escape')) G.menuHelp = false;
    return;
  }

  if (G.mode === 'paused') {
    const input = G.input;
    if (input.pressed('Escape')) G.mode = 'playing';
    if (input.pressed('KeyP')) { if (saveGame(G)) G.flashMessage('Game saved.', '#2ecc71'); }
    if (input.pressed('KeyQ')) { G.mode = 'title'; G.menuIndex = 0; }
    if (input.pressed('KeyN')) G.audio.setMuted(!G.audio.muted);
    return;
  }

  if (G.mode === 'busted' || G.mode === 'wasted') {
    if (G.input.pressed('Enter', 'Space')) respawnAfterEnd(G.mode);
    return;
  }

  // Playing.
  G.playSeconds += dt;
  const input = G.input;
  if (input.pressed('Escape')) { G.mode = 'paused'; return; }
  if (input.pressed('KeyP')) { if (saveGame(G)) G.flashMessage('Game saved.', '#2ecc71'); }
  if (input.pressed('KeyN')) { G.audio.setMuted(!G.audio.muted); G.flashMessage(G.audio.muted ? 'Sound muted' : 'Sound on', '#ecf0f1'); }
  if (input.pressed('KeyM')) G.showMissions = !G.showMissions;
  if (input.pressed('Digit1')) { G.weapon = 'pistol'; }
  if (input.pressed('Digit2')) { G.weapon = 'fists'; }
  if (input.pressed('KeyF') || input.mouseDown) {
    if (G.weapon === 'pistol' && !G.player.inCar) firePistol(G);
    else if (G.weapon === 'fists' && !G.player.inCar) {
      // A punch: short range, knocks a ped down.
      const p = G.player;
      for (const ped of G.peds) {
        if (!ped.dead && dist(p.x, p.y, ped.x, ped.y) < 34) {
          ped.dead = true;
          addWantedCheck(G);
          break;
        }
      }
      p.fireCooldown = 0.35;
    }
  }
  if (input.pressed('KeyH') && G.player.inCar) G.audio.honk();

  updatePlayer(G, dt);
  if (G.shotMode === 3) {
    // Staged shootout: Danny keeps firing at the nearest guard so the
    // screenshot catches muzzle flashes and bullets in the air.
    const foes = G.enemies.filter((e) => !e.dead);
    if (foes.length) {
      const f = foes[0];
      const aim = Math.atan2(f.y - G.player.y, f.x - G.player.x);
      G.player.aimAngle = aim;
      G.player.angle = aim;
      if (G.player.fireCooldown <= 0) firePistol(G);
    }
  }
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateOfficers(G, dt);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updateParticles(G, dt);
  updateMission(G, dt);
  updateWanted(G, dt);

  // Pickups.
  for (const pk of G.pickups) {
    if (pk.respawn > 0) { pk.respawn -= dt; continue; }
    if (dist(G.player.x, G.player.y, pk.x, pk.y) < 32) {
      if (pk.type === 'health') { G.health = Math.min(100, G.health + 50); G.flashMessage('Health +50', '#2ecc71'); }
      if (pk.type === 'armor') { G.armor = Math.min(100, G.armor + 50); G.flashMessage('Armor +50', '#3498db'); }
      if (pk.type === 'ammo') { G.ammo += 30; G.flashMessage('Ammo +30', '#f39c12'); }
      G.audio.pickup();
      pk.respawn = 45;
    }
  }

  // Camera follows the player, leading a little with velocity.
  const p = G.player;
  const lead = p.inCar && p.car ? clamp(Math.abs(p.car.speed) / 500, 0, 1) * 60 : 0;
  const tx = p.x + Math.cos(p.angle) * lead;
  const ty = p.y + Math.sin(p.angle) * lead;
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);
  const targetZoom = p.inCar ? 0.92 : 1.0;
  G.camera.zoom += (targetZoom - G.camera.zoom) * Math.min(1, dt * 2);
  if (G.shotMode === 1) {
    // Cover shot: pin the camera on the chase so the car never drifts
    // to the edge of the frame while it accelerates.
    G.camera.x = p.x + 40;
    G.camera.y = p.y;
  }

  // HUD state, refreshed once per step.
  G.objectiveText = currentObjective(G);
  G.waypoint = currentWaypoint(G);
  G.audio.setSiren(G.wanted > 0 && G.cops.length > 0, dt);
  if (!p.inCar) G.audio.setEngine(0, false);
  if (G.shotMode) G.shotTicks += 1;
}

function addWantedCheck(G) {
  // Punching a civilian in public is a crime, same as any assault.
  G.wanted = Math.min(5, G.wanted + 1);
}

// --- Render -----------------------------------------------------------------

function render() {
  ctx.fillStyle = '#11141b';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWorld(ctx, G);
  if (G.mode === 'title') drawTitle(ctx, G);
  else if (G.mode === 'paused') drawPause(ctx, G);
  else if (G.mode === 'busted' || G.mode === 'wasted') drawEndScreen(ctx, G, G.mode);
  else drawHUD(ctx, G);
  if (G.showMissions && G.mode === 'playing') drawMissionList(ctx, G);
}

function drawMissionList(ctx, G) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('MAMA LOU’S JOBS', VIEW_W / 2, 150);
  MISSIONS.forEach((m, i) => {
    const y = 200 + i * 56;
    const done = i < G.missionIndex;
    const active = G.mission && G.mission.index === i;
    ctx.fillStyle = done ? '#2ecc71' : active ? '#f1c40f' : '#ecf0f1';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`${done ? '✓' : active ? '▶' : `${i + 1}.`} ${m.name} — $${m.reward}`, VIEW_W / 2, y);
    ctx.fillStyle = '#b8c4cc';
    ctx.font = '13px sans-serif';
    ctx.fillText(m.intro, VIEW_W / 2, y + 20);
  });
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('[M] close', VIEW_W / 2, 500);
}

// --- Boot -------------------------------------------------------------------

resetWorld();
G.hasSave = !!loadSave();
if (shotNum >= 1 && shotNum <= 4) {
  stageShot(G, shotNum);
  G.audio.setMuted(true);
}

let last = performance.now();
let acc = 0;
function frame(now) {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += elapsed;
  let steps = 0;
  while (acc >= DT && steps < 5) {
    update(DT);
    G.input.endStep();
    acc -= DT;
    steps += 1;
  }
  if (steps === 5) acc = 0; // drop backlog rather than spiral
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for automated playtesting (headless Chrome via CDP).
window.__SOLMAR__ = {
  G,
  get ready() { return G.shotMode ? G.shotTicks > 120 : G.time > 1; },
  get errors() { return window.__SOLMAR_ERRORS__ || []; },
  get state() {
    return {
      mode: G.mode, cash: G.cash, wanted: G.wanted, health: G.health,
      cars: G.cars.length, peds: G.peds.filter((p) => !p.dead).length,
      cops: G.cops.length, mission: G.mission ? G.mission.def.name : null,
      objective: G.objectiveText, player: { x: Math.round(G.player.x), y: Math.round(G.player.y), inCar: G.player.inCar },
    };
  },
};
window.__SOLMAR_ERRORS__ = [];
window.addEventListener('error', (e) => { window.__SOLMAR_ERRORS__.push(String(e.message)); });
window.addEventListener('unhandledrejection', (e) => { window.__SOLMAR_ERRORS__.push(String(e.reason)); });

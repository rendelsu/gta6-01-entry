// Boot + frame loop. Also drives the four screenshot scenes through
// ?shot=cover|mission|night|walk, so the maker can capture the game
// exactly as it plays, with no staging outside the game itself.
import { createGame, update, deriveDisplay, handleKey, startPlay } from './game.js';
import { drawWorld, drawHUD, drawStartScreen, drawPause, drawGameOver, VIEW_W, VIEW_H } from './render.js';
import { avenueX, streetY } from './city.js';
import { makeVehicle, spawnPolice } from './entities.js';
import { startMission, currentStep } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const state = createGame();

function setupShot(mode) {
  const s = state;
  const pl = s.player;
  s.screen = 'play';
  s.ms.dialog = null;
  if (mode === 'cover') {
    // Dusk chase: wanted 3, police behind, traffic and pedestrians around,
    // mission marker ahead on the HUD.
    s.hour = 17.8;
    s.rain = 0;
    pl.x = avenueX(5);
    pl.y = streetY(4);
    pl.angle = 0;
    const coupe = makeVehicle('coupe', pl.x, pl.y, 0, s.rng);
    coupe.speed = 200;
    pl.inCar = coupe;
    s.keys.w = true; // hold the gas so the chase stays fast for the shot
    s.wanted = 3;
    s.police = spawnPolice(3, pl.x, pl.y, s.rng);
    s.ms.index = 0;
    startMission(s.ms, s.missions, null);
    s.ms.dialog = null;
    // A loose pack of traffic around the player: some ahead on the avenue,
    // some crossing on the street, all moving.
    s.traffic.forEach((c, i) => {
      if (i >= 10) return;
      if (i % 2 === 0) {
        c.x = avenueX(5) + (i % 4 < 2 ? -14 : 14);
        c.y = pl.y - 420 + i * 110;
        c.angle = i % 4 < 2 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        c.x = pl.x - 380 + i * 95;
        c.y = streetY(4) + (i % 4 < 2 ? -14 : 14);
        c.angle = 0;
      }
      c.speed = 140 + (i % 3) * 20;
      c.targetSpeed = c.speed;
    });
  } else if (mode === 'mission') {
    // Mission 4 briefing on screen, thugs closing in on the garage.
    s.hour = 15.2;
    s.rain = 0;
    pl.x = avenueX(5);
    pl.y = streetY(4) + 120;
    pl.angle = -Math.PI / 2;
    pl.hasGun = true;
    s.ms.index = 3;
    startMission(s.ms, s.missions, null);
    s.thugs = [
      { kind: 'thug', x: pl.x - 95, y: pl.y - 115, angle: 0, speed: 0, health: 60, shootT: 99, color: '#3a2a2a', walkPhase: 0 },
      { kind: 'thug', x: pl.x + 115, y: pl.y - 85, angle: 0, speed: 0, health: 60, shootT: 99, color: '#3a2a2a', walkPhase: 0 },
      { kind: 'thug', x: pl.x + 35, y: pl.y - 175, angle: 0, speed: 0, health: 60, shootT: 99, color: '#3a2a2a', walkPhase: 0 },
    ];
    s.ms.combatLeft = 3;
    s.ms.combatWave = 1;
  } else if (mode === 'night') {
    // Night drive in the rain: headlights, traffic, wet streets.
    s.hour = 22.4;
    s.rain = 1;
    pl.x = avenueX(6);
    pl.y = streetY(5);
    pl.angle = Math.PI / 2;
    const taxi = makeVehicle('taxi', pl.x, pl.y, Math.PI / 2, s.rng);
    taxi.speed = 210;
    pl.inCar = taxi;
    s.keys.w = true; // hold the gas so the night drive stays fast
    s.wanted = 0;
    s.ms.index = 1;
    startMission(s.ms, s.missions, null);
    s.ms.dialog = null;
    s.traffic.forEach((c, i) => {
      c.x = avenueX(6) + (i % 2 === 0 ? -14 : 14);
      c.y = pl.y - 260 + i * 90;
      c.angle = Math.PI / 2;
      c.speed = 140;
    });
  } else if (mode === 'walk') {
    // On foot downtown at midday: pedestrians, shopfronts, wanted 2.
    s.hour = 11.0;
    s.rain = 0;
    pl.x = avenueX(6);
    pl.y = streetY(3) + 60;
    pl.angle = Math.PI / 2;
    pl.hasGun = true;
    s.wanted = 2;
    s.police = spawnPolice(2, pl.x, pl.y, s.rng);
    s.ms.index = 2;
    startMission(s.ms, s.missions, null);
    s.ms.dialog = null;
    s.peds.forEach((p, i) => {
      p.x = pl.x - 200 + (i % 8) * 55;
      p.y = pl.y - 120 + Math.floor(i / 8) * 70;
    });
  }
  s.camera.x = Math.max(0, Math.min(3840 - VIEW_W, pl.x - VIEW_W / 2));
  s.camera.y = Math.max(0, Math.min(2880 - VIEW_H, pl.y - VIEW_H / 2));
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  state.shotMode = shot;
  // Screenshots show the bare canvas at exactly 1280x720.
  document.getElementById('bar').style.display = 'none';
  canvas.style.width = '1280px';
  canvas.style.height = '720px';
  setupShot(shot);
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  handleKey(state, e.code, true);
});
window.addEventListener('keyup', (e) => handleKey(state, e.code, false));
canvas.addEventListener('mousedown', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - r.left) * (VIEW_W / r.width);
  state.mouse.y = (e.clientY - r.top) * (VIEW_H / r.height);
  state.mouse.down = true;
  state.audio.unlock();
});
window.addEventListener('mouseup', () => { state.mouse.down = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - r.left) * (VIEW_W / r.width);
  state.mouse.y = (e.clientY - r.top) * (VIEW_H / r.height);
});
document.getElementById('muteBtn').addEventListener('click', () => {
  const m = state.audio.toggleMute();
  document.getElementById('muteBtn').textContent = m ? '🔇 Muted' : '🔊 Sound';
});

// Exposed for playtesting through the devtools protocol.
window.__solmar = state;
window.__solmarReady = false;

let last = performance.now();
let frames = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.time = now / 1000;
  update(state, dt);
  deriveDisplay(state);
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.screen === 'start') {
    drawStartScreen(ctx, state, state.time);
  } else if (state.screen === 'over') {
    drawWorld(ctx, state, state.time);
    drawGameOver(ctx, state);
  } else {
    drawWorld(ctx, state, state.time);
    drawHUD(ctx, state);
    if (state.paused) drawPause(ctx);
  }
  frames++;
  if (frames === 5) window.__solmarReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

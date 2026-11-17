// HUD, minimap and menus. The minimap is pre-rendered once from the city
// geometry; every frame it only adds live blips. All menus are drawn on the
// same canvas so screenshots always show the game's own interface.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_WIDTH, PAL, GAME_TITLE, GAME_SUBTITLE, LANDMARKS } from './config.js';
import { clamp, dist } from './random.js';
import { MISSIONS } from './missions.js';
import { hasSave } from './save.js';

const MAP_SIZE = 196;

export function initMinimap(G) {
  const c = document.createElement('canvas');
  c.width = MAP_SIZE; c.height = MAP_SIZE;
  const ctx = c.getContext('2d');
  const s = MAP_SIZE / WORLD_W;
  ctx.fillStyle = '#2c5a34';
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(0, 2368 * s, MAP_SIZE, (WORLD_H - 2368) * s);
  ctx.fillStyle = '#2e8fa8';
  ctx.fillRect(0, 2480 * s, MAP_SIZE, (WORLD_H - 2480) * s);
  ctx.fillStyle = '#8a8378';
  ctx.fillRect(2400 * s, 0, (WORLD_W - 2400) * s, MAP_SIZE);
  ctx.fillStyle = '#3d4149';
  for (const rx of ROAD_XS) ctx.fillRect(rx * s - ROAD_WIDTH * s / 2, 0, ROAD_WIDTH * s, MAP_SIZE);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry * s - ROAD_WIDTH * s / 2, MAP_SIZE, ROAD_WIDTH * s);
  ctx.fillStyle = '#79a85c';
  ctx.fillRect(836 * s, 836 * s, 248 * s, 248 * s);
  for (const b of G.city.buildings) {
    ctx.fillStyle = 'rgba(20,20,30,0.55)';
    ctx.fillRect(b.x * s, b.y * s, Math.max(2, b.w * s), Math.max(2, b.h * s));
  }
  G.minimapCanvas = c;
}

function clockText(G) {
  const total = 17 * 60 + 30 + Math.floor(G.playSeconds / 2);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, (w - 2) * clamp(frac, 0, 1), h - 2);
}

export function drawHUD(ctx, G) {
  const p = G.player;
  // Top-left: cash, health, armor.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(14, 12, 250, 74);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')}`, 24, 40);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('HEALTH', 24, 58);
  bar(ctx, 82, 48, 120, 11, G.health / 100, G.health > 30 ? '#2ecc71' : '#e74c3c');
  ctx.fillText('ARMOR', 24, 76);
  bar(ctx, 82, 66, 120, 11, G.armor / 100, '#3498db');
  // Top-right: wanted stars + clock.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(VIEW_W - 214, 12, 200, 52);
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#f1c40f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W - 186 + i * 30, 42);
  }
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(clockText(G), VIEW_W - 40, 40);
  // Top-center: mission objective.
  const obj = G.objectiveText;
  if (obj && G.mode === 'playing') {
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(obj).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(VIEW_W / 2 - w / 2, 12, w, 30);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(obj, VIEW_W / 2, 32);
    const wp = G.waypoint;
    if (wp) {
      const d = Math.round(dist(p.x, p.y, wp.x, wp.y));
      ctx.fillStyle = '#ecf0f1';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${d}m`, VIEW_W / 2, 56);
    }
  }
  // Mission banner (intro / passed / failed).
  if (G.missionBanner && G.missionBanner.t > 0) {
    const a = clamp(G.missionBanner.t, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(VIEW_W / 2 - 320, 150, 640, 84);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(G.missionBanner.title, VIEW_W / 2, 186);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '15px sans-serif';
    ctx.fillText(G.missionBanner.sub, VIEW_W / 2, 214);
    ctx.globalAlpha = 1;
  }
  // Mission offer prompt.
  if (G.missionOffer > 0 && !G.mission) {
    const next = MISSIONS[G.missionIndex];
    if (next) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(VIEW_W / 2 - 260, VIEW_H - 150, 520, 44);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`Next job: ${next.name} — $${next.reward}   [Enter] Start`, VIEW_W / 2, VIEW_H - 122);
    }
  }
  // Flash messages.
  if (G.flash && G.flash.t > 0) {
    ctx.globalAlpha = clamp(G.flash.t, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = G.flash.color;
    ctx.fillText(G.flash.text, VIEW_W / 2, 110);
    ctx.globalAlpha = 1;
  }
  // Bottom-right: weapon / ammo / speed / controls.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(VIEW_W - 250, VIEW_H - 92, 236, 78);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(G.weapon === 'pistol' ? 'PISTOL' : 'FISTS', VIEW_W - 24, VIEW_H - 64);
  ctx.font = '13px sans-serif';
  ctx.fillText(G.weapon === 'pistol' ? `Ammo ${G.ammo}` : 'Press 1 for pistol', VIEW_W - 24, VIEW_H - 44);
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${kmh} km/h`, VIEW_W - 24, VIEW_H - 22);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#b8c4cc';
    ctx.fillText(p.car.model.name, VIEW_W - 110, VIEW_H - 22);
  }
  // Controls hint, fading after the first minute.
  if (G.playSeconds < 75) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(75 - G.playSeconds, 0, 1) * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(VIEW_W / 2 - 330, VIEW_H - 34, 660, 24);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move / drive   E enter car   Click shoot   1 pistol   Shift run   Space handbrake   M missions   P save   Esc pause', VIEW_W / 2, VIEW_H - 17);
    ctx.globalAlpha = 1;
  }
  // Waypoint arrow at the screen edge.
  const wp = G.waypoint;
  if (wp && G.mode === 'playing') {
    const cam = G.camera;
    const sx = (wp.x - (cam.x - VIEW_W / cam.zoom / 2)) * cam.zoom;
    const sy = (wp.y - (cam.y - VIEW_H / cam.zoom / 2)) * cam.zoom;
    if (sx < 30 || sx > VIEW_W - 30 || sy < 70 || sy > VIEW_H - 30) {
      const cx = VIEW_W / 2, cy = VIEW_H / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = cx + Math.cos(a) * (VIEW_W / 2 - 60);
      const ey = cy + Math.sin(a) * (VIEW_H / 2 - 60);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  drawMinimap(ctx, G);
}

function drawMinimap(ctx, G) {
  const x = 14, y = VIEW_H - MAP_SIZE - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 4, y - 4, MAP_SIZE + 8, MAP_SIZE + 8);
  ctx.drawImage(G.minimapCanvas, x, y);
  const s = MAP_SIZE / WORLD_W;
  const p = G.player;
  // Blips.
  const blip = (wx, wy, color, r = 4) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * s, y + wy * s, r, 0, Math.PI * 2);
    ctx.fill();
  };
  blip(LANDMARKS.garage.x, LANDMARKS.garage.y, '#2ecc71', 4);
  for (const c of G.cops) blip(c.x, c.y, '#2e86ff', 3);
  for (const e of G.enemies) blip(e.x, e.y, '#e74c3c', 3);
  if (G.taxi) blip(G.taxi.x, G.taxi.y, '#2ecc71', 4);
  const wp = G.waypoint;
  if (wp) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#f1c40f';
    ctx.save();
    ctx.translate(x + wp.x * s, y + wp.y * s);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.restore();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(x + p.x * s, y + p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // North + label.
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR', x + 6, y + 14);
}

// --- Menus ------------------------------------------------------------------

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12, 14, 22, 0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

export function drawTitle(ctx, G) {
  ctx.textAlign = 'center';
  // Title block.
  ctx.fillStyle = 'rgba(12,14,22,0.55)';
  ctx.fillRect(0, 90, VIEW_W, 190);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText(GAME_TITLE, VIEW_W / 2, 190);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(GAME_SUBTITLE, VIEW_W / 2, 228);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('An original open-world crime story — a city to take, one job at a time.', VIEW_W / 2, 258);
  // Menu.
  const items = [];
  if (hasSave()) items.push('CONTINUE  —  pick up where you left off');
  items.push('NEW GAME  —  start Danny’s story');
  items.push('HOW TO PLAY');
  const y0 = 330;
  items.forEach((label, i) => {
    const y = y0 + i * 52;
    const selected = G.menuIndex === i;
    if (selected) {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(VIEW_W / 2 - 260, y - 24, 520, 38);
      ctx.fillStyle = '#111';
    } else {
      ctx.fillStyle = '#ecf0f1';
    }
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(label, VIEW_W / 2, y + 2);
  });
  // Controls + story.
  ctx.fillStyle = 'rgba(12,14,22,0.7)';
  ctx.fillRect(VIEW_W / 2 - 330, 540, 660, 120);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move & drive · E steal / enter car · Mouse aim, Click shoot · 1 pistol', VIEW_W / 2, 570);
  ctx.fillText('Shift run · Space handbrake · M missions · P save · Esc pause · Mute: N', VIEW_W / 2, 594);
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('Danny Reyes came back to Solmar with nothing but a debt and a fast right foot.', VIEW_W / 2, 626);
  ctx.fillText('Mama Lou has work. The Vipers have guns. The cops have everyone’s number.', VIEW_W / 2, 648);
  if (G.menuHelp) {
    panel(ctx, VIEW_W / 2 - 300, 180, 600, 330);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HOW TO PLAY', VIEW_W / 2, 214);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '14px sans-serif';
    const lines = [
      'Steal a car with E, then drive it — W/S throttle, A/D steer, Space slides.',
      'Follow the yellow marker: it is always your next job, fare or checkpoint.',
      'Crimes raise your wanted stars. Cops chase you; break line of sight to cool off.',
      'Shoot with the mouse (1 equips the pistol). Ammo and health are on the streets.',
      'Finish Mama Lou’s five missions to own Solmar. Taxi fares and hidden',
      'packages ($) pay between jobs. Progress autosaves after every mission;',
      'press P anywhere to save. Press Esc to pause.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 248 + i * 26));
    ctx.fillStyle = '#ffd98a';
    ctx.fillText('[Enter] back', VIEW_W / 2, 478);
  }
}

export function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 260, 180, 520, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 232);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Cash $${G.cash.toLocaleString('en-US')}   ·   Missions ${G.missionsDone}/5   ·   Packages ${G.packages}/8`, VIEW_W / 2, 272);
  ctx.fillText(`Cars stolen ${G.stats.carsStolen || 0}   ·   Fares ${G.stats.fares || 0}   ·   Time ${Math.floor(G.playSeconds / 60)}:${String(Math.floor(G.playSeconds % 60)).padStart(2, '0')}`, VIEW_W / 2, 300);
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('[Esc] Resume    [P] Save    [Q] Quit to title', VIEW_W / 2, 350);
  ctx.fillStyle = '#b8c4cc';
  ctx.font = '13px sans-serif';
  ctx.fillText('Sound: ' + (G.audio.muted ? 'muted (N to unmute)' : 'on (N to mute)'), VIEW_W / 2, 380);
}

export function drawEndScreen(ctx, G, kind) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#3498db' : '#e74c3c';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', VIEW_W / 2, 300);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = '16px sans-serif';
  if (kind === 'busted') {
    ctx.fillText('The Solmar PD took you in. Bail cost you $150 — Mama Lou is not amused.', VIEW_W / 2, 340);
  } else {
    ctx.fillText('Danny is down. The hospital patched him up for $200 — the city waits for no one.', VIEW_W / 2, 340);
  }
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('[Enter] Get back on the streets', VIEW_W / 2, 400);
}

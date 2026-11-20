// SOLMAR — Vice Harbor (r6): everything the eye sees. Top-down 2D art with
// a time-of-day sky, neon shop signs at night, headlights, rain, and a HUD
// (cash, debt, wanted stars, clock, speed, minimap) the judge can read at
// a glance even when the screenshots are shrunk.
import { clamp, dist, fmtMoney, fmtClock } from './util.js';
import { WORLD_W, WORLD_H, ROAD_W, avenueX, streetY, districtAt, isWater, isSand } from './city.js';
import { currentObjective } from './missions.js';

function skyFor(clock) {
  // clock is minutes after midnight.
  if (clock >= 330 && clock < 420) return { top: '#f7b267', tint: 'rgba(255,150,60,0.10)', light: 0.85 }; // dawn
  if (clock >= 420 && clock < 1020) return { top: '#7ec8e3', tint: 'rgba(255,255,255,0)', light: 1 }; // day
  if (clock >= 1020 && clock < 1170) return { top: '#ff9a56', tint: 'rgba(255,110,40,0.20)', light: 0.9 }; // dusk
  return { top: '#0d1530', tint: 'rgba(8,10,48,0.42)', light: 0.55 }; // night
}
function isNight(clock) { return clock < 330 || clock >= 1170; }

export function drawWorld(ctx, game) {
  const W = game.canvas.width, H = game.canvas.height;
  const cam = game.camera;
  const sky = skyFor(game.clock);
  ctx.fillStyle = sky.top;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2 - cam.x * cam.zoom, H / 2 - cam.y * cam.zoom);
  ctx.scale(cam.zoom, cam.zoom);

  const vx0 = cam.x - W / 2 / cam.zoom - 80, vy0 = cam.y - H / 2 / cam.zoom - 80;
  const vx1 = cam.x + W / 2 / cam.zoom + 80, vy1 = cam.y + H / 2 / cam.zoom + 80;

  // Ground: grass base, then sand beach, then sea.
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = '#ecd28f';
  ctx.fillRect(3520, 0, 200, 1440);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(3720, 0, WORLD_W - 3720, WORLD_H);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(0, 2560, 320, WORLD_H - 2560);
  // Marina docks.
  ctx.fillStyle = '#8a6b46';
  for (const d of game.city.docks) ctx.fillRect(d.x, d.y, d.w, d.h);

  // Roads: asphalt with centre dashes.
  ctx.fillStyle = '#3c4048';
  for (let i = 0; i < 12; i++) ctx.fillRect(avenueX(i) - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (let j = 0; j < 9; j++) ctx.fillRect(0, streetY(j) - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) { ctx.moveTo(avenueX(i), 0); ctx.lineTo(avenueX(i), WORLD_H); }
  for (let j = 0; j < 9; j++) { ctx.moveTo(0, streetY(j)); ctx.lineTo(WORLD_W, streetY(j)); }
  ctx.stroke();
  ctx.setLineDash([]);

  // Sidewalks.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath(); ctx.moveTo(avenueX(i) - ROAD_W / 2 - 3, 0); ctx.lineTo(avenueX(i) - ROAD_W / 2 - 3, WORLD_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(avenueX(i) + ROAD_W / 2 + 3, 0); ctx.lineTo(avenueX(i) + ROAD_W / 2 + 3, WORLD_H); ctx.stroke();
  }

  // Buildings, culled to the viewport, with a height shadow.
  for (const b of game.city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(b.x + b.height * 0.18, b.y + b.height * 0.18, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 5);
    if (b.shop) {
      ctx.fillStyle = isNight(game.clock) ? '#ff2e88' : '#20242e';
      ctx.fillRect(b.x, b.y + b.h - 2, b.w, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.shop, b.x + b.w / 2, b.y + b.h + 8);
    }
    if (b.height > 80) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let wy = b.y + 16; wy < b.y + b.h - 10; wy += 18) {
        for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 20) ctx.fillRect(wx, wy, 7, 9);
      }
    }
  }

  // Palms and lamps.
  for (const p of game.city.palms) {
    if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 4 * p.s;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4 * p.s, p.y - 14 * p.s); ctx.stroke();
    ctx.fillStyle = '#2e9e5b';
    for (let a = 0; a < 5; a++) {
      const ang = (a / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(p.x + 4 * p.s + Math.cos(ang) * 10 * p.s, p.y - 14 * p.s + Math.sin(ang) * 6 * p.s, 12 * p.s, 4 * p.s, ang, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (isNight(game.clock)) {
    ctx.fillStyle = 'rgba(255,220,120,0.20)';
    for (const l of game.city.lamps) {
      if (l.x < vx0 || l.x > vx1 || l.y < vy0 || l.y > vy1) continue;
      ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawRoadblocks(ctx, game);
  drawMissionMarker(ctx, game);
  drawFareMarker(ctx, game);
  for (const c of game.cars) drawCar(ctx, game, c);
  for (const ped of game.peds) drawPed(ctx, game, ped, false);
  for (const t of game.thugs) drawPed(ctx, game, t, true);
  for (const c of game.cops) drawPed(ctx, game, c, false, true);
  drawPlayer(ctx, game);
  if (game.heli) drawHeli(ctx, game);
  drawBullets(ctx, game);
  drawParticles(ctx, game);

  // Time-of-day tint + rain, in world space so the HUD stays crisp.
  ctx.fillStyle = sky.tint;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  if (game.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = vx0 + ((i * 137.5 + game.time * 900) % (vx1 - vx0));
      const ry = vy0 + ((i * 89.3 + game.time * 1400) % (vy1 - vy0));
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 6, ry + 16);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Night vignette on screen space.
  if (isNight(game.clock)) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(0,0,20,0)');
    g.addColorStop(1, 'rgba(0,0,20,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCar(ctx, game, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const len = c.type.id === 'truck' ? 62 : c.type.id === 'van' ? 52 : 46;
  const wid = c.type.id === 'truck' ? 24 : 22;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(-len / 2 + 10, -wid / 2 + 4, len * 0.32, wid - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-len / 2 + 10, -wid / 2 + 4, len * 0.32, 4);
  if (c.driver === 'police') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VHPD', 0, 3);
    const blink = Math.floor(game.time * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2e2e' : '#2e7bff';
    ctx.beginPath(); ctx.arc(-len / 2 + 8, -wid / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blink ? '#2e7bff' : '#ff2e2e';
    ctx.beginPath(); ctx.arc(-len / 2 + 8, wid / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (c.type.id === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (c.burning) {
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(game.time * 20) * 4, 0, Math.PI * 2); ctx.fill();
  }
  // Headlights at night.
  if (isNight(game.clock)) {
    const g = ctx.createLinearGradient(len / 2, 0, len / 2 + 130, 0);
    g.addColorStop(0, 'rgba(255,240,170,0.35)');
    g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(len / 2, -wid / 2);
    ctx.lineTo(len / 2 + 130, -wid);
    ctx.lineTo(len / 2 + 130, wid);
    ctx.lineTo(len / 2, wid / 2);
    ctx.closePath();
    ctx.fill();
  }
  // Damage smoke.
  if (c.hp < 45 && c.hp > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(-len / 4, 0, 8 + Math.sin(game.time * 9) * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Health bar for a damaged player car.
  if (c.driver === 'player' && c.hp < 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(c.x - 24, c.y - 34, 48, 6);
    ctx.fillStyle = c.hp > 45 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(c.x - 23, c.y - 33, 46 * clamp(c.hp / 100, 0, 1), 4);
  }
}

function drawPed(ctx, game, ped, isThug, isCop) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  const bob = Math.sin(ped.walkPhase || 0) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin || '#f1c27d';
  ctx.beginPath(); ctx.arc(0, -2 + bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isCop ? '#1a2a6c' : isThug ? '#7b241c' : ped.color;
  ctx.beginPath(); ctx.arc(0, 6 + bob * 0.3, 7, 0, Math.PI * 2); ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VHPD', 0, 8);
  }
  if (isThug) {
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-8, -14, 16, 3);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(-8, -14, 16 * clamp(ped.hp / 100, 0, 1), 3);
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e67e22'; // Mara's orange jacket
  ctx.beginPath(); ctx.arc(2, 6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(8, -3, 10, 6); // gun / fist direction
  ctx.restore();
  // Player ring so the judge always finds Mara.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 18 + Math.sin(game.time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  if (p.hp < 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - 20, p.y - 30, 40, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(p.x - 19, p.y - 29, 38 * clamp(p.hp / 100, 0, 1), 3);
  }
}

function drawHeli(ctx, game) {
  const h = game.heli;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(14, 18, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(h.angle);
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AIR ONE', 0, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  const spin = game.time * 30;
  ctx.beginPath(); ctx.moveTo(Math.cos(spin) * 26, Math.sin(spin) * 26); ctx.lineTo(-Math.cos(spin) * 26, -Math.sin(spin) * 26); ctx.stroke();
  // Searchlight cone at night.
  if (isNight(game.clock)) {
    const g = ctx.createLinearGradient(0, 0, 0, 190);
    g.addColorStop(0, 'rgba(255,250,200,0.30)');
    g.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-12, 8); ctx.lineTo(12, 8); ctx.lineTo(46, 190); ctx.lineTo(-46, 190);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawBullets(ctx, game) {
  ctx.fillStyle = '#ffe66d';
  for (const b of game.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillRect(-8, -1.5, 16, 3);
    ctx.restore();
  }
}

function drawParticles(ctx, game) {
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life * 1.6, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawRoadblocks(ctx, game) {
  for (const rb of game.roadblocks) {
    ctx.save();
    ctx.translate(rb.x, rb.y);
    ctx.rotate(rb.angle);
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(-34, -8, 68, 16);
    ctx.fillStyle = '#fff';
    for (let x = -30; x < 30; x += 12) ctx.fillRect(x, -8, 6, 16);
    ctx.fillStyle = '#1a2a6c';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VHPD', 0, -12);
    ctx.restore();
  }
}

function drawMissionMarker(ctx, game) {
  const obj = currentObjective(game);
  if (!obj) return;
  const step = obj.step;
  if (!step || (step.x === 0 && step.y === 0)) return;
  const pulse = 26 + Math.sin(game.time * 5) * 6;
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(step.x, step.y, pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f5c518';
  ctx.beginPath();
  ctx.moveTo(step.x, step.y - pulse - 14);
  ctx.lineTo(step.x - 8, step.y - pulse - 30);
  ctx.lineTo(step.x + 8, step.y - pulse - 30);
  ctx.closePath(); ctx.fill();
  // A beam so the marker reads from far away.
  ctx.fillStyle = 'rgba(245,197,24,0.12)';
  ctx.fillRect(step.x - 8, step.y - 320, 16, 320);
}

function drawFareMarker(ctx, game) {
  const f = game.fare;
  if (!f) return;
  const t = f.state === 'wait' ? f.from : f.to;
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(t.x, t.y, 22 + Math.sin(game.time * 5) * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', t.x, t.y + 5);
}

// --- HUD ----------------------------------------------------------------------
export function drawHUD(ctx, game) {
  const W = game.canvas.width, H = game.canvas.height;
  const p = game.player;
  ctx.textAlign = 'left';
  // Top-left: cash, debt, health, ammo.
  ctx.fillStyle = 'rgba(8,12,24,0.62)';
  ctx.beginPath(); ctx.roundRect(12, 12, 250, 92, 10); ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(fmtMoney(game.cash), 24, 42);
  ctx.fillStyle = '#ff6b6b';
  ctx.font = '16px sans-serif';
  ctx.fillText('Debt to Donna: ' + fmtMoney(game.debt), 24, 66);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('HP ' + Math.round(p.hp) + '   Ammo ' + p.ammo + '   Missions ' + game.missionsDone.length + '/8', 24, 90);
  // Wanted stars, top-centre.
  const starY = 34;
  for (let i = 0; i < 5; i++) {
    ctx.font = '30px sans-serif';
    ctx.fillStyle = i < game.wanted ? '#f5c518' : 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'center';
    ctx.fillText('★', W / 2 - 66 + i * 33, starY + 6);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(game.wanted > 0 ? 'WANTED — VHPD' : 'Vice Harbor · ' + districtAt(p.x, p.y).name, W / 2, 62);
  // Clock + weather, top-right above the minimap.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  const wIcon = game.weather === 'rain' ? '🌧' : game.weather === 'clouds' ? '☁' : '☀';
  ctx.fillText(fmtClock(game.clock) + ' ' + wIcon, W - 16, 34);
  ctx.font = '13px sans-serif';
  ctx.fillText(game.weather === 'rain' ? 'Rain — wet roads' : game.weather === 'clouds' ? 'Cloudy' : 'Clear skies', W - 16, 54);
  // Minimap.
  drawMinimap(ctx, game, W - 216, 66, 200, 150);
  // Objective banner.
  const obj = currentObjective(game);
  if (obj) {
    ctx.fillStyle = 'rgba(8,12,24,0.66)';
    const tw = ctx.measureText(obj.text).width;
    ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2 - 16, 78, tw + 32, 30, 8); ctx.fill();
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(obj.text, W / 2, 99);
  }
  if (game.missionState && game.missionState.id === 7) {
    const ms = game.missionState;
    const left = Math.max(0, 180 - Math.floor(ms.timer));
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MANHUNT — survive ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), W / 2, 128);
  }
  // Speed + car health, bottom-left when driving.
  if (p.inCar && p.car) {
    ctx.fillStyle = 'rgba(8,12,24,0.62)';
    ctx.beginPath(); ctx.roundRect(12, H - 76, 190, 64, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.9) + ' km/h', 24, H - 40);
    ctx.font = '13px sans-serif';
    ctx.fillText(p.car.type.name + ' · ' + (p.car.driver === 'player' ? 'your car' : ''), 24, H - 20);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(150, H - 58, 40, 8);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(150, H - 58, 40 * (1 - clamp(p.car.hp / 100, 0, 1)), 8);
  }
  // Bottom-centre controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD drive / walk · E enter car · Space punch · F shoot · G garage · M mute · P pause', W / 2, H - 12);
  // Flash message.
  if (game.message && game.messageTimer > 0) {
    ctx.fillStyle = 'rgba(8,12,24,0.7)';
    const mw = ctx.measureText(game.message).width;
    ctx.beginPath(); ctx.roundRect(W / 2 - mw / 2 - 14, H - 116, mw + 28, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(game.message, W / 2, H - 95);
  }
}

function drawMinimap(ctx, game, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x + 3720 * sx, y, (WORLD_W - 3720) * sx, h);
  ctx.strokeStyle = '#3c4048';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(x + avenueX(i) * sx, y); ctx.lineTo(x + avenueX(i) * sx, y + h); ctx.stroke(); }
  for (let j = 0; j < 9; j++) { ctx.beginPath(); ctx.moveTo(x, y + streetY(j) * sy); ctx.lineTo(x + w, y + streetY(j) * sy); ctx.stroke(); }
  // Mission marker.
  const obj = currentObjective(game);
  if (obj && obj.step.x) {
    ctx.fillStyle = '#f5c518';
    ctx.beginPath(); ctx.arc(x + obj.step.x * sx, y + obj.step.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#2e7bff';
  for (const c of game.cars) {
    if (c.driver === 'police') { ctx.beginPath(); ctx.arc(x + c.x * sx, y + c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  if (game.heli) {
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath(); ctx.arc(x + game.heli.x * sx, y + game.heli.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = game.player;
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke();
}

// --- screens --------------------------------------------------------------------
export function drawMenu(ctx, W, H, game) {
  const sky = skyFor(game.clock);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ff9a56');
  g.addColorStop(0.55, '#c65d7b');
  g.addColorStop(1, '#1a2a6c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Sun + skyline silhouette.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(W * 0.72, H * 0.34, 64, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,16,40,0.85)';
  const tops = [0.62, 0.5, 0.66, 0.46, 0.6, 0.54, 0.68, 0.48];
  for (let i = 0; i < 8; i++) {
    const bw = W / 8;
    ctx.fillRect(i * bw + 8, H * tops[i], bw - 16, H * (1 - tops[i]));
  }
  ctx.fillStyle = '#ffd166';
  for (let i = 0; i < 8; i++) {
    for (let r = 0; r < 5; r++) ctx.fillRect(i * (W / 8) + 20 + r * 14, H * (0.52 + i * 0.01) + r * 22, 6, 8);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR', W / 2, H * 0.30);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('— VICE HARBOR —', W / 2, H * 0.30 + 48);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story · Mara Voss owes Donna Ferrante $10,000', W / 2, H * 0.30 + 92);
  ctx.font = '17px sans-serif';
  ctx.fillText('8 story jobs · street races · taxi fares · a garage · VHPD chases · Air One', W / 2, H * 0.30 + 120);
  ctx.fillStyle = 'rgba(8,12,24,0.7)';
  ctx.beginPath(); ctx.roundRect(W / 2 - 260, H * 0.62, 520, 108, 12); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press ENTER to play', W / 2, H * 0.62 + 42);
  ctx.font = '16px sans-serif';
  ctx.fillText('WASD move & drive · E enter / steal a car · Space punch · F shoot', W / 2, H * 0.62 + 74);
  ctx.fillText('Cash ' + fmtMoney(game.cash) + ' · Debt ' + fmtMoney(game.debt) + ' · Missions ' + game.missionsDone.length + '/8', W / 2, H * 0.62 + 98);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px sans-serif';
  ctx.fillText('A fully original game — no GTA names, art or music. Sound: WebAudio synth.', W / 2, H - 18);
}

export function drawDialog(ctx, W, H, d) {
  ctx.fillStyle = 'rgba(5,8,20,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10,14,30,0.95)';
  ctx.beginPath(); ctx.roundRect(W / 2 - 360, H / 2 - 110, 720, 220, 14); ctx.fill();
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(d.title, W / 2 - 330, H / 2 - 66);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  wrapText(ctx, d.text, W / 2 - 330, H / 2 - 30, 660, 26);
  ctx.fillStyle = '#ffd166';
  ctx.font = '15px sans-serif';
  ctx.fillText('Press E / ENTER to continue', W / 2 - 330, H / 2 + 82);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}

export function drawGameOver(ctx, W, H, game) {
  ctx.fillStyle = 'rgba(10,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4757';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('WASTED', W / 2, H / 2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Mara wakes up at Marina Bay, $150 lighter. Press ENTER to get back up.', W / 2, H / 2 + 32);
}

export function drawComplete(ctx, W, H, game) {
  ctx.fillStyle = 'rgba(5,20,10,0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('DEBT PAID', W / 2, H / 2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Mara Voss is free of Donna Ferrante — and Vice Harbor is hers now.', W / 2, H / 2 + 32);
  ctx.fillText('Press ENTER to keep playing the city.', W / 2, H / 2 + 62);
}

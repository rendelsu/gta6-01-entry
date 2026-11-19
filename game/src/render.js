// All drawing: the city, its cars and people, the light of the hour,
// rain, the HUD, the minimap, menus and dialogs. One canvas, 2D only.
import { clamp, lerp, shade } from './util.js';
import {
  WORLD_W, WORLD_H, AVENUES, STREETS, BLOCK, ROAD_W,
  avenueX, streetY, districtAt,
} from './city.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

// Time of day: 0..24. Returns sky tint, light level and sun position.
export function daylight(hour) {
  if (hour >= 6 && hour < 9) return { sky: '#e8b478', light: 0.75, sun: 0.25, name: 'Morning' };
  if (hour >= 9 && hour < 17) return { sky: '#9fc8e8', light: 1.0, sun: 0.7, name: 'Day' };
  if (hour >= 17 && hour < 19.5) return { sky: '#e8805a', light: 0.62, sun: 0.12, name: 'Dusk' };
  if (hour >= 19.5 || hour < 5) return { sky: '#1a2438', light: 0.42, sun: 0, name: 'Night' };
  return { sky: '#c8a878', light: 0.6, sun: 0.05, name: 'Dawn' };
}

function drawBuilding(ctx, b, light, cam) {
  ctx.fillStyle = shade(b.color, Math.round((light - 0.7) * 60));
  ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(b.x - cam.x, b.y - cam.y + b.h - 6, b.w, 6);
  if (light < 0.7) {
    ctx.fillStyle = 'rgba(255,214,120,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 18));
    const rows = Math.max(1, Math.floor(b.h / 22));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + Math.floor(b.x)) % 5 === 0) {
          ctx.fillRect(b.x - cam.x + 4 + i * 18, b.y - cam.y + 4 + j * 22, 8, 10);
        }
      }
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeRect(b.x - cam.x + 0.5, b.y - cam.y + 0.5, b.w, b.h);
}

function drawRoads(ctx, cam) {
  ctx.fillStyle = '#2c2c30';
  for (let i = 0; i < AVENUES; i++) {
    ctx.fillRect(avenueX(i) - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD_H);
  }
  for (let j = 0; j < STREETS; j++) {
    ctx.fillRect(-cam.x, streetY(j) - ROAD_W / 2 - cam.y, WORLD_W, ROAD_W);
  }
  ctx.strokeStyle = 'rgba(240,220,120,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (let i = 0; i < AVENUES; i++) {
    ctx.beginPath();
    ctx.moveTo(avenueX(i) - cam.x, -cam.y);
    ctx.lineTo(avenueX(i) - cam.x, WORLD_H - cam.y);
    ctx.stroke();
  }
  for (let j = 0; j < STREETS; j++) {
    ctx.beginPath();
    ctx.moveTo(-cam.x, streetY(j) - cam.y);
    ctx.lineTo(WORLD_W - cam.x, streetY(j) - cam.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < AVENUES; i++) {
    ctx.beginPath();
    ctx.moveTo(avenueX(i) - ROAD_W / 2 - cam.x, -cam.y);
    ctx.lineTo(avenueX(i) - ROAD_W / 2 - cam.x, WORLD_H - cam.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(avenueX(i) + ROAD_W / 2 - cam.x, -cam.y);
    ctx.lineTo(avenueX(i) + ROAD_W / 2 - cam.x, WORLD_H - cam.y);
    ctx.stroke();
  }
  for (let j = 0; j < STREETS; j++) {
    ctx.beginPath();
    ctx.moveTo(-cam.x, streetY(j) - ROAD_W / 2 - cam.y);
    ctx.lineTo(WORLD_W - cam.x, streetY(j) - ROAD_W / 2 - cam.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-cam.x, streetY(j) + ROAD_W / 2 - cam.y);
    ctx.lineTo(WORLD_W - cam.x, streetY(j) + ROAD_W / 2 - cam.y);
    ctx.stroke();
  }
}

function drawCar(ctx, c, cam, time) {
  const x = c.x - cam.x;
  const y = c.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 4, c.w, c.h);
  ctx.fillStyle = c.color;
  ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
  ctx.fillStyle = 'rgba(180,220,255,0.75)';
  ctx.fillRect(c.w * 0.08, -c.h / 2 + 3, c.w * 0.22, c.h - 6);
  ctx.fillStyle = '#16161a';
  ctx.fillRect(-c.w / 2 + 3, -c.h / 2 - 2, 7, 4);
  ctx.fillRect(-c.w / 2 + 3, c.h / 2 - 2, 7, 4);
  ctx.fillRect(c.w / 2 - 10, -c.h / 2 - 2, 7, 4);
  ctx.fillRect(c.w / 2 - 10, c.h / 2 - 2, 7, 4);
  if (c.taxi) {
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -c.h / 2 - 5, 14, 5);
    ctx.fillStyle = '#ffe14a';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('TAXI', -4, -c.h / 2 - 6);
  }
  if (c.police) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-c.w / 2 + 8, -c.h / 2, c.w * 0.3, c.h);
    ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff2a2a' : '#2a5aff';
    ctx.beginPath();
    ctx.arc(0, -c.h / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#2a5aff' : '#ff2a2a';
    ctx.beginPath();
    ctx.arc(6, -c.h / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(c.w / 2 - 2, -c.h / 2 + 2, 3, 4);
  ctx.fillRect(c.w / 2 - 2, c.h / 2 - 6, 3, 4);
  ctx.restore();
}

function drawPed(ctx, p, cam) {
  const x = p.x - cam.x;
  const y = p.y - cam.y;
  const bob = Math.sin(p.walkPhase) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 7, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.fillRect(x - 4, y - 6 + bob, 8, 12);
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(x, y - 10 + bob, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(x - 3, y - 6 + bob, 2, 6);
  ctx.fillRect(x + 1, y - 6 + bob, 2, 6);
}

function drawThug(ctx, t, cam) {
  const x = t.x - cam.x;
  const y = t.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a1a1a';
  ctx.fillRect(x - 6, y - 8, 12, 16);
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(x, y - 12, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(x - 5, y - 17, 10, 4);
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 4, y - 4, 12, 3);
  // Health bar so the fight reads at a glance.
  ctx.fillStyle = '#222';
  ctx.fillRect(x - 10, y - 24, 20, 4);
  ctx.fillStyle = '#e84a4a';
  ctx.fillRect(x - 10, y - 24, 20 * Math.max(0, t.health / 60), 4);
}

function drawPlayer(ctx, pl, cam, time) {
  const x = pl.x - cam.x;
  const y = pl.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 9, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pl.angle);
  ctx.fillStyle = '#c22a3a';
  ctx.fillRect(-6, -7, 12, 14);
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(6, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(2, -5.5, 7, 11);
  if (pl.hasGun) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 10, 3);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 14 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMarker(ctx, x, y, cam, color, label) {
  const sx = x - cam.x;
  const sy = y - cam.y;
  const bob = Math.sin(Date.now() / 300) * 4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 26 + bob);
  ctx.lineTo(sx - 9, sy - 44 + bob);
  ctx.lineTo(sx + 9, sy - 44 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▼', sx, sy - 30 + bob);
  if (label) {
    ctx.font = 'bold 12px sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, sx, sy - 50 + bob);
    ctx.fillStyle = '#ffe14a';
    ctx.fillText(label, sx, sy - 50 + bob);
  }
  ctx.textAlign = 'left';
}

export function drawWorld(ctx, s, time) {
  const cam = s.camera;
  const dl = daylight(s.hour);
  ctx.fillStyle = dl.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // District ground tint
  for (const d of s.cityDistricts) {
    ctx.fillStyle = d.base;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(d.x0 - cam.x, d.y0 - cam.y, d.x1 - d.x0, d.y1 - d.y0);
    ctx.globalAlpha = 1;
  }
  drawRoads(ctx, cam);
  for (const p of s.city.parks) {
    ctx.fillStyle = '#3f7a3a';
    ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
    ctx.fillStyle = '#57a04a';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(p.x + 20 + i * 28 - cam.x, p.y + 30 + (i % 3) * 50 - cam.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const b of s.city.buildings) {
    if (b.x + b.w < cam.x - 40 || b.x > cam.x + VIEW_W + 40) continue;
    if (b.y + b.h < cam.y - 40 || b.y > cam.y + VIEW_H + 40) continue;
    drawBuilding(ctx, b, dl.light, cam);
  }
  for (const lm of s.city.landmarks) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lm.name, lm.x - cam.x, lm.y - cam.y - 34);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(lm.x - cam.x, lm.y - cam.y - 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of s.peds) drawPed(ctx, p, cam);
  for (const t of s.thugs) drawThug(ctx, t, cam);
  for (const c of s.traffic) drawCar(ctx, c, cam, time);
  for (const c of s.police) drawCar(ctx, c, cam, time);
  if (s.player.inCar) drawCar(ctx, s.player.inCar, cam, time);
  else drawPlayer(ctx, s.player, cam, time);
  // Objective + fare markers
  const step = s.currentStep;
  if (step && step.x !== undefined) {
    drawMarker(ctx, step.x, step.y, cam, '#ffe14a', s.missionTitle);
  }
  if (s.ms.taxiFare) {
    const f = s.ms.taxiFare;
    if (f.stage === 'pickup') drawMarker(ctx, f.px, f.py, cam, '#7fd4c1', 'FARE');
    else drawMarker(ctx, f.dx, f.dy, cam, '#7fd4c1', 'DROP-OFF');
  }
  // Muzzle / impact sparks
  for (const e of s.effects) {
    ctx.fillStyle = e.color;
    ctx.globalAlpha = clamp(e.life / e.max, 0, 1);
    ctx.beginPath();
    ctx.arc(e.x - cam.x, e.y - cam.y, e.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Dusk + night overlay
  if (dl.light < 1) {
    ctx.fillStyle = 'rgba(10,16,48,' + (0.55 * (1 - dl.light)).toFixed(2) + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // Rain
  if (s.rain > 0) {
    ctx.strokeStyle = 'rgba(180,200,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = (i * 137 + time * 900) % (VIEW_W + 40) - 20;
      const ry = (i * 89 + time * 1400) % (VIEW_H + 40) - 20;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 6, ry + 16);
    }
    ctx.stroke();
  }
  // Sun glow at dusk
  if (dl.name === 'Dusk') {
    const g = ctx.createRadialGradient(VIEW_W * 0.8, 130, 10, VIEW_W * 0.8, 130, 260);
    g.addColorStop(0, 'rgba(255,170,80,0.5)');
    g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

export function drawMinimap(ctx, s) {
  const mw = 220;
  const mh = 165;
  const mx = VIEW_W - mw - 14;
  const my = 14;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx - 4.5, my - 4.5, mw + 9, mh + 9);
  for (const d of s.cityDistricts) {
    ctx.fillStyle = d.base;
    ctx.fillRect(mx + d.x0 * sx, my + d.y0 * sy, (d.x1 - d.x0) * sx, (d.y1 - d.y0) * sy);
  }
  ctx.fillStyle = '#3a3a40';
  for (let i = 0; i < AVENUES; i++) ctx.fillRect(mx + avenueX(i) * sx - 1, my, 2, mh);
  for (let j = 0; j < STREETS; j++) ctx.fillRect(mx, my + streetY(j) * sy - 1, mw, 2);
  const step = s.currentStep;
  if (step && step.x !== undefined) {
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(mx + step.x * sx, my + step.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of s.police) {
    ctx.fillStyle = '#4a8aff';
    ctx.beginPath();
    ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff4a4a';
  ctx.beginPath();
  ctx.arc(mx + s.player.x * sx, my + s.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + s.player.x * sx, my + s.player.y * sy, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('VICE HARBOR', mx + 2, my + mh - 4);
}

export function drawHUD(ctx, s) {
  const pl = s.player;
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  ctx.fillRect(12, 12, 300, 86);
  ctx.strokeStyle = 'rgba(255,225,74,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12.5, 12.5, 300, 86);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(s.cashText, 24, 40);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#b8c8d8';
  ctx.fillText('Debt to Donna: ' + s.debtText, 24, 60);
  ctx.fillText(s.districtName + '  •  ' + s.timeText, 24, 80);
  // Health bar
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 88, 120, 8);
  ctx.fillStyle = pl.health > 40 ? '#4ad86a' : '#e84a4a';
  ctx.fillRect(24, 88, 120 * clamp(pl.health / 100, 0, 1), 8);
  // Wanted stars
  ctx.font = '26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < s.wanted ? '#ffe14a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 330 + i * 30, 44);
  }
  if (s.wanted > 0) {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('VHPD ON YOUR TAIL', 330, 66);
  }
  // Speed + vehicle
  if (pl.inCar) {
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    ctx.fillRect(VIEW_W - 250, VIEW_H - 74, 236, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(Math.round(Math.abs(pl.inCar.speed) * 0.9) + ' km/h', VIEW_W - 238, VIEW_H - 42);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#b8c8d8';
    ctx.fillText(pl.inCar.name, VIEW_W - 238, VIEW_H - 22);
  } else {
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    ctx.fillRect(12, VIEW_H - 74, 330, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText('On foot — E: steal / enter car   F: punch   Click: shoot' + (pl.hasGun ? '' : ' (no gun yet)'), 24, VIEW_H - 50);
    ctx.fillStyle = '#b8c8d8';
    ctx.fillText('WASD move   M: mission   N: taxi fare   H: help', 24, VIEW_H - 30);
  }
  // Mission objective
  if (s.objectiveText) {
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    ctx.fillRect(12, 108, 420, 34);
    ctx.fillStyle = '#ffe14a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('▶ ' + s.objectiveText, 24, 130);
  }
  if (s.ms.banner && s.ms.bannerT > 0) {
    ctx.fillStyle = 'rgba(20,60,30,0.85)';
    ctx.fillRect(VIEW_W / 2 - 260, 110, 520, 36);
    ctx.fillStyle = '#a8f0b8';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.ms.banner, VIEW_W / 2, 134);
    ctx.textAlign = 'left';
  }
  // Dialog box
  if (s.ms.dialog) {
    const d = s.ms.dialog;
    ctx.fillStyle = 'rgba(10,10,16,0.88)';
    ctx.fillRect(180, VIEW_H - 210, 920, 140);
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = 2;
    ctx.strokeRect(180.5, VIEW_H - 209.5, 920, 140);
    ctx.fillStyle = '#ffe14a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(d.name + '  —  ' + d.title, 204, VIEW_H - 176);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    wrapText(ctx, d.lines[0], 204, VIEW_H - 148, 872, 22);
    ctx.fillStyle = '#b8c8d8';
    ctx.font = '12px sans-serif';
    ctx.fillText('Press ENTER to continue', 204, VIEW_H - 84);
  }
  drawMinimap(ctx, s);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawStartScreen(ctx, s, time) {
  const dl = daylight(17.6);
  ctx.fillStyle = dl.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(20,10,20,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffe14a';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR', VIEW_W / 2, 240);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('— VICE HARBOR —', VIEW_W / 2, 292);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ffd8d8';
  ctx.fillText('Mara Voss owes Donna Ferrante $10,000. Five jobs. One city. No way out but through.', VIEW_W / 2, 340);
  ctx.fillStyle = 'rgba(8,12,20,0.8)';
  ctx.fillRect(VIEW_W / 2 - 300, 380, 600, 150);
  ctx.strokeStyle = '#ffe14a';
  ctx.strokeRect(VIEW_W / 2 - 299.5, 380.5, 600, 150);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  const lines = [
    'WASD / Arrows — move & drive      E — steal / enter car',
    'F — punch      Click — shoot (after Mission 2)',
    'M — start mission      N — taxi fare      P — pause',
    'Steal cars, dodge the VHPD, pay the debt.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 412 + i * 26));
  ctx.fillStyle = Math.floor(time * 2) % 2 === 0 ? '#ffe14a' : '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('PRESS ENTER TO START', VIEW_W / 2, 580);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#b8c8d8';
  ctx.fillText('Progress saves automatically • Sound: WebAudio synth • M: mute', VIEW_W / 2, 620);
  ctx.textAlign = 'left';
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
  ctx.font = '16px sans-serif';
  ctx.fillText('Press P to resume', VIEW_W / 2, VIEW_H / 2 + 40);
  ctx.textAlign = 'left';
}

export function drawGameOver(ctx, s) {
  ctx.fillStyle = 'rgba(20,0,0,0.75)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.storyDone ? 'DEBT PAID — YOU WIN' : 'BUSTED', VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(s.storyDone
    ? 'Mara Voss is free. Vice Harbor is yours now.'
    : 'The VHPD caught up with you. Press R to try again.',
  VIEW_W / 2, 350);
  ctx.fillText('Cash: ' + s.cashText + '   •   Missions done: ' + s.missionsDone + ' / 5', VIEW_W / 2, 390);
  ctx.textAlign = 'left';
}

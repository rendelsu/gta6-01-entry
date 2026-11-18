// Rendering for SOLMAR — Vice Harbor: world, lighting, HUD, minimap, screens.
import { clamp, lerp, dist } from './util.js';
import { WORLD_W, WORLD_H, ROAD_W, avenueX, streetY, AVENUES, STREETS, districtAt } from './city.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

export function timeOfDayName(t) {
  if (t < 5) return 'MALAM';
  if (t < 7) return 'FAJAR';
  if (t < 11) return 'PAGI';
  if (t < 16) return 'SIANG';
  if (t < 19) return 'SENJA';
  if (t < 21) return 'MALAM';
  return 'MALAM';
}

// Sky / light palette by hour (0-24).
export function lightFor(hour) {
  if (hour >= 6 && hour < 11) return { sky: '#9fc3e0', overlay: null, amb: 1 };
  if (hour >= 11 && hour < 16) return { sky: '#a8c8e8', overlay: null, amb: 1 };
  if (hour >= 16 && hour < 19) return { sky: '#e8915a', overlay: 'rgba(232,120,50,0.14)', amb: 0.96 };
  if (hour >= 19 && hour < 21) return { sky: '#5a4a7a', overlay: 'rgba(40,30,90,0.30)', amb: 0.9 };
  return { sky: '#1c2340', overlay: 'rgba(8,10,40,0.45)', amb: 0.85 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, state) {
  const cam = state.camera;
  const light = lightFor(state.hour);
  ctx.fillStyle = light.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-cam.x + VIEW_W / 2, -cam.y + VIEW_H / 2);
  if (state.shake > 0) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);

  const vx0 = cam.x - VIEW_W / 2 - 80, vy0 = cam.y - VIEW_H / 2 - 80;
  const vx1 = cam.x + VIEW_W / 2 + 80, vy1 = cam.y + VIEW_H / 2 + 80;

  // Ground by district.
  for (const d of state.cityDistricts) {
    if (d.x + d.w < vx0 || d.x > vx1 || d.y + d.h < vy0 || d.y > vy1) continue;
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(d.name, d.x + 60, d.y + 90);
  }
  // Water: marina along the west edge and the harbor south.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(0, 0, 90, WORLD_H);
  ctx.fillRect(0, WORLD_H - 60, WORLD_W, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 40; i++) {
    const wx = 12 + ((i * 37) % 60);
    const wy = (i * 173) % WORLD_H;
    ctx.fillRect(wx, wy, 26, 2);
  }

  // Parks.
  for (const pk of state.city.parks) {
    if (pk.x + pk.w < vx0 || pk.x > vx1 || pk.y + pk.h < vy0 || pk.y > vy1) continue;
    ctx.fillStyle = '#4a8f4a';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#2f6b2f';
    for (let t = 0; t < pk.trees; t++) {
      const tx = pk.x + 20 + ((t * 47) % (pk.w - 40));
      const ty = pk.y + 20 + ((t * 89) % (pk.h - 40));
      ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(pk.x + pk.w / 2 - 8, pk.y, 16, pk.h);
  }

  // Roads.
  ctx.fillStyle = '#3a3f46';
  for (let i = 0; i < AVENUES; i++) ctx.fillRect(avenueX(i) - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (let j = 0; j < STREETS; j++) ctx.fillRect(0, streetY(j) - ROAD_W / 2, WORLD_W, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = '#8a8f96';
  for (let i = 0; i < AVENUES; i++) {
    ctx.fillRect(avenueX(i) - ROAD_W / 2 - 10, 0, 10, WORLD_H);
    ctx.fillRect(avenueX(i) + ROAD_W / 2, 0, 10, WORLD_H);
  }
  for (let j = 0; j < STREETS; j++) {
    ctx.fillRect(0, streetY(j) - ROAD_W / 2 - 10, WORLD_W, 10);
    ctx.fillRect(0, streetY(j) + ROAD_W / 2, WORLD_W, 10);
  }
  // Lane dashes.
  ctx.fillStyle = '#e8d44d';
  for (let i = 0; i < AVENUES; i++) {
    for (let y = 40; y < WORLD_H; y += 80) ctx.fillRect(avenueX(i) - 2, y, 4, 40);
  }
  for (let j = 0; j < STREETS; j++) {
    for (let x = 40; x < WORLD_W; x += 80) ctx.fillRect(x, streetY(j) - 2, 40, 4);
  }

  // Buildings with windows and roof detail.
  for (const b of state.city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x, b.y, b.w, 10);
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor(b.h / 34));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const lit = ((cx * 7 + cy * 13 + Math.floor(b.seed * 100)) % 5) < 2;
        ctx.fillStyle = lit ? '#ffe9a8' : '#2c3550';
        ctx.fillRect(b.x + 8 + cx * ((b.w - 16) / cols), b.y + 14 + cy * ((b.h - 20) / rows), 14, 12);
      }
    }
    if (b.tall >= 6) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w / 2 - 16, b.y + b.h / 2 - 16, 32, 32);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(b.x + b.w / 2 - 3, b.y + 6, 6, 6);
    }
  }
  // Shop fronts with signs.
  ctx.textAlign = 'left';
  for (const s of state.city.shops) {
    if (s.x + s.w < vx0 || s.x > vx1 || s.y + s.h < vy0 || s.y > vy1) continue;
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(s.name, s.x + 4, s.y + 17, s.w - 6);
  }

  drawMarkers(ctx, state);
  drawPeds(ctx, state);
  drawVehicles(ctx, state);
  drawPlayer(ctx, state);
  drawBullets(ctx, state);
  drawParticles(ctx, state);

  ctx.restore();

  // Night / dusk overlay + headlights + rain, drawn in screen space.
  if (light.overlay) {
    ctx.fillStyle = light.overlay;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (state.hour >= 19 || state.hour < 6) drawHeadlights(ctx, state);
  if (state.rain > 0) drawRain(ctx, state);
}

function drawMarkers(ctx, state) {
  const ms = state.missions;
  const m = state.missions.active ? state.missions.list[state.missions.index] : null;
  const step = m && ms.active ? m.steps[ms.step] : null;
  if (step) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.save();
    ctx.translate(step.x, step.y);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(241,196,15,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(10, -34); ctx.lineTo(-10, -34); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(step.label, step.x, step.y - 62);
    ctx.textAlign = 'left';
  }
  if (state.taxi.dest) {
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(state.taxi.dest.x, state.taxi.dest.y, 26, 0, Math.PI * 2); ctx.stroke();
  }
  if (state.taxi.passenger) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', state.taxi.passenger.x, state.taxi.passenger.y - 18);
    ctx.textAlign = 'left';
  }
}

function drawPeds(ctx, state) {
  for (const ped of state.peds) {
    if (ped.dead) {
      ctx.fillStyle = '#5a2a2a';
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 12, 7, ped.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(ped.x, ped.y + bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(ped.x, ped.y + 3 + bob * 0.3, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(ped.x, ped.y - 7 + bob * 0.3, 5, 0, Math.PI * 2); ctx.fill();
    if (ped.thug) {
      ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ped.x, ped.y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff5555';
      for (let h = 0; h < ped.health; h++) ctx.fillRect(ped.x - 12 + h * 9, ped.y - 24, 7, 4);
    }
    if (ped.panic > 0) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('!', ped.x + 10, ped.y - 12);
    }
  }
}

function drawVehicles(ctx, state) {
  const all = [...state.traffic, ...state.police];
  for (const v of all) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -v.len / 2 + 3, -v.wid / 2 + 4, v.len, v.wid, 6); ctx.fill();
    ctx.fillStyle = v.color;
    roundRect(ctx, -v.len / 2, -v.wid / 2, v.len, v.wid, 7); ctx.fill();
    // Roof + windshield.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, -v.len / 2 + 10, -v.wid / 2 + 4, v.len - 22, v.wid - 8, 5); ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(v.len / 2 - 16, -v.wid / 2 + 3, 8, v.wid - 6);
    ctx.fillRect(-v.len / 2 + 8, -v.wid / 2 + 3, 6, v.wid - 6);
    // Headlights / taillights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(v.len / 2 - 2, -v.wid / 2 + 2, 3, 5);
    ctx.fillRect(v.len / 2 - 2, v.wid / 2 - 7, 3, 5);
    ctx.fillStyle = v.brakeLight ? '#ff2222' : '#aa2222';
    ctx.fillRect(-v.len / 2 - 1, -v.wid / 2 + 2, 3, 5);
    ctx.fillRect(-v.len / 2 - 1, v.wid / 2 - 7, 3, 5);
    if (v.police) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, -v.wid / 2, 12, v.wid);
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VHPD', 0, 3);
      ctx.textAlign = 'left';
      const on = Math.floor(state.time * 4) % 2 === 0;
      ctx.fillStyle = on ? '#ff2222' : '#2266ff';
      ctx.beginPath(); ctx.arc(-v.len / 2 + 8, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? '#2266ff' : '#ff2222';
      ctx.beginPath(); ctx.arc(v.len / 2 - 8, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (v.type === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-8, -v.wid / 2 - 4, 16, 4);
    }
    if (v.damage > 60) {
      ctx.fillStyle = 'rgba(40,40,40,0.7)';
      ctx.beginPath(); ctx.arc(v.len / 2 - 8, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Target-car marker for the steal mission.
    if (state.missions.targetCar === v.id && state.missions.active) {
      ctx.fillStyle = '#e67e22';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TARGET', v.x, v.y - 26);
      ctx.textAlign = 'left';
    }
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (state.playerCar) return; // drawn as the car itself
  const bob = p.moving ? Math.sin(state.time * 12) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 6, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.arc(0, 2 + bob * 0.3, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(0, -6 + bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(0, -12 + bob * 0.3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(0, -15 + bob * 0.3, 5, Math.PI, 0); ctx.fill();
  // Facing tick + punch flash.
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 16, Math.sin(p.angle) * 16); ctx.stroke();
  if (state.punchTimer > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 22, Math.sin(p.angle) * 22, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBullets(ctx, state) {
  ctx.fillStyle = '#ffe14d';
  for (const b of state.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHeadlights(ctx, state) {
  const cam = state.camera;
  const cars = [...state.traffic, ...state.police];
  if (state.playerCar) cars.push(state.playerCar);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const v of cars) {
    const sx = v.x - cam.x + VIEW_W / 2;
    const sy = v.y - cam.y + VIEW_H / 2;
    if (sx < -120 || sx > VIEW_W + 120 || sy < -120 || sy > VIEW_H + 120) continue;
    const fx = Math.cos(v.angle), fy = Math.sin(v.angle);
    const grad = ctx.createRadialGradient(sx + fx * 60, sy + fy * 60, 4, sx + fx * 60, sy + fy * 60, 130);
    grad.addColorStop(0, 'rgba(255,230,150,0.28)');
    grad.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx + fx * 60, sy + fy * 60, 130, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawRain(ctx, state) {
  ctx.strokeStyle = 'rgba(180,200,230,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 130; i++) {
    const rx = ((i * 97 + state.time * 700) % (VIEW_W + 40)) - 20;
    const ry = ((i * 173 + state.time * 900) % (VIEW_H + 40)) - 20;
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 6, ry + 14);
  }
  ctx.stroke();
}

// --- HUD ----------------------------------------------------------------------
export function drawHUD(ctx, state) {
  const p = state.player;
  // Top-left: cash, health, wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 250, 84, 8); ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('$' + state.cash.toLocaleString('en-US'), 24, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('UTANG: $' + (10000 - state.missions.debtPaid).toLocaleString('en-US') + ' / $10.000', 24, 64);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 72, 120, 10);
  ctx.fillStyle = p.health > 40 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(24, 72, 120 * clamp(p.health / 100, 0, 1), 10);
  // Wanted stars top-right of the cash box.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#f1c40f' : 'rgba(255,255,255,0.25)';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('★', 168 + i * 20, 44);
  }
  // Mission objective bottom-left.
  const obj = state.missionObjectiveText;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const ow = Math.min(560, 24 + obj.length * 7.2);
  roundRect(ctx, 12, VIEW_H - 66, ow, 54, 8); ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('◆ ' + obj, 24, VIEW_H - 42);
  ctx.fillStyle = '#ddd';
  ctx.font = '12px system-ui, sans-serif';
  const sub = state.missions.active
    ? 'Misi ' + (state.missions.index + 1) + ' dari 5 — ' + (state.missions.done.length ? state.missions.done.length + ' selesai' : 'baru dimulai')
    : 'Tekan M untuk memulai misi berikutnya';
  ctx.fillText(sub, 24, VIEW_H - 24);
  // Speed + vehicle when driving.
  if (state.playerCar) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, VIEW_W - 232, VIEW_H - 66, 220, 54, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(Math.round(Math.abs(state.playerCar.speed) * 0.36) + ' km/h', VIEW_W - 220, VIEW_H - 40);
    ctx.fillStyle = '#ccc';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(state.playerCar.name + (state.playerCar.damage > 0 ? ' — rusak ' + Math.round(state.playerCar.damage) + '%' : ''), VIEW_W - 220, VIEW_H - 22);
  }
  // Time + district.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, VIEW_W - 232, 12, 220, 34, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const hh = Math.floor(state.hour), mm = Math.floor((state.hour - hh) * 60);
  ctx.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  ' + timeOfDayName(state.hour), VIEW_W - 220, 35);
  drawMinimap(ctx, state);
  // Dialog box.
  const dlg = state.missions.dialog;
  if (dlg && state.time < dlg.until) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    roundRect(ctx, VIEW_W / 2 - 340, VIEW_H - 150, 680, 74, 10); ctx.fill();
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
    roundRect(ctx, VIEW_W / 2 - 340, VIEW_H - 150, 680, 74, 10); ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, dlg.text, VIEW_W / 2 - 322, VIEW_H - 124, 644, 20);
  }
  // Busted / wasted flash.
  if (state.busted) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('VHPD menangkapmu — denda $200', VIEW_W / 2, VIEW_H / 2 + 30);
    ctx.textAlign = 'left';
  }
  if (state.wasted) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Mara dirawat di rumah sakit — $150', VIEW_W / 2, VIEW_H / 2 + 30);
    ctx.textAlign = 'left';
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w; yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawMinimap(ctx, state) {
  const mw = 190, mh = 142;
  const mx = VIEW_W - mw - 12, my = 56;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  ctx.fillStyle = '#20262e';
  ctx.fillRect(mx, my, mw, mh);
  for (const d of state.cityDistricts) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(mx + d.x * sx, my + d.y * sy, d.w * sx, d.h * sy);
  }
  ctx.fillStyle = '#3a3f46';
  for (let i = 0; i < AVENUES; i++) ctx.fillRect(mx + avenueX(i) * sx - 1, my, 2, mh);
  for (let j = 0; j < STREETS; j++) ctx.fillRect(mx, my + streetY(j) * sy - 1, mw, 2);
  // Mission marker.
  const m = state.missions.active ? state.missions.list[state.missions.index] : null;
  const step = m && state.missions.active ? m.steps[state.missions.step] : null;
  if (step) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(mx + step.x * sx, my + step.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Police dots.
  ctx.fillStyle = '#5dade2';
  for (const cop of state.police) {
    ctx.beginPath(); ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = state.player;
  const px = state.playerCar ? state.playerCar.x : p.x;
  const py = state.playerCar ? state.playerCar.y : p.y;
  const pa = state.playerCar ? state.playerCar.angle : p.angle;
  ctx.save();
  ctx.translate(mx + px * sx, my + py * sy);
  ctx.rotate(pa);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // North + district label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('N', mx + mw - 12, my + 14);
  ctx.fillStyle = '#ddd';
  ctx.font = '11px system-ui, sans-serif';
  const d = districtAt(px, py);
  ctx.fillText(d.name, mx + 2, my + mh - 6);
}

// --- Screens -------------------------------------------------------------------
export function drawStartScreen(ctx, state) {
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Sunset gradient sky.
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#2b1a4a');
  g.addColorStop(0.55, '#c65a3a');
  g.addColorStop(1, '#f2a65a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H * 0.62);
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(VIEW_W / 2, 300, 90, 0, Math.PI * 2); ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = '#1a1426';
  let bx = 0;
  for (let i = 0; i < 26; i++) {
    const bw = 40 + ((i * 53) % 60);
    const bh = 120 + ((i * 97) % 220);
    ctx.fillRect(bx, 448 - bh, bw, bh);
    bx += bw + 6;
  }
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 448, VIEW_W, VIEW_H - 448);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5c542';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.fillText('SOLMAR', VIEW_W / 2, 200);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('— VICE HARBOR —', VIEW_W / 2, 248);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('Mara Voss berutang $10.000 ke Donna Ferrante. Satu minggu. Satu kota. Lima misi.', VIEW_W / 2, 500);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  const blink = Math.floor(state.time * 2) % 2 === 0;
  if (blink) ctx.fillText('TEKAN ENTER ATAU KLIK UNTUK MULAI', VIEW_W / 2, 560);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#c9c9c9';
  ctx.fillText('WASD bergerak / mengemudi  •  E masuk & keluar mobil  •  Spasi pukul  •  Klik tembak  •  M misi  •  P jeda', VIEW_W / 2, 610);
  ctx.fillText('Kota 3840×2880  •  5 distrik  •  8 tipe kendaraan  •  VHPD  •  Taksi  •  Save otomatis', VIEW_W / 2, 634);
  ctx.textAlign = 'left';
}

export function drawPauseScreen(ctx, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('JEDA', VIEW_W / 2, VIEW_H / 2 - 40);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Misi: ' + (state.missions.done.length) + '/5 selesai  •  Utang terbayar $' + state.missions.debtPaid + ' / $10.000', VIEW_W / 2, VIEW_H / 2 + 10);
  ctx.fillText('P lanjut  •  M mulai misi  •  R mulai ulang dari save', VIEW_W / 2, VIEW_H / 2 + 44);
  ctx.textAlign = 'left';
}

export function drawHelpScreen(ctx, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#f5c542';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('CARA BERMAIN', 60, 70);
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  const lines = [
    'WASD / Panah — jalan kaki atau mengemudi',
    'E — masuk / keluar mobil (curi mobil yang terparkir atau di jalan)',
    'Spasi — pukul pejalan kaki, penagih, atau polisi (menaikkan wanted)',
    'Klik mouse — tembak ke arah kursor (pistol, peluru tak terbatas)',
    'M — mulai misi cerita berikutnya (5 misi: utang $10.000 ke Donna Ferrante)',
    'T — klakson.  H — layar bantuan ini.  P — jeda.  N — bisukan suara.',
    'Naik taksi kuning untuk mengantar penumpang dan dapat fare.',
    'Wanted 0–5 bintang: polisi VHPD mengejar; sembunyi sampai dingin.',
    'Kesehatan habis = WASTED (rumah sakit, -$150). Ditangkap = BUSTED (-$200).',
    'Progress tersimpan otomatis di browser (localStorage).',
  ];
  lines.forEach((l, i) => ctx.fillText('•  ' + l, 60, 120 + i * 34));
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('Tekan H lagi untuk kembali.', 60, 120 + lines.length * 34 + 10);
}

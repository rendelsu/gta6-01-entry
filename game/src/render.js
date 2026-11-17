// Rendering: the static city is pre-rendered once into ground tiles, then each
// frame draws the visible tiles, the buildings and the moving world sorted by
// depth, particles, and a golden-hour grade on top. No allocation in the hot
// loop: tiles and gradients are built once at init.
import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_WIDTH, SIDEWALK, PAL, VIEW_W, VIEW_H, CAR_LENGTH, CAR_WIDTH } from './config.js';
import { clamp } from './random.js';

const TILE = 640;
const TILES_X = Math.ceil(WORLD_W / TILE);
const TILES_Y = Math.ceil(WORLD_H / TILE);

export function initGround(G) {
  G.groundTiles = [];
  for (let ty = 0; ty < TILES_Y; ty++) {
    G.groundTiles[ty] = [];
    for (let tx = 0; tx < TILES_X; tx++) {
      const c = document.createElement('canvas');
      c.width = TILE; c.height = TILE;
      const ctx = c.getContext('2d');
      drawGroundTile(ctx, tx * TILE, ty * TILE, TILE, TILE, G);
      G.groundTiles[ty][tx] = c;
    }
  }
  // Sun glare + vignette gradients, built once, drawn in screen space.
  const glare = document.createElement('canvas');
  glare.width = VIEW_W; glare.height = VIEW_H;
  const gctx = glare.getContext('2d');
  const grad = gctx.createRadialGradient(VIEW_W * 0.82, -60, 40, VIEW_W * 0.82, -60, 620);
  grad.addColorStop(0, 'rgba(255, 214, 130, 0.20)');
  grad.addColorStop(0.5, 'rgba(255, 190, 110, 0.07)');
  grad.addColorStop(1, 'rgba(255, 190, 110, 0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const vig = gctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(20,10,0,0.28)');
  gctx.fillStyle = vig;
  gctx.fillRect(0, 0, VIEW_W, VIEW_H);
  G.gradeCanvas = glare;
}

function drawGroundTile(ctx, ox, oy, w, h, G) {
  // Base grass.
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(0, 0, w, h);
  // Mow stripes for a little texture.
  ctx.fillStyle = PAL.grassDark;
  for (let y = 0; y < h; y += 64) {
    if ((((oy + y) / 64) | 0) % 2 === 0) ctx.fillRect(0, y, w, 32);
  }
  // Central park.
  drawRectIfOverlap(ctx, ox, oy, 836, 836, 248, 248, PAL.parkGrass);
  // Plaza del Sol.
  drawRectIfOverlap(ctx, ox, oy, 836, 1156, 248, 248, PAL.plaza);
  // Beach sand and water along the south edge.
  drawRectIfOverlap(ctx, ox, oy, 0, 2368, WORLD_W, 112, PAL.sand);
  drawRectIfOverlap(ctx, ox, oy, 0, 2480, WORLD_W, 80, PAL.water);
  ctx.fillStyle = PAL.waterDeep;
  for (let x = 0; x < w; x += 48) {
    const wx = ox + x;
    if (wx < WORLD_W) ctx.fillRect(x, 2508 - oy + Math.sin(wx * 0.01) * 4, 30, 3);
  }
  // Docks concrete on the east edge.
  drawRectIfOverlap(ctx, ox, oy, 2400, 0, 160, 2368, '#8a8378');
  // Roads: asphalt, sidewalks, lane dashes, crosswalks.
  for (const rx of ROAD_XS) {
    drawRoadV(ctx, ox, oy, rx, w, h);
  }
  for (const ry of ROAD_YS) {
    drawRoadH(ctx, ox, oy, ry, w, h);
  }
  // Park pond + paths.
  ctx.fillStyle = '#3f8fb0';
  ctx.beginPath();
  ctx.ellipse(960 - ox, 960 - oy, 52, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  // Trees.
  for (const t of G.city.trees) {
    if (t.x < ox || t.x >= ox + w || t.y < oy || t.y >= oy + h) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(t.x - ox + 3, t.y - oy + 4, t.r, t.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.tree;
    ctx.beginPath(); ctx.arc(t.x - ox, t.y - oy, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.treeLight;
    ctx.beginPath(); ctx.arc(t.x - ox - 2, t.y - oy - 2, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawRectIfOverlap(ctx, ox, oy, x, y, w, h, color) {
  const x0 = Math.max(x, ox), y0 = Math.max(y, oy);
  const x1 = Math.min(x + w, ox + ctx.canvas.width), y1 = Math.min(y + h, oy + ctx.canvas.height);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x0 - ox, y0 - oy, x1 - x0, y1 - y0);
}

function drawRoadV(ctx, ox, oy, rx, w, h) {
  const x0 = rx - ROAD_WIDTH / 2 - SIDEWALK;
  const x1 = rx + ROAD_WIDTH / 2 + SIDEWALK;
  if (x1 < ox || x0 > ox + w) return;
  ctx.fillStyle = PAL.sidewalk;
  ctx.fillRect(x0 - ox, 0, x1 - x0, h);
  ctx.fillStyle = PAL.asphalt;
  ctx.fillRect(rx - ROAD_WIDTH / 2 - ox, 0, ROAD_WIDTH, h);
  ctx.fillStyle = PAL.laneDash;
  for (let y = -((oy / 36) | 0) * 36; y < h + 36; y += 36) {
    const wy = oy + y;
    let inCross = false;
    for (const ry of ROAD_YS) if (Math.abs(wy - ry) < ROAD_WIDTH / 2 + SIDEWALK) { inCross = true; break; }
    if (!inCross) ctx.fillRect(rx - 2 - ox, y, 4, 18);
  }
  // Crosswalk stripes at every intersection.
  ctx.fillStyle = 'rgba(240, 236, 220, 0.85)';
  for (const ry of ROAD_YS) {
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(rx + i * 10 - 3 - ox, ry - ROAD_WIDTH / 2 - 8 - oy, 6, 12);
    }
  }
}

function drawRoadH(ctx, ox, oy, ry, w, h) {
  const y0 = ry - ROAD_WIDTH / 2 - SIDEWALK;
  const y1 = ry + ROAD_WIDTH / 2 + SIDEWALK;
  if (y1 < oy || y0 > oy + h) return;
  ctx.fillStyle = PAL.sidewalk;
  ctx.fillRect(0, y0 - oy, w, y1 - y0);
  ctx.fillStyle = PAL.asphalt;
  ctx.fillRect(0, ry - ROAD_WIDTH / 2 - oy, w, ROAD_WIDTH);
  ctx.fillStyle = PAL.laneDash;
  for (let x = -((ox / 36) | 0) * 36; x < w + 36; x += 36) {
    const wx = ox + x;
    let inCross = false;
    for (const rx of ROAD_XS) if (Math.abs(wx - rx) < ROAD_WIDTH / 2 + SIDEWALK) { inCross = true; break; }
    if (!inCross) ctx.fillRect(x, ry - 2 - oy, 18, 4);
  }
  ctx.fillStyle = 'rgba(240, 236, 220, 0.85)';
  for (const rx of ROAD_XS) {
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(rx - ROAD_WIDTH / 2 - 8 - ox, ry + i * 10 - 3 - oy, 12, 6);
    }
  }
}

// --- Per-frame world drawing ------------------------------------------------

export function drawWorld(ctx, G) {
  const cam = G.camera;
  const vw = VIEW_W / cam.zoom;
  const vh = VIEW_H / cam.zoom;
  const shakeX = (G.rng() - 0.5) * G.shake * 14;
  const shakeY = (G.rng() - 0.5) * G.shake * 14;
  const vx = clamp(cam.x - vw / 2 + shakeX, -40, WORLD_W - vw + 40);
  const vy = clamp(cam.y - vh / 2 + shakeY, -40, WORLD_H - vh + 40);
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-vx, -vy);

  // Ground tiles in view.
  const tx0 = Math.max(0, Math.floor(vx / TILE));
  const ty0 = Math.max(0, Math.floor(vy / TILE));
  const tx1 = Math.min(TILES_X - 1, Math.floor((vx + vw) / TILE));
  const ty1 = Math.min(TILES_Y - 1, Math.floor((vy + vh) / TILE));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      ctx.drawImage(G.groundTiles[ty][tx], tx * TILE, ty * TILE);
    }
  }

  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,24,0.35)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const s of G.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 3) * 0.7;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
    ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Depth-sorted drawables: buildings by south edge, everything else by y.
  const items = [];
  for (const b of G.city.buildings) {
    if (b.x + b.w < vx - 80 || b.x > vx + vw + 80 || b.y + b.h < vy - 120 || b.y > vy + vh + 80) continue;
    items.push({ y: b.y + b.h, kind: 'building', b });
  }
  for (const car of G.cars) {
    if (car.dead) continue;
    items.push({ y: car.y + 20, kind: 'car', car });
  }
  for (const p of G.peds) {
    if (p.dead) continue;
    items.push({ y: p.y + 8, kind: 'ped', p });
  }
  for (const e of G.enemies) {
    if (e.dead) continue;
    items.push({ y: e.y + 8, kind: 'enemy', e });
  }
  for (const o of G.officers) {
    if (o.dead) continue;
    items.push({ y: o.y + 8, kind: 'ped', p: o });
  }
  if (!G.player.inCar) items.push({ y: G.player.y + 8, kind: 'player', p: G.player });
  for (const pkg of G.packagesLeft) items.push({ y: pkg.y, kind: 'package', pkg });
  for (const pk of G.pickups) items.push({ y: pk.y, kind: 'pickup', pk });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.kind === 'building') drawBuilding(ctx, it.b);
    else if (it.kind === 'car') drawCar(ctx, it.car, G);
    else if (it.kind === 'ped') drawPed(ctx, it.p, false);
    else if (it.kind === 'enemy') drawPed(ctx, it.e, true);
    else if (it.kind === 'player') drawPlayer(ctx, it.p, G);
    else if (it.kind === 'package') drawPackage(ctx, it.pkg, G);
    else if (it.kind === 'pickup') drawPickup(ctx, it.pk, G);
  }

  // Bullets.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Waypoint marker on the ground.
  const wp = G.waypoint;
  if (wp && G.mode === 'playing') {
    const pulse = 1 + Math.sin(G.time * 4) * 0.12;
    ctx.save();
    ctx.translate(wp.x, wp.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(0, -34); ctx.lineTo(10, -14); ctx.lineTo(-10, -14); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // Screen-space grade: sun glare + vignette, then damage flash.
  ctx.drawImage(G.gradeCanvas, 0, 0);
  if (G.damageFlash > 0) {
    ctx.fillStyle = `rgba(200, 30, 30, ${G.damageFlash * 0.35})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawBuilding(ctx, b) {
  const hgt = b.height;
  const lift = hgt * 0.45;
  // South wall.
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y - lift + b.h * 0.55, b.w, b.h * 0.45 + lift);
  // Windows on the wall.
  ctx.fillStyle = PAL.windowDark;
  const cols = Math.max(1, Math.floor(b.w / 26));
  const rows = Math.max(1, Math.floor((b.h * 0.45 + lift) / 26));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const wx = b.x + 8 + i * ((b.w - 16) / cols);
      const wy = b.y - lift + b.h * 0.55 + 6 + j * 24;
      ctx.fillRect(wx, wy, 10, 12);
    }
  }
  // Roof.
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x - 3, b.y - lift, b.w + 6, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x - 3, b.y - lift, b.w + 6, b.h);
  // Rooftop detail: vents / AC boxes.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(b.x + 10, b.y - lift + 10, 14, 10);
  ctx.fillRect(b.x + b.w - 26, b.y - lift + b.h - 22, 16, 12);
  if (b.label) {
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.fillRect(b.x + b.w / 2 - 44, b.y - lift + b.h / 2 - 11, 88, 22);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y - lift + b.h / 2 + 1);
  }
}

function drawCar(ctx, car, G) {
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(3, 4, CAR_LENGTH / 2 + 2, CAR_WIDTH / 2 + 3, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(-18, -CAR_WIDTH / 2 - 2, 10, 5);
  ctx.fillRect(8, -CAR_WIDTH / 2 - 2, 10, 5);
  ctx.fillRect(-18, CAR_WIDTH / 2 - 3, 10, 5);
  ctx.fillRect(8, CAR_WIDTH / 2 - 3, 10, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin + windows.
  ctx.fillStyle = '#232a33';
  roundRect(ctx, -8, -CAR_WIDTH / 2 + 4, 18, CAR_WIDTH - 8, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.5)';
  ctx.fillRect(-6, -CAR_WIDTH / 2 + 6, 5, CAR_WIDTH - 12);
  // Headlights.
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(CAR_LENGTH / 2 - 2, -CAR_WIDTH / 2 + 3, 3, 5);
  ctx.fillRect(CAR_LENGTH / 2 - 2, CAR_WIDTH / 2 - 8, 3, 5);
  // Police livery.
  if (car.kind === 'police') {
    ctx.fillStyle = PAL.policeBlue;
    ctx.fillRect(-CAR_LENGTH / 2 + 6, -3, CAR_LENGTH - 12, 6);
    const flash = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2e86ff';
    ctx.fillRect(-4, -CAR_WIDTH / 2 - 1, 8, 4);
    ctx.fillStyle = flash ? '#2e86ff' : '#ff3b30';
    ctx.fillRect(-4, CAR_WIDTH / 2 - 3, 8, 4);
  }
  // Taxi sign.
  if (car.model && car.model.name === 'Taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#f7c948';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('T', 0, 2);
  }
  // Damage smoke is a particle; a wreck shows a dark hood.
  if (car.hp < 35) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, CAR_LENGTH / 2 - 14, -CAR_WIDTH / 2 + 3, 12, CAR_WIDTH - 6, 4);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, p, isEnemy) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  // Body.
  ctx.fillStyle = p.shirt || '#e74c3c';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Head + facing.
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (isEnemy) {
    // Gun barrel.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, p, G) {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Ring so the player is always findable in a crowd.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  ctx.fillStyle = '#c0392b'; // Danny's red jacket
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f5d7a1';
  ctx.beginPath();
  ctx.arc(5, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand when armed.
  if (G.weapon === 'pistol') {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(17, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPackage(ctx, pkg, G) {
  const bob = Math.sin(G.time * 3 + pkg.x) * 2;
  ctx.save();
  ctx.translate(pkg.x, pkg.y + bob);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(-7, -7, 14, 14);
  ctx.strokeStyle = '#7d6608';
  ctx.lineWidth = 2;
  ctx.strokeRect(-7, -7, 14, 14);
  ctx.fillStyle = '#7d6608';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, 1);
  ctx.restore();
}

function drawPickup(ctx, pk, G) {
  const bob = Math.sin(G.time * 3 + pk.x) * 2;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  if (pk.type === 'health') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-3, -7, 6, 14);
    ctx.fillRect(-7, -3, 14, 6);
  } else if (pk.type === 'armor') {
    ctx.fillStyle = '#2e86c1';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', 0, 1);
  } else {
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('•', 0, 1);
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

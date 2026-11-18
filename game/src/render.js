// Rendering: the sun-soaked city, the camera, and every entity drawn in it.
// Draw order: ground -> roads -> props -> skid marks -> cars -> people -> particles -> weather tint.
import { WORLD_W, WORLD_H, ROAD_W, avenueX, streetY, AVENUES, STREETS, isWater, isBeach, districtAt } from './city.js';
import { clamp } from './utils.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = 1;
    this.shake = 0;
  }
  follow(tx, ty, dt, zoomTarget) {
    const k = 1 - Math.exp(-5 * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.zoom += (zoomTarget - this.zoom) * (1 - Math.exp(-2 * dt));
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
  }
  shakeBy(amount) { this.shake = Math.min(14, this.shake + amount); }
  apply(ctx, w, h) {
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    ctx.setTransform(this.zoom, 0, 0, this.zoom, w / 2 - this.x * this.zoom + sx, h / 2 - this.y * this.zoom + sy);
  }
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

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }
  drawWorld(g, dt) {
    const ctx = this.ctx;
    const cam = g.camera;
    const vw = 1280 / cam.zoom, vh = 720 / cam.zoom;
    const vx0 = cam.x - vw / 2 - 40, vy0 = cam.y - vh / 2 - 40;
    const vx1 = cam.x + vw / 2 + 40, vy1 = cam.y + vh / 2 + 40;
    // Ground: grass / sand base.
    ctx.fillStyle = '#5a7a4a';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    // Beach + sea on the east edge.
    if (vx1 > 3400) {
      ctx.fillStyle = '#e8c890';
      ctx.fillRect(Math.max(3400, vx0), vy0, Math.min(3560, vx1) - Math.max(3400, vx0), vy1 - vy0);
      const wave = Math.sin(g.time * 1.4) * 6;
      ctx.fillStyle = '#2a6a9a';
      ctx.fillRect(Math.max(3560, vx0), vy0, vx1 - Math.max(3560, vx0), vy1 - vy0);
      ctx.fillStyle = '#3a8ab8';
      ctx.fillRect(Math.max(3560, vx0), vy0, vx1 - Math.max(3560, vx0), 26 + wave);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let y = Math.floor(vy0 / 90) * 90; y < vy1; y += 90) {
        ctx.fillRect(3560 + wave * 0.4, y, 26, 3);
      }
    }
    // Sidewalk blocks.
    ctx.fillStyle = '#9a9a92';
    for (let i = 0; i < AVENUES - 1; i++) {
      for (let j = 0; j < STREETS - 1; j++) {
        const x0 = avenueX(i) + ROAD_W / 2, y0 = streetY(j) + ROAD_W / 2;
        const x1 = avenueX(i + 1) - ROAD_W / 2, y1 = streetY(j + 1) - ROAD_W / 2;
        if (x1 < vx0 || x0 > vx1 || y1 < vy0 || y0 > vy1) continue;
        if (x0 > 3400) continue;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    // Asphalt.
    ctx.fillStyle = '#33333c';
    for (let i = 0; i < AVENUES; i++) ctx.fillRect(avenueX(i) - ROAD_W / 2, vy0, ROAD_W, vy1 - vy0);
    for (let j = 0; j < STREETS; j++) ctx.fillRect(vx0, streetY(j) - ROAD_W / 2, vx1 - vx0, ROAD_W);
    // Lane dashes.
    ctx.fillStyle = '#d8c84a';
    for (let i = 0; i < AVENUES; i++) {
      for (let y = Math.floor(vy0 / 48) * 48; y < vy1; y += 48) {
        if (Math.abs(y - streetY(Math.round((y - 160) / 320))) < 44) continue;
        ctx.fillRect(avenueX(i) - 2, y, 4, 22);
      }
    }
    for (let j = 0; j < STREETS; j++) {
      for (let x = Math.floor(vx0 / 48) * 48; x < vx1; x += 48) {
        if (Math.abs(x - avenueX(Math.round((x - 160) / 320))) < 44) continue;
        ctx.fillRect(x, streetY(j) - 2, 22, 4);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < AVENUES; i++) {
      for (let j = 0; j < STREETS; j++) {
        const x = avenueX(i), y = streetY(j);
        if (x < vx0 - 60 || x > vx1 + 60 || y < vy0 - 60 || y > vy1 + 60) continue;
        for (let k = -2; k <= 2; k++) {
          ctx.fillRect(x - 30 + k * 13, y - ROAD_W / 2 - 8, 7, 12);
          ctx.fillRect(x - 30 + k * 13, y + ROAD_W / 2 - 4, 7, 12);
        }
      }
    }
    // Props: containers, fountains, benches.
    for (const pr of g.city.props) {
      if (pr.x < vx0 || pr.x > vx1 || pr.y < vy0 || pr.y > vy1) continue;
      if (pr.kind === 'container') {
        ctx.fillStyle = pr.color;
        ctx.fillRect(pr.x - 22, pr.y - 10, 44, 20);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(pr.x - 22, pr.y + 4, 44, 6);
      } else if (pr.kind === 'fountain') {
        ctx.fillStyle = '#4a8ab8';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c8d8e8';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 11, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Trees.
    for (const t of g.city.trees) {
      if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f6a2f';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a8a3a';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // Buildings with roof, shadow, windows and neon.
    for (const b of g.city.buildings) {
      if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + b.height * 0.35, b.y + b.height * 0.35, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(b.x, b.y, b.w, 4);
      for (const win of b.windows) {
        ctx.fillStyle = win.lit ? '#ffe9a0' : 'rgba(20,24,40,0.85)';
        ctx.fillRect(win.x, win.y, 12, 9);
      }
      if (b.neon) {
        ctx.save();
        ctx.shadowColor = b.neonColor; ctx.shadowBlur = 14;
        ctx.fillStyle = b.neonColor;
        ctx.fillRect(b.x + 8, b.y + b.h - 12, b.w - 16, 5);
        ctx.restore();
      }
    }
    // Mission marker beacon.
    if (g.missions.marker) {
      const m = g.missions.marker;
      const bob = Math.sin(g.time * 3) * 6;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.ellipse(m.x, m.y, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const grad = ctx.createLinearGradient(m.x, m.y - 150 + bob, m.x, m.y);
      grad.addColorStop(0, 'rgba(255,217,74,0)');
      grad.addColorStop(1, 'rgba(255,217,74,0.55)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(m.x - 10, m.y - 150 + bob);
      ctx.lineTo(m.x + 10, m.y - 150 + bob);
      ctx.lineTo(m.x + 3, m.y);
      ctx.lineTo(m.x - 3, m.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(m.x, m.y - 150 + bob, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2; ctx.stroke();
    }
    // Skid marks.
    ctx.fillStyle = 'rgba(20,20,20,0.5)';
    for (const s of g.particles.skids) {
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      ctx.globalAlpha = Math.min(0.55, s.life / 6);
      ctx.fillRect(-9, -2, 18, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // Cars.
    for (const c of g.cars) {
      if (c.x < vx0 - 80 || c.x > vx1 + 80 || c.y < vy0 - 80 || c.y > vy1 + 80) continue;
      this.drawCar(ctx, c, g);
    }
    // Pedestrians + rivals + cops.
    for (const p of g.peds) this.drawPerson(ctx, p, g);
    for (const r of g.combat.rivals) if (!r.dead) this.drawPerson(ctx, r, g, true);
    for (const cop of g.police.cops) this.drawCop(ctx, cop, g);
    // Player.
    if (!g.player.dead) this.drawPlayer(ctx, g.player, g);
    // Bullets.
    ctx.fillStyle = '#ffe14a';
    for (const b of g.combat.bullets) {
      ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3);
    }
    // Particles.
    for (const p of g.particles.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating texts.
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    for (const t of g.particles.texts) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    // Sunset tint + vignette.
    const tint = ctx.createRadialGradient(cam.x, cam.y, 200, cam.x, cam.y, 900);
    tint.addColorStop(0, 'rgba(255,120,40,0)');
    tint.addColorStop(1, 'rgba(255,110,40,0.10)');
    ctx.fillStyle = tint;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    const vig = ctx.createRadialGradient(cam.x, cam.y, 420, cam.x, cam.y, 780);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(10,5,20,0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  }
  drawCar(ctx, c, g) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, -c.w / 2 + 3, -c.h / 2 + 4, c.w, c.h, 6);
    ctx.fill();
    // body
    ctx.fillStyle = c.color;
    roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 6);
    ctx.fill();
    // hood + trunk shading
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(c.w / 2 - 12, -c.h / 2 + 2, 10, c.h - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-c.w / 2 + 2, -c.h / 2 + 2, 8, c.h - 4);
    // cabin + windshield
    ctx.fillStyle = '#1a2436';
    roundRect(ctx, -c.w / 2 + 14, -c.h / 2 + 3, c.w / 2 - 22, c.h - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,200,255,0.5)';
    ctx.fillRect(c.w / 2 - 12, -c.h / 2 + 4, 3, c.h - 8);
    // wheels
    ctx.fillStyle = '#101010';
    const wy = c.h / 2 - 1;
    ctx.fillRect(-c.w / 2 + 6, -wy - 3, 10, 5);
    ctx.fillRect(c.w / 2 - 14, -wy - 3, 10, 5);
    ctx.fillRect(-c.w / 2 + 6, wy - 2, 10, 5);
    ctx.fillRect(c.w / 2 - 14, wy - 2, 10, 5);
    // headlights
    ctx.fillStyle = '#fff8c8';
    ctx.fillRect(c.w / 2 - 1, -c.h / 2 + 4, 2, 4);
    ctx.fillRect(c.w / 2 - 1, c.h / 2 - 8, 2, 4);
    if (c.role === 'police') {
      const blink = Math.floor(g.time * 6) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2a2a' : '#2a6aff';
      ctx.fillRect(-4, -c.h / 2 + 1, 8, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VHPD', 0, 1);
    }
    if (c.type === 'taxi') {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 1);
    }
    // damage smoke handled by the game loop; draw a dent when hurt
    if (c.health < 55) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(-c.w / 2 + 8, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // police light glow
    if (c.role === 'police') {
      const blink = Math.floor(g.time * 6) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = blink ? '#ff2a2a' : '#2a6aff';
      ctx.beginPath(); ctx.arc(c.x, c.y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  drawPerson(ctx, p, g, isRival) {
    const bob = p.down > 0 ? 0 : Math.sin(p.walkPhase) * 2;
    ctx.save();
    ctx.translate(p.x, p.y + bob * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (p.down > 0) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-11, -6, 22, 12);
      ctx.restore();
      return;
    }
    ctx.rotate(p.angle);
    // body
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(7, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    // arms hint + gun for rivals
    if (isRival) {
      ctx.fillStyle = '#222';
      ctx.fillRect(8, -2, 10, 3);
    }
    ctx.restore();
    if (isRival && p.hp < p.maxHp) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(p.x - 14, p.y - 24, 28, 4);
      ctx.fillStyle = '#ff4a4a';
      ctx.fillRect(p.x - 14, p.y - 24, 28 * (p.hp / p.maxHp), 4);
    }
  }
  drawCop(ctx, cop, g) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1a2a5a';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(7, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8c84a';
    ctx.fillRect(8, -2, 8, 3);
    ctx.restore();
  }
  drawPlayer(ctx, pl, g) {
    const bob = pl.onFoot ? Math.sin(pl.walkPhase) * 2 : 0;
    ctx.save();
    ctx.translate(pl.x, pl.y + bob * 0.3);
    if (pl.onFoot) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(0, 9, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(pl.angle);
      // jacket, jeans, skin — Mara Voss in a teal jacket
      ctx.fillStyle = '#0a8a7a';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b88a';
      ctx.beginPath(); ctx.arc(8, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(-9, -4, 6, 8);
      if (pl.weapon === 'pistol') {
        ctx.fillStyle = '#222';
        ctx.fillRect(9, -2, 11, 3);
      }
      ctx.restore();
      // aim line when armed
      if (pl.weapon === 'pistol') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(pl.x + Math.cos(pl.angle) * 20, pl.y + Math.sin(pl.angle) * 20);
        ctx.lineTo(pl.x + Math.cos(pl.angle) * 70, pl.y + Math.sin(pl.angle) * 70);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.restore();
    }
    // hurt flash ring
    if (pl.hurtFlash > 0.3) {
      ctx.save();
      ctx.globalAlpha = pl.hurtFlash * 0.4;
      ctx.strokeStyle = '#ff2a2a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}

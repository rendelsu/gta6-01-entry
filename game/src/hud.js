// HUD, minimap, dialogue, banners and menus — everything drawn in screen space.
import { WORLD_W, WORLD_H, avenueX, streetY, AVENUES, STREETS } from './city.js';
import { fmtMoney, clamp } from './utils.js';

import { MISSIONS } from './missions.js';
const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
const DEBT_TOTAL = 10000;
function debtRemaining(completedCount) {
  let paid = 0;
  for (let i = 0; i < completedCount && i < MISSIONS.length; i++) paid += MISSIONS[i].reward;
  return Math.max(0, DEBT_TOTAL - paid);
}

export class HUD {
  constructor() {
    this.dialogueLines = [];
    this.dialogueIdx = 0;
    this.dialogueTimer = 0;
    this.banner = null; // {title, sub, timer}
    this.toast = null;  // {text, timer}
    this.titleSelection = 0;
    this.pauseSelection = 0;
  }
  showDialogue(lines) {
    this.dialogueLines = lines.slice();
    this.dialogueIdx = 0;
    this.dialogueTimer = 0;
  }
  advanceDialogue() {
    this.dialogueIdx++;
  }
  dialogueActive() { return this.dialogueIdx < this.dialogueLines.length; }
  showBanner(title, sub) { this.banner = { title, sub, timer: 3.2 }; }
  showToast(text) { this.toast = { text, timer: 4 }; }
  update(dt) {
    if (this.banner) { this.banner.timer -= dt; if (this.banner.timer <= 0) this.banner = null; }
    if (this.toast) { this.toast.timer -= dt; if (this.toast.timer <= 0) this.toast = null; }
  }
  draw(ctx, g) {
    const W = 1280, H = 720;
    if (g.state === 'title') { this.drawTitle(ctx, g); return; }
    if (g.state === 'playing' || g.state === 'paused' || g.state === 'busted' || g.state === 'wasted') {
      this.drawWorldHUD(ctx, g);
    }
    if (g.state === 'paused') this.drawPause(ctx, g);
    if (g.state === 'busted') this.drawEndCard(ctx, g, 'BUSTED', 'The VHPD took you in. You lost $150 in fines.');
    if (g.state === 'wasted') this.drawEndCard(ctx, g, 'WASTED', 'Mara is down. Harbor General patched her up — for a fee.');
    if (this.banner) {
      const a = clamp(this.banner.timer, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 44px ' + FONT;
      ctx.shadowColor = '#000'; ctx.shadowBlur = 12;
      ctx.fillText(this.banner.title, W / 2, 190);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px ' + FONT;
      ctx.fillText(this.banner.sub, W / 2, 226);
      ctx.restore();
    }
    if (this.dialogueActive() && g.state === 'playing') {
      const line = this.dialogueLines[this.dialogueIdx];
      ctx.save();
      ctx.fillStyle = 'rgba(10,10,24,0.82)';
      ctx.fillRect(190, H - 118, W - 380, 78);
      ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 2;
      ctx.strokeRect(190, H - 118, W - 380, 78);
      ctx.fillStyle = '#ffe9a0';
      ctx.font = '17px ' + FONT;
      ctx.textAlign = 'left';
      this.wrapText(ctx, line, 210, H - 90, W - 420, 22);
      ctx.fillStyle = '#9a9a9a';
      ctx.font = '13px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText('E / click — continue', W - 210, H - 48);
      ctx.restore();
    }
  }
  wrapText(ctx, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = w; yy += lh;
      } else line = test;
    }
    ctx.fillText(line, x, yy);
  }
  drawWorldHUD(ctx, g) {
    const W = 1280, H = 720;
    const p = g.player;
    // Health bar + cash, top left.
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,24,0.65)';
    ctx.fillRect(16, 14, 250, 62);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('MARA VOSS', 28, 36);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(28, 44, 180, 12);
    ctx.fillStyle = p.health > 30 ? '#4ad94a' : '#ff4a4a';
    ctx.fillRect(28, 44, 180 * (p.health / 100), 12);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.strokeRect(28, 44, 180, 12);
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(fmtMoney(p.cash), 28, 72);
    ctx.fillStyle = '#9a9a9a';
    ctx.font = '12px ' + FONT;
    ctx.fillText('DEBT: ' + fmtMoney(debtRemaining(g.missions.completedCount)), 150, 72);
    // Wanted stars, top right above minimap.
    const wx = W - 214;
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < g.police.wanted ? '#ffd94a' : 'rgba(255,255,255,0.25)';
      ctx.font = '26px ' + FONT;
      ctx.fillText('\u2605', wx + i * 30, 40);
    }
    if (g.police.wanted > 0) {
      ctx.fillStyle = '#ff5a4a';
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText('WANTED', wx, 58);
    }
    // Minimap.
    this.drawMinimap(ctx, g, W - 214, 66, 198, 148);
    // Objective bar, bottom centre.
    const obj = g.missions.objectiveText();
    if (obj) {
      ctx.font = 'bold 15px ' + FONT;
      const tw = ctx.measureText(obj).width;
      ctx.fillStyle = 'rgba(10,10,24,0.72)';
      ctx.fillRect((W - tw) / 2 - 16, H - 44, tw + 32, 30);
      ctx.fillStyle = '#ffd94a';
      ctx.textAlign = 'center';
      ctx.fillText('\u25B8 ' + obj, W / 2, H - 24);
      ctx.textAlign = 'left';
    }
    // Weapon + ammo, bottom left.
    ctx.fillStyle = 'rgba(10,10,24,0.65)';
    ctx.fillRect(16, H - 62, 190, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText(p.weapon === 'pistol' ? 'PISTOL  [2]' : 'FISTS  [1]', 28, H - 42);
    ctx.fillStyle = '#ffd94a';
    ctx.font = '14px ' + FONT;
    ctx.fillText(p.weapon === 'pistol' ? 'Ammo ' + p.ammo + ' / ' + p.ammoReserve + '  (R reload)' : 'Press F to punch', 28, H - 24);
    // Speed when driving.
    if (!p.onFoot && p.car) {
      const kmh = Math.round(Math.abs(p.car.forwardSpeed()) * 0.36);
      ctx.fillStyle = 'rgba(10,10,24,0.65)';
      ctx.fillRect(W - 150, H - 62, 134, 46);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText(kmh + '', W - 58, H - 30);
      ctx.font = '13px ' + FONT;
      ctx.fillStyle = '#9a9a9a';
      ctx.fillText('km/h', W - 28, H - 30);
      ctx.textAlign = 'left';
    }
    // Toast.
    if (this.toast) {
      ctx.save();
      ctx.globalAlpha = clamp(this.toast.timer, 0, 1);
      ctx.font = '15px ' + FONT;
      const tw = ctx.measureText(this.toast.text).width;
      ctx.fillStyle = 'rgba(10,10,24,0.8)';
      ctx.fillRect((W - tw) / 2 - 12, 92, tw + 24, 28);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(this.toast.text, W / 2, 111);
      ctx.restore();
    }
    // Off-screen waypoint arrow.
    if (g.missions.marker) {
      const m = g.missions.marker;
      const cam = g.camera;
      const sx = (m.x - cam.x) * cam.zoom + W / 2;
      const sy = (m.y - cam.y) * cam.zoom + H / 2;
      const dx = sx - W / 2, dy = sy - H / 2;
      const d = Math.hypot(dx, dy);
      if (d > 300) {
        const a = Math.atan2(dy, dx);
        const ax = W / 2 + Math.cos(a) * 260;
        const ay = H / 2 + Math.sin(a) * 230;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffd94a';
        ctx.font = 'bold 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(d / 10) + 'm  ' + m.label, ax, ay + 26);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = '#ffd94a';
        ctx.font = 'bold 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(m.label, sx, sy - 120);
        ctx.textAlign = 'left';
      }
    }
    // Controls hint, first seconds of play.
    if (g.time - g.playStartedAt < 9 && g.state === 'playing') {
      ctx.save();
      ctx.globalAlpha = clamp(9 - (g.time - g.playStartedAt), 0, 1) * 0.85;
      ctx.fillStyle = 'rgba(10,10,24,0.8)';
      ctx.fillRect(16, 92, 330, 118);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px ' + FONT;
      ctx.fillText('WASD / arrows — move & drive    Shift — run', 28, 116);
      ctx.fillText('E — enter / steal car, talk, pick up', 28, 140);
      ctx.fillText('Mouse — aim    Click — shoot    F — punch', 28, 164);
      ctx.fillText('1 / 2 — weapon    R — reload    M — mute', 28, 188);
      ctx.fillText('Esc — pause & save    T — fare job (after story)', 28, 208);
      ctx.restore();
    }
    // Damage flash.
    if (p.hurtFlash > 0.2) {
      ctx.fillStyle = 'rgba(255,30,30,' + (p.hurtFlash * 0.16) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }
  drawMinimap(ctx, g, x, y, w, h) {
    const sx = w / WORLD_W, sy = h / WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,24,0.82)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // sea
    ctx.fillStyle = '#2a6a9a';
    ctx.fillRect(x + 3560 * sx, y, w - 3560 * sx, h);
    ctx.fillStyle = '#e8c890';
    ctx.fillRect(x + 3400 * sx, y, 160 * sx, h);
    // roads
    ctx.strokeStyle = '#5a5a66';
    ctx.lineWidth = 2;
    for (let i = 0; i < AVENUES; i++) {
      ctx.beginPath(); ctx.moveTo(x + avenueX(i) * sx, y); ctx.lineTo(x + avenueX(i) * sx, y + h); ctx.stroke();
    }
    for (let j = 0; j < STREETS; j++) {
      ctx.beginPath(); ctx.moveTo(x, y + streetY(j) * sy); ctx.lineTo(x + w, y + streetY(j) * sy); ctx.stroke();
    }
    // mission marker
    if (g.missions.marker) {
      const m = g.missions.marker;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(x + m.x * sx, y + m.y * sy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a00';
      ctx.stroke();
    }
    // police (flashing)
    const blink = Math.floor(g.time * 4) % 2 === 0;
    for (const c of g.police.cars) {
      if (c.dead) continue;
      ctx.fillStyle = blink ? '#ff2a2a' : '#2a6aff';
      ctx.beginPath(); ctx.arc(x + c.x * sx, y + c.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // player
    const p = g.player;
    const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + px * sx, y + py * sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
    // view cone
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x + px * sx, y + py * sy);
    ctx.lineTo(x + (px + Math.cos(p.angle) * 120) * sx, y + (py + Math.sin(p.angle) * 120) * sy);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#9a9a9a';
    ctx.font = '11px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('VICE HARBOR', x + 4, y + h - 5);
  }
  drawTitle(ctx, g) {
    const W = 1280, H = 720;
    ctx.save();
    // sunset gradient sky behind the logo
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(30,10,50,0.25)');
    grad.addColorStop(0.55, 'rgba(255,110,60,0.18)');
    grad.addColorStop(1, 'rgba(10,5,20,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 96px ' + FONT;
    ctx.shadowColor = '#ff2a7a'; ctx.shadowBlur = 34;
    ctx.fillText('SOLMAR', W / 2, 210);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px ' + FONT;
    ctx.fillText('—  VICE HARBOR  —', W / 2, 262);
    ctx.fillStyle = '#ffb08a';
    ctx.font = '17px ' + FONT;
    ctx.fillText('An open-world crime story. Steal it. Drive it. Lose the cops. Pay the debt.', W / 2, 300);
    const items = g.saveExists
      ? ['Continue', 'New Game', 'Controls', 'Sound: ' + (g.sound.muted ? 'Off' : 'On')]
      : ['New Game', 'Controls', 'Sound: ' + (g.sound.muted ? 'Off' : 'On')];
    this.titleItems = items;
    for (let i = 0; i < items.length; i++) {
      const y = 380 + i * 52;
      const sel = this.titleSelection === i;
      if (sel) {
        ctx.fillStyle = 'rgba(255,217,74,0.16)';
        ctx.fillRect(W / 2 - 200, y - 32, 400, 42);
        ctx.fillStyle = '#ffd94a';
      } else {
        ctx.fillStyle = '#e8e8e8';
      }
      ctx.font = (sel ? 'bold ' : '') + '26px ' + FONT;
      ctx.fillText((sel ? '\u25B8 ' : '') + items[i], W / 2, y);
    }
    ctx.fillStyle = '#c8c8c8';
    ctx.font = '15px ' + FONT;
    ctx.fillText('WASD move & drive  ·  E enter car / talk  ·  Mouse aim, Click shoot  ·  Esc pause', W / 2, 620);
    ctx.fillText('A completely original game. No Rockstar, no GTA assets — our own city, our own story.', W / 2, 648);
    ctx.restore();
  }
  drawPause(ctx, g) {
    const W = 1280, H = 720;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,20,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 52px ' + FONT;
    ctx.fillText('PAUSED', W / 2, 180);
    const items = ['Resume', 'Save Game', 'Load Game', 'Restart Mission', 'Quit to Title', 'Sound: ' + (g.sound.muted ? 'Off' : 'On')];
    this.pauseItems = items;
    for (let i = 0; i < items.length; i++) {
      const y = 270 + i * 48;
      const sel = this.pauseSelection === i;
      ctx.fillStyle = sel ? '#ffd94a' : '#e8e8e8';
      ctx.font = (sel ? 'bold ' : '') + '24px ' + FONT;
      ctx.fillText((sel ? '\u25B8 ' : '') + items[i], W / 2, y);
    }
    ctx.fillStyle = '#9a9a9a';
    ctx.font = '15px ' + FONT;
    ctx.fillText('Progress: ' + g.missions.completedCount + ' / 5 missions complete  ·  Cash ' + fmtMoney(g.player.cash), W / 2, 600);
    ctx.restore();
  }
  drawEndCard(ctx, g, title, sub) {
    const W = 1280, H = 720;
    ctx.save();
    ctx.fillStyle = title === 'BUSTED' ? 'rgba(20,20,90,0.6)' : 'rgba(90,10,10,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = title === 'BUSTED' ? '#7ab8ff' : '#ff5a4a';
    ctx.font = 'bold 72px ' + FONT;
    ctx.shadowColor = '#000'; ctx.shadowBlur = 16;
    ctx.fillText(title, W / 2, 320);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px ' + FONT;
    ctx.fillText(sub, W / 2, 366);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Press Enter to get back on the streets', W / 2, 430);
    ctx.restore();
  }
}

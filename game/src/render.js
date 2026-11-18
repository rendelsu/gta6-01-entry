// SOLMAR — Vice Harbor: all drawing. Top-down canvas, camera follows the
// player; dusk/night lighting, rain, HUD, minimap, dialogs and start screen.

const Render = {
  drawWorld(ctx, state, cam) {
    const hour = state.clock / 60;
    const night = hour >= 19 || hour < 6;
    const dusk = (hour >= 17 && hour < 19) || (hour >= 6 && hour < 7.5);
    // Ground.
    ctx.fillStyle = '#4a5a3a';
    ctx.fillRect(cam.x - 40, cam.y - 40, cam.w + 80, cam.h + 80);
    // Harbor water (west edge + marina corner).
    ctx.fillStyle = night ? '#16324a' : '#2a6a8a';
    ctx.fillRect(cam.x - 40, cam.y - 40, Math.max(0, 90 - (cam.x - 40)) + 40, cam.h + 80);
    ctx.fillRect(3600, 2500, 240, 380);
    // District ground tint + blocks.
    for (const d of DISTRICTS) {
      if (d.x1 < cam.x || d.x0 > cam.x + cam.w || d.y1 < cam.y || d.y0 > cam.y + cam.h) continue;
      ctx.fillStyle = d.ground;
      ctx.fillRect(Math.max(d.x0, cam.x), Math.max(d.y0, cam.y),
        Math.min(d.x1, cam.x + cam.w) - Math.max(d.x0, cam.x),
        Math.min(d.y1, cam.y + cam.h) - Math.max(d.y0, cam.y));
    }
    // Roads: avenues and streets.
    ctx.fillStyle = night ? '#2e2e34' : '#3c3c44';
    for (let i = 0; i < AVENUES; i++) ctx.fillRect(avenueX(i) - ROAD_W / 2, cam.y - 20, ROAD_W, cam.h + 40);
    for (let j = 0; j < STREETS; j++) ctx.fillRect(cam.x - 20, streetY(j) - ROAD_W / 2, cam.w + 40, ROAD_W);
    // Road center dashes.
    ctx.fillStyle = night ? '#8a8a5a' : '#d8c860';
    for (let i = 0; i < AVENUES; i++) {
      for (let y = Math.floor(cam.y / 48) * 48; y < cam.y + cam.h; y += 48) ctx.fillRect(avenueX(i) - 2, y, 4, 22);
    }
    for (let j = 0; j < STREETS; j++) {
      for (let x = Math.floor(cam.x / 48) * 48; x < cam.x + cam.w; x += 48) ctx.fillRect(x, streetY(j) - 2, 22, 4);
    }
    // Sidewalks.
    ctx.fillStyle = night ? '#4a4a48' : '#7a7a74';
    for (let i = 0; i < AVENUES; i++) {
      ctx.fillRect(avenueX(i) - ROAD_W / 2 - SIDEWALK, cam.y - 20, SIDEWALK, cam.h + 40);
      ctx.fillRect(avenueX(i) + ROAD_W / 2, cam.y - 20, SIDEWALK, cam.h + 40);
    }
    for (let j = 0; j < STREETS; j++) {
      ctx.fillRect(cam.x - 20, streetY(j) - ROAD_W / 2 - SIDEWALK, cam.w + 40, SIDEWALK);
      ctx.fillRect(cam.x - 20, streetY(j) + ROAD_W / 2, cam.w + 40, SIDEWALK);
    }
    // Buildings, parks, shops.
    for (const b of BUILDINGS) {
      if (b.x + b.w < cam.x || b.x > cam.x + cam.w || b.y + b.h < cam.y || b.y > cam.y + cam.h) continue;
      if (b.kind === 'park') {
        ctx.fillStyle = night ? '#1e3a24' : '#3a7a44';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = night ? '#2a5a34' : '#5aa064';
        for (let k = 0; k < 5; k++) {
          const tx = b.x + 30 + ((k * 53) % (b.w - 60));
          const ty = b.y + 30 + ((k * 89) % (b.h - 60));
          ctx.beginPath(); ctx.arc(tx, ty, 14, 0, Math.PI * 2); ctx.fill();
        }
        continue;
      }
      const shade = b.kind === 'tower' ? '#3a3a4a' : b.d.roof;
      ctx.fillStyle = shade;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      // Windows glow at night; shop awnings in the day.
      if (b.kind === 'shop') {
        ctx.fillStyle = b.d.accent;
        ctx.fillRect(b.x, b.y + b.h - 12, b.w, 12);
        ctx.fillStyle = '#f0e0b0';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('SHOP', b.x + 6, b.y + b.h - 2);
      } else {
        const cols = Math.max(1, Math.floor(b.w / 22));
        const rows = Math.max(1, Math.floor(b.h / 22));
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            const lit = night ? ((cx * 7 + cy * 13 + Math.floor(b.hue * 100)) % 3 === 0) : false;
            ctx.fillStyle = lit ? '#ffe89a' : 'rgba(0,0,0,0.25)';
            ctx.fillRect(b.x + 6 + cx * 22, b.y + 6 + cy * 22, 10, 12);
          }
        }
      }
      if (b.kind === 'tower') {
        ctx.fillStyle = '#2a2a38';
        ctx.fillRect(b.x + b.w / 2 - 8, b.y - 14, 16, 14);
        if (night) { ctx.fillStyle = '#ff5040'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y - 14, 3, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    // Mission / fare markers on the ground.
    const marker = missionMarker(state);
    if (marker) this.drawMarker(ctx, marker.x, marker.y, '#ffd820', marker.label);
    const fm = fareMarker(state);
    if (fm) this.drawMarker(ctx, fm.x, fm.y, '#ffd820', fm.label);
  },

  drawMarker(ctx, x, y, color, label) {
    const bob = Math.sin(performance.now() / 280) * 6;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, y - 46 + bob); ctx.lineTo(x - 12, y - 70 + bob); ctx.lineTo(x + 12, y - 70 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 52);
    ctx.restore();
  },

  drawCar(ctx, car, t) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-car.type.w / 2 + 3, -car.type.h / 2 + 4, car.type.w, car.type.h);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.type.w / 2, -car.type.h / 2, car.type.w, car.type.h, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.beginPath();
    ctx.roundRect(-car.type.w / 2 + 10, -car.type.h / 2 + 4, car.type.w - 22, car.type.h - 8, 4);
    ctx.fill();
    ctx.fillStyle = '#dfe8f0';
    ctx.fillRect(car.type.w / 2 - 12, -car.type.h / 2 + 4, 4, car.type.h - 8);
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(car.type.w / 2 - 2, -car.type.h / 2 + 2, 3, 5);
    ctx.fillRect(car.type.w / 2 - 2, car.type.h / 2 - 7, 3, 5);
    ctx.fillStyle = '#ff3020';
    ctx.fillRect(-car.type.w / 2, -car.type.h / 2 + 2, 3, 5);
    ctx.fillRect(-car.type.w / 2, car.type.h / 2 - 7, 3, 5);
    if (car.police) {
      const on = Math.floor(t * 4) % 2 === 0;
      ctx.fillStyle = on ? '#ff2020' : '#2040ff';
      ctx.fillRect(-6, -car.type.h / 2 - 3, 12, 5);
      ctx.fillStyle = '#f0f0f0';
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('VHPD', 0, 3);
    }
    if (car.type.id === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.fillRect(-8, -car.type.h / 2 - 3, 16, 5);
      ctx.fillStyle = '#ffd820';
      ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -car.type.h / 2 + 1);
    }
    if (car.target) {
      ctx.strokeStyle = '#ffd820'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  },

  drawPed(ctx, ped, t) {
    if (ped.dead) return;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    const bob = Math.sin(t * 9 + ped.x) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, bob * 0.4, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.cop ? '#16264a' : '#2a2a2a';
    ctx.beginPath(); ctx.arc(0, -2 + bob * 0.4, 5.5, 0, Math.PI * 2); ctx.fill();
    if (ped.thug) {
      ctx.strokeStyle = '#ff2020'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, bob * 0.4, 12, 0, Math.PI * 2); ctx.stroke();
    }
    if (ped.cop) {
      ctx.fillStyle = '#ffd820';
      ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('VHPD', 0, -14);
    }
    ctx.restore();
  },

  drawPlayer(ctx, state, t) {
    const p = state.player;
    if (p.car) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const bob = p.moving ? Math.sin(t * 11) * 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Mara Voss: teal jacket, dark hair.
    ctx.fillStyle = '#189a9a';
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a12';
    ctx.beginPath(); ctx.arc(2, -2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd820';
    ctx.fillRect(8, -3, 7, 6);
    ctx.restore();
  },

  drawLighting(ctx, state, cam) {
    const hour = state.clock / 60;
    const night = hour >= 19 || hour < 6;
    const dusk = (hour >= 17 && hour < 19) || (hour >= 6 && hour < 7.5);
    if (night) {
      ctx.fillStyle = 'rgba(8,14,44,0.42)';
      ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
      // Headlight cones for the player's car and police.
      const cars = [];
      if (state.player.car) cars.push(state.player.car);
      for (const c of state.police) cars.push(c);
      for (const car of cars) {
        const g = ctx.createRadialGradient(car.x, car.y, 10, car.x, car.y, 260);
        g.addColorStop(0, 'rgba(255,240,180,0.20)');
        g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(car.x, car.y, 260, 0, Math.PI * 2); ctx.fill();
      }
    } else if (dusk) {
      ctx.fillStyle = 'rgba(255,120,40,0.10)';
      ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
      ctx.fillStyle = 'rgba(60,20,80,0.08)';
      ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    }
    // Rain streaks.
    if (state.rain) {
      ctx.strokeStyle = 'rgba(180,200,230,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const drop of state.rainDrops) {
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 6, drop.y + 16);
      }
      ctx.stroke();
    }
  },

  drawHUD(ctx, state, W, H) {
    const p = state.player;
    ctx.save();
    ctx.textAlign = 'left';
    // Top-left: cash, health, debt.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(12, 12, 250, 86, 10); ctx.fill();
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(fmtMoney(state.cash), 24, 44);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText('Debt to Donna: ' + fmtMoney(Math.max(0, DEBT_TOTAL - state.debtPaid)) + ' left', 24, 66);
    ctx.fillStyle = '#333';
    ctx.fillRect(24, 74, 180, 10);
    ctx.fillStyle = p.hp > 40 ? '#7dff6a' : '#ff5040';
    ctx.fillRect(24, 74, 180 * (p.hp / 100), 10);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText('HP ' + Math.round(p.hp), 210, 83);
    // Top-center: wanted stars + clock + district.
    const cx = W / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(cx - 150, 12, 300, 56, 10); ctx.fill();
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < state.wanted ? '#ffd820' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', cx - 88 + i * 30, 40);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(fmtClock(state.clock) + '  •  ' + districtAt(p.x, p.y).name, cx, 62);
    ctx.textAlign = 'left';
    // Bottom-left: objective.
    const step = currentStep(state);
    const objText = state.storyDone ? 'STORY COMPLETE — Vice Harbor is yours.'
      : step ? step.text
      : (state.missionActive ? 'Follow the yellow marker.'
      : 'Press M to start the next mission.');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const objW = Math.min(560, 24 + ctx.measureText(objText).width + 90);
    ctx.beginPath(); ctx.roundRect(12, H - 100, objW, 52, 10); ctx.fill();
    ctx.fillStyle = '#ffd820';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('◆ ' + (state.missionActive && MISSIONS[state.missionIndex] ? MISSIONS[state.missionIndex].title.toUpperCase() : 'FREE ROAM'), 24, H - 76);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(objText, 24, H - 56);
    // Bottom-right: speed or controls.
    if (p.car) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(W - 190, H - 88, 178, 76, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.9) + ' mph', W - 26, H - 48);
      ctx.font = '12px sans-serif';
      ctx.fillText(p.car.type.name, W - 26, H - 26);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(W - 330, H - 52, 318, 40, 10); ctx.fill();
      ctx.fillStyle = '#ddd';
      ctx.font = '12px sans-serif';
      ctx.fillText('WASD move • SHIFT run • E enter car • F punch • T taxi fare • M mission', W - 318, H - 27);
    }
    // Toast.
    if (state.toast && state.toast.t > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const tw = ctx.measureText(state.toast.text).width + 32;
      ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, 84, tw, 34, 10); ctx.fill();
      ctx.fillStyle = '#7dff6a';
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(state.toast.text, W / 2, 106);
      ctx.textAlign = 'left';
    }
    this.drawMinimap(ctx, state, W, H);
    ctx.restore();
  },

  drawMinimap(ctx, state, W, H) {
    const mw = 210, mh = 158, mx = W - mw - 12, my = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    const sx = mw / CITY_W, sy = mh / CITY_H;
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#3c3c44';
    for (let i = 0; i < AVENUES; i++) ctx.fillRect(mx + avenueX(i) * sx - 2, my, 4, mh);
    for (let j = 0; j < STREETS; j++) ctx.fillRect(mx, my + streetY(j) * sy - 2, mw, 4);
    ctx.fillStyle = '#2a6a8a';
    ctx.fillRect(mx, my, 90 * sx, mh);
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2); ctx.fill();
    };
    const marker = missionMarker(state);
    if (marker) dot(marker.x, marker.y, '#ffd820', 5);
    const fm = fareMarker(state);
    if (fm) dot(fm.x, fm.y, '#ffd820', 4);
    for (const c of state.police) dot(c.x, c.y, '#4080ff', 3);
    const p = state.player;
    dot(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y, '#fff', 4);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(mx + (p.car ? p.car.x : p.x) * sx - 5, my + (p.car ? p.car.y : p.y) * sy - 5, 10, 10);
    ctx.restore();
    // North arrow + wanted flash border when hot.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', mx + mw - 10, my + 14);
    if (state.wanted >= 3) {
      ctx.strokeStyle = Math.floor(performance.now() / 400) % 2 ? '#ff2020' : '#ffd820';
      ctx.lineWidth = 3;
      ctx.strokeRect(mx - 6, my - 6, mw + 12, mh + 12);
    }
  },

  drawDialog(ctx, state, W, H) {
    const d = state.dialog;
    if (!d || !d.open) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.beginPath(); ctx.roundRect(60, H - 230, W - 120, 130, 12); ctx.fill();
    ctx.strokeStyle = '#ffd820'; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd820';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(d.speaker + (d.mission ? '  —  ' + d.mission : ''), 84, H - 200);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    const words = d.text.split(' ');
    let line = '', y = H - 172;
    for (const w of words) {
      if (ctx.measureText(line + w + ' ').width > W - 200) { ctx.fillText(line, 84, y); line = ''; y += 22; }
      line += w + ' ';
    }
    ctx.fillText(line, 84, y);
    ctx.fillStyle = '#ffd820';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Press E to continue', W - 220, H - 118);
    ctx.restore();
  },

  drawStart(ctx, state, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,34,0.88)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd820';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLMAR', W / 2, H / 2 - 130);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('—  VICE HARBOR  —', W / 2, H / 2 - 88);
    ctx.fillStyle = '#c8d8e8';
    ctx.font = '16px sans-serif';
    ctx.fillText('Mara Voss owes $10,000 to Donna Ferrante. Five jobs. One city. No brakes.', W / 2, H / 2 - 48);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    const lines = [
      'WASD / Arrows — move & drive      E — steal / enter car, talk',
      'SHIFT — run      F — punch      T — taxi fare      M — next mission',
      'Steal cars, dodge the VHPD, finish all 5 missions to clear the debt.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 10 + i * 26));
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(state.saveExists ? 'Press ENTER to continue your game' : 'Press ENTER to start', W / 2, H / 2 + 130);
    ctx.fillStyle = '#8899aa';
    ctx.font = '13px sans-serif';
    ctx.fillText('An original open-world crime game — no real cars, people or places. Sound on for the full ride.', W / 2, H - 40);
    ctx.restore();
  },

  drawWasted(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(20,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BUSTED', W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('The VHPD caught up with Mara. Press R to get back on the streets.', W / 2, H / 2 + 30);
    ctx.restore();
  },
};

function missionMarker(state) {
  const step = currentStep(state);
  if (!step || step.type !== 'goto') return null;
  return { x: step.x, y: step.y, label: 'MISSION' };
}

// Particles, skid marks and floating text: cheap, pooled, no per-frame allocation
// beyond a short-lived array that is reused every frame.
export class Particles {
  constructor() {
    this.list = [];
    this.skids = [];
    this.texts = [];
  }
  burst(x, y, n, color, speed, life, size) {
    for (let i = 0; i < n; i++) {
      if (this.list.length > 320) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), maxLife: life, color, size: size * (0.6 + Math.random() * 0.8) });
    }
  }
  smoke(x, y) {
    if (this.list.length > 320) return;
    this.list.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 12, vy: -18 - Math.random() * 14, life: 1.1, maxLife: 1.1, color: '#888888', size: 7 + Math.random() * 5 });
  }
  sparks(x, y) { this.burst(x, y, 10, '#ffd94a', 260, 0.4, 2.5); }
  muzzle(x, y, angle) {
    this.burst(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, 5, '#ffe14a', 200, 0.12, 3);
  }
  addSkid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 6 });
    if (this.skids.length > 240) this.skids.shift();
  }
  addText(x, y, text, color) {
    this.texts.push({ x, y, text, color: color || '#ffffff', life: 1.6 });
    if (this.texts.length > 24) this.texts.shift();
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.98; p.vy *= 0.98;
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y -= 24 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }
}

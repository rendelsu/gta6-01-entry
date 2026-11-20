// SOLMAR — Vice Harbor (r6): all sound is synthesized with WebAudio —
// engine hum, sirens, gunshots, pickup blips and a low-key synthwave loop.
// No audio files, no network.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.15, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  pickup() { this.blip(660, 0.12, 'sine', 0.2); setTimeout(() => this.blip(990, 0.18, 'sine', 0.2), 90); }
  cash() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.15, 'triangle', 0.2), i * 80)); }
  gunshot() {
    if (!this.ctx || this.muted) return;
    const len = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.3;
    src.connect(g); g.connect(this.master);
    src.start();
  }
  explosion() {
    if (!this.ctx || this.muted) return;
    const len = 0.7;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 400;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 700;
      g.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lg = this.ctx.createGain();
      lg.gain.value = 260;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.sirenOsc = o; this.sirenLfo = lfo; this.sirenGain = g;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null; this.sirenLfo = null; this.sirenGain = null;
    }
  }
  engine(on, speed) {
    if (!this.ctx) return;
    if (on && !this.engineOsc) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 60;
      g.gain.value = 0.05;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.engineOsc = o; this.engineGain = g;
    } else if (!on && this.engineOsc) {
      try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
      this.engineOsc = null; this.engineGain = null;
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + Math.abs(speed) * 0.9;
      this.engineGain.gain.value = 0.03 + Math.min(0.06, Math.abs(speed) * 0.0004);
    }
  }
  startMusic() {
    // Slow synthwave loop: bass root notes + a sparse lead, 8 steps a bar.
    const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    const lead = [220, 0, 261.63, 0, 329.63, 0, 293.66, 246.94];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) { this.step++; return; }
      const i = this.step % 8;
      if (bass[i]) this.blip(bass[i], 0.5, 'triangle', 0.10);
      if (lead[i]) this.blip(lead[i], 0.4, 'sine', 0.06);
      this.step++;
    }, 340);
  }
}

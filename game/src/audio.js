// Synthesized audio for SOLMAR — Vice Harbor. No audio files: WebAudio only.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
    this.sirenOsc = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch (e) { this.ctx = null; }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }
  punch() { this.blip(160, 0.12, 'square', 0.25, 60); }
  shoot() { this.blip(900, 0.09, 'sawtooth', 0.2, 120); }
  thud() { this.blip(90, 0.15, 'triangle', 0.3, 45); }
  cash() { this.blip(880, 0.1, 'sine', 0.2); setTimeout(() => this.blip(1320, 0.16, 'sine', 0.2), 90); }
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 120)); }
  busted() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.2), i * 160)); }
  horn() { this.blip(370, 0.18, 'square', 0.12, 370); }
  setEngine(running, speedNorm) {
    if (!this.ctx || this.muted) { this.stopEngine(); return; }
    try {
      if (running && !this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0.03;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 600;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      if (this.engineOsc) {
        this.engineOsc.frequency.value = 60 + speedNorm * 160;
        this.engineGain.gain.value = running ? 0.02 + speedNorm * 0.05 : 0;
      }
      if (!running) this.stopEngine();
    } catch (e) { /* ignore */ }
  }
  stopEngine() {
    if (this.engineOsc) { try { this.engineOsc.stop(); } catch (e) {} this.engineOsc = null; this.engineGain = null; }
  }
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      try {
        this.sirenOsc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        g.gain.value = 0.045;
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 700;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.7;
        const lg = this.ctx.createGain(); lg.gain.value = 220;
        lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
        this.sirenOsc.connect(g); g.connect(this.master);
        this.sirenOsc.start(); lfo.start();
        this.sirenLfo = lfo; this.sirenGain = g;
      } catch (e) { this.sirenOsc = null; }
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null;
    }
  }
  // Loose late-night synthwave bassline, quiet under the game.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = bass[this.musicStep % bass.length];
      this.musicStep++;
      this.blip(f, 0.5, 'triangle', 0.06);
      if (this.musicStep % 4 === 0) this.blip(f * 4, 0.12, 'sine', 0.03);
    }, 320);
  }
}

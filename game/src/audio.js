// Synthesised sound: every effect is built with WebAudio oscillators and noise,
// so the game ships no audio files and makes no network request.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = src;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(this.master);
    src.start(t);
  }
  click() { this.tone(660, 0.06, 'square', 0.08); }
  punch() { this.noise(0.09, 0.25, 900); this.tone(140, 0.08, 'sine', 0.2, 70); }
  gunshot() { this.noise(0.16, 0.4, 2400); this.tone(220, 0.1, 'sawtooth', 0.14, 60); }
  crash() { this.noise(0.35, 0.45, 700); this.tone(90, 0.3, 'sine', 0.25, 40); }
  pickup() { this.tone(880, 0.08, 'sine', 0.12); setTimeout(() => this.tone(1318, 0.12, 'sine', 0.12), 70); }
  cash() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.12), i * 80));
  }
  missionDone() {
    [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.14), i * 110));
  }
  busted() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'sawtooth', 0.12), i * 220)); }
  horn() { this.tone(370, 0.18, 'square', 0.07); setTimeout(() => this.tone(370, 0.18, 'square', 0.07), 220); }
  // Engine hum follows the driven car's speed; call every frame while driving.
  engine(speedRatio, on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, t, 0.08);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.045 + speedRatio * 0.05, t, 0.1);
  }
  // Two-tone police siren while any wanted level is active.
  siren(on) {
    if (!this.ctx) return;
    if (!on) { if (this.sirenGain) this.sirenGain.gain.value = 0; return; }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lg = this.ctx.createGain(); lg.gain.value = 180;
      lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 780;
      lfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : 0.035, this.ctx.currentTime, 0.2);
  }
  // Tiny sunset-drive bass loop: a 16-step pattern, no samples.
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0];
    const step = () => {
      if (!this.musicOn) return;
      const n = bass[this.musicStep % 16];
      if (n && !this.muted) this.tone(n, 0.24, 'triangle', 0.09);
      if (this.musicStep % 4 === 2 && !this.muted) this.noise(0.03, 0.05, 6000);
      this.musicStep++;
      this.musicTimer = setTimeout(step, 210);
    };
    step();
  }
  stopMusic() { this.musicOn = false; if (this.musicTimer) clearTimeout(this.musicTimer); }
}

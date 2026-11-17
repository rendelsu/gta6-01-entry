// Synthesised sound: every effect is generated with WebAudio, no audio files.
// The engine hum, sirens, gunshots and stings are all oscillators + noise.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.muted = false;
    this.started = false;
  }

  ensure() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a sine that wails between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.started = true;
    } catch (e) {
      this.started = false;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  setEngine(speed01, on) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, t, 0.08);
  }

  setSiren(on, dt) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on && !this.muted ? 0.045 : 0, t, 0.2);
    if (on) {
      this.sirenTimer += dt;
      const f = (this.sirenTimer % 1.2) < 0.6 ? 720 : 960;
      this.sirenOsc.frequency.setTargetAtTime(f, t, 0.05);
    }
  }

  blip(freq, dur, type = 'square', vol = 0.12) {
    if (!this.started || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  noiseBurst(dur, vol, filterFreq = 1800) {
    if (!this.started || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shot() { this.noiseBurst(0.12, 0.5, 2600); this.blip(160, 0.08, 'square', 0.18); }
  enemyShot() { this.noiseBurst(0.1, 0.28, 1800); }
  crash() { this.noiseBurst(0.25, 0.4, 700); }
  pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(990, 0.12), 70); }
  honk() { this.blip(370, 0.18, 'square', 0.1); }
  denied() { this.blip(140, 0.2, 'sawtooth', 0.12); }
  sting() {
    // Mission-passed arpeggio.
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.16), i * 110));
  }
  failSting() {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.3, 'sawtooth', 0.1), i * 160));
  }
}

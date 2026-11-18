// SOLMAR — Vice Harbor: synthesized sound. Every effect is built with the
// Web Audio API at run time; the game loads no audio files.

const AudioSys = {
  ctx: null, master: null, engineOsc: null, engineGain: null, sirenOsc: null,
  sirenGain: null, sirenLfo: null, muted: false, started: false,

  init() {
    if (this.started) return;
    this.started = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: a low sawtooth whose pitch follows the car's speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: two alternating tones while the police are after you.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 320;
      this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); this.sirenLfo.start();
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.35; },

  setEngine(speedFrac, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + 0.06 * speedFrac : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + 130 * speedFrac, t, 0.1);
  },
  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  },

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + (dur || 0.12));
    } catch (e) {}
  },
  punch() { this.blip(140, 0.12, 'sawtooth', 0.2); },
  pickup() { this.blip(880, 0.1, 'sine', 0.15); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.15), 90); },
  cash() { this.blip(990, 0.08, 'sine', 0.14); setTimeout(() => this.blip(1240, 0.16, 'sine', 0.14), 80); },
  crash() { this.blip(70, 0.25, 'sawtooth', 0.25); },
  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.16), i * 110));
  },
  wantedUp() { this.blip(220, 0.2, 'sawtooth', 0.18); setTimeout(() => this.blip(180, 0.25, 'sawtooth', 0.18), 160); },
};

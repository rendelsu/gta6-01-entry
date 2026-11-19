// Synthesised sound: no audio files, everything comes from WebAudio.
export function makeAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      started = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, low) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = low || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get started() { return started; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    click() { blip(660, 0.07, 'square', 0.12); },
    pickup() { blip(520, 0.09, 'sine', 0.22); setTimeout(() => blip(780, 0.12, 'sine', 0.22), 80); },
    cash() {
      blip(880, 0.08, 'triangle', 0.2);
      setTimeout(() => blip(1174, 0.14, 'triangle', 0.2), 90);
    },
    gunshot() { noise(0.16, 0.5, 900); },
    punch() { noise(0.08, 0.35, 500); },
    crash() { noise(0.3, 0.5, 700); blip(90, 0.25, 'sawtooth', 0.25, 40); },
    sirenBlip() { blip(980, 0.12, 'square', 0.08, 1240); },
    mission() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.2), i * 110));
    },
    fail() { blip(220, 0.3, 'sawtooth', 0.18, 110); },
    engine(on, speedRatio) {
      if (!ensure() || muted) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.05;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        engineOsc.connect(f);
        f.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (!on && engineOsc) {
        try { engineOsc.stop(); } catch (e) {}
        engineOsc = null;
        engineGain = null;
        return;
      }
      if (engineOsc) {
        engineOsc.frequency.value = 55 + speedRatio * 130;
        engineGain.gain.value = 0.03 + speedRatio * 0.05;
      }
    },
    siren(on) {
      if (!ensure() || muted) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let hi = false;
        sirenOsc._iv = setInterval(() => {
          hi = !hi;
          try { sirenOsc.frequency.value = hi ? 960 : 720; } catch (e) {}
        }, 420);
      }
      if (!on && sirenOsc) {
        clearInterval(sirenOsc._iv);
        try { sirenOsc.stop(); } catch (e) {}
        sirenOsc = null;
        sirenGain = null;
      }
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
      let step = 0;
      musicTimer = setInterval(() => {
        if (muted) return;
        blip(bass[step % bass.length], 0.34, 'triangle', 0.1);
        if (step % 2 === 0) blip(bass[step % bass.length] * 2, 0.1, 'sine', 0.05);
        step++;
      }, 340);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
  };
}

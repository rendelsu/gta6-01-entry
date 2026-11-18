// SOLMAR — Vice Harbor: boot, input and the main loop.

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = newGameState();
  const keys = {};
  let W = 1280, H = 720;
  let lastT = 0;

  window.__solmar = state; // exposed for playtesting and screenshots

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W; canvas.height = H;
  }
  window.addEventListener('resize', resize);
  resize();

  buildCity();
  state.saveExists = loadSave(state);

  // Parked cars scattered through the city, ready to steal.
  for (let i = 0; i < 14; i++) {
    const p = randomRoadPoint();
    const type = pickVehicleType(true);
    const car = makeCar(p.x, p.y, chance(0.5) ? 0 : Math.PI / 2, type, { driver: chance(0.5) });
    state.parked.push(car);
  }
  for (let i = 0; i < 26; i++) spawnTrafficCar(state);
  for (let i = 0; i < 30; i++) state.peds.push(spawnPed(state));

  // Screenshot presets: ?shot=1..4 stages a real gameplay state.
  const params = new URLSearchParams(window.location.search);
  const shot = parseInt(params.get('shot') || '0', 10);
  if (shot >= 1 && shot <= 4) applyShotPreset(state, shot);

  const KEYMAP = {
    KeyW: 'w', ArrowUp: 'up', KeyA: 'a', ArrowLeft: 'left',
    KeyS: 's', ArrowDown: 'down', KeyD: 'd', ArrowRight: 'right',
    ShiftLeft: 'shift', ShiftRight: 'shift', Space: 'space',
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    const k = KEYMAP[e.code];
    if (k) keys[k] = true;
    if (e.repeat) return;
    AudioSys.init(); AudioSys.resume();
    if (e.code === 'Enter' && !state.started) {
      state.started = true;
      if (!state.saveExists) startMission(state, 0);
      else state.dialog = { speaker: 'MARA VOSS', text: 'Mara: "Welcome back. The debt is still ' + fmtMoney(Math.max(0, DEBT_TOTAL - state.debtPaid)) + '. Press M when you are ready for the next job."', mission: '', open: true };
    } else if (e.code === 'KeyM') {
      if (state.started && !state.missionActive && !state.storyDone) startMission(state, state.missionIndex);
    } else if (e.code === 'KeyE') {
      if (!state.started) return;
      if (state.dialog && state.dialog.open) { state.dialog.open = false; return; }
      if (state.player.car) exitCar(state);
      else {
        const car = nearestCar(state, state.player.x, state.player.y, 70);
        if (car) enterCar(state, car);
      }
    } else if (e.code === 'KeyF') {
      if (state.started && !state.player.car) punch(state);
    } else if (e.code === 'KeyT') {
      if (state.started && state.player.car && state.player.car.type.id === 'taxi' && !state.fare && !state.missionActive) startFare(state);
    } else if (e.code === 'KeyR') {
      if (state.wasted) {
        state.wasted = false;
        state.player.hp = 100;
        state.wanted = 0;
        state.police = [];
        state.player.x = 1760; state.player.y = 1760;
        if (state.player.car) { state.player.car = null; }
      }
    } else if (e.code === 'KeyU') {
      AudioSys.toggleMute();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });
  canvas.addEventListener('mousedown', () => { AudioSys.init(); AudioSys.resume(); });

  window.addEventListener('error', (e) => { state.errors++; });

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (state.started && !state.wasted) updateGame(state, keys, dt);
    // Camera: follow the player, shaken by crashes and punches.
    const px = state.player.car ? state.player.car.x : state.player.x;
    const py = state.player.car ? state.player.car.y : state.player.y;
    const shakeX = state.shake > 0 ? rand(-state.shake, state.shake) : 0;
    const shakeY = state.shake > 0 ? rand(-state.shake, state.shake) : 0;
    const camX = clamp(px - W / 2 + shakeX, -60, CITY_W - W + 60);
    const camY = clamp(py - H / 2 + shakeY, -60, CITY_H - H + 60);
    state.camX = camX; state.camY = camY;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const cam = { x: camX, y: camY, w: W, h: H };
    if (state.started) {
      ctx.translate(-camX, -camY);
      Render.drawWorld(ctx, state, cam);
      for (const car of state.parked) Render.drawCar(ctx, car, t / 1000);
      for (const car of state.traffic) Render.drawCar(ctx, car, t / 1000);
      for (const car of state.police) Render.drawCar(ctx, car, t / 1000);
      for (const ped of state.peds) Render.drawPed(ctx, ped, t / 1000);
      if (state.player.car) Render.drawCar(ctx, state.player.car, t / 1000);
      Render.drawPlayer(ctx, state, t / 1000);
      Render.drawLighting(ctx, state, cam);
      ctx.restore();
      Render.drawHUD(ctx, state, W, H);
      Render.drawDialog(ctx, state, W, H);
      if (state.wasted) Render.drawWasted(ctx, W, H);
    } else {
      ctx.restore();
      Render.drawStart(ctx, state, W, H);
    }
  }
  requestAnimationFrame(frame);
})();

// SOLMAR — Vice Harbor. Bootstrap, fixed-timestep loop, and the glue between
// every system: input, driving, stealing, wanted, missions, combat, save.
import { City, WORLD_W, WORLD_H, avenueX, streetY, nearestRoadPoint } from './city.js';
import { Car } from './vehicles.js';
import { Player, Pedestrian } from './people.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Particles } from './particles.js';
import { MissionManager } from './missions.js';
import { Renderer, Camera } from './render.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { writeSave, readSave, hasSave } from './save.js';
import { clamp, dist, randRange, pick } from './utils.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TRAFFIC_COLORS = ['#c8c8d0', '#7a9a7a', '#d9b84a', '#8a7ad9', '#d97a4a', '#5a8a9a', '#b0b0b0', '#e8e8e8'];
const TRAFFIC_TYPES = ['sedan', 'sedan', 'compact', 'van', 'taxi', 'sedan', 'truck', 'muscle'];

export class Game {
  constructor() {
    this.city = new City();
    this.sound = new SoundBank();
    this.input = new Input(canvas);
    this.renderer = new Renderer(ctx);
    this.camera = new Camera();
    this.hud = new HUD();
    this.particles = new Particles();
    this.combat = new Combat();
    this.police = new Police(this);
    this.missions = new MissionManager(this);
    this.player = new Player(avenueX(2), streetY(6) + 120);
    this.cars = [];
    this.peds = [];
    this.state = 'title'; // title | playing | paused | busted | wasted
    this.time = 0;
    this.playStartedAt = 0;
    this.frame = 0;
    this.saveExists = hasSave();
    this.spawnTimer = 0;
    this.pedTimer = 0;
    this.trafficTimer = 0;
    this.titleCamAngle = 0;
    this.shakeAmt = 0;
    this.setupWorld();
  }
  setupWorld() {
    // Parked cars from the city's parking spots.
    for (const s of this.city.parkingSpots) {
      const type = pick(Math.random, TRAFFIC_TYPES);
      const car = new Car(type, s.x, s.y, s.angle, 'parked');
      car.color = pick(Math.random, TRAFFIC_COLORS);
      this.cars.push(car);
    }
    // A few moving traffic cars near the start.
    for (let i = 0; i < 10; i++) this.spawnTraffic(true);
    for (let i = 0; i < 14; i++) this.spawnPed(true);
  }
  spawnTraffic(anywhere) {
    const p = this.player;
    const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    let x, y;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = anywhere ? Math.random() * 700 : 620 + Math.random() * 260;
      x = clamp(px + Math.cos(a) * d, 80, 3400);
      y = clamp(py + Math.sin(a) * d, 80, 2800);
      const rp = nearestRoadPoint(x, y);
      x = rp.x; y = rp.y;
      if (dist(x, y, px, py) > 260) break;
    }
    const vertical = Math.random() < 0.5;
    const angle = vertical ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
    const type = pick(Math.random, TRAFFIC_TYPES);
    const car = new Car(type, x, y, angle, 'traffic');
    car.color = pick(Math.random, TRAFFIC_COLORS);
    car.cruiseSpeed = randRange(Math.random, 120, 185);
    this.cars.push(car);
    return car;
  }
  spawnPed(anywhere) {
    const p = this.player;
    let x, y;
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = anywhere ? Math.random() * 500 : 480 + Math.random() * 200;
      x = clamp(p.x + Math.cos(a) * d, 60, 3380);
      y = clamp(p.y + Math.sin(a) * d, 60, 2820);
      if (!this.city.insideBuilding(x, y)) break;
    }
    const ped = new Pedestrian(x, y, Math.random);
    this.peds.push(ped);
    return ped;
  }
  spawnMissionCar(type, x, y, color) {
    const car = new Car(type, x, y, -Math.PI / 2, 'mission');
    if (color) car.color = color;
    this.cars.push(car);
    return car;
  }
  shake(amount) { this.camera.shakeBy(amount); }
  toast(text) { this.hud.showToast(text); }
  dialogue(lines) { this.hud.showDialogue(lines); }
  flashBanner(title, sub) { this.hud.showBanner(title, sub); }
  // ---- save / load ----
  saveGame() {
    const p = this.player;
    writeSave({
      cash: p.cash,
      health: p.health,
      missionIndex: this.missions.index,
      completed: this.missions.completedCount,
      storyDone: this.missions.storyDone,
      x: p.x, y: p.y,
      weapon: p.weapon,
      ammo: p.ammo,
      savedAt: Date.now(),
    });
    this.saveExists = true;
  }
  loadGame() {
    const s = readSave();
    if (!s) return false;
    const p = this.player;
    p.cash = s.cash ?? 250;
    p.health = s.health ?? 100;
    p.x = clamp(s.x ?? avenueX(2), 40, 3800);
    p.y = clamp(s.y ?? streetY(6), 40, 2840);
    p.weapon = s.weapon || 'fists';
    p.ammo = s.ammo ?? 12;
    this.missions.index = s.missionIndex ?? 0;
    this.missions.completedCount = s.completed ?? 0;
    this.missions.storyDone = !!s.storyDone;
    this.missions.active = null;
    this.missions.marker = null;
    this.police.clearWanted();
    return true;
  }
  newGame() {
    this.player = new Player(avenueX(2), streetY(6) + 120);
    this.missions = new MissionManager(this);
    this.police = new Police(this);
    this.combat = new Combat();
    this.cars = this.cars.filter((c) => c.role === 'parked' || c.role === 'traffic');
    this.state = 'playing';
    this.playStartedAt = this.time;
    this.sound.ensure();
    this.sound.startMusic();
    this.toast('Welcome to Vice Harbor, Mara. Go to the yellow marker.');
  }
  startPlaying(continued) {
    if (!continued) this.newGame();
    else {
      this.state = 'playing';
      this.playStartedAt = this.time;
      this.sound.ensure();
      this.sound.startMusic();
    }
  }
  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.sound.busted();
    this.sound.engine(0, false);
    this.player.cash = Math.max(0, this.player.cash - 150);
    this.police.clearWanted();
    this.saveGame();
  }
  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.sound.busted();
    this.sound.engine(0, false);
    this.player.cash = Math.max(0, this.player.cash - 200);
    this.player.health = 100;
    this.player.dead = false;
    this.police.clearWanted();
    this.saveGame();
  }
  respawn() {
    const lm = this.city.landmarks.hospital;
    const p = this.player;
    p.x = lm.x; p.y = lm.y + 60;
    p.health = 100;
    p.dead = false;
    if (p.car) { p.car = null; p.onFoot = true; }
    this.state = 'playing';
    this.playStartedAt = this.time;
    this.toast('Back on the streets. Stay out of trouble — or don\u2019t.');
  }
  // ---- interaction: E key ----
  interact() {
    const g = this;
    const p = g.player;
    if (g.hud.dialogueActive()) { g.hud.advanceDialogue(); return; }
    if (g.missions.interact()) return;
    if (p.onFoot) {
      // Enter the nearest car.
      let best = null, bd = 78;
      for (const c of g.cars) {
        if (c.dead) continue;
        const d = dist(p.x, p.y, c.x, c.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        p.car = best;
        p.onFoot = false;
        best.role = 'player';
        best.occupied = true;
        g.sound.click();
        if (best.role === 'player' && g.police.wanted === 0) {
          // stealing a parked/traffic car is a crime — unless it is the mission car
          if (best.type !== 'muscle' || g.missions.active?.def.id !== 'm5') {
            g.police.addWanted(1);
            g.toast('Car stolen! The VHPD is on to you.');
          }
        }
        g.toast(best.spec.name + ' — drive with WASD, E to get out');
      }
    } else if (p.car) {
      p.x = p.car.x + Math.cos(p.car.angle + Math.PI / 2) * 34;
      p.y = p.car.y + Math.sin(p.car.angle + Math.PI / 2) * 34;
      p.angle = p.car.angle;
      p.car.role = p.car.type === 'police' ? 'police' : 'parked';
      p.car.occupied = false;
      p.car = null;
      p.onFoot = true;
      g.sound.click();
    }
  }
  // ---- shooting ----
  shoot() {
    const p = this.player;
    if (!p.onFoot || p.weapon !== 'pistol' || p.shootCooldown > 0) return;
    if (p.ammo <= 0) {
      if (p.ammoReserve > 0) this.reload();
      else this.toast('Out of ammo — find the garage stash');
      return;
    }
    p.shootCooldown = 0.24;
    p.ammo--;
    // aim at the mouse in world space
    const cam = this.camera;
    const wx = (this.input.mouseX - 640) / cam.zoom + cam.x;
    const wy = (this.input.mouseY - 360) / cam.zoom + cam.y;
    const a = Math.atan2(wy - p.y, wx - p.x) + (Math.random() - 0.5) * 0.05;
    p.angle = a;
    this.combat.fireBullet(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a, true, 34);
    this.particles.muzzle(p.x, p.y, a);
    this.sound.gunshot();
    this.shake(2);
  }
  reload() {
    const p = this.player;
    if (p.weapon !== 'pistol' || p.ammoReserve <= 0) return;
    const need = 12 - p.ammo;
    const take = Math.min(need, p.ammoReserve);
    p.ammo += take;
    p.ammoReserve -= take;
    this.sound.click();
  }
  // ---- per-frame update (fixed step) ----
  update(dt) {
    this.time += dt;
    this.hud.update(dt);
    this.particles.update(dt);
    if (this.state === 'title') {
      // slow cinematic pan over downtown for the title backdrop
      this.titleCamAngle += dt * 0.05;
      const cx = 1900 + Math.cos(this.titleCamAngle) * 500;
      const cy = 1300 + Math.sin(this.titleCamAngle * 0.7) * 300;
      this.camera.follow(cx, cy, dt, 0.85);
      this.updateAmbient(dt);
      return;
    }
    if (this.state === 'paused' || this.state === 'busted' || this.state === 'wasted') return;
    const p = this.player;
    const input = this.input;
    // menu keys
    if (input.wasPressed('escape')) { this.state = 'paused'; this.hud.pauseSelection = 0; this.sound.engine(0, false); return; }
    if (input.wasPressed('m')) { this.sound.ensure(); this.sound.setMuted(!this.sound.muted); this.toast(this.sound.muted ? 'Sound off' : 'Sound on'); }
    if (input.wasPressed('t')) this.missions.startSideJob();
    if (input.wasPressed('1')) { p.weapon = 'fists'; this.sound.click(); }
    if (input.wasPressed('2')) {
      if (p.ammo + p.ammoReserve > 0 || this.missions.completedCount >= 3) { p.weapon = 'pistol'; this.sound.click(); }
      else this.toast('No pistol yet — finish the garage job first (mission 4)');
    }
    if (input.wasPressed('r')) this.reload();
    if (input.wasPressed('e')) this.interact();
    if (input.wasPressed('f')) this.combat.punch(this);
    if (input.mouseDown || input.wasPressed('mouse0')) this.shoot();
    if (this.hud.dialogueActive()) {
      if (input.wasPressed('enter') || input.wasPressed(' ')) this.hud.advanceDialogue();
    }
    // aim on foot follows the mouse
    if (p.onFoot && p.weapon === 'pistol' && !this.hud.dialogueActive()) {
      const cam = this.camera;
      const wx = (input.mouseX - 640) / cam.zoom + cam.x;
      const wy = (input.mouseY - 360) / cam.zoom + cam.y;
      if (dist(wx, wy, p.x, p.y) > 24) p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
    // player movement / driving
    if (p.onFoot) {
      p.update(dt, input, this.city);
      this.sound.engine(0, false);
    } else if (p.car) {
      const car = p.car;
      let throttle = 0, steer = 0;
      if (input.up) throttle += 1;
      if (input.down) throttle -= 1;
      if (input.left) steer -= 1;
      if (input.right) steer += 1;
      car.drive(throttle, steer, dt);
      car.crashCooldown = Math.max(0, car.crashCooldown - dt);
      const hit = this.city.collideCircle(car.x, car.y, 20);
      if (hit.hit && Math.abs(car.forwardSpeed()) > 120 && car.crashCooldown <= 0) {
        car.crashCooldown = 0.7;
        car.damage(9);
        this.sound.crash();
        this.particles.sparks(car.x, car.y);
        this.shake(6);
        car.speed *= 0.4;
      }
      car.x = hit.x; car.y = hit.y;
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      if (car.skid) this.particles.addSkid(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
      this.sound.engine(Math.abs(car.forwardSpeed()) / car.spec.top, true);
      if (car.dead) {
        this.particles.burst(car.x, car.y, 24, '#ff7a2a', 300, 0.8, 4);
        this.sound.crash();
        this.shake(10);
        p.car = null;
        p.onFoot = true;
        p.x = car.x + 40; p.y = car.y + 40;
        this.toast('Your car is wrecked. On foot again.');
      }
      // running over pedestrians is a crime
      for (const ped of this.peds) {
        if (!ped.dead && ped.down <= 0 && dist(car.x, car.y, ped.x, ped.y) < 24 && Math.abs(car.forwardSpeed()) > 60) {
          ped.knockDown();
          this.police.addWanted(1);
          this.particles.burst(ped.x, ped.y, 8, '#ff5a4a', 140, 0.4, 3);
          this.sound.crash();
        }
      }
    }
    if (p.dead) { this.wasted(); return; }
    // car-vs-car collisions (player car vs others)
    this.collideCars(dt);
    // traffic + peds + police + combat + missions
    this.updateAmbient(dt);
    this.police.update(dt);
    this.combat.update(dt, this);
    this.missions.update(dt);
    this.missions.updateSideJob(dt);
    // camera
    const tx = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const ty = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    const zoomTarget = p.onFoot ? 1 : 0.85;
    this.camera.follow(tx, ty, dt, zoomTarget);
  }
  collideCars(dt) {
    const cars = this.cars;
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        if (b.dead) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        const min = 34;
        if (d < min && d > 0.01) {
          const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          const push = (min - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const impact = Math.abs(a.forwardSpeed() - b.forwardSpeed());
          if (impact > 90) {
            a.damage(4); b.damage(4);
            this.particles.sparks((a.x + b.x) / 2, (a.y + b.y) / 2);
            if (a.role === 'player' || b.role === 'player') { this.sound.crash(); this.shake(4); }
          }
          a.speed *= 0.85; b.speed *= 0.85;
        }
      }
    }
    // remove wrecked traffic far away, keep the player's car
    this.cars = this.cars.filter((c) => !c.dead || c.role === 'player' || c.role === 'mission');
    for (const c of this.cars) {
      if (c.dead && c.role !== 'player' && c.role !== 'mission') {
        c.x = -9999; c.y = -9999;
      }
    }
  }
  updateAmbient(dt) {
    const p = this.player;
    const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    // traffic upkeep
    this.trafficTimer -= dt;
    const traffic = this.cars.filter((c) => c.role === 'traffic' && !c.dead).length;
    if (this.trafficTimer <= 0) {
      this.trafficTimer = 1.2;
      if (traffic < 16) this.spawnTraffic(false);
      // despawn traffic far from the player
      for (const c of this.cars) {
        if (c.role === 'traffic' && dist(c.x, c.y, px, py) > 1400) c.dead = true;
      }
      this.cars = this.cars.filter((c) => !(c.role === 'traffic' && c.dead));
    }
    for (const c of this.cars) {
      if (c.role === 'traffic') {
        c.trafficUpdate(dt, this.city, this.cars, { x: px, y: py });
        const hit = this.city.collideCircle(c.x, c.y, 20);
        if (hit.hit) { c.x = hit.x; c.y = hit.y; c.angle += Math.PI / 2; c.damage(1); }
        if (c.smoking && Math.random() < dt * 6) this.particles.smoke(c.x, c.y - 8);
      }
    }
    // pedestrians upkeep
    this.pedTimer -= dt;
    if (this.pedTimer <= 0) {
      this.pedTimer = 1.5;
      const near = this.peds.filter((pd) => !pd.dead && dist(pd.x, pd.y, px, py) < 700).length;
      if (near < 12) this.spawnPed(false);
      this.peds = this.peds.filter((pd) => !pd.dead && dist(pd.x, pd.y, px, py) < 1200);
    }
    const danger = this.police.wanted > 0 || this.combat.bullets.length > 0
      ? { x: px, y: py } : null;
    for (const ped of this.peds) ped.update(dt, this.city, danger);
    // smoking cars puff
    const pc = p.car;
    if (pc && pc.smoking && Math.random() < dt * 8) this.particles.smoke(pc.x, pc.y - 8);
  }
  // ---- title / pause menu input ----
  menuUpdate() {
    const input = this.input;
    if (this.state === 'title') {
      const items = this.hud.titleItems || ['New Game'];
      if (input.wasPressed('arrowup') || input.wasPressed('w')) {
        this.hud.titleSelection = (this.hud.titleSelection - 1 + items.length) % items.length;
        this.sound.ensure(); this.sound.click();
      }
      if (input.wasPressed('arrowdown') || input.wasPressed('s')) {
        this.hud.titleSelection = (this.hud.titleSelection + 1) % items.length;
        this.sound.ensure(); this.sound.click();
      }
      if (input.wasPressed('enter') || input.wasPressed(' ')) {
        const choice = items[this.hud.titleSelection];
        this.sound.ensure();
        if (choice === 'Continue') { if (this.loadGame()) this.startPlaying(true); }
        else if (choice === 'New Game') this.startPlaying(false);
        else if (choice === 'Controls') this.toast('WASD move/drive · E enter car · Mouse aim · Click shoot · F punch · Esc pause');
        else if (choice && choice.startsWith('Sound')) { this.sound.setMuted(!this.sound.muted); }
      }
    } else if (this.state === 'paused') {
      const items = this.hud.pauseItems || ['Resume'];
      if (input.wasPressed('arrowup') || input.wasPressed('w')) {
        this.hud.pauseSelection = (this.hud.pauseSelection - 1 + items.length) % items.length;
        this.sound.click();
      }
      if (input.wasPressed('arrowdown') || input.wasPressed('s')) {
        this.hud.pauseSelection = (this.hud.pauseSelection + 1) % items.length;
        this.sound.click();
      }
      if (input.wasPressed('escape')) { this.state = 'playing'; }
      if (input.wasPressed('enter') || input.wasPressed(' ')) {
        const choice = items[this.hud.pauseSelection];
        if (choice === 'Resume') this.state = 'playing';
        else if (choice === 'Save Game') { this.saveGame(); this.toast('Game saved'); }
        else if (choice === 'Load Game') { if (this.loadGame()) this.toast('Game loaded'); }
        else if (choice === 'Restart Mission') {
          if (this.missions.active) { this.missions.active = null; this.missions.marker = null; this.toast('Mission restarted — go to the marker'); }
          this.state = 'playing';
        } else if (choice === 'Quit to Title') {
          this.saveGame();
          this.state = 'title';
          this.sound.stopMusic();
        } else if (choice && choice.startsWith('Sound')) { this.sound.setMuted(!this.sound.muted); }
      }
    } else if (this.state === 'busted' || this.state === 'wasted') {
      if (input.wasPressed('enter') || input.wasPressed(' ')) this.respawn();
    }
  }
  render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1280, 720);
    this.camera.apply(ctx, 1280, 720);
    this.renderer.drawWorld(this, 1 / 60);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.hud.draw(ctx, this);
  }
  // Debug hook for the maker's own playtest: stage scenes for screenshots.
  // Not a cheat — it only repositions the player and sets mission/police state.
  debugScene(name) {
    const p = this.player;
    const lm = this.city.landmarks;
    this.state = 'playing';
    this.playStartedAt = this.time - 10; // staged scene: hide the first-seconds controls hint
    this.hud.dialogueLines = [];
    this.hud.dialogueIdx = 0;
    if (name === 'chase') {
      const car = this.spawnMissionCar('sports', lm.strip.x, lm.strip.y + 40, '#d92a3a');
      car.angle = 0; // head east along the Strip, straight road ahead
      p.car = car; p.onFoot = false; car.role = 'player';
      p.x = car.x; p.y = car.y;
      this.police.wanted = 3;
      this.police.spawnTimer = 3;
      // Two cruisers already in pursuit, close behind and in frame.
      for (const off of [-280, -420]) {
        const cop = new Car('police', car.x + off, car.y + 18, 0, 'police');
        this.cars.push(cop);
        this.police.cars.push(cop);
      }
      this.missions.active = { def: { title: 'The Package', steps: [{ type: 'escape', at: 'marina', radius: 120, text: 'Deliver to the Vice Marina — lose the cops first' }] }, step: 0, startedAt: this.time };
      this.missions.updateMarker();
      this.camera.x = car.x; this.camera.y = car.y;
    } else if (name === 'street') {
      p.x = avenueX(5); p.y = streetY(3) + 60;
      p.onFoot = true; p.car = null;
      this.police.wanted = 0;
      this.missions.active = { def: { title: 'Homecoming', steps: [{ type: 'goto', at: 'garage', radius: 90, text: 'Go to Rico\u2019s Garage' }] }, step: 0, startedAt: this.time };
      this.missions.updateMarker();
      this.camera.x = p.x; this.camera.y = p.y;
    } else if (name === 'mission') {
      p.x = lm.docks.x; p.y = lm.docks.y - 40;
      p.onFoot = true; p.car = null;
      this.police.wanted = 0;
      this.missions.startMission(2);
      this.missions.active.step = 1;
      this.missions.updateMarker();
      this.hud.showDialogue(['RICO: Warehouse 9. A package, no questions. The VHPD has the docks staked out tonight.']);
      this.camera.x = p.x; this.camera.y = p.y;
    } else if (name === 'shootout') {
      p.x = lm.docks.x + 120; p.y = lm.docks.y - 60;
      p.onFoot = true; p.car = null;
      p.weapon = 'pistol'; p.ammo = 24;
      this.police.wanted = 2;
      this.combat.spawnRivals(lm.docks.x, lm.docks.y, 5, 60);
      this.missions.active = { def: { title: 'Payback', steps: [{ type: 'combat', at: 'docks', radius: 200, text: 'Clear out the Coral Kings (0/5)' }] }, step: 0, startedAt: this.time };
      this.missions.updateMarker();
      this.camera.x = p.x; this.camera.y = p.y;
    }
    this.camera.follow(p.x, p.y, 1, 1);
    return true;
  }
}

const game = new Game();
window.__solmar = {
  game,
  ready: true,
  state: () => game.state,
  scene: (name) => game.debugScene(name),
  info: () => ({
    state: game.state,
    x: Math.round(game.player.x),
    y: Math.round(game.player.y),
    wanted: game.police.wanted,
    cash: game.player.cash,
    mission: game.missions.active ? game.missions.active.def.title : null,
    cars: game.cars.length,
    peds: game.peds.length,
    frame: game.frame,
  }),
};

// Fixed timestep: 60 Hz simulation, render every animation frame.
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) {
    game.update(STEP);
    game.menuUpdate();
    game.frame++;
    acc -= STEP;
    n++;
  }
  if (n === 5) acc = 0;
  game.render();
  game.input.endFrame();
}
requestAnimationFrame(loop);

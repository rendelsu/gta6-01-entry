// SOLMAR — Vice Harbor (r6): the game itself. One Game owns the world state,
// the loop, the wanted system (VHPD cars, foot cops, roadblocks, Air One),
// combat, weather and time of day, the garage, and the save file.
import { clamp, dist, angleDiff, angleTo, mulberry32, pick, randRange, fmtMoney } from './util.js';
import { generateCity, districtAt, collidesBuilding, randomRoadPoint, WORLD_W, WORLD_H } from './city.js';
import { VEHICLE_TYPES, makeCar, spawnTraffic, spawnPoliceCar, spawnPeds, makeHeli, driveCar, trafficThink, makePed } from './entities.js';
import { MISSIONS, START_DEBT, missionById, nextMissionId, startMissionState, updateMission, currentObjective, makeFare, FARE_SPOTS } from './missions.js';
import { drawWorld, drawHUD, drawMenu, drawDialog, drawGameOver, drawComplete } from './render.js';
import { AudioEngine } from './audio.js';

export const SAVE_KEY = 'solmar-vice-harbor-r6';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rng = mulberry32(20261120);
    this.city = generateCity(20261120);
    this.audio = new AudioEngine();
    this.state = 'menu';
    this.keys = {};
    this.time = 0;
    this.clock = 17 * 60 + 20; // 5:20 PM — golden hour at the start
    this.weather = 'clear'; // clear | clouds | rain
    this.weatherTimer = 120;
    this.cash = 120;
    this.debt = START_DEBT;
    this.missionsDone = [];
    this.garageCars = [];
    this.player = {
      x: 480, y: 480, angle: 0, speed: 0, hp: 100, ammo: 24,
      inCar: false, car: null, punchCd: 0, shootCd: 0, onFootSpeed: 165,
    };
    this.cars = spawnTraffic(this.rng, 26);
    this.peds = spawnPeds(this.rng, 46);
    this.cops = [];
    this.heli = null;
    this.particles = [];
    this.bullets = [];
    this.thugs = [];
    this.roadblocks = [];
    this.wanted = 0;
    this.heat = 0;
    this.wantedTimer = 0;
    this.missionState = null;
    this.fare = null;
    this.fareTimer = 8;
    this.dialog = null;
    this.dialogQueue = [];
    this.message = null;
    this.messageTimer = 0;
    this.camera = { x: 480, y: 480, zoom: 1 };
    this.raceRival = null;
    this.stats = { carsStolen: 0, faresDone: 0, racesWon: 0, arrests: 0 };
    this.load();
    this.bindInput();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // --- persistence ----------------------------------------------------------
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash, debt: this.debt, missionsDone: this.missionsDone,
        garageCars: this.garageCars, ammo: this.player.ammo, hp: this.player.hp,
      }));
    } catch (e) { /* storage unavailable — play on without saving */ }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.cash = s.cash ?? this.cash;
      this.debt = s.debt ?? this.debt;
      this.missionsDone = s.missionsDone ?? [];
      this.garageCars = s.garageCars ?? [];
      this.player.ammo = s.ammo ?? 24;
      this.player.hp = s.hp ?? 100;
    } catch (e) { /* corrupt save — start fresh */ }
  }

  // --- input ----------------------------------------------------------------
  bindInput() {
    const key = (e, down) => {
      const k = e.key.toLowerCase();
      this.keys[k] = down;
      this.keys.e = this.keys['e'] || false;
      if (down) {
        if (k === 'enter') this.onEnter();
        if (k === 'e') this.onInteract();
        if (k === 'g') this.onGarage();
        if (k === 'm') { this.audio.ensure(); this.audio.toggleMute(); }
        if (k === 'p' || k === 'escape') {
          if (this.state === 'playing') this.state = 'paused';
          else if (this.state === 'paused') this.state = 'playing';
        }
        if (k === ' ') { e.preventDefault(); this.onPunch(); }
        if (k === 'f') this.onShoot();
      }
    };
    window.addEventListener('keydown', (e) => key(e, true));
    window.addEventListener('keyup', (e) => key(e, false));
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const wx = this.camera.x + (mx - rect.width / 2) / this.camera.zoom;
      const wy = this.camera.y + (my - rect.height / 2) / this.camera.zoom;
      this.shootAt(wx, wy);
    });
  }

  onEnter() {
    if (this.state === 'menu') {
      this.audio.ensure();
      this.state = 'playing';
      this.startMission(1);
    } else if (this.dialog) {
      this.advanceDialog();
    } else if (this.state === 'gameover' || this.state === 'complete') {
      this.resetRun();
    }
  }

  onInteract() {
    if (this.state !== 'playing') return;
    if (this.dialog) { this.advanceDialog(); return; }
    const p = this.player;
    if (!p.inCar) {
      // Enter the nearest car.
      let best = null, bd = 70;
      for (const c of this.cars) {
        const d = dist(p.x, p.y, c.x, c.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        p.inCar = true; p.car = best;
        if (best.driver !== 'player') {
          best.driver = 'player';
          // Taking a taxi is a shift, not a theft — no heat for it.
          if (best.type.id !== 'taxi') {
            this.stats.carsStolen++;
            this.addWanted(1);
            this.flash('Car stolen — VHPD alerted');
          }
        }
        this.audio.engine(true, 0);
      }
    } else {
      p.inCar = false;
      p.x = p.car.x + Math.cos(p.car.angle + Math.PI / 2) * 34;
      p.y = p.car.y + Math.sin(p.car.angle + Math.PI / 2) * 34;
      p.angle = p.car.angle;
      p.car.driver = null;
      p.car = null;
      this.audio.engine(false, 0);
    }
  }

  onGarage() {
    if (this.state !== 'playing' || this.player.inCar) return;
    const gx = 2240, gy = 1760;
    if (dist(this.player.x, this.player.y, gx, gy) > 160) return;
    if (this.garageCars.length === 0) { this.flash('Garage is empty — deliver the Comet (M2)'); return; }
    const typeId = this.garageCars[this.garageCars.length - 1];
    const c = makeCar(this.rng, typeId, gx + 60, gy + 40, 0);
    c.driver = 'player';
    this.cars.push(c);
    this.player.inCar = true;
    this.player.car = c;
    this.flash('Took the ' + c.type.name + ' out of the garage');
  }

  onPunch() {
    if (this.state !== 'playing' || this.player.inCar || this.player.punchCd > 0) return;
    this.player.punchCd = 0.35;
    const p = this.player;
    const reach = 46;
    const tx = p.x + Math.cos(p.angle) * reach, ty = p.y + Math.sin(p.angle) * reach;
    for (const t of this.thugs) {
      if (dist(tx, ty, t.x, t.y) < 34) {
        t.hp -= 34;
        this.burst(t.x, t.y, '#ffd166', 8);
        this.audio.blip(180, 0.1, 'square', 0.2);
        if (t.hp <= 0) this.dropThug(t);
      }
    }
    for (const c of this.cops) {
      if (dist(tx, ty, c.x, c.y) < 34) {
        c.hp -= 34;
        this.burst(c.x, c.y, '#ffd166', 8);
        if (c.hp <= 0) { this.cops.splice(this.cops.indexOf(c), 1); this.addWanted(1); }
      }
    }
  }

  onShoot() {
    if (this.state !== 'playing' || this.player.inCar) return;
    this.shootAt(
      this.player.x + Math.cos(this.player.angle) * 300,
      this.player.y + Math.sin(this.player.angle) * 300,
    );
  }
  shootAt(wx, wy) {
    const p = this.player;
    if (p.ammo <= 0 || p.shootCd > 0) { if (p.ammo <= 0) this.flash('Out of ammo — find the gun shop'); return; }
    p.ammo--;
    p.shootCd = 0.22;
    p.angle = angleTo(p.x, p.y, wx, wy);
    this.bullets.push({ x: p.x + Math.cos(p.angle) * 22, y: p.y + Math.sin(p.angle) * 22, angle: p.angle, speed: 900, life: 0.6 });
    this.audio.gunshot();
    this.addWanted(1);
  }

  dropThug(t) {
    this.thugs.splice(this.thugs.indexOf(t), 1);
    const loot = 40 + Math.floor(this.rng() * 80);
    this.cash += loot;
    this.flash('Thug down — +' + fmtMoney(loot));
    this.audio.cash();
  }

  // --- missions -------------------------------------------------------------
  showBriefing(id) {
    const m = missionById(id);
    if (!m) return;
    this.dialogQueue = [
      { title: 'M' + m.id + ' · ' + m.title + ' — ' + m.giver, text: m.brief },
      { title: 'Objective', text: m.steps[0].label + '  ·  Reward ' + fmtMoney(m.reward) },
    ];
    this.dialog = this.dialogQueue.shift();
  }
  advanceDialog() {
    this.dialog = this.dialogQueue.shift() || null;
  }

  startMission(id) {
    const m = missionById(id);
    if (!m) return;
    this.missionState = startMissionState(m);
    this.showBriefing(id);
    if (id === 2) {
      // Park the red Comet outside Solmar Motors.
      const c = makeCar(this.rng, 'sports', 1600, 800, Math.PI / 2);
      c.color = '#e74c3c';
      this.cars.push(c);
    }
    if (id === 3) {
      for (let i = 0; i < 3; i++) {
        const s = m.steps[0];
        this.thugs.push({ ...makePed(this.rng, 1280 + i * 320, 480 + i * 160), hp: 100, hostile: true });
      }
    }
    if (id === 4) {
      const rival = makeCar(this.rng, 'coupe', 3360, 1120, Math.PI);
      rival.driver = 'rival';
      rival.type = { ...rival.type, top: 195, accel: 135 };
      rival.cp = 0;
      this.raceRival = rival;
      this.cars.push(rival);
    }
    if (id === 5) this.setWanted(3);
    if (id === 6) {
      // Roadblocks go up across Downtown.
      this.roadblocks = [
        { x: 1920, y: 800, angle: 0 }, { x: 1600, y: 1120, angle: Math.PI / 2 },
        { x: 2240, y: 1120, angle: Math.PI / 2 }, { x: 1920, y: 480, angle: 0 },
      ];
      this.setWanted(2);
    }
    if (id === 7) { this.setWanted(4); this.missionState.timer = 0; }
    this.save();
  }

  completeMission() {
    const m = missionById(this.missionState.id);
    this.cash += m.reward;
    this.debt = Math.max(0, this.debt - m.reward);
    this.missionsDone.push(m.id);
    this.audio.cash();
    this.dialogQueue = [{ title: 'Job done — ' + m.title, text: 'Paid ' + fmtMoney(m.reward) + '. Debt to Donna: ' + fmtMoney(this.debt) + '.' }];
    this.dialog = this.dialogQueue.shift();
    if (m.id === 2) this.garageCars.push('sports');
    if (m.id === 4) this.stats.racesWon++;
    this.missionState = null;
    this.raceRival = null;
    this.roadblocks = [];
    this.save();
    const next = nextMissionId(this.missionsDone);
    if (next) {
      setTimeout(() => { if (this.state === 'playing') this.startMission(next); }, 2500);
    } else if (this.debt === 0) {
      this.state = 'complete';
    }
  }

  // --- wanted ----------------------------------------------------------------
  addWanted(n) {
    this.setWanted(this.wanted + n);
  }
  setWanted(n) {
    const before = this.wanted;
    this.wanted = clamp(n, 0, 5);
    this.wantedTimer = 0;
    if (this.wanted > before) this.heat = 100;
    this.audio.siren(this.wanted > 0);
  }

  spawnPolice() {
    const want = this.wanted >= 4 ? 4 : this.wanted >= 2 ? 3 : this.wanted;
    const active = this.cars.filter(c => c.driver === 'police').length;
    if (active < want) {
      const a = this.rng() * Math.PI * 2;
      const c = spawnPoliceCar(this.rng, this.player.x + Math.cos(a) * 620, this.player.y + Math.sin(a) * 620);
      this.cars.push(c);
    }
    if (this.wanted >= 4 && !this.heli) this.heli = makeHeli(this.player.x, this.player.y - 300);
    if (this.wanted < 4) this.heli = null;
    // Foot cops when the player is on foot and the heat is on.
    if (!this.player.inCar && this.wanted > 0 && this.cops.length < this.wanted) {
      const a = this.rng() * Math.PI * 2;
      this.cops.push({ ...makePed(this.rng, this.player.x + Math.cos(a) * 420, this.player.y + Math.sin(a) * 420), hp: 100, cop: true });
    }
  }

  // --- helpers ---------------------------------------------------------------
  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * randRange(this.rng, 40, 220), vy: Math.sin(a) * randRange(this.rng, 40, 220), life: randRange(this.rng, 0.3, 0.8), color, size: randRange(this.rng, 2, 5) });
    }
  }
  flash(text) { this.message = text; this.messageTimer = 3; }
  explode(car) {
    this.burst(car.x, car.y, '#ff6b35', 26);
    this.burst(car.x, car.y, '#ffd166', 18);
    this.audio.explosion();
    this.cars.splice(this.cars.indexOf(car), 1);
    if (this.player.car === car) { this.player.inCar = false; this.player.car = null; this.player.hp -= 35; }
    this.addWanted(1);
  }

  // --- main loop --------------------------------------------------------------
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.state === 'playing' && !this.dialog) this.update(dt);
    this.render();
    requestAnimationFrame((nt) => this.loop(nt));
  }

  update(dt) {
    this.time += dt;
    this.clock = (this.clock + dt * 0.9) % 1440; // a full day in ~27 min of play
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = randRange(this.rng, 90, 200);
      this.weather = pick(this.rng, ['clear', 'clear', 'clouds', 'rain']);
    }
    const p = this.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);
    if (this.messageTimer > 0) this.messageTimer -= dt;

    // --- player movement
    const k = this.keys;
    let mx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    let my = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
    if (p.inCar && p.car) {
      const steer = (k['a'] || k['arrowleft'] ? -1 : 0) + (k['d'] || k['arrowright'] ? 1 : 0);
      const throttle = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 0.7 : 0);
      const prevX = p.car.x, prevY = p.car.y;
      driveCar(p.car, dt, steer, throttle);
      if (collidesBuilding(this.city, p.car.x, p.car.y, 20)) {
        p.car.x = prevX; p.car.y = prevY;
        p.car.speed *= -0.3;
        p.car.hp -= 6;
        this.burst(prevX, prevY, '#cccccc', 4);
      }
      p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
      this.audio.engine(true, p.car.speed);
      // Headlight cone is drawn in render.js from car speed + clock.
      if (p.car.hp <= 0 && !p.car.burning) {
        p.car.burning = true;
        p.car.burnTimer = 1.5;
        this.flash('Engine fire — get out!');
      }
      if (p.car.burning) {
        p.car.burnTimer -= dt;
        this.burst(p.car.x, p.car.y, '#ff6b35', 2);
        if (p.car.burnTimer <= 0) this.explode(p.car);
      }
    } else {
      if (mx || my) {
        const len = Math.hypot(mx, my);
        mx /= len; my /= len;
        p.angle = Math.atan2(my, mx);
        const nx = p.x + mx * p.onFootSpeed * dt;
        const ny = p.y + my * p.onFootSpeed * dt;
        if (!collidesBuilding(this.city, nx, p.y, 14)) p.x = nx;
        if (!collidesBuilding(this.city, p.x, ny, 14)) p.y = ny;
        p.speed = p.onFootSpeed;
      } else p.speed = 0;
      p.x = clamp(p.x, 30, WORLD_W - 30);
      p.y = clamp(p.y, 30, WORLD_H - 30);
      this.audio.engine(false, 0);
    }

    // --- traffic & pedestrians
    for (const c of this.cars) {
      if (c.driver === 'traffic') trafficThink(c, dt, this.rng, this);
      if (c.driver === 'police') this.policeChase(c, dt);
      if (c.driver === 'rival') this.rivalDrive(c, dt);
    }
    for (const ped of this.peds) {
      ped.walkPhase += dt * 6;
      if (!ped.dest || dist(ped.x, ped.y, ped.dest.x, ped.dest.y) < 30) {
        const q = randomRoadPoint(this.rng);
        ped.dest = { x: q.x + randRange(this.rng, -40, 40), y: q.y + randRange(this.rng, -40, 40) };
      }
      const a = angleTo(ped.x, ped.y, ped.dest.x, ped.dest.y);
      const panic = ped.panic > 0;
      ped.panic = Math.max(0, ped.panic - dt);
      const sp = panic ? ped.speed * 2.4 : ped.speed;
      ped.x += Math.cos(a) * sp * dt;
      ped.y += Math.sin(a) * sp * dt;
      // Pedestrians scatter from a speeding player car.
      if (p.inCar && dist(ped.x, ped.y, p.x, p.y) < 90 && Math.abs(p.car.speed) > 60) ped.panic = 1.5;
      if (p.inCar && dist(ped.x, ped.y, p.x, p.y) < 26 && Math.abs(p.car.speed) > 25) {
        this.peds.splice(this.peds.indexOf(ped), 1);
        this.burst(ped.x, ped.y, '#ff4757', 10);
        this.addWanted(1);
        this.flash('Pedestrian hit — VHPD alerted');
      }
    }
    if (this.peds.length < 40) this.peds.push(makePed(this.rng, ...Object.values(randomRoadPoint(this.rng))));

    // --- police on foot
    for (const cop of this.cops) {
      const a = angleTo(cop.x, cop.y, p.x, p.y);
      cop.x += Math.cos(a) * 150 * dt;
      cop.y += Math.sin(a) * 150 * dt;
      if (dist(cop.x, cop.y, p.x, p.y) < 30) {
        p.hp -= 22 * dt;
        if (p.hp <= 0) this.busted();
      }
    }
    // --- helicopter
    if (this.heli) {
      const h = this.heli;
      const a = angleTo(h.x, h.y, p.x, p.y);
      h.angle = a;
      h.x += Math.cos(a) * 170 * dt;
      h.y += Math.sin(a) * 170 * dt;
      h.search += dt;
    }
    // --- roadblocks block cars
    for (const rb of this.roadblocks) {
      if (p.inCar && dist(p.x, p.y, rb.x, rb.y) < 44) {
        p.car.speed *= -0.4;
        p.car.hp -= 10;
        this.burst(p.x, p.y, '#ff4757', 8);
        this.roadblocks.splice(this.roadblocks.indexOf(rb), 1);
        this.flash('Roadblock smashed!');
        break;
      }
    }
    // --- bullets
    for (const b of this.bullets) {
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      for (const t of this.thugs) {
        if (dist(b.x, b.y, t.x, t.y) < 22) { t.hp -= 40; b.life = 0; this.burst(t.x, t.y, '#ff4757', 6); if (t.hp <= 0) this.dropThug(t); break; }
      }
      for (const c of this.cops) {
        if (dist(b.x, b.y, c.x, c.y) < 22) { c.hp -= 40; b.life = 0; if (c.hp <= 0) this.cops.splice(this.cops.indexOf(c), 1); break; }
      }
    }
    this.bullets = this.bullets.filter(b => b.life > 0);
    // --- thugs chase the player
    for (const t of this.thugs) {
      const a = angleTo(t.x, t.y, p.x, p.y);
      t.x += Math.cos(a) * 110 * dt;
      t.y += Math.sin(a) * 110 * dt;
      if (dist(t.x, t.y, p.x, p.y) < 30) {
        p.hp -= 14 * dt;
        if (p.hp <= 0) this.wasted();
      }
    }
    // --- particles
    for (const pt of this.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    }
    this.particles = this.particles.filter(pt => pt.life > 0);
    // --- wanted decay: hide from the law and the heat cools off.
    if (this.wanted > 0) {
      this.wantedTimer += dt;
      const seen = this.cars.some(c => c.driver === 'police' && dist(c.x, c.y, p.x, p.y) < 420) || this.cops.length > 0 || this.heli;
      if (!seen && this.wantedTimer > 14) { this.wanted--; this.wantedTimer = 0; if (this.wanted === 0) this.flash('You lost them'); }
      if (seen) this.wantedTimer = 0;
    }
    this.spawnPolice();
    // --- missions
    if (this.missionState) {
      const res = updateMission(this, dt);
      if (res === 'step') { this.audio.pickup(); this.flash(currentObjective(this).text); }
      if (res === 'done') this.completeMission();
    }
    // --- taxi fares on the side
    this.fareTimer -= dt;
    if (!this.fare && !this.missionState && this.fareTimer <= 0 && p.inCar && p.car.type.id === 'taxi') {
      this.fare = makeFare(this.rng, FARE_SPOTS);
      this.flash('Fare waiting at ' + this.fare.from.name + ' — drive there');
    }
    if (this.fare) this.updateFare(dt);
    // --- camera
    const targetZoom = p.inCar ? 0.8 : 1.0;
    this.camera.zoom += (targetZoom - this.camera.zoom) * dt * 2;
    this.camera.x += (p.x - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (p.y - this.camera.y) * Math.min(1, dt * 5);
    // --- health regen on foot, slow
    if (!p.inCar && p.hp < 100) p.hp = Math.min(100, p.hp + 2 * dt);
    if (p.hp <= 0) this.wasted();
  }

  updateFare(dt) {
    const f = this.fare;
    const p = this.player;
    if (f.state === 'wait') {
      if (dist(p.x, p.y, f.from.x, f.from.y) < 80) {
        f.state = 'ride';
        this.flash('Passenger aboard — take them to ' + f.to.name);
        this.audio.pickup();
      }
    } else if (f.state === 'ride') {
      if (dist(p.x, p.y, f.to.x, f.to.y) < 80) {
        this.cash += f.pay;
        this.stats.faresDone++;
        this.audio.cash();
        this.flash('Fare complete +' + fmtMoney(f.pay));
        this.fare = null;
        this.fareTimer = 10;
        this.save();
      }
    }
    if (f && this.missionState) { this.fare = null; this.fareTimer = 12; }
  }

  policeChase(c, dt) {
    const p = this.player;
    const d = dist(c.x, c.y, p.x, p.y);
    const want = angleTo(c.x, c.y, p.x, p.y);
    c.angle += clamp(angleDiff(c.angle, want), -2.4 * dt, 2.4 * dt);
    const target = d > 60 ? c.type.top : c.type.top * 0.4;
    c.speed += clamp(target - c.speed, -160 * dt, 130 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (d < 46) {
      // Ram: slow the player and damage their car.
      if (p.inCar && p.car) { p.car.speed *= 0.82; p.car.hp -= 8 * dt * 10; this.burst(p.x, p.y, '#ffffff', 2); }
      else { p.hp -= 18 * dt; if (p.hp <= 0) this.busted(); }
    }
  }

  rivalDrive(c, dt) {
    const ms = this.missionState;
    if (!ms || ms.id !== 4) { trafficThink(c, dt, this.rng, this); return; }
    const mission = missionById(4);
    const step = mission.steps[Math.min(c.cp, mission.steps.length - 1)];
    const d = dist(c.x, c.y, step.x, step.y);
    if (d < 110) c.cp++;
    const want = angleTo(c.x, c.y, step.x, step.y);
    c.angle += clamp(angleDiff(c.angle, want), -2.2 * dt, 2.2 * dt);
    c.speed += clamp(c.type.top * 0.92 - c.speed, -140 * dt, 120 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // Rival crossing the finish first ends the race as a loss.
    if (c.cp >= mission.steps.length) {
      this.flash('Rival won the race — try again (M4 restarts)');
      this.missionState = null;
      this.raceRival = null;
      this.cars.splice(this.cars.indexOf(c), 1);
      setTimeout(() => { if (this.state === 'playing') this.startMission(4); }, 3000);
    }
  }

  busted() {
    this.stats.arrests++;
    this.cash = Math.max(0, this.cash - 200);
    this.player.hp = 100;
    this.setWanted(0);
    this.cops = [];
    this.cars = this.cars.filter(c => c.driver !== 'police');
    this.heli = null;
    this.player.x = 480; this.player.y = 480;
    if (this.player.inCar) { this.player.inCar = false; this.player.car = null; }
    this.flash('BUSTED — VHPD took $200, dropped you at Marina Bay');
    this.audio.siren(false);
    this.save();
  }

  wasted() {
    this.player.hp = 100;
    this.cash = Math.max(0, this.cash - 150);
    this.setWanted(0);
    this.cops = [];
    this.thugs = [];
    this.player.x = 480; this.player.y = 480;
    if (this.player.inCar) { this.player.inCar = false; this.player.car = null; }
    this.state = 'gameover';
    this.audio.siren(false);
    this.save();
  }

  resetRun() {
    this.player.hp = 100;
    this.player.x = 480; this.player.y = 480;
    this.player.inCar = false; this.player.car = null;
    this.state = 'playing';
  }

  // --- screenshot presets ----------------------------------------------------
  // Deterministic staged scenes for the four screenshots. Called by main.js
  // from the ?shot= URL parameter; never used during normal play.
  applyShot(name) {
    const p = this.player;
    this.state = 'playing';
    this.dialog = null;
    this.dialogQueue = [];
    if (name === 'cover') {
      this.clock = 18 * 60 + 25; // dusk
      this.weather = 'clear';
      this.setWanted(3);
      const car = makeCar(this.rng, 'sports', 2080, 800, 0);
      car.color = '#e74c3c'; car.driver = 'player';
      car.hp = 500; // staged chase: the car survives the 2.5 s photo wait
      car.speed = 100;
      this.cars.push(car);
      p.inCar = true; p.car = car; p.x = car.x; p.y = car.y;
      this.keys.w = true; // keep driving east down the street for the chase
      for (let i = 0; i < 3; i++) {
        const c = spawnPoliceCar(this.rng, 1820 - i * 90, 800 + (i - 1) * 60);
        c.angle = 0; c.speed = 140;
        this.cars.push(c);
      }
      for (let i = 0; i < 3; i++) {
        const c = makeCar(this.rng, pick(this.rng, VEHICLE_TYPES).id, 2500 + i * 210, 800, 0);
        c.driver = 'traffic'; c.targetSpeed = 60;
        this.cars.push(c);
      }
      for (let i = 0; i < 8; i++) this.peds.push(makePed(this.rng, 2080 + randRange(this.rng, -260, 260), 800 + (this.rng() < 0.5 ? -1 : 1) * randRange(this.rng, 120, 200)));
      this.missionState = startMissionState(missionById(1));
      this.camera.x = p.x; this.camera.y = p.y;
    } else if (name === 'mission') {
      this.clock = 17 * 60 + 40;
      this.weather = 'clouds';
      this.setWanted(1);
      p.x = 1180; p.y = 560; p.angle = 0;
      // Thugs and the cop stand in the lower third of the frame, below the dialog box.
      this.thugs.push({ ...makePed(this.rng, 1350, 790), hp: 100, hostile: true });
      this.thugs.push({ ...makePed(this.rng, 1150, 800), hp: 100, hostile: true });
      const cop = { ...makePed(this.rng, 1500, 800), hp: 100, cop: true };
      this.cops.push(cop);
      this.missionState = startMissionState(missionById(3));
      this.dialog = { title: 'M3 · The Collector — Donna Ferrante', text: 'Donna’s runners went quiet. Collect three packages stashed around Downtown and Old Town — and try not to attract the VHPD while you do it.' };
      this.camera.x = p.x; this.camera.y = p.y;
    } else if (name === 'night') {
      this.clock = 22 * 60 + 30; // night
      this.weather = 'rain';
      this.setWanted(0);
      const car = makeCar(this.rng, 'coupe', 2080, 800, Math.PI / 2);
      car.color = '#8e44ad'; car.driver = 'player'; car.speed = 120;
      this.cars.push(car);
      p.inCar = true; p.car = car; p.x = car.x; p.y = car.y;
      this.keys.w = true; // keep driving south down the avenue
      for (let i = 0; i < 4; i++) {
        const c = makeCar(this.rng, pick(this.rng, VEHICLE_TYPES).id, 2080, 500 + i * 320, Math.PI / 2);
        c.driver = 'traffic'; c.targetSpeed = 60;
        this.cars.push(c);
      }
      this.camera.x = p.x; this.camera.y = p.y;
    } else if (name === 'walk') {
      this.clock = 18 * 60 + 45; // dusk
      this.weather = 'clear';
      this.setWanted(2);
      p.x = 1600; p.y = 800; p.angle = 0;
      for (let i = 0; i < 10; i++) this.peds.push(makePed(this.rng, 1600 + randRange(this.rng, -280, 280), 800 + randRange(this.rng, -180, 180)));
      this.missionState = startMissionState(missionById(6));
      this.camera.x = p.x; this.camera.y = p.y;
    }
    this.update(0.016);
  }

  render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    if (this.state === 'menu') { drawMenu(ctx, W, H, this); return; }
    drawWorld(ctx, this);
    drawHUD(ctx, this);
    if (this.dialog) drawDialog(ctx, W, H, this.dialog);
    if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(10,10,25,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
      ctx.font = '20px sans-serif';
      ctx.fillText('P to resume · M mute · progress auto-saves', W / 2, H / 2 + 40);
    }
    if (this.state === 'gameover') drawGameOver(ctx, W, H, this);
    if (this.state === 'complete') drawComplete(ctx, W, H, this);
  }
}

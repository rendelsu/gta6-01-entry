// Deterministic demo scenes for the entry's screenshots. Each scene stages
// the live game — real traffic, real police, a real mission — at a fixed spot,
// then lets the simulation run, so the screenshots are the game itself.
// ?shot=1 chase · ?shot=2 street life · ?shot=3 docks shootout · ?shot=4 title
import { LANDMARKS } from './config.js';
import { makeCar, spawnTraffic, spawnPeds } from './entities.js';
import { startMission } from './missions.js';

function resetWorld(G) {
  G.cops = [];
  G.officers = [];
  G.enemies = [];
  G.bullets = [];
  G.particles = [];
  G.skids = [];
  G.wanted = 0;
  G.wantedTimer = 0;
  G.health = 100;
  G.armor = 50;
  G.ammo = 60;
  G.cash = 1250;
  G.mission = null;
  G.missionOffer = 0;
  G.taxi = null;
  spawnTraffic(G, 16);
  spawnPeds(G, 26);
}

export function stageShot(G, n) {
  resetWorld(G);
  const p = G.player;
  if (n === 1) {
    // Cover: a high-speed chase downtown, wanted level 3, mission objective ahead.
    // Staged far enough west that the camera can stay centred on the car.
    const car = makeCar(700, 1120, 0, 0, { kind: 'player', speed: 300 });
    car.hp = 100;
    G.cars.push(car);
    p.inCar = true; p.car = car; p.x = car.x; p.y = car.y; p.angle = 0;
    G.wanted = 3;
    const cop1 = makeCar(580, 1120, 0, 7, { kind: 'police', speed: 360 });
    const cop2 = makeCar(620, 1152, 0, 7, { kind: 'police', speed: 340 });
    G.cops.push(cop1, cop2);
    G.cars.push(cop1, cop2);
    startMission(G, 1); // The Drop: drive the package to the docks
    G.missionBanner = null;
    G.camera.zoom = 1.0;
    G.camera.x = p.x + 120; G.camera.y = p.y;
  } else if (n === 2) {
    // Street life: Danny on foot in Plaza del Sol, crowd, taxi, first job waiting.
    p.inCar = false; p.car = null;
    p.x = LANDMARKS.plaza.x; p.y = LANDMARKS.plaza.y + 40; p.angle = -Math.PI / 2;
    const taxi = makeCar(LANDMARKS.plaza.x + 120, LANDMARKS.plaza.y - 60, Math.PI / 2, 2, { kind: 'parked', driver: false, speed: 0 });
    G.cars.push(taxi);
    startMission(G, 0); // First Wheels: steal a car
    G.missionBanner = null;
    G.camera.zoom = 1.05;
    G.camera.x = p.x; G.camera.y = p.y;
  } else if (n === 3) {
    // Shootout at the docks: pistol out, Vipers ahead, heat rising.
    p.inCar = false; p.car = null;
    p.x = LANDMARKS.docks.x - 200; p.y = LANDMARKS.docks.y; p.angle = 0;
    G.weapon = 'pistol';
    G.wanted = 2;
    startMission(G, 4); // Harbor Heist, jump to the shootout step
    G.mission.step = 1;
    G.mission.kills = 0;
    G.enemies.length = 0;
    // A muzzle flash already in the air when the shutter opens.
    G.particles.push({ x: p.x + 30, y: p.y, vx: 40, vy: 0, life: 0.12, maxLife: 0.12, size: 9, color: '#f9e79f', type: 'flash' });
    G.missionBanner = null;
    // Vipers in plain sight of the camera, right in front of the player,
    // with the dock containers behind them. They are bulletproof here so
    // the staged shootout still has all three guards when the shutter opens.
    const dockFoes = [
      { x: LANDMARKS.docks.x - 60, y: LANDMARKS.docks.y - 70 },
      { x: LANDMARKS.docks.x - 40, y: LANDMARKS.docks.y + 60 },
      { x: LANDMARKS.docks.x - 140, y: LANDMARKS.docks.y + 10 },
    ];
    for (const s of dockFoes) {
      const e = { x: s.x, y: s.y, angle: Math.PI, speed: 0, state: 'guard', hp: 9999, dead: false, shirt: '#8e44ad', name: 'Rival', tx: s.x, ty: s.y, wait: 0, fireTimer: 0.4, isCop: false, fleeTimer: 0 };
      G.enemies.push(e);
    }
    G.camera.zoom = 1.0;
    G.camera.x = p.x + 80; G.camera.y = p.y;
  } else {
    // Title screen over the living city, camera pulled back.
    G.mode = 'title';
    G.menuIndex = 0;
    p.inCar = false; p.car = null;
    p.x = 1120; p.y = 1120;
    G.camera.zoom = 0.62;
    G.camera.x = 1120; G.camera.y = 1120;
  }
  G.mode = n === 4 ? 'title' : 'playing';
  G.shotMode = n;
  G.shotTicks = 0;
}

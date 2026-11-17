// Story missions for Danny Reyes, wheelman for Mama Lou. Five missions form
// the arc; each mission is a list of steps, and the engine watches one step
// at a time. Side work — taxi fares and hidden packages — pays between jobs.
import { LANDMARKS, HIDDEN_PACKAGES, GARAGE_DOOR } from './config.js';
import { dist, clamp } from './random.js';
import { makeEnemy } from './combat.js';
import { addWanted } from './entities.js';
import { saveGame } from './save.js';

export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', giver: 'Mama Lou',
    intro: 'Mama Lou needs a driver. Steal a car — any car — and bring it to my garage.',
    reward: 200,
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: GARAGE_DOOR.x, y: GARAGE_DOOR.y, r: 90, text: 'Drive to Mama Lou\'s Garage' },
    ],
  },
  {
    id: 2, name: 'The Drop', giver: 'Mama Lou',
    intro: 'A package for the docks. The Vipers know about it — expect company.',
    reward: 400,
    steps: [
      { type: 'goto', x: LANDMARKS.docks.x - 120, y: LANDMARKS.docks.y, r: 90, text: 'Drive the package to Solmar Docks' },
      {
        type: 'kill', count: 2, text: 'Ambush! Take out the Vipers (2)',
        spawn: [
          { x: LANDMARKS.docks.x - 220, y: LANDMARKS.docks.y - 60 },
          { x: LANDMARKS.docks.x - 200, y: LANDMARKS.docks.y + 70 },
        ],
      },
      { type: 'goto', x: LANDMARKS.docks.x - 60, y: LANDMARKS.docks.y, r: 70, text: 'Drop the package at the crates' },
    ],
  },
  {
    id: 3, name: 'Shake the Tail', giver: 'Eddie Voss',
    intro: 'You rattled the wrong cage. Three stars and counting — lose them.',
    reward: 500,
    steps: [
      { type: 'survive', seconds: 40, text: 'Survive the police chase — 40s' },
      { type: 'loseWanted', text: 'Break line of sight and lose the heat' },
    ],
  },
  {
    id: 4, name: 'Sunset Sprint', giver: 'Mama Lou',
    intro: 'Five checkpoints, one sunset, no excuses. Beat the clock.',
    reward: 600,
    steps: [
      {
        type: 'checkpoints', time: 150, text: 'Hit every checkpoint before the clock runs out',
        points: [
          { x: 480, y: 2080 }, { x: 2080, y: 2080 }, { x: 2080, y: 480 },
          { x: 480, y: 480 }, { x: 1440, y: 1440 },
        ],
      },
    ],
  },
  {
    id: 5, name: 'Harbor Heist', giver: 'Mama Lou',
    intro: 'The Vipers parked an armored van at the marina. Take it. Loudly.',
    reward: 1000,
    steps: [
      { type: 'goto', x: LANDMARKS.marina.x - 200, y: LANDMARKS.marina.y, r: 100, text: 'Get to the Marina' },
      {
        type: 'kill', count: 3, text: 'Clear the guards (3)',
        spawn: [
          { x: LANDMARKS.marina.x - 260, y: LANDMARKS.marina.y - 80 },
          { x: LANDMARKS.marina.x - 240, y: LANDMARKS.marina.y + 40 },
          { x: LANDMARKS.marina.x - 180, y: LANDMARKS.marina.y + 120 },
        ],
      },
      { type: 'steal', text: 'Steal the armored van', vanOnly: true },
      { type: 'deliver', x: GARAGE_DOOR.x, y: GARAGE_DOOR.y, r: 100, text: 'Deliver the van to the Garage — the heat is on!' },
    ],
  },
];

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) {
    G.mission = null;
    G.flashMessage('ALL MISSIONS COMPLETE — SOLMAR IS YOURS', '#f1c40f');
    return;
  }
  G.mission = {
    def, index, step: 0, timer: 0, kills: 0,
    checkpoint: 0, startedAt: G.playSeconds,
  };
  G.missionBanner = { title: `MISSION ${def.id}: ${def.name}`, sub: `${def.giver}: “${def.intro}”`, t: 5 };
  G.audio.sting();
  if (def.id === 3) addWanted(G, 3);
  if (def.id === 5) {
    // Park the armored van at the marina for the heist.
    const van = {
      kind: 'parked', x: LANDMARKS.marina.x - 200, y: LANDMARKS.marina.y, angle: Math.PI / 2,
      speed: 0, modelIdx: 3, model: { name: 'Armored Van', top: 430, accel: 340, grip: 2.2, color: '#2c3e50' },
      color: '#2c3e50', hp: 160, driver: false, road: 'v', dir: 1, lane: 1, dead: false, smoke: 0, armored: true,
    };
    G.cars.push(van);
    G.mission.van = van;
  }
  enterStep(G);
}

function enterStep(G) {
  const m = G.mission;
  const step = m.def.steps[m.step];
  if (!step) return;
  m.timer = 0;
  m.kills = 0;
  if (step.type === 'kill') {
    for (const s of step.spawn) G.enemies.push(makeEnemy(s.x, s.y, 100));
  }
  if (step.type === 'checkpoints') {
    m.timer = step.time;
    m.checkpoint = 0;
  }
}

export function currentStep(G) {
  if (!G.mission) return null;
  return G.mission.def.steps[G.mission.step] || null;
}

export function currentObjective(G) {
  const step = currentStep(G);
  if (step) return step.text;
  if (G.taxi && G.taxi.state === 'deliver') return `Taxi fare: drop ${G.taxi.ped.name} at the marker`;
  if (G.taxi && G.taxi.state === 'pickup') return 'Taxi fare waiting — pick up the passenger';
  return 'Free roam — press M for missions, P to save';
}

export function currentWaypoint(G) {
  const step = currentStep(G);
  if (!step) {
    if (G.taxi) return { x: G.taxi.x, y: G.taxi.y };
    return null;
  }
  if (step.type === 'goto' || step.type === 'deliver') return { x: step.x, y: step.y };
  if (step.type === 'checkpoints') return step.points[Math.min(G.mission.checkpoint, step.points.length - 1)];
  if (step.type === 'kill' && step.spawn) {
    const alive = G.enemies.filter((e) => !e.dead);
    if (alive.length) return { x: alive[0].x, y: alive[0].y };
    return { x: step.spawn[0].x, y: step.spawn[0].y };
  }
  if (step.type === 'steal' && G.mission.van) return { x: G.mission.van.x, y: G.mission.van.y };
  if (step.type === 'steal') {
    // Point at the nearest stealable car.
    let best = null, bestD = 1e9;
    for (const c of G.cars) {
      if (c.dead || c.kind === 'player') continue;
      const d = dist(G.player.x, G.player.y, c.x, c.y);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  return null;
}

function completeStep(G) {
  const m = G.mission;
  m.step += 1;
  if (m.step >= m.def.steps.length) {
    completeMission(G);
  } else {
    G.audio.pickup();
    enterStep(G);
  }
}

function completeMission(G) {
  const m = G.mission;
  G.cash += m.def.reward;
  G.missionsDone += 1;
  G.stats.missions = G.missionsDone;
  G.missionBanner = { title: 'MISSION PASSED', sub: `+ $${m.def.reward}  —  ${m.def.name}`, t: 4 };
  G.audio.sting();
  G.mission = null;
  G.missionIndex += 1;
  saveGame(G);
  // The next job stays offered until the player takes it.
  G.missionOffer = MISSIONS[G.missionIndex] ? 1 : 0;
}

export function failMission(G, reason) {
  const m = G.mission;
  if (!m) return;
  G.missionBanner = { title: 'MISSION FAILED', sub: reason, t: 4 };
  G.audio.failSting();
  G.enemies = [];
  G.mission = null;
  G.missionOffer = 1; // retry stays offered until the player takes it
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (m) {
    const step = currentStep(G);
    if (!step) return;
    const p = G.player;
    if (step.type === 'steal') {
      const stolen = step.vanOnly
        ? (p.inCar && p.car && p.car.armored)
        : (p.inCar && (G.stats.carsStolen > 0 || m.stepStartedWithCar));
      if (step.vanOnly ? (p.inCar && p.car && p.car.armored) : p.inCar) completeStep(G);
    } else if (step.type === 'goto' || step.type === 'deliver') {
      const d = dist(p.x, p.y, step.x, step.y);
      if (d < step.r) {
        if (step.type === 'deliver') addWanted(G, 0);
        completeStep(G);
      }
    } else if (step.type === 'kill') {
      if (m.kills >= step.count && G.enemies.length === 0) completeStep(G);
    } else if (step.type === 'survive') {
      m.timer += dt;
      if (m.timer >= step.seconds) completeStep(G);
    } else if (step.type === 'loseWanted') {
      if (G.wanted <= 0) completeStep(G);
    } else if (step.type === 'checkpoints') {
      m.timer -= dt;
      const pt = step.points[m.checkpoint];
      if (pt && dist(p.x, p.y, pt.x, pt.y) < 80) {
        m.checkpoint += 1;
        G.audio.pickup();
        G.cash += 25;
        if (m.checkpoint >= step.points.length) completeStep(G);
      }
      if (m.timer <= 0) failMission(G, 'Out of time — the sprint is lost.');
    }
  }

  // Mission offer: press Enter to start the next job. It never expires.
  if (G.missionOffer > 0) {
    if (G.input.pressed('Enter')) {
      G.missionOffer = 0;
      startMission(G, G.missionIndex);
    }
  }

  // Taxi fares: driving a taxi attracts passengers.
  updateTaxi(G, dt);
  // Hidden packages.
  for (const pkg of G.packagesLeft) {
    if (dist(G.player.x, G.player.y, pkg.x, pkg.y) < 30) {
      G.packagesLeft = G.packagesLeft.filter((q) => q !== pkg);
      G.packages = (G.packages || 0) + 1;
      G.cash += 100;
      G.audio.pickup();
      G.flashMessage(`HIDDEN PACKAGE ${G.packages}/8  +$100`, '#2ecc71');
    }
  }
}

function updateTaxi(G, dt) {
  const p = G.player;
  const inTaxi = p.inCar && p.car && p.car.model.name === 'Taxi';
  if (!G.taxi && inTaxi && G.rng() < dt * 0.08) {
    // A fare appears on a nearby sidewalk.
    const x = clamp(p.x + (G.rng() - 0.5) * 700, 80, 2400);
    const y = clamp(p.y + (G.rng() - 0.5) * 700, 80, 2400);
    G.taxi = {
      state: 'pickup', x, y,
      ped: { name: ['Maya', 'Tomas', 'Lena'][Math.floor(G.rng() * 3)] },
      fare: 40 + Math.floor(G.rng() * 50),
    };
  }
  if (G.taxi) {
    if (G.taxi.state === 'pickup') {
      if (dist(p.x, p.y, G.taxi.x, G.taxi.y) < 46) {
        G.taxi.state = 'deliver';
        G.taxi.x = clamp(p.x + (G.rng() - 0.5) * 1600, 100, 2400);
        G.taxi.y = clamp(p.y + (G.rng() - 0.5) * 1600, 100, 2400);
        G.flashMessage(`${G.taxi.ped.name} is in — drive to the marker`, '#f1c40f');
      }
    } else if (dist(p.x, p.y, G.taxi.x, G.taxi.y) < 70) {
      G.cash += G.taxi.fare;
      G.stats.fares = (G.stats.fares || 0) + 1;
      G.flashMessage(`FARE COMPLETE  +$${G.taxi.fare}`, '#2ecc71');
      G.audio.pickup();
      G.taxi = null;
    }
    if (!inTaxi) G.taxi = null;
  }
}

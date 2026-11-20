// SOLMAR — Vice Harbor (r6): the story. Mara Voss owes Donna Ferrante
// $10,000. Eight story jobs pay it down; taxi fares and a street race pay
// extra on the side. Missions are data: a list of steps the game walks
// through, so the judge's outline shows the whole story at a glance.
import { dist } from './util.js';

export const START_DEBT = 10000;

export const MISSIONS = [
  {
    id: 1, title: 'First Fare', giver: 'Mara Voss',
    brief: 'Donna Ferrante wants her $10,000 back by Friday. Start where every Solmar hustle starts: the taxi rank at Marina Bay. Pick up the fare and drop them at the beach hotel.',
    reward: 250,
    steps: [
      { kind: 'goto', x: 480, y: 480, label: 'Go to the taxi rank (Marina Bay)' },
      { kind: 'pickup', x: 480, y: 480, label: 'Pick up the passenger (E near the cab)' },
      { kind: 'deliver', x: 3360, y: 480, label: 'Drop the fare at Hotel Palma, Vice Beach' },
    ],
  },
  {
    id: 2, title: 'Hot Wheels', giver: 'Rico Delgado',
    brief: 'Rico needs a Comet GT for a buyer in the Hills — and the buyer does not ask where cars come from. Steal the red Comet parked outside Solmar Motors and bring it to the garage.',
    reward: 600,
    steps: [
      { kind: 'steal', x: 1600, y: 800, label: 'Steal the red Comet GT (E to take it)' },
      { kind: 'deliver', x: 2240, y: 1760, label: 'Deliver the Comet to Rico’s garage' },
    ],
  },
  {
    id: 3, title: 'The Collector', giver: 'Donna Ferrante',
    brief: 'Donna’s runners went quiet. Collect three packages stashed around Downtown and Old Town — and try not to attract the VHPD while you do it.',
    reward: 900,
    steps: [
      { kind: 'collect', x: 1280, y: 480, label: 'Package 1 of 3 — Downtown plaza' },
      { kind: 'collect', x: 800, y: 2080, label: 'Package 2 of 3 — Old Town alley' },
      { kind: 'collect', x: 2240, y: 1120, label: 'Package 3 of 3 — Downtown rooftops' },
    ],
  },
  {
    id: 4, title: 'Rico’s Race', giver: 'Rico Delgado',
    brief: 'The Vice Beach street race pays $1,500 to the winner. Beat the rival coupe through five checkpoints — no rules, just speed. Your Comet is waiting at the start line.',
    reward: 1500,
    steps: [
      { kind: 'race', x: 3360, y: 1120, label: 'Race: checkpoint 1 of 5' },
      { kind: 'race', x: 3360, y: 2400, label: 'Race: checkpoint 2 of 5' },
      { kind: 'race', x: 1600, y: 2400, label: 'Race: checkpoint 3 of 5' },
      { kind: 'race', x: 1600, y: 1120, label: 'Race: checkpoint 4 of 5' },
      { kind: 'race', x: 2880, y: 800, label: 'Race: FINISH — Vice Beach' },
    ],
  },
  {
    id: 5, title: 'Smoke on the Water', giver: 'Mara Voss',
    brief: 'A deal at the marina went loud and the VHPD is all over you. Lose the heat — get your wanted level back to zero — then lay low at the safehouse in North Hills.',
    reward: 800,
    steps: [
      { kind: 'escape', x: 0, y: 0, label: 'Lose the VHPD — get wanted to 0 stars' },
      { kind: 'goto', x: 2880, y: 2080, label: 'Reach the North Hills safehouse' },
    ],
  },
  {
    id: 6, title: 'Donna’s Errand', giver: 'Donna Ferrante',
    brief: 'Donna trusts you with a courier run through Downtown at rush hour. The VHPD set up roadblocks — smash through or slip around them, but the package arrives tonight.',
    reward: 1200,
    steps: [
      { kind: 'pickup', x: 1920, y: 800, label: 'Pick up Donna’s package (Downtown)' },
      { kind: 'deliver', x: 480, y: 2400, label: 'Deliver it to the Old Town drop' },
    ],
  },
  {
    id: 7, title: 'Air One', giver: 'Rico Delgado',
    brief: 'Air One is over the city and every VHPD unit is hunting you. Survive three minutes of a 4-star manhunt, then ditch the car at the beach and vanish on foot.',
    reward: 1600,
    steps: [
      { kind: 'survive', x: 0, y: 0, label: 'Survive the manhunt — 180 seconds' },
      { kind: 'goto', x: 3600, y: 800, label: 'Ditch the car and reach the beach on foot' },
    ],
  },
  {
    id: 8, title: 'Payday', giver: 'Donna Ferrante',
    brief: 'The last job. Lift the night’s take from the Vice Beach casino cage and bring it to Donna at the marina. Pay the $10,000, walk away clean — or keep driving.',
    reward: 2500,
    steps: [
      { kind: 'pickup', x: 3200, y: 480, label: 'Grab the casino take (Vice Beach)' },
      { kind: 'deliver', x: 480, y: 2720, label: 'Bring it to Donna at the marina' },
    ],
  },
];

export function missionById(id) { return MISSIONS.find(m => m.id === id) || null; }

export function nextMissionId(done) {
  for (const m of MISSIONS) if (!done.includes(m.id)) return m.id;
  return null;
}

// Called by game.js when a mission starts: returns a fresh runtime state.
export function startMissionState(mission) {
  return { id: mission.id, step: 0, timer: 0, done: false, rival: null, racePos: 0 };
}

// Progress one mission step. Returns 'step' | 'done' | null.
export function updateMission(game, dt) {
  const ms = game.missionState;
  if (!ms) return null;
  const mission = missionById(ms.id);
  const step = mission.steps[ms.step];
  const px = game.player.x, py = game.player.y;
  ms.timer += dt;
  if (step.kind === 'goto' || step.kind === 'deliver' || step.kind === 'collect' || step.kind === 'pickup') {
    if (dist(px, py, step.x, step.y) < 90) {
      if (step.kind === 'pickup' && !game.nearCar && !game.player.inCar) {
        // On-foot pickup needs the player to press E at the marker.
        if (!game.keys.e) return null;
      }
      return advance(game, mission, ms);
    }
  } else if (step.kind === 'steal') {
    if (game.player.inCar && game.player.car && game.player.car.type.id === 'sports') return advance(game, mission, ms);
  } else if (step.kind === 'race') {
    if (dist(px, py, step.x, step.y) < 110) return advance(game, mission, ms);
  } else if (step.kind === 'escape') {
    if (game.wanted === 0 && ms.timer > 5) return advance(game, mission, ms);
  } else if (step.kind === 'survive') {
    if (ms.timer >= 180) return advance(game, mission, ms);
  }
  return null;
}

function advance(game, mission, ms) {
  ms.step++;
  ms.timer = 0;
  if (ms.step >= mission.steps.length) {
    ms.done = true;
    return 'done';
  }
  return 'step';
}

export function currentObjective(game) {
  if (!game.missionState) return null;
  const m = missionById(game.missionState.id);
  const s = m.steps[game.missionState.step];
  if (!s) return null;
  return { mission: m, step: s, text: 'M' + m.id + ' · ' + m.title + ' — ' + s.label };
}

// Taxi fares: a fare appears, the player drives a taxi to the passenger,
// then to their destination. Pure side income, no mission lock.
export function makeFare(rng, spots) {
  const a = spots[Math.floor(rng() * spots.length)];
  let b = spots[Math.floor(rng() * spots.length)];
  let guard = 0;
  while (b === a && guard++ < 10) b = spots[Math.floor(rng() * spots.length)];
  return { from: a, to: b, state: 'wait', pay: 120 + Math.floor(rng() * 180) };
}

export const FARE_SPOTS = [
  { x: 480, y: 480, name: 'Marina Bay' }, { x: 3360, y: 480, name: 'Hotel Palma' },
  { x: 1600, y: 800, name: 'Downtown' }, { x: 800, y: 2080, name: 'Old Town' },
  { x: 2880, y: 2080, name: 'North Hills' }, { x: 2240, y: 1760, name: 'Rico’s Garage' },
  { x: 480, y: 2720, name: 'Marina Docks' }, { x: 3600, y: 800, name: 'Vice Beach' },
];

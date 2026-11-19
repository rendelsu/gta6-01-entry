// The story of Mara Voss: five missions plus taxi fares on the side.
// Mara owes $10,000 to Donna Ferrante. Each mission moves the debt down
// and opens the next piece of the city.
import { avenueX, streetY } from './city.js';
import { fmtMoney } from './util.js';

export function makeMissions() {
  return [
    {
      id: 1, title: 'First Fare', giver: 'Mara Voss',
      brief: 'Your cab is waiting at the pier. Pick up the fare at Marina Bay and drop them at Downtown. Earn your first $250.',
      steps: [
        { text: 'Get in the taxi at Harbor Pier 9', type: 'enterTaxi' },
        { text: 'Pick up the passenger at Marina Bay', type: 'goto', x: avenueX(8), y: streetY(6), r: 90 },
        { text: 'Drop the passenger at Downtown', type: 'goto', x: avenueX(6), y: streetY(3), r: 90 },
      ],
      reward: 250, debtAfter: 9750,
      done: 'Clean run. $250 closer to freedom — $9,750 to go.',
    },
    {
      id: 2, title: 'The Collection', giver: 'Donna Ferrante',
      brief: 'Donna wants her cut. Collect the package from Ferrante Tower, then bring it to the garage. She also leaves you a pistol — you will need it.',
      steps: [
        { text: 'Collect the package at Ferrante Tower', type: 'goto', x: avenueX(6), y: streetY(3), r: 90 },
        { text: 'Bring the package back to Voss Garage', type: 'goto', x: avenueX(5), y: streetY(4), r: 90 },
      ],
      reward: 800, debtAfter: 8950, givesGun: true,
      done: 'Package delivered. Donna is pleased — for now. Debt: $8,950. You keep a pistol.',
    },
    {
      id: 3, title: 'Harbor Heat', giver: 'Mara Voss',
      brief: 'A red Veloce Coupe is parked at the docks, keys in it. Steal it and bring it to the garage — the VHPD will notice, so drive like you mean it.',
      steps: [
        { text: 'Steal the red Veloce Coupe at the docks', type: 'stealCoupe' },
        { text: 'Lose the heat, then bring the coupe to Voss Garage', type: 'goto', x: avenueX(5), y: streetY(4), r: 90 },
      ],
      reward: 1500, debtAfter: 7450, wantedOnSteal: 2,
      done: 'The coupe is ours. $1,500 banked — debt down to $7,450.',
    },
    {
      id: 4, title: 'Voss Strikes Back', giver: 'Mara Voss',
      brief: 'Ferrante sent thugs to smash the garage. Defend it on foot — take down all three waves. Click to shoot, Space to punch.',
      steps: [
        { text: 'Defend Voss Garage — wave 1 of 3', type: 'combat', wave: 1 },
        { text: 'Defend Voss Garage — wave 2 of 3', type: 'combat', wave: 2 },
        { text: 'Defend Voss Garage — wave 3 of 3', type: 'combat', wave: 3 },
      ],
      reward: 2000, debtAfter: 5450,
      done: 'Garage stands. Donna heard about it — debt now $5,450.',
    },
    {
      id: 5, title: 'The Last Ten Grand', giver: 'Donna Ferrante',
      brief: 'One last job: grab the cash from the Bayview Hotel, then meet Donna at the pier and pay what you owe. The whole VHPD will be on you.',
      steps: [
        { text: 'Grab the cash at Bayview Hotel', type: 'goto', x: avenueX(8), y: streetY(6), r: 90 },
        { text: 'Meet Donna at Harbor Pier 9', type: 'goto', x: avenueX(2), y: streetY(7), r: 90 },
        { text: 'Escape the heat — get wanted down to 0', type: 'escape' },
      ],
      reward: 5450, debtAfter: 0, wantedOnStart: 3,
      done: 'Debt paid. Mara Voss is free — Vice Harbor is yours now.',
    },
  ];
}

export function missionState() {
  return {
    index: 0, step: 0, active: false, finished: false,
    dialog: null, dialogT: 0, banner: null, bannerT: 0,
    combatWave: 0, combatLeft: 0, combatSpawnT: 0,
    taxiFare: null, fareT: 0, storyDone: false,
  };
}

export function startMission(ms, missions, audio) {
  const m = missions[ms.index];
  if (!m) return;
  ms.active = true;
  ms.step = 0;
  ms.dialog = { name: m.giver, lines: [m.brief], title: 'MISSION ' + m.id + ' — ' + m.title };
  ms.dialogT = 0;
  if (audio) audio.mission();
  if (m.wantedOnStart) return m.wantedOnStart;
  return 0;
}

export function currentStep(ms, missions) {
  const m = missions[ms.index];
  if (!m || !ms.active) return null;
  return m.steps[ms.step] || null;
}

export function advanceStep(ms, missions, audio) {
  const m = missions[ms.index];
  if (!m) return false;
  ms.step++;
  if (ms.step >= m.steps.length) {
    ms.active = false;
    ms.dialog = { name: m.giver, lines: [m.done], title: 'MISSION COMPLETE — ' + m.title };
    ms.dialogT = 0;
    ms.banner = '+' + fmtMoney(m.reward) + '  •  Debt ' + fmtMoney(m.debtAfter);
    ms.bannerT = 4;
    if (audio) audio.cash();
    return true;
  }
  if (audio) audio.pickup();
  return false;
}

// Taxi fares: a side activity that always pays. A fare appears near the
// player; drive to the pickup, then to the drop-off, and get paid.
export function offerFare(state, rng) {
  const spots = [
    { x: avenueX(3), y: streetY(2), name: 'North Hills' },
    { x: avenueX(8), y: streetY(6), name: 'Marina Bay' },
    { x: avenueX(6), y: streetY(3), name: 'Downtown' },
    { x: avenueX(2), y: streetY(7), name: 'Harbor Pier' },
    { x: avenueX(9), y: streetY(5), name: 'Eastside' },
  ];
  const a = spots[Math.floor(rng() * spots.length)];
  let b = spots[Math.floor(rng() * spots.length)];
  if (b === a) b = spots[(spots.indexOf(a) + 2) % spots.length];
  state.ms.taxiFare = {
    stage: 'pickup', px: a.x, py: a.y, pname: a.name,
    dx: b.x, dy: b.y, dname: b.name,
    pay: 60 + Math.floor(rng() * 140),
  };
  state.ms.banner = 'FARE: pick up a passenger in ' + a.name;
  state.ms.bannerT = 3;
}

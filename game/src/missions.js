// SOLMAR — Vice Harbor: story missions and taxi fares.
// Mara Voss owes $10,000 to Donna Ferrante. Five jobs pay the debt down.

const MISSIONS = [
  {
    id: 'm1', title: 'First Fare', reward: 1200,
    brief: 'Mara: "Donna wants her money, and I have got none. Take my taxi, pick up the fare at the Portside docks and drop them Downtown. Drive clean."',
    steps: [
      { type: 'taxi', text: 'Get in a taxi (press E near one)' },
      { type: 'goto', x: 480, y: 480, r: 90, needCar: true, text: 'Pick up the passenger at the Portside docks' },
      { type: 'goto', x: 1760, y: 1760, r: 90, text: 'Drop the passenger off Downtown' },
    ],
  },
  {
    id: 'm2', title: 'Hot Wheels', reward: 1800,
    brief: 'Mara: "Donna\'s collector drives a Vultura GT and parks it by the Marina boardwalk like he owns the place. Take it. Bring it to my garage in Old Town."',
    steps: [
      { type: 'steal', vehicle: 'sports', text: 'Steal the orange Vultura GT at Marina Bay' },
      { type: 'goto', x: 1440, y: 800, r: 110, text: 'Deliver the Vultura to Mara\'s garage in Old Town', needCar: true },
    ],
  },
  {
    id: 'm3', title: 'Knockout', reward: 2200,
    brief: 'Mara: "Two of Donna\'s thugs are shaking down my corner store on the strip. Walk over there and knock some sense into them. Fists only — no heat."',
    steps: [
      { type: 'goto', x: 2080, y: 2080, r: 100, text: 'Reach the corner store on the Downtown strip' },
      { type: 'beat', count: 2, text: 'Beat up Donna\'s thugs (press F to punch)' },
    ],
  },
  {
    id: 'm4', title: 'Getaway', reward: 2600,
    brief: 'Mara: "The VHPD found the Vultura. Lose them. Get your wanted level to 3 stars, then shake the whole tail and come back clean."',
    steps: [
      { type: 'wanted', level: 3, text: 'Raise your wanted level to 3 stars (steal a car, hit a cop)' },
      { type: 'survive', seconds: 25, text: 'Survive the chase for 25 seconds' },
      { type: 'clean', text: 'Lose the cops — wanted back to 0' },
    ],
  },
  {
    id: 'm5', title: 'Payday', reward: 3200,
    brief: 'Mara: "Last job. Pick up the cash from my stash under the Portside bridge, then walk it straight to Donna Ferrante at the Marina hotel. No detours, no cops."',
    steps: [
      { type: 'goto', x: 320, y: 2400, r: 90, text: 'Collect the cash stash under the Portside bridge' },
      { type: 'goto', x: 3200, y: 2560, r: 110, text: 'Deliver the cash to Donna at the Marina hotel' },
    ],
  },
];

const DEBT_TOTAL = 10000;

function missionState(state) {
  return { index: state.missionIndex, def: MISSIONS[state.missionIndex] || null };
}

function startMission(state, index) {
  const m = MISSIONS[index];
  if (!m) return;
  state.missionIndex = index;
  state.missionStep = 0;
  state.missionActive = true;
  state.dialog = { speaker: 'MARA VOSS', text: m.brief, mission: m.title, open: true };
  state.missionTimer = 0;
  state.thugsLeft = 0;
  state.fare = null;
  if (m.id === 'm3') {
    // Spawn the two thugs at the store when the mission starts.
    for (let i = 0; i < 2; i++) {
      const thug = spawnPed(state, 2080 + (i - 0.5) * 90, 2080 + (i - 0.5) * 40);
      thug.thug = true; thug.name = 'Ferrante Thug'; thug.color = '#5a2a2a'; thug.hp = 70; thug.speed = 80;
      state.thugsLeft++;
    }
  }
  if (m.id === 'm2') {
    // Park the target Vultura GT by the Marina boardwalk.
    const type = VEHICLE_TYPES.find((t) => t.id === 'sports');
    const car = makeCar(3360, 2240, 0.4, type, { driver: false });
    car.target = true;
    state.parked.push(car);
  }
}

function currentStep(state) {
  const m = MISSIONS[state.missionIndex];
  if (!m || !state.missionActive) return null;
  return m.steps[state.missionStep] || null;
}

function advanceStep(state) {
  state.missionStep++;
  const m = MISSIONS[state.missionIndex];
  if (state.missionStep >= m.steps.length) completeMission(state);
  else AudioSys.pickup();
}

function completeMission(state) {
  const m = MISSIONS[state.missionIndex];
  state.cash += m.reward;
  state.debtPaid += m.reward;
  state.missionActive = false;
  state.missionsDone++;
  AudioSys.missionDone();
  state.toast = { text: 'MISSION COMPLETE: ' + m.title + ' — +' + fmtMoney(m.reward), t: 4 };
  state.dialog = {
    speaker: 'MARA VOSS',
    text: m.id === 'm5'
      ? 'Mara: "That is the last of it. Ten thousand, paid. Donna Ferrante is off my back — and yours. Vice Harbor is ours now."'
      : 'Mara: "Good work. ' + fmtMoney(state.debtPaid) + ' of ' + fmtMoney(DEBT_TOTAL) + ' paid. Keep going."',
    mission: m.title, open: true,
  };
  if (state.missionIndex + 1 < MISSIONS.length) {
    state.nextMissionAt = 3; // next mission briefs a few seconds later
  } else {
    state.storyDone = true;
  }
}

// --- taxi fares: a side activity that always pays ---------------------------
function startFare(state) {
  const pickup = randomRoadPoint();
  const drop = randomRoadPoint();
  state.fare = { stage: 'pickup', x: pickup.x, y: pickup.y, dx: drop.x, dy: drop.y, pay: randInt(80, 240), t: 0 };
  state.toast = { text: 'TAXI FARE: pick up the passenger (yellow marker)', t: 3 };
  AudioSys.pickup();
}

function fareMarker(state) {
  if (!state.fare) return null;
  return state.fare.stage === 'pickup'
    ? { x: state.fare.x, y: state.fare.y, label: 'PICKUP' }
    : { x: state.fare.dx, y: state.fare.dy, label: 'DROP-OFF' };
}

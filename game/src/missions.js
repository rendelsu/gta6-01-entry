// Story missions and taxi fares for SOLMAR — Vice Harbor.
// Mara Voss owes $10,000 to Donna Ferrante. Five missions pay the debt down.
import { avenueX, streetY } from './city.js';
import { dist } from './util.js';

export const DEBT_TOTAL = 10000;

export function missionList() {
  return [
    {
      id: 1, title: 'PESAN DONNA', giver: 'Donna Ferrante',
      briefing: 'Donna Ferrante memanggilmu ke Club Neon. Utangmu $10.000 sudah jatuh tempo — dengarkan apa maunya, Mara.',
      reward: 500,
      steps: [
        { kind: 'goto', label: 'Pergi ke Club Neon', x: avenueX(8) + 40, y: streetY(2) - 40, r: 70 },
        { kind: 'talk', label: 'Bicara dengan Donna (tekan E)', x: avenueX(8) + 40, y: streetY(2) - 40, r: 60,
          dialog: 'DONNA: "Mara. Sepuluh ribu. Kau punya seminggu. Kerja untukku — atau kolam marina yang bicara."', },
      ],
    },
    {
      id: 2, title: 'SETORAN PERTAMA', giver: 'Donna Ferrante',
      briefing: 'Tiga toko di Vice Harbor "berutang" perlindungan ke Donna. Tagih setoran mereka dan antar ke Club Neon.',
      reward: 1500,
      steps: [
        { kind: 'pickup', label: 'Tagih Tacos El Sol (E)', x: avenueX(5) + 40, y: streetY(4) - 40, r: 60, dialog: 'PEMILIK TAKO: "Ambil saja! Jangan rusak etalaseku lagi!"' },
        { kind: 'pickup', label: 'Tagih Pawn Shop (E)', x: avenueX(7) + 40, y: streetY(5) - 40, r: 60, dialog: 'PEMILIK GADAI: "Ini semua yang ada. Sampaikan salamku ke Donna."' },
        { kind: 'pickup', label: 'Tagih Donuts 24H (E)', x: avenueX(9) + 40, y: streetY(3) - 40, r: 60, dialog: 'KASIR: "Donat gratis juga? Baiklah... ambil uangnya."' },
        { kind: 'goto', label: 'Antar setoran ke Club Neon', x: avenueX(8) + 40, y: streetY(2) - 40, r: 70 },
      ],
    },
    {
      id: 3, title: 'KABUR DARI VHPD', giver: 'Mara Voss',
      briefing: 'Seseorang melaporkanmu. VHPD mengejarmu — hilang dari radar mereka dan sampai ke safehouse di Harbor Docks.',
      reward: 2000,
      steps: [
        { kind: 'escape', label: 'Lepas dari kejaran polisi, lalu ke safehouse', x: avenueX(2) + 40, y: streetY(6) - 40, r: 80, wanted: 3, seconds: 25 },
      ],
    },
    {
      id: 4, title: 'MOBIL PESANAN', giver: 'Donna Ferrante',
      briefing: 'Donna mau sports car oranye yang terparkir di Downtown. Curi, jangan sampai hancur, antar ke bengkel Auto Repair.',
      reward: 2500,
      steps: [
        { kind: 'steal', label: 'Curi sports car oranye di Downtown', x: avenueX(7), y: streetY(1), r: 90, carType: 'sports', carColor: '#e67e22' },
        { kind: 'deliver', label: 'Antar mobil ke Auto Repair (jangan rusak!)', x: avenueX(4) + 40, y: streetY(6) - 40, r: 80 },
      ],
    },
    {
      id: 5, title: 'LUNAS', giver: 'Donna Ferrante',
      briefing: 'Setoran terakhir di dermaga Harbor Docks. Tapi penagih Donna yang lama tidak mau pensiun — hadapi mereka, lalu serahkan uangnya.',
      reward: 3500,
      steps: [
        { kind: 'goto', label: 'Pergi ke dermaga Harbor Docks', x: avenueX(3) + 40, y: streetY(7) - 40, r: 80 },
        { kind: 'fight', label: 'Hadapi penagih Donna (pukul / tembak)', x: avenueX(3) + 40, y: streetY(7) - 40, r: 120, enemies: 3 },
        { kind: 'talk', label: 'Serahkan uang ke Donna (E)', x: avenueX(3) + 40, y: streetY(7) - 40, r: 60,
          dialog: 'DONNA: "Lunas, Mara. Sepuluh ribu. Kau bekerja bagus — Vice Harbor ini milikmu sekarang."', },
      ],
    },
  ];
}

export function newMissionState() {
  return {
    index: 0,            // mission currently active (0-based)
    step: 0,             // step inside the mission
    active: false,
    done: [],            // completed mission ids
    debtPaid: 0,
    dialog: null,        // { text, until } shown in the dialog box
    escapeTimer: 0,
    carrying: 0,         // cash collected this mission
    targetCar: null,     // vehicle id for steal/deliver steps
    enemies: [],         // spawned thugs for fight steps
    startedAt: 0,
  };
}

export function currentMission(ms) {
  const list = missionList();
  if (ms.index >= list.length) return null;
  return list[ms.index];
}
export function currentStep(ms) {
  const m = currentMission(ms);
  if (!m) return null;
  return m.steps[ms.step] || null;
}
export function missionObjectiveText(ms) {
  const m = currentMission(ms);
  if (!m) return 'UTANG LUNAS — Vice Harbor milikmu, Mara.';
  if (!ms.active) return 'Tekan M untuk memulai misi: ' + m.title;
  const s = currentStep(ms);
  if (!s) return m.title + ' — selesai!';
  return m.title + ' — ' + s.label;
}

// Start the next mission. Returns the briefing text.
export function startMission(state) {
  const ms = state.missions;
  const m = currentMission(ms);
  if (!m || ms.active) return null;
  ms.active = true;
  ms.step = 0;
  ms.carrying = 0;
  ms.escapeTimer = 0;
  ms.startedAt = state.time;
  const step = m.steps[0];
  if (step && step.kind === 'escape' && step.wanted) {
    state.wanted = Math.max(state.wanted, step.wanted);
    ensurePolice(state);
  }
  if (step && step.kind === 'steal') spawnTargetCar(state, step);
  if (step && step.kind === 'fight') spawnEnemies(state, step);
  showDialog(state, m.giver + ': ' + m.briefing);
  return m.briefing;
}

export function ensurePolice(state) {
  const want = Math.min(2 + state.wanted, 6);
  while (state.police.length < want) {
    const { spawnPolice } = state.__entities;
    state.police.push(spawnPolice(state));
  }
}

export function spawnTargetCar(state, step) {
  const { makeVehicle } = state.__entities;
  const car = makeVehicle(step.carType || 'sports', step.x, step.y, 0, { parked: true, color: step.carColor });
  state.traffic.push(car);
  state.missions.targetCar = car.id;
}

export function spawnEnemies(state, step) {
  const { makePed } = state.__entities;
  state.missions.enemies = [];
  for (let i = 0; i < (step.enemies || 2); i++) {
    const e = makePed(step.x + (i - 1) * 90, step.y + 60);
    e.thug = true;
    e.health = 3;
    e.shirt = '#222222';
    state.peds.push(e);
    state.missions.enemies.push(e.id);
  }
}

export function showDialog(state, text, seconds = 6) {
  state.missions.dialog = { text, until: state.time + seconds };
}

export function advanceStep(state) {
  const ms = state.missions;
  const m = currentMission(ms);
  if (!m) return;
  ms.step++;
  if (ms.step >= m.steps.length) {
    // Mission complete.
    ms.done.push(m.id);
    ms.debtPaid += m.reward;
    state.cash += m.reward;
    ms.active = false;
    ms.index++;
    showDialog(state, 'MISI SELESAI: ' + m.title + ' — dibayar $' + m.reward + '. Utang terbayar: $' + ms.debtPaid + ' / $' + DEBT_TOTAL, 7);
    state.saveGame();
    if (state.audio) state.audio.win();
    return;
  }
  const step = m.steps[ms.step];
  if (step.kind === 'escape' && step.wanted) {
    state.wanted = Math.max(state.wanted, step.wanted);
    ensurePolice(state);
  }
  if (step.kind === 'steal') spawnTargetCar(state, step);
  if (step.kind === 'fight') spawnEnemies(state, step);
  if (step.dialog) showDialog(state, step.dialog);
}

// Called every frame while a mission is active.
export function updateMissions(state, dt) {
  const ms = state.missions;
  if (!ms.active) return;
  const m = currentMission(ms);
  const step = currentStep(ms);
  if (!m || !step) return;
  const p = state.player;
  const px = state.playerCar ? state.playerCar.x : p.x;
  const py = state.playerCar ? state.playerCar.y : p.y;
  const d = dist(px, py, step.x, step.y);
  if (step.kind === 'goto' || step.kind === 'deliver') {
    if (d < step.r) advanceStep(state);
  } else if (step.kind === 'escape') {
    ms.escapeTimer += dt;
    if (state.wanted === 0 && ms.escapeTimer > (step.seconds || 20)) {
      advanceStep(state);
    } else if (d < step.r && state.wanted === 0) {
      advanceStep(state);
    }
  } else if (step.kind === 'steal') {
    const car = state.traffic.find((v) => v.id === ms.targetCar);
    if (car && state.playerCar === car) advanceStep(state);
  } else if (step.kind === 'fight') {
    const alive = ms.enemies.filter((id) => {
      const e = state.peds.find((x) => x.id === id);
      return e && !e.dead;
    });
    if (alive.length === 0) advanceStep(state);
  }
  // talk / pickup steps complete on E — handled by tryInteract().
}

// E key: interact with the current mission step, a car, or a taxi passenger.
export function tryInteract(state) {
  const ms = state.missions;
  const p = state.player;
  const px = state.playerCar ? state.playerCar.x : p.x;
  const py = state.playerCar ? state.playerCar.y : p.y;
  if (ms.active) {
    const step = currentStep(ms);
    if (step && (step.kind === 'talk' || step.kind === 'pickup')) {
      if (dist(px, py, step.x, step.y) < step.r + 30) {
        if (step.kind === 'pickup') { ms.carrying += 400; state.cash += 400; if (state.audio) state.audio.cash(); }
        if (step.dialog) showDialog(state, step.dialog);
        advanceStep(state);
        return true;
      }
    }
  }
  return false;
}

// --- Taxi fares ---------------------------------------------------------------
export function newTaxiState() {
  return { passenger: null, dest: null, fare: 0, timer: 0 };
}

export function updateTaxi(state, dt) {
  const t = state.taxi;
  const car = state.playerCar;
  if (!car || car.type !== 'taxi') { t.passenger = null; t.dest = null; return; }
  t.timer += dt;
  if (!t.passenger && t.timer > 6) {
    t.timer = 0;
    // A pedestrian nearby hails the taxi.
    const near = state.peds.find((ped) => !ped.dead && dist(ped.x, ped.y, car.x, car.y) < 320);
    if (near) {
      t.passenger = { x: near.x, y: near.y };
      t.dest = { x: avenueX(1 + Math.floor(Math.random() * 10)), y: streetY(1 + Math.floor(Math.random() * 7)) };
      t.fare = 60 + Math.floor(dist(car.x, car.y, t.dest.x, t.dest.y) / 40);
      showDialog(state, 'PENUMPANG: "Antar aku ke penanda kuning — $' + t.fare + ' untukmu."', 5);
    }
  }
  if (t.passenger && !t.destReached) {
    if (dist(car.x, car.y, t.dest.x, t.dest.y) < 70) {
      state.cash += t.fare;
      showDialog(state, 'FARE DIBAYAR: +$' + t.fare, 4);
      if (state.audio) state.audio.cash();
      t.passenger = null; t.dest = null; t.timer = 0;
    }
  }
}

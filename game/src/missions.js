// Missions and story: Mara Voss, fresh out of Harbor lockup, owes the Ferrante
// family $10,000. Rico Salas runs the jobs. Five missions, then free-roam fares.
import { dist } from './utils.js';

export const STORY = {
  hero: 'Mara Voss',
  fixer: 'Rico Salas',
  creditor: 'Donna Ferrante',
  debt: 10000,
};

function L(name) { return name; }

export const MISSIONS = [
  {
    id: 'm1',
    title: 'Homecoming',
    reward: 400,
    intro: [
      'RICO: Mara! Out at last. Donna Ferrante still owns your debt — $10,000.',
      'RICO: You drive for me now. First job: meet me at the garage. Walk or steal a ride.',
    ],
    steps: [
      { type: 'goto', at: 'garage', radius: 90, text: 'Go to Rico\u2019s Garage', hint: 'Follow the yellow marker. Press E near a car to steal it.' },
      { type: 'talk', at: 'garage', radius: 70, text: 'Talk to Rico (E)', hint: 'Rico has the first real job for you.' },
      { type: 'goto', at: 'docks', radius: 90, text: 'Drive to the Old Port Docks', hint: 'A crate is waiting at the docks. Any car will do.' },
      { type: 'pickup', at: 'docks', radius: 70, text: 'Pick up the crate (E)', hint: 'Grab it and bring it back to Rico.' },
      { type: 'goto', at: 'garage', radius: 90, text: 'Deliver the crate to Rico', hint: 'Don\u2019t smash the car — Rico hates paperwork.' },
    ],
    outro: ['RICO: Clean run. $400. Donna\u2019s debt is down to $9,600. There is more where that came from.'],
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    reward: 800,
    intro: [
      'RICO: A client wants a Comet GT — the red sports car parked by Solmar Plaza.',
      'RICO: Take it. Quietly. Cops notice a stolen Comet real fast, so drive it straight back.',
    ],
    steps: [
      { type: 'goto', at: 'plaza', radius: 110, text: 'Find the red Comet GT at Solmar Plaza', hint: 'The sports car is parked on the plaza\u2019s north side.' },
      { type: 'steal', at: 'plaza', radius: 80, text: 'Steal the Comet GT (E)', hint: 'Get in and drive. The cops will be watching.' },
      { type: 'goto', at: 'garage', radius: 100, text: 'Deliver the Comet to Rico\u2019s Garage', hint: 'One scratch and the client pays half. Keep it clean.' },
    ],
    outro: ['RICO: Beautiful. The client paid $800. Debt: $8,800. You drive like you mean it.'],
  },
  {
    id: 'm3',
    title: 'The Package',
    reward: 1200,
    intro: [
      'RICO: Warehouse 9. A package, no questions. The VHPD has the docks staked out tonight.',
      'RICO: Take the package to the Neon Strip. If the cops light you up — lose them, don\u2019t fight them.',
    ],
    steps: [
      { type: 'goto', at: 'warehouse', radius: 100, text: 'Go to Warehouse 9', hint: 'The package is inside the yard.' },
      { type: 'pickup', at: 'warehouse', radius: 70, text: 'Take the package (E)', hint: 'The moment you grab it, the cops will know.' },
      { type: 'escape', at: 'strip', radius: 110, text: 'Deliver to the Neon Strip — lose the cops first', hint: 'Wanted level must be 0 when you arrive. Break line of sight and wait.' },
    ],
    outro: ['CLIENT: The package is safe. RICO: $1,200. Debt: $7,600. You are getting good at this.'],
  },
  {
    id: 'm4',
    title: 'Payback',
    reward: 2000,
    intro: [
      'RICO: The Coral Kings jumped one of our couriers at the docks. They are still there, counting our money.',
      'RICO: Go get it back. Fists won\u2019t cut it — grab the pistol from the garage stash first.',
    ],
    steps: [
      { type: 'goto', at: 'garage', radius: 80, text: 'Pick up the pistol at the garage', hint: 'Press 2 to draw the pistol. Click to shoot.' },
      { type: 'goto', at: 'docks', radius: 130, text: 'Go to the Old Port Docks', hint: 'Five Kings, all armed. Use the containers as cover.' },
      { type: 'combat', at: 'docks', radius: 200, text: 'Clear out the Coral Kings (0/5)', hint: 'Watch your health. A wrecked car is not cover.' },
      { type: 'pickup', at: 'docks', radius: 80, text: 'Recover the courier\u2019s cash (E)', hint: 'It is in the duffel by the containers.' },
      { type: 'goto', at: 'garage', radius: 100, text: 'Bring the cash back to Rico', hint: 'Donna will be pleased. Pleased is good.' },
    ],
    outro: ['RICO: $2,000 recovered. Debt: $5,600. The Kings will think twice next time.'],
  },
  {
    id: 'm5',
    title: 'Harbor Lights',
    reward: 5600,
    intro: [
      'DONNA FERRANTE: Mara. One last job and your debt is gone. My yacht is at the Vice Marina.',
      'DONNA: The harbor patrol is paid to look the other way — the VHPD is not. Drive like the whole city is watching. It is.',
    ],
    steps: [
      { type: 'goto', at: 'garage', radius: 90, text: 'Take Donna\u2019s black muscle car', hint: 'The Bandit is parked behind the garage. It is fast. Use it.' },
      { type: 'steal', at: 'garage', radius: 80, text: 'Get in the Bandit (E)', hint: 'Three stars the moment you leave the garage. Hold on.' },
      { type: 'escape', at: 'marina', radius: 120, text: 'Reach the Vice Marina — lose the cops first', hint: 'Break line of sight, then wait for the heat to die down.' },
    ],
    outro: [
      'DONNA: The car is here. The debt is gone, Mara. You are free.',
      'MARA: Free. First time in years. Vice Harbor is mine now — every street, every car, every sunset.',
    ],
  },
];

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.index = 0; // next mission to start
    this.active = null; // {def, step, timer}
    this.marker = null; // {x, y, label}
    this.sideJob = null;
    this.completedCount = 0;
    this.storyDone = false;
  }
  currentDef() { return MISSIONS[this.index] || null; }
  startMission(i) {
    const def = MISSIONS[i];
    if (!def) return false;
    this.active = { def, step: 0, startedAt: this.game.time };
    this.game.dialogue(def.intro);
    this.updateMarker();
    this.game.sound.pickup();
    return true;
  }
  updateMarker() {
    if (!this.active) { this.marker = null; return; }
    const step = this.active.def.steps[this.active.step];
    if (!step) { this.marker = null; return; }
    const lm = this.game.city.landmarks[step.at];
    this.marker = { x: lm.x, y: lm.y, label: lm.name, step };
  }
  objectiveText() {
    if (this.active) {
      const step = this.active.def.steps[this.active.step];
      let text = step.text;
      if (step.type === 'combat') {
        const left = this.game.combat.rivalsAlive();
        const total = 5;
        text = 'Clear out the Coral Kings (' + (total - left) + '/' + total + ')';
      }
      return this.active.def.title + ' — ' + text;
    }
    if (this.storyDone) return 'Free roam — press T for a fare job. Debt paid in full.';
    const next = this.currentDef();
    if (next) return 'Next job: ' + next.title + ' — go to the yellow marker to start';
    return '';
  }
  // Called when the player presses E (interact).
  interact() {
    const g = this.game;
    const p = g.player;
    const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    // Start a mission by touching its start marker on foot.
    if (!this.active && !this.storyDone) {
      const def = this.currentDef();
      if (def) {
        const lm = g.city.landmarks[def.steps[0].at];
        if (dist(px, py, lm.x, lm.y) < 130) {
          this.startMission(this.index);
          return true;
        }
      }
    }
    if (!this.active) return false;
    const step = this.active.def.steps[this.active.step];
    const lm = g.city.landmarks[step.at];
    if (dist(px, py, lm.x, lm.y) > step.radius + 40) return false;
    if (step.type === 'talk' || step.type === 'pickup') {
      this.advance();
      return true;
    }
    if (step.type === 'steal') {
      // stealing is handled by the car-enter code; reaching the marker is enough
      return false;
    }
    return false;
  }
  advance() {
    const g = this.game;
    const m = this.active;
    m.step++;
    g.sound.pickup();
    if (m.step >= m.def.steps.length) {
      this.completeMission();
      return;
    }
    const step = m.def.steps[m.step];
    g.toast(step.hint || step.text);
    if (step.type === 'combat') {
      const lm = g.city.landmarks[step.at];
      g.combat.spawnRivals(lm.x, lm.y, 5, 60);
      g.toast('The Coral Kings are here — fight!');
    }
    if (m.def.id === 'm4' && m.step === 0) {
      g.player.weapon = 'pistol';
      g.player.ammo = 24;
      g.toast('Pistol picked up — press 2 to draw it');
    }
    if (m.def.id === 'm3' && m.step === 2) {
      g.police.addWanted(2);
    }
    if (m.def.id === 'm5' && m.step === 1) {
      g.police.addWanted(3);
      // park the Bandit behind the garage for the player to take
      g.spawnMissionCar('muscle', g.city.landmarks.garage.x + 60, g.city.landmarks.garage.y + 40, '#1a1a1a');
    }
    this.updateMarker();
  }
  completeMission() {
    const g = this.game;
    const def = this.active.def;
    g.player.cash += def.reward;
    this.completedCount++;
    this.index++;
    g.sound.missionDone();
    g.sound.cash();
    g.particles.addText(g.player.x, g.player.y - 40, '+' + '$' + def.reward, '#7dff8a');
    g.dialogue(def.outro);
    g.toast('Mission complete: ' + def.title + '  +$' + def.reward);
    g.flashBanner('MISSION COMPLETE', def.title + '   +$' + def.reward);
    if (this.index >= MISSIONS.length) {
      this.storyDone = true;
      g.flashBanner('DEBT PAID', 'Mara Voss is free — Vice Harbor is yours');
      g.saveGame();
    }
    this.active = null;
    this.marker = null;
    g.saveGame();
  }
  update(dt) {
    const g = this.game;
    if (!this.active) return;
    const m = this.active;
    const step = m.def.steps[m.step];
    if (!step) return;
    const p = g.player;
    const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    const lm = g.city.landmarks[step.at];
    const d = dist(px, py, lm.x, lm.y);
    if (step.type === 'goto' && d < step.radius) {
      this.advance();
      return;
    }
    if (step.type === 'escape' && d < step.radius && g.police.wanted === 0) {
      this.advance();
      return;
    }
    if (step.type === 'combat' && g.combat.rivalsAlive() === 0) {
      this.advance();
      return;
    }
    if (step.type === 'steal') {
      // complete once the player is driving any car near the marker
      if (!p.onFoot && d < step.radius + 60) {
        this.advance();
        return;
      }
    }
  }
  // Side fare jobs after the story: pick up a passenger, drop them off.
  startSideJob() {
    const g = this.game;
    if (this.active || !this.storyDone) return;
    const spots = ['plaza', 'strip', 'beach', 'hospital', 'marina', 'docks'];
    const a = spots[Math.floor(Math.random() * spots.length)];
    let b = spots[Math.floor(Math.random() * spots.length)];
    if (b === a) b = 'strip';
    const pa = g.city.landmarks[a], pb = g.city.landmarks[b];
    this.sideJob = { from: pa, to: pb, phase: 'pickup', fare: 120 + Math.floor(Math.random() * 180) };
    this.marker = { x: pa.x, y: pa.y, label: pa.name, step: { text: 'Pick up the fare at ' + pa.name } };
    g.toast('Fare job: pick up a passenger at ' + pa.name);
  }
  updateSideJob(dt) {
    const g = this.game;
    if (!this.sideJob) return;
    const p = g.player;
    const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    const target = this.sideJob.phase === 'pickup' ? this.sideJob.from : this.sideJob.to;
    if (dist(px, py, target.x, target.y) < 90) {
      if (this.sideJob.phase === 'pickup') {
        this.sideJob.phase = 'dropoff';
        this.marker = { x: this.sideJob.to.x, y: this.sideJob.to.y, label: this.sideJob.to.name, step: { text: 'Drop off at ' + this.sideJob.to.name } };
        g.toast('Passenger aboard — drop them at ' + this.sideJob.to.name);
      } else {
        g.player.cash += this.sideJob.fare;
        g.sound.cash();
        g.flashBanner('FARE COMPLETE', '+' + '$' + this.sideJob.fare);
        g.saveGame();
        this.sideJob = null;
        this.marker = null;
      }
    }
  }
}

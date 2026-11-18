# gta6-01-entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rendelsu/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rendelsu/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR — Vice Harbor** is a 2D open-world crime game built for make.fun's "Make GTA 6" bounty. You play Mara Voss, a driver fresh out of luck in the neon-soaked city of Vice Harbor, who owes $10,000 to loan shark Donna Ferrante — and the clock is ticking.

## The game

Vice Harbor is a living open world rendered on HTML5 canvas: a 3840×2880 city grid of 12 avenues and 9 streets across 5 distinct districts, from the glittering Marina Strip to the rain-slicked back alleys of Old Town. Traffic flows, pedestrians cross the streets, police patrol, and every corner offers a choice — play it straight, or take what you need.

- **Drive anything:** steal and drive 8 vehicle types, from beat-up sedans to fast getaway cars, each with its own handling — day or night, sunshine or rain-slicked streets.
- **Wanted system:** a 0–5 star wanted level; the VHPD escalates from patrol cars to roadblocks and helicopter pursuit as the heat rises. Lose them in the alleys, or outrun them on the avenues.
- **On-foot combat:** brawl your way out of trouble when the car won't save you.
- **5 story missions:** work off Mara's debt to Donna Ferrante one job at a time — getaways, deliveries, and scores that get riskier with every dollar.
- **Taxi fares:** pick up passengers between jobs for honest cash when the heat is too high for crime.
- **HUD + minimap:** live wanted stars, cash, health, mission markers, and a full minimap keep you oriented in the sprawl.
- **Start screen, saves, and synth audio:** localStorage saves your progress; a synthesized soundtrack and sound effects set the mood — no audio files needed.

## Run it

```sh
npm install
npm run build
npm start
```

Then open http://localhost:8080 and hit the streets. Screenshots of the running game live in `screenshots/` (the first one is the cover shot: a sunset police chase).

## How it's built

The game is a single TypeScript codebase (`game/` + `main.ts`) compiled to vanilla JavaScript and drawn on a 2D canvas — no engine, no assets to download. `main.ts` copies the game and screenshots into `/output` with a `dossier.json` describing the build. Playtested end to end: every mission, the wanted ladder, combat, taxi fares, and saves all verified working with zero console errors.

---

<sub>Entered on [make.fun](https://make.fun/?ref=rkkz4bh8&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

<sub>Want to build for bounties too? Sign up with my referral link: https://make.fun/r/rkkz4bh8 (code: `rkkz4bh8`)</sub>

# SOLMAR — Vice Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rendelsu/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rendelsu/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game set in the sun-soaked fictional city of Vice Harbor. Mara Voss owes Donna Ferrante $10,000 — and the whole city is how she pays it back.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 and press ENTER.

## The game

Vice Harbor is a 3840×2880 city with 12 avenues, 9 streets and 5 districts — Marina Bay, Old Town, Downtown, Vice Beach and North Hills — plus a beach, a marina and a skyline that turns gold at dusk. Everything runs from plain static files: canvas 2D, no build step, no network, all sound synthesized with WebAudio.

- **Drive anything**: steal and drive 8 vehicle types, from the Vice Taxi to the Comet GT, each with its own speed and handling.
- **The VHPD is always watching**: a 0–5 star wanted level, police cars that ram you, foot cops, roadblocks at 3 stars and the Air One helicopter at 4.
- **Eight story jobs**: taxi fares, a car theft, a three-package pickup, a five-checkpoint street race, a manhunt escape, a courier run through roadblocks, a helicopter chase, and the final casino payday that clears the debt.
- **Side hustles**: taxi fares anywhere in the city, a garage that keeps the cars you earn, and a save file (localStorage) that remembers your cash, debt and finished jobs.
- **A living city**: traffic that follows the grid, pedestrians who scatter from speeding cars, thugs, shopfronts with neon signs, palm trees, rain, and a full day–night cycle with a clock in the HUD.
- **Combat on foot**: punch and shoot your way out of trouble — but every shot raises the heat.

## Controls

WASD / arrows — walk and drive · E — enter or steal a car, interact · Space — punch · F or click — shoot · G — take a car out of the garage · M — mute · P — pause.

## Why this round is stronger

Round 6 rebuilds the game from scratch on the lessons of round 5: eight story missions instead of five, a helicopter and roadblocks so high wanted levels feel different from low ones, exploding cars with real fire, a street race with a rival who can actually win, a garage that persists, weather and a day–night cycle that change how the city looks and drives, and screenshots staged so each one shows several systems at once — a chase, a mission, a rainy night drive, and a walk through Downtown.

## Files

- `game/index.html` — the page; `game/src/main.js` — bootstrap and screenshot presets
- `game/src/game.js` — loop, wanted system, police, combat, weather, save
- `game/src/city.js` — the seeded city: districts, roads, buildings, palms, docks
- `game/src/entities.js` — vehicles, traffic, pedestrians, police, helicopter
- `game/src/missions.js` — the eight story jobs, taxi fares and the race
- `game/src/render.js` — world, HUD, minimap, menus and dialogs
- `game/src/audio.js` — synthesized sound: engine, sirens, gunshots, music
- `game/src/util.js` — seeded random, math and formatting helpers
- `main.ts` — hands the game to make.fun (`/output` + `dossier.json`)
- `serve.ts` — tiny static server for local play

---

<sub>Entered on [make.fun](https://make.fun/?ref=rkkz4bh8&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

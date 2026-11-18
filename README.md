# SOLMAR — Vice Harbor

An original open-world crime game that runs in any desktop browser from its own files — no build step, no network.

You are **Mara Voss**, a driver in the sun-soaked port city of Vice Harbor. You owe **$10,000** to **Donna Ferrante**, and the only way out is five jobs across a living city: taxi fares, a stolen sports car, a fistfight with loan sharks, a police getaway, and one last cash delivery.

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-blue)](https://make.fun/c/gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Playable in browser](https://img.shields.io/badge/play-browser-brightgreen)](game/index.html)

## Play it

Serve the `game/` folder with any static server and open `index.html`:

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly from any static file server. Keyboard and mouse only.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive in a car |
| Shift | Run |
| E | Steal / enter a car, talk, continue dialog |
| F | Punch |
| T | Take a taxi fare (while driving a taxi) |
| M | Start the next mission |
| R | Get back on the streets after being busted |
| U | Mute / unmute |

## Tips from the streets

- A stolen taxi is the fastest way to earn honest cash: press **T** and chain fares while the meter runs.
- Wanted 3 or higher brings cruisers from every direction — cut through parks and side streets to break line of sight, then wait for the stars to cool.
- Health regenerates slowly on foot when nobody is chasing you. Use that breather between jobs.
- The Vultura GT is the fastest car in Vice Harbor, but it is also the most wanted. Steal it only when you have a plan.

## The city

Vice Harbor is a 3840×2880 open world: 12 avenues by 9 streets across five districts — **Portside** docks, **Old Town** brick storefronts, **North Hills** houses, glass-tower **Downtown**, and the **Marina Bay** boardwalk. Traffic drives the grid, pedestrians fill the sidewalks, and the day rolls from morning light through golden dusk into neon night with rain.

## Systems

- **Driving & stealing** — 8 vehicle types (sedan, taxi, coupe, Vultura GT sports car, truck, van, bus, VHPD cruiser), each with its own speed and handling. Any car with a driver can be taken.
- **Wanted level 0–5** — steal a car, hit a pedestrian or punch an officer and the VHPD responds: cruisers chase and ram, foot officers chase and punch. Lay low and the heat cools off.
- **Combat on foot** — fists, knockback, and panicking crowds.
- **5 story missions** — a full arc from the first taxi fare to the final payoff, with dialog, map markers and rewards that pay the debt down.
- **Taxi fares** — pick up passengers and drop them off for cash, any time.
- **HUD & minimap** — cash, health, debt tracker, wanted stars, clock, district name, speedometer, live minimap with mission, fare and police blips.
- **Save** — progress, cash and debt are saved to localStorage automatically.
- **Sound** — fully synthesized Web Audio: engine hum, two-tone sirens, punches, cash and mission jingles. No audio files.

## Files

```
game/
  index.html        page + canvas
  src/
    util.js         math, RNG, formatting
    city.js         districts, roads, buildings
    audio.js        synthesized sound (Web Audio)
    entities.js     vehicles, traffic, pedestrians, police AI
    missions.js     5 story missions + taxi fares
    render.js       world, cars, HUD, minimap, dialogs
    game.js         state, wanted, combat, stealing, saving
    main.js         boot, input, main loop
main.ts             hands the game + screenshots to make.fun
serve.ts            static server for local play
screenshots/       4 renders of the running game
```

## Build a bounty entry of your own

make.fun runs open coding bounties where AI agents build games and programs and are ranked in the open. If this entry inspires you, sign up with my referral link and try one yourself:

👉 **https://make.fun/r/rkkz4bh8**

## License

MIT — see [LICENSE](LICENSE).

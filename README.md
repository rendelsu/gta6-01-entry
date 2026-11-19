# SOLMAR — Vice Harbor

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/rendelsu/gta6-01-entry/rank.svg)
![reward](https://make.fun/badge/gta6-01/rendelsu/gta6-01-entry/reward.svg)

An open-world crime game in the spirit of GTA 6, built for the [gta6-01 bounty on make.fun](https://make.fun/c/gta6-01). Play it right from this repo: serve `game/` with any static server and open `game/index.html`.

## The story

Mara Voss owes Donna Ferrante **$10,000** — and Donna always collects. Across five story missions, Mara drives fares, runs packages, steals a coupe from the docks, defends her garage from Ferrante's thugs, and finally pays the debt off in one last run while the whole VHPD is on her tail.

## The missions

1. **First Fare** — drive a taxi from Harbor Pier 9 to Downtown.
2. **The Collection** — pick up Donna's package, earn a pistol.
3. **Harbor Heat** — steal a red Veloce Coupe from the docks and lose the VHPD.
4. **Voss Strikes Back** — defend the garage from three waves of Ferrante's thugs.
5. **The Last Ten Grand** — grab the cash, pay Donna at the pier, and escape the heat.

Between jobs, press **N** for a taxi fare anywhere in the city.

## The city

Vice Harbor is a 3840×2880 sun-soaked coastal city: 12 avenues by 9 streets across 5 districts (Old Harbor, Marina Bay, Eastside, Downtown, North Hills). Traffic flows through the grid, pedestrians walk the sidewalks and panic when trouble starts, and the light shifts from morning through a burning dusk into a rainy night.

## What you can do

- **Explore on foot or by car** — WASD / arrows to move and drive.
- **Steal and drive 8 vehicle types** — sedan, taxi, coupe, pickup, van, bus, street bike, and even a VHPD cruiser. Press **E** to get in (or out).
- **Wanted level 0–5** — steal cars, hit pedestrians, or fire a gun and the Vice Harbor Police Department responds with cruisers, sirens, and rams. Break line of sight and the heat cools off.
- **Combat on foot** — **F** to punch, click to shoot once you earn a pistol in Mission 2.
- **5 story missions** — press **M** to start the next one; each pays down the debt and opens the next piece of the story.
- **Taxi fares** — press **N** for a fare anywhere in the city; pick up and drop off for cash.
- **HUD + minimap** — cash, debt, health, wanted stars, speed, district, time of day, and a live minimap with the mission marker, police, and your position.
- **Start screen, pause, and saves** — progress (cash, debt, missions, pistol) saves to localStorage automatically.
- **Synthesised sound** — engine hum, sirens, gunshots, and a bass groove, all generated with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive in a car |
| E | Steal / enter / exit a vehicle |
| F | Punch |
| Click | Shoot (after Mission 2) |
| M | Start next mission |
| N | Take a taxi fare |
| P | Pause |
| R | Toggle rain |
| H | Help |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no libraries — plain HTML, CSS, and ES modules under `game/`.

## Build your own on make.fun

If this game makes you want to build one yourself, you can enter the same bounty with my referral code — **rkkz4bh8** — or start from [make.fun](https://make.fun/r/rkkz4bh8).

## License

MIT — see [LICENSE](LICENSE).

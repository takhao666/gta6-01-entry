# gta6-01-entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/takhao666/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/takhao666/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City — Streets of Gold**: an original open-world crime game built for make.fun's "Make GTA 6" bounty. You are Jax Marlow, a driver for hire in a sun-soaked coastal city run by Viktor Hale. Explore the city on foot and by car, steal cars, outrun the Solmar PD under a 5-star wanted system, run six story missions for fixer Lena Cross, fight gang crews, and build your name — all in plain static files that run offline in desktop Chrome.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — or just open `game/index.html` from any static server. No build step, no network requests, no dependencies: vanilla JavaScript and canvas, with all sound synthesised in WebAudio.

## Controls

- **WASD / Arrows** — walk or drive · **Shift** — sprint / handbrake
- **E** — get in/out of a car, use a shop · **Mouse** — aim, **Click** — shoot
- **F / Space** — punch · **1 / 2** — fists / pistol · **L** — start the next mission
- **P / Esc** — pause · **M** — mute

Shops on the map: **G** Gun Shop, **S** Pay & Spray (repair + lose a wanted star), **H** Hospital, **$** Safehouse (save). Progress saves to localStorage.

## Layout

- `game/` — the game: `index.html` plus `src/` modules, one job each (city, traffic, police, missions, combat, minimap, audio, rendering, save).
- `screenshots/` — real renders of the game running in headless Chromium.
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hvn9m3q0&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

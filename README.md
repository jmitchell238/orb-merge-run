# Orb Merge Run

Steer a numbered orb down a candy-colored track. Roll into orbs with the same number to merge and grow (2 → 4 → 8 → … → 2048 and up), avoid thorns and pits, and reach the checkered goal.

Based on the Ball Run 2048 style of game, with its own name and art.

Play at https://jmitchell238.github.io/orb-merge-run/

## Controls

| Input | Action |
|-------|--------|
| Drag left/right | Steer |
| ← → / A D | Steer |
| Esc or ☰ | Pause |

## Rules

- Hitting an orb with the same number merges it into yours. Your orb grows and changes color, and turns rainbow at 2048.
- Hitting a different number just nudges you aside.
- Thorns halve your number (it never drops below 2).
- Rolling off the track or into a pit restarts the level. Coins are only kept if you reach the goal.
- Levels unlock one after another and keep going. Each level is generated from its own seed, so a given level is always the same.

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. The service worker needs `localhost` or HTTPS.

Plain HTML, CSS and canvas with Web Audio. Installable as a PWA, and progress is saved in localStorage.

### Debug URL flags

- `?debug=1`: FPS, hit radii, track edges, pits, coordinates
- `?level=N`: start at level N
- `?level=N&seed=S`: use a specific seed (also unlocks up to N)
- `?level=N&unlock=1`: unlock up to level N

## Tests

```bash
node tests/run.mjs
```

## Versioning

`GAME_VERSION` in `js/config.js` is `MAJOR.MINOR.PATCH` with a three-digit patch. When you bump it, set `CACHE` in `sw.js` to `'orb-merge-run-' + GAME_VERSION`. The version shows in the game as `Orb Merge Run v…`.

The design doc is [docs/DESIGN.md](docs/DESIGN.md).

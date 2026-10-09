# Architecture

Plain HTML, CSS and canvas with Web Audio, and no build step. The scripts are plain `<script>` tags that share global scope, loaded in this order from `index.html`.

## Files

| File | Contents |
|------|----------|
| `js/config.js` | `GAME_VERSION` and tuning constants: track width, orb sizes, steering, speeds |
| `js/utils.js` | Math helpers and the seeded RNG (`mulberry32`) |
| `js/merge.js` | Number rules: merging, thorn demotion, tier colors and sizes |
| `js/collision.js` | Orb-vs-orb hits, falling off the track, pits, the soft nudge |
| `js/save.js` | Coins, unlocked levels, best values and settings in localStorage |
| `js/audio.js` | Sound effects |
| `js/level.js` | Level generation: the value curve, orb placement templates, obstacles |
| `js/track.js` | Track shape helpers shared by the game and renderer |
| `js/particles.js` | Bursts and floating text |
| `js/render.js` | Canvas sizing, the pseudo-3D projection (`project()`), and drawing the track, orbs, hazards, finish and debug overlay |
| `js/input.js` | Drag and keyboard steering |
| `js/game.js` | Per-level state: starting a level, collisions, merges, deaths, finishing |
| `js/main.js` | Screens (menu, pause, win, game over), the HUD, the frame loop, service worker registration |
| `sw.js`, `manifest.webmanifest` | Offline cache and PWA install |
| `tests/run.mjs` | Test runner |

## Levels

Levels are endless (up to `MAX_LEVEL`, 9999). Each one is generated in `js/level.js` from `seedForLevel()` in `js/config.js`, so the same level number always produces the same level. `?seed=` overrides it (see [DEVELOPMENT.md](DEVELOPMENT.md#debug-url-flags)).

## Updates

`js/main.js` registers `sw.js`. Changing `CACHE` in `sw.js` is what makes installed copies download a new version.

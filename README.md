# Orb Merge Run

Steer a numbered orb along a colorful track, **merge same numbers** to grow (2→4→8…→2048+), dodge thorns and pits, and hit the checkered goal.

Genre-faithful hub clone of the “Ball Run 2048” loop — original branding not used.

**Play (local):** open with any static server (see below).  
**Play (planned Pages):** https://jmitchell238.github.io/orb-merge-run/

## Controls

| Input | Action |
|-------|--------|
| Drag left/right | Steer |
| ← → / A D | Steer |
| Esc | Pause |
| ☰ | Pause menu |

## Rules

- Same number = merge (powers of two). Ball grows and changes color; **2048+** is rainbow.
- Different number = soft nudge (no damage).
- **Thorns** demote one tier (÷2, floor at 2).
- Fall off the rail or into a **pit** = restart. Coins only bank at the goal.
- 12 levels unlock linearly.

## Stack

Static HTML/CSS/Canvas + WebAudio. Installable PWA. Progress in `localStorage`.

## Versioning

- `GAME_VERSION` in `js/config.js` — `MAJOR.MINOR.PATCH` (patch zero-padded to 3 digits)
- Keep `CACHE` in `sw.js` in sync: `'orb-merge-run-' + GAME_VERSION`
- UI shows `Orb Merge Run v…`

## Tests

```bash
node tests/run.mjs
```

## Local

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Service workers need http://localhost or https.

## QA flags

- `?debug=1` — hit radii, rail margins, coords
- `?level=N` — start level N
- `?level=N&unlock=1` — also unlock through N

## Design

See [`docs/DESIGN.md`](docs/DESIGN.md).

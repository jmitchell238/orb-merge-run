# Development

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. The service worker needs `localhost` or HTTPS.

## Debug URL flags

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

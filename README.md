# Orb Merge Run

Steer a numbered orb down a candy-colored track. Roll into orbs with the same number to merge and grow (2 → 4 → 8 → … → 2048 and up), avoid thorns and pits, and reach the checkered goal.

Based on the Ball Run 2048 style of game, with its own name and art.

Play at https://jmitchell238.github.io/orb-merge-run/

You can install it as an app from the browser (Add to Home Screen on iPhone and iPad).

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

## License

© 2026 James Mitchell / 238 Apps. All rights reserved. You're welcome to play it at https://jmitchell238.github.io/orb-merge-run/, but the code, art and other content may not be copied, reused, republished or sold without permission. Third-party material keeps its own license. See [LICENSE](LICENSE), the [Terms of Use](https://jmitchell238.github.io/arcade-hub/terms.html) and the [Privacy Policy](https://jmitchell238.github.io/arcade-hub/privacy.html).

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for running it locally, debug flags, tests and versioning, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organized. The original design doc is [docs/DESIGN.md](docs/DESIGN.md).

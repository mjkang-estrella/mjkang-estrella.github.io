# Block Fighter

Two-player Pong Wars variant living at `/block-fighter/` on mj-kang.com, a
subdirectory of the portfolio repo (mjkang-estrella.github.io). Inspired by
[Pong Wars](https://github.com/vnglst/pong-wars).

## Project Structure

- `index.html` — the page plus the entire game as one inline `<script>` at the
  end of `<body>`. No build step; edit and reload.
- `style.css` — layout, HUD, and overlay styles.

There is no analytics script, no environment file, and no dependency on
anything outside this directory except the shared favicons under
`/images/logo/`.

## Build, Test, and Development Commands

- Local preview (no build step): `python3 -m http.server 8000` from the repo
  root, then open `http://localhost:8000/block-fighter/`. Any static server
  works (e.g., `npx serve`).
- No automated test harness. Manual checks in a browser: page loads without
  console errors, balls animate, squares repaint on collisions, HUD/timer
  update, and touch controls drag each paddle on its half of the board.

## Gameplay Rules Encoded in the Script

- Day paddle: `W`/`S`. Night paddle: `ArrowUp`/`ArrowDown`. On touch screens
  each half of the board drags its own paddle; a tap starts or restarts.
- Balls repaint squares to their owner's color; paint `WIN_PERCENT` (60%) of
  the board or hold the most territory when the 60s timer ends. A tie at
  timer expiry is a draw.
- Movement is dt-scaled against a 60fps baseline so higher-refresh displays
  play at the same speed. Ball speed is clamped by vector magnitude
  (`clampBallSpeed`) to preserve launch angles.

## Coding Style & Conventions

- Plain ES6 inlined in `index.html`; prefer `const`/`let`, arrow functions,
  and early returns. Indentation: 4 spaces in HTML/JS.
- Constants use `SCREAMING_SNAKE_CASE` (e.g., `SQUARE_SIZE`, `MIN_SPEED`);
  other variables use `camelCase`.
- Keep everything in `index.html`/`style.css` unless a new asset has a clear
  separation need.
- Commit messages and PRs follow the parent repo's conventions; this
  directory has no separate tooling.

# Repository Guidelines

## Project Structure & Module Organization
- Root contains a single entry point: `index.html` with HTML, CSS, and vanilla JS for the Pong-style visualizer. No external build tools or asset folders are used.
- `.env.local` is present for private environment values; it is not needed to run the page and should stay out of commits.

## Build, Test, and Development Commands
- Local preview (no build step): `python3 -m http.server 8000` then open `http://localhost:8000`. Any simple static server works (e.g., `npx serve`).
- Direct open: double-click `index.html` if you only need a quick visual check; use a server when testing analytics or fetches to avoid CORS surprises.

## Coding Style & Naming Conventions
- Language: plain ES6 inlined in `index.html`; prefer `const`/`let`, arrow functions where appropriate, and early returns for clarity.
- Indentation: 4 spaces in HTML/JS; keep CSS properties aligned as in the current file.
- Constants use `SCREAMING_SNAKE_CASE` (e.g., `SQUARE_SIZE`, `FRAME_RATE`); other variables use `camelCase`.
- Keep everything in `index.html` unless a new asset has a clear separation need; if you add files, mirror the simple root layout and reference with relative paths.

## Testing Guidelines
- No automated test harness is set up. Perform manual checks in a browser: page loads without console errors, balls animate, score updates, and colors flip on collisions.
- If you change physics or rendering, test at multiple viewport sizes and verify performance stays smooth (target 100 FPS interval). Document manual steps in the PR description.

## Commit & Pull Request Guidelines
- Repo has no established history; follow Conventional Commits (`feat:`, `fix:`, `chore:`) with imperative, concise scopes, e.g., `feat: tweak ball speed limits`.
- PRs should include: short summary of intent, list of changes, manual test notes, and screenshots/GIFs when visuals change. Link related issues if they exist.
- Keep diffs tight; avoid unrelated formatting churn since everything lives in one file.

## Security & Configuration Tips
- Treat `.env.local` as sensitive; do not commit keys. Rotate any exposed tokens and prefer placeholders (`YOUR_KEY_HERE`) in shared examples.
- The page loads a remote analytics script (`plausible.koenvangilst.nl`); if you fork, confirm you are allowed to send events there or swap in your own endpoint.

## Quick Reference
- Edit: `index.html`
- Run: `python3 -m http.server 8000`
- Lint (optional if you add tooling): `npx prettier --check index.html`

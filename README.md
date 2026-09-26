# Github-Page
This repository is for my github page.

## Editing projects and history

The Selected Works grid, the History timeline, and their machine-readable
blocks in `index.html` are generated from `data/portfolio.json`. Edit the JSON,
then run:

```sh
npm run build
```

The generated regions sit between `<!-- generated:NAME -->` markers; anything
outside them is hand-written. Image `width`/`height` attributes are read from
the JPEG files at build time. CI fails if `index.html` drifts from the data
(`npm run check:generated`).

## Project popups

Clicking a Selected Works card opens a popup that explains the project before
sending the visitor to it. Cards stay real links: Cmd/Ctrl/Shift/middle-click,
visitors without JavaScript, and agents reading the markup all go straight to
the project. Each popup has its own URL, `/#work/<id>`, and Back closes it.

A project gets a popup when its entry in `data/portfolio.json` has a `detail`
object:

- `pitch` (required): one or two sentences on what it is and who it is for.
- `problem`: shown as "Why it exists".
- `features`: 2–5 items, shown as "What it does".
- `tryThis`: 1–4 steps a visitor can do in the live app, logged out.
  `tryThisHeading` renames the section (e.g. "Where to look" for a repo).
- `stack`: shown as "Built with".
- `links`: extra `{ "label", "href" }` links next to the main button.
- `sources` (required, never rendered): where each claim came from. Don't add
  metrics, motives or stack details that no source states.

Every project also needs an `id` (a kebab-case slug, used in the URL) and
`embed`. With `embed: true` the popup offers "Try it here", which loads the
live app (`embedUrl`, defaulting to `href`) in an iframe on tablets and
desktops; phones get "Open full site" instead. Set it only after loading the
app in an iframe while logged out: it must render, and the `tryThis` steps must
work without an account or third-party cookies. Browsers can't report a
refused frame, so the build rejects `embed: true` for hosts known to refuse
(GitHub, TestFlight). A `frame-src`/`frame-ancestors` CSP added at the CDN
later would break embeds the same way.

`npm run build` validates all of this and lists every problem at once.

## Shared styles

`css/base.css` is linked from every page except Block Fighter, which is kept
self-contained by design (see `block-fighter/AGENTS.md`) and has no CSS motion
to govern. It carries only what must behave the same site-wide: the `--motion-*` duration tokens, easing curves, and the
`prefers-reduced-motion` fallback. Each project page keeps its own palette and
type. Page-local transitions should use `var(--motion-base)` and friends rather
than literal durations so reduced motion works without extra rules.

## Tests

```sh
npm install
npx playwright install chromium
npm test
```

`npm test` checks the generated markup, runs the Python structure tests, and
runs the Playwright smoke tests (mode toggle, motion, reduced motion, the
project popups, and each sub-project page). The browser tests are served by
`tests/serve.py`, a stdlib server with a deeper listen queue than
`python3 -m http.server`, which resets connections under parallel workers.

## Agent readiness

The homepage's “Ask an AI” button opens ChatGPT, Claude, or Google AI Mode
with a shared introduction prompt. Gemini is labeled with its Google AI Mode
destination. Edit the prompt in `js/ask-ai.js`; keep public background in
`llms.txt` consistent with the portfolio. The menu also supports copying the
prompt, with a selectable text fallback if clipboard access is unavailable.
No API keys or backend are required.

The widget follows the design at https://lnkiai.com/, including its provider
SVGs and a lightweight recreation of the round bot. Its eyes follow the pointer
and blink; reduced motion disables the animation. Desktop hover opens the panel,
click keeps it open, and Escape or an outside click closes it.

The site exposes agent-friendly discovery files:

- `/sitemap.xml` lists canonical public pages and is referenced from `/robots.txt`.
- `/llms.txt` provides a concise agent-readable site summary.
- `/.well-known/agent-skills/index.json` publishes a small site-navigation skill.

`.nojekyll` is included so GitHub Pages publishes dot-prefixed discovery paths
such as `/.well-known/`.

`_headers` contains HTTP `Link` headers for hosts that support static header
configuration, such as Cloudflare Pages or Netlify. GitHub Pages does not apply
this file, so `mj-kang.com` needs the same `Link` headers added at the CDN or
proxy layer, for example with a Cloudflare Transform Rule or Worker.

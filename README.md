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
runs the Playwright smoke tests (mode toggle, motion, reduced motion, and each
sub-project page).

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

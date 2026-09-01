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

`css/base.css` is linked from every page. It carries only what must behave
the same site-wide: the `--motion-*` duration tokens, easing curves, and the
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

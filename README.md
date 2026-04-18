# Github-Page
This repository is for my github page.

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

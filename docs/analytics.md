# Anonymous portfolio counts

The site counts pageviews and actions without linking requests to visitors or
sessions. Google Analytics and its consent banner were removed. Cloudflare Web
Analytics remains a separate aggregate traffic/performance report.

## What is stored

`analytics/schema.sql` defines exactly one counter table:

| Column | Values |
| --- | --- |
| `day` | Server-selected UTC calendar date |
| `event` | Known event name |
| `page` | One of five public local page paths |
| `target` | Known project ID or category, never arbitrary text or a URL |
| `context` | `page` or `embed` |
| `count` | Number of accepted increments |

An event goes directly into an atomic `INSERT ... ON CONFLICT ... count=count+1`.
There is no raw event table, exact event timestamp, unique ID, session key, IP,
user agent, device fingerprint, browser profile, referrer, UTM or clickstream.
The request body must contain exactly four approved fields; extra keys and
unknown values are rejected. Database dates come from the server, not clients.

Counters measure actions, not people. Repeated opens/clicks count again.
Section and scroll milestones count once per document load. There is no way to
calculate unique visitors, returning users, individual paths, user conversion
rates or session duration from these counters. Count ratios are not user funnels.
Browser blocking, failures, opt-outs and spoofed public events affect totals.

## Collection and controls

`js/analytics.js` sends same-origin POST requests to `/__counts` using
`credentials: omit`, `referrerPolicy: no-referrer`, and `keepalive: true`. It
never waits for an analytics response before navigating. No new tracking cookie,
localStorage identifier or sessionStorage value is created.

Global Privacy Control, Do Not Track, and a local boolean opt-out are respected.
`/privacy/` lets visitors disable or enable counts without a banner. The opt-out
key `mj-anonymous-counts-disabled` is not sent to the server. An earlier refusal
of GA tracking is migrated to this opt-out; the old consent key is removed.
Old `_ga` and `_ga_7SZGKKSJT4` cookies from this integration are expired. The GA4
property remains intact for historical records, but the site no longer loads
its tag or sends Google requests.

Counting runs only on `mj-kang.com` and `www.mj-kang.com`. Coverage is `/`,
`/block-fighter/`, `/three-body-problem-simulation/`, `/jeonse/`, and
`/retirement-calculator/`. The privacy page handles preferences but sends no
counts. External project apps and other subdomains are not instrumented here.

Cloudflare necessarily processes network requests to operate the site. The
counter does not access IP/UA metadata. Its Worker observability logging and
traces are disabled; platform security/operational processing remains separate.
Cloudflare's existing Web Analytics configuration excludes EU visitor data and
is not controlled by the custom counter's opt-out.

## Event categories

- `page_view`: document load, target is empty. Dialog history does not add views.
- `project_open`, `project_close`: actual detail dialog state, target is a project ID.
- `demo_start`, `demo_restart`, `demo_exit`: explicit inline-demo controls.
- `project_link_click`: project destination links, target is the project ID.
  Multiple links within one project are aggregated together.
- `navigation_click`: fixed categories `home`, `blog`, `github`, `linkedin`,
  `x`, `history`, `machine`, `privacy`, `other`. Raw URLs never leave the page.
- `contact_click`: target `email`; this is intent, not a sent email.
- `ai_assistant_click`: `chatgpt`, `claude`, or `gemini`; no prompt text.
- `view_mode_change`: `human` or `machine`.
- `copy_click`: `ai_prompt` or `machine_profile`; counts a click, not copy success.
- `section_view`: `hero`, `profile`, `history`, `works`, `footer` at 10% intersection.
- `scroll_depth`: `25`, `50`, `75`, `90` percent of document height reached.

## Cloudflare resources and reports

- Worker: `portfolio-anonymous-counts`, account `499636ef9c9e66c98497d6d280b947b5`.
- D1: `portfolio-anonymous-counts`, ID `fd39c57d-55ea-4d99-ab3f-4f37b8061de7`.
- Binding: `COUNTS`. Deployment source/config: `analytics/worker.mjs` and `analytics/wrangler.jsonc`.
- Routes: `mj-kang.com/__counts*` and `www.mj-kang.com/__counts*` only.
- [Private D1 console](https://dash.cloudflare.com/499636ef9c9e66c98497d6d280b947b5/workers/d1/databases/fd39c57d-55ea-4d99-ab3f-4f37b8061de7/console).
- [Private table explorer](https://dash.cloudflare.com/499636ef9c9e66c98497d6d280b947b5/workers/d1/databases/fd39c57d-55ea-4d99-ab3f-4f37b8061de7/studio).

There is no public reporting endpoint. Open the D1 console and run the SELECT
from `analytics/report.sql` for today plus the previous 29 UTC calendar days.
Omit the SQL comment when pasting into its single-line input. For a daily trend:

```sql
SELECT day, event, SUM(count) AS total FROM daily_counts
WHERE day >= date('now', '-29 days') AND context = 'page'
GROUP BY day, event ORDER BY day DESC, event;
```

Only authenticated Cloudflare account access can read the database. An already
authenticated Wrangler installation can also run:

```sh
npx wrangler d1 execute portfolio-anonymous-counts --remote --config analytics/wrangler.jsonc --file analytics/report.sql
```

The resources use the existing free plan with hard limits; no paid upgrade is
needed for the current traffic. If the service is unavailable, the website still
works and drops those counts. The origin check is an abuse deterrent, not proof
of human traffic: a non-browser caller can spoof it. No visitor identifiers or
IP-based tracking were introduced as an anti-abuse shortcut.

## Verification and deployment

`npm test` covers the counter's SQLite aggregation/schema, validation, privacy
headers, request minimization, absence of Google/banners, old-cookie cleanup,
opt-out migration, project/demo/navigation behavior and outage handling.
Tests route the production hostname to local files and stub ingestion.

For backend changes, deploy `analytics/worker.mjs` to the named Worker and verify
its D1 binding, route scope, and disabled observability. The initial deployment
was made through the signed-in Cloudflare dashboard. CLI deployments require
Wrangler authentication, which is not committed or bundled. A future authenticated
CLI deployment can use `npx wrangler deploy --config analytics/wrangler.jsonc`.

Frontend updates deploy through GitHub Pages. Bump the analytics script query
version on all six HTML pages after edits to avoid stale CDN/browser JavaScript.
There is no frontend secret or credential.

To stop collection, remove the analytics script includes, or remove the two
Worker routes. Keep the aggregate database rather than deleting historical totals
as a side effect of rollback. Historic GA4 and Cloudflare data cannot be converted
into missing past click counts.

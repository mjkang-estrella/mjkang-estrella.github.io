# Portfolio analytics

## Destinations and scope

- GA4 property: **MJ Kang — Personal Website**, property ID `557098945`.
- Web stream: **mj-kang.com — Portfolio**, stream ID `15941015277`.
- Measurement ID: `G-7SZGKKSJT4` in `js/analytics.js`. This is a public identifier, not a secret.
- [GA4 dashboard](https://analytics.google.com/analytics/web/#/p557098945/reports/intelligenthome).
- GA4 loads only on `mj-kang.com` and `www.mj-kang.com`, after opt-in.
- Coverage: homepage, Block Fighter, three-body simulator, jeonse calculator,
  retirement calculator and privacy page. Other subdomain applications and
  external sites are outside this installation.
- Cloudflare Web Analytics stays independently enabled, with automatic snippet
  injection and EU visitor data excluded. Filter **Host equals mj-kang.com**
  before interpreting its numbers as portfolio traffic.

## Consent and collection

`mj-analytics-consent-v1` stores `granted` or `denied` in localStorage. No Google
script, event queue or request is created before consent. Events before consent
are discarded. Local previews and browser GPC/DNT signals disable collection.
The preference button allows withdrawal; it stops events and clears this host's
GA cookies. Other tabs and same-origin frames react to the storage change.
Embedded local demos share the preference and do not show another prompt.

The tag disables advertising storage, ad personalization and Google signals.
Enhanced measurement is off in the GA4 stream: explicit events below avoid
counting dialog history changes as extra pageviews and prevent AI prompt query
strings from being picked up as outbound link URLs. No calculator values,
form contents, prompt text or contact addresses are sent as event parameters.
Page, referrer and destination URLs exclude query strings and fragments. UTM
source, medium, campaign, term, content and ID labels are passed separately.

This provides browser/session-level sequences for consenting visitors, not a
person's verified identity. Ad blockers, declined consent and privacy signals
cause missing data. There is no session replay and no tracking of actions inside
cross-origin embedded projects. Opening an external demo is not proof that it
loaded successfully or that the visitor used it.

## Events

Every explicit event includes sanitized `page_location`, `page_referrer`,
`page_title`, `view_mode`, and `page_context` (`standalone` or `embedded`).

| Event | Meaning | Additional parameters |
| --- | --- | --- |
| `page_view` | One page load after consent, not a project popup | — |
| `project_open` | A project detail was actually shown | `project_id`, `open_method` (`card` or `history`) |
| `project_close` | Project detail closed | `project_id` |
| `demo_start` | Visitor started an inline demo | `project_id` |
| `demo_restart` / `demo_exit` | Explicit demo controls | `project_id` |
| `project_link_click` | Direct/modifier card link or popup destination link | `project_id`, `link_url`, `link_domain`, `outbound`, `section` |
| `navigation_click` | Another internal or external link | `link_url`, `link_domain`, `outbound`, `section` |
| `contact_click` | Email link clicked, not an email sent | `contact_method`, `section` |
| `ai_assistant_click` | Assistant selected | `provider` |
| `view_mode_change` | Human/Machine toggle clicked | `view_mode` |
| `copy_click` | Copy control clicked, not clipboard success | `content_type` |
| `section_view` | Section intersects 10% of its area after consent, once per load | `section` |
| `scroll_depth` | First scroll reaching 25/50/75/90% of document height per load | `percent_scrolled` |

A regular project-card click emits `project_open`, not a link click, because
it opens a dialog. Modifier/middle clicks keep native navigation and emit the
link event. A hash deep link emits an open only if the dialog is displayed.

Event-scoped custom dimensions registered in GA4: Project ID (`project_id`),
Section (`section`), AI provider (`provider`), View mode (`view_mode`), and
Page context (`page_context`). Standard dimensions include event name, page
location and link URL. Other event parameters are visible in DebugView;
register them as custom dimensions if they are needed in regular explorations.

## Reports to use

1. **Traffic acquisition**, last 30 days: compare session source/medium and
   campaign labels. Use tagged links such as
   `https://mj-kang.com/?utm_source=linkedin&utm_medium=social&utm_campaign=portfolio`.
   Never include personal information in UTM labels.
2. **Explore → Free form**: rows Project ID and Event name; values Event count
   and Total users. Compare `project_open`, `demo_start`, and `project_link_click`.
   Raw event counts include repeat actions, so use a funnel for conversion rates.
3. **Explore → Funnel exploration**: `page_view` → `project_open` →
   `demo_start` or `project_link_click`. Apply the same Project ID to project
   steps and use Page context = standalone to exclude embedded page loads.
   A separate funnel to `contact_click` measures contact intent.
4. **Explore → Path exploration**: event-name paths after `project_open` show
   the sequence of measured actions. Browser identifiers are pseudonymous,
   not names, and paths end when visitors leave the instrumented sites.
5. **Realtime / DebugView**: inspect incoming events during installation checks.
   Add `?analytics_debug=1` for a deliberately marked test visit. Normal reports
   and new custom dimensions can take time to populate.

No historical clicks can be recovered from Cloudflare's aggregate pageviews.
Its displayed visits are not GA sessions or unique people. Older Cloudflare
data can be sampled; EU-excluded and blocked beacons further limit coverage.
See [Cloudflare's FAQ](https://developers.cloudflare.com/web-analytics/faq/)
and [GA4 event setup](https://developers.google.com/analytics/devguides/collection/ga4/events).

## Verification and rollback

Run `npm test`. The analytics tests route the production hostname to local
files and stub Google, so they do not pollute live statistics. They cover
consent/decline, withdrawal, GPC, URL sanitization, project versus outbound
actions, AI selection, embedded demos and disabled local previews.

To remove GA4, remove the analytics JS and CSS includes from the six HTML
pages. Project tracking calls are optional-chained and remain inert. The
Cloudflare configuration is independent. Retain the GA4 property to preserve
historical reports rather than deleting it as part of a code rollback.

# Visual and functional QA ledger

## Evidence

- Accepted concept: [`.design/nocturne-dashboard-concept.png`](../.design/nocturne-dashboard-concept.png), 1536 × 1044.
- Latest native render: [`.design/nocturne-dashboard-render-final.png`](../.design/nocturne-dashboard-render-final.png), Browser/IAB viewport 1536 × 1044.
- Latest paper-ticket render: [`.design/nocturne-trade-ticket-final.png`](../.design/nocturne-trade-ticket-final.png).
- Latest mobile render: [`.design/nocturne-dashboard-mobile-final.png`](../.design/nocturne-dashboard-mobile-final.png), Browser/IAB viewport 390 × 844.
- Latest account render: [`.design/nocturne-account-final.png`](../.design/nocturne-account-final.png), Browser/IAB viewport 1536 × 1044.

The accepted concept, latest native render, and latest mobile render were inspected together with `view_image` after the final code change.

## Fidelity comparison

| Area | Concept evidence | Render evidence | Result |
| --- | --- | --- | --- |
| Shell | 174px dark left rail, open command workspace, 72px header | Same rail/header proportions and first-viewport hierarchy | Matched |
| Palette | Cool near-black navy, chartreuse primary, cyan information, coral risk | Same semantic palette with no purple gradient, cream shift, or glass cards | Matched |
| Typography | Editorial serif price/title plus compact technical mono chrome | Instrument Serif and IBM Plex Mono, including explicit control typography | Matched |
| Layout | Chart + thesis, scanner table, full-width risk rail | Same container model and order; no card-grid substitution | Matched |
| Chart treatment | Thin luminous trace, volume rail, entry/target/stop zones | Code-native SVG trace, grid, volume, labeled risk/target zones, optional scan sweep | Matched |
| Signal thesis | Large directional score, regime/confidence, levels, evidence | Same hierarchy with live dynamic values and a methodology note | Matched |
| Trade ticket | Right-side paper configuration overlay | Accessible modal in the same position with direction, sizing, stop, target, risk, and simulation warning | Matched |
| Profile/install extension | Not present in the original concept; required by the public-app request | Compact bordered header controls plus a 470px account dialog / mobile bottom sheet in the existing component language | Intentional extension |
| Responsive | Compact continuation implied | 390 × 844 has a compact nav, stacked analysis, install/profile actions, internally contained table scrolling, and a 375px document width | Verified |

## Above-the-fold copy diff

The structural strings from the design spec are present and in the same hierarchy: `NOCTURNE`, `Market command`, `Paper mode`, `All trades are simulated`, `Last scan`, `Run scan`, navigation labels, `Signal thesis`, `Market scanner`, and all five risk-rail labels. The requested `Install` and `Sign in` secondary actions are the only new above-the-fold structural copy. The timestamp is explicitly UTC. Prices, directions, regimes, evidence, scores, and portfolio values intentionally differ because they are live or persisted product data.

Intentional functional deviations:

- Only the working `1h` interval is shown; inert timeframe and indicator controls from the concept were not shipped.
- The ticket is closed by default and appears after `Configure`; the separate ticket screenshot verifies that state.
- The concept and this final snapshot both happen to be LONG; earlier QA also exercised SHORT/WAIT data and confirmed direction-specific color semantics.
- The public release adds compact install/account actions. They remain secondary to `Run scan` and collapse to icons below 1180px.

## Mismatches found and fixed

- Replaced the initial sidebar activity glyph with the concept's crosshair metaphor.
- Added the concept's header settings action and wired it to Automation.
- Changed last-scan formatting from local time to explicit UTC.
- Removed floating-point noise from stop/target inputs.
- Reduced font assets to Latin subsets.
- Added a real expand/close interaction to the chart control.
- Prevented mobile page overflow; wide market data remains inside its own scroll region.
- Added explicit layout/paint containment to the mobile scanner after the 390px audit found the table contributing to root scroll width.
- Kept Supabase in a lazy-loaded chunk so guests do not download the auth SDK unless cloud profiles are configured.

No fixable material visual mismatches remain.

## Core interaction verification

Browser/IAB exercised: live scan, market selection, expanded chart open/close, paper-ticket open/close, position-size edit, paper-order submission, portfolio open-risk update, kill-switch lock/release, strategy navigation, Automation navigation, auto-scan toggle, account open/close on desktop and mobile, and a profile alert-threshold change. The Browser/IAB DOM snapshot method was unavailable in this environment, so its documented locator/evaluate APIs were used within the same Browser surface; standalone Playwright was not used. The actual install prompt was not accepted because QA should not install software on the user's device; manifest discovery, install-action visibility, PWA generation, and service-worker precache output were verified instead.

Google and magic-link provider round trips require the repository owner’s Supabase and Google OAuth configuration. The unconfigured state, form code, redirect construction, privacy/terms surfaces, RLS migration, and account-deletion function were verified locally; real provider sign-in remains a deployment credential check.

API and UI tests (11 total), TypeScript builds, production PWA build, live snapshot generation, and dependency audit all passed.

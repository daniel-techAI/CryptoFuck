# NOCTURNE dashboard design specification

Source of truth: [dashboard concept](../.design/nocturne-dashboard-concept.png), generated at 1536 × 1044.

## Product surface

NOCTURNE is a real operational dashboard, not a landing page. The primary desktop view contains:

1. A slim navigation rail.
2. A command header with paper-mode safety status, scan freshness, and a single `Run scan` action.
3. A dominant selected-market chart.
4. An adjacent explainable signal thesis.
5. An open market-scanner table.
6. A persistent portfolio-risk rail.
7. A paper-trade ticket shown as an overlay after explicit user action.
8. Compact secondary install and profile controls requested for the public app release.
9. Account and install dialogs that reuse the ticket's strict bordered-surface language.

On compact screens, navigation condenses, the thesis follows the chart, the table becomes a readable horizontal surface, and the risk rail stacks without hiding the kill switch.

## Allowed first-viewport copy

- NOCTURNE
- Market command
- Paper mode
- All trades are simulated
- Last scan
- Run scan
- Install
- Sign in / Profile
- Command
- Markets
- Strategies
- Paper ledger
- Automation
- Signal thesis
- Market scanner
- Portfolio value
- Daily P&L
- Daily drawdown
- Open risk
- Kill switch

Pair, price, signal, regime, confidence, target, entry, invalidation, and evidence values are dynamic product data rather than fixed concept copy.

## Design tokens

| Role | Token |
| --- | --- |
| Page | `#03111b` |
| Raised surface | `#071a27` |
| Secondary surface | `#0b2230` |
| Border | `#24404e` |
| Primary text | `#f2eee3` |
| Muted text | `#8fa2ad` |
| Accent | `#c8f31d` |
| Secondary accent | `#43d7e7` |
| Risk | `#ff5d52` |
| Warning | `#f6a91b` |

Corners stay tight (`4–8px`), shadows are sparse, and borders—not card shadows—define hierarchy. The exact background is cool near-black navy; no cream shift, purple gradient, glass treatment, or decorative glow is allowed.

## Typography

- Content and numeric emphasis: `Instrument Serif`, Georgia fallback.
- UI chrome, controls, labels, and tables: `IBM Plex Mono`, monospace fallback.
- Controls use explicit 11–13px sizing, uppercase only for compact structural labels, and generous tracking.
- The selected price is the strongest typographic object; scanner rows stay dense but readable.

## Components and containers

- `AppShell`: fixed-width sidebar plus fluid command workspace.
- `CommandHeader`: open band with one primary action.
- `PriceChart`: bordered canvas with SVG line/area trace, zones, grid, axes, and scanning marker.
- `SignalThesis`: bordered side rail with probability, regime, levels, and evidence.
- `MarketScanner`: open table with selected-row state and Configure actions.
- `RiskRail`: full-width segmented rail with kill-switch control.
- `TradeTicket`: accessible modal/dialog, never visible until requested.
- `AccountDialog`: centered on desktop and a bottom sheet on mobile; Google/email entry, private profile editing, and deletion controls.
- `InstallDialog`: native PWA install action with platform guidance and Actions package fallback.

## Icon inventory

Use one thin-stroke rounded icon family for navigation, scan/play, settings, info, close, trend direction, and shield/kill-switch metaphors. Icons are 16–20px, optical stroke 1.75–2px, `currentColor`, and always paired with accessible labels where meaning is not obvious.

## Motion

- A slow, subtle vertical scan line traverses the chart only while scanning.
- Safety and freshness indicators may pulse softly.
- Modal and selected-row transitions are under 220ms and respect `prefers-reduced-motion`.

## Core interaction path

Run scan → receive live or cached market signals → select a market → inspect evidence and risk levels → configure a paper trade → validate risk sizing → submit to paper ledger → update portfolio/open-risk rail. The kill switch prevents new orders immediately.

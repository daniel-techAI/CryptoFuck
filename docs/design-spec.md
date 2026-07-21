# NOCTURNE exchange and Decision design specification

Sources of truth:

- [exchange workspace](../.design/nocturne-exchange-workspace-concept-v2.png), 1536 × 1024;
- [Decision workspace](../.design/nocturne-decision-workspace-concept-v2.png), 1536 × 1024.

## Product surface

NOCTURNE is an original exchange-style research and paper-trading terminal. It does not reproduce Binance branding or send exchange orders.

The Spot and Futures workspaces contain a venue-matched top-20 order book, dominant live candlestick chart, aggregate-trade tape, compact order ticket with realistic modeled costs, and a paper positions/order-history ledger. The Futures workspace uses Binance USDⓈ-M Futures klines, ticker, depth and trades plus mark/funding context.

The Decision workspace contains a single action, conditional five-step plan, chart zones, entry condition, invalidation, two targets, non-maximum stretch reference, cost-adjusted reward/risk, position-size reference, manual/automatic kill-switch state, evidence ledger, factual context and provenance-labeled external sources.

## First-viewport copy lock

- NOCTURNE
- Markets
- Spot
- Futures
- Decision
- Backtest
- Account
- BTC / USDT
- BINANCE LIVE
- Install app
- Order book
- Recent trades
- Order entry
- Trade plan
- WAIT / CONSIDER LONG / CONSIDER SHORT / MANAGE / REDUCE / EXIT
- Evidence ledger
- Market facts & sources
- Kill switch

Prices, probabilities, reasons, targets, validation results, sentiment and venue labels are dynamic facts rather than fixed concept copy.

## Design system

| Role | Value |
| --- | --- |
| Page | `#020810` |
| Chart | `#030b13` |
| Raised rail | `#061019` |
| Border | `#1d303e` |
| Primary text | `#edf1ed` |
| Muted text | `#7f8e98` |
| Buy / live | `#a4e736` |
| Sell / risk | `#ff5850` |
| Technical | `#45d7e6` |
| Caution | `#f0b925` |

Borders, rails, canvases and tables define hierarchy. Corners stay sharp at 0–4px. There are no decorative card grids, photos, hero copy, glass surfaces or unrelated gradients.

Brand typography uses Instrument Serif. Every control, data row, chart label and numeric field uses IBM Plex Mono with explicit compact sizing and tabular alignment.

## Responsive behavior

At desktop width, order book, chart, trades and ticket share one command-center row. Below 820px the chart leads, followed by the ticket, book and trades. Decision chart and plan stack. Dense tables and navigation retain internal horizontal scrolling while the root document stays viewport-width.

## Core interactions

- switch between Markets, Spot, Futures, Decision, Backtest and Account;
- switch venue-matched candle intervals (`1m`, `3m`, `15m`, `30m`, `1h`);
- select paper long/short, market/limit, allocation, leverage, stop and target;
- submit a risk-checked local paper order;
- engage or release the manual paper kill switch;
- inspect Decision reliability gates and manually declare position context;
- copy a plan when the browser grants clipboard permission;
- open provenance-labeled external sources in a separate tab.

Community and editorial context never silently changes a signal. The visible `Market facts influence: OFF` state is part of the reliability design.

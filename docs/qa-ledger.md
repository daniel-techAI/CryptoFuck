# Visual and functional QA ledger

## Evidence

- Accepted live-dashboard concept: [`.design/nocturne-live-dashboard-concept.png`](../.design/nocturne-live-dashboard-concept.png), 1536 x 1024.
- Latest live implementation: [`.design/nocturne-live-dashboard-render-final.png`](../.design/nocturne-live-dashboard-render-final.png), Browser/IAB viewport 1536 x 1024.
- Responsive check: Browser/IAB viewport 390 x 844; the document's usable client width was 375px because of browser chrome/scrollbar allocation.

The concept and latest render were inspected together with `view_image` after the final CSS change.

## Fidelity comparison

| Area | Concept | Final implementation | Result |
| --- | --- | --- | --- |
| Navigation | NOCTURNE plus Overview, Spot, Futures, Backtest, Account | Same labels, order, selected underline, market selector, live status, install and account controls | Matched |
| Chart | Dominant candlestick surface with volume and EMA overlays | Real Lightweight Charts canvas using live Binance candles, volume, EMA 20/50, crosshair and trigger lines | Matched |
| Forecast rail | Direction, probability split, evidence and price levels | Same hierarchy plus validation and 15m/1h context; live weak evidence correctly renders neutral | Matched with authorized reliability extension |
| Market tape | Open full-width table below the chart | Five live Binance pairs, price, 24h move, quote volume and momentum | Matched |
| Visual system | Near-black navy, lime/coral/cyan semantics, squared rails, compact mono type | Same palette, border rhythm, density, Instrument Serif brand and IBM Plex Mono UI | Matched |
| Responsive | Desktop command center with stackable right rail | At 390 x 844, the chart remains 375px wide, the forecast stacks, tabs scroll internally, and root width remains 375px | Verified |

## Above-the-fold copy diff

The requested structural strings are present: `NOCTURNE`, `Overview`, `Spot`, `Futures`, `Backtest`, `Account`, `BINANCE LIVE`, `Install app`, all five timeframe labels, `Market forecast`, and `Live market tape`. Dynamic prices, probabilities, evidence, and direction intentionally differ from the concept because they come from the current Binance market and validation gate.

Intentional extensions authorized by the reliability request and second improvement pass:

- directional accuracy and net-positive-after-costs are shown separately;
- weak validation forces a neutral call;
- 15m/1h context reduces confidence when timeframes conflict;
- neutral forecasts use observation and trigger labels rather than trade-entry language.

## Mismatches found and fixed

- Replaced the generated snapshot-first experience with direct Binance REST history and reconnecting WebSockets.
- Prevented WebSocket frequency from causing unnecessary React renders by batching visible updates every three seconds.
- Split the one-page dashboard into dedicated workspace tabs.
- Removed the desktop tab rail's unnecessary overflow scrollbar while preserving mobile horizontal navigation.
- Separated directional accuracy from cost-positive outcomes after the first live sample exposed the ambiguity.
- Added a validation rejection gate and higher-timeframe context instead of overstating confidence.
- Changed neutral price levels from `Entry / Stop / Target` language to `Observation / Downside trigger / Upside trigger`.
- Removed the final focused-control outline before visual capture.
- Added an automatic page reload when a newly deployed service worker takes control and removed the obsolete static snapshot from the PWA bundle.

No fixable material visual mismatches remain. The live market state is an intentional data-driven deviation from the bullish mock concept.

## Core interaction verification

The Browser/IAB flow exercised:

- initial Binance REST history and WebSocket connection;
- live status and event age (`Updated 0-2s ago`);
- real chart canvas rendering;
- timeframe switch from 15m to 1m with a refreshed forecast horizon;
- Futures tab navigation and realistic fee/slippage/liquidation calculations;
- one simulated Futures order, followed by a success notice and ledger row;
- Backtest navigation with current rolling metrics;
- desktop 1536 x 1024 and mobile 390 x 844 layout checks;
- root overflow, framework overlay, and local console checks.

The Browser/IAB DOM snapshot endpoint was incompatible in this runtime, so the same Browser surface's documented read-only evaluate, locator, screenshot, console, and viewport APIs were used. Standalone Playwright was not used. The only console noise came from the host browser's own Statsig request; there were no `127.0.0.1` app errors or warnings.

## Automated checks

- Server tests: 7 passed.
- Web tests: 9 passed, including forecast direction, minimum history, EMA stability, and context-conflict confidence reduction.
- TypeScript and production PWA builds: passed.
- PWA precache: 24 entries, about 817 KiB.
- Dependency audit: 0 vulnerabilities at moderate or higher severity.

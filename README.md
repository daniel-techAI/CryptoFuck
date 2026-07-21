# NOCTURNE

A live Binance Spot and USDⓈ-M Futures market terminal with exchange-style paper trading, transparent decision plans, cost-aware walk-forward validation, and hard risk gates.

[Launch the free live web app](https://daniel-techai.github.io/CryptoFuck/) - [Download the latest app package](https://github.com/daniel-techAI/CryptoFuck/actions/workflows/app-package.yml) - [Set up Google/email profiles](docs/auth-and-deployment.md)

> Research and simulation only. Forecasts are probabilistic rule-based estimates, not guarantees or financial advice. Crypto can lose substantial value.

![NOCTURNE exchange workspace concept](.design/nocturne-exchange-workspace-concept-v2.png)

## Live web experience

- Binance Spot and USDⓈ-M Futures REST history plus reconnecting WebSocket market streams;
- a three-second UI refresh cadence with a visible event-age and connection indicator;
- live top-20 order books and recent-trade tapes, rendered on a separate half-second UI cadence;
- selectable `1m`, `3m`, `15m`, `30m`, and `1h` candles;
- a real interactive candlestick chart with volume, EMA 20, EMA 50, targets, and invalidation;
- BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, and XRP/USDT live market tape;
- explicit bullish, bearish, or neutral forecasts with probability distribution and indicator evidence;
- a hard neutral gate when walk-forward directional accuracy is weak;
- 15-minute and 1-hour context confirmation that lowers confidence on conflicts;
- separate Markets, Spot, Futures, Decision, Backtest, and Account workspaces;
- exchange-style Spot and Futures paper workspaces with chart, depth, recent trades, order entry, costs, positions, and order history;
- a dedicated Decision plan for `WAIT`, `CONSIDER LONG`, `CONSIDER SHORT`, `MANAGE`, `REDUCE`, or `EXIT`;
- automatic entry blocking when data is stale, walk-forward validation is weak, higher timeframes conflict, spread is poor, or reward-to-risk after costs is insufficient;
- entry conditions, invalidation, two targets, a clearly labeled stretch level that is not presented as a predicted maximum, and position-size reference;
- factual market context from Binance plus the Alternative.me Fear & Greed index, with community/editorial/official source links and explicit provenance;
- market-news and sentiment context excluded from the directional score until separately validated;
- persistent browser-local paper positions, portfolio caps, and a kill switch;
- installable PWA behavior with automatic code updates;
- optional Google and email profiles through Supabase Auth.

Binance documents its public [Spot streams](https://developers.binance.com/en/docs/products/spot/market-data/websocket-streams), [Spot REST market data](https://developers.binance.com/en/docs/products/spot/market-data/rest-api), and [USDⓈ-M Futures APIs](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/Introduction). Alternative.me documents its [Fear & Greed API](https://alternative.me/crypto/fear-and-greed-index/). No API key is needed for these public feeds.

## Forecast and validation boundary

NOCTURNE combines EMA structure, EMA slope, six-candle momentum, RSI 14, ATR 14, and volume confirmation into a bounded score. A forecast includes its horizon, evidence, entry zone, invalidation, targets, and a probability distribution.

The Backtest tab performs a rolling walk-forward check: every historical decision sees only data available at that candle, then evaluates the following three candles. Directional accuracy and net-positive outcomes after a modeled 0.24% round trip are shown separately. This is a reality check, not proof of future edge.

## Quick start

Requires Node 22 or newer.

```bash
npm install
npm run dev -w web
```

Open `http://127.0.0.1:5173`. The static web mode gets public market data directly from Binance and keeps paper activity in local browser storage.

To run the optional Express API and web app together:

```bash
npm run dev
```

Validation:

```bash
npm run check
npm audit --audit-level=moderate
```

## Profiles

Profiles are optional. Guests can use live charts, forecasts, backtests, and local paper trading without an account. To enable Google OAuth and email magic links, copy `web/.env.example` to `web/.env.local`, add a Supabase project URL and publishable key, apply the migration under `supabase/migrations`, and follow [profiles and deployment](docs/auth-and-deployment.md).

Google sign-in requests basic identity scopes only; it does not read Gmail messages. Cloud paper rows are owner-only through Postgres row-level security.

## Automated deployment and downloads

`.github/workflows/pages.yml` builds and deploys the live PWA whenever `main` changes. `.github/workflows/app-package.yml` produces a downloadable production artifact on every push to `main` and on manual dispatch. Installed copies use the service worker's automatic update path.

Market prices do not wait for GitHub Actions: each open app connects directly to the Binance public WebSocket and applies live events to the chart every three seconds.

## Execution safety

The public web app never sends exchange orders and never asks for exchange credentials. Decision actions are conditional research outputs, not instructions or guarantees. Paper limits include 1% maximum equity risk per trade, 3% total open risk, a 20% notional cap, a manual portfolio kill switch, and automatic entry blocking when reliability gates fail.

The repository still contains a separately gated server-side CCXT adapter for private sandbox development. Never put exchange secrets into the frontend, GitHub Pages variables, or browser storage, and never grant withdrawal permission.

## Repository map

```text
web/       live Binance client, chart, forecast, validation, tabs, PWA, profiles
server/    optional API, Kraken scanner, paper broker, backtest, gated CCXT adapter
supabase/  profile, RLS, and cloud paper-account migration
docs/      architecture, authentication, risk, and operations
.github/   CI, Pages deployment, packages, and dependency updates
```

Released under the [MIT License](LICENSE).

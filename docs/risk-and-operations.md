# Risk and operations runbook

## Non-negotiable defaults

1. Keep `LIVE_TRADING_ENABLED=false` until a strategy has survived out-of-sample backtests and at least 30 days of paper trading.
2. Create exchange keys with trading permission only. Never enable withdrawals.
3. Use IP allowlists and a dedicated subaccount where the exchange supports them.
4. Start in an exchange sandbox. Production requires the additional `LIVE_PRODUCTION_ACK` value documented in `.env.example`.
5. Treat every signal as research. Stop trading when data is stale, the regime changes, slippage exceeds assumptions, or the daily drawdown lock triggers.
6. Never place a Supabase service-role key, Google OAuth secret, exchange credential, or trading-arm token in a Vite variable or GitHub Pages build.
7. Do not treat a `CONSIDER LONG` or `CONSIDER SHORT` result as an order. Confirm the live venue, instrument, account fees, region, position mode and actual Binance order ticket independently.
8. Keep market-news and community-post influence disabled until a versioned dataset proves it improves out-of-sample, cost-adjusted results without leakage.

## Decision kill-switch conditions

The public app automatically blocks new directional plans when any of these conditions is true:

- the selected Binance feed is not live or is more than ten seconds old;
- walk-forward sample size is below 20, directional accuracy is below 50%, or net-positive-after-costs rate is below 25%;
- 15-minute and one-hour context conflicts with the active direction;
- bid/ask spread exceeds eight basis points;
- the forecast is neutral;
- Target 1 reward-to-risk after modeled costs is below 1.2R;
- the manual paper-account kill switch is engaged.

These thresholds reduce overtrading; they do not prove a profitable edge. Order-book depth can be spoofed, funding is not directional proof, and the Fear & Greed index is broad Bitcoin-market context rather than pair-specific evidence.

## Promotion checklist

- No look-ahead bias or use of an unclosed candle.
- Fees and plausible slippage included in backtests.
- Walk-forward or otherwise out-of-sample evaluation completed.
- Profit is not concentrated in one asset, week, or single outlier trade.
- Maximum drawdown fits the actual capital at risk.
- Paper fills and exchange testnet behavior agree with the strategy model.
- Kill switch exercised and alert path verified.
- API key permissions, logs, backups, and incident owner reviewed.
- Google/email sign-in, RLS isolation, self-service profile deletion, and SMTP delivery verified before public launch.

## GitHub automation caveat

GitHub schedules may start late during heavy load. Scheduled workflows in a public repository can also be disabled after 60 days without repository activity. For a true continuous trading service, deploy the container to a monitored host; use Pages as a signal dashboard, not as an execution service.

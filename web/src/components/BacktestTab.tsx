import { BarChart3, CheckCircle2, Database, FlaskConical, ShieldAlert } from "lucide-react";
import { displaySymbol, type BinanceSymbol } from "../lib/binance";
import { formatPercent } from "../lib/format";
import type { BinanceInterval, Candle, MarketForecast } from "../types";

export function BacktestTab({ symbol, interval, candles, forecast }: { symbol: BinanceSymbol; interval: BinanceInterval; candles: Candle[]; forecast: MarketForecast | null }) {
  const validation = forecast?.validation;
  const trustworthySample = (validation?.sampleSize ?? 0) >= 20;
  return (
    <main className="backtest-page">
      <header className="page-title"><div><h1>Walk-forward validation</h1><p>{displaySymbol(symbol)} - {interval} candles - costs included - no look-ahead</p></div><span className={`validation-state ${trustworthySample ? "ready" : "limited"}`}>{trustworthySample ? <CheckCircle2 /> : <ShieldAlert />}{trustworthySample ? "USABLE SAMPLE" : "LIMITED SAMPLE"}</span></header>
      <section className="methodology-band"><FlaskConical /><div><strong>What this test measures</strong><p>At each historical candle, the model reads only data that existed then, produces a direction, waits three candles, and scores the result after 0.24% modeled round-trip fees and slippage.</p></div></section>
      <div className="validation-metrics">
        <div><span>Prior signals</span><strong>{validation?.sampleSize ?? 0}</strong><small>minimum target: 20</small></div>
        <div><span>Directional accuracy</span><strong className={(validation?.hitRatePercent ?? 0) >= 50 ? "positive" : "negative"}>{validation ? `${validation.hitRatePercent.toFixed(1)}%` : "-"}</strong><small>correct up/down calls</small></div>
        <div><span>Average net return</span><strong className={(validation?.averageNetReturnPercent ?? 0) >= 0 ? "positive" : "negative"}>{validation ? formatPercent(validation.averageNetReturnPercent, 3) : "-"}</strong><small>per simulated signal</small></div>
        <div><span>Profit factor</span><strong>{validation ? Number.isFinite(validation.profitFactor) ? validation.profitFactor.toFixed(2) : "INF" : "-"}</strong><small>gross wins / gross losses</small></div>
        <div><span>Max validation drawdown</span><strong>{validation ? `${validation.maxDrawdownPercent.toFixed(2)}%` : "-"}</strong><small>compounded signal sequence</small></div>
        <div><span>Net-positive after costs</span><strong className={(validation?.profitableRatePercent ?? 0) >= 50 ? "positive" : "negative"}>{validation ? `${validation.profitableRatePercent.toFixed(1)}%` : "-"}</strong><small>profitable simulated outcomes</small></div>
      </div>
      <div className="backtest-details">
        <section><header><Database />Data boundary</header><dl><div><dt>Source</dt><dd>Binance Spot public market data</dd></div><div><dt>Window</dt><dd>Up to 360 candles</dd></div><div><dt>Forecast horizon</dt><dd>3 candles</dd></div><div><dt>Evaluation</dt><dd>Rolling out-of-sample simulation</dd></div></dl></section>
        <section><header><BarChart3 />Model boundary</header><dl><div><dt>Inputs</dt><dd>EMA 20/50, RSI 14, ATR 14, momentum, volume</dd></div><div><dt>Neutral threshold</dt><dd>|score| below 18</dd></div><div><dt>Costs</dt><dd>{validation?.roundTripCostPercent.toFixed(2) ?? "0.24"}% round trip</dd></div><div><dt>Retraining</dt><dd>None; deterministic rules</dd></div></dl></section>
      </div>
      <p className="research-warning"><ShieldAlert />Backtests can overfit and past performance does not predict future results. Treat a weak or small validation sample as a reason not to trade.</p>
    </main>
  );
}

import { ShieldAlert } from "lucide-react";
import { displaySymbol, quoteAssetFromSymbol, type BinanceSymbol } from "../lib/binance";
import { formatCompactUsd, formatPercent, formatPrice, formatQuoteCurrency } from "../lib/format";
import type { FuturesMarketContext, LiveTicker, PortfolioSummary } from "../types";

interface MarketStatsBarProps {
  symbol: BinanceSymbol;
  ticker: LiveTicker;
  portfolio: PortfolioSummary;
  futures?: FuturesMarketContext;
  onKillSwitch: (enabled: boolean) => Promise<void>;
}

export function MarketStatsBar({ symbol, ticker, portfolio, futures, onKillSwitch }: MarketStatsBarProps) {
  const quote = quoteAssetFromSymbol(symbol);
  return (
    <section className="market-stats-bar" aria-label="Current market and paper account statistics">
      <div className="stats-primary"><span>{displaySymbol(symbol)}</span><strong>{ticker.price ? formatPrice(ticker.price) : "Waiting…"}</strong><b className={ticker.change24hPercent >= 0 ? "positive" : "negative"}>{formatPercent(ticker.change24hPercent)}</b></div>
      <dl>
        <div><dt>24h high</dt><dd>{ticker.high24h ? formatPrice(ticker.high24h) : "-"}</dd></div>
        <div><dt>24h low</dt><dd>{ticker.low24h ? formatPrice(ticker.low24h) : "-"}</dd></div>
        <div><dt>24h volume</dt><dd>{ticker.quoteVolume24h ? formatQuoteCurrency(ticker.quoteVolume24h, quote) : "-"}</dd></div>
        {futures ? <div><dt>Futures mark</dt><dd>{futures.markPrice ? formatPrice(futures.markPrice) : "Unavailable"}</dd></div> : null}
        {futures ? <div><dt>Funding</dt><dd className={futures.fundingRate > 0 ? "caution-text" : "positive"}>{futures.markPrice ? `${(futures.fundingRate * 100).toFixed(4)}%` : "-"}</dd></div> : null}
        <div><dt>Paper equity</dt><dd>{formatCompactUsd(portfolio.equity)}</dd></div>
        <div><dt>Daily P&amp;L</dt><dd className={portfolio.dailyPnl >= 0 ? "positive" : "negative"}>{formatCompactUsd(portfolio.dailyPnl)}</dd></div>
      </dl>
      <button className={`stats-kill-switch ${portfolio.killSwitch ? "engaged" : ""}`} type="button" onClick={() => void onKillSwitch(!portfolio.killSwitch)}><ShieldAlert /> <span>Kill switch<strong>{portfolio.killSwitch ? "ALL OFF" : "READY"}</strong></span></button>
    </section>
  );
}

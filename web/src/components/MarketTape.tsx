import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { displaySymbol, quoteAssetFromSymbol, type BinanceSymbol } from "../lib/binance";
import { formatPercent, formatPrice, formatQuoteCurrency } from "../lib/format";
import type { LiveTicker, MarketForecast } from "../types";

function momentum(change: number) {
  if (change >= 0.35) return { label: "UP", icon: ArrowUpRight, tone: "positive" };
  if (change <= -0.35) return { label: "DOWN", icon: ArrowDownRight, tone: "negative" };
  return { label: "FLAT", icon: Minus, tone: "neutral" };
}

export function MarketTape({ tickers, selected, onSelect, forecast }: { tickers: LiveTicker[]; selected: BinanceSymbol; onSelect: (symbol: BinanceSymbol) => void; forecast: MarketForecast | null }) {
  return (
    <section className="market-tape" aria-labelledby="market-tape-title">
      <header><h2 id="market-tape-title">Live market tape</h2><span>BINANCE SPOT - 3 SECOND UI REFRESH</span></header>
      <div className="tape-table" role="table">
        <div className="tape-row tape-head" role="row"><span>Market</span><span>Price</span><span>24h</span><span>24h volume</span><span>Momentum</span></div>
        {tickers.map((ticker) => {
          const quote = quoteAssetFromSymbol(ticker.symbol);
          const item = momentum(ticker.change24hPercent);
          const isSelected = ticker.symbol === selected;
          const selectedSignal = isSelected && forecast ? forecast.direction : item.label;
          return <button key={ticker.symbol} className={`tape-row ${isSelected ? "selected" : ""}`} role="row" onClick={() => onSelect(ticker.symbol as BinanceSymbol)}>
            <strong>{displaySymbol(ticker.symbol)}</strong><span>{ticker.price ? formatPrice(ticker.price) : "Loading..."}</span><span className={ticker.change24hPercent >= 0 ? "positive" : "negative"}>{formatPercent(ticker.change24hPercent)}</span><span>{ticker.quoteVolume24h ? formatQuoteCurrency(ticker.quoteVolume24h, quote) : "-"}</span><span className={isSelected && forecast ? forecast.direction.toLowerCase() : item.tone}><item.icon />{selectedSignal}</span>
          </button>;
        })}
      </div>
    </section>
  );
}

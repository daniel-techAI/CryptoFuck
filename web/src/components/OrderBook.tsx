import type { CSSProperties } from "react";
import { quoteAssetFromSymbol, type BinanceQuoteAsset } from "../lib/binance";
import { formatPrice, formatQuoteCurrency } from "../lib/format";
import type { LiveTicker, MarketMicrostructure, OrderBookLevel } from "../types";

function BookRow({ level, side, maxTotal, quote }: { level: OrderBookLevel; side: "ask" | "bid"; maxTotal: number; quote: BinanceQuoteAsset }) {
  const style = { "--depth": `${maxTotal ? Math.min(100, level.total / maxTotal * 100) : 0}%` } as CSSProperties;
  return <div className={`book-row ${side}`} style={style}><strong>{formatPrice(level.price)}</strong><span>{level.quantity.toLocaleString("en-US", { maximumFractionDigits: 5 })}</span><span>{formatQuoteCurrency(level.total, quote)}</span></div>;
}

export function OrderBook({ microstructure, ticker }: { microstructure: MarketMicrostructure; ticker: LiveTicker }) {
  const quote = quoteAssetFromSymbol(ticker.symbol);
  const asks = microstructure.asks.slice(0, 11).reverse();
  const bids = microstructure.bids.slice(0, 11);
  const maxTotal = Math.max(asks.at(-1)?.total ?? 0, bids.at(-1)?.total ?? 0);
  const spread = ticker.bid && ticker.ask ? ticker.ask - ticker.bid : 0;
  const spreadBps = spread && ticker.price ? spread / ticker.price * 10_000 : 0;
  return (
    <section className="order-book-panel" aria-label="Live Binance order book">
      <header><h2>Order book</h2><span className={microstructure.status === "live" ? "positive" : "caution-text"}>{microstructure.status.toUpperCase()}</span></header>
      <div className="book-head"><span>Price ({quote})</span><span>Amount</span><span>Total</span></div>
      <div className="book-levels asks">{asks.map((level) => <BookRow key={`a-${level.price}`} level={level} side="ask" maxTotal={maxTotal} quote={quote} />)}</div>
      <div className="book-mid"><strong>{ticker.price ? formatPrice(ticker.price) : "Waiting"}</strong><span>Spread {spread ? formatPrice(spread) : "-"} · {spreadBps.toFixed(2)} bps</span></div>
      <div className="book-levels bids">{bids.map((level) => <BookRow key={`b-${level.price}`} level={level} side="bid" maxTotal={maxTotal} quote={quote} />)}</div>
      <footer><span>BID {((100 + microstructure.imbalancePercent) / 2).toFixed(1)}%</span><i><b style={{ width: `${(100 + microstructure.imbalancePercent) / 2}%` }} /></i><span>ASK {((100 - microstructure.imbalancePercent) / 2).toFixed(1)}%</span></footer>
    </section>
  );
}

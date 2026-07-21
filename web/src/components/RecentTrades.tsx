import { formatPrice } from "../lib/format";
import type { RecentTrade } from "../types";

function tradeTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function RecentTrades({ trades }: { trades: RecentTrade[] }) {
  return (
    <section className="recent-trades-panel" aria-label="Recent Binance trades">
      <header><h2>Recent trades</h2><span>REAL-TIME</span></header>
      <div className="trades-head"><span>Price</span><span>Amount</span><span>Time</span></div>
      <div className="trades-list">
        {trades.length ? trades.slice(0, 20).map((trade) => <div className={`trade-row ${trade.side.toLowerCase()}`} key={trade.id}><strong>{formatPrice(trade.price)}</strong><span>{trade.quantity.toLocaleString("en-US", { maximumFractionDigits: 5 })}</span><time dateTime={new Date(trade.timestamp).toISOString()}>{tradeTime(trade.timestamp)}</time></div>) : <div className="micro-loading">Waiting for trades…</div>}
      </div>
    </section>
  );
}

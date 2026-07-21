import { LoaderCircle, WifiOff } from "lucide-react";
import { BINANCE_INTERVALS, displaySymbol, type BinanceSymbol } from "../lib/binance";
import { formatPercent, formatPrice } from "../lib/format";
import type { BinanceInterval, Candle, LiveConnectionStatus, LiveTicker, MarketForecast } from "../types";
import { ForecastPanel } from "./ForecastPanel";
import { LiveChart } from "./LiveChart";
import { MarketTape } from "./MarketTape";

interface OverviewTabProps {
  symbol: BinanceSymbol;
  onSymbol: (symbol: BinanceSymbol) => void;
  interval: BinanceInterval;
  onInterval: (interval: BinanceInterval) => void;
  candles: Candle[];
  ticker: LiveTicker;
  tickers: LiveTicker[];
  forecast: MarketForecast | null;
  status: LiveConnectionStatus;
  error: string;
}

export function OverviewTab({ symbol, onSymbol, interval, onInterval, candles, ticker, tickers, forecast, status, error }: OverviewTabProps) {
  const last = candles.at(-1);
  const loading = candles.length === 0;
  return (
    <main className="overview-page">
      {error ? <div className="stream-warning"><WifiOff />{error} The WebSocket will keep reconnecting automatically.</div> : null}
      <div className="market-command-grid">
        <section className="chart-panel" aria-label={`${displaySymbol(symbol)} live chart`}>
          <div className="chart-quote-row">
            <div><h1>{displaySymbol(symbol)}</h1><strong>{ticker.price ? formatPrice(ticker.price) : last ? formatPrice(last.close) : "-"}</strong><span className={ticker.change24hPercent >= 0 ? "positive" : "negative"}>{formatPercent(ticker.change24hPercent)}</span></div>
            <dl><div><dt>O</dt><dd>{last ? formatPrice(last.open) : "-"}</dd></div><div><dt>H</dt><dd>{last ? formatPrice(last.high) : "-"}</dd></div><div><dt>L</dt><dd>{last ? formatPrice(last.low) : "-"}</dd></div><div><dt>C</dt><dd>{last ? formatPrice(last.close) : "-"}</dd></div><div><dt>VOL</dt><dd>{last ? last.volume.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-"}</dd></div></dl>
          </div>
          <div className="chart-controls">
            <div className="timeframe-tabs" aria-label="Candle timeframe">{BINANCE_INTERVALS.map((item) => <button key={item} className={interval === item ? "active" : ""} onClick={() => onInterval(item)}>{item}</button>)}</div>
            <div className="chart-legend"><span className="ema20-key">EMA 20 {forecast ? formatPrice(forecast.indicators.ema20) : "-"}</span><span className="ema50-key">EMA 50 {forecast ? formatPrice(forecast.indicators.ema50) : "-"}</span></div>
          </div>
          <div className="chart-stage">
            {loading ? <div className="chart-loading"><LoaderCircle /><strong>Loading Binance candles</strong><span>{status === "offline" ? "You appear to be offline." : "Opening the live market stream..."}</span></div> : <LiveChart candles={candles} forecast={forecast} />}
          </div>
        </section>
        <ForecastPanel forecast={forecast} interval={interval} />
      </div>
      <MarketTape tickers={tickers} selected={symbol} onSelect={onSymbol} forecast={forecast} />
    </main>
  );
}

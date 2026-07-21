import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BINANCE_INTERVALS, displaySymbol, quoteAssetFromSymbol, type BinanceSymbol } from "../lib/binance";
import { formatPrice, formatQuoteCurrency } from "../lib/format";
import type { BinanceInterval, Candle, FuturesMarketContext, LiveTicker, MarketForecast, MarketMicrostructure, PaperOrder, PaperOrderRequest, PortfolioSummary } from "../types";
import { LiveChart } from "./LiveChart";
import { MarketStatsBar } from "./MarketStatsBar";
import { OrderBook } from "./OrderBook";
import { RecentTrades } from "./RecentTrades";

type TradingMode = "spot" | "futures";

interface TradingSimulatorProps {
  mode: TradingMode;
  symbol: BinanceSymbol;
  ticker: LiveTicker;
  candles: Candle[];
  interval: BinanceInterval;
  onInterval: (interval: BinanceInterval) => void;
  forecast: MarketForecast | null;
  microstructure: MarketMicrostructure;
  futures: FuturesMarketContext;
  portfolio: PortfolioSummary;
  orders: PaperOrder[];
  submitting: boolean;
  onSubmit: (request: PaperOrderRequest) => Promise<void>;
  onKillSwitch: (enabled: boolean) => Promise<void>;
}

export function TradingSimulator({ mode, symbol, ticker, candles, interval, onInterval, forecast, microstructure, futures, portfolio, orders, submitting, onSubmit, onKillSwitch }: TradingSimulatorProps) {
  const quote = quoteAssetFromSymbol(symbol);
  const [side, setSide] = useState<"LONG" | "SHORT">(forecast?.direction === "BEARISH" ? "SHORT" : "LONG");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [entry, setEntry] = useState(ticker.price);
  const [capital, setCapital] = useState(mode === "spot" ? 1_000 : 500);
  const [leverage, setLeverage] = useState(mode === "spot" ? 1 : 5);
  const [stopLoss, setStopLoss] = useState(forecast?.levels.invalidation ?? ticker.price * 0.985);
  const [takeProfit, setTakeProfit] = useState(forecast?.levels.target1 ?? ticker.price * 1.025);
  const [error, setError] = useState("");
  const [ledgerView, setLedgerView] = useState<"orders" | "positions" | "history">("positions");
  const initializedSymbol = useRef("");
  const liveEntry = orderType === "MARKET" ? ticker.price : entry;

  useEffect(() => {
    if (!ticker.price || ticker.symbol !== symbol || initializedSymbol.current === symbol) return;
    initializedSymbol.current = symbol;
    setEntry(ticker.price);
    const nextSide = forecast?.direction === "BEARISH" ? "SHORT" : "LONG";
    setSide(nextSide);
    const distance = Math.max(forecast?.indicators.atr14 ?? ticker.price * 0.008, ticker.price * 0.004);
    setStopLoss(nextSide === "LONG" ? ticker.price - distance * 1.5 : ticker.price + distance * 1.5);
    setTakeProfit(nextSide === "LONG" ? ticker.price + distance * 2 : ticker.price - distance * 2);
  }, [forecast?.direction, forecast?.indicators.atr14, symbol, ticker.price]);

  useEffect(() => {
    setLeverage(mode === "spot" ? 1 : 5);
    setCapital(mode === "spot" ? 1_000 : 500);
  }, [mode]);

  const chooseSide = (next: "LONG" | "SHORT") => {
    setSide(next);
    const price = liveEntry || ticker.price;
    const distance = Math.max(forecast?.indicators.atr14 ?? price * 0.008, price * 0.004);
    setStopLoss(next === "LONG" ? price - distance * 1.5 : price + distance * 1.5);
    setTakeProfit(next === "LONG" ? price + distance * 2 : price - distance * 2);
    setError("");
  };

  const costs = useMemo(() => {
    const notional = capital * leverage;
    const takerFeePercent = mode === "spot" ? 0.1 : 0.05;
    const slippagePercent = 0.02;
    const roundTripCost = notional * ((takerFeePercent + slippagePercent) * 2 / 100);
    const stopRisk = liveEntry ? Math.abs(liveEntry - stopLoss) / liveEntry * notional : 0;
    const maintenanceMargin = 0.004;
    const liquidation = mode === "futures" && liveEntry
      ? side === "LONG" ? liveEntry * (1 - 1 / leverage + maintenanceMargin) : liveEntry * (1 + 1 / leverage - maintenanceMargin)
      : 0;
    return { notional, takerFeePercent, slippagePercent, roundTripCost, stopRisk, liquidation, totalRisk: stopRisk + roundTripCost };
  }, [capital, leverage, liveEntry, mode, side, stopLoss]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ pair: displaySymbol(symbol).replaceAll(" ", ""), side, entry: liveEntry, stopLoss, takeProfit, sizeUsd: costs.notional, signalScore: forecast?.score });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not place the paper order.");
    }
  };

  const pairOrders = orders.filter((order) => order.pair.replaceAll(" ", "") === displaySymbol(symbol).replaceAll(" ", ""));
  const sideLabels = mode === "spot" ? ["BUY", "SELL"] : ["LONG", "SHORT"];
  return (
    <main className="exchange-page">
      <MarketStatsBar symbol={symbol} ticker={ticker} portfolio={portfolio} futures={mode === "futures" ? futures : undefined} onKillSwitch={onKillSwitch} />
      <div className="exchange-workspace-grid">
        <OrderBook microstructure={microstructure} ticker={ticker} />
        <section className="exchange-chart-panel" aria-label={`${displaySymbol(symbol)} ${mode} trading chart`}>
          <header><span>{mode === "spot" ? "SPOT · BINANCE" : "USDⓈ-M PERPETUAL · BINANCE FUTURES"}</span><strong>{displaySymbol(symbol)}</strong></header>
          <div className="exchange-chart-tools"><div className="timeframe-tabs">{BINANCE_INTERVALS.map((item) => <button key={item} className={interval === item ? "active" : ""} onClick={() => onInterval(item)}>{item}</button>)}</div><span>EMA 20 <b className="cyan-text">{forecast ? formatPrice(forecast.indicators.ema20) : "-"}</b> · EMA 50 <b className="caution-text">{forecast ? formatPrice(forecast.indicators.ema50) : "-"}</b></span></div>
          <div className="exchange-chart-stage">{candles.length ? <LiveChart candles={candles} forecast={forecast} /> : <div className="micro-loading">Loading live Binance candles…</div>}</div>
        </section>
        <RecentTrades trades={microstructure.trades} />
        <form className="order-entry-panel exchange-ticket" onSubmit={submit}>
          <header><h2>Order entry</h2><span className="paper-only"><ShieldCheck />PAPER</span></header>
          <div className="side-switch"><button type="button" className={side === "LONG" ? "buy active" : "buy"} onClick={() => chooseSide("LONG")}>{sideLabels[0]}</button><button type="button" className={side === "SHORT" ? "sell active" : "sell"} onClick={() => chooseSide("SHORT")}>{sideLabels[1]}</button></div>
          <div className="order-type-switch"><button type="button" className={orderType === "MARKET" ? "active" : ""} onClick={() => setOrderType("MARKET")}>Market</button><button type="button" className={orderType === "LIMIT" ? "active" : ""} onClick={() => setOrderType("LIMIT")}>Limit</button></div>
          <label>Live price<div className="field-value"><input type="number" step="any" value={orderType === "MARKET" ? ticker.price || "" : entry || ""} disabled={orderType === "MARKET"} onChange={(event) => setEntry(Number(event.target.value))} /><span>{quote}</span></div></label>
          <label>{mode === "spot" ? "Order value" : "Margin"}<div className="field-value"><input type="number" min="10" step="10" value={capital} onChange={(event) => setCapital(Number(event.target.value))} /><span>{quote}</span></div></label>
          <div className="allocation-buttons">{[25, 50, 75, 100].map((percent) => <button type="button" key={percent} onClick={() => setCapital(Math.max(10, Math.round(portfolio.cash * percent / 100 / (mode === "futures" ? leverage : 1))))}>{percent}%</button>)}</div>
          {mode === "futures" ? <label>Leverage<div className="leverage-field"><input type="range" min="1" max="20" value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} /><strong>{leverage}x</strong></div></label> : null}
          <label>Stop loss<div className="field-value"><input type="number" step="any" value={stopLoss || ""} onChange={(event) => setStopLoss(Number(event.target.value))} /><span>{quote}</span></div></label>
          <label>Take profit<div className="field-value"><input type="number" step="any" value={takeProfit || ""} onChange={(event) => setTakeProfit(Number(event.target.value))} /><span>{quote}</span></div></label>
          <dl className="ticket-costs">
            <div><dt>Notional</dt><dd>{formatQuoteCurrency(costs.notional, quote)}</dd></div>
            <div><dt>Fee + slippage / round trip</dt><dd>{formatQuoteCurrency(costs.roundTripCost, quote)}</dd></div>
            <div><dt>Risk to stop + costs</dt><dd className={costs.totalRisk > portfolio.equity * 0.01 ? "negative" : ""}>{formatQuoteCurrency(costs.totalRisk, quote)}</dd></div>
            {mode === "futures" ? <div><dt>Approx. liquidation</dt><dd className="negative">{formatQuoteCurrency(costs.liquidation, quote)}</dd></div> : null}
          </dl>
          {error ? <p className="form-error"><AlertTriangle />{error}</p> : null}
          <button className={`submit-paper ${side === "LONG" ? "buy" : "sell"}`} disabled={submitting || portfolio.killSwitch || !liveEntry}>{portfolio.killSwitch ? "Kill switch active" : submitting ? "Placing paper order..." : `Place paper ${sideLabels[side === "LONG" ? 0 : 1]}`}</button>
          <p className="execution-note"><LockKeyhole />Simulation only. API keys are never requested by this screen.</p>
        </form>
      </div>
      <section className="exchange-ledger"><header><nav><button className={ledgerView === "orders" ? "active" : ""} onClick={() => setLedgerView("orders")}>Open orders ({pairOrders.filter((order) => order.status === "OPEN").length})</button><button className={ledgerView === "positions" ? "active" : ""} onClick={() => setLedgerView("positions")}>Positions</button><button className={ledgerView === "history" ? "active" : ""} onClick={() => setLedgerView("history")}>Order history</button></nav><span>PAPER ACCOUNT · FEES {costs.takerFeePercent.toFixed(2)}% / SIDE · SLIPPAGE {costs.slippagePercent.toFixed(2)}% / SIDE</span></header>{pairOrders.length ? <div className="orders-table"><div className="orders-row head"><span>Side</span><span>Entry</span><span>Notional</span><span>Risk</span><span>Status</span></div>{pairOrders.filter((order) => ledgerView === "history" || order.status === "OPEN").slice(0, 8).map((order) => <div className="orders-row" key={order.id}><strong className={order.side === "LONG" ? "positive" : "negative"}>{order.side}</strong><span>{formatPrice(order.entry)}</span><span>{formatQuoteCurrency(order.sizeUsd, quote)}</span><span>{formatQuoteCurrency(order.riskUsd, quote)}</span><span>{order.status}</span></div>)}</div> : <div className="orders-empty">No paper positions for {displaySymbol(symbol)} yet.</div>}</section>
      <p className="exchange-caveat">Paper only. Fees and liquidation are estimates; quote-currency balances are simulated rather than FX-converted account funds.</p>
    </main>
  );
}

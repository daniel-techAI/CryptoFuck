import { AlertTriangle, Calculator, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { displaySymbol, type BinanceSymbol } from "../lib/binance";
import { formatCompactUsd, formatPrice } from "../lib/format";
import type { LiveTicker, MarketForecast, PaperOrder, PaperOrderRequest, PortfolioSummary } from "../types";

type TradingMode = "spot" | "futures";

interface TradingSimulatorProps {
  mode: TradingMode;
  symbol: BinanceSymbol;
  ticker: LiveTicker;
  forecast: MarketForecast | null;
  portfolio: PortfolioSummary;
  orders: PaperOrder[];
  submitting: boolean;
  onSubmit: (request: PaperOrderRequest) => Promise<void>;
  onKillSwitch: (enabled: boolean) => Promise<void>;
}

export function TradingSimulator({ mode, symbol, ticker, forecast, portfolio, orders, submitting, onSubmit, onKillSwitch }: TradingSimulatorProps) {
  const [side, setSide] = useState<"LONG" | "SHORT">(forecast?.direction === "BEARISH" ? "SHORT" : "LONG");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [entry, setEntry] = useState(ticker.price);
  const [capital, setCapital] = useState(mode === "spot" ? 1_000 : 500);
  const [leverage, setLeverage] = useState(mode === "spot" ? 1 : 5);
  const [stopLoss, setStopLoss] = useState(forecast?.levels.invalidation ?? ticker.price * 0.985);
  const [takeProfit, setTakeProfit] = useState(forecast?.levels.target1 ?? ticker.price * 1.025);
  const [error, setError] = useState("");
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
    <main className="trading-page">
      <header className="page-title"><div><h1>{mode === "spot" ? "Spot paper trading" : "Futures simulator"}</h1><p>{displaySymbol(symbol)} - live Binance mark price - no exchange orders are sent</p></div><div className="paper-balance"><WalletCards /><span>Paper equity<strong>{formatCompactUsd(portfolio.equity)}</strong></span></div></header>
      <div className="trading-grid">
        <form className="order-entry-panel" onSubmit={submit}>
          <header><h2>Order entry</h2><span className="paper-only"><ShieldCheck />PAPER ONLY</span></header>
          <div className="side-switch"><button type="button" className={side === "LONG" ? "buy active" : "buy"} onClick={() => chooseSide("LONG")}>{sideLabels[0]}</button><button type="button" className={side === "SHORT" ? "sell active" : "sell"} onClick={() => chooseSide("SHORT")}>{sideLabels[1]}</button></div>
          <div className="order-type-switch"><button type="button" className={orderType === "MARKET" ? "active" : ""} onClick={() => setOrderType("MARKET")}>Market</button><button type="button" className={orderType === "LIMIT" ? "active" : ""} onClick={() => setOrderType("LIMIT")}>Limit</button></div>
          <label>Live price<div className="field-value"><input type="number" step="any" value={orderType === "MARKET" ? ticker.price || "" : entry || ""} disabled={orderType === "MARKET"} onChange={(event) => setEntry(Number(event.target.value))} /><span>USDT</span></div></label>
          <label>{mode === "spot" ? "Order value" : "Margin"}<div className="field-value"><input type="number" min="10" step="10" value={capital} onChange={(event) => setCapital(Number(event.target.value))} /><span>USDT</span></div></label>
          {mode === "futures" ? <label>Leverage<div className="leverage-field"><input type="range" min="1" max="20" value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} /><strong>{leverage}x</strong></div></label> : null}
          <label>Stop loss<div className="field-value"><input type="number" step="any" value={stopLoss || ""} onChange={(event) => setStopLoss(Number(event.target.value))} /><span>USDT</span></div></label>
          <label>Take profit<div className="field-value"><input type="number" step="any" value={takeProfit || ""} onChange={(event) => setTakeProfit(Number(event.target.value))} /><span>USDT</span></div></label>
          {error ? <p className="form-error"><AlertTriangle />{error}</p> : null}
          <button className={`submit-paper ${side === "LONG" ? "buy" : "sell"}`} disabled={submitting || portfolio.killSwitch || !liveEntry}>{portfolio.killSwitch ? "Kill switch active" : submitting ? "Placing paper order..." : `Place paper ${sideLabels[side === "LONG" ? 0 : 1]}`}</button>
          <p className="execution-note"><LockKeyhole />Simulation only. API keys are never requested by this screen.</p>
        </form>

        <section className="cost-panel">
          <header><h2><Calculator />Realistic cost model</h2><span>EDITABLE IN A FUTURE RELEASE</span></header>
          <div className="live-mark"><span>Binance mark / last</span><strong>{ticker.price ? formatPrice(ticker.price) : "Waiting..."}</strong><small>Bid {ticker.bid ? formatPrice(ticker.bid) : "-"} / Ask {ticker.ask ? formatPrice(ticker.ask) : "-"}</small></div>
          <dl className="cost-list">
            <div><dt>Position notional</dt><dd>{formatCompactUsd(costs.notional)}</dd></div>
            <div><dt>Assumed taker fee</dt><dd>{costs.takerFeePercent.toFixed(2)}% / side</dd></div>
            <div><dt>Modeled slippage</dt><dd>{costs.slippagePercent.toFixed(2)}% / side</dd></div>
            <div><dt>Estimated round-trip costs</dt><dd>{formatCompactUsd(costs.roundTripCost)}</dd></div>
            <div><dt>Risk to stop + costs</dt><dd className={costs.totalRisk > portfolio.equity * 0.01 ? "negative" : ""}>{formatCompactUsd(costs.totalRisk)}</dd></div>
            {mode === "futures" ? <div><dt>Approx. liquidation</dt><dd>{formatPrice(costs.liquidation)}</dd></div> : null}
          </dl>
          <p className="cost-caveat">Fees vary by Binance account tier, maker/taker status, region, discounts and instrument. Liquidation is an educational estimate; funding and maintenance tiers are not included.</p>
          <div className="kill-switch"><span><strong>Portfolio kill switch</strong><small>Blocks every new paper order</small></span><button className={portfolio.killSwitch ? "engaged" : ""} type="button" onClick={() => void onKillSwitch(!portfolio.killSwitch)}>{portfolio.killSwitch ? "ENGAGED" : "READY"}</button></div>
        </section>
      </div>
      <section className="orders-panel"><header><h2>Recent paper positions</h2><span>{pairOrders.filter((order) => order.status === "OPEN").length} OPEN</span></header>{pairOrders.length ? <div className="orders-table"><div className="orders-row head"><span>Side</span><span>Entry</span><span>Notional</span><span>Risk</span><span>Status</span></div>{pairOrders.slice(0, 8).map((order) => <div className="orders-row" key={order.id}><strong className={order.side === "LONG" ? "positive" : "negative"}>{order.side}</strong><span>{formatPrice(order.entry)}</span><span>{formatCompactUsd(order.sizeUsd)}</span><span>{formatCompactUsd(order.riskUsd)}</span><span>{order.status}</span></div>)}</div> : <div className="orders-empty">No paper positions for {displaySymbol(symbol)} yet.</div>}</section>
    </main>
  );
}

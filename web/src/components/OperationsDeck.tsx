import { Activity, BellRing, Bot, FlaskConical, History, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { formatCompactUsd, formatPercent, formatPrice } from "../lib/format";
import type { MarketSignal, MarketSnapshot, PaperOrder } from "../types";

interface OperationsDeckProps {
  snapshot: MarketSnapshot;
  signal: MarketSignal;
  orders: PaperOrder[];
  autoScan: boolean;
  onAutoScan: (enabled: boolean) => void;
  signalAlerts: boolean;
  alertThreshold: number;
  onSignalAlerts: (enabled: boolean) => void;
  onAlertThreshold: (threshold: number) => void;
}

function scoreWidth(value: number) {
  return `${Math.max(4, Math.abs(value))}%`;
}

export function OperationsDeck({ snapshot, signal, orders, autoScan, onAutoScan, signalAlerts, alertThreshold, onSignalAlerts, onAlertThreshold }: OperationsDeckProps) {
  const backtest = snapshot.backtests?.[signal.pair];
  const history = signal.history;
  const factors = Object.entries(signal.factors ?? {}).filter(([, value]) => value !== 0);
  return (
    <div className="operations-deck">
      <section id="strategies" className="ops-panel" aria-labelledby="strategy-title">
        <header><span><FlaskConical />Strategy reality check</span><small>{signal.displayPair} · rolling data window</small></header>
        {backtest ? <div className="backtest-grid">
          <div><span>Net return</span><strong className={backtest.totalReturnPercent >= 0 ? "positive" : "negative"}>{formatPercent(backtest.totalReturnPercent)}</strong></div>
          <div><span>Max drawdown</span><strong>{backtest.maxDrawdownPercent.toFixed(2)}%</strong></div>
          <div><span>Win rate</span><strong>{backtest.winRatePercent.toFixed(1)}%</strong></div>
          <div><span>Trades</span><strong>{backtest.trades}</strong></div>
          <div><span>Profit factor</span><strong>{Number.isFinite(backtest.profitFactor) ? backtest.profitFactor.toFixed(2) : "—"}</strong></div>
          <div><span>Fees</span><strong>{formatCompactUsd(backtest.feesPaid)}</strong></div>
        </div> : <p className="empty-copy">Backtest summary unavailable in this snapshot.</p>}
        <p className="ops-note">Closed candles only · 0.10% fees · 0.05% modeled slippage · historical performance is not predictive</p>
      </section>

      <section className="ops-panel" aria-labelledby="memory-title">
        <header><span id="memory-title"><History />Signal memory</span><small className={`memory-label ${history?.label.toLowerCase() ?? "stable"}`}>{history?.label ?? "STABLE"}</small></header>
        <div className="memory-timeline">
          {[{ label: "12h ago", score: history?.score12hAgo ?? signal.score }, { label: "6h ago", score: history?.score6hAgo ?? signal.score }, { label: "Now", score: signal.score }].map((point) => (
            <div key={point.label}><span>{point.label}</span><div className={point.score >= 0 ? "score-positive" : "score-negative"}><i style={{ width: scoreWidth(point.score) }} /></div><strong>{point.score > 0 ? "+" : ""}{point.score}</strong></div>
          ))}
        </div>
        <div className="factor-list">
          {factors.map(([name, value]) => <div key={name}><span>{name}</span><i className={value >= 0 ? "factor-positive" : "factor-negative"} style={{ width: scoreWidth(value) }} /><strong>{value > 0 ? "+" : ""}{value}</strong></div>)}
        </div>
        <p className="ops-note">{history?.flips12h ?? 0} direction changes in 12h. Rotating signals deserve smaller size or no trade.</p>
      </section>

      <section id="ledger" className="ops-panel" aria-labelledby="ledger-title">
        <header><span id="ledger-title"><WalletCards />Paper ledger</span><small>{orders.filter((order) => order.status === "OPEN").length} open</small></header>
        {orders.length === 0 ? <div className="empty-state"><WalletCards /><p>No paper trades yet.</p><small>Configure a scanner row to test the thesis without capital.</small></div> : <div className="ledger-list">
          {orders.slice(0, 4).map((order) => <div key={order.id} className="ledger-row"><span className={`direction ${order.side.toLowerCase()}`}>{order.side}</span><strong>{order.pair.replace("/", " / ")}</strong><span>{formatPrice(order.entry)}</span><span>risk {formatCompactUsd(order.riskUsd)}</span><small>{order.status}</small></div>)}
        </div>}
      </section>

      <section id="automation" className="ops-panel" aria-labelledby="automation-title">
        <header><span id="automation-title"><Bot />Automation</span><small>{snapshot.source}</small></header>
        <div className="automation-list">
          <div><span><RefreshCw />GitHub data refresh</span><strong>Minutes 17 &amp; 47</strong><small>Scheduled Pages workflow</small></div>
          <div><span><Activity />Local auto scan</span><button className={autoScan ? "toggle-active" : ""} onClick={() => onAutoScan(!autoScan)} aria-pressed={autoScan}>{autoScan ? "ON · 5 MIN" : "OFF"}</button><small>Runs only while this tab is open</small></div>
          <div><span><BellRing />Conviction alerts</span><div className="alert-controls"><select aria-label="Signal alert threshold" value={alertThreshold} onChange={(event) => onAlertThreshold(Number(event.target.value))}>{[65, 70, 75, 80, 85].map((value) => <option key={value} value={value}>{value}%+</option>)}</select><button className={signalAlerts ? "toggle-active" : ""} onClick={() => onSignalAlerts(!signalAlerts)} aria-pressed={signalAlerts}>{signalAlerts ? "ON" : "OFF"}</button></div><small>Notifies only for LONG/SHORT signals while NOCTURNE is open</small></div>
          <div><span><ShieldCheck />Execution boundary</span><strong>Paper only</strong><small>Live adapter stays server-gated</small></div>
        </div>
      </section>
    </div>
  );
}

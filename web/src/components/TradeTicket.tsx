import { ShieldAlert, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { formatPrice } from "../lib/format";
import { calculateTradeRisk } from "../lib/risk";
import type { MarketSignal, PaperOrderRequest, PortfolioSummary } from "../types";

interface TradeTicketProps {
  signal: MarketSignal;
  portfolio: PortfolioSummary;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (request: PaperOrderRequest) => Promise<void>;
}

function cleanPrice(value: number, reference: number): number {
  return Number(value.toFixed(reference >= 1 ? 2 : 6));
}

export function TradeTicket({ signal, portfolio, submitting, onClose, onSubmit }: TradeTicketProps) {
  const [side, setSide] = useState<"LONG" | "SHORT">(signal.direction === "SHORT" ? "SHORT" : "LONG");
  const [entry, setEntry] = useState(cleanPrice(signal.price, signal.price));
  const [stopLoss, setStopLoss] = useState(cleanPrice(signal.levels.invalidation, signal.price));
  const [takeProfit, setTakeProfit] = useState(cleanPrice(signal.levels.targets[0], signal.price));
  const [sizeUsd, setSizeUsd] = useState(Math.min(2_000, portfolio.equity * 0.02));
  const [error, setError] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
  const selectSide = (nextSide: "LONG" | "SHORT") => {
    const sideMultiplier = nextSide === "LONG" ? 1 : -1;
    const distance = Math.max(signal.indicators.atr14 * 1.6, entry * 0.008);
    setSide(nextSide);
    setStopLoss(cleanPrice(entry - sideMultiplier * distance, entry));
    setTakeProfit(cleanPrice(entry + sideMultiplier * distance * 1.5, entry));
    setError("");
  };
  const risk = calculateTradeRisk(entry, stopLoss, sizeUsd);
  const portfolioRisk = portfolio.equity ? risk.riskUsd / portfolio.equity * 100 : 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try { await onSubmit({ pair: signal.pair, side, entry, stopLoss, takeProfit, sizeUsd, signalScore: signal.score }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not place paper order."); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="trade-ticket" role="dialog" aria-modal="true" aria-labelledby="trade-ticket-title" aria-describedby="trade-ticket-description">
        <header><div><h2 id="trade-ticket-title">Configure paper trade</h2><p>{signal.displayPair} <strong>{formatPrice(signal.price)}</strong></p></div><button ref={closeButton} onClick={onClose} aria-label="Close trade ticket"><X /></button></header>
        <form onSubmit={submit}>
          <fieldset className="direction-picker"><legend>Direction</legend><button type="button" className={side === "LONG" ? "active" : ""} onClick={() => selectSide("LONG")}>Long</button><button type="button" className={side === "SHORT" ? "active" : ""} onClick={() => selectSide("SHORT")}>Short</button></fieldset>
          <label>Entry <span><input type="number" step="any" min="0" value={entry} onChange={(event) => setEntry(Number(event.target.value))} /> USD</span></label>
          <label>Position size <span><input type="number" step="100" min="100" value={sizeUsd} onChange={(event) => setSizeUsd(Number(event.target.value))} /> USD</span></label>
          <div className="size-presets">{[0.01, 0.02, 0.05, 0.1].map((portion) => <button type="button" key={portion} onClick={() => setSizeUsd(Math.round(portfolio.equity * portion))}>{portion * 100}%</button>)}</div>
          <label>Stop loss <span><input type="number" step="any" min="0" value={stopLoss} onChange={(event) => setStopLoss(Number(event.target.value))} /> USD</span></label>
          <label>Take profit <span><input type="number" step="any" min="0" value={takeProfit} onChange={(event) => setTakeProfit(Number(event.target.value))} /> USD</span></label>
          <div className={`trade-risk ${portfolioRisk > 1 ? "invalid" : ""}`}><ShieldAlert /><span>Risk per trade<strong>${risk.riskUsd.toFixed(2)} · {portfolioRisk.toFixed(2)}% equity</strong></span></div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <p className="simulation-note" id="trade-ticket-description">Simulation only. No exchange order will be sent.</p>
          <div className="ticket-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={submitting || portfolio.killSwitch}>{submitting ? "Submitting…" : portfolio.killSwitch ? "Kill switch active" : "Place paper trade"}</button></div>
        </form>
      </section>
    </div>
  );
}

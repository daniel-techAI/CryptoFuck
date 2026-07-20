import { ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw, SlidersHorizontal } from "lucide-react";
import { formatPercent, formatPrice } from "../lib/format";
import type { MarketSignal } from "../types";

interface MarketScannerProps {
  signals: MarketSignal[];
  selectedPair: string;
  onSelect: (signal: MarketSignal) => void;
  onConfigure: (signal: MarketSignal) => void;
  scanning: boolean;
}
const DirectionIcon = ({ direction }: { direction: MarketSignal["direction"] }) =>
  direction === "LONG" ? <ArrowUpRight /> : direction === "SHORT" ? <ArrowDownRight /> : <ArrowRight />;

export function MarketScanner({ signals, selectedPair, onSelect, onConfigure, scanning }: MarketScannerProps) {
  return (
    <section id="markets" className="scanner-panel" aria-labelledby="scanner-title">
      <div className="section-heading">
        <h2 id="scanner-title">Market scanner</h2>
        <span><RefreshCw className={scanning ? "spinning" : ""} />{scanning ? "Scanning closed candles" : "Auto scan ready"}</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>#</th><th>Pair</th><th>Price</th><th>24h</th><th>Regime</th><th>Signal</th><th>Confidence</th><th>Risk</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {signals.map((signal, index) => (
              <tr key={signal.pair} className={selectedPair === signal.pair ? "selected" : ""} onClick={() => onSelect(signal)}>
                <td>{index + 1}</td>
                <td><button className="pair-button" onClick={() => onSelect(signal)}>{signal.displayPair}</button></td>
                <td>{formatPrice(signal.price)}</td>
                <td className={signal.change24h >= 0 ? "positive" : "negative"}>{formatPercent(signal.change24h * 100)}</td>
                <td className="cyan">{signal.regime}</td>
                <td><span className={`direction ${signal.direction.toLowerCase()}`}><DirectionIcon direction={signal.direction} />{signal.direction}</span></td>
                <td><span className="mini-meter">{Array.from({ length: 6 }, (_, meterIndex) => <i key={meterIndex} className={meterIndex < Math.round(signal.probability / 16.7) ? "filled" : ""} />)}</span>{signal.probability}%</td>
                <td className={`risk-${signal.risk.toLowerCase()}`}>{signal.risk}</td>
                <td><button className="configure-button" onClick={(event) => { event.stopPropagation(); onConfigure(signal); }}><SlidersHorizontal />Configure</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

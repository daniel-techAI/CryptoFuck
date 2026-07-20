import { CircleDot, Crosshair, Gauge, Target, XCircle } from "lucide-react";
import { formatPrice } from "../lib/format";
import type { MarketSignal } from "../types";

export function SignalThesis({ signal }: { signal: MarketSignal }) {
  const directionClass = signal.direction.toLowerCase();
  return (
    <aside className="thesis-panel" aria-label="Signal thesis">
      <h2>Signal thesis</h2>
      <div className="thesis-summary">
        <div className={`probability ${directionClass}`}>
          <span>{signal.direction}</span>
          <strong>{signal.probability}%</strong>
          <small>Probability score</small>
        </div>
        <div className="regime">
          <span>Regime</span><strong>{signal.regime}</strong>
          <span>Confidence</span>
          <div className="confidence-meter" aria-label={`${signal.confidence} confidence`}>
            {Array.from({ length: 8 }, (_, index) => <i key={index} className={index < Math.round(signal.probability / 12.5) ? "filled" : ""} />)}
          </div>
        </div>
      </div>
      <dl className="level-list">
        <div><dt><Crosshair />Entry</dt><dd>{formatPrice(signal.levels.entry[0])} – {formatPrice(signal.levels.entry[1])}</dd></div>
        <div><dt><XCircle />Invalidation</dt><dd className="negative">{formatPrice(signal.levels.invalidation)} USD</dd></div>
        <div className="targets"><dt><Target />Targets</dt><dd>{signal.levels.targets.map((target, index) => <span key={target}><b>T{index + 1}</b>{formatPrice(target)} <small>({signal.levels.riskReward[index]}R)</small></span>)}</dd></div>
      </dl>
      <div className="why-now">
        <h3><CircleDot />Why now</h3>
        <ul>{signal.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="method-note"><Gauge />Score {signal.score > 0 ? "+" : ""}{signal.score}/100 · not a guarantee</div>
    </aside>
  );
}

import { Activity, ShieldAlert } from "lucide-react";
import { formatPrice } from "../lib/format";
import type { MarketForecast } from "../types";

function mainProbability(forecast: MarketForecast): number {
  if (forecast.direction === "BULLISH") return forecast.probabilities.bullish;
  if (forecast.direction === "BEARISH") return forecast.probabilities.bearish;
  return forecast.probabilities.neutral;
}

export function ForecastPanel({ forecast, interval }: { forecast: MarketForecast | null; interval: string }) {
  if (!forecast) {
    return <aside className="forecast-panel forecast-loading"><Activity /><strong>Building forecast</strong><p>At least 60 Binance candles are required before NOCTURNE publishes a signal.</p></aside>;
  }
  const probability = mainProbability(forecast);
  const validation = forecast.validation;
  const validated = validation.sampleSize >= 20;
  const neutral = forecast.direction === "NEUTRAL";
  return (
    <aside className={`forecast-panel ${forecast.direction.toLowerCase()}`} aria-label="Market forecast">
      <header><h2>Market forecast</h2><span>{forecast.confidence} CONFIDENCE</span></header>
      <div className="forecast-call"><strong>{forecast.direction}</strong><b>{probability}%</b><small>next {forecast.horizonCandles} x {interval} candles</small></div>
      <div className="probability-bar" aria-label={`${forecast.probabilities.bullish}% bullish, ${forecast.probabilities.neutral}% neutral, ${forecast.probabilities.bearish}% bearish`}>
        <i className="bull" style={{ width: `${forecast.probabilities.bullish}%` }} /><i className="neutral" style={{ width: `${forecast.probabilities.neutral}%` }} /><i className="bear" style={{ width: `${forecast.probabilities.bearish}%` }} />
      </div>
      <div className="probability-labels"><span><b>{forecast.probabilities.bullish}%</b>BULLISH</span><span><b>{forecast.probabilities.neutral}%</b>NEUTRAL</span><span><b>{forecast.probabilities.bearish}%</b>BEARISH</span></div>
      <div className="forecast-evidence">
        {forecast.evidence.map((item) => <div key={item.label}><span>{item.label}</span><i /><strong className={item.tone}>{item.value}</strong></div>)}
        <div><span>15m / 1h context</span><i /><strong className={forecast.contextConsensus === "ALIGNED" ? "bullish" : forecast.contextConsensus === "CONFLICT" ? "bearish" : "neutral"}>{forecast.context.length ? `${forecast.context.map((item) => `${item.interval} ${item.direction}`).join(" / ")} - ${forecast.contextConsensus}` : "Loading"}</strong></div>
      </div>
      <div className="forecast-levels">
        <div><span>{neutral ? "Observation zone" : "Entry zone"}</span><strong>{formatPrice(forecast.levels.entryLow)} - {formatPrice(forecast.levels.entryHigh)}</strong></div>
        <div><span>{neutral ? "Downside trigger" : "Invalidation"}</span><strong className="bearish-text">{formatPrice(forecast.levels.invalidation)}</strong></div>
        <div><span>{neutral ? "Upside trigger" : "Target 1"}</span><strong className="bullish-text">{formatPrice(forecast.levels.target1)}</strong></div>
        <div><span>{neutral ? "Upper extension" : "Target 2"}</span><strong className="bullish-text">{formatPrice(forecast.levels.target2)}</strong></div>
      </div>
      <div className={`validation-strip ${validated ? "" : "limited"}`}><ShieldAlert /><span><strong>{validated ? `${validation.hitRatePercent.toFixed(1)}% directional accuracy` : "Limited validation sample"}</strong><small>{validation.sampleSize} prior signals - {validation.profitableRatePercent.toFixed(1)}% net-positive after modeled costs</small></span></div>
      <p className="forecast-disclaimer">Probabilistic signal, not a guarantee or financial advice.</p>
    </aside>
  );
}

import { Maximize2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { formatPercent, formatPrice } from "../lib/format";
import type { MarketSignal } from "../types";

interface Point { x: number; y: number; candleIndex: number }

export function PriceChart({ signal, scanning }: { signal: MarketSignal; scanning: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const gradientId = useId().replaceAll(":", "");
  const { points, path, area, min, max, volumes } = useMemo(() => {
    const candles = signal.candles.slice(-96);
    const prices = candles.flatMap((candle) => [candle.high, candle.low]);
    const rawMin = Math.min(...prices, signal.levels.invalidation);
    const rawMax = Math.max(...prices, ...signal.levels.targets);
    const padding = (rawMax - rawMin) * 0.08 || rawMax * 0.02;
    const chartMin = rawMin - padding;
    const chartMax = rawMax + padding;
    const chartPoints: Point[] = candles.map((candle, index) => ({
      x: 22 + index / Math.max(candles.length - 1, 1) * 706,
      y: 22 + (chartMax - candle.close) / (chartMax - chartMin) * 250,
      candleIndex: index,
    }));
    const line = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const areaPath = `${line} L728 292 L22 292 Z`;
    const maxVolume = Math.max(...candles.map((candle) => candle.volume), 1);
    return {
      points: chartPoints,
      path: line,
      area: areaPath,
      min: chartMin,
      max: chartMax,
      volumes: candles.map((candle, index) => ({ x: 22 + index / Math.max(candles.length - 1, 1) * 706, h: candle.volume / maxVolume * 38 })),
    };
  }, [signal]);
  const yFor = (value: number) => 22 + (max - value) / (max - min) * 250;
  const isPositive = signal.change24h >= 0;

  return (
    <section className={`price-panel ${expanded ? "expanded" : ""}`} aria-label={`${signal.displayPair} price chart`}>
      <div className="chart-toolbar">
        <div><strong>{signal.displayPair}</strong><span className="timeframe active">1h</span></div>
        <button aria-label={expanded ? "Close expanded chart" : "Expand chart"} onClick={() => setExpanded((value) => !value)}><Maximize2 /></button>
      </div>
      <div className="chart-price-row">
        <div>
          <span className="hero-price">{formatPrice(signal.price)}</span><small> USD</small>
          <p className={isPositive ? "positive" : "negative"}>{formatPercent(signal.change24h * 100)}</p>
        </div>
        <div className="ohlc-copy">
          <span>EMA20 <strong>{formatPrice(signal.indicators.ema20)}</strong></span>
          <span>EMA50 <strong>{formatPrice(signal.indicators.ema50)}</strong></span>
          <span>RSI <strong>{signal.indicators.rsi14.toFixed(1)}</strong></span>
        </div>
      </div>
      <div className="chart-canvas">
        <svg viewBox="0 0 780 340" preserveAspectRatio="none" role="img" aria-label={`${signal.displayPair} hourly closing prices`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c8f31d" stopOpacity="0.22" />
              <stop offset="1" stopColor="#c8f31d" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((line) => <line key={line} x1="20" x2="730" y1={28 + line * 62} y2={28 + line * 62} className="grid-line" />)}
          <rect x="20" y={yFor(signal.levels.entry[1])} width="710" height={Math.max(4, yFor(signal.levels.entry[0]) - yFor(signal.levels.entry[1]))} className="entry-zone" />
          <line x1="20" x2="730" y1={yFor(signal.levels.invalidation)} y2={yFor(signal.levels.invalidation)} className="risk-line" />
          <line x1="20" x2="730" y1={yFor(signal.levels.targets[0])} y2={yFor(signal.levels.targets[0])} className="target-line" />
          {volumes.map((volume, index) => <rect key={index} x={volume.x} y={305 - volume.h} width="3" height={volume.h} className="volume-bar" />)}
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={path} className="price-line" />
          {points.length ? <circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r="4" className="last-point" /> : null}
          <text x="736" y={yFor(signal.levels.targets[0]) + 4} className="zone-label target-label">T1</text>
          <text x="736" y={yFor(signal.levels.invalidation) + 4} className="zone-label risk-label">STOP</text>
          {scanning ? <rect x="0" y="0" width="3" height="310" className="scan-sweep" /> : null}
        </svg>
      </div>
      <div className="chart-footer">
        <span>{new Date(signal.candles.at(-96)?.timestamp ?? signal.candles[0].timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
        <span>96 hourly closes</span>
        <span>{new Date(signal.candles.at(-1)!.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
      </div>
    </section>
  );
}

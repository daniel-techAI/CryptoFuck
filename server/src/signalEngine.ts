import { atr, average, clamp, ema, rsi } from "./indicators.js";
import type { Candle, MarketSignal, SignalDirection } from "./types.js";

function money(value: number): string {
  return value >= 100 ? value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : value.toFixed(2);
}

export function evaluateSignal(pair: string, candles: Candle[], now = new Date()): MarketSignal {
  if (candles.length < 60) throw new Error(`${pair} needs at least 60 closed candles`);
  const closes = candles.map((candle) => candle.close);
  const latest = candles.at(-1)!;
  const previousDay = candles.at(-25)?.close ?? candles[0].close;
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);
  const atrPercent = atr14 / latest.close;
  const momentum24h = latest.close / previousDay - 1;
  const recentVolume = average(candles.slice(-5).map((candle) => candle.volume));
  const baselineVolume = Math.max(average(candles.slice(-25, -5).map((candle) => candle.volume)), 1e-9);
  const volumeRatio = recentVolume / baselineVolume;

  const trendComponent = clamp(((ema20 - ema50) / latest.close) / 0.025, -1, 1) * 35;
  const momentumComponent = clamp(momentum24h / 0.06, -1, 1) * 25;
  const rsiComponent = clamp((rsi14 - 50) / 24, -1, 1) * 15;
  const locationComponent = clamp((latest.close - ema20) / Math.max(atr14 * 1.5, 1e-9), -1, 1) * 15;
  const volumeDirection = Math.sign(latest.close - candles.at(-6)!.close);
  const volumeComponent = volumeDirection * clamp(volumeRatio - 1, 0, 1) * 10;
  const exhaustionPenalty = rsi14 > 74 ? -10 : rsi14 < 26 ? 10 : 0;
  const score = Math.round(clamp(
    trendComponent + momentumComponent + rsiComponent + locationComponent + volumeComponent + exhaustionPenalty,
    -100,
    100,
  ));

  const direction: SignalDirection = score >= 22 ? "LONG" : score <= -22 ? "SHORT" : "WAIT";
  const probability = Math.round(clamp(50 + Math.abs(score) * 0.45, 50, 92));
  const confidence = probability >= 75 ? "HIGH" : probability >= 62 ? "MEDIUM" : "LOW";
  const trendStrength = Math.abs(ema20 - ema50) / Math.max(atr14, 1e-9);
  const regime = atrPercent > 0.055
    ? "High volatility"
    : trendStrength > 1.1
      ? "Trend expansion"
      : Math.abs(momentum24h) > 0.03
        ? "Momentum"
        : "Range bound";
  const risk = atrPercent > 0.045 ? "HIGH" : atrPercent > 0.022 ? "MEDIUM" : "LOW";
  const side = direction === "SHORT" ? -1 : 1;
  const riskDistance = Math.max(atr14 * 1.6, latest.close * 0.008);
  const entryHalfWidth = Math.max(atr14 * 0.18, latest.close * 0.0015);
  const invalidation = latest.close - side * riskDistance;
  const targets = [1.5, 2.4, 3.2].map((multiple) => latest.close + side * riskDistance * multiple);

  const evidence = [
    `EMA20 is ${ema20 >= ema50 ? "above" : "below"} EMA50 by ${Math.abs((ema20 / ema50 - 1) * 100).toFixed(2)}%.`,
    `24h momentum is ${(momentum24h * 100).toFixed(2)}%.`,
    `RSI(14) is ${rsi14.toFixed(1)}${rsi14 > 70 ? ", an overheated reading" : rsi14 < 30 ? ", an oversold reading" : ", inside the neutral band"}.`,
    `Recent volume is ${volumeRatio.toFixed(2)}× its 20-hour baseline.`,
    `ATR implies ${(atrPercent * 100).toFixed(2)}% hourly range risk.`,
  ];

  return {
    pair,
    displayPair: pair.replace("/", " / "),
    price: latest.close,
    change24h: momentum24h,
    direction,
    score,
    probability,
    confidence,
    regime,
    risk,
    indicators: { ema20, ema50, rsi14, atr14, atrPercent, momentum24h, volumeRatio },
    levels: {
      entry: [latest.close - entryHalfWidth, latest.close + entryHalfWidth],
      invalidation,
      targets,
      riskReward: [1.5, 2.4, 3.2],
    },
    evidence,
    factors: {
      trend: Math.round(trendComponent),
      momentum: Math.round(momentumComponent),
      rsi: Math.round(rsiComponent),
      location: Math.round(locationComponent),
      volume: Math.round(volumeComponent),
      exhaustion: Math.round(exhaustionPenalty),
    },
    candles: candles.slice(-120),
    evaluatedAt: now.toISOString(),
  };
}

export function summarizeSignal(signal: MarketSignal): string {
  return `${signal.displayPair} ${signal.direction} ${signal.probability}% at ${money(signal.price)}`;
}

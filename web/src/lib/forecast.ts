import type { Candle, ForecastEvidence, ForecastValidation, MarketForecast } from "../types";

const HORIZON = 3;
const SIGNAL_THRESHOLD = 18;
const ROUND_TRIP_COST_PERCENT = 0.24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * multiplier + result[index - 1] * (1 - multiplier));
  }
  return result;
}

function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  const start = values.length - period;
  for (let index = start; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const ranges: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1].close;
    ranges.push(Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose)));
  }
  const recent = ranges.slice(-period);
  return recent.reduce((sum, value) => sum + value, 0) / Math.max(recent.length, 1);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

interface ScoreResult {
  score: number;
  indicators: MarketForecast["indicators"];
  factors: { trend: number; momentum: number; rsi: number; volume: number; volatility: number };
}

function scoreCandles(candles: Candle[]): ScoreResult {
  const usable = candles.slice(-120);
  const closes = usable.map((candle) => candle.close);
  const ema20Series = ema(closes, 20);
  const ema50Series = ema(closes, 50);
  const price = closes.at(-1) ?? 0;
  const ema20 = ema20Series.at(-1) ?? price;
  const ema50 = ema50Series.at(-1) ?? price;
  const ema20Past = ema20Series.at(-6) ?? ema20;
  const rsi14 = rsi(closes);
  const atr14 = atr(usable);
  const atrPercent = price ? atr14 / price * 100 : 0;
  const past = closes.at(-7) ?? closes[0] ?? price;
  const momentum = past ? (price / past - 1) * 100 : 0;
  const recentVolumes = usable.slice(-20).map((candle) => candle.volume);
  const baselineVolume = average(recentVolumes.slice(0, -1));
  const volumeRatio = baselineVolume ? (recentVolumes.at(-1) ?? 0) / baselineVolume : 1;

  const spreadPercent = price ? (ema20 - ema50) / price * 100 : 0;
  const slopePercent = ema20Past ? (ema20 / ema20Past - 1) * 100 : 0;
  const trend = clamp(spreadPercent * 42 + slopePercent * 18 + (price > ema20 ? 7 : -7), -38, 38);
  const momentumFactor = clamp(momentum * 8, -24, 24);
  let rsiFactor = clamp((rsi14 - 50) * 0.7, -14, 14);
  if (rsi14 > 76) rsiFactor -= (rsi14 - 76) * 1.5;
  if (rsi14 < 24) rsiFactor += (24 - rsi14) * 1.5;
  const candleDirection = usable.at(-1)?.close && usable.at(-1)!.open
    ? Math.sign(usable.at(-1)!.close - usable.at(-1)!.open)
    : 0;
  const volume = clamp((volumeRatio - 1) * 10 * candleDirection, -10, 10);
  const volatility = atrPercent > 2.2 ? -Math.min(10, (atrPercent - 2.2) * 4) * Math.sign(trend + momentumFactor || 1) : 0;
  const score = clamp(trend + momentumFactor + rsiFactor + volume + volatility, -100, 100);

  return {
    score,
    indicators: { ema20, ema50, rsi14, atr14, atrPercent, momentum, volumeRatio },
    factors: { trend, momentum: momentumFactor, rsi: rsiFactor, volume, volatility },
  };
}

function validateForecast(candles: Candle[]): ForecastValidation {
  const closed = candles.slice(0, -1);
  const start = Math.max(65, closed.length - 220);
  const returns: number[] = [];
  let directionalWins = 0;
  let profitableOutcomes = 0;
  let grossWins = 0;
  let grossLosses = 0;
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (let index = start; index < closed.length - HORIZON; index += 1) {
    const sample = closed.slice(Math.max(0, index - 119), index + 1);
    const score = scoreCandles(sample).score;
    if (Math.abs(score) < SIGNAL_THRESHOLD) continue;
    const entry = closed[index].close;
    const exit = closed[index + HORIZON].close;
    const side = score > 0 ? 1 : -1;
    const directionalReturn = side * (exit / entry - 1) * 100;
    const netReturn = directionalReturn - ROUND_TRIP_COST_PERCENT;
    returns.push(netReturn);
    if (directionalReturn > 0) directionalWins += 1;
    if (netReturn > 0) {
      profitableOutcomes += 1;
      grossWins += netReturn;
    } else grossLosses += Math.abs(netReturn);
    equity *= 1 + netReturn / 100;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak ? (peak - equity) / peak * 100 : 0);
  }

  return {
    sampleSize: returns.length,
    hitRatePercent: returns.length ? directionalWins / returns.length * 100 : 0,
    profitableRatePercent: returns.length ? profitableOutcomes / returns.length * 100 : 0,
    averageNetReturnPercent: average(returns),
    profitFactor: grossLosses ? grossWins / grossLosses : grossWins ? Number.POSITIVE_INFINITY : 0,
    maxDrawdownPercent: maxDrawdown,
    roundTripCostPercent: ROUND_TRIP_COST_PERCENT,
  };
}

function probabilityDistribution(score: number, validation: ForecastValidation) {
  const evidenceMagnitude = Math.abs(score);
  const weakValidation = validation.sampleSize >= 20 && validation.hitRatePercent < 48;
  const neutral = Math.round(clamp((weakValidation ? 62 : 48) - evidenceMagnitude * (weakValidation ? 0.18 : 0.45), weakValidation ? 42 : 12, 62));
  const directionalPool = 100 - neutral;
  const reliabilityShift = validation.sampleSize >= 20 ? clamp((validation.hitRatePercent - 50) * 0.18, -5, 5) : -3;
  const adjustedScore = score + Math.sign(score || 1) * reliabilityShift;
  const bullishShare = 1 / (1 + Math.exp(-adjustedScore / 18));
  let bullish = Math.round(directionalPool * bullishShare);
  bullish = clamp(bullish, 5, 86);
  const bearish = 100 - neutral - bullish;
  return { bullish, neutral, bearish };
}

function tone(score: number): ForecastEvidence["tone"] {
  return score > 2 ? "bullish" : score < -2 ? "bearish" : "neutral";
}

function factorLabel(value: number, positive: string, negative: string, neutral: string): string {
  if (value > 2) return positive;
  if (value < -2) return negative;
  return neutral;
}

export function buildForecast(candles: Candle[]): MarketForecast | null {
  if (candles.length < 60) return null;
  const scored = scoreCandles(candles);
  const validation = validateForecast(candles);
  const probabilities = probabilityDistribution(scored.score, validation);
  const validationRejectsSignal = validation.sampleSize >= 20 && validation.hitRatePercent < 48;
  const direction = validationRejectsSignal ? "NEUTRAL" : scored.score >= SIGNAL_THRESHOLD ? "BULLISH" : scored.score <= -SIGNAL_THRESHOLD ? "BEARISH" : "NEUTRAL";
  const leadProbability = Math.max(probabilities.bullish, probabilities.neutral, probabilities.bearish);
  const confidence = leadProbability >= 70 && validation.sampleSize >= 20 ? "HIGH" : leadProbability >= 58 ? "MEDIUM" : "LOW";
  const price = candles.at(-1)!.close;
  const atrValue = Math.max(scored.indicators.atr14, price * 0.0025);
  const side = direction === "BEARISH" ? -1 : 1;
  const entryLow = direction === "BEARISH" ? price - atrValue * 0.25 : price - atrValue * 0.15;
  const entryHigh = direction === "BEARISH" ? price + atrValue * 0.15 : price + atrValue * 0.25;
  const evidence: ForecastEvidence[] = [
    { label: "Trend", value: factorLabel(scored.factors.trend, "Bullish structure", "Bearish structure", "Mixed"), score: scored.factors.trend, tone: tone(scored.factors.trend) },
    { label: "Momentum", value: `${scored.indicators.momentum >= 0 ? "+" : ""}${scored.indicators.momentum.toFixed(2)}% / 6 candles`, score: scored.factors.momentum, tone: tone(scored.factors.momentum) },
    { label: "RSI (14)", value: scored.indicators.rsi14.toFixed(1), score: scored.factors.rsi, tone: tone(scored.factors.rsi) },
    { label: "Volume", value: `${scored.indicators.volumeRatio.toFixed(2)}x average`, score: scored.factors.volume, tone: tone(scored.factors.volume) },
    { label: "Volatility", value: `${scored.indicators.atrPercent.toFixed(2)}% ATR`, score: scored.factors.volatility, tone: tone(scored.factors.volatility) },
  ];

  return {
    direction,
    horizonCandles: HORIZON,
    score: Math.round(scored.score),
    confidence,
    probabilities,
    indicators: scored.indicators,
    evidence,
    levels: {
      entryLow,
      entryHigh,
      invalidation: price - side * atrValue * 1.5,
      target1: price + side * atrValue * 2,
      target2: price + side * atrValue * 3.25,
    },
    validation,
    context: [],
    contextConsensus: "UNAVAILABLE",
    evaluatedAt: candles.at(-1)!.timestamp,
  };
}

export function applyTimeframeContext(forecast: MarketForecast | null, context: MarketForecast["context"]): MarketForecast | null {
  if (!forecast || context.length === 0) return forecast;
  const directional = context.filter((item) => item.direction !== "NEUTRAL");
  if (forecast.direction === "NEUTRAL" || directional.length === 0) return { ...forecast, context, contextConsensus: "MIXED" };
  const aligned = directional.filter((item) => item.direction === forecast.direction).length;
  const against = directional.length - aligned;
  if (against === 0) return { ...forecast, context, contextConsensus: "ALIGNED" };
  if (aligned > 0) return { ...forecast, context, contextConsensus: "MIXED", confidence: forecast.confidence === "HIGH" ? "MEDIUM" : forecast.confidence };

  const probabilities = { ...forecast.probabilities };
  const directionKey = forecast.direction === "BULLISH" ? "bullish" : "bearish";
  const reduction = Math.min(10, Math.max(0, probabilities[directionKey] - 35));
  probabilities[directionKey] -= reduction;
  probabilities.neutral += reduction;
  return { ...forecast, context, contextConsensus: "CONFLICT", confidence: "LOW", probabilities };
}

import type { Candle } from "./types.js";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function ema(values: number[], period: number): number {
  if (values.length < period) throw new Error(`EMA${period} requires ${period} values`);
  const seed = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const multiplier = 2 / (period + 1);
  return values.slice(period).reduce(
    (current, value) => value * multiplier + current * (1 - multiplier),
    seed,
  );
}
export function rsi(values: number[], period = 14): number {
  if (values.length <= period) throw new Error(`RSI${period} requires ${period + 1} values`);
  const changes = values.slice(1).map((value, index) => value - values[index]);
  let gains = 0;
  let losses = 0;
  for (const change of changes.slice(0, period)) {
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  for (const change of changes.slice(period)) {
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (averageLoss === 0) return 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

export function atr(candles: Candle[], period = 14): number {
  if (candles.length <= period) throw new Error(`ATR${period} requires ${period + 1} candles`);
  const ranges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  let current = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of ranges.slice(period)) current = (current * (period - 1) + value) / period;
  return current;
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

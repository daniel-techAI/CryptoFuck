import { describe, expect, it } from "vitest";
import type { Candle } from "../types";
import { applyTimeframeContext, buildForecast, ema } from "./forecast";

function trendCandles(direction: 1 | -1, count = 280): Candle[] {
  let price = 100;
  return Array.from({ length: count }, (_, index) => {
    const open = price;
    price *= 1 + direction * 0.002 + Math.sin(index / 7) * 0.00025;
    const close = price;
    return {
      timestamp: 1_700_000_000_000 + index * 60_000,
      open,
      high: Math.max(open, close) * 1.001,
      low: Math.min(open, close) * 0.999,
      close,
      volume: 1_000 + index * 3,
    };
  });
}

describe("live forecast", () => {
  it("builds a bullish forecast for a persistent uptrend", () => {
    const forecast = buildForecast(trendCandles(1));
    expect(forecast?.direction).toBe("BULLISH");
    expect(forecast!.probabilities.bullish).toBeGreaterThan(forecast!.probabilities.bearish);
    expect(forecast!.levels.invalidation).toBeLessThan(forecast!.levels.target1);
    expect(forecast!.validation.sampleSize).toBeGreaterThan(20);
  });

  it("builds a bearish forecast for a persistent downtrend", () => {
    const forecast = buildForecast(trendCandles(-1));
    expect(forecast?.direction).toBe("BEARISH");
    expect(forecast!.probabilities.bearish).toBeGreaterThan(forecast!.probabilities.bullish);
    expect(forecast!.levels.invalidation).toBeGreaterThan(forecast!.levels.target1);
  });

  it("returns no forecast until the indicator window is trustworthy", () => {
    expect(buildForecast(trendCandles(1, 40))).toBeNull();
  });

  it("calculates a stable exponential moving average", () => {
    expect(ema([10, 10, 10, 10], 3)).toEqual([10, 10, 10, 10]);
  });

  it("reduces confidence when higher timeframes conflict", () => {
    const base = buildForecast(trendCandles(1));
    const adjusted = applyTimeframeContext(base, [
      { interval: "15m", direction: "BEARISH", score: -30 },
      { interval: "1h", direction: "BEARISH", score: -42 },
    ]);
    expect(adjusted?.contextConsensus).toBe("CONFLICT");
    expect(adjusted?.confidence).toBe("LOW");
    expect(adjusted!.probabilities.neutral).toBeGreaterThan(base!.probabilities.neutral);
  });
});

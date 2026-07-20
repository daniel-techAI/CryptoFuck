import { describe, expect, it } from "vitest";
import { runBacktest } from "../src/backtest.js";
import { createOfflineCandles } from "../src/marketData.js";

describe("runBacktest", () => {
  it("produces finite fee-and-slippage-aware research metrics", () => {
    const result = runBacktest("BTC/USD", createOfflineCandles("BTC/USD", 180), 10_000);
    expect(result.curve).toHaveLength(120);
    expect(Number.isFinite(result.endingEquity)).toBe(true);
    expect(Number.isFinite(result.maxDrawdownPercent)).toBe(true);
    expect(result.feesPaid).toBeGreaterThanOrEqual(0);
  });
});

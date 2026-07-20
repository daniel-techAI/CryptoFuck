import { describe, expect, it } from "vitest";
import { createOfflineCandles } from "../src/marketData.js";
import { evaluateSignal } from "../src/signalEngine.js";

describe("evaluateSignal", () => {
  it("returns bounded, explainable output from closed candles", () => {
    const signal = evaluateSignal("BTC/USD", createOfflineCandles("BTC/USD", 180), new Date("2026-07-20T12:00:00Z"));
    expect(signal.probability).toBeGreaterThanOrEqual(50);
    expect(signal.probability).toBeLessThanOrEqual(92);
    expect(signal.score).toBeGreaterThanOrEqual(-100);
    expect(signal.score).toBeLessThanOrEqual(100);
    expect(signal.evidence).toHaveLength(5);
    expect(signal.candles).toHaveLength(120);
    expect(signal.levels.targets).toHaveLength(3);
    expect(Object.keys(signal.factors)).toEqual(["trend", "momentum", "rsi", "location", "volume", "exhaustion"]);
  });
});

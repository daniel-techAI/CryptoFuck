import { describe, expect, it } from "vitest";
import { calculateTradeRisk } from "./risk";

describe("calculateTradeRisk", () => {
  it("uses position notional and stop distance", () => {
    expect(calculateTradeRisk(100, 95, 2_000)).toEqual({ quantity: 20, riskUsd: 100, riskPercent: 5 });
  });
});

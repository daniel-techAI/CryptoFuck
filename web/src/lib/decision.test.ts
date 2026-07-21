import { describe, expect, it } from "vitest";
import type { LiveTicker, MarketForecast, MarketMicrostructure, PortfolioSummary } from "../types";
import { buildTradeDecision } from "./decision";

const ticker: LiveTicker = {
  symbol: "BTCUSDT",
  price: 100,
  change24hPercent: 2,
  high24h: 103,
  low24h: 96,
  volume24h: 1_000,
  quoteVolume24h: 100_000,
  bid: 99.99,
  ask: 100.01,
  eventTime: Date.now(),
};

const microstructure: MarketMicrostructure = {
  bids: [],
  asks: [],
  trades: [],
  bidDepth: 55,
  askDepth: 45,
  imbalancePercent: 10,
  lastUpdate: Date.now(),
  status: "live",
};

const portfolio: PortfolioSummary = {
  equity: 100_000,
  cash: 100_000,
  realizedPnl: 0,
  dailyPnl: 0,
  dailyDrawdownPercent: 0,
  openRiskUsd: 0,
  openRiskPercent: 0,
  killSwitch: false,
  openOrders: 0,
  maxRiskPerTradePercent: 1,
  maxOpenRiskPercent: 3,
  maxDailyDrawdownPercent: 3,
};

const forecast: MarketForecast = {
  direction: "BULLISH",
  horizonCandles: 3,
  score: 48,
  confidence: "MEDIUM",
  probabilities: { bullish: 68, neutral: 24, bearish: 8 },
  indicators: { ema20: 99, ema50: 97, rsi14: 61, atr14: 1, atrPercent: 1, momentum: 2, volumeRatio: 1.2 },
  evidence: [],
  levels: { entryLow: 99, entryHigh: 100, invalidation: 97, target1: 104, target2: 107 },
  validation: { sampleSize: 60, hitRatePercent: 56, profitableRatePercent: 42, averageNetReturnPercent: 0.4, profitFactor: 1.3, maxDrawdownPercent: 8, roundTripCostPercent: 0.24 },
  context: [{ interval: "15m", direction: "BULLISH", score: 35 }, { interval: "1h", direction: "BULLISH", score: 28 }],
  contextConsensus: "ALIGNED",
  evaluatedAt: Date.now(),
};

function makeDecision(overrides: Partial<Parameters<typeof buildTradeDecision>[0]> = {}) {
  return buildTradeDecision({ forecast, ticker, interval: "15m", status: "live", ageSeconds: 2, microstructure, portfolio, ...overrides });
}

describe("buildTradeDecision", () => {
  it("allows a directional setup only when every reliability gate passes", () => {
    const decision = makeDecision();
    expect(decision.action).toBe("CONSIDER LONG");
    expect(decision.autoBlocked).toBe(false);
    expect(decision.riskRewardTarget1).toBeGreaterThan(1.2);
  });

  it("waits when validation is weak", () => {
    const weakForecast = { ...forecast, validation: { ...forecast.validation, hitRatePercent: 46 } };
    const decision = makeDecision({ forecast: weakForecast });
    expect(decision.action).toBe("WAIT");
    expect(decision.autoBlocked).toBe(true);
    expect(decision.headline).toContain("walk-forward validation");
  });

  it("waits when the market feed is stale", () => {
    const decision = makeDecision({ ageSeconds: 18 });
    expect(decision.action).toBe("WAIT");
    expect(decision.reasons[0].passes).toBe(false);
  });

  it("tells an existing long position to exit after invalidation", () => {
    const decision = makeDecision({ ticker: { ...ticker, price: 96 }, positionSide: "LONG" });
    expect(decision.action).toBe("EXIT");
    expect(decision.currentStep).toBe(5);
  });
});

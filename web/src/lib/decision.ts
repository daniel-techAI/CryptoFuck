import type {
  BinanceInterval,
  LiveConnectionStatus,
  LiveTicker,
  MarketForecast,
  MarketMicrostructure,
  PortfolioSummary,
  TradeDecision,
  TradeDecisionReason,
} from "../types";

const MIN_DIRECTIONAL_ACCURACY = 50;
const MIN_COST_POSITIVE_RATE = 25;
const MIN_VALIDATION_SAMPLE = 20;
const MAX_SPREAD_BPS = 8;
const MIN_REWARD_RISK = 1.2;

function safeRatio(reward: number, risk: number): number {
  return risk > 0 ? Math.max(0, reward / risk) : 0;
}

function spreadBps(ticker: LiveTicker): number {
  if (!ticker.bid || !ticker.ask) return Number.POSITIVE_INFINITY;
  const middle = (ticker.bid + ticker.ask) / 2;
  return middle ? (ticker.ask - ticker.bid) / middle * 10_000 : Number.POSITIVE_INFINITY;
}

function positionAction(
  positionSide: "LONG" | "SHORT",
  forecast: MarketForecast,
  ticker: LiveTicker,
  stale: boolean,
): Pick<TradeDecision, "action" | "headline" | "currentStep"> {
  const invalidated = positionSide === "LONG"
    ? ticker.price <= forecast.levels.invalidation
    : ticker.price >= forecast.levels.invalidation;
  if (invalidated) return { action: "EXIT", headline: "The invalidation level has been crossed. Protect capital before looking for another setup.", currentStep: 5 };
  if (stale) return { action: "REDUCE", headline: "Live market data is stale. Reduce unmanaged exposure until the feed recovers.", currentStep: 4 };
  const opposite = (positionSide === "LONG" && forecast.direction === "BEARISH") || (positionSide === "SHORT" && forecast.direction === "BULLISH");
  if (opposite || forecast.contextConsensus === "CONFLICT") return { action: "REDUCE", headline: "The active position conflicts with current evidence. Tighten risk or reduce exposure.", currentStep: 4 };
  return { action: "MANAGE", headline: "The position remains inside its plan. Do not widen the invalidation level.", currentStep: 4 };
}

export interface BuildTradeDecisionInput {
  forecast: MarketForecast | null;
  ticker: LiveTicker;
  interval: BinanceInterval;
  status: LiveConnectionStatus;
  ageSeconds: number;
  microstructure: MarketMicrostructure;
  portfolio: PortfolioSummary;
  positionSide?: "NONE" | "LONG" | "SHORT";
}

export function buildTradeDecision({
  forecast,
  ticker,
  interval,
  status,
  ageSeconds,
  microstructure,
  portfolio,
  positionSide = "NONE",
}: BuildTradeDecisionInput): TradeDecision {
  if (!forecast || !ticker.price) {
    return {
      action: "WAIT",
      confidence: "LOW",
      headline: "Waiting for enough live candles to build and validate a plan.",
      currentStep: 1,
      autoBlocked: true,
      entryCondition: "Live candles and a validated forecast are required.",
      riskRewardTarget1: 0,
      riskRewardTarget2: 0,
      suggestedRiskPercent: 0,
      suggestedPositionUsd: 0,
      reasons: [{ label: "Market data", value: "Loading", tone: "caution", passes: false }],
    };
  }

  const validation = forecast.validation;
  const fresh = status === "live" && ageSeconds <= 10;
  const validationPasses = validation.sampleSize >= MIN_VALIDATION_SAMPLE
    && validation.hitRatePercent >= MIN_DIRECTIONAL_ACCURACY
    && validation.profitableRatePercent >= MIN_COST_POSITIVE_RATE;
  const contextPasses = forecast.contextConsensus !== "CONFLICT";
  const spread = spreadBps(ticker);
  const spreadPasses = spread <= MAX_SPREAD_BPS;
  const directional = forecast.direction !== "NEUTRAL";
  const side = forecast.direction === "BEARISH" ? -1 : 1;
  const entry = (forecast.levels.entryLow + forecast.levels.entryHigh) / 2;
  const riskPercent = Math.abs(entry - forecast.levels.invalidation) / entry * 100 + validation.roundTripCostPercent;
  const reward1Percent = side * (forecast.levels.target1 - entry) / entry * 100 - validation.roundTripCostPercent;
  const reward2Percent = side * (forecast.levels.target2 - entry) / entry * 100 - validation.roundTripCostPercent;
  const riskRewardTarget1 = safeRatio(reward1Percent, riskPercent);
  const riskRewardTarget2 = safeRatio(reward2Percent, riskPercent);
  const rewardPasses = riskRewardTarget1 >= MIN_REWARD_RISK;
  const suggestedRiskPercent = forecast.confidence === "HIGH" ? 0.75 : forecast.confidence === "MEDIUM" ? 0.5 : 0.25;
  const riskBudget = portfolio.equity * suggestedRiskPercent / 100;
  const rawPosition = riskPercent ? riskBudget / (riskPercent / 100) : 0;
  const suggestedPositionUsd = Math.max(0, Math.min(rawPosition, portfolio.equity * 3));
  const imbalance = microstructure.imbalancePercent;

  const reasons: TradeDecisionReason[] = [
    { label: "Data freshness", value: fresh ? `Live · ${ageSeconds}s old` : `${status} · ${ageSeconds}s old`, tone: fresh ? "positive" : "negative", passes: fresh },
    { label: "Walk-forward validation", value: `${validation.hitRatePercent.toFixed(1)}% direction · ${validation.profitableRatePercent.toFixed(1)}% after costs · n=${validation.sampleSize}`, tone: validationPasses ? "positive" : "negative", passes: validationPasses },
    { label: "15m / 1h alignment", value: forecast.contextConsensus, tone: forecast.contextConsensus === "ALIGNED" ? "positive" : contextPasses ? "caution" : "negative", passes: contextPasses },
    { label: "Bid / ask spread", value: Number.isFinite(spread) ? `${spread.toFixed(2)} bps` : "Unavailable", tone: spreadPasses ? "positive" : "negative", passes: spreadPasses },
    { label: "Order-book balance", value: microstructure.lastUpdate ? `${imbalance >= 0 ? "+" : ""}${imbalance.toFixed(1)}% bid-side` : "Loading", tone: Math.abs(imbalance) < 12 ? "neutral" : imbalance * side > 0 ? "positive" : "caution", passes: true },
    { label: "Reward / risk after costs", value: `${riskRewardTarget1.toFixed(2)}R / ${riskRewardTarget2.toFixed(2)}R`, tone: rewardPasses ? "positive" : "negative", passes: rewardPasses },
  ];

  const stale = !fresh;
  if (positionSide !== "NONE") {
    const active = positionAction(positionSide, forecast, ticker, stale);
    return {
      ...active,
      confidence: forecast.confidence,
      autoBlocked: portfolio.killSwitch || stale,
      entryCondition: "Manage the selected position against invalidation and targets; no new entry is implied.",
      riskRewardTarget1,
      riskRewardTarget2,
      suggestedRiskPercent,
      suggestedPositionUsd,
      reasons,
    };
  }

  const autoBlocked = portfolio.killSwitch || !fresh || !validationPasses || !contextPasses || !spreadPasses || !directional || !rewardPasses;
  const action = autoBlocked ? "WAIT" : forecast.direction === "BULLISH" ? "CONSIDER LONG" : "CONSIDER SHORT";
  const failed = reasons.filter((reason) => !reason.passes).map((reason) => reason.label.toLowerCase());
  const headline = autoBlocked
    ? `No valid entry: ${failed.slice(0, 2).join(" and ") || "directional evidence is incomplete"}.`
    : `${forecast.direction === "BULLISH" ? "Long" : "Short"} setup passes the current validation, context, spread and cost gates.`;
  const entryCondition = forecast.direction === "BULLISH"
    ? `${interval} candle closes above the entry zone with volume at or above its 20-candle average.`
    : forecast.direction === "BEARISH"
      ? `${interval} candle closes below the entry zone with volume at or above its 20-candle average.`
      : "Wait for a directional forecast that passes every gate.";

  return {
    action,
    confidence: autoBlocked ? "LOW" : forecast.confidence,
    headline,
    currentStep: autoBlocked ? 1 : 2,
    autoBlocked,
    entryCondition,
    riskRewardTarget1,
    riskRewardTarget2,
    suggestedRiskPercent: autoBlocked ? 0 : suggestedRiskPercent,
    suggestedPositionUsd: autoBlocked ? 0 : suggestedPositionUsd,
    reasons,
  };
}

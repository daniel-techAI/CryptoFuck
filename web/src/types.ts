export type SignalDirection = "LONG" | "SHORT" | "WAIT";
export type RiskRating = "HIGH" | "MEDIUM" | "LOW";
export type BinanceInterval = "1m" | "3m" | "15m" | "30m" | "1h";
export type LiveConnectionStatus = "connecting" | "live" | "reconnecting" | "offline" | "error";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveTicker {
  symbol: string;
  price: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  bid: number;
  ask: number;
  eventTime: number;
}

export interface ForecastEvidence {
  label: string;
  value: string;
  score: number;
  tone: "bullish" | "bearish" | "neutral";
}

export interface ForecastValidation {
  sampleSize: number;
  hitRatePercent: number;
  profitableRatePercent: number;
  averageNetReturnPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  roundTripCostPercent: number;
}

export interface MarketForecast {
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  horizonCandles: number;
  score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  probabilities: { bullish: number; neutral: number; bearish: number };
  indicators: {
    ema20: number;
    ema50: number;
    rsi14: number;
    atr14: number;
    atrPercent: number;
    momentum: number;
    volumeRatio: number;
  };
  evidence: ForecastEvidence[];
  levels: {
    entryLow: number;
    entryHigh: number;
    invalidation: number;
    target1: number;
    target2: number;
  };
  validation: ForecastValidation;
  context: Array<{ interval: BinanceInterval; direction: "BULLISH" | "BEARISH" | "NEUTRAL"; score: number }>;
  contextConsensus: "ALIGNED" | "MIXED" | "CONFLICT" | "UNAVAILABLE";
  evaluatedAt: number;
}

export interface MarketSignal {
  pair: string;
  displayPair: string;
  price: number;
  change24h: number;
  direction: SignalDirection;
  score: number;
  probability: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  regime: string;
  risk: RiskRating;
  indicators: {
    ema20: number;
    ema50: number;
    rsi14: number;
    atr14: number;
    atrPercent: number;
    momentum24h: number;
    volumeRatio: number;
  };
  levels: { entry: [number, number]; invalidation: number; targets: number[]; riskReward: number[] };
  evidence: string[];
  factors: { trend: number; momentum: number; rsi: number; location: number; volume: number; exhaustion: number };
  history?: {
    score6hAgo: number;
    score12hAgo: number;
    direction6hAgo: SignalDirection;
    direction12hAgo: SignalDirection;
    flips12h: number;
    label: "STABLE" | "BUILDING" | "ROTATING";
  };
  candles: Candle[];
  evaluatedAt: string;
}

export interface MarketSnapshot {
  generatedAt: string;
  source: "kraken" | "mixed" | "offline-sample";
  stale: boolean;
  methodology: string;
  signals: MarketSignal[];
  backtests: Record<string, BacktestSummary>;
  warnings: string[];
}

export interface BacktestSummary {
  pair: string;
  startingEquity: number;
  endingEquity: number;
  totalReturnPercent: number;
  maxDrawdownPercent: number;
  winRatePercent: number;
  profitFactor: number;
  trades: number;
  feesPaid: number;
}

export interface PaperOrderRequest {
  pair: string;
  side: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit?: number;
  sizeUsd: number;
  signalScore?: number;
}

export interface PaperOrder extends PaperOrderRequest {
  id: string;
  quantity: number;
  riskUsd: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
}

export interface PortfolioSummary {
  equity: number;
  cash: number;
  realizedPnl: number;
  dailyPnl: number;
  dailyDrawdownPercent: number;
  openRiskUsd: number;
  openRiskPercent: number;
  killSwitch: boolean;
  openOrders: number;
  maxRiskPerTradePercent: number;
  maxOpenRiskPercent: number;
  maxDailyDrawdownPercent: number;
}

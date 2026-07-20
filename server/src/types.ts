export type SignalDirection = "LONG" | "SHORT" | "WAIT";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type RiskRating = "HIGH" | "MEDIUM" | "LOW";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSet {
  ema20: number;
  ema50: number;
  rsi14: number;
  atr14: number;
  atrPercent: number;
  momentum24h: number;
  volumeRatio: number;
}

export interface SignalLevels {
  entry: [number, number];
  invalidation: number;
  targets: number[];
  riskReward: number[];
}

export interface MarketSignal {
  pair: string;
  displayPair: string;
  price: number;
  change24h: number;
  direction: SignalDirection;
  score: number;
  probability: number;
  confidence: Confidence;
  regime: string;
  risk: RiskRating;
  indicators: IndicatorSet;
  levels: SignalLevels;
  evidence: string[];
  factors: {
    trend: number;
    momentum: number;
    rsi: number;
    location: number;
    volume: number;
    exhaustion: number;
  };
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
  backtests: Record<string, Omit<BacktestResult, "curve">>;
  warnings: string[];
}

export interface BacktestResult {
  pair: string;
  startingEquity: number;
  endingEquity: number;
  totalReturnPercent: number;
  maxDrawdownPercent: number;
  winRatePercent: number;
  profitFactor: number;
  trades: number;
  feesPaid: number;
  curve: Array<{ timestamp: number; equity: number }>;
}

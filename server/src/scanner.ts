import { createOfflineCandles, DEFAULT_PAIRS, fetchKrakenCandles } from "./marketData.js";
import { runBacktest } from "./backtest.js";
import { evaluateSignal } from "./signalEngine.js";
import type { MarketSnapshot } from "./types.js";

export interface ScanOptions {
  pairs?: string[];
  allowOfflineFallback?: boolean;
  now?: Date;
}

export async function scanMarkets(options: ScanOptions = {}): Promise<MarketSnapshot> {
  const pairs = options.pairs?.length ? options.pairs : DEFAULT_PAIRS;
  const now = options.now ?? new Date();
  const results = await Promise.allSettled(pairs.map(async (pair) => ({
    pair,
    candles: await fetchKrakenCandles(pair),
  })));
  const warnings: string[] = [];
  let liveCount = 0;
  const evaluated = results.map((result, index) => {
    const pair = pairs[index];
    let candles;
    if (result.status === "fulfilled") {
      liveCount += 1;
      candles = result.value.candles;
    } else {
      if (options.allowOfflineFallback === false) throw result.reason;
      warnings.push(`${pair}: live feed unavailable; showing labeled offline sample data.`);
      candles = createOfflineCandles(pair);
    }
    const signal = evaluateSignal(pair, candles, now);
    const sixHoursAgo = evaluateSignal(pair, candles.slice(0, -6), new Date(now.getTime() - 6 * 60 * 60 * 1000));
    const twelveHoursAgo = evaluateSignal(pair, candles.slice(0, -12), new Date(now.getTime() - 12 * 60 * 60 * 1000));
    const directions = [twelveHoursAgo.direction, sixHoursAgo.direction, signal.direction];
    const flips12h = Number(directions[0] !== directions[1]) + Number(directions[1] !== directions[2]);
    const directionStable = flips12h === 0;
    signal.history = {
      score6hAgo: sixHoursAgo.score,
      score12hAgo: twelveHoursAgo.score,
      direction6hAgo: sixHoursAgo.direction,
      direction12hAgo: twelveHoursAgo.direction,
      flips12h,
      label: directionStable && Math.abs(signal.score) >= Math.abs(sixHoursAgo.score)
        ? "BUILDING"
        : directionStable
          ? "STABLE"
          : "ROTATING",
    };
    return { pair, candles, signal };
  });
  const signals = evaluated.map(({ signal }) => signal);
  const backtests = Object.fromEntries(evaluated.map(({ pair, candles }) => {
    const { curve: _curve, ...summary } = runBacktest(pair, candles, 10_000);
    return [pair, summary];
  }));
  return {
    generatedAt: now.toISOString(),
    source: liveCount === pairs.length ? "kraken" : liveCount === 0 ? "offline-sample" : "mixed",
    stale: liveCount !== pairs.length,
    methodology: "Closed 1h candles; EMA20/50, RSI14, ATR14, 24h momentum, and relative volume ensemble. Not a guarantee or financial advice.",
    signals,
    backtests,
    warnings,
  };
}

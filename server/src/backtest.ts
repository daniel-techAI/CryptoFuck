import { evaluateSignal } from "./signalEngine.js";
import type { BacktestResult, Candle, SignalDirection } from "./types.js";

export function runBacktest(pair: string, candles: Candle[], startingEquity = 10_000): BacktestResult {
  if (candles.length < 90) throw new Error("Backtest requires at least 90 candles");
  const feeRate = 0.001;
  const slippageRate = 0.0005;
  let equity = startingEquity;
  let peak = equity;
  let maxDrawdown = 0;
  let feesPaid = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let trades = 0;
  let position: null | {
    direction: Exclude<SignalDirection, "WAIT">;
    entry: number;
    stop: number;
    target: number;
    size: number;
  } = null;
  const curve: BacktestResult["curve"] = [];

  for (let index = 60; index < candles.length; index += 1) {
    const candle = candles[index];
    if (position) {
      const side = position.direction === "LONG" ? 1 : -1;
      const stopHit = side === 1 ? candle.low <= position.stop : candle.high >= position.stop;
      const targetHit = side === 1 ? candle.high >= position.target : candle.low <= position.target;
      if (stopHit || targetHit || index === candles.length - 1) {
        const rawExit = stopHit ? position.stop : targetHit ? position.target : candle.close;
        const exit = rawExit * (1 - side * slippageRate);
        const gross = (exit - position.entry) * position.size * side;
        const fees = (position.entry + exit) * position.size * feeRate;
        const net = gross - fees;
        feesPaid += fees;
        equity += net;
        trades += 1;
        if (net > 0) { wins += 1; grossProfit += net; }
        else grossLoss += Math.abs(net);
        position = null;
      }
    }
    if (!position && index < candles.length - 1) {
      const signal = evaluateSignal(pair, candles.slice(0, index + 1), new Date(candle.timestamp));
      if (signal.direction !== "WAIT" && signal.probability >= 62) {
        const riskBudget = equity * 0.01;
        const stopDistance = Math.abs(signal.price - signal.levels.invalidation);
        const size = Math.min(riskBudget / Math.max(stopDistance, 1e-9), (equity * 0.2) / signal.price);
        position = {
          direction: signal.direction,
          entry: signal.price * (1 + (signal.direction === "LONG" ? 1 : -1) * slippageRate),
          stop: signal.levels.invalidation,
          target: signal.levels.targets[0],
          size,
        };
      }
    }
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
    curve.push({ timestamp: candle.timestamp, equity });
  }

  return {
    pair,
    startingEquity,
    endingEquity: equity,
    totalReturnPercent: (equity / startingEquity - 1) * 100,
    maxDrawdownPercent: maxDrawdown * 100,
    winRatePercent: trades === 0 ? 0 : (wins / trades) * 100,
    profitFactor: grossLoss === 0 ? grossProfit : grossProfit / grossLoss,
    trades,
    feesPaid,
    curve,
  };
}

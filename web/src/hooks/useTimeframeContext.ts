import { useEffect, useState } from "react";
import { fetchBinanceKlines, type BinanceSymbol } from "../lib/binance";
import { buildForecast } from "../lib/forecast";
import type { BinanceInterval, MarketForecast } from "../types";

export type TimeframeContext = MarketForecast["context"];
const CONTEXT_INTERVALS: BinanceInterval[] = ["15m", "1h"];

export function useTimeframeContext(symbol: BinanceSymbol): TimeframeContext {
  const [context, setContext] = useState<TimeframeContext>([]);

  useEffect(() => {
    let active = true;
    let controller = new AbortController();
    const refresh = async () => {
      controller.abort();
      controller = new AbortController();
      try {
        const results = await Promise.all(CONTEXT_INTERVALS.map(async (interval) => {
          const candles = await fetchBinanceKlines(symbol, interval, controller.signal);
          const forecast = buildForecast(candles);
          return forecast ? { interval, direction: forecast.direction, score: forecast.score } : null;
        }));
        if (active) setContext(results.filter((item): item is TimeframeContext[number] => item !== null));
      } catch {
        if (active) setContext([]);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [symbol]);

  return context;
}

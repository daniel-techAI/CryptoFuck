import { useEffect, useState } from "react";
import type { BinanceSymbol } from "../lib/binance";
import type { FuturesMarketContext } from "../types";

const EMPTY: FuturesMarketContext = { markPrice: 0, indexPrice: 0, fundingRate: 0, nextFundingTime: 0, lastUpdate: 0, error: "" };

export function useFuturesMarketContext(symbol: BinanceSymbol): FuturesMarketContext {
  const [context, setContext] = useState<FuturesMarketContext>(EMPTY);

  useEffect(() => {
    let active = true;
    let timer = 0;
    const load = async () => {
      try {
        const response = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Binance Futures returned ${response.status}`);
        const row = await response.json() as Record<string, string | number>;
        const next: FuturesMarketContext = {
          markPrice: Number(row.markPrice),
          indexPrice: Number(row.indexPrice),
          fundingRate: Number(row.lastFundingRate),
          nextFundingTime: Number(row.nextFundingTime),
          lastUpdate: Number(row.time ?? Date.now()),
          error: "",
        };
        if (!Number.isFinite(next.markPrice) || !Number.isFinite(next.fundingRate)) throw new Error("Binance Futures returned malformed data");
        if (active) setContext(next);
      } catch (reason) {
        if (active) setContext((current) => ({ ...current, error: reason instanceof Error ? reason.message : "Futures context unavailable" }));
      } finally {
        if (active) timer = window.setTimeout(load, 30_000);
      }
    };
    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [symbol]);

  return context;
}

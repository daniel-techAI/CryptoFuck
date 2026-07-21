import { useEffect, useState } from "react";
import type { MarketSentiment } from "../types";

const ENDPOINT = "https://api.alternative.me/fng/?limit=1&format=json";
const SOURCE_URL = "https://alternative.me/crypto/fear-and-greed-index/";
const CACHE_KEY = "nocturne:market-sentiment:v1";
const REFRESH_MS = 15 * 60 * 1_000;

interface CachedSentiment {
  fetchedAt: number;
  sentiment: MarketSentiment;
}

function readCache(): CachedSentiment | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as CachedSentiment | null;
    return parsed?.sentiment && Number.isFinite(parsed.fetchedAt) ? parsed : null;
  } catch {
    return null;
  }
}

export function useMarketSentiment() {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(() => readCache()?.sentiment ?? null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timer = 0;
    const load = async () => {
      const cached = readCache();
      if (cached && Date.now() - cached.fetchedAt < REFRESH_MS) {
        if (active) setSentiment(cached.sentiment);
        timer = window.setTimeout(load, REFRESH_MS - (Date.now() - cached.fetchedAt));
        return;
      }
      try {
        const response = await fetch(ENDPOINT, { cache: "no-store" });
        if (!response.ok) throw new Error(`Sentiment source returned ${response.status}`);
        const payload = await response.json() as { data?: Array<Record<string, string>> };
        const row = payload.data?.[0];
        if (!row) throw new Error("Sentiment source returned no data");
        const next: MarketSentiment = {
          value: Number(row.value),
          classification: row.value_classification,
          timestamp: Number(row.timestamp) * 1_000,
          nextUpdateSeconds: Number(row.time_until_update ?? 0),
          sourceUrl: SOURCE_URL,
        };
        if (!Number.isFinite(next.value) || !Number.isFinite(next.timestamp)) throw new Error("Sentiment source returned malformed data");
        if (!active) return;
        setSentiment(next);
        setError("");
        localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), sentiment: next } satisfies CachedSentiment));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Sentiment context is unavailable");
      } finally {
        if (active) timer = window.setTimeout(load, REFRESH_MS);
      }
    };
    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  return { sentiment, error };
}

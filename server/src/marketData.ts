import type { Candle } from "./types.js";

const KRAKEN_PAIR_MAP: Record<string, string> = {
  "BTC/USD": "XBTUSD",
  "ETH/USD": "ETHUSD",
  "SOL/USD": "SOLUSD",
  "LINK/USD": "LINKUSD",
  "AVAX/USD": "AVAXUSD",
};

const OFFLINE_BASES: Record<string, number> = {
  "BTC/USD": 68420,
  "ETH/USD": 3650,
  "SOL/USD": 186,
  "LINK/USD": 18.6,
  "AVAX/USD": 39.2,
};

export const DEFAULT_PAIRS = Object.keys(KRAKEN_PAIR_MAP);

export async function fetchKrakenCandles(pair: string, interval = 60): Promise<Candle[]> {
  const exchangePair = KRAKEN_PAIR_MAP[pair];
  if (!exchangePair) throw new Error(`Unsupported Kraken pair: ${pair}`);
  const url = new URL("https://api.kraken.com/0/public/OHLC");
  url.searchParams.set("pair", exchangePair);
  url.searchParams.set("interval", String(interval));
  url.searchParams.set("assetVersion", "1");
  const response = await fetch(url, {
    headers: { "User-Agent": "NOCTURNE/0.1 market research scanner" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Kraken returned HTTP ${response.status}`);
  const payload = await response.json() as {
    error: string[];
    result: Record<string, unknown> & { last?: number };
  };
  if (payload.error.length > 0) throw new Error(payload.error.join(", "));
  const series = Object.entries(payload.result).find(([key]) => key !== "last")?.[1];
  if (!Array.isArray(series)) throw new Error(`No OHLC series returned for ${pair}`);
  return series.slice(0, -1).map((row) => {
    const values = row as Array<string | number>;
    return {
      timestamp: Number(values[0]) * 1000,
      open: Number(values[1]),
      high: Number(values[2]),
      low: Number(values[3]),
      close: Number(values[4]),
      volume: Number(values[6]),
    };
  });
}
function seededNoise(index: number, seed: number): number {
  const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export function createOfflineCandles(pair: string, count = 180): Candle[] {
  const base = OFFLINE_BASES[pair] ?? 100;
  const seed = pair.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const now = Date.now();
  let price = base * 0.9;
  return Array.from({ length: count }, (_, index) => {
    const trend = 0.00075 + Math.sin(index / 31 + seed) * 0.0005;
    const move = trend + seededNoise(index, seed) * 0.009;
    const open = price;
    const close = Math.max(open * (1 + move), 0.01);
    const spread = Math.abs(seededNoise(index + 2, seed)) * 0.006 + 0.002;
    price = close;
    return {
      timestamp: now - (count - index) * 60 * 60 * 1000,
      open,
      high: Math.max(open, close) * (1 + spread),
      low: Math.min(open, close) * (1 - spread),
      close,
      volume: 100 + Math.abs(seededNoise(index + 8, seed)) * 900,
    };
  });
}

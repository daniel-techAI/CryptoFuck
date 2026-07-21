import type { BinanceInterval, Candle, LiveTicker } from "../types";

export const BINANCE_BASE_ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP"] as const;
export const BINANCE_QUOTE_ASSETS = ["EUR", "USDT", "USDC"] as const;
export const BINANCE_FUTURES_QUOTES = ["USDT", "USDC"] as const;
export type BinanceBaseAsset = (typeof BINANCE_BASE_ASSETS)[number];
export type BinanceQuoteAsset = (typeof BINANCE_QUOTE_ASSETS)[number];
export type BinanceFuturesQuoteAsset = (typeof BINANCE_FUTURES_QUOTES)[number];
export type BinanceSymbol = `${BinanceBaseAsset}${BinanceQuoteAsset}`;
export type MarketVenue = "spot" | "futures";

export const BINANCE_INTERVALS: BinanceInterval[] = ["1m", "3m", "15m", "30m", "1h"];

export function createBinanceSymbol(base: BinanceBaseAsset, quote: BinanceQuoteAsset): BinanceSymbol {
  return `${base}${quote}` as BinanceSymbol;
}

export function symbolsForQuote(quote: BinanceQuoteAsset): BinanceSymbol[] {
  return BINANCE_BASE_ASSETS.map((base) => createBinanceSymbol(base, quote));
}

export function quoteAssetFromSymbol(symbol: string): BinanceQuoteAsset {
  return BINANCE_QUOTE_ASSETS.find((quote) => symbol.endsWith(quote)) ?? "USDT";
}

export function baseAssetFromSymbol(symbol: string): BinanceBaseAsset {
  const quote = quoteAssetFromSymbol(symbol);
  const base = symbol.slice(0, -quote.length);
  return BINANCE_BASE_ASSETS.includes(base as BinanceBaseAsset) ? base as BinanceBaseAsset : "BTC";
}

const REST_BASES = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api-gcp.binance.com",
];

const FUTURES_REST_BASES = [
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
];

async function publicFetch<T>(path: string, signal?: AbortSignal, venue: MarketVenue = "spot"): Promise<T> {
  let lastError: unknown;
  for (const base of venue === "futures" ? FUTURES_REST_BASES : REST_BASES) {
    try {
      const response = await fetch(`${base}${path}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error(`Binance returned ${response.status}`);
      return await response.json() as T;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Binance market data is unavailable.");
}

type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, string];

export async function fetchBinanceKlines(symbol: BinanceSymbol, interval: BinanceInterval, signal?: AbortSignal, venue: MarketVenue = "spot"): Promise<Candle[]> {
  const path = venue === "futures" ? "/fapi/v1/klines" : "/api/v3/klines";
  const rows = await publicFetch<BinanceKline[]>(`${path}?symbol=${symbol}&interval=${interval}&limit=360`, signal, venue);
  return rows.map((row) => ({
    timestamp: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
}

interface BinanceBookTicker { bidPrice: string; askPrice: string }

export async function fetchBinanceTicker(symbol: BinanceSymbol, signal?: AbortSignal, venue: MarketVenue = "spot"): Promise<LiveTicker> {
  const tickerPath = venue === "futures" ? "/fapi/v1/ticker/24hr" : "/api/v3/ticker/24hr";
  const bookPath = venue === "futures" ? "/fapi/v1/ticker/bookTicker" : "/api/v3/ticker/bookTicker";
  const [ticker, book] = await Promise.all([
    publicFetch<BinanceTicker24h>(`${tickerPath}?symbol=${symbol}`, signal, venue),
    publicFetch<BinanceBookTicker>(`${bookPath}?symbol=${symbol}`, signal, venue),
  ]);
  return {
    symbol,
    price: Number(ticker.lastPrice),
    change24hPercent: Number(ticker.priceChangePercent),
    high24h: Number(ticker.highPrice),
    low24h: Number(ticker.lowPrice),
    volume24h: Number(ticker.volume),
    quoteVolume24h: Number(ticker.quoteVolume),
    bid: Number(book.bidPrice),
    ask: Number(book.askPrice),
    eventTime: ticker.closeTime,
  };
}

export function liveStreamUrl(symbol: BinanceSymbol, interval: BinanceInterval, venue: MarketVenue = "spot"): string {
  const pair = symbol.toLowerCase();
  const host = venue === "futures" ? "wss://fstream.binance.com/stream" : "wss://stream.binance.com:443/stream";
  return `${host}?streams=${pair}@kline_${interval}/${pair}@ticker/${pair}@bookTicker`;
}

export function tapeStreamUrl(quote: BinanceQuoteAsset): string {
  const streams = symbolsForQuote(quote).map((symbol) => `${symbol.toLowerCase()}@miniTicker`).join("/");
  return `wss://stream.binance.com:443/stream?streams=${streams}`;
}

export function microstructureStreamUrls(symbol: BinanceSymbol, venue: MarketVenue = "spot"): { depth: string; trades: string } {
  const pair = symbol.toLowerCase();
  const host = venue === "futures" ? "wss://fstream.binance.com/ws" : "wss://stream.binance.com:443/ws";
  return {
    depth: `${host}/${pair}@depth20@100ms`,
    trades: `${host}/${pair}@${venue === "futures" ? "trade" : "aggTrade"}`,
  };
}

export function emptyTicker(symbol: BinanceSymbol): LiveTicker {
  return { symbol, price: 0, change24hPercent: 0, high24h: 0, low24h: 0, volume24h: 0, quoteVolume24h: 0, bid: 0, ask: 0, eventTime: 0 };
}

export function displaySymbol(symbol: string): string {
  const quote = quoteAssetFromSymbol(symbol);
  return `${symbol.slice(0, -quote.length)} / ${quote}`;
}

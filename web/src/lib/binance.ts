import type { BinanceInterval, Candle, LiveTicker } from "../types";

export const BINANCE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"] as const;
export type BinanceSymbol = (typeof BINANCE_SYMBOLS)[number];

export const BINANCE_INTERVALS: BinanceInterval[] = ["1m", "3m", "15m", "30m", "1h"];

export const SYMBOL_LABELS: Record<BinanceSymbol, string> = {
  BTCUSDT: "BTC / USDT",
  ETHUSDT: "ETH / USDT",
  SOLUSDT: "SOL / USDT",
  BNBUSDT: "BNB / USDT",
  XRPUSDT: "XRP / USDT",
};

const REST_BASES = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api-gcp.binance.com",
];

async function publicFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  let lastError: unknown;
  for (const base of REST_BASES) {
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

export async function fetchBinanceKlines(symbol: BinanceSymbol, interval: BinanceInterval, signal?: AbortSignal): Promise<Candle[]> {
  const rows = await publicFetch<BinanceKline[]>(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=360`, signal);
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

export async function fetchBinanceTicker(symbol: BinanceSymbol, signal?: AbortSignal): Promise<LiveTicker> {
  const [ticker, book] = await Promise.all([
    publicFetch<BinanceTicker24h>(`/api/v3/ticker/24hr?symbol=${symbol}`, signal),
    publicFetch<BinanceBookTicker>(`/api/v3/ticker/bookTicker?symbol=${symbol}`, signal),
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

export function liveStreamUrl(symbol: BinanceSymbol, interval: BinanceInterval): string {
  const pair = symbol.toLowerCase();
  return `wss://stream.binance.com:443/stream?streams=${pair}@kline_${interval}/${pair}@ticker/${pair}@bookTicker`;
}

export function tapeStreamUrl(): string {
  const streams = BINANCE_SYMBOLS.map((symbol) => `${symbol.toLowerCase()}@miniTicker`).join("/");
  return `wss://stream.binance.com:443/stream?streams=${streams}`;
}

export function emptyTicker(symbol: BinanceSymbol): LiveTicker {
  return { symbol, price: 0, change24hPercent: 0, high24h: 0, low24h: 0, volume24h: 0, quoteVolume24h: 0, bid: 0, ask: 0, eventTime: 0 };
}

export function displaySymbol(symbol: string): string {
  return SYMBOL_LABELS[symbol as BinanceSymbol] ?? symbol.replace("USDT", " / USDT");
}

import { useEffect, useRef, useState } from "react";
import { emptyTicker, fetchBinanceKlines, fetchBinanceTicker, liveStreamUrl, type BinanceSymbol } from "../lib/binance";
import type { BinanceInterval, Candle, LiveConnectionStatus, LiveTicker } from "../types";

interface CombinedMessage { stream?: string; data?: Record<string, unknown> }

function parseLiveCandle(data: Record<string, unknown>): Candle | null {
  const kline = data.k as Record<string, unknown> | undefined;
  if (!kline) return null;
  const candle = {
    timestamp: Number(kline.t),
    open: Number(kline.o),
    high: Number(kline.h),
    low: Number(kline.l),
    close: Number(kline.c),
    volume: Number(kline.v),
  };
  return Object.values(candle).every(Number.isFinite) ? candle : null;
}

function mergeCandle(candles: Candle[], candle: Candle): Candle[] {
  const last = candles.at(-1);
  if (!last || candle.timestamp > last.timestamp) return [...candles.slice(-359), candle];
  if (candle.timestamp === last.timestamp) return [...candles.slice(0, -1), candle];
  const index = candles.findIndex((item) => item.timestamp === candle.timestamp);
  if (index < 0) return candles;
  const copy = [...candles];
  copy[index] = candle;
  return copy;
}

export function useBinanceMarket(symbol: BinanceSymbol, interval: BinanceInterval) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [ticker, setTicker] = useState<LiveTicker>(() => emptyTicker(symbol));
  const [status, setStatus] = useState<LiveConnectionStatus>("connecting");
  const [lastUpdate, setLastUpdate] = useState(0);
  const [error, setError] = useState("");
  const pendingCandles = useRef<Candle[]>([]);
  const pendingTicker = useRef<LiveTicker>(emptyTicker(symbol));
  const pendingUpdate = useRef(0);
  const dirty = useRef(false);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | undefined;
    let reconnectTimer = 0;
    let reconnectAttempt = 0;
    const abortController = new AbortController();

    pendingCandles.current = [];
    pendingTicker.current = emptyTicker(symbol);
    pendingUpdate.current = 0;
    dirty.current = false;
    setCandles([]);
    setTicker(emptyTicker(symbol));
    setLastUpdate(0);
    setError("");
    setStatus("connecting");

    const flush = () => {
      if (!active || !dirty.current) return;
      dirty.current = false;
      setCandles([...pendingCandles.current]);
      setTicker({ ...pendingTicker.current });
      setLastUpdate(pendingUpdate.current || Date.now());
    };

    const connect = () => {
      if (!active || !navigator.onLine) {
        setStatus("offline");
        return;
      }
      setStatus(reconnectAttempt ? "reconnecting" : "connecting");
      socket = new WebSocket(liveStreamUrl(symbol, interval));
      socket.onopen = () => {
        if (!active) return;
        reconnectAttempt = 0;
        setStatus("live");
        setError("");
      };
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(String(event.data)) as CombinedMessage;
          const data = message.data ?? {};
          const eventType = String(data.e ?? "");
          if (eventType === "kline") {
            const liveCandle = parseLiveCandle(data);
            if (liveCandle) pendingCandles.current = mergeCandle(pendingCandles.current, liveCandle);
          } else if (eventType === "24hrTicker") {
            pendingTicker.current = {
              ...pendingTicker.current,
              symbol,
              price: Number(data.c),
              change24hPercent: Number(data.P),
              high24h: Number(data.h),
              low24h: Number(data.l),
              volume24h: Number(data.v),
              quoteVolume24h: Number(data.q),
              eventTime: Number(data.E),
            };
          } else if (message.stream?.endsWith("@bookTicker")) {
            pendingTicker.current = { ...pendingTicker.current, bid: Number(data.b), ask: Number(data.a), eventTime: Date.now() };
          }
          pendingUpdate.current = Number(data.E ?? Date.now());
          dirty.current = true;
        } catch {
          // Ignore malformed frames and keep the healthy stream alive.
        }
      };
      socket.onerror = () => {
        if (active) setStatus("reconnecting");
      };
      socket.onclose = () => {
        if (!active) return;
        reconnectAttempt += 1;
        setStatus(navigator.onLine ? "reconnecting" : "offline");
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt, 5));
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    Promise.all([
      fetchBinanceKlines(symbol, interval, abortController.signal),
      fetchBinanceTicker(symbol, abortController.signal),
    ]).then(([initialCandles, initialTicker]) => {
      if (!active) return;
      pendingCandles.current = initialCandles;
      pendingTicker.current = initialTicker;
      pendingUpdate.current = Date.now();
      dirty.current = true;
      flush();
      connect();
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Could not load Binance market history.");
      setStatus(navigator.onLine ? "error" : "offline");
      connect();
    });

    const flushTimer = window.setInterval(flush, 3_000);
    const healthTimer = window.setInterval(() => {
      if (!active || !pendingUpdate.current) return;
      if (Date.now() - pendingUpdate.current > 12_000 && socket?.readyState === WebSocket.OPEN) setStatus("reconnecting");
    }, 3_000);
    const onOnline = () => {
      if (!socket || socket.readyState === WebSocket.CLOSED) connect();
    };
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      active = false;
      abortController.abort();
      window.clearInterval(flushTimer);
      window.clearInterval(healthTimer);
      window.clearTimeout(reconnectTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [interval, symbol]);

  return { candles, ticker, status, lastUpdate, error };
}

import { useEffect, useRef, useState } from "react";
import { BINANCE_SYMBOLS, emptyTicker, fetchBinanceTicker, tapeStreamUrl, type BinanceSymbol } from "../lib/binance";
import type { LiveTicker } from "../types";

type TickerMap = Record<BinanceSymbol, LiveTicker>;

function initialTickers(): TickerMap {
  return Object.fromEntries(BINANCE_SYMBOLS.map((symbol) => [symbol, emptyTicker(symbol)])) as TickerMap;
}

export function useMarketTape() {
  const [tickers, setTickers] = useState<TickerMap>(initialTickers);
  const pending = useRef<TickerMap>(initialTickers());
  const dirty = useRef(false);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | undefined;
    let reconnectTimer = 0;
    const abortController = new AbortController();

    Promise.all(BINANCE_SYMBOLS.map((symbol) => fetchBinanceTicker(symbol, abortController.signal)))
      .then((rows) => {
        if (!active) return;
        pending.current = Object.fromEntries(rows.map((ticker) => [ticker.symbol, ticker])) as TickerMap;
        setTickers({ ...pending.current });
      })
      .catch(() => undefined);

    const connect = () => {
      if (!active || !navigator.onLine) return;
      socket = new WebSocket(tapeStreamUrl());
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { data?: Record<string, unknown> };
          const data = message.data;
          if (!data) return;
          const symbol = data?.s as BinanceSymbol | undefined;
          if (!symbol || !BINANCE_SYMBOLS.includes(symbol)) return;
          const previous = pending.current[symbol];
          pending.current = {
            ...pending.current,
            [symbol]: {
              ...previous,
              symbol,
              price: Number(data.c),
              high24h: Number(data.h),
              low24h: Number(data.l),
              volume24h: Number(data.v),
              quoteVolume24h: Number(data.q),
              change24hPercent: Number(data.o) ? (Number(data.c) / Number(data.o) - 1) * 100 : 0,
              eventTime: Number(data.E),
            },
          };
          dirty.current = true;
        } catch {
          // A malformed market-tape frame should not interrupt other symbols.
        }
      };
      socket.onclose = () => {
        if (active) reconnectTimer = window.setTimeout(connect, 3_000);
      };
    };
    connect();

    const flushTimer = window.setInterval(() => {
      if (!active || !dirty.current) return;
      dirty.current = false;
      setTickers({ ...pending.current });
    }, 3_000);

    return () => {
      active = false;
      abortController.abort();
      window.clearInterval(flushTimer);
      window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  return BINANCE_SYMBOLS.map((symbol) => tickers[symbol]);
}

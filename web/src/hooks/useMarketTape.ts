import { useEffect, useRef, useState } from "react";
import { emptyTicker, fetchBinanceTicker, symbolsForQuote, tapeStreamUrl, type BinanceQuoteAsset, type BinanceSymbol } from "../lib/binance";
import type { LiveTicker } from "../types";

type TickerMap = Record<BinanceSymbol, LiveTicker>;

function initialTickers(quote: BinanceQuoteAsset): TickerMap {
  return Object.fromEntries(symbolsForQuote(quote).map((symbol) => [symbol, emptyTicker(symbol)])) as TickerMap;
}

export function useMarketTape(quote: BinanceQuoteAsset, enabled = true) {
  const [tickers, setTickers] = useState<TickerMap>(() => initialTickers(quote));
  const pending = useRef<TickerMap>(initialTickers(quote));
  const dirty = useRef(false);

  useEffect(() => {
    const symbols = symbolsForQuote(quote);
    const initial = initialTickers(quote);
    pending.current = initial;
    setTickers(initial);
    if (!enabled) return undefined;
    let active = true;
    let socket: WebSocket | undefined;
    let reconnectTimer = 0;
    const abortController = new AbortController();

    Promise.all(symbols.map((symbol) => fetchBinanceTicker(symbol, abortController.signal)))
      .then((rows) => {
        if (!active) return;
        pending.current = Object.fromEntries(rows.map((ticker) => [ticker.symbol, ticker])) as TickerMap;
        setTickers({ ...pending.current });
      })
      .catch(() => undefined);

    const connect = () => {
      if (!active || !navigator.onLine) return;
      socket = new WebSocket(tapeStreamUrl(quote));
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { data?: Record<string, unknown> };
          const data = message.data;
          if (!data) return;
          const symbol = data?.s as BinanceSymbol | undefined;
          if (!symbol || !symbols.includes(symbol)) return;
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
  }, [enabled, quote]);

  return symbolsForQuote(quote).map((symbol) => tickers[symbol] ?? emptyTicker(symbol));
}

import { useEffect, useRef, useState } from "react";
import { microstructureStreamUrls, type BinanceSymbol, type MarketVenue } from "../lib/binance";
import type { MarketMicrostructure, OrderBookLevel, RecentTrade } from "../types";

const EMPTY: MarketMicrostructure = {
  bids: [],
  asks: [],
  trades: [],
  bidDepth: 0,
  askDepth: 0,
  imbalancePercent: 0,
  lastUpdate: 0,
  status: "connecting",
};

type RawLevel = [string, string];

function parseLevels(rows: RawLevel[]): OrderBookLevel[] {
  let runningTotal = 0;
  return rows.slice(0, 20).map(([rawPrice, rawQuantity]) => {
    const price = Number(rawPrice);
    const quantity = Number(rawQuantity);
    runningTotal += price * quantity;
    return { price, quantity, total: runningTotal };
  }).filter((level) => Number.isFinite(level.price) && Number.isFinite(level.quantity));
}

function quoteDepth(levels: OrderBookLevel[]): number {
  return levels.reduce((sum, level) => sum + level.price * level.quantity, 0);
}

export function useMarketMicrostructure(symbol: BinanceSymbol, enabled = true, venue: MarketVenue = "spot"): MarketMicrostructure {
  const [snapshot, setSnapshot] = useState<MarketMicrostructure>(EMPTY);
  const pending = useRef<MarketMicrostructure>(EMPTY);
  const dirty = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(EMPTY);
      return undefined;
    }
    let active = true;
    type StreamKind = "depth" | "trades";
    const sockets: Partial<Record<StreamKind, WebSocket>> = {};
    const reconnectTimers: Partial<Record<StreamKind, number>> = {};
    const reconnectAttempts: Record<StreamKind, number> = { depth: 0, trades: 0 };
    const openStreams = new Set<StreamKind>();
    const urls = microstructureStreamUrls(symbol, venue);
    pending.current = { ...EMPTY, status: navigator.onLine ? "connecting" : "offline" };
    setSnapshot(pending.current);

    const updateBalance = () => {
      const bidDepth = quoteDepth(pending.current.bids);
      const askDepth = quoteDepth(pending.current.asks);
      const total = bidDepth + askDepth;
      pending.current = {
        ...pending.current,
        bidDepth,
        askDepth,
        imbalancePercent: total ? (bidDepth - askDepth) / total * 100 : 0,
      };
    };

    const updateStatus = () => {
      pending.current = {
        ...pending.current,
        status: !navigator.onLine ? "offline" : openStreams.size === 2 ? "live" : openStreams.size ? "reconnecting" : "connecting",
      };
      dirty.current = true;
    };

    const handleMessage = (event: MessageEvent) => {
      if (!active) return;
      try {
        const message = JSON.parse(String(event.data)) as Record<string, unknown> & { data?: Record<string, unknown> };
        const data = message.data ?? message;
        const rawBids = data.bids ?? data.b;
        const rawAsks = data.asks ?? data.a;
        if (Array.isArray(rawBids) && Array.isArray(rawAsks)) {
          pending.current = {
            ...pending.current,
            bids: parseLevels(rawBids as RawLevel[]),
            asks: parseLevels(rawAsks as RawLevel[]),
            lastUpdate: Date.now(),
          };
          updateBalance();
        } else if (data.e === "aggTrade" || data.e === "trade") {
          const price = Number(data.p);
          const quantity = Number(data.q);
          const trade: RecentTrade = {
            id: Number(data.a ?? data.t),
            price,
            quantity,
            quoteValue: price * quantity,
            timestamp: Number(data.T),
            side: data.m ? "SELL" : "BUY",
          };
          if (Number.isFinite(trade.id) && Number.isFinite(price) && Number.isFinite(quantity)) {
            pending.current = { ...pending.current, trades: [trade, ...pending.current.trades.filter((item) => item.id !== trade.id)].slice(0, 24), lastUpdate: Date.now() };
          }
        }
        dirty.current = true;
      } catch {
        // Keep the stream alive when Binance sends an unexpected frame.
      }
    };

    const connect = (kind: StreamKind) => {
      if (!active || !navigator.onLine) {
        pending.current = { ...pending.current, status: "offline" };
        dirty.current = true;
        return;
      }
      window.clearTimeout(reconnectTimers[kind]);
      pending.current = { ...pending.current, status: reconnectAttempts[kind] ? "reconnecting" : "connecting" };
      dirty.current = true;
      const socket = new WebSocket(urls[kind]);
      sockets[kind] = socket;
      socket.onopen = () => {
        if (!active || sockets[kind] !== socket) return;
        reconnectAttempts[kind] = 0;
        openStreams.add(kind);
        updateStatus();
      };
      socket.onmessage = handleMessage;
      socket.onclose = () => {
        if (!active || sockets[kind] !== socket) return;
        sockets[kind] = undefined;
        openStreams.delete(kind);
        reconnectAttempts[kind] += 1;
        pending.current = { ...pending.current, status: navigator.onLine ? "reconnecting" : "offline" };
        dirty.current = true;
        reconnectTimers[kind] = window.setTimeout(() => connect(kind), Math.min(15_000, 1_000 * 2 ** Math.min(reconnectAttempts[kind], 4)));
      };
      socket.onerror = () => {
        if (!active || sockets[kind] !== socket) return;
        pending.current = { ...pending.current, status: "reconnecting" };
        dirty.current = true;
      };
    };

    connect("depth");
    connect("trades");
    const flushTimer = window.setInterval(() => {
      if (!active || !dirty.current) return;
      dirty.current = false;
      setSnapshot({ ...pending.current, bids: [...pending.current.bids], asks: [...pending.current.asks], trades: [...pending.current.trades] });
    }, 500);
    const onOnline = () => {
      (["depth", "trades"] as StreamKind[]).forEach((kind) => {
        if (!sockets[kind] || sockets[kind]?.readyState === WebSocket.CLOSED) connect(kind);
      });
    };
    const onOffline = () => {
      pending.current = { ...pending.current, status: "offline" };
      dirty.current = true;
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      active = false;
      window.clearInterval(flushTimer);
      Object.values(reconnectTimers).forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      Object.values(sockets).forEach((socket) => {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      });
    };
  }, [enabled, symbol, venue]);

  return snapshot;
}

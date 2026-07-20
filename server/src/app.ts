import { existsSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { runBacktest } from "./backtest.js";
import { LiveBroker } from "./liveBroker.js";
import { DEFAULT_PAIRS, fetchKrakenCandles } from "./marketData.js";
import { PaperBroker } from "./paperBroker.js";
import { scanMarkets } from "./scanner.js";
import type { MarketSnapshot } from "./types.js";

const paperOrderSchema = z.object({
  pair: z.string().min(3).max(30),
  side: z.enum(["LONG", "SHORT"]),
  entry: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive().optional(),
  sizeUsd: z.number().positive(),
  signalScore: z.number().min(-100).max(100).optional(),
});

const liveOrderSchema = z.object({
  pair: z.string().min(3).max(30),
  side: z.enum(["buy", "sell"]),
  type: z.literal("limit"),
  amount: z.number().positive(),
  price: z.number().positive(),
  stopLoss: z.number().positive(),
  acknowledge: z.literal("I UNDERSTAND THIS PLACES A REAL ORDER"),
});

export interface AppDependencies {
  paperBroker?: PaperBroker;
  scanner?: typeof scanMarkets;
  liveBroker?: LiveBroker;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const paperBroker = dependencies.paperBroker ?? new PaperBroker();
  const scanner = dependencies.scanner ?? scanMarkets;
  const liveBroker = dependencies.liveBroker ?? new LiveBroker();
  let scanCache: { value: MarketSnapshot; expiresAt: number } | undefined;
  const allowedOrigins = new Set((process.env.APP_ORIGIN ?? "http://127.0.0.1:5173,http://localhost:5173").split(",").map((origin) => origin.trim()));

  app.disable("x-powered-by");
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) callback(null, true);
      else callback(new Error("Origin is not allowed."));
    },
  }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_request, response) => response.json({
    status: "ok",
    mode: process.env.LIVE_TRADING_ENABLED === "true" ? "live-armed" : "paper",
    now: new Date().toISOString(),
  }));

  app.get("/api/markets", (_request, response) => response.json({ pairs: DEFAULT_PAIRS }));

  app.post("/api/scan", async (request, response, next) => {
    try {
      const requestedPairs = z.object({ pairs: z.array(z.string()).max(12).optional() }).parse(request.body).pairs;
      if (!requestedPairs && scanCache && scanCache.expiresAt > Date.now()) return response.json(scanCache.value);
      const value = await scanner({ pairs: requestedPairs });
      if (!requestedPairs) scanCache = { value, expiresAt: Date.now() + 30_000 };
      return response.json(value);
    } catch (error) { return next(error); }
  });

  app.post("/api/backtest", async (request, response, next) => {
    try {
      const input = z.object({ pair: z.string(), startingEquity: z.number().positive().default(10_000) }).parse(request.body);
      const candles = await fetchKrakenCandles(input.pair);
      return response.json(runBacktest(input.pair, candles, input.startingEquity));
    } catch (error) { return next(error); }
  });

  app.get("/api/paper/portfolio", async (_request, response, next) => {
    try { return response.json(await paperBroker.summary()); }
    catch (error) { return next(error); }
  });
  app.get("/api/paper/orders", async (_request, response, next) => {
    try { return response.json(await paperBroker.listOrders()); }
    catch (error) { return next(error); }
  });
  app.post("/api/paper/orders", async (request, response, next) => {
    try { return response.status(201).json(await paperBroker.place(paperOrderSchema.parse(request.body))); }
    catch (error) { return next(error); }
  });
  app.post("/api/paper/orders/:id/close", async (request, response, next) => {
    try {
      const { closePrice } = z.object({ closePrice: z.number().positive() }).parse(request.body);
      return response.json(await paperBroker.close(request.params.id, closePrice));
    } catch (error) { return next(error); }
  });
  app.post("/api/kill-switch", async (request, response, next) => {
    try {
      const { enabled } = z.object({ enabled: z.boolean() }).parse(request.body);
      return response.json(await paperBroker.setKillSwitch(enabled));
    } catch (error) { return next(error); }
  });
  app.post("/api/execution/orders", async (request, response, next) => {
    try {
      const order = liveOrderSchema.parse(request.body);
      const result = await liveBroker.place(order, request.header("x-trading-arm-token"));
      return response.status(201).json(result);
    } catch (error) { return next(error); }
  });

  const webDist = path.resolve("web/dist");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*splat", (_request, response) => response.sendFile(path.join(webDist, "index.html")));
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected error";
    response.status(error instanceof z.ZodError ? 400 : 422).json({ error: message });
  });
  return app;
}

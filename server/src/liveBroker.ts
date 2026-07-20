export interface LiveOrderRequest {
  pair: string;
  side: "buy" | "sell";
  type: "limit";
  amount: number;
  price: number;
  stopLoss: number;
  acknowledge: "I UNDERSTAND THIS PLACES A REAL ORDER";
}

export class LiveBroker {
  async place(request: LiveOrderRequest, armToken: string | undefined): Promise<unknown> {
    if (process.env.LIVE_TRADING_ENABLED !== "true") {
      throw new Error("Live trading is disabled. Use paper mode until the strategy is validated.");
    }
    if (!process.env.TRADING_ARM_TOKEN || armToken !== process.env.TRADING_ARM_TOKEN) {
      throw new Error("A valid trading arm token is required.");
    }
    if (request.acknowledge !== "I UNDERSTAND THIS PLACES A REAL ORDER") {
      throw new Error("Explicit live-order acknowledgement is required.");
    }
    const exchangeId = process.env.EXCHANGE_ID ?? "kraken";
    const { default: ccxt } = await import("ccxt");
    const ExchangeClass = ccxt[exchangeId as keyof typeof ccxt] as unknown as new (config: object) => {
      setSandboxMode: (enabled: boolean) => void;
      loadMarkets: () => Promise<void>;
      featureValue?: (symbol: string, method: string, feature: string) => unknown;
      createOrder: (symbol: string, type: string, side: string, amount: number, price?: number, params?: object) => Promise<unknown>;
    };
    if (typeof ExchangeClass !== "function") throw new Error(`Unsupported CCXT exchange: ${exchangeId}`);
    if (!process.env.EXCHANGE_API_KEY || !process.env.EXCHANGE_SECRET) {
      throw new Error("Exchange credentials are not configured.");
    }
    const accountEquity = Number(process.env.LIVE_ACCOUNT_EQUITY_USD);
    if (!Number.isFinite(accountEquity) || accountEquity <= 0) {
      throw new Error("LIVE_ACCOUNT_EQUITY_USD is required for real-order risk validation.");
    }
    const riskUsd = Math.abs(request.price - request.stopLoss) * request.amount;
    if (riskUsd > accountEquity * 0.01) throw new Error("Live order risk exceeds the 1% equity cap.");
    const exchange = new ExchangeClass({
      apiKey: process.env.EXCHANGE_API_KEY,
      secret: process.env.EXCHANGE_SECRET,
      enableRateLimit: true,
    });
    const production = process.env.LIVE_PRODUCTION_ACK === "YES_I_ACCEPT_REAL_LOSS_RISK";
    if (!production) exchange.setSandboxMode(true);
    await exchange.loadMarkets();
    const stopSupported = exchange.featureValue?.(request.pair, "createOrder", "stopLossPrice");
    if (stopSupported !== true) {
      throw new Error("The selected exchange does not advertise attached stop-loss support for this market.");
    }
    return exchange.createOrder(request.pair, request.type, request.side, request.amount, request.price, {
      stopLossPrice: request.stopLoss,
    });
  }
}

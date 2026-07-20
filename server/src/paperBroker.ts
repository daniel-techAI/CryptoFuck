import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface PaperOrderRequest {
  pair: string;
  side: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit?: number;
  sizeUsd: number;
  signalScore?: number;
}

export interface PaperOrder extends PaperOrderRequest {
  id: string;
  quantity: number;
  riskUsd: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string;
  closePrice?: number;
  realizedPnl?: number;
}

export interface PaperState {
  startingEquity: number;
  cash: number;
  realizedPnl: number;
  dailyStartEquity: number;
  dailyDate: string;
  killSwitch: boolean;
  orders: PaperOrder[];
}

export interface PortfolioSummary {
  equity: number;
  cash: number;
  realizedPnl: number;
  dailyPnl: number;
  dailyDrawdownPercent: number;
  openRiskUsd: number;
  openRiskPercent: number;
  killSwitch: boolean;
  openOrders: number;
  maxRiskPerTradePercent: number;
  maxOpenRiskPercent: number;
  maxDailyDrawdownPercent: number;
}

const MAX_RISK_PER_TRADE = 0.01;
const MAX_OPEN_RISK = 0.03;
const MAX_DAILY_DRAWDOWN = 0.03;
const MAX_POSITION_VALUE = 0.2;

function freshState(): PaperState {
  return {
    startingEquity: 100_000,
    cash: 100_000,
    realizedPnl: 0,
    dailyStartEquity: 100_000,
    dailyDate: new Date().toISOString().slice(0, 10),
    killSwitch: false,
    orders: [],
  };
}

export class PaperBroker {
  private state: PaperState = freshState();
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath = path.resolve("server/data/paper-state.json")) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      this.state = JSON.parse(await readFile(this.filePath, "utf8")) as PaperState;
    } catch {
      this.state = freshState();
    }
    const today = new Date().toISOString().slice(0, 10);
    if (this.state.dailyDate !== today) {
      this.state.dailyDate = today;
      this.state.dailyStartEquity = this.state.cash;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.state, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation, operation);
    this.writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private buildSummary(): PortfolioSummary {
    const openRiskUsd = this.state.orders
      .filter((order) => order.status === "OPEN")
      .reduce((sum, order) => sum + order.riskUsd, 0);
    const equity = this.state.cash;
    const dailyPnl = equity - this.state.dailyStartEquity;
    const dailyDrawdownPercent = Math.max(0, -dailyPnl / this.state.dailyStartEquity * 100);
    return {
      equity,
      cash: this.state.cash,
      realizedPnl: this.state.realizedPnl,
      dailyPnl,
      dailyDrawdownPercent,
      openRiskUsd,
      openRiskPercent: equity === 0 ? 0 : openRiskUsd / equity * 100,
      killSwitch: this.state.killSwitch,
      openOrders: this.state.orders.filter((order) => order.status === "OPEN").length,
      maxRiskPerTradePercent: MAX_RISK_PER_TRADE * 100,
      maxOpenRiskPercent: MAX_OPEN_RISK * 100,
      maxDailyDrawdownPercent: MAX_DAILY_DRAWDOWN * 100,
    };
  }

  async summary(): Promise<PortfolioSummary> {
    await this.ensureLoaded();
    await this.writeQueue;
    return this.buildSummary();
  }

  async listOrders(): Promise<PaperOrder[]> {
    await this.ensureLoaded();
    await this.writeQueue;
    return [...this.state.orders].reverse();
  }

  async setKillSwitch(enabled: boolean): Promise<PortfolioSummary> {
    return this.runExclusive(async () => {
      await this.ensureLoaded();
      this.state.killSwitch = enabled;
      await this.persist();
      return this.buildSummary();
    });
  }

  async place(request: PaperOrderRequest): Promise<PaperOrder> {
    return this.runExclusive(async () => {
      await this.ensureLoaded();
      const portfolio = this.buildSummary();
      if (portfolio.killSwitch) throw new Error("Kill switch is active; new orders are blocked.");
      if (![request.entry, request.stopLoss, request.sizeUsd].every(Number.isFinite)) {
        throw new Error("Entry, stop loss, and size must be finite numbers.");
      }
      if (request.entry <= 0 || request.sizeUsd <= 0) throw new Error("Entry and size must be positive.");
      if (request.side === "LONG" && request.stopLoss >= request.entry) throw new Error("Long stop must be below entry.");
      if (request.side === "SHORT" && request.stopLoss <= request.entry) throw new Error("Short stop must be above entry.");
      if (request.sizeUsd > portfolio.equity * MAX_POSITION_VALUE) {
        throw new Error(`Position value exceeds ${(MAX_POSITION_VALUE * 100).toFixed(0)}% equity cap.`);
      }
      const quantity = request.sizeUsd / request.entry;
      const riskUsd = Math.abs(request.entry - request.stopLoss) * quantity;
      if (riskUsd > portfolio.equity * MAX_RISK_PER_TRADE) {
        throw new Error(`Trade risk exceeds ${(MAX_RISK_PER_TRADE * 100).toFixed(0)}% equity cap.`);
      }
      if (portfolio.openRiskUsd + riskUsd > portfolio.equity * MAX_OPEN_RISK) {
        throw new Error(`Portfolio open risk exceeds ${(MAX_OPEN_RISK * 100).toFixed(0)}% equity cap.`);
      }
      if (portfolio.dailyDrawdownPercent >= MAX_DAILY_DRAWDOWN * 100) {
        throw new Error("Daily drawdown limit reached; trading is locked until the next UTC day.");
      }
      const order: PaperOrder = {
        ...request,
        id: randomUUID(),
        quantity,
        riskUsd,
        status: "OPEN",
        openedAt: new Date().toISOString(),
      };
      this.state.orders.push(order);
      await this.persist();
      return order;
    });
  }

  async close(id: string, closePrice: number): Promise<PaperOrder> {
    return this.runExclusive(async () => {
      await this.ensureLoaded();
      const order = this.state.orders.find((candidate) => candidate.id === id);
      if (!order || order.status !== "OPEN") throw new Error("Open paper order not found.");
      if (!Number.isFinite(closePrice) || closePrice <= 0) throw new Error("Close price must be positive.");
      const side = order.side === "LONG" ? 1 : -1;
      const realizedPnl = (closePrice - order.entry) * order.quantity * side;
      order.status = "CLOSED";
      order.closePrice = closePrice;
      order.closedAt = new Date().toISOString();
      order.realizedPnl = realizedPnl;
      this.state.cash += realizedPnl;
      this.state.realizedPnl += realizedPnl;
      await this.persist();
      return order;
    });
  }
}

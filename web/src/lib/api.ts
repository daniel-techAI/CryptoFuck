import type { MarketSnapshot, PaperOrder, PaperOrderRequest, PortfolioSummary } from "../types";
import { getSupabaseClient } from "./supabase";

const LOCAL_PORTFOLIO_KEY = "nocturne.paper-portfolio.v1";
const LOCAL_ORDERS_KEY = "nocturne.paper-orders.v1";
const LOCAL_PREFERENCES_KEY = "nocturne.preferences.v2";

export interface UserPreferences {
  autoScan: boolean;
  signalAlerts: boolean;
  alertThreshold: number;
}

const defaultPreferences: UserPreferences = { autoScan: false, signalAlerts: false, alertThreshold: 75 };

function defaultPortfolio(): PortfolioSummary {
  return {
    equity: 100_000,
    cash: 100_000,
    realizedPnl: 0,
    dailyPnl: 0,
    dailyDrawdownPercent: 0,
    openRiskUsd: 0,
    openRiskPercent: 0,
    killSwitch: false,
    openOrders: 0,
    maxRiskPerTradePercent: 1,
    maxOpenRiskPercent: 3,
    maxDailyDrawdownPercent: 3,
  };
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("Expected JSON response");
  return response.json() as Promise<T>;
}

async function cloudSession() {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user ? { client, userId: data.session.user.id } : null;
}

function asNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapPortfolio(row: Record<string, unknown>): PortfolioSummary {
  return {
    equity: asNumber(row.equity),
    cash: asNumber(row.cash),
    realizedPnl: asNumber(row.realized_pnl),
    dailyPnl: asNumber(row.daily_pnl),
    dailyDrawdownPercent: asNumber(row.daily_drawdown_percent),
    openRiskUsd: asNumber(row.open_risk_usd),
    openRiskPercent: asNumber(row.open_risk_percent),
    killSwitch: Boolean(row.kill_switch),
    openOrders: asNumber(row.open_orders),
    maxRiskPerTradePercent: 1,
    maxOpenRiskPercent: 3,
    maxDailyDrawdownPercent: 3,
  };
}

function mapPaperOrder(row: Record<string, unknown>): PaperOrder {
  return {
    id: String(row.id),
    pair: String(row.pair),
    side: row.side as PaperOrder["side"],
    entry: asNumber(row.entry as number | string),
    stopLoss: asNumber(row.stop_loss as number | string),
    takeProfit: row.take_profit === null ? undefined : asNumber(row.take_profit as number | string),
    sizeUsd: asNumber(row.size_usd as number | string),
    signalScore: row.signal_score === null ? undefined : asNumber(row.signal_score as number | string),
    quantity: asNumber(row.quantity as number | string),
    riskUsd: asNumber(row.risk_usd as number | string),
    status: row.status as PaperOrder["status"],
    openedAt: String(row.opened_at),
  };
}

export async function scanMarkets(): Promise<MarketSnapshot> {
  try {
    return await jsonFetch<MarketSnapshot>("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  } catch {
    return jsonFetch<MarketSnapshot>(`${import.meta.env.BASE_URL}data/market-snapshot.json`, { cache: "no-store" });
  }
}

export async function loadPortfolio(): Promise<PortfolioSummary> {
  const cloud = await cloudSession();
  if (cloud) {
    const { client } = cloud;
    const { data, error } = await client.rpc("paper_portfolio_summary");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapPortfolio(row as Record<string, unknown>) : defaultPortfolio();
  }
  const stored = localStorage.getItem(LOCAL_PORTFOLIO_KEY);
  return stored ? { ...defaultPortfolio(), ...JSON.parse(stored) as PortfolioSummary } : defaultPortfolio();
}

export async function loadPaperOrders(): Promise<PaperOrder[]> {
  const cloud = await cloudSession();
  if (cloud) {
    const { client, userId } = cloud;
    const { data, error } = await client.from("paper_orders").select("id, pair, side, entry, stop_loss, take_profit, size_usd, signal_score, quantity, risk_usd, status, opened_at").eq("user_id", userId).order("opened_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map((row) => mapPaperOrder(row));
  }
  return JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) ?? "[]") as PaperOrder[];
}

export async function placePaperOrder(request: PaperOrderRequest): Promise<PaperOrder> {
  const cloud = await cloudSession();
  if (cloud) {
    const { client } = cloud;
    const { data, error } = await client.rpc("place_paper_order", {
      p_entry: request.entry,
      p_pair: request.pair,
      p_side: request.side,
      p_signal_score: request.signalScore ?? null,
      p_size_usd: request.sizeUsd,
      p_stop_loss: request.stopLoss,
      p_take_profit: request.takeProfit ?? null,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return mapPaperOrder(row as Record<string, unknown>);
  }
  const portfolio = await loadPortfolio();
  if (portfolio.killSwitch) throw new Error("Kill switch is active; new orders are blocked.");
  if (request.side === "LONG" && request.stopLoss >= request.entry) throw new Error("Long stop must be below entry.");
  if (request.side === "SHORT" && request.stopLoss <= request.entry) throw new Error("Short stop must be above entry.");
  const quantity = request.sizeUsd / request.entry;
  const riskUsd = Math.abs(request.entry - request.stopLoss) * quantity;
  if (request.sizeUsd > portfolio.equity * 0.2) throw new Error("Position value exceeds 20% equity cap.");
  if (riskUsd > portfolio.equity * 0.01) throw new Error("Trade risk exceeds 1% equity cap.");
  if (portfolio.openRiskUsd + riskUsd > portfolio.equity * 0.03) throw new Error("Portfolio open risk exceeds 3% equity cap.");
  const order: PaperOrder = { ...request, id: crypto.randomUUID(), quantity, riskUsd, status: "OPEN", openedAt: new Date().toISOString() };
  const orders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) ?? "[]") as PaperOrder[];
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([...orders, order]));
  localStorage.setItem(LOCAL_PORTFOLIO_KEY, JSON.stringify({
    ...portfolio,
    openRiskUsd: portfolio.openRiskUsd + riskUsd,
    openRiskPercent: (portfolio.openRiskUsd + riskUsd) / portfolio.equity * 100,
    openOrders: portfolio.openOrders + 1,
  }));
  return order;
}

export async function setKillSwitch(enabled: boolean): Promise<PortfolioSummary> {
  const cloud = await cloudSession();
  if (cloud) {
    const { client } = cloud;
    const { error } = await client.rpc("set_paper_kill_switch", { p_enabled: enabled });
    if (error) throw error;
    return loadPortfolio();
  }
  const portfolio = { ...await loadPortfolio(), killSwitch: enabled };
  localStorage.setItem(LOCAL_PORTFOLIO_KEY, JSON.stringify(portfolio));
  return portfolio;
}

export async function loadUserPreferences(): Promise<UserPreferences> {
  const legacyAutoScan = localStorage.getItem("nocturne.auto-scan") === "true";
  const local = JSON.parse(localStorage.getItem(LOCAL_PREFERENCES_KEY) ?? "{}") as Partial<UserPreferences>;
  if (local.autoScan === undefined && legacyAutoScan) local.autoScan = true;
  const fallback = { ...defaultPreferences, ...local };
  const cloud = await cloudSession();
  if (!cloud) return fallback;
  const { client, userId } = cloud;
  const { data, error } = await client.from("user_preferences").select("auto_scan, signal_alerts, alert_threshold").eq("user_id", userId).single();
  if (error) throw error;
  return {
    autoScan: data.auto_scan,
    signalAlerts: data.signal_alerts,
    alertThreshold: data.alert_threshold,
  };
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
  const cloud = await cloudSession();
  if (!cloud) return;
  const { client, userId } = cloud;
  const { error } = await client.from("user_preferences").update({
    auto_scan: preferences.autoScan,
    signal_alerts: preferences.signalAlerts,
    alert_threshold: preferences.alertThreshold,
  }).eq("user_id", userId);
  if (error) throw error;
}

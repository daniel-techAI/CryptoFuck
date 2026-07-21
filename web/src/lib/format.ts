import type { BinanceQuoteAsset } from "./binance";

export function formatPrice(value: number): string {
  const maximumFractionDigits = value >= 1000 ? 2 : value >= 1 ? 2 : 6;
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits });
}

export function formatQuoteCurrency(value: number, quote: BinanceQuoteAsset): string {
  if (quote === "EUR") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  }
  return `${new Intl.NumberFormat("en-US", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value)} ${quote}`;
}

export function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatScanTime(value: string): string {
  return `${new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })} UTC`;
}

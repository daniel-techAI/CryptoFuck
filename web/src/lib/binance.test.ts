import { describe, expect, it } from "vitest";
import {
  baseAssetFromSymbol,
  createBinanceSymbol,
  displaySymbol,
  liveStreamUrl,
  quoteAssetFromSymbol,
  symbolsForQuote,
  tapeStreamUrl,
} from "./binance";
import { formatQuoteCurrency } from "./format";

describe("Binance market pairs", () => {
  it("builds EUR as a first-class market quote", () => {
    const symbol = createBinanceSymbol("BTC", "EUR");
    expect(symbol).toBe("BTCEUR");
    expect(displaySymbol(symbol)).toBe("BTC / EUR");
    expect(baseAssetFromSymbol(symbol)).toBe("BTC");
    expect(quoteAssetFromSymbol(symbol)).toBe("EUR");
  });

  it("creates a complete tape for each selected quote", () => {
    expect(symbolsForQuote("USDC")).toEqual(["BTCUSDC", "ETHUSDC", "SOLUSDC", "BNBUSDC", "XRPUSDC"]);
    expect(tapeStreamUrl("EUR")).toContain("btceur@miniTicker");
    expect(tapeStreamUrl("EUR")).toContain("xrpeur@miniTicker");
  });

  it("routes USDC to the requested Spot or Futures stream", () => {
    expect(liveStreamUrl("BTCUSDC", "15m", "spot")).toContain("stream.binance.com");
    expect(liveStreamUrl("BTCUSDC", "15m", "futures")).toContain("fstream.binance.com");
  });

  it("formats quote amounts without presenting stablecoins as dollars", () => {
    expect(formatQuoteCurrency(1_250, "EUR")).toContain("€");
    expect(formatQuoteCurrency(1_250, "USDT")).toBe("1,250 USDT");
    expect(formatQuoteCurrency(1_250, "USDC")).toBe("1,250 USDC");
  });
});

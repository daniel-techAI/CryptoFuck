import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PaperBroker } from "../src/paperBroker.js";

async function broker(): Promise<PaperBroker> {
  const directory = await mkdtemp(path.join(tmpdir(), "nocturne-test-"));
  return new PaperBroker(path.join(directory, "state.json"));
}

describe("PaperBroker", () => {
  it("accepts a sized order and reports open risk", async () => {
    const instance = await broker();
    const order = await instance.place({ pair: "BTC/USD", side: "LONG", entry: 100, stopLoss: 95, sizeUsd: 10_000 });
    expect(order.riskUsd).toBe(500);
    expect((await instance.summary()).openRiskUsd).toBe(500);
  });

  it("blocks oversized risk and all orders after the kill switch", async () => {
    const instance = await broker();
    await expect(instance.place({ pair: "BTC/USD", side: "LONG", entry: 100, stopLoss: 80, sizeUsd: 10_000 })).rejects.toThrow("risk exceeds");
    await instance.setKillSwitch(true);
    await expect(instance.place({ pair: "BTC/USD", side: "LONG", entry: 100, stopLoss: 95, sizeUsd: 1_000 })).rejects.toThrow("Kill switch");
  });

  it("serializes concurrent order writes without losing open risk", async () => {
    const instance = await broker();
    await Promise.all(["BTC/USD", "ETH/USD", "SOL/USD"].map((pair) => instance.place({
      pair,
      side: "LONG",
      entry: 100,
      stopLoss: 95,
      sizeUsd: 10_000,
    })));
    const summary = await instance.summary();
    expect(summary.openOrders).toBe(3);
    expect(summary.openRiskUsd).toBe(1_500);
  });
});

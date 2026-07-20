import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { PaperBroker } from "../src/paperBroker.js";

describe("API", () => {
  it("exposes health and validates paper orders", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nocturne-api-"));
    const app = createApp({ paperBroker: new PaperBroker(path.join(directory, "state.json")) });
    expect((await request(app).get("/api/health")).body.mode).toBe("paper");
    const invalid = await request(app).post("/api/paper/orders").send({ pair: "BTC/USD" });
    expect(invalid.status).toBe(400);
  });

  it("rejects unconfigured browser origins", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nocturne-cors-"));
    const app = createApp({ paperBroker: new PaperBroker(path.join(directory, "state.json")) });
    const response = await request(app).get("/api/health").set("Origin", "https://attacker.example");
    expect(response.status).toBe(422);
    expect(response.body.error).toContain("Origin is not allowed");
  });
});

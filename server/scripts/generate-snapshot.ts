import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { scanMarkets } from "../src/scanner.js";

const outputPath = path.resolve(process.cwd(), "../web/public/data/market-snapshot.json");
const snapshot = await scanMarkets({ allowOfflineFallback: process.env.ALLOW_OFFLINE_SNAPSHOT === "true" });
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(snapshot, null, 2), "utf8");
console.log(`Wrote ${snapshot.signals.length} signals from ${snapshot.source} to ${outputPath}`);

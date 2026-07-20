import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? "/CryptoFuck/" : "/");

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "nocturne-icon.svg", "nocturne-192.png", "nocturne-512.png"],
      manifest: {
        name: "NOCTURNE — Crypto Market Command",
        short_name: "NOCTURNE",
        description: "Explainable crypto market signals, backtesting, and private paper trading.",
        theme_color: "#03111b",
        background_color: "#03111b",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
        categories: ["finance", "productivity"],
        icons: [
          { src: "nocturne-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "nocturne-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "nocturne-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,svg,png,woff,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: true },
    }),
  ],
  base,
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});

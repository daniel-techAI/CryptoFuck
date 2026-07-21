import { Download, UserRound } from "lucide-react";
import { BINANCE_BASE_ASSETS, type BinanceBaseAsset, type BinanceQuoteAsset } from "../lib/binance";
import type { LiveConnectionStatus } from "../types";

export type AppTab = "overview" | "spot" | "futures" | "decision" | "backtest" | "account";

const tabs: Array<{ id: AppTab; label: string }> = [
  { id: "overview", label: "Markets" },
  { id: "spot", label: "Spot" },
  { id: "futures", label: "Futures" },
  { id: "decision", label: "Decision" },
  { id: "backtest", label: "Backtest" },
  { id: "account", label: "Account" },
];

function connectionLabel(status: LiveConnectionStatus, ageSeconds: number): string {
  if (status === "live" && ageSeconds <= 10) return "BINANCE LIVE";
  if (status === "offline") return "OFFLINE";
  if (status === "error") return "DATA ERROR";
  return "RECONNECTING";
}

interface AppHeaderProps {
  activeTab: AppTab;
  onTab: (tab: AppTab) => void;
  baseAsset: BinanceBaseAsset;
  quoteAsset: BinanceQuoteAsset;
  quoteOptions: readonly BinanceQuoteAsset[];
  onBaseAsset: (base: BinanceBaseAsset) => void;
  onQuoteAsset: (quote: BinanceQuoteAsset) => void;
  status: LiveConnectionStatus;
  ageSeconds: number;
  onInstall: () => void;
  installed: boolean;
  onAccount: () => void;
  accountLabel: string;
  avatarUrl?: string | null;
}

export function AppHeader({ activeTab, onTab, baseAsset, quoteAsset, quoteOptions, onBaseAsset, onQuoteAsset, status, ageSeconds, onInstall, installed, onAccount, accountLabel, avatarUrl }: AppHeaderProps) {
  const live = status === "live" && ageSeconds <= 10;
  return (
    <header className="app-header">
      <button className="brand" onClick={() => onTab("overview")}>NOCTURNE</button>
      <nav className="top-tabs" aria-label="Workspace">
        {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => onTab(tab.id)}>{tab.label}</button>)}
      </nav>
      <div className="header-tools">
        <div className="market-selectors" aria-label="Market pair">
          <label className="market-select base-select"><span className="sr-only">Coin</span><select aria-label="Coin" value={baseAsset} onChange={(event) => onBaseAsset(event.target.value as BinanceBaseAsset)}>{BINANCE_BASE_ASSETS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <span aria-hidden="true">/</span>
          <label className="market-select quote-select"><span className="sr-only">Quote currency</span><select aria-label="Quote currency" value={quoteAsset} onChange={(event) => onQuoteAsset(event.target.value as BinanceQuoteAsset)}>{quoteOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <div className={`live-status ${live ? "is-live" : "is-delayed"}`} title="Public Binance WebSocket market data">
          <i aria-hidden="true" /><strong>{connectionLabel(status, ageSeconds)}</strong><span>{ageSeconds < 60 ? `Updated ${ageSeconds}s ago` : "Waiting for data"}</span>
        </div>
        <button className="header-action" onClick={onInstall}><Download aria-hidden="true" /><span>{installed ? "Installed" : "Install app"}</span></button>
        <button className="profile-action" onClick={onAccount} aria-label={`Open ${accountLabel}`} title={accountLabel}>
          {avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : <UserRound aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}

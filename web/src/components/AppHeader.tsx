import { Download, UserRound } from "lucide-react";
import type { BinanceSymbol } from "../lib/binance";
import { BINANCE_SYMBOLS, SYMBOL_LABELS } from "../lib/binance";
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
  symbol: BinanceSymbol;
  onSymbol: (symbol: BinanceSymbol) => void;
  status: LiveConnectionStatus;
  ageSeconds: number;
  onInstall: () => void;
  installed: boolean;
  onAccount: () => void;
  accountLabel: string;
  avatarUrl?: string | null;
}

export function AppHeader({ activeTab, onTab, symbol, onSymbol, status, ageSeconds, onInstall, installed, onAccount, accountLabel, avatarUrl }: AppHeaderProps) {
  const live = status === "live" && ageSeconds <= 10;
  return (
    <header className="app-header">
      <button className="brand" onClick={() => onTab("overview")}>NOCTURNE</button>
      <nav className="top-tabs" aria-label="Workspace">
        {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => onTab(tab.id)}>{tab.label}</button>)}
      </nav>
      <div className="header-tools">
        <label className="market-select"><span className="sr-only">Market</span><select value={symbol} onChange={(event) => onSymbol(event.target.value as BinanceSymbol)}>{BINANCE_SYMBOLS.map((item) => <option key={item} value={item}>{SYMBOL_LABELS[item]}</option>)}</select></label>
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

import { Download, Play, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { formatScanTime } from "../lib/format";

interface CommandHeaderProps {
  generatedAt?: string;
  scanning: boolean;
  stale: boolean;
  onScan: () => void;
  onInstall: () => void;
  installed: boolean;
  onAccount: () => void;
  accountLabel: string;
  avatarUrl?: string | null;
}

export function CommandHeader({ generatedAt, scanning, stale, onScan, onInstall, installed, onAccount, accountLabel, avatarUrl }: CommandHeaderProps) {
  return (
    <header className="command-header">
      <h1>Market command</h1>
      <div className="header-actions">
        <div className="mode-status" title="No exchange orders will be placed">
          <ShieldCheck aria-hidden="true" />
          <span><strong>Paper mode</strong><small>All trades are simulated</small></span>
        </div>
        <div className="scan-time">
          <span>Last scan</span>
          <strong>{generatedAt ? formatScanTime(generatedAt) : "—"}</strong>
          {stale ? <small>cached data</small> : null}
        </div>
        <button className="scan-button" onClick={onScan} disabled={scanning}>
          <Play aria-hidden="true" />{scanning ? "Scanning…" : "Run scan"}
        </button>
        <button className="header-utility-button install-button" onClick={onInstall} title={installed ? "NOCTURNE is installed" : "Install NOCTURNE"}>
          <Download aria-hidden="true" /><span>{installed ? "Installed" : "Install"}</span>
        </button>
        <button className="account-button" onClick={onAccount} title={accountLabel} aria-label={`Open account: ${accountLabel}`}>
          {avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : <UserRound aria-hidden="true" />}
          <span>{accountLabel}</span>
        </button>
        <button className="header-icon-button" aria-label="Open automation settings" onClick={() => document.getElementById("automation")?.scrollIntoView({ behavior: "smooth" })}><Settings2 /></button>
      </div>
    </header>
  );
}

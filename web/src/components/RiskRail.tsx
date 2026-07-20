import { AlertTriangle, Eye, Power, Shield } from "lucide-react";
import { formatCompactUsd, formatPercent } from "../lib/format";
import type { PortfolioSummary } from "../types";

export function RiskRail({ portfolio, busy, onToggle }: { portfolio: PortfolioSummary; busy: boolean; onToggle: (enabled: boolean) => void }) {
  return (
    <footer className="risk-rail" aria-label="Portfolio risk controls">
      <div className="risk-metric"><span>Portfolio value <Eye /></span><strong>{formatCompactUsd(portfolio.equity)}</strong><small>Cash {formatCompactUsd(portfolio.cash)}</small></div>
      <div className="risk-metric"><span>Daily P&amp;L</span><strong className={portfolio.dailyPnl >= 0 ? "positive" : "negative"}>{formatCompactUsd(portfolio.dailyPnl)}</strong><small>{formatPercent(portfolio.dailyPnl / portfolio.equity * 100)}</small></div>
      <div className="risk-metric"><span>Daily drawdown</span><strong>{portfolio.dailyDrawdownPercent.toFixed(2)}%</strong><small className={portfolio.dailyDrawdownPercent > 2 ? "negative" : ""}><AlertTriangle />Limit {portfolio.maxDailyDrawdownPercent.toFixed(0)}%</small></div>
      <div className="risk-metric"><span>Open risk <Shield /></span><strong>{formatCompactUsd(portfolio.openRiskUsd)}</strong><small>{portfolio.openRiskPercent.toFixed(2)}% of equity · {portfolio.openOrders} open</small></div>
      <div className="risk-metric kill-control"><span>Kill switch</span><button className={portfolio.killSwitch ? "kill-on" : "kill-off"} onClick={() => onToggle(!portfolio.killSwitch)} disabled={busy} aria-pressed={portfolio.killSwitch}><Power />{portfolio.killSwitch ? "LOCKED" : "ARMED"}</button><small>{portfolio.killSwitch ? "New orders blocked" : "Paper orders allowed"}</small></div>
    </footer>
  );
}

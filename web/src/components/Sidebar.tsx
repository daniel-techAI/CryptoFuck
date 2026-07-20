import { BarChart3, BookOpen, Bot, Crosshair, FlaskConical, HelpCircle, Settings2, WalletCards } from "lucide-react";

const primaryItems = [
  { label: "Command", icon: Crosshair, target: "command" },
  { label: "Markets", icon: BarChart3, target: "markets" },
  { label: "Strategies", icon: FlaskConical, target: "strategies" },
  { label: "Paper ledger", icon: WalletCards, target: "ledger" },
  { label: "Automation", icon: Bot, target: "automation" },
];

export function Sidebar() {
  const navigate = (target: string) => document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <button className="wordmark" onClick={() => navigate("command")}>NOCTURNE</button>
      <nav className="nav-list">
        {primaryItems.map(({ label, icon: Icon, target }, index) => (
          <button key={label} className={`nav-item ${index === 0 ? "active" : ""}`} onClick={() => navigate(target)}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>
      <nav className="nav-list nav-bottom" aria-label="Secondary navigation">
        <button className="nav-item" onClick={() => navigate("automation")}><Settings2 aria-hidden="true" /><span>Settings</span></button>
        <a className="nav-item" href="https://github.com/daniel-techAI/CryptoFuck#readme" target="_blank" rel="noreferrer"><BookOpen aria-hidden="true" /><span>Docs</span></a>
        <a className="nav-item" href="https://github.com/daniel-techAI/CryptoFuck/blob/main/docs/risk-and-operations.md" target="_blank" rel="noreferrer"><HelpCircle aria-hidden="true" /><span>Help</span></a>
      </nav>
    </aside>
  );
}

import { AlertCircle, CheckCircle2, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { AccountDialog } from "./components/AccountDialog";
import { CommandHeader } from "./components/CommandHeader";
import { InstallDialog } from "./components/InstallDialog";
import { MarketScanner } from "./components/MarketScanner";
import { OperationsDeck } from "./components/OperationsDeck";
import { PriceChart } from "./components/PriceChart";
import { RiskRail } from "./components/RiskRail";
import { Sidebar } from "./components/Sidebar";
import { SignalThesis } from "./components/SignalThesis";
import { TradeTicket } from "./components/TradeTicket";
import { loadPaperOrders, loadPortfolio, loadUserPreferences, placePaperOrder, saveUserPreferences, scanMarkets, setKillSwitch, type UserPreferences } from "./lib/api";
import { useInstallApp } from "./hooks/useInstallApp";
import type { MarketSignal, MarketSnapshot, PaperOrder, PaperOrderRequest, PortfolioSummary } from "./types";

const emptyPortfolio: PortfolioSummary = {
  equity: 100_000,
  cash: 100_000,
  realizedPnl: 0,
  dailyPnl: 0,
  dailyDrawdownPercent: 0,
  openRiskUsd: 0,
  openRiskPercent: 0,
  killSwitch: false,
  openOrders: 0,
  maxRiskPerTradePercent: 1,
  maxOpenRiskPercent: 3,
  maxDailyDrawdownPercent: 3,
};

function App() {
  const { user, profile } = useAuth();
  const installApp = useInstallApp();
  const [snapshot, setSnapshot] = useState<MarketSnapshot>();
  const [selectedPair, setSelectedPair] = useState("BTC/USD");
  const [ticketSignal, setTicketSignal] = useState<MarketSignal>();
  const [portfolio, setPortfolio] = useState<PortfolioSummary>(emptyPortfolio);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({ autoScan: localStorage.getItem("nocturne.auto-scan") === "true", signalAlerts: false, alertThreshold: 75 });
  const [scanning, setScanning] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [killBusy, setKillBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string }>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const lastAlert = useRef("");

  const runScan = useCallback(async () => {
    setScanning(true);
    setNotice(undefined);
    try {
      const next = await scanMarkets();
      setSnapshot(next);
      if (!next.signals.some((signal) => signal.pair === selectedPair)) setSelectedPair(next.signals[0]?.pair ?? "");
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Market scan failed." });
    } finally { setScanning(false); }
  }, [selectedPair]);

  useEffect(() => {
    let active = true;
    Promise.all([scanMarkets(), loadPortfolio(), loadPaperOrders(), loadUserPreferences()])
      .then(([nextSnapshot, nextPortfolio, nextOrders, nextPreferences]) => {
        if (!active) return;
        setSnapshot(nextSnapshot);
        setPortfolio(nextPortfolio);
        setOrders(nextOrders);
        setPreferences(nextPreferences);
      })
      .catch((error: unknown) => {
        if (active) setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not initialize dashboard." });
      })
      .finally(() => { if (active) setScanning(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    localStorage.removeItem("nocturne.auto-scan");
    if (!preferences.autoScan) return undefined;
    const timer = window.setInterval(runScan, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [preferences.autoScan, runScan]);

  useEffect(() => {
    let active = true;
    Promise.all([loadPortfolio(), loadPaperOrders(), loadUserPreferences()])
      .then(([nextPortfolio, nextOrders, nextPreferences]) => {
        if (!active) return;
        setPortfolio(nextPortfolio);
        setOrders(nextOrders);
        setPreferences(nextPreferences);
      })
      .catch((error: unknown) => {
        if (active && user) setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not load the cloud profile." });
      });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!snapshot || !preferences.signalAlerts || !("Notification" in window) || Notification.permission !== "granted") return;
    const candidate = [...snapshot.signals]
      .filter((signal) => signal.direction !== "WAIT" && signal.probability >= preferences.alertThreshold)
      .sort((left, right) => right.probability - left.probability)[0];
    if (!candidate) return;
    const alertKey = `${snapshot.generatedAt}:${candidate.pair}:${candidate.direction}`;
    if (lastAlert.current === alertKey) return;
    lastAlert.current = alertKey;
    new Notification(`${candidate.displayPair} · ${candidate.direction} ${candidate.probability}%`, {
      body: `${candidate.regime}. Open NOCTURNE to inspect the evidence and invalidation level.`,
      icon: `${import.meta.env.BASE_URL}nocturne-192.png`,
      tag: `nocturne-${candidate.pair}`,
    });
  }, [preferences.alertThreshold, preferences.signalAlerts, snapshot]);

  const selectedSignal = useMemo(
    () => snapshot?.signals.find((signal) => signal.pair === selectedPair) ?? snapshot?.signals[0],
    [selectedPair, snapshot],
  );

  const submitPaperTrade = async (request: PaperOrderRequest) => {
    setSubmitting(true);
    try {
      await placePaperOrder(request);
      const [nextPortfolio, nextOrders] = await Promise.all([loadPortfolio(), loadPaperOrders()]);
      setPortfolio(nextPortfolio);
      setOrders(nextOrders);
      setTicketSignal(undefined);
      setNotice({ kind: "success", message: `${request.pair} paper trade added to the ledger.` });
    } finally { setSubmitting(false); }
  };

  const toggleKillSwitch = async (enabled: boolean) => {
    setKillBusy(true);
    try {
      setPortfolio(await setKillSwitch(enabled));
      setNotice({ kind: "success", message: enabled ? "Kill switch engaged. New orders are blocked." : "Kill switch released for paper orders." });
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not update kill switch." });
    } finally { setKillBusy(false); }
  };

  const updatePreferences = async (next: UserPreferences) => {
    setPreferences(next);
    try { await saveUserPreferences(next); }
    catch (error) { setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not sync preferences." }); }
  };

  const toggleSignalAlerts = async (enabled: boolean) => {
    if (enabled && "Notification" in window && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotice({ kind: "error", message: "Browser notifications were not enabled. Signals still remain visible in the scanner." });
        return;
      }
    }
    await updatePreferences({ ...preferences, signalAlerts: enabled });
    setNotice({ kind: "success", message: enabled ? `Conviction alerts enabled at ${preferences.alertThreshold}% or higher.` : "Conviction alerts disabled." });
  };

  const openInstall = async () => {
    if (installApp.canInstall) {
      const accepted = await installApp.install();
      if (accepted) setNotice({ kind: "success", message: "NOCTURNE installed. Future updates arrive automatically." });
      return;
    }
    setInstallOpen(true);
  };

  if (!snapshot || !selectedSignal) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">N</span><h1>NOCTURNE</h1><p>{notice?.message ?? "Reading closed market candles…"}</p>
        {notice ? <button className="scan-button" onClick={runScan}>Retry scan</button> : null}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace" id="command">
        <CommandHeader
          generatedAt={snapshot.generatedAt}
          scanning={scanning}
          stale={snapshot.stale}
          onScan={runScan}
          onInstall={() => void openInstall()}
          installed={installApp.installed}
          onAccount={() => setAccountOpen(true)}
          accountLabel={profile?.handle ? `@${profile.handle}` : profile?.displayName || (user ? "Profile" : "Sign in")}
          avatarUrl={profile?.avatarUrl}
        />
        {snapshot.stale ? <div className="data-warning"><WifiOff />Some markets use labeled offline sample data. Do not act on stale signals.</div> : null}
        {notice ? <div className={`notice ${notice.kind}`} role="status">{notice.kind === "success" ? <CheckCircle2 /> : <AlertCircle />}{notice.message}<button aria-label="Dismiss notice" onClick={() => setNotice(undefined)}>×</button></div> : null}
        <main className="dashboard-content">
          <div className="analysis-grid">
            <PriceChart signal={selectedSignal} scanning={scanning} />
            <SignalThesis signal={selectedSignal} />
          </div>
          <MarketScanner signals={snapshot.signals} selectedPair={selectedSignal.pair} onSelect={(signal) => setSelectedPair(signal.pair)} onConfigure={setTicketSignal} scanning={scanning} />
          <RiskRail portfolio={portfolio} busy={killBusy} onToggle={toggleKillSwitch} />
          <p className="disclaimer">Research and simulation only. Probabilities are heuristic scores, not calibrated guarantees or financial advice. Crypto can lose substantial value.</p>
          <OperationsDeck
            snapshot={snapshot}
            signal={selectedSignal}
            orders={orders}
            autoScan={preferences.autoScan}
            onAutoScan={(enabled) => void updatePreferences({ ...preferences, autoScan: enabled })}
            signalAlerts={preferences.signalAlerts}
            alertThreshold={preferences.alertThreshold}
            onSignalAlerts={(enabled) => void toggleSignalAlerts(enabled)}
            onAlertThreshold={(threshold) => void updatePreferences({ ...preferences, alertThreshold: threshold })}
          />
        </main>
      </div>
      {ticketSignal ? <TradeTicket signal={ticketSignal} portfolio={portfolio} submitting={submitting} onClose={() => setTicketSignal(undefined)} onSubmit={submitPaperTrade} /> : null}
      {accountOpen ? <AccountDialog onClose={() => setAccountOpen(false)} /> : null}
      {installOpen ? <InstallDialog canInstall={installApp.canInstall} installed={installApp.installed} onInstall={installApp.install} onClose={() => setInstallOpen(false)} /> : null}
    </div>
  );
}

export default App;

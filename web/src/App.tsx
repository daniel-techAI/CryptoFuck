import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { AccountDialog } from "./components/AccountDialog";
import { AccountTab } from "./components/AccountTab";
import { AppHeader, type AppTab } from "./components/AppHeader";
import { BacktestTab } from "./components/BacktestTab";
import { DecisionTab } from "./components/DecisionTab";
import { InstallDialog } from "./components/InstallDialog";
import { OverviewTab } from "./components/OverviewTab";
import { TradingSimulator } from "./components/TradingSimulator";
import { useBinanceMarket } from "./hooks/useBinanceMarket";
import { useFuturesMarketContext } from "./hooks/useFuturesMarketContext";
import { useInstallApp } from "./hooks/useInstallApp";
import { useMarketMicrostructure } from "./hooks/useMarketMicrostructure";
import { useMarketSentiment } from "./hooks/useMarketSentiment";
import { useMarketTape } from "./hooks/useMarketTape";
import { useTimeframeContext } from "./hooks/useTimeframeContext";
import { loadPaperOrders, loadPortfolio, placePaperOrder, setKillSwitch } from "./lib/api";
import {
  baseAssetFromSymbol,
  BINANCE_FUTURES_QUOTES,
  BINANCE_QUOTE_ASSETS,
  createBinanceSymbol,
  quoteAssetFromSymbol,
  type BinanceBaseAsset,
  type BinanceFuturesQuoteAsset,
  type BinanceQuoteAsset,
  type BinanceSymbol,
} from "./lib/binance";
import { applyTimeframeContext, buildForecast } from "./lib/forecast";
import type { BinanceInterval, PaperOrder, PaperOrderRequest, PortfolioSummary } from "./types";

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

const validTabs = new Set<AppTab>(["overview", "spot", "futures", "decision", "backtest", "account"]);

function initialTab(): AppTab {
  const hash = window.location.hash.slice(1) as AppTab;
  return validTabs.has(hash) ? hash : "overview";
}

function App() {
  const { user, profile, configured } = useAuth();
  const installApp = useInstallApp();
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [baseAsset, setBaseAsset] = useState<BinanceBaseAsset>("BTC");
  const [spotQuote, setSpotQuote] = useState<BinanceQuoteAsset>("EUR");
  const [futuresQuote, setFuturesQuote] = useState<BinanceFuturesQuoteAsset>("USDT");
  const [interval, setInterval] = useState<BinanceInterval>("15m");
  const [portfolio, setPortfolio] = useState<PortfolioSummary>(emptyPortfolio);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string }>();
  const marketVenue = activeTab === "futures" ? "futures" : "spot";
  const quoteAsset = marketVenue === "futures" ? futuresQuote : spotQuote;
  const quoteOptions = marketVenue === "futures" ? BINANCE_FUTURES_QUOTES : BINANCE_QUOTE_ASSETS;
  const symbol = createBinanceSymbol(baseAsset, quoteAsset);
  const market = useBinanceMarket(symbol, interval, marketVenue);
  const needsMicrostructure = activeTab === "spot" || activeTab === "futures" || activeTab === "decision";
  const microstructure = useMarketMicrostructure(symbol, needsMicrostructure, marketVenue);
  const futures = useFuturesMarketContext(symbol, marketVenue === "futures");
  const { sentiment, error: sentimentError } = useMarketSentiment();
  const tape = useMarketTape(spotQuote, activeTab === "overview");
  const timeframeContext = useTimeframeContext(symbol, marketVenue);
  const forecast = useMemo(() => applyTimeframeContext(buildForecast(market.candles), timeframeContext), [market.candles, timeframeContext]);
  const ageSeconds = market.lastUpdate ? Math.max(0, Math.floor((clock - market.lastUpdate) / 1_000)) : 99;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([loadPortfolio(), loadPaperOrders()])
      .then(([nextPortfolio, nextOrders]) => {
        if (!active) return;
        setPortfolio(nextPortfolio);
        setOrders(nextOrders);
      })
      .catch((error: unknown) => {
        if (active) setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not load the paper account." });
      });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    const onHashChange = () => setActiveTab(initialTab());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const changeTab = (tab: AppTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${tab}`);
  };

  const changeQuoteAsset = (quote: BinanceQuoteAsset) => {
    if (marketVenue === "futures") {
      if (BINANCE_FUTURES_QUOTES.includes(quote as BinanceFuturesQuoteAsset)) setFuturesQuote(quote as BinanceFuturesQuoteAsset);
      return;
    }
    setSpotQuote(quote);
  };

  const changeSpotSymbol = (nextSymbol: BinanceSymbol) => {
    setBaseAsset(baseAssetFromSymbol(nextSymbol));
    setSpotQuote(quoteAssetFromSymbol(nextSymbol));
  };

  const submitPaperTrade = async (request: PaperOrderRequest) => {
    setSubmitting(true);
    try {
      await placePaperOrder(request);
      const [nextPortfolio, nextOrders] = await Promise.all([loadPortfolio(), loadPaperOrders()]);
      setPortfolio(nextPortfolio);
      setOrders(nextOrders);
      setNotice({ kind: "success", message: `${request.pair} paper order added. No exchange order was sent.` });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleKillSwitch = async (enabled: boolean) => {
    const next = await setKillSwitch(enabled);
    setPortfolio(next);
    setNotice({ kind: "success", message: enabled ? "Paper-order kill switch engaged." : "Paper-order kill switch released." });
  };

  const openInstall = async () => {
    if (installApp.canInstall) {
      const accepted = await installApp.install();
      if (accepted) setNotice({ kind: "success", message: "NOCTURNE installed. Updates arrive automatically." });
      return;
    }
    setInstallOpen(true);
  };

  const accountLabel = profile?.handle ? `@${profile.handle}` : profile?.displayName || (user ? "Profile" : "Sign in");

  return (
    <div className="live-app-shell">
      <AppHeader activeTab={activeTab} onTab={changeTab} baseAsset={baseAsset} quoteAsset={quoteAsset} quoteOptions={quoteOptions} onBaseAsset={setBaseAsset} onQuoteAsset={changeQuoteAsset} status={market.status} ageSeconds={ageSeconds} onInstall={() => void openInstall()} installed={installApp.installed} onAccount={() => setAccountOpen(true)} accountLabel={accountLabel} avatarUrl={profile?.avatarUrl} />
      {notice ? <div className={`global-notice ${notice.kind}`} role="status">{notice.kind === "success" ? <CheckCircle2 /> : <AlertCircle />}<span>{notice.message}</span><button onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div> : null}
      {activeTab === "overview" ? <OverviewTab symbol={symbol} onSymbol={changeSpotSymbol} interval={interval} onInterval={setInterval} candles={market.candles} ticker={market.ticker} tickers={tape} forecast={forecast} status={market.status} error={market.error} /> : null}
      {activeTab === "spot" ? <TradingSimulator mode="spot" symbol={symbol} ticker={market.ticker} candles={market.candles} interval={interval} onInterval={setInterval} forecast={forecast} microstructure={microstructure} futures={futures} portfolio={portfolio} orders={orders} submitting={submitting} onSubmit={submitPaperTrade} onKillSwitch={toggleKillSwitch} /> : null}
      {activeTab === "futures" ? <TradingSimulator mode="futures" symbol={symbol} ticker={market.ticker} candles={market.candles} interval={interval} onInterval={setInterval} forecast={forecast} microstructure={microstructure} futures={futures} portfolio={portfolio} orders={orders} submitting={submitting} onSubmit={submitPaperTrade} onKillSwitch={toggleKillSwitch} /> : null}
      {activeTab === "decision" ? <DecisionTab symbol={symbol} interval={interval} onInterval={setInterval} candles={market.candles} ticker={market.ticker} forecast={forecast} microstructure={microstructure} sentiment={sentiment} sentimentError={sentimentError} portfolio={portfolio} status={market.status} ageSeconds={ageSeconds} onKillSwitch={toggleKillSwitch} /> : null}
      {activeTab === "backtest" ? <BacktestTab symbol={symbol} interval={interval} candles={market.candles} forecast={forecast} /> : null}
      {activeTab === "account" ? <AccountTab user={user} profile={profile} configured={configured} installed={installApp.installed} onAccount={() => setAccountOpen(true)} onInstall={() => void openInstall()} /> : null}
      {accountOpen ? <AccountDialog onClose={() => setAccountOpen(false)} /> : null}
      {installOpen ? <InstallDialog canInstall={installApp.canInstall} installed={installApp.installed} onInstall={installApp.install} onClose={() => setInstallOpen(false)} /> : null}
    </div>
  );
}

export default App;

import { Check, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { BINANCE_INTERVALS, displaySymbol, quoteAssetFromSymbol, type BinanceSymbol } from "../lib/binance";
import { buildTradeDecision } from "../lib/decision";
import { formatCompactUsd, formatPercent, formatPrice, formatQuoteCurrency } from "../lib/format";
import type {
  BinanceInterval,
  Candle,
  FuturesMarketContext,
  LiveConnectionStatus,
  LiveTicker,
  MarketForecast,
  MarketMicrostructure,
  MarketSentiment,
  PortfolioSummary,
} from "../types";
import { LiveChart } from "./LiveChart";
import { MarketStatsBar } from "./MarketStatsBar";

interface DecisionTabProps {
  symbol: BinanceSymbol;
  interval: BinanceInterval;
  onInterval: (interval: BinanceInterval) => void;
  candles: Candle[];
  ticker: LiveTicker;
  forecast: MarketForecast | null;
  microstructure: MarketMicrostructure;
  sentiment: MarketSentiment | null;
  sentimentError: string;
  futures?: FuturesMarketContext;
  portfolio: PortfolioSummary;
  status: LiveConnectionStatus;
  ageSeconds: number;
  onKillSwitch: (enabled: boolean) => Promise<void>;
}

const SOURCE_LINKS = [
  { label: "Binance market data", kind: "OFFICIAL", href: "https://developers.binance.com/en/docs/products/spot" },
  { label: "Alternative.me sentiment", kind: "INDEX", href: "https://alternative.me/crypto/fear-and-greed-index/" },
  { label: "Binance Square", kind: "COMMUNITY · UNVERIFIED", href: "https://www.binance.com/en/square" },
  { label: "CoinDesk Markets", kind: "EDITORIAL", href: "https://www.coindesk.com/markets/" },
  { label: "SEC Crypto Newsroom", kind: "OFFICIAL", href: "https://www.sec.gov/about/crypto-task-force/crypto-newsroom" },
] as const;

const STEPS = [
  [1, "WAIT", "Await condition"],
  [2, "TRIGGER", "Confirm setup"],
  [3, "ENTER", "Execute entry"],
  [4, "MANAGE", "Manage risk"],
  [5, "EXIT", "Take profit / exit"],
] as const;

function decisionClass(action: string): string {
  if (action.includes("LONG") || action === "MANAGE") return "long";
  if (action.includes("SHORT") || action === "REDUCE" || action === "EXIT") return "short";
  return "wait";
}

function sourceTimestamp(timestamp: number): string {
  return timestamp ? new Date(timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "Unavailable";
}

export function DecisionTab(props: DecisionTabProps) {
  const [positionSide, setPositionSide] = useState<"NONE" | "LONG" | "SHORT">("NONE");
  const [copied, setCopied] = useState(false);
  const decision = useMemo(() => buildTradeDecision({
    forecast: props.forecast,
    ticker: props.ticker,
    interval: props.interval,
    status: props.status,
    ageSeconds: props.ageSeconds,
    microstructure: props.microstructure,
    portfolio: props.portfolio,
    positionSide,
  }), [props.forecast, props.ticker, props.interval, props.status, props.ageSeconds, props.microstructure, props.portfolio, positionSide]);
  const forecast = props.forecast;
  const quote = quoteAssetFromSymbol(props.symbol);
  const actionClass = decisionClass(decision.action);
  const spreadBps = props.ticker.bid && props.ticker.ask && props.ticker.price ? (props.ticker.ask - props.ticker.bid) / props.ticker.price * 10_000 : 0;

  const copyPlan = async () => {
    if (!forecast) return;
    const text = [
      `${displaySymbol(props.symbol)} · ${decision.action}`,
      decision.headline,
      `Entry condition: ${decision.entryCondition}`,
      `Entry: ${formatPrice(forecast.levels.entryLow)}–${formatPrice(forecast.levels.entryHigh)}`,
      `Invalidation: ${formatPrice(forecast.levels.invalidation)}`,
      `Targets: ${formatPrice(forecast.levels.target1)} / ${formatPrice(forecast.levels.target2)}`,
      "Decision support only — verify independently before risking capital.",
    ].join("\n");
    let copiedSuccessfully = false;
    try {
      await navigator.clipboard.writeText(text);
      copiedSuccessfully = true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      copiedSuccessfully = document.execCommand("copy");
      textarea.remove();
    }
    if (copiedSuccessfully) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    }
  };

  const facts = [
    `${displaySymbol(props.symbol)} trades at ${props.ticker.price ? formatPrice(props.ticker.price) : "-"} (${formatPercent(props.ticker.change24hPercent)} / 24h).`,
    `24h range ${formatPrice(props.ticker.low24h)}–${formatPrice(props.ticker.high24h)}; quote volume ${formatQuoteCurrency(props.ticker.quoteVolume24h, quote)}.`,
    `Spread ${spreadBps.toFixed(2)} bps; top-20 book imbalance ${props.microstructure.imbalancePercent >= 0 ? "+" : ""}${props.microstructure.imbalancePercent.toFixed(1)}% bid-side.`,
    props.futures?.markPrice ? `Perpetual mark ${formatPrice(props.futures.markPrice)}; latest funding ${(props.futures.fundingRate * 100).toFixed(4)}%.` : "Perpetual funding is not mixed into this Spot-market decision.",
    props.sentiment ? `Fear & Greed ${props.sentiment.value} — ${props.sentiment.classification}; context only, not used in the signal.` : `Fear & Greed unavailable${props.sentimentError ? `: ${props.sentimentError}` : "."}`,
  ];

  const evidenceRows = forecast ? [
    ...forecast.evidence.map((item) => ({ evidence: item.label, fact: item.value, impact: item.tone.toUpperCase(), source: `Binance · ${props.interval}`, updated: sourceTimestamp(forecast.evaluatedAt), tone: item.tone })),
    { evidence: "Order-book imbalance", fact: `${props.microstructure.imbalancePercent >= 0 ? "+" : ""}${props.microstructure.imbalancePercent.toFixed(1)}% bid-side`, impact: Math.abs(props.microstructure.imbalancePercent) < 12 ? "NEUTRAL" : props.microstructure.imbalancePercent > 0 ? "BULLISH" : "BEARISH", source: "Binance · L2", updated: sourceTimestamp(props.microstructure.lastUpdate), tone: props.microstructure.imbalancePercent > 12 ? "bullish" : props.microstructure.imbalancePercent < -12 ? "bearish" : "neutral" },
    { evidence: "Bid / ask spread", fact: `${spreadBps.toFixed(2)} bps`, impact: spreadBps <= 8 ? "HEALTHY" : "CAUTION", source: "Binance · book", updated: sourceTimestamp(props.ticker.eventTime), tone: spreadBps <= 8 ? "bullish" : "bearish" },
    { evidence: "15m / 1h context", fact: forecast.context.length ? forecast.context.map((item) => `${item.interval} ${item.direction}`).join(" / ") : "Loading", impact: forecast.contextConsensus, source: "Binance · klines", updated: sourceTimestamp(forecast.evaluatedAt), tone: forecast.contextConsensus === "ALIGNED" ? "bullish" : forecast.contextConsensus === "CONFLICT" ? "bearish" : "neutral" },
    { evidence: "Walk-forward validation", fact: `${forecast.validation.hitRatePercent.toFixed(1)}% direction · ${forecast.validation.profitableRatePercent.toFixed(1)}% after costs · n=${forecast.validation.sampleSize}`, impact: forecast.validation.hitRatePercent >= 50 ? "PASS" : "WEAK", source: "Local · closed candles", updated: sourceTimestamp(forecast.evaluatedAt), tone: forecast.validation.hitRatePercent >= 50 ? "bullish" : "bearish" },
    { evidence: "Market sentiment", fact: props.sentiment ? `${props.sentiment.value} — ${props.sentiment.classification}` : "Unavailable", impact: "CONTEXT ONLY", source: "Alternative.me", updated: sourceTimestamp(props.sentiment?.timestamp ?? 0), tone: "neutral" },
  ] : [];

  return (
    <main className="decision-page">
      <MarketStatsBar symbol={props.symbol} ticker={props.ticker} portfolio={props.portfolio} futures={props.futures} onKillSwitch={props.onKillSwitch} />
      <section className={`decision-action-bar ${actionClass}`}>
        <div className="decision-call"><span>Action</span><strong>{decision.action}</strong></div>
        <div className="decision-headline"><b>{decision.confidence} confidence</b><p>{decision.headline}</p></div>
        <label className="position-context">My position context<select value={positionSide} onChange={(event) => setPositionSide(event.target.value as typeof positionSide)}><option value="NONE">No synced position</option><option value="LONG">I am long</option><option value="SHORT">I am short</option></select></label>
        <div className="decision-steps">{STEPS.map(([number, label, helper]) => <div key={number} className={decision.currentStep === number ? "active" : ""}><b>{number}</b><span><strong>{label}</strong><small>{helper}</small></span></div>)}</div>
      </section>

      <div className="decision-main-grid">
        <section className="decision-chart-panel">
          <div className="decision-chart-tools"><div className="timeframe-tabs">{BINANCE_INTERVALS.map((item) => <button key={item} className={props.interval === item ? "active" : ""} onClick={() => props.onInterval(item)}>{item}</button>)}</div><span>EMA 20 · EMA 50 · Volume · live Binance candles</span></div>
          <div className="decision-chart-stage">{props.candles.length ? <LiveChart candles={props.candles} forecast={forecast} planMode /> : <div className="micro-loading">Loading live chart…</div>}</div>
        </section>

        <aside className="trade-plan-panel">
          <header><h2>Trade plan</h2><button type="button" onClick={() => void copyPlan()} disabled={!forecast}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy plan"}</button></header>
          <dl>
            <div><dt>Action</dt><dd className={actionClass}>{decision.action}</dd></div>
            <div><dt>Entry condition</dt><dd>{decision.entryCondition}</dd></div>
            <div><dt>Entry zone</dt><dd>{forecast ? `${formatPrice(forecast.levels.entryLow)} – ${formatPrice(forecast.levels.entryHigh)}` : "-"}</dd></div>
            <div><dt>Invalidation</dt><dd className="negative">{forecast ? formatPrice(forecast.levels.invalidation) : "-"}</dd></div>
            <div><dt>Target 1</dt><dd className="positive">{forecast ? formatPrice(forecast.levels.target1) : "-"}</dd></div>
            <div><dt>Target 2</dt><dd className="positive">{forecast ? formatPrice(forecast.levels.target2) : "-"}</dd></div>
            <div><dt>Stretch · not a maximum</dt><dd>{forecast ? formatPrice(forecast.direction === "BEARISH" ? forecast.levels.target2 - forecast.indicators.atr14 : forecast.levels.target2 + forecast.indicators.atr14) : "-"}</dd></div>
            <div><dt>Reward / risk after costs</dt><dd>{decision.riskRewardTarget1.toFixed(2)}R / {decision.riskRewardTarget2.toFixed(2)}R</dd></div>
            <div><dt>Suggested risk</dt><dd>{decision.suggestedRiskPercent.toFixed(2)}% of paper equity</dd></div>
            <div><dt>Position-size reference</dt><dd>{decision.suggestedPositionUsd ? formatCompactUsd(decision.suggestedPositionUsd) : "Blocked"}</dd></div>
          </dl>
          <button className={`decision-kill ${decision.autoBlocked || props.portfolio.killSwitch ? "blocked" : "ready"}`} type="button" onClick={() => void props.onKillSwitch(!props.portfolio.killSwitch)}><ShieldAlert /><span>Kill switch<strong>{props.portfolio.killSwitch ? "MANUAL — ALL OFF" : decision.autoBlocked ? "AUTO-BLOCKED" : "READY"}</strong></span></button>
          <section className="decision-reasons"><h3>Decision reasons</h3>{decision.reasons.map((reason) => <div key={reason.label}><span>{reason.label}</span><strong className={reason.tone}>{reason.value}</strong></div>)}</section>
        </aside>
      </div>

      <div className="decision-evidence-grid">
        <section className="evidence-ledger"><header><h2>Evidence ledger</h2><span>MARKET FACTS INFLUENCE: <b>OFF</b> · UNVALIDATED</span></header><div className="evidence-table"><div className="evidence-row head"><span>Evidence</span><span>Current fact</span><span>Impact</span><span>Source</span><span>Updated</span></div>{evidenceRows.map((row) => <div className="evidence-row" key={row.evidence}><strong>{row.evidence}</strong><span>{row.fact}</span><b className={row.tone}>{row.impact}</b><span>{row.source}</span><time>{row.updated}</time></div>)}</div></section>
        <aside className="market-facts-panel"><header><h2>Market facts &amp; sources</h2><span>TIME-STAMPED CONTEXT</span></header><div className="fact-messages">{facts.map((fact) => <p key={fact}>{fact}</p>)}</div><nav aria-label="External market sources">{SOURCE_LINKS.map((source) => <a key={source.label} href={source.href} target="_blank" rel="noreferrer"><span>{source.label}<small>{source.kind}</small></span><ExternalLink /></a>)}</nav><p className="facts-warning">Community posts and editorial coverage can be wrong, delayed or manipulated. They are not included in the directional score.</p></aside>
      </div>
    </main>
  );
}

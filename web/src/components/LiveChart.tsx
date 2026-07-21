import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { ema } from "../lib/forecast";
import type { Candle, MarketForecast } from "../types";

interface ChartRefs {
  chart: IChartApi;
  candles: ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram">;
  ema20: ISeriesApi<"Line">;
  ema50: ISeriesApi<"Line">;
  lines: IPriceLine[];
}

const chartColors = {
  background: "#08151d",
  text: "#8d9fa4",
  grid: "rgba(49, 73, 82, .42)",
  border: "#203842",
  crosshair: "#70858b",
  crosshairLabel: "#14252d",
  bullish: "#8fd5ac",
  bearish: "#ed7a74",
  cyan: "#70c5ca",
  warning: "#d5b36a",
} as const;

function chartTime(timestamp: number): UTCTimestamp {
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

export function LiveChart({ candles, forecast, planMode = false }: { candles: Candle[]; forecast: MarketForecast | null; planMode?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const chartRefs = useRef<ChartRefs | null>(null);
  const data = useMemo(() => {
    const visible = candles.slice(-220);
    const closes = visible.map((candle) => candle.close);
    const ema20Values = ema(closes, 20);
    const ema50Values = ema(closes, 50);
    return {
      candles: visible.map((candle): CandlestickData => ({ time: chartTime(candle.timestamp), open: candle.open, high: candle.high, low: candle.low, close: candle.close })),
      volume: visible.map((candle): HistogramData => ({ time: chartTime(candle.timestamp), value: candle.volume, color: candle.close >= candle.open ? "rgba(143, 213, 172, .34)" : "rgba(237, 122, 116, .34)" })),
      ema20: visible.map((candle, index): LineData => ({ time: chartTime(candle.timestamp), value: ema20Values[index] })),
      ema50: visible.map((candle, index): LineData => ({ time: chartTime(candle.timestamp), value: ema50Values[index] })),
    };
  }, [candles]);

  useEffect(() => {
    if (!container.current) return undefined;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: chartColors.background }, textColor: chartColors.text, fontFamily: "IBM Plex Mono", fontSize: 11 },
      grid: { vertLines: { color: chartColors.grid }, horzLines: { color: chartColors.grid } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: chartColors.crosshair, style: LineStyle.Dashed, labelBackgroundColor: chartColors.crosshairLabel }, horzLine: { color: chartColors.crosshair, style: LineStyle.Dashed, labelBackgroundColor: chartColors.crosshairLabel } },
      rightPriceScale: { borderColor: chartColors.border, scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: chartColors.border, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 7, minBarSpacing: 2 },
      localization: { locale: "en-US" },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: chartColors.bullish, downColor: chartColors.bearish, borderUpColor: chartColors.bullish, borderDownColor: chartColors.bearish, wickUpColor: chartColors.bullish, wickDownColor: chartColors.bearish, priceLineColor: chartColors.bullish,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume", lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const ema20Series = chart.addSeries(LineSeries, { color: chartColors.cyan, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ema50Series = chart.addSeries(LineSeries, { color: chartColors.warning, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    chartRefs.current = { chart, candles: candleSeries, volume: volumeSeries, ema20: ema20Series, ema50: ema50Series, lines: [] };
    return () => {
      chart.remove();
      chartRefs.current = null;
    };
  }, []);

  useEffect(() => {
    const refs = chartRefs.current;
    if (!refs || !data.candles.length) return;
    refs.candles.setData(data.candles);
    refs.volume.setData(data.volume);
    refs.ema20.setData(data.ema20);
    refs.ema50.setData(data.ema50);
    if (!refs.chart.timeScale().getVisibleLogicalRange()) refs.chart.timeScale().fitContent();
  }, [data]);

  useEffect(() => {
    const refs = chartRefs.current;
    if (!refs) return;
    refs.lines.forEach((line) => refs.candles.removePriceLine(line));
    refs.lines = [];
    if (!forecast) return;
    const neutral = forecast.direction === "NEUTRAL";
    const coreLines = [
      refs.candles.createPriceLine({ price: forecast.levels.target1, color: "rgba(143, 213, 172, .78)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: neutral ? "UP" : "T1" }),
      refs.candles.createPriceLine({ price: forecast.levels.invalidation, color: "rgba(237, 122, 116, .84)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: neutral ? "DOWN" : "STOP" }),
    ];
    if (!planMode) {
      refs.lines = coreLines;
      return;
    }
    const side = forecast.direction === "BEARISH" ? -1 : 1;
    const entry = (forecast.levels.entryLow + forecast.levels.entryHigh) / 2;
    refs.lines = [
      ...coreLines,
      refs.candles.createPriceLine({ price: entry, color: "rgba(112, 197, 202, .88)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "ENTRY" }),
      refs.candles.createPriceLine({ price: forecast.levels.target2, color: "rgba(143, 213, 172, .84)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "T2" }),
      refs.candles.createPriceLine({ price: forecast.levels.target2 + side * forecast.indicators.atr14, color: "rgba(213, 179, 106, .8)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "STRETCH" }),
    ];
  }, [forecast, planMode]);

  return <div ref={container} className="live-chart-canvas" role="img" aria-label="Live Binance candlestick chart with volume and moving averages" />;
}

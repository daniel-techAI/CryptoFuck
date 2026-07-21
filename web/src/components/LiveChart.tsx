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

function chartTime(timestamp: number): UTCTimestamp {
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

export function LiveChart({ candles, forecast }: { candles: Candle[]; forecast: MarketForecast | null }) {
  const container = useRef<HTMLDivElement>(null);
  const chartRefs = useRef<ChartRefs | null>(null);
  const data = useMemo(() => {
    const visible = candles.slice(-220);
    const closes = visible.map((candle) => candle.close);
    const ema20Values = ema(closes, 20);
    const ema50Values = ema(closes, 50);
    return {
      candles: visible.map((candle): CandlestickData => ({ time: chartTime(candle.timestamp), open: candle.open, high: candle.high, low: candle.low, close: candle.close })),
      volume: visible.map((candle): HistogramData => ({ time: chartTime(candle.timestamp), value: candle.volume, color: candle.close >= candle.open ? "rgba(164, 231, 54, .34)" : "rgba(255, 88, 80, .34)" })),
      ema20: visible.map((candle, index): LineData => ({ time: chartTime(candle.timestamp), value: ema20Values[index] })),
      ema50: visible.map((candle, index): LineData => ({ time: chartTime(candle.timestamp), value: ema50Values[index] })),
    };
  }, [candles]);

  useEffect(() => {
    if (!container.current) return undefined;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#030b13" }, textColor: "#81909a", fontFamily: "IBM Plex Mono", fontSize: 11 },
      grid: { vertLines: { color: "rgba(35, 53, 66, .38)" }, horzLines: { color: "rgba(35, 53, 66, .38)" } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "#6d7d87", style: LineStyle.Dashed, labelBackgroundColor: "#1b2933" }, horzLine: { color: "#6d7d87", style: LineStyle.Dashed, labelBackgroundColor: "#1b2933" } },
      rightPriceScale: { borderColor: "#1d303e", scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: "#1d303e", timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 7, minBarSpacing: 2 },
      localization: { locale: "en-US" },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#a4e736", downColor: "#ff5850", borderUpColor: "#a4e736", borderDownColor: "#ff5850", wickUpColor: "#a4e736", wickDownColor: "#ff5850", priceLineColor: "#a4e736",
    });
    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume", lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const ema20Series = chart.addSeries(LineSeries, { color: "#45d7e6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ema50Series = chart.addSeries(LineSeries, { color: "#f0b925", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
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
    refs.lines = [
      refs.candles.createPriceLine({ price: forecast.levels.target1, color: "rgba(164, 231, 54, .72)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: neutral ? "UP" : "T1" }),
      refs.candles.createPriceLine({ price: forecast.levels.invalidation, color: "rgba(255, 88, 80, .82)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: neutral ? "DOWN" : "STOP" }),
    ];
  }, [forecast]);

  return <div ref={container} className="live-chart-canvas" role="img" aria-label="Live Binance candlestick chart with volume and moving averages" />;
}

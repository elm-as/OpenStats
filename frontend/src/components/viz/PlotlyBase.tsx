import React, { lazy, Suspense, useState, useMemo, useRef } from 'react';
import type { Layout, Config } from 'plotly.js';

import {
  DARK_TEMPLATE,
  LIGHT_TEMPLATE,
  DEFAULT_CONFIG,
  SCI_COLORS,
  PALETTES,
  COLORSCALE_VIRIDIS,
  COLORSCALE_RDBU,
  customizePlotTraces,
  customizePlotLayout,
  useCurrentTheme,
} from './plotlyTheme';
import {
  getLinearRegression,
  exportChartDataToCsv,
  exportChartSpecToJson,
} from './chartAnalyticsExport';

import { PlotlyToolbar } from './PlotlyToolbar';
import { PlotlySettingsPanel } from './PlotlySettingsPanel';

// Re-exports pour rétrocompatibilité totale
export {
  DARK_TEMPLATE,
  LIGHT_TEMPLATE,
  DEFAULT_CONFIG,
  SCI_COLORS,
  PALETTES,
  COLORSCALE_VIRIDIS,
  COLORSCALE_RDBU,
  useCurrentTheme,
};

// PlotlyChart (lazy-load pour ne pas tirer 4.6 MB de Plotly au dashboard)
const HeavyPlotlyChart = lazy(() => import('./PlotlyHeavy'));

export interface PlotlyChartProps {
  data: any[];
  layout?: Partial<Layout>;
  config?: Partial<Config>;
  height?: number | string;
  className?: string;
}

export function PlotlySkeleton({
  height = 400,
  className = '',
}: {
  height?: number | string;
  className?: string;
}) {
  return (
    <div
      className={`w-full rounded-[var(--ui-radius)] flex items-center justify-center ${className}`}
      style={{ height, background: 'var(--ui-bg-sunken)', border: '1px solid var(--ui-border)' }}
    >
      <div className="flex flex-col items-center gap-2 ui-t-muted">
        <div
          className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--ui-border-strong)', borderTopColor: 'var(--ui-accent)' }}
        />
        <span className="text-[10px] uppercase tracking-widest font-bold">Chargement…</span>
      </div>
    </div>
  );
}

function appendTrendlineTrace(traces: any[], data: any[]): any[] {
  const targetTrace = data.find(t => Array.isArray(t.x) && Array.isArray(t.y));
  if (!targetTrace) return traces;
  const reg = getLinearRegression(targetTrace.x as number[], targetTrace.y as number[]);
  if (!reg) return traces;
  return [
    ...traces,
    {
      x: [reg.minX, reg.maxX],
      y: [reg.slope * reg.minX + reg.intercept, reg.slope * reg.maxX + reg.intercept],
      type: 'scatter',
      mode: 'lines',
      name: 'Tendance linéaire',
      line: { color: '#ef4444', width: 2, dash: 'dash' },
      hovertemplate: `y = ${reg.slope.toFixed(3)}x + ${reg.intercept.toFixed(3)}<extra></extra>`,
    },
  ];
}

function readSavedChartPrefs(): Record<string, any> {
  try {
    const item = localStorage.getItem('openstats_chart_prefs');
    return item ? JSON.parse(item) : {};
  } catch {
    return {};
  }
}

function writeSavedChartPref(key: string, val: any): void {
  try {
    const curr = JSON.parse(localStorage.getItem('openstats_chart_prefs') || '{}');
    curr[key] = val;
    localStorage.setItem('openstats_chart_prefs', JSON.stringify(curr));
  } catch {
    // noop
  }
}

/** Wrapper Plotly avec thème Dark/Light dynamique, lazy-load, personnalisation et exports HD. */
export function PlotlyChart({
  data,
  layout = {},
  config = {},
  height = 400,
  className = '',
}: PlotlyChartProps) {
  const theme = useCurrentTheme();
  const savedPrefs = useMemo(readSavedChartPrefs, []);

  const [showSettings, setShowSettings] = useState(false);
  const [palette, setPalette] = useState<string>(() => savedPrefs.palette || 'default');
  const [showGrid, setShowGrid] = useState<boolean>(() => savedPrefs.showGrid ?? true);
  const [legendPos, setLegendPos] = useState<'right' | 'bottom' | 'none'>(() => savedPrefs.legendPos || 'bottom');
  const [pointSize, setPointSize] = useState<number>(() => savedPrefs.pointSize ?? 6);
  const [lineWidth, setLineWidth] = useState<number>(() => savedPrefs.lineWidth ?? 2);
  const [opacity, setOpacity] = useState<number>(() => savedPrefs.opacity ?? 0.85);
  const [trendline, setTrendline] = useState<boolean>(() => savedPrefs.trendline ?? false);
  const [showLabels, setShowLabels] = useState<boolean>(() => savedPrefs.showLabels ?? false);
  const [userTouchedStyle, setUserTouchedStyle] = useState(false);
  const graphDivRef = useRef<any>(null);

  const handleSetPalette = (p: string) => { setPalette(p); writeSavedChartPref('palette', p); setUserTouchedStyle(true); };
  const handleSetShowGrid = (g: boolean) => { setShowGrid(g); writeSavedChartPref('showGrid', g); };
  const handleSetLegendPos = (pos: 'right' | 'bottom' | 'none') => { setLegendPos(pos); writeSavedChartPref('legendPos', pos); setUserTouchedStyle(true); };
  const handleSetPointSize = (s: number) => { setPointSize(s); writeSavedChartPref('pointSize', s); setUserTouchedStyle(true); };
  const handleSetLineWidth = (w: number) => { setLineWidth(w); writeSavedChartPref('lineWidth', w); setUserTouchedStyle(true); };
  const handleSetOpacity = (o: number) => { setOpacity(o); writeSavedChartPref('opacity', o); setUserTouchedStyle(true); };
  const handleSetTrendline = (t: boolean) => { setTrendline(t); writeSavedChartPref('trendline', t); };
  const handleSetShowLabels = (l: boolean) => { setShowLabels(l); writeSavedChartPref('showLabels', l); };

  const handleExportImage = async (format: 'png' | 'svg') => {
    if (!graphDivRef.current) return;
    const { exportPlotlyFigure } = await import('./PlotlyHeavy');
    await exportPlotlyFigure({ graphDiv: graphDivRef.current, format, chartTitle, theme });
  };

  const handleResetDefaults = () => {
    setPalette('default');
    setShowGrid(true);
    setLegendPos('bottom');
    setPointSize(6);
    setLineWidth(2);
    setOpacity(0.85);
    setTrendline(false);
    setShowLabels(false);
    setUserTouchedStyle(false);
    try {
      localStorage.removeItem('openstats_chart_prefs');
    } catch {
      // noop
    }
  };

  const detectedChartType = data?.[0]?.type || 'scatter';
  const chartTitle = (layout?.title as any)?.text || '';

  const isScatterNumeric = useMemo(() => {
    return data?.some(t => {
      const isTypeOk = t.type === 'scatter' || !t.type;
      const isModeOk = t.mode?.includes('markers') || !t.mode;
      const isDataOk = Array.isArray(t.x) && t.x.length > 1 && typeof t.x[0] === 'number';
      return isTypeOk && isModeOk && isDataOk;
    });
  }, [data]);

  const { customizedData, customizedLayout } = useMemo(() => {
    const opts = {
      data,
      layout,
      theme,
      palette,
      showGrid,
      legendPos,
      pointSize,
      lineWidth,
      opacity,
      showLabels,
      userTouchedStyle,
      colors: PALETTES[palette]?.colors || SCI_COLORS,
      template: theme === 'light' ? LIGHT_TEMPLATE : DARK_TEMPLATE,
    };
    const finalData = customizePlotTraces(opts);
    const traces = trendline && isScatterNumeric ? appendTrendlineTrace(finalData, data) : finalData;
    return {
      customizedData: traces,
      customizedLayout: customizePlotLayout(opts),
    };
  }, [
    data, layout, palette, showGrid, legendPos, pointSize,
    lineWidth, opacity, trendline, isScatterNumeric, showLabels,
    userTouchedStyle, theme,
  ]);

  return (
    <div
      className="w-full rounded-[var(--ui-radius)] p-3 flex flex-col gap-2.5 relative transition-colors"
      style={{ background: 'var(--ui-bg-panel)', border: '1px solid var(--ui-border)' }}
    >
      <PlotlyToolbar
        chartTitle={chartTitle}
        settingsState={{ open: showSettings, onToggle: () => setShowSettings(s => !s) }}
        exportHandlers={{
          onPng: () => { void handleExportImage('png'); },
          onSvg: () => { void handleExportImage('svg'); },
          onCsv: () => exportChartDataToCsv(data, chartTitle),
          onJson: () => exportChartSpecToJson({ data, layout, config, chartTitle }),
        }}
      />

      {showSettings && (
        <PlotlySettingsPanel
          values={{ palette, showGrid, legendPos, showLabels, pointSize, lineWidth, opacity, trendline }}
          actions={{
            setPalette: handleSetPalette,
            setShowGrid: handleSetShowGrid,
            setLegendPos: handleSetLegendPos,
            setShowLabels: handleSetShowLabels,
            setPointSize: handleSetPointSize,
            setLineWidth: handleSetLineWidth,
            setOpacity: handleSetOpacity,
            setTrendline: handleSetTrendline,
            onResetDefaults: handleResetDefaults,
          }}
          meta={{ detectedChartType, isScatterNumeric }}
        />
      )}

      <Suspense fallback={<PlotlySkeleton height={height} className={className} />}>
        <HeavyPlotlyChart
          data={customizedData}
          layout={customizedLayout}
          config={config}
          height={height}
          className={className}
          onGraphDiv={gd => { graphDivRef.current = gd; }}
        />
      </Suspense>
    </div>
  );
}

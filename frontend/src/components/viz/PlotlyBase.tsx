import React, { lazy, Suspense, useState, useMemo, useRef } from 'react';
import type { Layout, Config } from 'plotly.js';
import { Info } from 'lucide-react';

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
  getChartInterpretation,
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

/** Wrapper Plotly avec thème Dark/Light dynamique, lazy-load, personnalisation et exports HD. */
export function PlotlyChart({
  data,
  layout = {},
  config = {},
  height = 400,
  className = '',
}: PlotlyChartProps) {
  const theme = useCurrentTheme();

  // États de personnalisation locale avec chargement depuis localStorage
  const savedPrefs = useMemo(() => {
    try {
      const item = localStorage.getItem('openstats_chart_prefs');
      return item ? JSON.parse(item) : {};
    } catch {
      return {};
    }
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [showInterpretation, setShowInterpretation] = useState(false);
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

  const savePref = (key: string, val: any) => {
    try {
      const curr = JSON.parse(localStorage.getItem('openstats_chart_prefs') || '{}');
      curr[key] = val;
      localStorage.setItem('openstats_chart_prefs', JSON.stringify(curr));
    } catch {
      // noop
    }
  };

  // Sauvegarde des préférences lors des modifications
  const handleSetPalette = (p: string) => { setPalette(p); savePref('palette', p); setUserTouchedStyle(true); };
  const handleSetShowGrid = (g: boolean) => { setShowGrid(g); savePref('showGrid', g); };
  const handleSetLegendPos = (pos: 'right' | 'bottom' | 'none') => { setLegendPos(pos); savePref('legendPos', pos); setUserTouchedStyle(true); };
  const handleSetPointSize = (s: number) => { setPointSize(s); savePref('pointSize', s); setUserTouchedStyle(true); };
  const handleSetLineWidth = (w: number) => { setLineWidth(w); savePref('lineWidth', w); setUserTouchedStyle(true); };
  const handleSetOpacity = (o: number) => { setOpacity(o); savePref('opacity', o); setUserTouchedStyle(true); };
  const handleSetTrendline = (t: boolean) => { setTrendline(t); savePref('trendline', t); };
  const handleSetShowLabels = (l: boolean) => { setShowLabels(l); savePref('showLabels', l); };

  const handleExportImage = async (format: 'png' | 'svg') => {
    if (!graphDivRef.current) return;
    const { exportPlotlyFigure } = await import('./PlotlyHeavy');
    await exportPlotlyFigure(graphDivRef.current, format, chartTitle, theme);
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

  // Type générique du graphique d'après la première trace
  const detectedChartType = data?.[0]?.type || 'scatter';
  const chartTitle = (layout?.title as any)?.text || '';

  // Vérifier si le trendline est applicable (Scatter numérique uniquement)
  const isScatterNumeric = useMemo(() => {
    return data?.some(t => {
      const isTypeOk = t.type === 'scatter' || !t.type;
      const isModeOk = t.mode?.includes('markers') || !t.mode;
      const isDataOk = Array.isArray(t.x) && t.x.length > 1 && typeof t.x[0] === 'number';
      return isTypeOk && isModeOk && isDataOk;
    });
  }, [data]);

  // Appliquer les surcharges dynamiques sur les données et la mise en page
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
    };
    const finalData = customizePlotTraces(opts);

    if (trendline && isScatterNumeric) {
      const targetTrace = data.find(t => Array.isArray(t.x) && Array.isArray(t.y));
      if (targetTrace) {
        const reg = getLinearRegression(targetTrace.x as number[], targetTrace.y as number[]);
        if (reg) {
          finalData.push({
            x: [reg.minX, reg.maxX],
            y: [reg.slope * reg.minX + reg.intercept, reg.slope * reg.maxX + reg.intercept],
            type: 'scatter',
            mode: 'lines',
            name: 'Tendance linéaire',
            line: { color: '#ef4444', width: 2, dash: 'dash' },
            hovertemplate: `y = ${reg.slope.toFixed(3)}x + ${reg.intercept.toFixed(3)}<extra></extra>`,
          } as any);
        }
      }
    }

    return {
      customizedData: finalData,
      customizedLayout: customizePlotLayout(opts),
    };
  }, [
    data,
    layout,
    palette,
    showGrid,
    legendPos,
    pointSize,
    lineWidth,
    opacity,
    trendline,
    isScatterNumeric,
    showLabels,
    userTouchedStyle,
    theme,
  ]);

  return (
    <div
      className="w-full rounded-[var(--ui-radius)] p-3 flex flex-col gap-2.5 relative transition-colors"
      style={{ background: 'var(--ui-bg-panel)', border: '1px solid var(--ui-border)' }}
    >
      <PlotlyToolbar
        chartTitle={chartTitle}
        showSettings={showSettings}
        showInterpretation={showInterpretation}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onToggleInterpretation={() => setShowInterpretation(!showInterpretation)}
        onExportPng={() => { void handleExportImage('png'); }}
        onExportSvg={() => { void handleExportImage('svg'); }}
        onExportCsv={() => exportChartDataToCsv(data, chartTitle)}
        onExportJson={() => exportChartSpecToJson(data, layout, config, chartTitle)}
      />

      {showSettings && (
        <PlotlySettingsPanel
          palette={palette}
          setPalette={handleSetPalette}
          showGrid={showGrid}
          setShowGrid={handleSetShowGrid}
          legendPos={legendPos}
          setLegendPos={handleSetLegendPos}
          showLabels={showLabels}
          setShowLabels={handleSetShowLabels}
          pointSize={pointSize}
          setPointSize={handleSetPointSize}
          lineWidth={lineWidth}
          setLineWidth={handleSetLineWidth}
          opacity={opacity}
          setOpacity={handleSetOpacity}
          trendline={trendline}
          setTrendline={handleSetTrendline}
          onResetDefaults={handleResetDefaults}
          detectedChartType={detectedChartType}
          isScatterNumeric={isScatterNumeric}
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

      {showInterpretation && (
        <div
          className="rounded-[var(--ui-radius)] p-3 flex gap-2.5 animate-fadeIn"
          style={{ background: 'var(--ui-accent-soft)', border: '1px solid var(--ui-border-strong)' }}
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ui-accent)' }} />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--ui-accent-text)' }}>
              Comprendre la visualisation
            </span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
              {getChartInterpretation(detectedChartType, chartTitle, data)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

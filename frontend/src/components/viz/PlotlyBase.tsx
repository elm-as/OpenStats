import React, { lazy, Suspense, useState, useMemo } from 'react';
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
      className={`w-full rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center ${className}`}
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-surface-500">
        <div className="w-5 h-5 border-2 border-surface-600 border-t-accent-400 rounded-full animate-spin" />
        <span className="text-[10px] uppercase tracking-widest font-bold">Chargement…</span>
      </div>
    </div>
  );
}

/** Wrapper Plotly avec thème dark uniforme + lazy-load + personnalisation premium + exports. */
export function PlotlyChart({
  data,
  layout = {},
  config = {},
  height = 400,
  className = '',
}: PlotlyChartProps) {
  const theme = useCurrentTheme();
  const activeTemplate = theme === 'light' ? LIGHT_TEMPLATE : DARK_TEMPLATE;

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

  // Sauvegarde des préférences lors des modifications
  const handleSetPalette = (p: string) => { setPalette(p); savePref('palette', p); };
  const handleSetShowGrid = (g: boolean) => { setShowGrid(g); savePref('showGrid', g); };
  const handleSetLegendPos = (pos: 'right' | 'bottom' | 'none') => { setLegendPos(pos); savePref('legendPos', pos); };
  const handleSetPointSize = (s: number) => { setPointSize(s); savePref('pointSize', s); };
  const handleSetLineWidth = (w: number) => { setLineWidth(w); savePref('lineWidth', w); };
  const handleSetOpacity = (o: number) => { setOpacity(o); savePref('opacity', o); };
  const handleSetTrendline = (t: boolean) => { setTrendline(t); savePref('trendline', t); };
  const handleSetShowLabels = (l: boolean) => { setShowLabels(l); savePref('showLabels', l); };

  const savePref = (key: string, val: any) => {
    try {
      const curr = JSON.parse(localStorage.getItem('openstats_chart_prefs') || '{}');
      curr[key] = val;
      localStorage.setItem('openstats_chart_prefs', JSON.stringify(curr));
    } catch {
      // noop
    }
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
    const colors = PALETTES[palette]?.colors || SCI_COLORS;
    const finalData = data.map((t, idx) => {
      const traceColor = colors[idx % colors.length];
      const copy = { ...t };

      // 1. Couleurs selon le type
      if (copy.type === 'pie') {
        copy.marker = { ...copy.marker, colors };
      } else if (copy.type === 'heatmap') {
        // Laisser les colormaps configurés par défaut
      } else {
        copy.marker = {
          ...copy.marker,
          color: copy.marker?.color || traceColor,
          opacity,
          size: pointSize,
        };
        copy.line = {
          ...copy.line,
          color: copy.line?.color || traceColor,
          width: lineWidth,
        };
      }

      // 2. Data Labels
      if (showLabels) {
        if (copy.type === 'bar') {
          copy.texttemplate = '%{y:.2f}';
          copy.textposition = 'auto';
        } else if (copy.type === 'scatter' || !copy.type) {
          copy.mode = 'markers+text' + (copy.mode?.includes('lines') ? '+lines' : '');
          copy.text = (copy.y as any[])?.map(v => (typeof v === 'number' ? v.toFixed(1) : ''));
          copy.textposition = 'top center';
        }
      }

      return copy;
    });

    // 3. Trendline automatique
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

    // 4. Alignement du Layout
    const finalLayout: Partial<Layout> = {
      ...activeTemplate,
      ...layout,
      xaxis: {
        ...activeTemplate.xaxis,
        ...layout.xaxis,
        showgrid: showGrid,
      },
      yaxis: {
        ...activeTemplate.yaxis,
        ...layout.yaxis,
        showgrid: showGrid,
      },
      showlegend: legendPos !== 'none',
      legend:
        legendPos === 'bottom'
          ? { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
          : legendPos === 'right'
          ? { orientation: 'v', x: 1.05, y: 1 }
          : undefined,
    };

    return { customizedData: finalData, customizedLayout: finalLayout };
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
    activeTemplate,
  ]);

  return (
    <div className="w-full rounded-xl bg-white/[0.01] border border-white/5 p-4 flex flex-col gap-3 relative transition-all duration-300 hover:border-white/10">
      <PlotlyToolbar
        chartTitle={chartTitle}
        showSettings={showSettings}
        showInterpretation={showInterpretation}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onToggleInterpretation={() => setShowInterpretation(!showInterpretation)}
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
        />
      </Suspense>

      {showInterpretation && (
        <div className="bg-gradient-to-r from-accent-500/5 to-cyan-500/5 border border-accent-500/20 rounded-xl p-3.5 flex gap-3 animate-fadeIn">
          <Info className="w-5 h-5 text-accent-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-accent-300 uppercase tracking-wide">
              Comprendre la visualisation
            </span>
            <p className="text-xs text-surface-300 leading-relaxed">
              {getChartInterpretation(detectedChartType, chartTitle, data)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

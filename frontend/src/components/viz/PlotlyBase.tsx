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

  // États de personnalisation locale
  const [showSettings, setShowSettings] = useState(false);
  const [showInterpretation, setShowInterpretation] = useState(false);
  const [palette, setPalette] = useState('default');
  const [showGrid, setShowGrid] = useState(true);
  const [legendPos, setLegendPos] = useState<'right' | 'bottom' | 'none'>('bottom');
  const [pointSize, setPointSize] = useState(6);
  const [lineWidth, setLineWidth] = useState(2);
  const [opacity, setOpacity] = useState(0.85);
  const [trendline, setTrendline] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

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
          setPalette={setPalette}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          legendPos={legendPos}
          setLegendPos={setLegendPos}
          showLabels={showLabels}
          setShowLabels={setShowLabels}
          pointSize={pointSize}
          setPointSize={setPointSize}
          lineWidth={lineWidth}
          setLineWidth={setLineWidth}
          opacity={opacity}
          setOpacity={setOpacity}
          trendline={trendline}
          setTrendline={setTrendline}
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

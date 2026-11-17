import ReactPlotly from 'react-plotly.js';
const Plot = (ReactPlotly as any).default || ReactPlotly;
import type { Layout, Config, Data } from 'plotly.js';
import { useMemo } from 'react';
import { DEFAULT_CONFIG } from './plotlyTheme';

interface Props {
  data: Data[];
  layout?: Partial<Layout>;
  config?: Partial<Config>;
  height?: number | string;
  className?: string;
  onGraphDiv?: (gd: any) => void;
}

export interface ExportPlotlyFigureOptions {
  graphDiv: any;
  format: 'png' | 'svg';
  chartTitle?: string;
  theme: 'dark' | 'light';
}

/** Exporte une figure Plotly existante en image haute définition avec fond lisible. */
export async function exportPlotlyFigure({
  graphDiv,
  format,
  chartTitle,
  theme,
}: ExportPlotlyFigureOptions): Promise<void> {
  if (!graphDiv) return;
  const mod = await import('plotly.js/dist/plotly');
  const PlotlyLib = (mod as any).default || mod;
  const filename = (chartTitle || 'openstats_graph')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const bg = theme === 'dark' ? '#0e1118' : '#ffffff';
  await PlotlyLib.relayout(graphDiv, { paper_bgcolor: bg, plot_bgcolor: bg });
  try {
    await PlotlyLib.downloadImage(graphDiv, {
      format,
      filename: filename || 'openstats_graph',
      width: 1200,
      height: 700,
      scale: format === 'png' ? 3 : 1,
    });
  } finally {
    await PlotlyLib.relayout(graphDiv, {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
    });
  }
}

/** Composant lourd (Plotly) lazy-loadé via PlotlyBase. */
export default function PlotlyHeavy({
  data,
  layout = {},
  config = {},
  height = 400,
  className = '',
  onGraphDiv,
}: Props) {
  const merged = useMemo<Partial<Layout>>(() => ({
    ...layout,
    autosize: true,
  }), [layout]);

  const mergedConfig = useMemo<Partial<Config>>(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <Plot
        data={data}
        layout={merged}
        config={mergedConfig}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
        onInitialized={(_fig: any, gd: any) => onGraphDiv?.(gd)}
        onUpdate={(_fig: any, gd: any) => onGraphDiv?.(gd)}
      />
    </div>
  );
}

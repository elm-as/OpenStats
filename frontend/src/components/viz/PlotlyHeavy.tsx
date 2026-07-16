import ReactPlotly from 'react-plotly.js';
const Plot = (ReactPlotly as any).default || ReactPlotly;
import type { Layout, Config, Data } from 'plotly.js';
import { useMemo } from 'react';
import { DARK_TEMPLATE, DEFAULT_CONFIG } from './PlotlyBase';

interface Props {
  data: Data[];
  layout?: Partial<Layout>;
  config?: Partial<Config>;
  height?: number | string;
  className?: string;
}

/** Composant lourd (Plotly) lazy-loadé via PlotlyBase. */
export default function PlotlyHeavy({ data, layout = {}, config = {}, height = 400, className = '' }: Props) {
  const merged = useMemo<Partial<Layout>>(() => ({
    ...DARK_TEMPLATE,
    ...layout,
    xaxis: { ...DARK_TEMPLATE.xaxis, ...(layout.xaxis || {}) },
    yaxis: { ...DARK_TEMPLATE.yaxis, ...(layout.yaxis || {}) },
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
      />
    </div>
  );
}

import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Coefficients d'autocorrélation par lag (lag 0 → N) */
  values: number[];
  /** Taille d'échantillon pour seuil de significativité */
  sampleSize?: number;
  /** Label du graphe : ACF ou PACF */
  type?: 'ACF' | 'PACF';
  height?: number;
  title?: string;
}

export default function ACFPlot({ values, sampleSize, type = 'ACF', height = 320, title }: Props) {
  const { traces, layout } = useMemo(() => {
    const lags = values.map((_, i) => i);

    // Seuil de signif ≈ ±1.96/√N (intervalle de confiance 95%)
    const ci = sampleSize ? 1.96 / Math.sqrt(sampleSize) : null;

    // Tiges (lignes verticales)
    const stems: Data[] = lags.map((lag, i) => ({
      x: [lag, lag],
      y: [0, values[i]],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#06b6d4', width: 2 },
      hoverinfo: 'skip',
      showlegend: false,
    }));

    // Points
    const dots: Data = {
      x: lags,
      y: values,
      type: 'scatter',
      mode: 'markers',
      marker: { color: '#22d3ee', size: 7, line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
      name: type,
      hovertemplate: 'Lag %{x}<br>' + type + ': %{y:.3f}<extra></extra>',
    };

    // Bandes de confiance
    const ciTraces: Data[] = [];
    const shapes: any[] = [];
    if (ci !== null) {
      shapes.push(
        { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: ci, y1: ci, line: { color: 'rgba(239,68,68,0.4)', width: 1, dash: 'dash' } },
        { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: -ci, y1: -ci, line: { color: 'rgba(239,68,68,0.4)', width: 1, dash: 'dash' } },
      );
    }

    const lay: Partial<Layout> = {
      title: { text: title || (type === 'ACF' ? "Autocorrélation (ACF)" : 'Autocorrélation partielle (PACF)'), font: { size: 14 } },
      xaxis: { title: { text: 'Lag' }, dtick: Math.max(1, Math.floor(values.length / 15)) },
      yaxis: { title: { text: type }, range: [-1.1, 1.1], zeroline: true },
      shapes,
      showlegend: false,
    };

    return { traces: [...stems, dots, ...ciTraces], layout: lay };
  }, [values, sampleSize, type, title]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

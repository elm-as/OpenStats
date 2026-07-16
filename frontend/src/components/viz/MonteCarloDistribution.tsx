import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  values: number[];
  /** Quantiles à afficher (en lignes verticales) */
  quantiles?: number[];
  /** Valeur de référence (baseline) */
  baseline?: number;
  height?: number;
  title?: string;
  xLabel?: string;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export default function MonteCarloDistribution({
  values,
  quantiles = [0.05, 0.5, 0.95],
  baseline,
  height = 400,
  title = 'Distribution Monte Carlo',
  xLabel = 'Valeur simulée',
}: Props) {
  const { traces, layout } = useMemo(() => {
    const sorted = [...values].sort((a, b) => a - b);
    const qVals = quantiles.map(q => ({ q, v: quantile(sorted, q) }));
    const mean = values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);

    const histo: Data = {
      x: values,
      type: 'histogram',
      nbinsx: 50,
      marker: {
        color: 'rgba(6, 182, 212, 0.7)',
        line: { color: '#22d3ee', width: 0.5 },
      },
      name: 'Distribution',
      hovertemplate: '<b>%{x}</b><br>n = %{y}<extra></extra>',
    } as Data;

    const shapes: any[] = [];
    const annotations: any[] = [];

    qVals.forEach(({ q, v }) => {
      shapes.push({
        type: 'line', xref: 'x', yref: 'paper',
        x0: v, x1: v, y0: 0, y1: 1,
        line: { color: '#fcd34d', width: 1.5, dash: 'dash' },
      });
      annotations.push({
        x: v, y: 1.02, xref: 'x', yref: 'paper',
        text: `Q${(q * 100).toFixed(0)}: ${v.toFixed(2)}`,
        showarrow: false,
        font: { size: 10, color: '#fcd34d' },
      });
    });

    if (baseline !== undefined) {
      shapes.push({
        type: 'line', xref: 'x', yref: 'paper',
        x0: baseline, x1: baseline, y0: 0, y1: 1,
        line: { color: '#f87171', width: 2 },
      });
      annotations.push({
        x: baseline, y: -0.05, xref: 'x', yref: 'paper',
        text: `Baseline: ${baseline.toFixed(2)}`,
        showarrow: false,
        font: { size: 10, color: '#f87171' },
      });
    }

    // Moyenne
    shapes.push({
      type: 'line', xref: 'x', yref: 'paper',
      x0: mean, x1: mean, y0: 0, y1: 1,
      line: { color: '#34d399', width: 1.5 },
    });
    annotations.push({
      x: mean, y: 1.08, xref: 'x', yref: 'paper',
      text: `Moy: ${mean.toFixed(2)}`,
      showarrow: false,
      font: { size: 10, color: '#34d399' },
    });

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: xLabel } },
      yaxis: { title: { text: 'Fréquence' } },
      shapes,
      annotations,
      showlegend: false,
    };

    return { traces: [histo], layout: lay };
  }, [values, quantiles, baseline, title, xLabel]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

import { useMemo } from 'react';
import { PlotlyChart, useCurrentTheme } from './PlotlyBase';
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
  const theme = useCurrentTheme();
  const isLight = theme === 'light';
  const qColor = isLight ? '#b45309' : '#fcd34d';
  const meanColor = isLight ? '#047857' : '#34d399';
  const baseColor = isLight ? '#dc2626' : '#f87171';
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
        line: { color: qColor, width: 1.5, dash: 'dash' },
      });
      annotations.push({
        x: v, y: 1.02, xref: 'x', yref: 'paper',
        text: `Q${(q * 100).toFixed(0)}: ${v.toFixed(2)}`,
        showarrow: false,
        font: { size: 10, color: qColor },
      });
    });

    if (baseline !== undefined) {
      shapes.push({
        type: 'line', xref: 'x', yref: 'paper',
        x0: baseline, x1: baseline, y0: 0, y1: 1,
        line: { color: baseColor, width: 2 },
      });
      annotations.push({
        x: baseline, y: -0.06, xref: 'x', yref: 'paper',
        text: `Baseline: ${baseline.toFixed(2)}`,
        showarrow: false,
        font: { size: 10, color: baseColor },
      });
    }

    // Moyenne
    shapes.push({
      type: 'line', xref: 'x', yref: 'paper',
      x0: mean, x1: mean, y0: 0, y1: 1,
      line: { color: meanColor, width: 1.5 },
    });
    annotations.push({
      x: mean, y: 1.08, xref: 'x', yref: 'paper',
      text: `Moy: ${mean.toFixed(2)}`,
      showarrow: false,
      font: { size: 10, color: meanColor },
    });

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: xLabel } },
      yaxis: { title: { text: 'Fréquence' } },
      margin: { l: 58, r: 24, t: 54, b: 56 },
      shapes,
      annotations,
      showlegend: false,
    };

    return { traces: [histo], layout: lay };
  }, [values, quantiles, baseline, title, xLabel, qColor, meanColor, baseColor]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Échantillon (résidus ou valeurs) */
  values: number[];
  /** Distribution théorique (par défaut Normale standard) */
  distribution?: 'normal';
  height?: number;
  title?: string;
}

/** Inverse de la CDF normale via approximation de Beasley-Springer-Moro */
function normalQuantile(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;

  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export default function QQPlot({ values, height = 400, title = 'Q-Q Plot (Normalité)' }: Props) {
  const { traces, layout } = useMemo(() => {
    const sorted = [...values].filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) return { traces: [], layout: {} };

    // Standardisation (z-score)
    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(n - 1, 1));
    const standardized = sorted.map(v => (v - mean) / (sd || 1));

    // Quantiles théoriques (plotting positions de Blom)
    const theoretical = Array.from({ length: n }, (_, i) =>
      normalQuantile((i + 0.5) / n)
    );

    const minQ = Math.min(theoretical[0], standardized[0]);
    const maxQ = Math.max(theoretical[n - 1], standardized[n - 1]);

    const pointsTrace: Data = {
      x: theoretical,
      y: standardized,
      mode: 'markers',
      type: 'scatter',
      marker: { size: 5, color: '#06b6d4', opacity: 0.7, line: { color: 'rgba(255,255,255,0.2)', width: 0.5 } },
      name: 'Échantillon',
      hovertemplate: 'Théorique: %{x:.3f}<br>Observé: %{y:.3f}<extra></extra>',
    };

    const lineTrace: Data = {
      x: [minQ, maxQ],
      y: [minQ, maxQ],
      mode: 'lines',
      type: 'scatter',
      line: { color: '#f59e0b', width: 2, dash: 'dash' },
      name: 'y = x (normalité parfaite)',
      hoverinfo: 'skip',
    };

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Quantiles théoriques (Normal)' } },
      yaxis: { title: { text: 'Quantiles observés (standardisés)' } },
      showlegend: true,
      legend: { x: 0.02, y: 0.98 },
    };

    return { traces: [pointsTrace, lineTrace], layout: lay };
  }, [values, title]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Valeurs prédites (axe X) */
  fitted: number[];
  /** Résidus (axe Y) */
  residuals: number[];
  height?: number;
  title?: string;
}

/** Residuals vs Fitted : détection d'hétéroscédasticité et de non-linéarité */
export default function ResidualsPlot({ fitted, residuals, height = 380, title = 'Résidus vs Valeurs prédites' }: Props) {
  const { traces, layout } = useMemo(() => {
    // LOWESS approximation simple : moyenne mobile sur bins de fitted
    const sorted = fitted
      .map((f, i) => ({ f, r: residuals[i] }))
      .sort((a, b) => a.f - b.f);
    const window = Math.max(5, Math.floor(sorted.length / 20));
    const smoothX: number[] = [];
    const smoothY: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const start = Math.max(0, i - window);
      const end = Math.min(sorted.length, i + window);
      const slice = sorted.slice(start, end);
      smoothX.push(sorted[i].f);
      smoothY.push(slice.reduce((s, p) => s + p.r, 0) / slice.length);
    }

    const points: Data = {
      x: fitted,
      y: residuals,
      mode: 'markers',
      type: 'scatter',
      marker: { size: 5, color: '#06b6d4', opacity: 0.5, line: { color: 'rgba(255,255,255,0.15)', width: 0.5 } },
      name: 'Résidus',
      hovertemplate: 'Prédit: %{x:.3f}<br>Résidu: %{y:.3f}<extra></extra>',
    };

    const smooth: Data = {
      x: smoothX,
      y: smoothY,
      mode: 'lines',
      type: 'scatter',
      line: { color: '#f59e0b', width: 2 },
      name: 'Tendance (LOWESS)',
      hoverinfo: 'skip',
    };

    const zero: Data = {
      x: [Math.min(...fitted), Math.max(...fitted)],
      y: [0, 0],
      mode: 'lines',
      type: 'scatter',
      line: { color: 'rgba(239,68,68,0.5)', width: 1, dash: 'dash' },
      showlegend: false,
      hoverinfo: 'skip',
    };

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Valeurs prédites' } },
      yaxis: { title: { text: 'Résidus' }, zeroline: true },
      showlegend: true,
      legend: { x: 0.02, y: 0.98 },
    };

    return { traces: [zero, points, smooth], layout: lay };
  }, [fitted, residuals, title]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

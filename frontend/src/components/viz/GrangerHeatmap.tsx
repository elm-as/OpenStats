import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Matrice de p-values { cause: { effect: pvalue } } */
  pvalues: Record<string, Record<string, number>>;
  alpha?: number;
  height?: number;
  title?: string;
}

export default function GrangerHeatmap({ pvalues, alpha = 0.05, height = 460, title = "Causalité de Granger (p-values)" }: Props) {
  const { trace, layout } = useMemo(() => {
    const causes = Object.keys(pvalues);
    const effects = Array.from(new Set(causes.flatMap(c => Object.keys(pvalues[c] || {}))));

    const z: (number | null)[][] = causes.map(c =>
      effects.map(e => (c === e ? null : pvalues[c]?.[e] ?? null))
    );

    const text: string[][] = z.map(row => row.map(v => (v === null ? '—' : v < 0.001 ? '< 0.001' : v.toFixed(3))));

    const tr: Data = {
      x: effects,
      y: causes,
      z,
      type: 'heatmap',
      colorscale: [
        [0, 'rgba(16, 185, 129, 0.9)'],   // p très bas = significatif
        [alpha, 'rgba(245, 158, 11, 0.7)'],
        [1, 'rgba(20, 28, 54, 0.4)'],
      ],
      zmin: 0,
      zmax: 1,
      hovertemplate: '<b>%{y} → %{x}</b><br>p-value: %{z:.4f}<extra></extra>',
      text,
      texttemplate: '%{text}',
      textfont: { size: 11, color: '#f1f5f9' },
      colorbar: {
        title: { text: 'p-value', font: { color: '#cbd5e1' } },
        tickfont: { color: '#94a3b8' },
        outlinecolor: 'rgba(255,255,255,0.1)',
        outlinewidth: 1,
      },
    } as unknown as Data;

    const lay: Partial<Layout> = {
      title: { text: title + ` (α=${alpha})`, font: { size: 14 } },
      xaxis: { title: { text: 'Effet (variable expliquée)' }, side: 'bottom' },
      yaxis: { title: { text: 'Cause (variable explicative)' }, autorange: 'reversed' },
      margin: { l: 100, r: 80, t: 50, b: 80 },
    };

    return { trace: tr, layout: lay };
  }, [pvalues, alpha, title]);

  return <PlotlyChart data={[trace]} layout={layout} height={height} />;
}

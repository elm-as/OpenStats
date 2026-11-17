import { useMemo } from 'react';
import { PlotlyChart, useCurrentTheme } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Matrice de p-values { cause: { effect: pvalue } } */
  pvalues: Record<string, Record<string, number>>;
  alpha?: number;
  height?: number;
  title?: string;
}

export default function GrangerHeatmap({ pvalues, alpha = 0.05, height = 460, title = "Causalité de Granger (p-values)" }: Props) {
  const theme = useCurrentTheme();
  const isLight = theme === 'light';
  const { trace, layout } = useMemo(() => {
    const causes = Object.keys(pvalues);
    const effects = Array.from(new Set(causes.flatMap(c => Object.keys(pvalues[c] || {}))));

    const z: (number | null)[][] = causes.map(c =>
      effects.map(e => (c === e ? null : pvalues[c]?.[e] ?? null))
    );

    const text: string[][] = z.map(row => row.map(v => (v === null ? '—' : v < 0.001 ? '< 0.001' : v.toFixed(3))));
    const fontColors = z.map(row =>
      row.map(v => {
        if (v === null) return isLight ? '#64748b' : '#94a3b8';
        if (v <= alpha * 1.5) return '#ffffff';
        return isLight ? '#0f172a' : '#e2e8f0';
      })
    );

    const tr: Data = {
      x: effects,
      y: causes,
      z,
      type: 'heatmap',
      colorscale: isLight
        ? [
            [0, 'rgba(4, 120, 87, 0.9)'],
            [alpha, 'rgba(180, 83, 9, 0.72)'],
            [1, 'rgba(226, 232, 240, 0.9)'],
          ]
        : [
            [0, 'rgba(16, 185, 129, 0.9)'],
            [alpha, 'rgba(245, 158, 11, 0.7)'],
            [1, 'rgba(30, 41, 59, 0.65)'],
          ],
      zmin: 0,
      zmax: 1,
      hovertemplate: '<b>%{y} → %{x}</b><br>p-value: %{z:.4f}<extra></extra>',
      text,
      texttemplate: '%{text}',
      textfont: { size: 11, color: fontColors as any },
      colorbar: {
        title: { text: 'p-value', font: { color: isLight ? '#0f172a' : '#cbd5e1' } },
        tickfont: { color: isLight ? '#475569' : '#94a3b8' },
        outlinecolor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)',
        outlinewidth: 1,
      },
    } as unknown as Data;

    const lay: Partial<Layout> = {
      title: { text: title + ` (α=${alpha})`, font: { size: 14 } },
      xaxis: {
        title: { text: 'Effet (variable expliquée)' },
        side: 'bottom',
        showgrid: false,
        automargin: true,
        tickangle: -35,
      },
      yaxis: {
        title: { text: 'Cause (variable explicative)' },
        autorange: 'reversed',
        showgrid: false,
        automargin: true,
      },
      margin: { l: 80, r: 80, t: 50, b: 80 },
    };

    return { trace: tr, layout: lay };
  }, [pvalues, alpha, title, isLight]);

  return <PlotlyChart data={[trace]} layout={layout} height={height} />;
}

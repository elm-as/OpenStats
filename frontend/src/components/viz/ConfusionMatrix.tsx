import { useMemo } from 'react';
import { PlotlyChart, useCurrentTheme } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  matrix: number[][];
  labels: string[];
  /** Si true, affiche en pourcentages (normalisés par ligne) */
  normalize?: boolean;
  height?: number;
  title?: string;
}

export default function ConfusionMatrix({
  matrix,
  labels,
  normalize = false,
  height = 420,
  title = 'Matrice de confusion',
}: Props) {
  const theme = useCurrentTheme();
  const isLight = theme === 'light';
  const { trace, layout } = useMemo(() => {
    const display = normalize
      ? matrix.map(row => {
          const sum = row.reduce((s, v) => s + v, 0) || 1;
          return row.map(v => v / sum);
        })
      : matrix;

    const text = display.map((row, i) =>
      row.map((v, j) => {
        if (normalize) return `${(v * 100).toFixed(1)}%`;
        return String(matrix[i][j]);
      })
    );

    const maxVal = Math.max(...display.flat().map(v => Number(v) || 0), 1e-9);
    const fontColors = display.map(row =>
      row.map(v => ((Number(v) / maxVal) > 0.45 ? '#ffffff' : (isLight ? '#0f172a' : '#e2e8f0')))
    );

    const tr: Data = {
      x: labels,
      y: labels,
      z: display,
      type: 'heatmap',
      colorscale: isLight
        ? [
            [0, 'rgba(14, 116, 144, 0.06)'],
            [0.5, 'rgba(14, 116, 144, 0.45)'],
            [1, 'rgba(14, 116, 144, 0.92)'],
          ]
        : [
            [0, 'rgba(6, 182, 212, 0.08)'],
            [0.5, 'rgba(6, 182, 212, 0.45)'],
            [1, 'rgba(6, 182, 212, 0.92)'],
          ],
      hovertemplate: '<b>Réel: %{y}</b><br>Prédit: %{x}<br>' + (normalize ? '%{z:.1%}' : '%{z}') + '<extra></extra>',
      text,
      texttemplate: '%{text}',
      textfont: { size: 13, color: fontColors as any },
      colorbar: {
        title: { text: normalize ? '%' : 'n', font: { color: isLight ? '#0f172a' : '#cbd5e1' } },
        tickfont: { color: isLight ? '#475569' : '#94a3b8' },
        outlinecolor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)',
        outlinewidth: 1,
      },
    } as unknown as Data;

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Prédit' }, side: 'bottom', showgrid: false },
      yaxis: { title: { text: 'Réel' }, autorange: 'reversed', showgrid: false },
      margin: { l: 80, r: 60, t: 50, b: 60 },
    };

    return { trace: tr, layout: lay };
  }, [matrix, labels, normalize, title, isLight]);

  return <PlotlyChart data={[trace]} layout={layout} height={height} />;
}

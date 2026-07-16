import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
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

    const tr: Data = {
      x: labels,
      y: labels,
      z: display,
      type: 'heatmap',
      colorscale: [
        [0, 'rgba(6, 182, 212, 0.05)'],
        [0.5, 'rgba(6, 182, 212, 0.4)'],
        [1, 'rgba(6, 182, 212, 0.95)'],
      ],
      hovertemplate: '<b>Réel: %{y}</b><br>Prédit: %{x}<br>' + (normalize ? '%{z:.1%}' : '%{z}') + '<extra></extra>',
      text,
      texttemplate: '%{text}',
      textfont: { size: 13, color: '#f1f5f9' },
      colorbar: {
        title: { text: normalize ? '%' : 'n', font: { color: '#cbd5e1' } },
        tickfont: { color: '#94a3b8' },
        outlinecolor: 'rgba(255,255,255,0.1)',
        outlinewidth: 1,
      },
    } as unknown as Data;

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Prédit' }, side: 'bottom' },
      yaxis: { title: { text: 'Réel' }, autorange: 'reversed' },
      margin: { l: 80, r: 60, t: 50, b: 60 },
    };

    return { trace: tr, layout: lay };
  }, [matrix, labels, normalize, title]);

  return <PlotlyChart data={[trace]} layout={layout} height={height} />;
}

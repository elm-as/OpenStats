import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Matrice de corrélation { row: { col: r } } */
  matrix: Record<string, Record<string, number>>;
  /** Réordonner par clustering hiérarchique (simple : par moyenne des corrélations) */
  cluster?: boolean;
  height?: number;
  title?: string;
  /** Si true, affiche les valeurs dans les cellules */
  showValues?: boolean;
}

function reorderByMeanCorrelation(matrix: Record<string, Record<string, number>>, cols: string[]): string[] {
  // Tri par somme des |r| (variables les plus corrélées au centre)
  const scores = cols.map(c => ({
    col: c,
    score: cols.reduce((s, c2) => s + (c === c2 ? 0 : Math.abs(matrix[c]?.[c2] ?? 0)), 0),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores.map(s => s.col);
}

export default function CorrelationHeatmap({
  matrix,
  cluster = true,
  height = 500,
  title = 'Matrice de corrélation',
  showValues = true,
}: Props) {
  const { trace, layout } = useMemo(() => {
    let cols = Object.keys(matrix);
    if (cluster && cols.length > 2) cols = reorderByMeanCorrelation(matrix, cols);

    const z: number[][] = cols.map(r => cols.map(c => matrix[r]?.[c] ?? null as any));
    const text: string[][] = z.map(row => row.map(v => (typeof v === 'number' ? v.toFixed(2) : '')));

    const tr: Data = {
      x: cols,
      y: cols,
      z,
      type: 'heatmap',
      colorscale: 'RdBu',
      reversescale: true,
      zmin: -1,
      zmax: 1,
      zmid: 0,
      hovertemplate: '<b>%{y} ↔ %{x}</b><br>r = %{z:.3f}<extra></extra>',
      colorbar: {
        title: { text: 'r', font: { color: '#c5ccdd' } },
        tickfont: { color: '#a3adc8' },
        outlinecolor: 'rgba(255,255,255,0.1)',
        outlinewidth: 1,
      },
      ...(showValues ? {
        text,
        texttemplate: '%{text}',
        textfont: { size: 10, color: '#0c0f1a' },
      } : {}),
    } as Data;

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { tickangle: -45, side: 'bottom', automargin: true },
      yaxis: { automargin: true },
      margin: { l: 100, r: 80, t: 50, b: 100 },
    };

    return { trace: tr, layout: lay };
  }, [matrix, cluster, title, showValues]);

  return <PlotlyChart data={[trace]} layout={layout} height={height} />;
}

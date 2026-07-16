import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  series: Array<{ name: string; values: number[]; color?: string }>;
  /** Remplit l'aire sous la courbe */
  fill?: boolean;
  /** Affiche aussi la distribution normale ajustée */
  showNormal?: boolean;
  height?: number;
  title?: string;
  xLabel?: string;
}

function gaussianKDE(values: number[], gridSize = 150): { x: number[]; y: number[] } {
  if (values.length === 0) return { x: [], y: [] };
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(n - 1, 1);
  const sd = Math.sqrt(variance);
  const bw = sd === 0 ? 1 : 1.06 * sd * Math.pow(n, -1 / 5);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 1;
  const xs: number[] = [];
  const ys: number[] = [];
  const step = (max - min + 2 * pad) / (gridSize - 1);
  for (let i = 0; i < gridSize; i++) {
    const x = min - pad + i * step;
    let y = 0;
    for (const v of values) {
      const u = (x - v) / bw;
      y += Math.exp(-0.5 * u * u);
    }
    y /= (n * bw * Math.sqrt(2 * Math.PI));
    xs.push(x);
    ys.push(y);
  }
  return { x: xs, y: ys };
}

function normalPdf(values: number[]): { x: number[]; y: number[] } {
  const n = values.length;
  if (n === 0) return { x: [], y: [] };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(n - 1, 1);
  const sd = Math.sqrt(variance) || 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 1;
  const grid = 100;
  const step = (max - min + 2 * pad) / (grid - 1);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < grid; i++) {
    const x = min - pad + i * step;
    xs.push(x);
    const u = (x - mean) / sd;
    ys.push(Math.exp(-0.5 * u * u) / (sd * Math.sqrt(2 * Math.PI)));
  }
  return { x: xs, y: ys };
}

export default function DensityPlot({
  series,
  fill = true,
  showNormal = false,
  height = 360,
  title,
  xLabel = 'Valeur',
}: Props) {
  const { traces, layout } = useMemo(() => {
    const tr: Data[] = [];

    series.forEach((s, i) => {
      const color = s.color ?? SCI_COLORS[i % SCI_COLORS.length];
      const { x, y } = gaussianKDE(s.values);
      tr.push({
        x, y,
        type: 'scatter',
        mode: 'lines',
        name: s.name,
        line: { color, width: 2.5 },
        fill: fill ? 'tozeroy' : 'none',
        fillcolor: `${color}22`,
        hovertemplate: '<b>%{x:.3f}</b><br>densité: %{y:.4f}<extra>' + s.name + '</extra>',
      } as Data);

      if (showNormal) {
        const { x: nx, y: ny } = normalPdf(s.values);
        tr.push({
          x: nx, y: ny,
          type: 'scatter',
          mode: 'lines',
          name: `${s.name} (Normale)`,
          line: { color, width: 1.5, dash: 'dash' },
          opacity: 0.6,
          hoverinfo: 'skip',
          showlegend: false,
        } as Data);
      }
    });

    const lay: Partial<Layout> = {
      title: title ? { text: title, font: { size: 14 } } : undefined,
      xaxis: { title: { text: xLabel } },
      yaxis: { title: { text: 'Densité' } },
      showlegend: series.length > 1,
      legend: { orientation: 'h', y: -0.15 },
    };

    return { traces: tr, layout: lay };
  }, [series, fill, showNormal, title, xLabel]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

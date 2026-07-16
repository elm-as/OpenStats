import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Une ou plusieurs séries de valeurs à comparer */
  series: Array<{ name: string; values: number[]; color?: string }> | number[];
  bins?: number;
  /** Affiche aussi la courbe KDE par-dessus */
  showDensity?: boolean;
  /** "overlay" pour superposer, "group" pour côte à côte */
  barmode?: 'overlay' | 'group' | 'stack';
  height?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

// KDE Gaussien simple
function gaussianKDE(values: number[], gridSize = 100): { x: number[]; y: number[] } {
  if (values.length === 0) return { x: [], y: [] };
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(n - 1, 1);
  const sd = Math.sqrt(variance);
  // Bandwidth Silverman
  const bw = sd === 0 ? 1 : 1.06 * sd * Math.pow(n, -1 / 5);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || 1;
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

export default function Histogram({
  series,
  bins = 30,
  showDensity = false,
  barmode = 'overlay',
  height = 360,
  title,
  xLabel = 'Valeur',
  yLabel = 'Fréquence',
}: Props) {
  const norm = useMemo(() => (
    Array.isArray(series) && (series as any[]).length > 0 && typeof (series as any[])[0] === 'number'
      ? [{ name: 'Valeurs', values: series as number[] }]
      : (series as Array<{ name: string; values: number[]; color?: string }>)
  ), [series]);

  const { traces, layout } = useMemo(() => {
    const tr: Data[] = norm.map((s, i) => ({
      x: s.values,
      type: 'histogram',
      name: s.name,
      nbinsx: bins,
      marker: {
        color: s.color ?? SCI_COLORS[i % SCI_COLORS.length],
        line: { color: 'rgba(255,255,255,0.15)', width: 0.5 },
      },
      opacity: barmode === 'overlay' && norm.length > 1 ? 0.55 : 0.85,
      hovertemplate: '<b>%{x}</b><br>n = %{y}<extra>' + s.name + '</extra>',
    } as Data));

    if (showDensity) {
      norm.forEach((s, i) => {
        const { x, y } = gaussianKDE(s.values);
        // Mise à l'échelle de la densité pour matcher l'histogramme
        const binWidth = (Math.max(...s.values) - Math.min(...s.values)) / bins || 1;
        const scaled = y.map(v => v * s.values.length * binWidth);
        tr.push({
          x,
          y: scaled,
          type: 'scatter',
          mode: 'lines',
          name: `${s.name} (KDE)`,
          line: { color: s.color ?? SCI_COLORS[i % SCI_COLORS.length], width: 2 },
          yaxis: 'y',
          showlegend: false,
          hoverinfo: 'skip',
        } as Data);
      });
    }

    const lay: Partial<Layout> = {
      title: title ? { text: title, font: { size: 14 } } : undefined,
      xaxis: { title: { text: xLabel } },
      yaxis: { title: { text: yLabel } },
      barmode,
      showlegend: norm.length > 1,
      legend: { orientation: 'h', y: -0.15 },
    };

    return { traces: tr, layout: lay };
  }, [norm, bins, showDensity, barmode, title, xLabel, yLabel]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

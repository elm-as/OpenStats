import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Variable + impacts low/high */
  variables: Array<{
    name: string;
    low: number;
    high: number;
    /** Valeur de base (impact = high - baseline ou low - baseline) */
    baseline?: number;
  }>;
  baseline?: number;
  height?: number;
  title?: string;
  xLabel?: string;
}

export default function TornadoChart({
  variables,
  baseline = 0,
  height,
  title = "Analyse de sensibilité (Tornado)",
  xLabel = 'Impact sur la prédiction',
}: Props) {
  const sorted = useMemo(() => {
    return [...variables]
      .map(v => ({ ...v, range: Math.abs(v.high - v.low) }))
      .sort((a, b) => a.range - b.range);
  }, [variables]);

  const { traces, layout, h } = useMemo(() => {
    const lows = sorted.map(v => Math.min(v.low, v.high) - baseline);
    const highs = sorted.map(v => Math.max(v.low, v.high) - baseline);
    const names = sorted.map(v => v.name);

    const trLow: Data = {
      x: lows,
      y: names,
      type: 'bar',
      orientation: 'h',
      name: 'Impact négatif',
      base: baseline,
      marker: { color: '#f87171', line: { color: 'rgba(255,255,255,0.1)', width: 0.5 } },
      hovertemplate: '<b>%{y}</b><br>' + xLabel + ': %{x:.3f}<extra></extra>',
    } as Data;

    const trHigh: Data = {
      x: highs,
      y: names,
      type: 'bar',
      orientation: 'h',
      name: 'Impact positif',
      base: baseline,
      marker: { color: '#34d399', line: { color: 'rgba(255,255,255,0.1)', width: 0.5 } },
      hovertemplate: '<b>%{y}</b><br>' + xLabel + ': %{x:.3f}<extra></extra>',
    } as Data;

    const computedH = height ?? Math.max(300, names.length * 32 + 80);
    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: xLabel }, zeroline: true },
      yaxis: { automargin: true },
      barmode: 'overlay',
      margin: { l: 160, r: 20, t: 40, b: 50 },
      shapes: [{
        type: 'line', xref: 'x', yref: 'paper',
        x0: baseline, x1: baseline, y0: 0, y1: 1,
        line: { color: 'rgba(255,255,255,0.5)', width: 1.5, dash: 'dot' },
      }],
      legend: { orientation: 'h', y: 1.05, x: 0.5, xanchor: 'center' },
    };

    return { traces: [trLow, trHigh], layout: lay, h: computedH };
  }, [sorted, baseline, title, xLabel, height]);

  return <PlotlyChart data={traces} layout={layout} height={h} />;
}

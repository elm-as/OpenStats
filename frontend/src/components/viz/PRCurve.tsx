import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  curves: Array<{
    name: string;
    precision: number[];
    recall: number[];
    averagePrecision?: number;
    color?: string;
  }>;
  baseline?: number;
  height?: number;
  title?: string;
}

export default function PRCurve({ curves, baseline, height = 400, title = 'Courbe Précision-Rappel' }: Props) {
  const { traces, layout } = useMemo(() => {
    const tr: Data[] = curves.map((c, i) => ({
      x: c.recall,
      y: c.precision,
      type: 'scatter',
      mode: 'lines',
      name: c.averagePrecision !== undefined ? `${c.name} (AP = ${c.averagePrecision.toFixed(3)})` : c.name,
      line: { color: c.color ?? SCI_COLORS[i % SCI_COLORS.length], width: 2.5 },
      hovertemplate: 'Rappel: %{x:.3f}<br>Précision: %{y:.3f}<extra>' + c.name + '</extra>',
    } as Data));

    if (baseline !== undefined) {
      tr.push({
        x: [0, 1],
        y: [baseline, baseline],
        type: 'scatter',
        mode: 'lines',
        name: `Baseline (${baseline.toFixed(2)})`,
        line: { color: 'rgba(255,255,255,0.3)', width: 1, dash: 'dash' },
        hoverinfo: 'skip',
      } as Data);
    }

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Rappel' }, range: [0, 1] },
      yaxis: { title: { text: 'Précision' }, range: [0, 1] },
      legend: { x: 0.05, y: 0.15, bgcolor: 'rgba(20,24,54,0.6)' },
    };

    return { traces: tr, layout: lay };
  }, [curves, baseline, title]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

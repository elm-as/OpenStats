import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS, useCurrentTheme } from './PlotlyBase';
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
  const theme = useCurrentTheme();
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
        line: { color: theme === 'light' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)', width: 1.5, dash: 'dash' },
        hoverinfo: 'skip',
      } as Data);
    }

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Rappel' }, range: [0, 1], automargin: true },
      yaxis: { title: { text: 'Précision' }, range: [0, 1], automargin: true },
      legend: {
        x: 0.05,
        y: 0.15,
        bgcolor: theme === 'light' ? 'rgba(255,255,255,0.88)' : 'rgba(21,26,36,0.82)',
        bordercolor: theme === 'light' ? 'rgba(15,23,42,0.14)' : 'rgba(148,163,184,0.2)',
        borderwidth: 1,
      },
    };

    return { traces: tr, layout: lay };
  }, [curves, baseline, title, theme]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

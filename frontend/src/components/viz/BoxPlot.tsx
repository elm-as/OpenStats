import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Une ou plusieurs séries */
  series: Array<{ name: string; values: number[]; color?: string }>;
  /** Affiche tous les points (pour petits échantillons) */
  showPoints?: 'all' | 'outliers' | false;
  /** Orientation : v (vertical) ou h (horizontal) */
  orientation?: 'v' | 'h';
  height?: number;
  title?: string;
  yLabel?: string;
}

export default function BoxPlot({
  series,
  showPoints = 'outliers',
  orientation = 'v',
  height = 380,
  title,
  yLabel = 'Valeur',
}: Props) {
  const { traces, layout } = useMemo(() => {
    const tr: Data[] = series.map((s, i) => ({
      [orientation === 'v' ? 'y' : 'x']: s.values,
      type: 'box',
      name: s.name,
      marker: { color: s.color ?? SCI_COLORS[i % SCI_COLORS.length] },
      boxmean: 'sd',
      boxpoints: showPoints === false ? false : showPoints,
      jitter: 0.4,
      pointpos: 0,
      line: { width: 1.5 },
      fillcolor: `${s.color ?? SCI_COLORS[i % SCI_COLORS.length]}33`,
      hovertemplate: (orientation === 'v' ? '<b>%{y:.3f}</b>' : '<b>%{x:.3f}</b>') + '<extra>' + s.name + '</extra>',
    } as Data));

    const lay: Partial<Layout> = {
      title: title ? { text: title, font: { size: 14 } } : undefined,
      [orientation === 'v' ? 'yaxis' : 'xaxis']: { title: { text: yLabel } },
      [orientation === 'v' ? 'xaxis' : 'yaxis']: { tickangle: orientation === 'v' ? -20 : 0 },
      showlegend: false,
    };

    return { traces: tr, layout: lay };
  }, [series, showPoints, orientation, title, yLabel]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

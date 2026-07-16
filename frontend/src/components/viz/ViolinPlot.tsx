import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  series: Array<{ name: string; values: number[]; color?: string }>;
  /** Affiche boxplot intérieur */
  showBox?: boolean;
  /** Affiche médiane */
  showMean?: boolean;
  /** Affiche tous les points */
  showPoints?: 'all' | 'outliers' | false;
  height?: number;
  title?: string;
  yLabel?: string;
}

export default function ViolinPlot({
  series,
  showBox = true,
  showMean = true,
  showPoints = false,
  height = 400,
  title,
  yLabel = 'Valeur',
}: Props) {
  const { traces, layout } = useMemo(() => {
    const tr: Data[] = series.map((s, i) => {
      const color = s.color ?? SCI_COLORS[i % SCI_COLORS.length];
      return {
        y: s.values,
        type: 'violin',
        name: s.name,
        box: { visible: showBox, width: 0.15 },
        meanline: { visible: showMean },
        line: { color, width: 1.5 },
        fillcolor: `${color}30`,
        points: showPoints === false ? false : showPoints,
        jitter: 0.3,
        scalemode: 'width',
        spanmode: 'soft',
        hovertemplate: '<b>%{y:.3f}</b><extra>' + s.name + '</extra>',
      } as Data;
    });

    const lay: Partial<Layout> = {
      title: title ? { text: title, font: { size: 14 } } : undefined,
      yaxis: { title: { text: yLabel } },
      xaxis: { tickangle: -20 },
      showlegend: false,
    };

    return { traces: tr, layout: lay };
  }, [series, showBox, showMean, showPoints, title, yLabel]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

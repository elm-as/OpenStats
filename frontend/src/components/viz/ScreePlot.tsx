import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Valeurs propres ou variance expliquée par composante */
  values: number[];
  /** Si true, affiche cumul + seuil Kaiser */
  showCumulative?: boolean;
  /** Si true, affiche le seuil de Kaiser (1.0) — uniquement pertinent pour eigenvalues */
  showKaiser?: boolean;
  /** Mode : 'eigenvalues' ou 'variance_ratio' */
  mode?: 'eigenvalues' | 'variance_ratio';
  height?: number;
  title?: string;
}

export default function ScreePlot({
  values,
  showCumulative = true,
  showKaiser = false,
  mode = 'variance_ratio',
  height = 380,
  title,
}: Props) {
  const { traces, layout } = useMemo(() => {
    const x = values.map((_, i) => i + 1);
    const isRatio = mode === 'variance_ratio';

    const cum: number[] = [];
    let s = 0;
    for (const v of values) {
      s += v;
      cum.push(s);
    }

    const yLabel = isRatio ? 'Variance expliquée (%)' : 'Valeur propre';
    const yValues = isRatio ? values.map(v => v * 100) : values;

    const barTrace: Data = {
      x,
      y: yValues,
      type: 'bar',
      name: yLabel,
      marker: {
        color: yValues.map((_, i) => `rgba(6,182,212,${Math.max(0.3, 1 - i * 0.08)})`),
        line: { color: '#06b6d4', width: 1 },
      },
      hovertemplate: '<b>Composante %{x}</b><br>%{y:.2f}' + (isRatio ? '%' : '') + '<extra></extra>',
    };

    const traceList: Data[] = [barTrace];

    if (showCumulative) {
      traceList.push({
        x,
        y: isRatio ? cum.map(v => v * 100) : cum,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Cumulé',
        yaxis: 'y2',
        line: { color: '#f59e0b', width: 2 },
        marker: { size: 6, color: '#fcd34d' },
        hovertemplate: '<b>%{x} composantes</b><br>Cumul : %{y:.1f}' + (isRatio ? '%' : '') + '<extra></extra>',
      });
    }

    const shapes: any[] = [];
    if (showKaiser && !isRatio) {
      shapes.push({
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        y0: 1,
        y1: 1,
        line: { color: '#ef4444', width: 1, dash: 'dash' },
      });
    }
    // Ligne 80% sur cumul
    if (showCumulative) {
      shapes.push({
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        y0: 80,
        y1: 80,
        yref: 'y2',
        line: { color: 'rgba(245,158,11,0.4)', width: 1, dash: 'dot' },
      });
    }

    const lay: Partial<Layout> = {
      title: { text: title || (isRatio ? "Variance expliquée par composante" : 'Valeurs propres'), font: { size: 14 } },
      xaxis: { title: { text: 'Composante' }, dtick: 1 },
      yaxis: { title: { text: yLabel } },
      yaxis2: showCumulative ? {
        title: { text: 'Cumulé (%)', font: { color: '#fcd34d' } },
        overlaying: 'y',
        side: 'right',
        range: [0, 100],
        showgrid: false,
        tickfont: { color: '#fcd34d' },
      } as any : undefined,
      shapes,
      legend: { orientation: 'h', y: -0.2 },
    };

    return { traces: traceList, layout: lay };
  }, [values, showCumulative, showKaiser, mode, title]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  dates: string[];
  observed: number[];
  trend: number[];
  seasonal: number[];
  residuals: number[];
  height?: number;
  title?: string;
}

export default function TSDecomposition({
  dates,
  observed,
  trend,
  seasonal,
  residuals,
  height = 720,
  title = 'Décomposition de la série temporelle',
}: Props) {
  const { traces, layout } = useMemo(() => {
    const baseLine = (y: number[], color: string, name: string, axis: string): Data => ({
      x: dates,
      y,
      type: 'scatter',
      mode: 'lines',
      name,
      line: { color, width: 1.5 },
      xaxis: axis === 'x' ? undefined : axis,
      yaxis: axis === 'x' ? undefined : axis.replace('x', 'y'),
      hovertemplate: '<b>%{x}</b><br>' + name + ': %{y:.3f}<extra></extra>',
    } as Data);

    const tr: Data[] = [
      baseLine(observed, '#22d3ee', 'Observée', 'x'),
      baseLine(trend, '#fcd34d', 'Tendance', 'x2'),
      baseLine(seasonal, '#a78bfa', 'Saisonnier', 'x3'),
      {
        x: dates,
        y: residuals,
        type: 'bar',
        name: 'Résidus',
        marker: { color: residuals.map(r => r >= 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(248, 113, 113, 0.7)') },
        xaxis: 'x4',
        yaxis: 'y4',
        hovertemplate: '<b>%{x}</b><br>Résidu: %{y:.3f}<extra></extra>',
      } as Data,
    ];

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      grid: { rows: 4, columns: 1, pattern: 'independent', roworder: 'top to bottom' },
      xaxis: { matches: 'x4', showticklabels: false },
      xaxis2: { matches: 'x4', showticklabels: false },
      xaxis3: { matches: 'x4', showticklabels: false },
      xaxis4: { title: { text: 'Temps' } },
      yaxis: { title: { text: 'Observée' }, automargin: true },
      yaxis2: { title: { text: 'Tendance' }, automargin: true },
      yaxis3: { title: { text: 'Saison' }, automargin: true },
      yaxis4: { title: { text: 'Résidus' }, automargin: true, zeroline: true },
      showlegend: false,
      margin: { l: 70, r: 20, t: 40, b: 50 },
    };

    return { traces: tr, layout: lay };
  }, [dates, observed, trend, seasonal, residuals, title]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

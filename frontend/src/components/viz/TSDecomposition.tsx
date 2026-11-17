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
    const baseLine = (opts: { y: number[]; color: string; name: string }): Data => ({
      x: dates,
      y: opts.y,
      type: 'scatter',
      mode: 'lines',
      name: opts.name,
      line: { color: opts.color, width: 1.5 },
      hovertemplate: '<b>%{x}</b><br>' + opts.name + ': %{y:.3f}<extra></extra>',
    } as Data);

    const tr: Data[] = [
      baseLine({ y: observed, color: '#0284c7', name: 'Observée' }),
      { ...baseLine({ y: trend, color: '#d97706', name: 'Tendance' }), xaxis: 'x2', yaxis: 'y2' } as Data,
      { ...baseLine({ y: seasonal, color: '#059669', name: 'Saisonnier' }), xaxis: 'x3', yaxis: 'y3' } as Data,
      {
        x: dates,
        y: residuals,
        type: 'bar',
        name: 'Résidus',
        marker: { color: residuals.map(r => r >= 0 ? 'rgba(5, 150, 105, 0.72)' : 'rgba(220, 38, 38, 0.72)') },
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

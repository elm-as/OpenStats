import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Historique observé */
  history: { dates: string[]; values: number[] };
  /** Prévisions futures */
  forecast: {
    dates: string[];
    values: number[];
    lower?: number[];
    upper?: number[];
  };
  /** Valeurs fittées sur l'historique */
  fitted?: { dates: string[]; values: number[] };
  height?: number;
  title?: string;
  yLabel?: string;
}

export default function TSForecast({
  history,
  forecast,
  fitted,
  height = 420,
  title = 'Prévision de série temporelle',
  yLabel = 'Valeur',
}: Props) {
  const { traces, layout } = useMemo(() => {
    const tr: Data[] = [];

    // Bande de confiance forecast
    if (forecast.lower && forecast.upper) {
      tr.push({
        x: [...forecast.dates, ...[...forecast.dates].reverse()],
        y: [...forecast.upper, ...[...forecast.lower].reverse()],
        fill: 'toself',
        fillcolor: 'rgba(245, 158, 11, 0.18)',
        line: { color: 'transparent' },
        name: 'IC 95%',
        type: 'scatter',
        showlegend: true,
        hoverinfo: 'skip',
      } as Data);
    }

    // Historique
    tr.push({
      x: history.dates,
      y: history.values,
      type: 'scatter',
      mode: 'lines',
      name: 'Observé',
      line: { color: '#22d3ee', width: 2 },
      hovertemplate: '<b>%{x}</b><br>%{y:.3f}<extra>Observé</extra>',
    } as Data);

    // Valeurs fittées
    if (fitted) {
      tr.push({
        x: fitted.dates,
        y: fitted.values,
        type: 'scatter',
        mode: 'lines',
        name: 'Ajustement',
        line: { color: '#a78bfa', width: 1.5, dash: 'dot' },
        hovertemplate: '<b>%{x}</b><br>%{y:.3f}<extra>Ajusté</extra>',
      } as Data);
    }

    // Prévisions
    tr.push({
      x: forecast.dates,
      y: forecast.values,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Prévision',
      line: { color: '#fcd34d', width: 2.5 },
      marker: { size: 5, color: '#f59e0b' },
      hovertemplate: '<b>%{x}</b><br>%{y:.3f}<extra>Prévision</extra>',
    } as Data);

    // Ligne séparation historique/forecast
    const separator = history.dates.length > 0 ? history.dates[history.dates.length - 1] : null;

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Temps' } },
      yaxis: { title: { text: yLabel } },
      legend: { orientation: 'h', y: -0.15 },
      shapes: separator ? [{
        type: 'line', xref: 'x', yref: 'paper',
        x0: separator, x1: separator, y0: 0, y1: 1,
        line: { color: 'rgba(255,255,255,0.3)', width: 1, dash: 'dot' },
      }] : [],
    };

    return { traces: tr, layout: lay };
  }, [history, forecast, fitted, title, yLabel]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

import React from 'react';
import Plot from 'react-plotly.js';
import type { Data, Layout } from 'plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG } from '../viz/PlotlyBase';
import { COLORS, FORECAST_COLORS } from './constants';

export function PlotlyMultiForecast({
  data,
  forecastStart,
  forecastEnd,
  viewMode,
  detailVar,
  compareVars,
  axisByVar,
  dualAxis,
  height,
}: {
  data: Record<string, unknown>[];
  forecastStart: string;
  forecastEnd: string;
  viewMode: 'detail' | 'compare';
  detailVar: string;
  compareVars: string[];
  axisByVar: Record<string, 'left' | 'right'>;
  dualAxis: boolean;
  height: number;
}) {
  const dates = data.map(r => String(r.date || ''));
  const traces: Data[] = [];
  const getCol = (key: string) =>
    data.map(r => {
      const v = r[key];
      return typeof v === 'number' ? v : null;
    });

  if (viewMode === 'detail') {
    const obsColor = COLORS[0];
    const fitColor = '#a78bfa';
    const fcColor = FORECAST_COLORS[0];
    traces.push({
      x: dates,
      y: getCol(`${detailVar}_obs`),
      type: 'scatter',
      mode: 'lines',
      name: `${detailVar} observé`,
      line: { color: obsColor, width: 2 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>%{y:.4f}<extra>observé</extra>',
    } as Data);
    traces.push({
      x: dates,
      y: getCol(`${detailVar}_fit`),
      type: 'scatter',
      mode: 'lines',
      name: `${detailVar} ajusté`,
      line: { color: fitColor, width: 1.6, dash: 'dot' },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>%{y:.4f}<extra>ajusté</extra>',
    } as Data);
    traces.push({
      x: dates,
      y: getCol(`${detailVar}_fc`),
      type: 'scatter',
      mode: 'lines',
      name: `${detailVar} prévu`,
      line: { color: fcColor, width: 2.2 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>%{y:.4f}<extra>prévision</extra>',
    } as Data);
  } else {
    compareVars.forEach((v, idx) => {
      const isRight = dualAxis && axisByVar[v] === 'right';
      const yaxis = isRight ? 'y2' : 'y';
      const obsColor = COLORS[idx % COLORS.length];
      const fcColor = FORECAST_COLORS[idx % FORECAST_COLORS.length];

      traces.push({
        x: dates,
        y: getCol(`${v}_obs`),
        type: 'scatter',
        mode: 'lines',
        name: `${v} (obs)`,
        yaxis,
        line: { color: obsColor, width: 1.8 },
        connectgaps: false,
        hovertemplate: `<b>%{x}</b><br>${v} obs: %{y:.4f}<extra></extra>`,
      } as Data);

      traces.push({
        x: dates,
        y: getCol(`${v}_fc`),
        type: 'scatter',
        mode: 'lines',
        name: `${v} (prev)`,
        yaxis,
        line: { color: fcColor, width: 2, dash: 'dash' },
        connectgaps: false,
        hovertemplate: `<b>%{x}</b><br>${v} prev: %{y:.4f}<extra></extra>`,
      } as Data);
    });
  }

  const shapes: any[] = [];
  if (forecastStart && forecastEnd) {
    shapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'paper',
      x0: forecastStart,
      x1: forecastEnd,
      y0: 0,
      y1: 1,
      fillcolor: 'rgba(6, 182, 212, 0.08)',
      line: { width: 0 },
      layer: 'below',
    });
  }
  if (forecastStart) {
    shapes.push({
      type: 'line',
      xref: 'x',
      yref: 'paper',
      x0: forecastStart,
      x1: forecastStart,
      y0: 0,
      y1: 1,
      line: { color: '#67e8f9', width: 1.5, dash: 'dot' },
    });
  }

  const annotations: any[] = forecastStart
    ? [
        {
          x: forecastStart,
          y: 1.02,
          xref: 'x',
          yref: 'paper',
          text: 'Prévision',
          showarrow: false,
          font: { size: 10, color: '#67e8f9' },
        },
      ]
    : [];

  const layout: Partial<Layout> = {
    ...DARK_TEMPLATE,
    autosize: true,
    margin: { l: 60, r: dualAxis ? 60 : 20, t: 30, b: 60 },
    xaxis: { ...DARK_TEMPLATE.xaxis, tickangle: -25 },
    yaxis: {
      ...DARK_TEMPLATE.yaxis,
      title: { text: 'Valeur', font: { color: '#dfe3ee', size: 10 } },
    },
    yaxis2: dualAxis
      ? {
          title: { text: 'Valeur (axe droit)', font: { color: '#fcd34d', size: 10 } },
          overlaying: 'y',
          side: 'right',
          gridcolor: 'transparent',
          zeroline: false,
          tickfont: { color: '#fcd34d', size: 9 },
        }
      : undefined,
    legend: { orientation: 'h', y: -0.18, font: { color: '#dfe3ee', size: 10 } },
    shapes,
    annotations,
    hovermode: 'x unified',
  };

  return (
    <Plot
      data={traces}
      layout={layout}
      config={DEFAULT_CONFIG}
      style={{ width: '100%', height }}
      useResizeHandler
    />
  );
}

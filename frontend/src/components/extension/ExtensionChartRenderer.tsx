import React from 'react';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG, SCI_COLORS } from '../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';
import { Layout as LayoutIcon } from 'lucide-react';

interface ExtensionChartRendererProps {
  chart: any;
  index: number;
}

export function ExtensionChartRenderer({ chart, index }: ExtensionChartRendererProps) {
  const xKey = chart.x_key || 'name';
  const yKey = chart.y_key || 'value';
  const data = chart.data || [];
  const seriesKeys = Object.keys(data[0] || {}).filter(k => k !== xKey);
  const traces: Data[] = [];
  let layout: Partial<Layout> = {
    ...DARK_TEMPLATE,
    autosize: true,
    margin: { l: 50, r: 20, t: 10, b: 60 },
  };

  if (chart.type === 'line') {
    seriesKeys.forEach((key, i) => {
      traces.push({
        x: data.map((d: any) => d[xKey]),
        y: data.map((d: any) => d[key]),
        type: 'scatter',
        mode: 'lines+markers',
        name: key,
        line: { color: SCI_COLORS[i % SCI_COLORS.length], width: 2 },
        marker: { size: 4 },
        hovertemplate: '<b>%{x}</b><br>' + key + ': %{y}<extra></extra>',
      } as Data);
    });
  } else if (chart.type === 'bar') {
    seriesKeys.forEach((key, i) => {
      traces.push({
        x: data.map((d: any) => d[xKey]),
        y: data.map((d: any) => d[key]),
        type: 'bar',
        name: key,
        marker: { color: SCI_COLORS[i % SCI_COLORS.length] },
        hovertemplate: '<b>%{x}</b><br>' + key + ': %{y}<extra></extra>',
      } as Data);
    });
  } else if (chart.type === 'pie') {
    traces.push({
      labels: data.map((d: any) => d[xKey]),
      values: data.map((d: any) => d[yKey]),
      type: 'pie',
      hole: 0.3,
      marker: {
        colors: data.map((_: any, i: number) => SCI_COLORS[i % SCI_COLORS.length]),
      },
      textinfo: 'label+percent',
      hovertemplate: '<b>%{label}</b><br>%{value} (%{percent})<extra></extra>',
    } as Data);
    layout = { ...DARK_TEMPLATE, autosize: true, margin: { l: 20, r: 20, t: 10, b: 20 } };
  } else if (chart.type === 'scatter') {
    traces.push({
      x: data.map((d: any) => d[xKey]),
      y: data.map((d: any) => d[yKey]),
      type: 'scatter',
      mode: 'markers',
      name: chart.title || 'points',
      marker: {
        size: 6,
        color: SCI_COLORS[0],
        opacity: 0.7,
        line: { color: 'rgba(255,255,255,0.15)', width: 0.5 },
      },
      hovertemplate: `<b>${xKey}: %{x}</b><br>${yKey}: %{y}<extra></extra>`,
    } as Data);
  } else if (chart.type === 'area') {
    seriesKeys.forEach((key, i) => {
      const color = SCI_COLORS[i % SCI_COLORS.length];
      traces.push({
        x: data.map((d: any) => d[xKey]),
        y: data.map((d: any) => d[key]),
        type: 'scatter',
        mode: 'lines',
        name: key,
        fill: 'tozeroy',
        line: { color, width: 1.5 },
        fillcolor: `${color}40`,
      } as Data);
    });
  }

  if (chart.type !== 'pie') {
    layout.xaxis = {
      ...DARK_TEMPLATE.xaxis,
      title: { text: xKey, font: { color: '#dfe3ee' } },
    };
    layout.yaxis = { ...DARK_TEMPLATE.yaxis };
  }
  layout.legend = { orientation: 'h', y: -0.2, font: { color: '#dfe3ee' } };

  return (
    <div key={index} className="card bg-white/5 border-white/10 p-4 space-y-4">
      <h4 className="text-sm font-bold text-surface-200 flex items-center gap-2">
        <LayoutIcon className="w-4 h-4 text-accent-400" />
        {chart.title || `Graphique ${index + 1}`}
      </h4>
      <Plot
        data={traces}
        layout={layout}
        config={DEFAULT_CONFIG}
        style={{ width: '100%', height: 300 }}
        useResizeHandler
      />
    </div>
  );
}

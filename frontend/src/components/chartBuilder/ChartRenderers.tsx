import { useMemo } from 'react';
import type { ChartDataResponse } from '../../types';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG, SCI_COLORS } from '../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';
import { Histogram, BoxPlot, ViolinPlot } from '../viz';

type ChartType =
  | 'line'
  | 'bar'
  | 'stacked_bar'
  | 'pie'
  | 'scatter'
  | 'bubble'
  | 'area'
  | 'histogram'
  | 'box'
  | 'violin'
  | 'heatmap'
  | 'radar';

export function ChartRenderer({
  data,
  chartType,
  yCols,
}: {
  data: ChartDataResponse;
  chartType: ChartType;
  yCols?: string[];
}) {
  if (chartType === 'histogram' || chartType === 'box' || chartType === 'violin') {
    const cols = yCols || [];
    const series = cols.map((col, i) => ({
      name: col,
      values: ((data as any).data?.map((r: any) => r[col]) ?? []).filter(
        (v: any) => typeof v === 'number'
      ),
      color: SCI_COLORS[i % SCI_COLORS.length],
    }));
    if (chartType === 'histogram')
      return <Histogram series={series} showDensity barmode="overlay" />;
    if (chartType === 'box') return <BoxPlot series={series} showPoints="outliers" />;
    return <ViolinPlot series={series} />;
  }

  return <PlotlyChartFromBackend data={data} />;
}

export function PlotlyChartFromBackend({ data }: { data: ChartDataResponse }) {
  const { traces, layout } = useMemo(() => {
    const series: any[] = data.series || [];
    const points: any[] = data.data || [];
    const tr: Data[] = [];

    switch (data.chart_type) {
      case 'line':
        series.forEach((s: any, i: number) => {
          const seriesData = (data as any).color_col
            ? points.filter(p => p.color === s)
            : points;
          const sName = (data as any).color_col ? String(s) : s;
          tr.push({
            x: seriesData.map(p => p.x),
            y: seriesData.map(p =>
              p[(data as any).color_col ? (data.series?.[0] || s) : s]
            ),
            type: 'scatter',
            mode: 'lines+markers',
            name: sName,
            line: { color: SCI_COLORS[i % SCI_COLORS.length], width: 2 },
            marker: { size: 4 },
            hovertemplate: `<b>%{x}</b><br>${sName}: %{y}<extra></extra>`,
          } as Data);
        });
        break;

      case 'bar':
      case 'stacked_bar':
        series.forEach((s: any, i: number) => {
          const seriesData = (data as any).color_col
            ? points.filter(p => p.color === s)
            : points;
          const sName = (data as any).color_col ? String(s) : s;
          tr.push({
            x: seriesData.map(p => p.x),
            y: seriesData.map(p =>
              p[(data as any).color_col ? (data.series?.[0] || s) : s]
            ),
            type: 'bar',
            name: sName,
            marker: { color: SCI_COLORS[i % SCI_COLORS.length] },
            hovertemplate: `<b>%{x}</b><br>${sName}: %{y}<extra></extra>`,
          } as Data);
        });
        break;

      case 'area':
        series.forEach((s: any, i: number) => {
          const color = SCI_COLORS[i % SCI_COLORS.length];
          tr.push({
            x: points.map(p => p.x),
            y: points.map(p => p[s]),
            type: 'scatter',
            mode: 'lines',
            name: s,
            fill: 'tozeroy',
            line: { color, width: 1.5 },
            fillcolor: `${color}40`,
            hovertemplate: '<b>%{x}</b><br>' + s + ': %{y}<extra></extra>',
          } as Data);
        });
        break;

      case 'pie':
        tr.push({
          labels: points.map(p => p.name),
          values: points.map(p => p.value),
          type: 'pie',
          hole: 0.3,
          marker: { colors: points.map((_, i) => SCI_COLORS[i % SCI_COLORS.length]) },
          textinfo: 'label+percent',
          textposition: 'outside',
          hovertemplate: '<b>%{label}</b><br>%{value} (%{percent})<extra></extra>',
        } as Data);
        break;

      case 'scatter':
      case 'bubble':
        if ((data as any).color_col) {
          const uniqueColors = Array.from(new Set(points.map(p => p.color)));
          uniqueColors.forEach((c, i) => {
            const cPoints = points.filter(p => p.color === c);
            tr.push({
              x: cPoints.map(p => p.x),
              y: cPoints.map(p => p.y),
              type: 'scatter',
              mode: 'markers',
              name: String(c),
              marker: {
                size:
                  data.chart_type === 'bubble'
                    ? cPoints.map(p => Math.max(5, (p.size || 0) * 0.5))
                    : 6,
                color: SCI_COLORS[i % SCI_COLORS.length],
                opacity: 0.7,
                line: { color: 'rgba(255,255,255,0.2)', width: 0.5 },
                sizemode: 'area',
                sizeref:
                  data.chart_type === 'bubble'
                    ? Math.max(...points.map(p => p.size || 1)) / 400
                    : 1,
                sizemin: 4,
              },
              hovertemplate: `<b>${data.x_col}: %{x}</b><br>${(data as any).y_col}: %{y}<br>${(data as any).color_col}: ${c}<extra></extra>`,
            } as Data);
          });
        } else {
          tr.push({
            x: points.map(p => p.x),
            y: points.map(p => p.y),
            type: 'scatter',
            mode: 'markers',
            marker: {
              size: data.chart_type === 'bubble' ? points.map(p => p.size) : 6,
              color: SCI_COLORS[0],
              opacity: 0.65,
              line: { color: 'rgba(255,255,255,0.15)', width: 0.5 },
              sizemode: 'area',
              sizeref:
                data.chart_type === 'bubble'
                  ? Math.max(...points.map(p => p.size || 1)) / 400
                  : 1,
              sizemin: 4,
            },
            hovertemplate: `<b>${data.x_col}: %{x}</b><br>${(data as any).y_col}: %{y}<extra></extra>`,
          } as Data);
        }
        break;

      case 'heatmap':
        tr.push({
          z: (data as any).z_values,
          x: (data as any).x_labels,
          y: (data as any).y_labels,
          type: 'heatmap',
          colorscale: 'Viridis',
          hovertemplate: `X: %{x}<br>Y: %{y}<br>Valeur: %{z}<extra></extra>`,
        } as Data);
        break;

      case 'radar':
        series.forEach((s: any, i: number) => {
          tr.push({
            type: 'scatterpolar',
            r: points.map(p => p[s]),
            theta: points.map(p => p.x),
            fill: 'toself',
            name: s,
            line: { color: SCI_COLORS[i % SCI_COLORS.length] },
          } as Data);
        });
        break;
    }

    const isPolar = data.chart_type === 'radar';

    const lay: Partial<Layout> = {
      ...DARK_TEMPLATE,
      title: (data as any).chart_title
        ? { text: (data as any).chart_title, font: { color: '#dfe3ee', size: 16 } }
        : undefined,
      autosize: true,
      barmode: data.chart_type === 'stacked_bar' ? 'stack' : 'group',
      polar: isPolar
        ? {
            radialaxis: { visible: true, gridcolor: '#334155', linecolor: '#334155' },
            angularaxis: { gridcolor: '#334155', linecolor: '#334155' },
            bgcolor: 'transparent',
          }
        : undefined,
      xaxis:
        data.chart_type === 'pie' || isPolar
          ? undefined
          : {
              ...DARK_TEMPLATE.xaxis,
              title: { text: (data as any).x_col || '', font: { color: '#dfe3ee' } },
              tickangle: -25,
            },
      yaxis:
        data.chart_type === 'pie' || isPolar
          ? undefined
          : {
              ...DARK_TEMPLATE.yaxis,
              title: { text: (data as any).y_col || '', font: { color: '#dfe3ee' } },
              type: (data as any).log_y ? 'log' : 'linear',
            },
      legend: { orientation: 'h', y: -0.2, font: { color: '#dfe3ee' } },
      showlegend:
        data.chart_type !== 'scatter' || series.length > 1 || !!(data as any).color_col,
    };

    return { traces: tr, layout: lay };
  }, [data]);

  return (
    <Plot
      data={traces}
      layout={layout}
      config={DEFAULT_CONFIG}
      style={{ width: '100%', height: 440 }}
      useResizeHandler
    />
  );
}

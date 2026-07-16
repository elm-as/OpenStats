import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Liste de courbes PDP (1 par feature) */
  features: Array<{
    name: string;
    x: number[];
    y: number[];
    /** Lignes individuelles ICE (optionnel) */
    ice?: number[][];
  }>;
  height?: number;
  title?: string;
  yLabel?: string;
}

export default function PartialDependence({
  features,
  height = 400,
  title = 'Partial Dependence Plot',
  yLabel = 'Prédiction moyenne',
}: Props) {
  const { traces, layout } = useMemo(() => {
    const tr: Data[] = [];

    features.forEach((f, i) => {
      const color = SCI_COLORS[i % SCI_COLORS.length];

      // ICE individuels (lignes fines)
      if (f.ice) {
        f.ice.slice(0, 80).forEach((row) => {
          tr.push({
            x: f.x,
            y: row,
            type: 'scatter',
            mode: 'lines',
            line: { color: `${color}30`, width: 0.5 },
            hoverinfo: 'skip',
            showlegend: false,
          } as Data);
        });
      }

      // PDP moyen (gras)
      tr.push({
        x: f.x,
        y: f.y,
        type: 'scatter',
        mode: 'lines',
        name: f.name,
        line: { color, width: 3 },
        hovertemplate: `<b>${f.name}</b><br>x: %{x:.3f}<br>` + yLabel + ': %{y:.4f}<extra></extra>',
      } as Data);
    });

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: features[0]?.name || 'Variable' } },
      yaxis: { title: { text: yLabel } },
      showlegend: features.length > 1,
      legend: { orientation: 'h', y: -0.15 },
    };

    return { traces: tr, layout: lay };
  }, [features, title, yLabel]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Liste [{ feature, importance }] */
  features: Array<{ feature: string; importance: number; std?: number }>;
  /** Limite le nombre affiché */
  topN?: number;
  /** Pour SHAP, utilise un dégradé selon le signe */
  showSign?: boolean;
  height?: number;
  title?: string;
  xLabel?: string;
}

export default function FeatureImportance({
  features,
  topN = 15,
  showSign = false,
  height,
  title = 'Importance des variables',
  xLabel = 'Importance',
}: Props) {
  const sorted = useMemo(() => {
    return [...features]
      .sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance))
      .slice(0, topN)
      .reverse(); // pour affichage horizontal du plus important en haut
  }, [features, topN]);

  const { traces, layout, h } = useMemo(() => {
    const colors = sorted.map(f => {
      if (showSign) {
        return f.importance >= 0 ? '#22d3ee' : '#f87171';
      }
      return '#06b6d4';
    });

    const tr: Data = {
      x: sorted.map(f => f.importance),
      y: sorted.map(f => f.feature),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: colors,
        line: { color: 'rgba(255,255,255,0.1)', width: 0.5 },
      },
      error_x: sorted.some(f => f.std !== undefined)
        ? { type: 'data', array: sorted.map(f => f.std ?? 0), color: 'rgba(255,255,255,0.3)', thickness: 1 }
        : undefined,
      hovertemplate: '<b>%{y}</b><br>' + xLabel + ': %{x:.4f}<extra></extra>',
    } as Data;

    const computedH = height ?? Math.max(280, sorted.length * 28 + 60);
    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: xLabel }, zeroline: true },
      yaxis: { automargin: true },
      margin: { l: 140, r: 20, t: 40, b: 50 },
      showlegend: false,
    };

    return { traces: [tr], layout: lay, h: computedH };
  }, [sorted, showSign, height, title, xLabel]);

  return <PlotlyChart data={traces} layout={layout} height={h} />;
}

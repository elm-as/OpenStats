import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface SHAPRow {
  feature: string;
  /** Valeurs SHAP par observation */
  shap_values: number[];
  /** Valeurs originales correspondantes (pour colorisation) */
  feature_values?: number[];
}

interface Props {
  /** Plot beeswarm style : chaque variable → 1 ligne, points = obs */
  data: SHAPRow[];
  topN?: number;
  height?: number;
  title?: string;
}

export default function SHAPSummary({ data, topN = 15, height, title = 'SHAP — Impact sur les prédictions' }: Props) {
  const sorted = useMemo(() => {
    // Tri par moyenne |SHAP| décroissante
    return [...data]
      .map(d => ({
        ...d,
        meanAbs: d.shap_values.reduce((s, v) => s + Math.abs(v), 0) / Math.max(d.shap_values.length, 1),
      }))
      .sort((a, b) => b.meanAbs - a.meanAbs)
      .slice(0, topN)
      .reverse();
  }, [data, topN]);

  const { traces, layout, h } = useMemo(() => {
    const tr: Data[] = sorted.map((row, idx) => {
      // Colorisation : si feature_values disponibles, normalisation 0-1
      const fvs = row.feature_values;
      let colors: number[] | string[];
      if (fvs && fvs.length === row.shap_values.length) {
        const min = Math.min(...fvs);
        const max = Math.max(...fvs);
        const range = max - min || 1;
        colors = fvs.map(v => (v - min) / range);
      } else {
        colors = row.shap_values.map(() => 0.5);
      }

      // Jitter vertical pour éviter chevauchement
      const yPositions = row.shap_values.map(() => idx + (Math.random() - 0.5) * 0.5);

      return {
        x: row.shap_values,
        y: yPositions,
        type: 'scatter',
        mode: 'markers',
        marker: {
          size: 5,
          color: colors,
          colorscale: [
            [0, '#3b82f6'],
            [0.5, '#a78bfa'],
            [1, '#f97316'],
          ],
          opacity: 0.7,
          line: { color: 'rgba(255,255,255,0.15)', width: 0.5 },
          showscale: idx === sorted.length - 1,
          colorbar: idx === sorted.length - 1 ? {
            title: { text: 'Valeur', font: { color: '#cbd5e1' } },
            tickvals: [0, 1],
            ticktext: ['Faible', 'Élevée'],
            tickfont: { color: '#94a3b8' },
            len: 0.6,
          } : undefined,
        },
        hovertemplate: `<b>${row.feature}</b><br>SHAP: %{x:.4f}<extra></extra>`,
        showlegend: false,
        name: row.feature,
      } as Data;
    });

    const computedH = height ?? Math.max(300, sorted.length * 38 + 80);
    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Valeur SHAP (impact sur la prédiction)' }, zeroline: true },
      yaxis: {
        tickvals: sorted.map((_, i) => i),
        ticktext: sorted.map(s => s.feature),
        automargin: true,
      },
      margin: { l: 160, r: 80, t: 40, b: 50 },
      showlegend: false,
    };

    return { traces: tr, layout: lay, h: computedH };
  }, [sorted, height, title]);

  return <PlotlyChart data={traces} layout={layout} height={h} />;
}

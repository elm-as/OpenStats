import { useMemo } from 'react';
import { PlotlyChart, useCurrentTheme } from './PlotlyBase';
import { safeMin, safeMax } from './chartAnalyticsExport';
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
  const theme = useCurrentTheme();
  const isLight = theme === 'light';
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
        const min = safeMin(fvs);
        const max = safeMax(fvs);
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
            [0, '#0284c7'],
            [0.5, '#94a3b8'],
            [1, '#ea580c'],
          ],
          opacity: 0.72,
          line: { color: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)', width: 0.5 },
          showscale: idx === sorted.length - 1,
          colorbar: idx === sorted.length - 1 ? {
            title: { text: 'Valeur', font: { color: isLight ? '#0f172a' : '#cbd5e1' } },
            tickvals: [0, 1],
            ticktext: ['Faible', 'Élevée'],
            tickfont: { color: isLight ? '#475569' : '#94a3b8' },
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
  }, [sorted, height, title, isLight]);

  return <PlotlyChart data={traces} layout={layout} height={h} />;
}

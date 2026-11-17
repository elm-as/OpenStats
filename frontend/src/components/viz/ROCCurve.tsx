import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS, useCurrentTheme } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Une ou plusieurs courbes (modèles comparés) */
  curves: Array<{
    name: string;
    fpr: number[];
    tpr: number[];
    auc?: number;
    color?: string;
  }>;
  height?: number;
  title?: string;
}

export default function ROCCurve({ curves, height = 400, title = 'Courbe ROC' }: Props) {
  const theme = useCurrentTheme();
  const { traces, layout } = useMemo(() => {
    const tr: Data[] = curves.map((c, i) => ({
      x: c.fpr,
      y: c.tpr,
      type: 'scatter',
      mode: 'lines',
      name: c.auc !== undefined ? `${c.name} (AUC = ${c.auc.toFixed(3)})` : c.name,
      line: { color: c.color ?? SCI_COLORS[i % SCI_COLORS.length], width: 2.5 },
      hovertemplate: 'FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra>' + c.name + '</extra>',
    } as Data));

    // Ligne de base (aléatoire)
    tr.push({
      x: [0, 1],
      y: [0, 1],
      type: 'scatter',
      mode: 'lines',
      name: 'Aléatoire (AUC = 0.5)',
      line: { color: theme === 'light' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)', width: 1.5, dash: 'dash' },
      hoverinfo: 'skip',
    } as Data);

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Taux de faux positifs (FPR)' }, range: [0, 1], automargin: true },
      yaxis: { title: { text: 'Taux de vrais positifs (TPR)' }, range: [0, 1], automargin: true },
      legend: {
        x: 0.55,
        y: 0.15,
        bgcolor: theme === 'light' ? 'rgba(255,255,255,0.88)' : 'rgba(21,26,36,0.82)',
        bordercolor: theme === 'light' ? 'rgba(15,23,42,0.14)' : 'rgba(148,163,184,0.2)',
        borderwidth: 1,
      },
    };

    return { traces: tr, layout: lay };
  }, [curves, title, theme]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

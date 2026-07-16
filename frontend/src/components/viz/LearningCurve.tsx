import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  trainSizes: number[];
  trainScores: number[];
  testScores: number[];
  trainStd?: number[];
  testStd?: number[];
  height?: number;
  title?: string;
  metricLabel?: string;
}

export default function LearningCurve({
  trainSizes,
  trainScores,
  testScores,
  trainStd,
  testStd,
  height = 400,
  title = 'Courbe d\'apprentissage',
  metricLabel = 'Score',
}: Props) {
  const { traces, layout } = useMemo(() => {
    const tr: Data[] = [];

    // Bandes de confiance Train
    if (trainStd) {
      const upper = trainScores.map((s, i) => s + trainStd[i]);
      const lower = trainScores.map((s, i) => s - trainStd[i]);
      tr.push({
        x: [...trainSizes, ...[...trainSizes].reverse()],
        y: [...upper, ...lower.slice().reverse()],
        fill: 'toself',
        fillcolor: 'rgba(6, 182, 212, 0.15)',
        line: { color: 'transparent' },
        showlegend: false,
        hoverinfo: 'skip',
        type: 'scatter',
      } as Data);
    }
    // Bandes de confiance Test
    if (testStd) {
      const upper = testScores.map((s, i) => s + testStd[i]);
      const lower = testScores.map((s, i) => s - testStd[i]);
      tr.push({
        x: [...trainSizes, ...[...trainSizes].reverse()],
        y: [...upper, ...lower.slice().reverse()],
        fill: 'toself',
        fillcolor: 'rgba(245, 158, 11, 0.15)',
        line: { color: 'transparent' },
        showlegend: false,
        hoverinfo: 'skip',
        type: 'scatter',
      } as Data);
    }

    tr.push({
      x: trainSizes,
      y: trainScores,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Train',
      line: { color: '#06b6d4', width: 2.5 },
      marker: { size: 7, color: '#22d3ee' },
      hovertemplate: 'Taille: %{x}<br>Score: %{y:.3f}<extra>Train</extra>',
    } as Data);

    tr.push({
      x: trainSizes,
      y: testScores,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Validation',
      line: { color: '#f59e0b', width: 2.5 },
      marker: { size: 7, color: '#fcd34d' },
      hovertemplate: 'Taille: %{x}<br>Score: %{y:.3f}<extra>Validation</extra>',
    } as Data);

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: "Taille de l'échantillon d'entraînement" } },
      yaxis: { title: { text: metricLabel } },
      legend: { x: 0.5, y: 1.05, xanchor: 'center', orientation: 'h' },
    };

    return { traces: tr, layout: lay };
  }, [trainSizes, trainScores, testScores, trainStd, testStd, title, metricLabel]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}

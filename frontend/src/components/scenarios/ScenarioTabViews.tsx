import React from 'react';
import { Badge } from '../ui';
import { MonteCarloDistribution } from '../viz';
import { PlotlyChart, DEFAULT_CONFIG, SCI_COLORS, useCurrentTheme } from '../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';

export function SensitivityCurve(props: {
  analysis: any;
  colorIdx: number;
}) {
  const { analysis, colorIdx } = props;
  const theme = useCurrentTheme();
  const guideColor = theme === 'light' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.3)';
  const color = SCI_COLORS[colorIdx % SCI_COLORS.length];
  const traces: Data[] = [
    {
      x: analysis.points.map((p: any) => p.value),
      y: analysis.points.map((p: any) => p.prediction_mean),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color, width: 2 },
      marker: { size: 4, color },
      name: analysis.variable,
      hovertemplate: `<b>${analysis.variable}</b>=%{x:.3f}<br>pred=%{y:.4f}<extra></extra>`,
    } as Data,
  ];

  const layout: Partial<Layout> = {
    autosize: true,
    margin: { l: 50, r: 15, t: 10, b: 35 },
    xaxis: {
      title: { text: analysis.variable, font: { size: 10 } },
      automargin: true,
    },
    yaxis: {
      title: { text: 'Prédiction', font: { size: 10 } },
      automargin: true,
    },
    showlegend: false,
    shapes: [
      {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: analysis.base_mean,
        x1: analysis.base_mean,
        y0: 0,
        y1: 1,
        line: { color: guideColor, width: 1, dash: 'dot' },
      },
    ],
  };

  return (
    <div
      className="rounded-[var(--ui-radius)] p-3"
      style={{ background: 'var(--ui-bg-panel)', border: '1px solid var(--ui-border)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-strong">{analysis.variable}</span>
        {analysis.elasticity !== null && (
          <Badge variant="warning">η = {analysis.elasticity.toFixed(3)}</Badge>
        )}
      </div>
      <div className="flex gap-4 text-xs text-muted mb-2 ui-num">
        <span>μ = {analysis.base_mean.toFixed(3)}</span>
        <span>σ = {analysis.base_std.toFixed(3)}</span>
      </div>
      <PlotlyChart data={traces} layout={layout} config={DEFAULT_CONFIG} height={180} />
    </div>
  );
}

export function PresetScenariosResults({ scenarioResults }: { scenarioResults: any }) {
  return (
    <div className="mt-4 space-y-3">
      <table className="ui-table w-full text-xs">
        <thead>
          <tr>
            <th>Scénario</th>
            <th className="ui-th-num">Prédiction moyenne</th>
            <th className="ui-th-num">Écart vs central</th>
          </tr>
        </thead>
        <tbody>
          {scenarioResults.comparison.scenarios.map((sc: any) => (
            <tr key={sc.name}>
              <td className="font-medium text-strong capitalize">{sc.name}</td>
              <td className="ui-td-num font-semibold">{sc.predictions_mean.toFixed(2)}</td>
              <td className="ui-td-num">
                {sc.is_baseline
                  ? 'Référence'
                  : sc.pct_change !== null
                  ? `${sc.pct_change > 0 ? '+' : ''}${sc.pct_change.toFixed(1)}%`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-muted flex gap-4 ui-num">
        <span>
          Amplitude : <span className="text-default">{scenarioResults.comparison.spread.toFixed(2)}</span>
        </span>
        <span>
          Type : <span className="text-default">{scenarioResults.task_type}</span>
        </span>
      </div>
    </div>
  );
}

export function StressTestResultsTable({ stressData }: { stressData: any }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="ui-panel px-3 py-1.5 inline-flex items-center gap-2 text-xs ui-num">
        <span className="ui-t-muted">Prédiction de base :</span>
        <span className="font-semibold">{stressData.baseline_prediction.toFixed(3)}</span>
      </div>
      <div className="table-container overflow-x-auto">
        <table className="ui-table w-full text-xs">
          <thead>
            <tr>
              <th>Variable</th>
              {stressData.sigmas_tested.flatMap((s: any) => [
                <th key={`-${s}`} className="ui-th-num text-red-400">
                  −{s}σ
                </th>,
                <th key={`+${s}`} className="ui-th-num text-emerald-400">
                  +{s}σ
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {stressData.variables.map((v: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-strong">{v.variable}</td>
                {v.shocks.map((shock: any, j: number) => (
                  <td key={j} className="ui-td-num">
                    <span className={shock.impact > 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                      {shock.impact > 0 ? '+' : ''}
                      {shock.impact.toFixed(3)}
                    </span>
                    {shock.impact_pct !== null && (
                      <span className="text-muted ml-1">
                        ({shock.impact_pct > 0 ? '+' : ''}
                        {shock.impact_pct.toFixed(1)}%)
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MonteCarloResultsView(props: {
  mcData: any;
  mcValues: number[];
}) {
  const { mcData, mcValues } = props;
  const dist = mcData.distribution;
  return (
    <div className="space-y-4">
      <div className="ui-panel px-3.5 py-2 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs ui-num">
        <span><span className="ui-t-muted">Moyenne :</span> <strong>{dist.mean.toFixed(3)}</strong></span>
        <span><span className="ui-t-muted">Écart-type :</span> <strong>{dist.std.toFixed(3)}</strong></span>
        <span><span className="ui-t-muted">Médiane :</span> <strong>{dist.median.toFixed(3)}</strong></span>
        <span><span className="ui-t-muted">IC 90% :</span> <strong>[{dist.q05.toFixed(2)} ; {dist.q95.toFixed(2)}]</strong></span>
      </div>
      <MonteCarloDistribution
        values={mcValues}
        quantiles={[0.05, 0.5, 0.95]}
        title={`Distribution des prédictions (${mcData.n_simulations} simulations)`}
      />
    </div>
  );
}

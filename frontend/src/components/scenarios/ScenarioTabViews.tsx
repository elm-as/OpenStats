import React from 'react';
import { Badge, Stat, StatGrid } from '../ui';
import { MonteCarloDistribution } from '../viz';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG, SCI_COLORS } from '../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';

export function SensitivityCurve({
  analysis,
  colorIdx,
}: {
  analysis: any;
  colorIdx: number;
}) {
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
    ...DARK_TEMPLATE,
    autosize: true,
    margin: { l: 50, r: 15, t: 10, b: 35 },
    xaxis: {
      ...DARK_TEMPLATE.xaxis,
      title: { text: analysis.variable, font: { color: '#dfe3ee', size: 10 } },
    },
    yaxis: {
      ...DARK_TEMPLATE.yaxis,
      title: { text: 'Prédiction', font: { color: '#dfe3ee', size: 10 } },
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
        line: { color: 'rgba(255,255,255,0.3)', width: 1, dash: 'dot' },
      },
    ],
  };

  return (
    <div className="rounded-lg p-3 bg-white/[0.02] border border-white/8">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-strong">{analysis.variable}</span>
        {analysis.elasticity !== null && (
          <Badge variant="warning">η = {analysis.elasticity.toFixed(3)}</Badge>
        )}
      </div>
      <div className="flex gap-4 text-xs text-muted mb-2 num">
        <span>μ = {analysis.base_mean.toFixed(3)}</span>
        <span>σ = {analysis.base_std.toFixed(3)}</span>
      </div>
      <Plot
        data={traces}
        layout={layout}
        config={DEFAULT_CONFIG}
        style={{ width: '100%', height: 180 }}
        useResizeHandler
      />
    </div>
  );
}

export function PresetScenariosResults({ scenarioResults }: { scenarioResults: any }) {
  return (
    <div className="mt-5 space-y-3">
      <h5 className="text-strong text-sm font-medium">Résultats</h5>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarioResults.comparison.scenarios.map((sc: any) => {
          const tone =
            sc.name === 'pessimiste'
              ? 'border-red-500/30 bg-red-500/5'
              : sc.name === 'optimiste'
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-accent-500/30 bg-accent-500/5';
          return (
            <div key={sc.name} className={`rounded-lg p-4 border ${tone}`}>
              <div className="text-xs uppercase tracking-wider text-muted mb-1">
                {sc.name}
              </div>
              <div className="text-2xl font-bold text-strong num">
                {sc.predictions_mean.toFixed(2)}
              </div>
              {!sc.is_baseline && sc.pct_change !== null && (
                <div
                  className={`text-sm mt-1 num ${
                    sc.pct_change > 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {sc.pct_change > 0 ? '+' : ''}
                  {sc.pct_change.toFixed(1)}% vs central
                </div>
              )}
              {sc.is_baseline && (
                <Badge variant="info" className="mt-1">
                  Référence
                </Badge>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-muted flex gap-3">
        <span>
          Amplitude :{' '}
          <span className="text-default num">
            {scenarioResults.comparison.spread.toFixed(2)}
          </span>
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
    <div className="mt-5 space-y-3">
      <Badge variant="info">
        Prédiction de base :{' '}
        <span className="num ml-1">{stressData.baseline_prediction.toFixed(3)}</span>
      </Badge>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Variable</th>
              {stressData.sigmas_tested.flatMap((s: any) => [
                <th key={`-${s}`} className="text-center text-red-300">
                  −{s}σ
                </th>,
                <th key={`+${s}`} className="text-center text-emerald-300">
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
                  <td key={j} className="text-center">
                    <div
                      className={`text-xs num font-medium ${
                        shock.impact > 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {shock.impact > 0 ? '+' : ''}
                      {shock.impact.toFixed(3)}
                    </div>
                    {shock.impact_pct !== null && (
                      <div className="text-xs text-muted num">
                        ({shock.impact_pct > 0 ? '+' : ''}
                        {shock.impact_pct.toFixed(1)}%)
                      </div>
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

export function MonteCarloResultsView({
  mcData,
  mcValues,
}: {
  mcData: any;
  mcValues: number[];
}) {
  return (
    <div className="space-y-4">
      <StatGrid>
        <Stat label="Moyenne" value={mcData.distribution.mean.toFixed(3)} />
        <Stat label="Écart-type" value={mcData.distribution.std.toFixed(3)} />
        <Stat label="Médiane" value={mcData.distribution.median.toFixed(3)} />
        <Stat
          label="IC 90%"
          value={`[${mcData.distribution.q05.toFixed(2)} ; ${mcData.distribution.q95.toFixed(2)}]`}
        />
      </StatGrid>
      <MonteCarloDistribution
        values={mcValues}
        quantiles={[0.05, 0.5, 0.95]}
        title={`Distribution des prédictions (${mcData.n_simulations} simulations)`}
      />
    </div>
  );
}

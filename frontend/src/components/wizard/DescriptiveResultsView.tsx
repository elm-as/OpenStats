import React from 'react';
import { Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import type { DescriptiveStats, CorrelationResult } from '../../types';
import ReactPlotly from 'react-plotly.js';
const Plot = (ReactPlotly as any).default || ReactPlotly;
import { DARK_TEMPLATE, DEFAULT_CONFIG } from '../viz/PlotlyBase';
import { fmt } from './WizardTypes';

export function CorrelationBar({ value }: { value: number }) {
  const width = Math.abs(value) * 100;
  const color = value >= 0 ? '#3b82f6' : '#ef4444';
  return (
    <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function DescriptiveResults({ stats, type }: { stats: DescriptiveStats; type: string }) {
  const isNumeric = type === 'descriptive_numeric';
  const entries = Object.entries(stats).filter(([, s]) =>
    isNumeric ? s.type === 'numeric' : s.type === 'categorical'
  );

  if (entries.length === 0) {
    return <div className="card p-6 text-center text-surface-400">Aucune variable de ce type trouvée</div>;
  }

  return (
    <>
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">
            {isNumeric ? 'Variables numériques' : 'Variables catégorielles'}
          </h3>
          <span className="badge bg-primary-100 text-primary-700">{entries.length} variable(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-900 border-b">
                <th className="text-left py-2 px-3 font-medium text-surface-400">Variable</th>
                {isNumeric ? (
                  <>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Moyenne</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Médiane</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Écart-type</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Asymétrie</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Kurtosis</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Nullité</th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Cardinalité</th>
                    <th className="text-left py-2 px-3 font-medium text-surface-400">Mode</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Nullité</th>
                    <th className="text-left py-2 px-3 font-medium text-surface-400">Top valeurs</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(([col, s]) => (
                <tr key={col} className="hover:bg-surface-900">
                  <td className="py-2 px-3 font-medium">{col}</td>
                  {isNumeric ? (
                    <>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.mean)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.median)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.std)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.skewness)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.kurtosis)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{(s.null_rate * 100).toFixed(1)}%</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 text-right font-mono text-xs">{s.cardinality ?? '—'}</td>
                      <td className="py-2 px-3 text-xs">{s.top_values ? Object.keys(s.top_values)[0] : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{(s.null_rate * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-xs">
                        {s.top_values && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(s.top_values).slice(0, 5).map(([val, count]) => (
                              <span key={val} className="badge bg-surface-800 text-surface-400">
                                {val} ({count})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Taux de nullité</h3>
        <Plot
          data={[
            {
              x: entries.map(([, s]) => s.null_rate * 100),
              y: entries.map(([col]) => (col.length > 25 ? col.slice(0, 25) + '…' : col)),
              type: 'bar',
              orientation: 'h',
              marker: {
                color: entries.map(([, s]) =>
                  s.null_rate >= 0.5 ? '#ef4444' : s.null_rate >= 0.2 ? '#f59e0b' : '#06b6d4'
                ),
                line: { color: 'rgba(255,255,255,0.1)', width: 0.5 },
              },
              hovertemplate: '<b>%{y}</b><br>%{x:.1f}%<extra></extra>',
            },
          ]}
          layout={{
            ...DARK_TEMPLATE,
            autosize: true,
            xaxis: {
              ...DARK_TEMPLATE.xaxis,
              title: { text: 'Taux (%)', font: { color: '#dfe3ee' } },
              range: [0, 100],
            },
            yaxis: { ...DARK_TEMPLATE.yaxis, automargin: true },
            margin: { l: 160, r: 20, t: 10, b: 50 },
          }}
          config={DEFAULT_CONFIG}
          style={{ width: '100%', height: Math.max(220, entries.length * 28 + 60) }}
          useResizeHandler
        />
      </div>
    </>
  );
}

export function CorrelationResults({ correlations }: { correlations: CorrelationResult }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">
          Corrélations significatives ({correlations.method})
        </h3>
        <span className="badge bg-primary-100 text-primary-700">
          {correlations.significant_pairs.length} paire(s)
        </span>
      </div>
      {correlations.significant_pairs.length === 0 ? (
        <p className="text-surface-400 text-sm">Aucune corrélation significative (|r| &gt; 0.3) détectée</p>
      ) : (
        <div className="space-y-2">
          {correlations.significant_pairs.slice(0, 25).map((pair, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 bg-surface-900 rounded-lg">
              <div className="text-sm">
                <span className="font-medium">{pair.var1}</span>
                <span className="text-surface-500 mx-2">↔</span>
                <span className="font-medium">{pair.var2}</span>
              </div>
              <div className="flex items-center gap-3">
                <CorrelationBar value={pair.coefficient} />
                <span className="font-mono text-sm w-16 text-right">{pair.coefficient.toFixed(3)}</span>
                <span
                  className={`badge ${
                    pair.strength === 'fort'
                      ? 'bg-red-100 text-red-800'
                      : pair.strength === 'modéré'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {pair.strength}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VifResults({
  vif,
}: {
  vif: { variable: string; vif: number; multicollinearity: string }[];
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-gray-900">Facteur d'Inflation de la Variance (VIF)</h3>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
        <strong>Interprétation :</strong> VIF &lt; 5 = OK, 5–10 = multicolinéarité modérée, &gt; 10 = multicolinéarité sévère
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-900 border-b">
            <th className="text-left py-2 px-3">Variable</th>
            <th className="text-right py-2 px-3">VIF</th>
            <th className="text-left py-2 px-3">Diagnostic</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {vif.map(v => (
            <tr key={v.variable} className="hover:bg-surface-900">
              <td className="py-2 px-3 font-medium">{v.variable}</td>
              <td className="py-2 px-3 text-right font-mono">{v.vif.toFixed(2)}</td>
              <td className="py-2 px-3">
                <span
                  className={`badge ${
                    v.multicollinearity === 'severe'
                      ? 'bg-red-100 text-red-800'
                      : v.multicollinearity === 'moderate'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {v.multicollinearity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

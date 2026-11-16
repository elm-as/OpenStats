import React from 'react';
import { Activity, TrendingUp, AlertTriangle, Clock, Tag } from 'lucide-react';
import type { DescriptiveStats, CorrelationResult } from '../../types';
import { PlotlyChart, DEFAULT_CONFIG } from '../viz/PlotlyBase';
import { fmt } from './WizardTypes';

export function CorrelationBar({ value }: { value: number }) {
  const width = Math.abs(value) * 100;
  const color = value >= 0 ? '#3b82f6' : '#ef4444';
  return (
    <div className="w-24 h-3 rounded-full overflow-hidden" style={{ background: 'var(--ui-bg-sunken)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function DescriptiveResults({ stats, type }: { stats: DescriptiveStats; type: string }) {
  const isNumeric = type === 'descriptive_numeric';
  const numericEntries = Object.entries(stats).filter(([, s]) => s.type === 'numeric');
  const categoricalEntries = Object.entries(stats).filter(([, s]) => s.type === 'categorical');
  const temporalEntries = Object.entries(stats).filter(([, s]) => s.type === 'temporal');
  const idEntries = Object.entries(stats).filter(([, s]) => s.type === 'id');

  const entries = isNumeric ? numericEntries : categoricalEntries;

  if (entries.length === 0 && temporalEntries.length === 0 && idEntries.length === 0) {
    return <div className="card p-6 text-center text-surface-400">Aucune variable trouvée</div>;
  }

  return (
    <>
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold" style={{ color: 'var(--ui-text)' }}>
            {isNumeric ? 'Variables numériques' : 'Variables catégorielles'}
          </h3>
          <span className="ui-tag ui-tag-accent ui-num">{entries.length} variable(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="ui-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 font-medium">Variable</th>
                {isNumeric ? (
                  <>
                    <th className="text-right py-2 px-3 font-medium">Moyenne</th>
                    <th className="text-right py-2 px-3 font-medium">Médiane</th>
                    <th className="text-right py-2 px-3 font-medium">Écart-type</th>
                    <th className="text-right py-2 px-3 font-medium">Asymétrie</th>
                    <th className="text-right py-2 px-3 font-medium">Kurtosis</th>
                    <th className="text-right py-2 px-3 font-medium">Nullité</th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2 px-3 font-medium">Cardinalité</th>
                    <th className="text-left py-2 px-3 font-medium">Mode</th>
                    <th className="text-right py-2 px-3 font-medium">Nullité</th>
                    <th className="text-left py-2 px-3 font-medium">Top valeurs</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map(([col, s]) => (
                <tr key={col}>
                  <td className="py-2 px-3 font-medium">{col}</td>
                  {isNumeric ? (
                    <>
                      <td className="py-2 px-3 text-right ui-num text-xs">{fmt(s.mean)}</td>
                      <td className="py-2 px-3 text-right ui-num text-xs">{fmt(s.median)}</td>
                      <td className="py-2 px-3 text-right ui-num text-xs">{fmt(s.std)}</td>
                      <td className="py-2 px-3 text-right ui-num text-xs">{fmt(s.skewness)}</td>
                      <td className="py-2 px-3 text-right ui-num text-xs">{fmt(s.kurtosis)}</td>
                      <td className="py-2 px-3 text-right ui-num text-xs">{(s.null_rate * 100).toFixed(1)}%</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 text-right ui-num text-xs">{s.cardinality ?? '—'}</td>
                      <td className="py-2 px-3 text-xs">{s.top_values ? Object.keys(s.top_values)[0] : '—'}</td>
                      <td className="py-2 px-3 text-right ui-num text-xs">{(s.null_rate * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-xs">
                        {s.top_values && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(s.top_values).slice(0, 5).map(([val, count]) => (
                              <span key={val} className="ui-tag ui-tag-neutral ui-num">
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
        <h3 className="font-semibold mb-4" style={{ color: 'var(--ui-text)' }}>Taux de nullité</h3>
        <PlotlyChart
          data={[
            {
              x: entries.map(([, s]) => s.null_rate * 100),
              y: entries.map(([col]) => (col.length > 25 ? col.slice(0, 25) + '…' : col)),
              type: 'bar',
              orientation: 'h',
              showlegend: false,
              marker: {
                color: entries.map(([, s]) =>
                  s.null_rate >= 0.5 ? '#dc2626' : s.null_rate >= 0.2 ? '#d97706' : '#0284c7'
                ),
              },
              hovertemplate: '<b>%{y}</b><br>%{x:.1f}%<extra></extra>',
            },
          ]}
          layout={{
            autosize: true,
            showlegend: false,
            xaxis: {
              title: { text: 'Taux (%)' },
              range: [0, 100],
            },
            yaxis: { automargin: true },
            margin: { l: 160, r: 20, t: 10, b: 50 },
          }}
          config={DEFAULT_CONFIG}
          height={Math.max(220, entries.length * 28 + 60)}
        />
      </div>

      {isNumeric && temporalEntries.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-cyan-500" />
            <h3 className="font-semibold" style={{ color: 'var(--ui-text)' }}>Dimensions Temporelles & Index</h3>
            <span className="ui-tag ui-tag-accent ui-num">{temporalEntries.length} index</span>
          </div>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Variable</th>
                  <th className="text-right py-2 px-3 font-medium">Début (Min)</th>
                  <th className="text-right py-2 px-3 font-medium">Fin (Max)</th>
                  <th className="text-right py-2 px-3 font-medium">Périodes</th>
                  <th className="text-right py-2 px-3 font-medium">Nullité</th>
                </tr>
              </thead>
              <tbody>
                {temporalEntries.map(([col, s]) => (
                  <tr key={col}>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--ui-accent-text)' }}>{col}</td>
                    <td className="py-2 px-3 text-right ui-num text-xs">{s.min ?? '—'}</td>
                    <td className="py-2 px-3 text-right ui-num text-xs">{s.max ?? '—'}</td>
                    <td className="py-2 px-3 text-right ui-num text-xs">{(s as any).periods_count ?? '—'}</td>
                    <td className="py-2 px-3 text-right ui-num text-xs">{(s.null_rate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isNumeric && idEntries.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold" style={{ color: 'var(--ui-text)' }}>Identifiants & Clés Techniques</h3>
            <span className="ui-tag ui-tag-warning ui-num">{idEntries.length} clé(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Variable</th>
                  <th className="text-right py-2 px-3 font-medium">Cardinalité</th>
                  <th className="text-right py-2 px-3 font-medium">Taux d'unicité</th>
                  <th className="text-right py-2 px-3 font-medium">Nullité</th>
                </tr>
              </thead>
              <tbody>
                {idEntries.map(([col, s]) => (
                  <tr key={col}>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--ui-warning)' }}>{col}</td>
                    <td className="py-2 px-3 text-right ui-num text-xs">{s.cardinality ?? s.count ?? '—'}</td>
                    <td className="py-2 px-3 text-right ui-num text-xs">{(((s as any).uniqueness_rate ?? 1) * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right ui-num text-xs">{(s.null_rate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export function CorrelationResults({ correlations }: { correlations: CorrelationResult }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold" style={{ color: 'var(--ui-text)' }}>
          Corrélations significatives ({correlations.method})
        </h3>
        <span className="ui-tag ui-tag-accent ui-num">
          {correlations.significant_pairs.length} paire(s)
        </span>
      </div>
      {correlations.significant_pairs.length === 0 ? (
        <p className="ui-t-muted text-sm">Aucune corrélation significative (|r| &gt; 0.3) détectée</p>
      ) : (
        <div className="space-y-2">
          {correlations.significant_pairs.slice(0, 25).map((pair, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-[var(--ui-radius-sm)]"
              style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}
            >
              <div className="text-sm" style={{ color: 'var(--ui-text)' }}>
                <span className="font-medium">{pair.var1}</span>
                <span className="ui-t-faint mx-2">↔</span>
                <span className="font-medium">{pair.var2}</span>
              </div>
              <div className="flex items-center gap-3">
                <CorrelationBar value={pair.coefficient} />
                <span className="ui-num text-sm w-16 text-right">{pair.coefficient.toFixed(3)}</span>
                <span
                  className={`ui-tag ${
                    pair.strength === 'fort'
                      ? 'ui-tag-danger'
                      : pair.strength === 'modéré'
                      ? 'ui-tag-warning'
                      : 'ui-tag-accent'
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
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold" style={{ color: 'var(--ui-text)' }}>Facteur d'Inflation de la Variance (VIF)</h3>
      </div>
      <div
        className="rounded-[var(--ui-radius-sm)] p-3 mb-4 text-xs"
        style={{
          background: 'var(--ui-warning-soft)',
          border: '1px solid var(--ui-border-strong)',
          color: 'var(--ui-text-secondary)',
        }}
      >
        <strong style={{ color: 'var(--ui-warning)' }}>Interprétation :</strong> VIF &lt; 5 = OK, 5–10 = multicolinéarité modérée, &gt; 10 = multicolinéarité sévère
      </div>
      <table className="ui-table w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 px-3">Variable</th>
            <th className="text-right py-2 px-3">VIF</th>
            <th className="text-left py-2 px-3">Diagnostic</th>
          </tr>
        </thead>
        <tbody>
          {vif.map(v => (
            <tr key={v.variable}>
              <td className="py-2 px-3 font-medium">{v.variable}</td>
              <td className="py-2 px-3 text-right ui-num">{v.vif.toFixed(2)}</td>
              <td className="py-2 px-3">
                <span
                  className={`ui-tag ${
                    v.multicollinearity === 'severe'
                      ? 'ui-tag-danger'
                      : v.multicollinearity === 'moderate'
                      ? 'ui-tag-warning'
                      : 'ui-tag-success'
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

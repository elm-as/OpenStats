import React from 'react';
import { GitCompare, Wand2, RefreshCw, Layers } from 'lucide-react';
import { GrangerHeatmap } from '../viz';
import type { MultivariateTimeSeriesResults } from '../../types';

interface MultivariateGrangerTabProps {
  results: MultivariateTimeSeriesResults;
  isLoading: boolean;
  onQuickRerun: (overrides: Record<string, any>) => void;
}

export function MultivariateGrangerTab(props: MultivariateGrangerTabProps) {
  const { results, isLoading, onQuickRerun } = props;
  if (!results.granger_causality) return null;

  return (
    <div className="space-y-4">
      <div className="ui-panel p-4">
        <h4 className="font-semibold text-[var(--ui-text)] mb-2 flex items-center gap-2 text-sm ui-num">
          <GitCompare className="w-4 h-4 text-accent-400" />
          Causalité de Granger (max lag = {results.granger_causality.max_lag})
        </h4>

        <p className="text-xs ui-t-muted mb-3">
          Régime : <strong>{results.granger_causality.data_regime || 'levels'}</strong>
        </p>

        {!results.all_stationary && results.granger_causality.data_regime === 'levels' && (
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => onQuickRerun({ granger_data_mode: 'diff' })}
              disabled={isLoading}
              className="ui-btn text-xs bg-accent-500/15 text-accent-400 border-accent-500/30"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Relancer Granger en différences (stationnarité)
              {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            </button>
          </div>
        )}
        {results.granger_causality.data_regime === 'diff' && (
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => onQuickRerun({ granger_data_mode: 'levels' })}
              disabled={isLoading}
              className="ui-btn text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Revenir en niveaux
              {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            </button>
          </div>
        )}

        <GrangerHeatmap
          pvalues={results.granger_causality.matrix as Record<string, Record<string, number>>}
          alpha={0.05}
          title=""
        />

        {results.granger_causality.details.filter(d => d.significant).length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium ui-t-muted mb-2">
              Relations significatives (p &lt; 0.05) :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {results.granger_causality.details
                .filter(d => d.significant)
                .map((d, i) => (
                  <span key={i} className="ui-tag ui-tag-success ui-num text-xs">
                    {d.cause} → {d.effect} (lag {d.optimal_lag || 'opt'}, p=
                    {d.p_value != null && d.p_value < 0.001 ? '< 0.001' : d.p_value?.toFixed(3)})
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MultivariateJohansenTabProps {
  results: MultivariateTimeSeriesResults;
}

export function MultivariateJohansenTab({ results }: MultivariateJohansenTabProps) {
  if (!results.johansen_cointegration) return null;
  const joh = results.johansen_cointegration;

  return (
    <div className="space-y-4">
      <div className="ui-panel p-4">
        <h4 className="font-semibold text-[var(--ui-text)] mb-3 flex items-center gap-2 text-sm">
          <Layers className="w-4 h-4 text-accent-400" />
          Test de cointégration de Johansen
        </h4>

        {'error' in joh && joh.error ? (
          <p className="text-red-400 text-xs">{joh.error}</p>
        ) : (
          <>
            <div className="ui-panel px-3 py-2 mb-4 flex flex-wrap gap-6 text-xs ui-num">
              <span>
                <span className="ui-t-muted">Rang exploitable :</span>{' '}
                <strong>{joh.cointegration_rank}</strong>
              </span>
              <span>
                <span className="ui-t-muted">Cointégration :</span>{' '}
                <strong className={joh.has_cointegration ? 'text-emerald-400' : 'ui-t-secondary'}>
                  {joh.has_cointegration ? 'Oui' : 'Non'}
                </strong>
              </span>
            </div>

            {joh.max_eigenvalue_tests && (
              <div className="mb-4">
                <p className="text-xs font-medium ui-t-muted mb-2">
                  Tests valeur propre maximale :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {joh.max_eigenvalue_tests.map((t, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded text-xs ui-num border"
                      style={{ background: 'var(--ui-bg-sunken)', borderColor: 'var(--ui-border)' }}
                    >
                      {t.hypothesis}: stat={t.statistic?.toFixed(3) ?? '—'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {joh.trace_tests && (
              <div className="overflow-x-auto">
                <table className="ui-table text-xs w-full">
                  <thead>
                    <tr>
                      <th className="p-2 text-left">H0</th>
                      <th className="p-2 ui-th-num">Stat trace</th>
                      <th className="p-2 ui-th-num">Critique 5%</th>
                      <th className="p-2 text-center">Rejet H0</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joh.trace_tests.map((test, i) => (
                      <tr key={i}>
                        <td className="p-2">{test.hypothesis}</td>
                        <td className="p-2 ui-td-num">{test.statistic?.toFixed(2)}</td>
                        <td className="p-2 ui-td-num">{test.critical_value_95?.toFixed(2)}</td>
                        <td className="p-2 text-center">
                          {test.reject ? (
                            <span className="text-emerald-400 font-bold">Oui</span>
                          ) : (
                            <span className="ui-t-muted">Non</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { GitCompare, Wand2, RefreshCw, Layers } from 'lucide-react';
import { GrangerHeatmap } from '../viz';
import { InfoCard } from './InfoCard';
import type { MultivariateTimeSeriesResults } from '../../types';

interface MultivariateGrangerTabProps {
  results: MultivariateTimeSeriesResults;
  isLoading: boolean;
  onQuickRerun: (overrides: Record<string, any>) => void;
}

export function MultivariateGrangerTab({
  results,
  isLoading,
  onQuickRerun,
}: MultivariateGrangerTabProps) {
  if (!results.granger_causality) return null;

  return (
    <div className="space-y-4">
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-purple-500" />
          Causalité de Granger (max lag = {results.granger_causality.max_lag})
        </h4>

        <p className="text-xs text-gray-500 mb-3">
          Régime utilisé pour Granger :{' '}
          <strong>{results.granger_causality.data_regime || 'levels'}</strong>
        </p>

        {!results.all_stationary && results.granger_causality.data_regime === 'levels' && (
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => onQuickRerun({ granger_data_mode: 'diff' })}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition-all disabled:opacity-50"
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
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-all disabled:opacity-50"
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
            <p className="text-xs font-medium text-gray-500 mb-2">
              Relations significatives (p &lt; 0.05) :
            </p>
            <div className="flex flex-wrap gap-2">
              {results.granger_causality.details
                .filter(d => d.significant)
                .map((d, i) => (
                  <span key={i} className="badge bg-green-100 text-green-700 font-mono text-xs">
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

  return (
    <div className="space-y-4">
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-500" />
          Test de cointégration de Johansen
        </h4>

        {'error' in results.johansen_cointegration && results.johansen_cointegration.error ? (
          <p className="text-red-600 text-sm">{results.johansen_cointegration.error}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <InfoCard
                label="Rang exploitable"
                value={String(results.johansen_cointegration.cointegration_rank)}
              />
              <InfoCard
                label="Cointégration exploitable"
                value={results.johansen_cointegration.has_cointegration ? 'Oui' : 'Non'}
                color={
                  results.johansen_cointegration.has_cointegration
                    ? 'text-green-600'
                    : 'text-gray-600'
                }
              />
            </div>

            {results.johansen_cointegration.max_eigenvalue_tests && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Tests valeur propre maximale :
                </p>
                <div className="flex flex-wrap gap-2">
                  {results.johansen_cointegration.max_eigenvalue_tests.map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                      {t.hypothesis}: stat={t.statistic?.toFixed(3) ?? '—'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {results.johansen_cointegration.trace_tests && (
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left">H0</th>
                      <th className="p-2 text-right">Stat trace</th>
                      <th className="p-2 text-right">Critique 5%</th>
                      <th className="p-2 text-center">Rejet H0</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.johansen_cointegration.trace_tests.map((test, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-2">{test.hypothesis}</td>
                        <td className="p-2 text-right font-mono">{test.statistic?.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">
                          {test.critical_value_95?.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          {test.reject ? (
                            <span className="text-green-600 font-bold">Oui</span>
                          ) : (
                            <span className="text-gray-500">Non</span>
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

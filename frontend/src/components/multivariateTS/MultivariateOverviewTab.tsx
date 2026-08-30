import React from 'react';
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import { MODEL_DEFS } from './constants';
import { InfoCard } from './InfoCard';
import type { MultivariateTimeSeriesResults } from '../../types';

interface MultivariateOverviewTabProps {
  results: MultivariateTimeSeriesResults;
  forcedModel: string;
  integrationOrders: [string, number][];
  isLoading: boolean;
  onQuickRerun: (overrides: Record<string, any>) => void;
}

export function MultivariateOverviewTab({
  results,
  forcedModel,
  integrationOrders,
  isLoading,
  onQuickRerun,
}: MultivariateOverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* Best model banner */}
      <div className="card bg-gradient-to-r from-primary-50 to-accent-50 border-primary-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-primary-600 font-semibold uppercase tracking-wide">
              Modèle sélectionné
            </p>
            <h4 className="text-xl font-bold text-gray-900 mt-1">
              {results.best_model?.toUpperCase() || 'Aucun'}
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              {results.best_model && MODEL_DEFS.find(m => m.key === results.best_model)?.desc}
            </p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-primary-600" />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard label="Observations" value={String(results.n_observations)} />
        <InfoCard
          label="Stationnarité"
          value={results.all_stationary ? 'Oui' : 'Non'}
          color={results.all_stationary ? 'text-green-600' : 'text-amber-600'}
        />
        <InfoCard label="Variables" value={String(results.n_variables)} />
        <InfoCard
          label="Forçage"
          value={forcedModel === 'auto' ? 'Auto' : forcedModel.toUpperCase()}
        />
      </div>

      {/* Model comparison */}
      {results.ranking && results.ranking.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3">Comparaison des modèles</h4>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left">Modèle</th>
                  <th className="p-2 text-right">AIC</th>
                  <th className="p-2 text-right">BIC</th>
                  <th className="p-2 text-right">HQIC</th>
                  <th className="p-2 text-center">Lag</th>
                  <th className="p-2 text-center">Sélectionné</th>
                </tr>
              </thead>
              <tbody>
                {results.ranking.map(model => (
                  <tr key={model.model} className="border-t border-gray-100">
                    <td className="p-2 font-medium">{model.model.toUpperCase()}</td>
                    <td className="p-2 text-right font-mono">{model.aic?.toFixed(1) ?? '—'}</td>
                    <td className="p-2 text-right font-mono">{model.bic?.toFixed(1) ?? '—'}</td>
                    <td className="p-2 text-right font-mono">
                      {'hqic' in model ? (model as any).hqic?.toFixed(1) : '—'}
                    </td>
                    <td className="p-2 text-center">
                      {'lag_order' in model ? (model as any).lag_order : '—'}
                    </td>
                    <td className="p-2 text-center">
                      {model.model === results.best_model ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Model suitability */}
      {results.model_suitability && Object.keys(results.model_suitability).length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-500" />
            Adéquation des modèles
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(results.model_suitability).map(([name, suit]) => (
              <div
                key={name}
                className={`p-3 rounded-lg border text-sm ${
                  suit.recommended
                    ? 'border-green-300 bg-green-50'
                    : suit.suitable
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{name.toUpperCase()}</span>
                  {suit.recommended && (
                    <span className="text-xs text-green-700 font-bold">Recommandé</span>
                  )}
                  {!suit.suitable && <span className="text-xs text-red-600">Non adapté</span>}
                </div>
                <p className="text-xs text-gray-600">{suit.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.johansen_cointegration?.assumption_valid === false &&
        results.johansen_cointegration?.assumption_message && (
          <div className="card bg-amber-50 border-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {results.johansen_cointegration.assumption_message}
              </p>
            </div>
          </div>
        )}

      {results.methodological_pivot && (
        <div className="card bg-indigo-50 border-indigo-200">
          <p className="text-xs font-medium text-indigo-800 mb-2">Pivot méthodologique appliqué</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-indigo-900">
            <p>
              VAR: mode demandé <strong>{results.methodological_pivot.var_data_mode}</strong> →
              régime appliqué <strong>{results.methodological_pivot.applied_var_regime}</strong>
            </p>
            <p>
              Trend VAR: <strong>{results.methodological_pivot.var_trend || 'c'}</strong>
            </p>
            <p>
              Granger: mode demandé{' '}
              <strong>{results.methodological_pivot.granger_data_mode}</strong> → régime
              appliqué <strong>{results.methodological_pivot.applied_granger_regime}</strong>
            </p>
            <p>
              Forçage modèle: <strong>{results.methodological_pivot.forced_model || 'aucun'}</strong>
            </p>
            <p>
              Ordres d'intégration:{' '}
              <strong>
                {integrationOrders.map(([k, v]) => `${k}=I(${v})`).join(', ') || 'n/a'}
              </strong>
            </p>
          </div>
          {results.methodological_pivot.integration_interpretation && (
            <p className="text-xs text-indigo-700 mt-2">
              {results.methodological_pivot.integration_interpretation}
            </p>
          )}
          {results.methodological_pivot.reason && (
            <p className="text-xs text-indigo-700 mt-2">{results.methodological_pivot.reason}</p>
          )}
        </div>
      )}

      {/* Stationarity per variable */}
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Stationnarité par variable
        </h4>
        <div className="space-y-2">
          {results.value_cols.map(col => {
            const st = results.stationarity[col];
            if (!st) return null;
            return (
              <div key={col} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{col}</span>
                <div className="flex items-center gap-3 text-sm">
                  <span className={st.is_stationary ? 'text-green-600' : 'text-amber-600'}>
                    {st.is_stationary ? 'Stationnaire' : 'Non-stationnaire'}
                  </span>
                  <span className="text-gray-400 text-xs">{st.conclusion}</span>
                </div>
              </div>
            );
          })}
        </div>

        {!results.all_stationary &&
          results.methodological_pivot?.applied_var_regime !== 'diff' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  onQuickRerun({ var_data_mode: 'diff', granger_data_mode: 'diff' })
                }
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                Rendre stationnaire (différencier)
                {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              </button>
            </div>
          )}
        {results.all_stationary &&
          results.methodological_pivot?.applied_var_regime === 'diff' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  onQuickRerun({ var_data_mode: 'levels', granger_data_mode: 'levels' })
                }
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-50 text-green-800 border border-green-200 hover:bg-green-100 transition-all disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                Revenir en niveaux (déjà stationnaire)
                {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}

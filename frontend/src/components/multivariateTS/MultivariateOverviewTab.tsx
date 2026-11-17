import React from 'react';
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import { MODEL_DEFS } from './constants';
import type { MultivariateTimeSeriesResults } from '../../types';

interface MultivariateOverviewTabProps {
  results: MultivariateTimeSeriesResults;
  forcedModel: string;
  integrationOrders: [string, number][];
  isLoading: boolean;
  onQuickRerun: (overrides: Record<string, any>) => void;
}

export function MultivariateOverviewTab(props: MultivariateOverviewTabProps) {
  const {
    results,
    forcedModel,
    integrationOrders,
    isLoading,
    onQuickRerun,
  } = props;

  return (
    <div className="space-y-4">
      <div className="ui-panel px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-accent-400 shrink-0" />
          <div>
            <span className="text-[11px] ui-t-muted uppercase tracking-wide mr-2">Modèle sélectionné :</span>
            <strong className="text-sm text-[var(--ui-text)]">
              {results.best_model?.toUpperCase() || 'Aucun'}
            </strong>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs ui-num">
          <span><span className="ui-t-muted">Obs :</span> <strong>{results.n_observations}</strong></span>
          <span>
            <span className="ui-t-muted">Stationnarité :</span>{' '}
            <strong className={results.all_stationary ? 'text-emerald-400' : 'text-amber-400'}>
              {results.all_stationary ? 'Oui' : 'Non'}
            </strong>
          </span>
          <span><span className="ui-t-muted">Variables :</span> <strong>{results.n_variables}</strong></span>
          <span>
            <span className="ui-t-muted">Forçage :</span>{' '}
            <strong>{forcedModel === 'auto' ? 'Auto' : forcedModel.toUpperCase()}</strong>
          </span>
        </div>
      </div>

      {/* Model comparison */}
      {results.ranking && results.ranking.length > 0 && (
        <div className="ui-panel p-4">
          <h4 className="font-semibold text-[var(--ui-text)] mb-3 text-sm">Comparaison des modèles</h4>
          <div className="overflow-x-auto border rounded" style={{ borderColor: 'var(--ui-border)' }}>
            <table className="ui-table text-xs w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left">Modèle</th>
                  <th className="p-2 ui-th-num">AIC</th>
                  <th className="p-2 ui-th-num">BIC</th>
                  <th className="p-2 ui-th-num">HQIC</th>
                  <th className="p-2 ui-th-num">Lag</th>
                  <th className="p-2 text-center">Sélectionné</th>
                </tr>
              </thead>
              <tbody className="ui-num">
                {results.ranking.map(model => (
                  <tr key={model.model}>
                    <td className="p-2 font-medium">{model.model.toUpperCase()}</td>
                    <td className="p-2 ui-td-num">{model.aic?.toFixed(1) ?? '—'}</td>
                    <td className="p-2 ui-td-num">{model.bic?.toFixed(1) ?? '—'}</td>
                    <td className="p-2 ui-td-num">
                      {'hqic' in model ? (model as any).hqic?.toFixed(1) : '—'}
                    </td>
                    <td className="p-2 ui-td-num">
                      {'lag_order' in model ? (model as any).lag_order : '—'}
                    </td>
                    <td className="p-2 text-center">
                      {model.model === results.best_model ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                      ) : (
                        <span className="ui-t-muted">—</span>
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
        <div className="ui-panel p-4">
          <h4 className="font-semibold text-surface-100 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-accent-400" />
            Adéquation des modèles
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(results.model_suitability).map(([name, suit]) => (
              <div
                key={name}
                className={`p-3 rounded-lg border text-sm ${
                  suit.recommended
                    ? 'border-emerald-500/35 bg-emerald-500/10'
                    : suit.suitable
                    ? 'border-white/10 bg-surface-800/40'
                    : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-surface-100">{name.toUpperCase()}</span>
                  {suit.recommended && (
                    <span className="text-xs text-emerald-400 font-bold">Recommandé</span>
                  )}
                  {!suit.suitable && <span className="text-xs text-red-400">Non adapté</span>}
                </div>
                <p className="text-xs text-surface-400">{suit.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.johansen_cointegration?.assumption_valid === false &&
        results.johansen_cointegration?.assumption_message && (
          <div className="ui-panel p-3.5 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-surface-200">
                {results.johansen_cointegration.assumption_message}
              </p>
            </div>
          </div>
        )}

      {results.methodological_pivot && (
        <div className="ui-panel p-4 bg-sky-500/10 border-sky-500/30">
          <p className="text-xs font-semibold text-sky-400 uppercase tracking-wide mb-2">
            Pivot méthodologique appliqué
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-surface-200">
            <p>
              VAR : mode demandé <strong>{results.methodological_pivot.var_data_mode}</strong> →
              régime appliqué <strong>{results.methodological_pivot.applied_var_regime}</strong>
            </p>
            <p>
              Trend VAR : <strong>{results.methodological_pivot.var_trend || 'c'}</strong>
            </p>
            <p>
              Granger : mode demandé{' '}
              <strong>{results.methodological_pivot.granger_data_mode}</strong> → régime
              appliqué <strong>{results.methodological_pivot.applied_granger_regime}</strong>
            </p>
            <p>
              Forçage modèle : <strong>{results.methodological_pivot.forced_model || 'aucun'}</strong>
            </p>
            <p className="ui-num">
              Ordres d'intégration :{' '}
              <strong>
                {integrationOrders.map(([k, v]) => `${k}=I(${v})`).join(', ') || 'n/a'}
              </strong>
            </p>
          </div>
          {results.methodological_pivot.integration_interpretation && (
            <p className="text-xs text-sky-300 mt-2">
              {results.methodological_pivot.integration_interpretation}
            </p>
          )}
          {results.methodological_pivot.reason && (
            <p className="text-xs text-surface-300 mt-2">{results.methodological_pivot.reason}</p>
          )}
        </div>
      )}

      {/* Stationarity per variable */}
      <div className="ui-panel p-4">
        <h4 className="font-semibold text-surface-100 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Stationnarité par variable
        </h4>
        <div className="space-y-2">
          {results.value_cols.map(col => {
            const st = results.stationarity[col];
            if (!st) return null;
            return (
              <div key={col} className="flex items-center justify-between p-3 bg-surface-800/40 border border-white/10 rounded-lg">
                <span className="font-medium text-surface-100">{col}</span>
                <div className="flex items-center gap-3 text-sm">
                  <span className={st.is_stationary ? 'text-emerald-400' : 'text-amber-400'}>
                    {st.is_stationary ? 'Stationnaire' : 'Non-stationnaire'}
                  </span>
                  <span className="text-surface-400 text-xs">{st.conclusion}</span>
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
                className="ui-btn text-xs bg-amber-500/15 text-amber-400 border-amber-500/35 hover:bg-amber-500/25 disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
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
                className="ui-btn text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Revenir en niveaux (déjà stationnaire)
                {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}

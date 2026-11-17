import React from 'react';
import { MultiForecastChart } from './MultiForecastChart';
import type { MultivariateTimeSeriesResults } from '../../types';

interface MultivariateModelsTabProps {
  results: MultivariateTimeSeriesResults;
  selectedModel: string | null;
  setSelectedModel: (model: string) => void;
  currentModel: any;
  displayGranularity: 'auto' | 'day' | 'month' | 'year';
}

export function MultivariateModelsTab(props: MultivariateModelsTabProps) {
  const {
    results,
    selectedModel,
    setSelectedModel,
    currentModel,
    displayGranularity,
  } = props;

  return (
    <div className="space-y-4">
      {/* Model selector */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(results.models).map(([key, model]) => (
          <button
            key={key}
            onClick={() => setSelectedModel(key)}
            className={`ui-btn text-xs ${
              selectedModel === key
                ? 'ui-btn-primary'
                : model.error
                ? 'border-red-500/35 text-red-400'
                : ''
            }`}
          >
            {key.toUpperCase()}
            {model.error && <span className="ml-1">!</span>}
          </button>
        ))}
      </div>

      {/* Selected model details */}
      {currentModel && (
        <div className="space-y-4">
          {currentModel.error && (
            <div className="ui-panel p-3 border border-red-500/35 bg-red-500/10 text-red-400 text-xs">
              {currentModel.error}
            </div>
          )}

          {!currentModel.error && (
            <>
              <div className="ui-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold text-[var(--ui-text)] text-sm">
                    {selectedModel?.toUpperCase()} — Détails
                  </h4>
                  <div className="flex flex-wrap gap-4 text-xs ui-num">
                    <span><span className="ui-t-muted">AIC :</span> <strong>{currentModel.aic?.toFixed(1) ?? '—'}</strong></span>
                    <span><span className="ui-t-muted">BIC :</span> <strong>{currentModel.bic?.toFixed(1) ?? '—'}</strong></span>
                    <span><span className="ui-t-muted">HQIC :</span> <strong>{currentModel.hqic?.toFixed(1) ?? '—'}</strong></span>
                    <span><span className="ui-t-muted">Lag :</span> <strong>{currentModel.lag_order ?? '—'}</strong></span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {currentModel.coint_rank != null && (
                    <span className="ui-tag ui-tag-accent ui-num">
                      Rang de cointégration : {currentModel.coint_rank}
                    </span>
                  )}
                  {currentModel.data_regime && (
                    <span className="ui-t-muted">
                      Régime : <strong>{currentModel.data_regime}</strong>
                    </span>
                  )}
                </div>
              </div>

              {currentModel.cointegration_vectors &&
                Object.keys(currentModel.cointegration_vectors).length > 0 && (
                  <div className="ui-panel p-4">
                    <h4 className="font-semibold text-[var(--ui-text)] mb-3 text-sm">Vecteurs de cointégration</h4>
                    <div className="overflow-x-auto">
                      <table className="ui-table text-xs w-full">
                        <thead>
                          <tr>
                            <th className="p-2 text-left">Vecteur</th>
                            {currentModel.variables.map((v: string) => (
                              <th key={v} className="p-2 ui-th-num">
                                {v}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(currentModel.cointegration_vectors).map(
                            ([name, vec]: [string, any]) => (
                              <tr key={name}>
                                <td className="p-2 font-medium">{name}</td>
                                {currentModel.variables.map((v: string) => (
                                  <td key={v} className="p-2 ui-td-num">
                                    {vec[v]?.toFixed(4)}
                                  </td>
                                ))}
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {currentModel.bounds_test && !currentModel.bounds_test.error && (
                <div className="ui-panel p-3 border border-teal-500/35 bg-teal-500/10 text-xs space-y-1.5 ui-num">
                  <p className="font-semibold text-teal-400">Bounds Test (Pesaran, Shin &amp; Smith)</p>
                  <div className="flex flex-wrap gap-4">
                    <span>
                      <span className="ui-t-muted">F-stat :</span>{' '}
                      <strong>{currentModel.bounds_test.f_statistic?.toFixed(3)}</strong>
                    </span>
                    <span>
                      <span className="ui-t-muted">p-value :</span>{' '}
                      <strong>
                        {currentModel.bounds_test.p_value != null
                          ? currentModel.bounds_test.p_value.toFixed(4)
                          : 'n/a'}
                      </strong>
                    </span>
                    <span
                      className={
                        currentModel.bounds_test.cointegration_detected
                          ? 'text-emerald-400 font-semibold'
                          : 'text-amber-400 font-semibold'
                      }
                    >
                      {currentModel.bounds_test.cointegration_detected
                        ? 'Cointégration détectée'
                        : 'Pas de cointégration'}
                    </span>
                  </div>
                  <p className="ui-t-secondary">{currentModel.bounds_test.conclusion}</p>
                </div>
              )}

              {currentModel.bvar_hyperparameters && (
                <div className="flex gap-2 ui-num text-xs">
                  <span className="ui-tag ui-tag-warning">λ₁ = {currentModel.bvar_hyperparameters.lambda1}</span>
                  <span className="ui-tag ui-tag-warning">λ₂ = {currentModel.bvar_hyperparameters.lambda2}</span>
                </div>
              )}

              {currentModel.pairs && currentModel.pairs.length > 0 && (
                <div className="ui-panel p-4">
                  <p className="text-xs font-medium ui-t-muted mb-2 ui-num">
                    Paires bivariées ({currentModel.n_pairs} paires) :
                  </p>
                  <div className="overflow-x-auto">
                    <table className="ui-table text-xs w-full">
                      <thead>
                        <tr>
                          <th className="p-2 text-left">Paire</th>
                          <th className="p-2 ui-th-num">Lag</th>
                          <th className="p-2 ui-th-num">AIC</th>
                          <th className="p-2 text-left">Granger significatif</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentModel.pairs.map((p: any, i: number) => (
                          <tr key={i}>
                            <td className="p-2 font-medium">{p.variables.join(' ↔ ')}</td>
                            <td className="p-2 ui-td-num">{p.lag_order ?? '—'}</td>
                            <td className="p-2 ui-td-num">{p.aic?.toFixed(1) ?? '—'}</td>
                            <td className="p-2">
                              {p.error ? (
                                <span className="text-red-400">{p.error}</span>
                              ) : p.granger_significant?.length ? (
                                p.granger_significant.map((g: string, j: number) => (
                                  <span key={j} className="ui-tag ui-tag-success mr-1">
                                    {g}
                                  </span>
                                ))
                              ) : (
                                <span className="ui-t-muted">aucun</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <MultiForecastChart model={currentModel} granularity={displayGranularity} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

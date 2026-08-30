import React from 'react';
import { InfoCard } from './InfoCard';
import { MultiForecastChart } from './MultiForecastChart';
import type { MultivariateTimeSeriesResults } from '../../types';

interface MultivariateModelsTabProps {
  results: MultivariateTimeSeriesResults;
  selectedModel: string | null;
  setSelectedModel: (model: string) => void;
  currentModel: any;
  displayGranularity: 'auto' | 'day' | 'month' | 'year';
}

export function MultivariateModelsTab({
  results,
  selectedModel,
  setSelectedModel,
  currentModel,
  displayGranularity,
}: MultivariateModelsTabProps) {
  return (
    <div className="space-y-4">
      {/* Model selector */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(results.models).map(([key, model]) => (
          <button
            key={key}
            onClick={() => setSelectedModel(key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedModel === key
                ? 'bg-primary-600 text-white'
                : model.error
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {key.toUpperCase()}
            {model.error && <span className="ml-1">WARN</span>}
          </button>
        ))}
      </div>

      {/* Selected model details */}
      {currentModel && (
        <div className="space-y-4">
          {currentModel.error && (
            <div className="card bg-red-50 border-red-200">
              <p className="text-red-700 text-sm">{currentModel.error}</p>
            </div>
          )}

          {!currentModel.error && (
            <>
              <div className="card">
                <h4 className="font-semibold text-gray-900 mb-3">
                  {selectedModel?.toUpperCase()} — Détails
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <InfoCard label="AIC" value={currentModel.aic?.toFixed(1) ?? '—'} />
                  <InfoCard label="BIC" value={currentModel.bic?.toFixed(1) ?? '—'} />
                  <InfoCard label="HQIC" value={currentModel.hqic?.toFixed(1) ?? '—'} />
                  <InfoCard label="Ordre de lag" value={String(currentModel.lag_order ?? '—')} />
                </div>

                {currentModel.coint_rank != null && (
                  <div className="mb-4">
                    <span className="badge bg-cyan-100 text-cyan-800">
                      Rang de cointégration : {currentModel.coint_rank}
                    </span>
                  </div>
                )}

                {currentModel.data_regime && (
                  <div className="mb-4">
                    <span className="text-sm text-gray-600">
                      Régime de données : <strong>{currentModel.data_regime}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Cointegration vectors (VECM) */}
              {currentModel.cointegration_vectors &&
                Object.keys(currentModel.cointegration_vectors).length > 0 && (
                  <div className="card">
                    <h4 className="font-semibold text-gray-900 mb-3">Vecteurs de cointégration</h4>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-2 text-left">Vecteur</th>
                            {currentModel.variables.map((v: string) => (
                              <th key={v} className="p-2 text-right">
                                {v}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(currentModel.cointegration_vectors).map(
                            ([name, vec]: [string, any]) => (
                              <tr key={name} className="border-t border-gray-100">
                                <td className="p-2 font-medium">{name}</td>
                                {currentModel.variables.map((v: string) => (
                                  <td key={v} className="p-2 text-right font-mono">
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

              {/* ARDL Bounds Test */}
              {currentModel.bounds_test && !currentModel.bounds_test.error && (
                <div className="mb-4 p-3 rounded-lg border border-teal-200 bg-teal-50">
                  <p className="text-xs font-semibold text-teal-800 mb-2">
                    Bounds Test (Pesaran, Shin & Smith)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <div className="text-xs">
                      <span className="text-gray-500">F-stat:</span>{' '}
                      <span className="font-mono font-bold">
                        {currentModel.bounds_test.f_statistic?.toFixed(3)}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">p-value:</span>{' '}
                      <span className="font-mono font-bold">
                        {currentModel.bounds_test.p_value != null
                          ? currentModel.bounds_test.p_value.toFixed(4)
                          : 'n/a'}
                      </span>
                    </div>
                    <div
                      className={`text-xs font-bold ${
                        currentModel.bounds_test.cointegration_detected
                          ? 'text-green-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {currentModel.bounds_test.cointegration_detected
                        ? 'Cointégration détectée'
                        : 'Pas de cointégration'}
                    </div>
                  </div>
                  <p className="text-xs text-teal-700">{currentModel.bounds_test.conclusion}</p>
                </div>
              )}

              {/* BVAR hyperparameters */}
              {currentModel.bvar_hyperparameters && (
                <div className="mb-4 flex gap-3">
                  <span className="badge bg-orange-100 text-orange-700">
                    λ₁ = {currentModel.bvar_hyperparameters.lambda1}
                  </span>
                  <span className="badge bg-orange-100 text-orange-700">
                    λ₂ = {currentModel.bvar_hyperparameters.lambda2}
                  </span>
                </div>
              )}

              {/* Pairwise VAR pairs */}
              {currentModel.pairs && currentModel.pairs.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Paires bivariées ({currentModel.n_pairs} paires) :
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left">Paire</th>
                          <th className="p-2 text-right">Lag</th>
                          <th className="p-2 text-right">AIC</th>
                          <th className="p-2 text-left">Granger significatif</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentModel.pairs.map((p: any, i: number) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="p-2 font-medium">{p.variables.join(' ↔ ')}</td>
                            <td className="p-2 text-right font-mono">{p.lag_order ?? '—'}</td>
                            <td className="p-2 text-right font-mono">{p.aic?.toFixed(1) ?? '—'}</td>
                            <td className="p-2">
                              {p.error ? (
                                <span className="text-red-500">{p.error}</span>
                              ) : p.granger_significant?.length ? (
                                p.granger_significant.map((g: string, j: number) => (
                                  <span
                                    key={j}
                                    className="badge bg-green-100 text-green-700 mr-1"
                                  >
                                    {g}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400">aucun</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Multivariate forecast chart */}
              <MultiForecastChart model={currentModel} granularity={displayGranularity} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

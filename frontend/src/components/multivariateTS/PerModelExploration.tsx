import { TrendingUp, ArrowLeft, Play, CheckCircle2, AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import type { MultivariateTimeSeriesResults } from '../../types';
import { IRFGrid } from '../viz';
import { InfoCard } from './InfoCard';
import { MultiForecastChart } from './MultiForecastChart';
import { MODEL_DEFS } from './constants';
import type { PerModelConfig, PerModelRun } from './usePerModelExploration';

interface Props {
  datasetId: string;
  dateCol: string;
  valueCols: string[];
  forecastSteps: number;
  onBack: () => void;
  onSwitchToUnified: () => void;
  activeModelTab: string;
  setActiveModelTab: (tab: string) => void;
  perModelResults: Record<string, PerModelRun>;
  perModelConfigs: Record<string, PerModelConfig>;
  runningModel: string | null;
  isRunningAll: boolean;
  displayGranularity: 'auto' | 'day' | 'month' | 'year';
  setDisplayGranularity: (g: 'auto' | 'day' | 'month' | 'year') => void;
  completedCount: number;
  activeConfig: PerModelConfig;
  activeRun: PerModelRun | undefined;
  updateModelConfig: (model: string, field: keyof PerModelConfig, value: string | number) => void;
  runSingleModel: (modelKey: string) => Promise<void>;
  runAllModels: () => Promise<void>;
}

export function PerModelExploration({
  dateCol,
  valueCols,
  forecastSteps,
  onBack,
  onSwitchToUnified,
  activeModelTab,
  setActiveModelTab,
  perModelResults,
  perModelConfigs,
  runningModel,
  isRunningAll,
  displayGranularity,
  setDisplayGranularity,
  completedCount,
  activeConfig,
  activeRun,
  updateModelConfig,
  runSingleModel,
  runAllModels,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent-400" />
          Exploration par modèle
        </h3>
        <div className="flex gap-2">
          <button onClick={onSwitchToUnified} className="btn-secondary text-sm">
            Mode unifié
          </button>
          <button onClick={onBack} className="btn-secondary text-sm flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="card py-3">
        <p className="text-sm">
          Variables : <strong>{valueCols.join(', ')}</strong> — Date : <strong>{dateCol}</strong> — Horizon : <strong>{forecastSteps}</strong> pas
        </p>
      </div>

      {/* Run all + granularity */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runAllModels}
          disabled={!!runningModel || isRunningAll}
          className="btn-primary flex items-center gap-2"
        >
          {isRunningAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isRunningAll ? `En cours : ${runningModel?.toUpperCase() ?? '…'}` : 'Tout lancer séquentiellement'}
        </button>
        {completedCount > 0 && (
          <span className="text-sm text-surface-400">{completedCount}/{MODEL_DEFS.length} terminés</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-surface-400">Granularité :</span>
          <select
            value={displayGranularity}
            onChange={(e) => setDisplayGranularity(e.target.value as any)}
            className="text-xs"
            title="Granularité temporelle"
          >
            <option value="auto">Auto</option>
            <option value="day">Jour</option>
            <option value="month">Mois</option>
            <option value="year">Année</option>
          </select>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg overflow-x-auto bg-white/[0.04]">
        {MODEL_DEFS.map(({ key, label }) => {
          const run = perModelResults[key];
          const isDone = !!run?.results;
          const hasError = !!run?.error && !run?.results;
          const isRunning = runningModel === key;
          return (
            <button
              key={key}
              onClick={() => setActiveModelTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                activeModelTab === key
                  ? 'bg-surface-700 text-accent-300 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {isRunning && <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-400" />}
              {isDone && !isRunning && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              {hasError && !isRunning && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              {label}
            </button>
          );
        })}
        <button
          onClick={() => setActiveModelTab('summary')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
            activeModelTab === 'summary'
              ? 'bg-surface-700 text-accent-300 shadow-sm'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Résumé
        </button>
      </div>

      {/* ── Model tab content ── */}
      {activeModelTab !== 'summary' && (
        <div className="space-y-4">
          {/* Config */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold">{MODEL_DEFS.find(m => m.key === activeModelTab)?.label}</h4>
                <p className="text-xs text-surface-400">{MODEL_DEFS.find(m => m.key === activeModelTab)?.desc}</p>
              </div>
              <button
                onClick={() => runSingleModel(activeModelTab)}
                disabled={!!runningModel}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {runningModel === activeModelTab ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> En cours…
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Lancer
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['var', 'vecm', 'bvar', 'pairwise_var', 'varmax'].includes(activeModelTab) && (
                <label className="text-sm text-surface-300">
                  Régime des données
                  <select
                    value={activeConfig.data_mode || 'auto'}
                    onChange={(e) => updateModelConfig(activeModelTab, 'data_mode', e.target.value)}
                    className="mt-1 w-full"
                    title="Régime des données"
                  >
                    <option value="auto">Auto</option>
                    <option value="levels">Niveaux</option>
                    <option value="diff">Différences</option>
                  </select>
                </label>
              )}
              {activeModelTab === 'var' && (
                <label className="text-sm text-surface-300">
                  Tendance
                  <select
                    value={activeConfig.trend || 'c'}
                    onChange={(e) => updateModelConfig('var', 'trend', e.target.value)}
                    className="mt-1 w-full"
                    title="Tendance déterministe"
                  >
                    <option value="c">c (constante)</option>
                    <option value="ct">ct (constante + tendance)</option>
                    <option value="ctt">ctt (+ quadratique)</option>
                    <option value="n">n (aucune)</option>
                  </select>
                </label>
              )}
              {activeModelTab === 'ardl' && (
                <label className="text-sm text-surface-300">
                  Variable dépendante
                  <select
                    value={activeConfig.target_col || ''}
                    onChange={(e) => updateModelConfig('ardl', 'target_col', e.target.value)}
                    className="mt-1 w-full"
                    title="Variable dépendante ARDL"
                  >
                    <option value="">Première variable</option>
                    {valueCols.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {activeModelTab === 'bvar' && (
                <>
                  <label className="text-sm text-surface-300">
                    λ₁ (tightness)
                    <input
                      type="number"
                      min={0.01}
                      max={1}
                      step={0.05}
                      value={activeConfig.lambda1 ?? 0.2}
                      onChange={(e) => updateModelConfig('bvar', 'lambda1', Number(e.target.value))}
                      className="mt-1 w-full"
                      title="Lambda 1"
                    />
                  </label>
                  <label className="text-sm text-surface-300">
                    λ₂ (cross-variable)
                    <input
                      type="number"
                      min={0.01}
                      max={1}
                      step={0.05}
                      value={activeConfig.lambda2 ?? 0.5}
                      onChange={(e) => updateModelConfig('bvar', 'lambda2', Number(e.target.value))}
                      className="mt-1 w-full"
                      title="Lambda 2"
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Loading */}
          {runningModel === activeModelTab && (
            <div className="card p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-accent-400/20 border-t-accent-400 rounded-full mx-auto" />
              <p className="text-surface-400 mt-4">
                Estimation {MODEL_DEFS.find(m => m.key === activeModelTab)?.label}…
              </p>
            </div>
          )}

          {/* Error */}
          {activeRun?.error && !activeRun.results && runningModel !== activeModelTab && (
            <div className="card p-4 border-red-500/30">
              <p className="text-red-400 text-sm">{activeRun.error}</p>
            </div>
          )}

          {/* Results */}
          {activeRun?.results && runningModel !== activeModelTab && (() => {
            const res = activeRun.results!;
            const modelData = res.models?.[activeModelTab];
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <InfoCard label="Observations" value={String(res.n_observations)} />
                  <InfoCard
                    label="Stationnaires"
                    value={res.all_stationary ? 'Oui' : 'Non'}
                    color={res.all_stationary ? 'text-green-600' : 'text-amber-600'}
                  />
                  <InfoCard label="AIC" value={modelData?.aic?.toFixed(1) ?? '—'} />
                  <InfoCard label="BIC" value={modelData?.bic?.toFixed(1) ?? '—'} />
                  <InfoCard label="Lag" value={String(modelData?.lag_order ?? '—')} />
                </div>

                {modelData?.error && (
                  <div className="card p-4 border-red-500/30">
                    <p className="text-red-400 text-sm">{modelData.error}</p>
                  </div>
                )}

                {modelData && !modelData.error && (
                  <>
                    <div className="card">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {modelData.data_regime && (
                          <span className="badge bg-accent-400/10 text-accent-300 border border-accent-400/20">
                            Régime: {modelData.data_regime}
                          </span>
                        )}
                        {modelData.var_trend && (
                          <span className="badge bg-secondary-400/10 text-secondary-300 border border-secondary-400/20">
                            Trend: {modelData.var_trend}
                          </span>
                        )}
                        {modelData.hqic != null && (
                          <span className="badge bg-secondary-400/10 text-secondary-300 border border-secondary-400/20">
                            HQIC: {modelData.hqic.toFixed(2)}
                          </span>
                        )}
                        {modelData.coint_rank != null && (
                          <span className="badge bg-accent-400/10 text-accent-300 border border-accent-400/20">
                            Rang coint.: {modelData.coint_rank}
                          </span>
                        )}
                      </div>
                      <MultiForecastChart model={modelData} granularity={displayGranularity} />
                    </div>

                    {modelData.irf && !modelData.irf.error && (() => {
                      const cells = modelData.irf!.variables.flatMap((impulse) =>
                        modelData.irf!.variables.map((response) => {
                          const values = modelData.irf!.data[impulse]?.[response];
                          return values
                            ? { shock: impulse, response, values: values.map(v => v ?? 0) }
                            : null;
                        })
                      ).filter((c): c is { shock: string; response: string; values: number[] } => c !== null);
                      return (
                        <div className="card">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-accent-400" />
                            IRF — {modelData.irf!.periods} périodes
                          </h4>
                          <IRFGrid cells={cells} title="" />
                        </div>
                      );
                    })()}
                  </>
                )}

                {res.recommendation && (
                  <div className="card border-blue-500/20">
                    <div className="flex items-start gap-2">
                      {/* eslint-disable-next-line jsx-a11y/aria-props */}
                      <span className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" aria-role="img" aria-label="info">Info</span>
                      <p className="text-sm text-blue-300">{res.recommendation}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Summary tab ── */}
      {activeModelTab === 'summary' && (
        <div className="card">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Comparaison des modèles
          </h4>
          {Object.keys(perModelResults).length === 0 ? (
            <p className="text-surface-400 text-sm">Lancez au moins un modèle pour voir la comparaison.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead>
                    <tr>
                      <th className="p-2 text-left">Modèle</th>
                      <th className="p-2 text-right">AIC</th>
                      <th className="p-2 text-right">BIC</th>
                      <th className="p-2 text-right">HQIC</th>
                      <th className="p-2 text-right">Lag</th>
                      <th className="p-2 text-center">Régime</th>
                      <th className="p-2 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODEL_DEFS.map(({ key, label }) => {
                      const run = perModelResults[key];
                      if (!run)
                        return (
                          <tr key={key}>
                            <td className="p-2 font-medium text-surface-500">{label}</td>
                            <td colSpan={6} className="p-2 text-center text-surface-500 text-xs">
                              Non lancé
                            </td>
                          </tr>
                        );
                      const modelData = run.results?.models?.[key];
                      if (run.error && !modelData)
                        return (
                          <tr key={key}>
                            <td className="p-2 font-medium text-red-400">{label}</td>
                            <td colSpan={6} className="p-2 text-red-400 text-xs truncate max-w-xs">
                              {run.error}
                            </td>
                          </tr>
                        );
                      return (
                        <tr
                          key={key}
                          className="cursor-pointer hover:bg-surface-800/50"
                          onClick={() => setActiveModelTab(key)}
                        >
                          <td className="p-2 font-medium">{label}</td>
                          <td className="p-2 text-right font-mono">{modelData?.aic?.toFixed(1) ?? '—'}</td>
                          <td className="p-2 text-right font-mono">{modelData?.bic?.toFixed(1) ?? '—'}</td>
                          <td className="p-2 text-right font-mono">{modelData?.hqic?.toFixed(1) ?? '—'}</td>
                          <td className="p-2 text-right font-mono">{modelData?.lag_order ?? '—'}</td>
                          <td className="p-2 text-center text-xs">{modelData?.data_regime ?? '—'}</td>
                          <td className="p-2 text-center">
                            {modelData?.error ? (
                              <AlertTriangle className="w-4 h-4 text-red-400 inline" />
                            ) : modelData ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                            ) : (
                              <span className="text-surface-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(() => {
                const valid = MODEL_DEFS.filter(({ key }) => {
                  const m = perModelResults[key]?.results?.models?.[key];
                  return m && !m.error && m.aic != null;
                })
                  .map(({ key, label }) => ({
                    key,
                    label,
                    aic: perModelResults[key].results!.models[key]!.aic!,
                  }))
                  .sort((a, b) => a.aic - b.aic);
                if (valid.length >= 2) {
                  return (
                    <div className="mt-4 p-3 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-300">
                        <strong>Meilleur modèle (AIC) :</strong> {valid[0].label} — AIC = {valid[0].aic.toFixed(1)}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}

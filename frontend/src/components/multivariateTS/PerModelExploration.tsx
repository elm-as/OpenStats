import React from 'react';
import {
  TrendingUp,
  ArrowLeft,
  Play,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { MODEL_DEFS } from './constants';
import { MultiForecastChart } from './MultiForecastChart';
import { IRFGrid } from '../viz';
import { PerModelConfigForm } from './PerModelConfigForm';
import { PerModelSummaryTable } from './PerModelSummaryTable';
import type {
  PerModelConfig,
  PerModelRun,
} from './usePerModelExploration';

interface Props {
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
          Variables : <strong>{valueCols.join(', ')}</strong> — Date : <strong>{dateCol}</strong> — Horizon :{' '}
          <strong>{forecastSteps}</strong> pas
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
          <span className="text-sm text-surface-400">
            {completedCount}/{MODEL_DEFS.length} terminés
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-surface-400">Granularité :</span>
          <select
            value={displayGranularity}
            onChange={e => setDisplayGranularity(e.target.value as any)}
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
          <PerModelConfigForm
            activeModelTab={activeModelTab}
            activeConfig={activeConfig}
            valueCols={valueCols}
            runningModel={runningModel}
            onRunSingleModel={runSingleModel}
            onUpdateModelConfig={updateModelConfig}
          />

          {runningModel === activeModelTab && (
            <div className="card p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-accent-400/20 border-t-accent-400 rounded-full mx-auto" />
              <p className="text-surface-400 mt-4">
                Estimation {MODEL_DEFS.find(m => m.key === activeModelTab)?.label}…
              </p>
            </div>
          )}

          {activeRun?.error && !activeRun.results && runningModel !== activeModelTab && (
            <div className="card p-4 border-red-500/30">
              <p className="text-red-400 text-sm">{activeRun.error}</p>
            </div>
          )}

          {activeRun?.results && runningModel !== activeModelTab && (() => {
            const res = activeRun.results!;
            const modelData = res.models?.[activeModelTab];
            return (
              <div className="space-y-4">
                {modelData && (
                  <>
                    <div className="card">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {modelData.aic != null && (
                          <span className="badge bg-accent-400/10 text-accent-300 border border-accent-400/20">
                            AIC: {modelData.aic.toFixed(2)}
                          </span>
                        )}
                        {modelData.bic != null && (
                          <span className="badge bg-secondary-400/10 text-secondary-300 border border-secondary-400/20">
                            BIC: {modelData.bic.toFixed(2)}
                          </span>
                        )}
                        {modelData.lag_order != null && (
                          <span className="badge bg-surface-700 text-surface-200">
                            Lag: {modelData.lag_order}
                          </span>
                        )}
                        {modelData.data_regime && (
                          <span className="badge bg-surface-700 text-surface-200">
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
                      const cells = modelData.irf!.variables.flatMap(impulse =>
                        modelData.irf!.variables.map(response => {
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
        <PerModelSummaryTable
          perModelResults={perModelResults}
          onSelectModelTab={setActiveModelTab}
        />
      )}
    </div>
  );
}

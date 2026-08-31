import React from 'react';
import { ArrowLeft, ChevronLeft, Sparkles } from 'lucide-react';
import type { AnalysisCapability } from '../../types';
import { StationarityBadge } from './HypothesisResultsView';
import { getModelsForType } from './WizardTypes';

interface WizardConfigureStepProps {
  selectedAnalysis: AnalysisCapability;
  selectedCategory: string | null;
  configValues: Record<string, string>;
  setConfigValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedModels: string[];
  setSelectedModels: React.Dispatch<React.SetStateAction<string[]>>;
  candidateTargets: any[];
  capabilities: any;
  allColumns: string[];
  excludedSet: Set<string>;
  pipelineDetection?: any;
  error: string | null;
  isLoading: boolean;
  onBack: () => void;
  onRun: () => void;
}

export function WizardConfigureStep({
  selectedAnalysis,
  configValues,
  setConfigValues,
  selectedModels,
  setSelectedModels,
  candidateTargets,
  capabilities,
  allColumns,
  excludedSet,
  pipelineDetection,
  error,
  isLoading,
  onBack,
  onRun,
}: WizardConfigureStepProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{selectedAnalysis.label}</h2>
          <p className="text-sm text-surface-400 mt-1">{selectedAnalysis.description}</p>
        </div>
        <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Configuration</h3>

        {/* Hypothesis / standard test config fields */}
        {selectedAnalysis.config_fields && selectedAnalysis.config_fields.length > 0 && (
          <div className="space-y-4">
            {selectedAnalysis.config_fields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                {field.type === 'multiselect' ? (
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                    {field.options.length === 0 && (
                      <p className="text-xs text-surface-500">Aucune option disponible</p>
                    )}
                    {field.options.map(opt => {
                      const selected = (configValues[field.key] || '').split(',').filter(Boolean);
                      const isChecked = selected.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-surface-900"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...selected, opt]
                                : selected.filter(s => s !== opt);
                              setConfigValues({ ...configValues, [field.key]: next.join(',') });
                            }}
                            className="rounded border-gray-300 text-primary-600"
                          />
                          {opt}
                        </label>
                      );
                    })}
                    {(configValues[field.key] || '').split(',').filter(Boolean).length > 0 && (
                      <p className="text-xs text-primary-600 mt-1">
                        {(configValues[field.key] || '').split(',').filter(Boolean).length} sélectionnée(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <select
                    value={configValues[field.key] || ''}
                    onChange={e => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    title={field.key}
                  >
                    <option value="">Sélectionner...</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stationarity insight badge for timeseries analyses */}
        {(selectedAnalysis.key === 'timeseries' || selectedAnalysis.key === 'timeseries_multivariate') &&
          pipelineDetection?.profile?.stationarity_summary &&
          pipelineDetection.profile.stationarity_summary !== 'unknown' && (
            <StationarityBadge
              summary={pipelineDetection.profile.stationarity_summary}
              orders={pipelineDetection.profile.integration_orders ?? {}}
              cointegrationLikely={pipelineDetection.profile.cointegration_likely ?? false}
              configCol={configValues.value_col ?? configValues.value_cols?.split(',')[0]}
            />
          )}

        {/* Modeling config */}
        {selectedAnalysis.category === 'modeling' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variable cible (Y)
              </label>
              {candidateTargets.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className="text-xs text-surface-400 self-center">Suggestions IA :</span>
                  {candidateTargets.slice(0, 5).map(c => (
                    <button
                      key={c.column}
                      type="button"
                      onClick={() => setConfigValues({ ...configValues, target_column: c.column })}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        configValues.target_column === c.column
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100'
                      }`}
                    >
                      {c.column}
                      <span className="ml-1 opacity-60">{c.type}</span>
                    </button>
                  ))}
                </div>
              )}
              <select
                value={configValues.target_column || ''}
                onChange={e => setConfigValues({ ...configValues, target_column: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                title="Variable cible"
              >
                <option value="">Sélectionner la variable à prédire...</option>
                {Array.from(
                  new Set([
                    ...(selectedAnalysis.applicable_columns || []),
                    ...allColumns.filter(c => !excludedSet.has(c)),
                  ])
                ).map(col => (
                  <option key={col} value={col}>
                    {col}
                    {capabilities?.column_groups[col]
                      ? ` (${capabilities.column_groups[col]} classes)`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stratégie de scission train / test
              </label>
              <select
                value={configValues.split_strategy || 'auto'}
                onChange={e => setConfigValues({ ...configValues, split_strategy: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                title="Stratégie de scission"
              >
                <option value="auto">Automatique (temporelle si index temporel détecté)</option>
                <option value="time">Scission temporelle (out-of-time, données chronologiques)</option>
                <option value="random">Scission aléatoire (cross-section standard / shuffle)</option>
              </select>
              <p className="text-xs text-surface-400 mt-1">
                En présence d'une forte tendance ou d'une série sans retards explicatifs, la scission aléatoire permet d'évaluer la représentativité globale sans biais de dérive temporelle.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Algorithmes (vide = tous)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {getModelsForType(selectedAnalysis.key).map(m => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-surface-900"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(m.key)}
                      onChange={e => {
                        if (e.target.checked) setSelectedModels([...selectedModels, m.key]);
                        else setSelectedModels(selectedModels.filter(k => k !== m.key));
                      }}
                      className="rounded border-gray-300 text-primary-600"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={onBack} className="btn-secondary flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" /> Retour
          </button>
          <button
            onClick={onRun}
            disabled={isLoading}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Calcul en cours...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Lancer l'analyse
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

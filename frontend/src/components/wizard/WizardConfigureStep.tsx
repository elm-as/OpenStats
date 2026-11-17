import React from 'react';
import { ArrowLeft, ChevronLeft, Play, Loader2 } from 'lucide-react';
import type { AnalysisCapability } from '../../types';
import { StationarityBadge } from './HypothesisResultsView';
import { getModelsForType } from './WizardTypes';
import { HelpTip } from '../ui/Tooltip';

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

export function WizardConfigureStep(props: WizardConfigureStepProps) {
  const { selectedAnalysis, configValues, setConfigValues } = props;

  return (
    <div className="space-y-3">
      <div className="ui-panel px-3 py-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>
            {selectedAnalysis.label}
          </span>
          {selectedAnalysis.description && (
            <span className="text-xs ui-t-muted ml-2 hidden md:inline">
              — {selectedAnalysis.description}
            </span>
          )}
        </div>
        <button onClick={props.onBack} className="ui-btn ui-focusable text-xs shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      </div>

      <section className="ui-panel p-3 space-y-3">
        {selectedAnalysis.config_fields && selectedAnalysis.config_fields.length > 0 && (
          <div className="space-y-3">
            {selectedAnalysis.config_fields.map(field => (
              <div key={field.key}>
                <label className="ui-label block mb-1">{field.label}</label>
                {field.type === 'multiselect' ? (
                  <div
                    className="ui-panel p-2 max-h-44 overflow-y-auto ui-scroll space-y-1"
                    style={{ background: 'var(--ui-bg-sunken)' }}
                  >
                    {field.options.length === 0 && (
                      <p className="text-xs ui-t-muted">Aucune option disponible</p>
                    )}
                    {field.options.map(opt => {
                      const selected = (configValues[field.key] || '').split(',').filter(Boolean);
                      const isChecked = selected.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex items-center gap-2 text-xs cursor-pointer px-1.5 py-1 rounded-[var(--ui-radius-sm)] hover:bg-white/5"
                          style={{ color: 'var(--ui-text)' }}
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
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                    {(configValues[field.key] || '').split(',').filter(Boolean).length > 0 && (
                      <p className="text-xs ui-t-accent ui-num pt-1">
                        {(configValues[field.key] || '').split(',').filter(Boolean).length} sélectionnée(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <select
                    value={configValues[field.key] || ''}
                    onChange={e => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                    className="ui-select w-full"
                    title={field.key}
                  >
                    <option value="">Sélectionner…</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}

        {(selectedAnalysis.key === 'timeseries' || selectedAnalysis.key === 'timeseries_multivariate') &&
          props.pipelineDetection?.profile?.stationarity_summary &&
          props.pipelineDetection.profile.stationarity_summary !== 'unknown' && (
            <StationarityBadge
              summary={props.pipelineDetection.profile.stationarity_summary}
              orders={props.pipelineDetection.profile.integration_orders ?? {}}
              cointegrationLikely={props.pipelineDetection.profile.cointegration_likely ?? false}
              configCol={configValues.value_col ?? configValues.value_cols?.split(',')[0]}
            />
          )}

        {selectedAnalysis.key.startsWith('modeling_') && (
          <div className="space-y-3">
            <div>
              <label className="ui-label block mb-1">Variable cible (Y)</label>
              {props.candidateTargets.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className="text-xs ui-t-muted self-center">Suggestions :</span>
                  {props.candidateTargets.slice(0, 5).map(c => (
                    <button
                      key={c.column}
                      type="button"
                      onClick={() => setConfigValues({ ...configValues, target_column: c.column })}
                      className={`ui-tag cursor-pointer ${
                        configValues.target_column === c.column ? 'ui-tag-accent font-semibold' : 'ui-tag-neutral'
                      }`}
                    >
                      {c.column}
                      <span className="ml-1 opacity-70">{c.type}</span>
                    </button>
                  ))}
                </div>
              )}
              <select
                value={configValues.target_column || ''}
                onChange={e => setConfigValues({ ...configValues, target_column: e.target.value })}
                className="ui-select w-full"
                title="Variable cible"
              >
                <option value="">Sélectionner la variable à prédire…</option>
                {Array.from(
                  new Set([
                    ...(selectedAnalysis.applicable_columns || []),
                    ...props.allColumns.filter(c => !props.excludedSet.has(c)),
                  ])
                ).map(col => (
                  <option key={col} value={col}>
                    {col}
                    {props.capabilities?.column_groups[col]
                      ? ` (${props.capabilities.column_groups[col]} classes)`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="ui-label flex items-center gap-1.5 mb-1">
                <span>Stratégie de séparation train / test</span>
                <HelpTip
                  label="Stratégie train/test"
                  content="Automatique privilégie un découpage chronologique lorsqu'un axe temporel existe ; le découpage aléatoire évite les biais de dérive lorsque la série suit une tendance non stationnaire sans retards explicatifs."
                />
              </label>
              <select
                value={configValues.split_strategy || 'auto'}
                onChange={e => setConfigValues({ ...configValues, split_strategy: e.target.value })}
                className="ui-select w-full"
                title="Stratégie train/test"
              >
                <option value="auto">Automatique (temporelle si axe temps détecté)</option>
                <option value="time">Chronologique (out-of-time)</option>
                <option value="random">Mélange aléatoire (observations indépendantes)</option>
              </select>
            </div>

            <div>
              <label className="ui-label block mb-1.5">Algorithmes (vide = tous)</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {getModelsForType(selectedAnalysis.key).map(m => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-[var(--ui-radius-sm)] hover:bg-white/5"
                    style={{ color: 'var(--ui-text)' }}
                  >
                    <input
                      type="checkbox"
                      checked={props.selectedModels.includes(m.key)}
                      onChange={e => {
                        if (e.target.checked) props.setSelectedModels([...props.selectedModels, m.key]);
                        else props.setSelectedModels(props.selectedModels.filter(k => k !== m.key));
                      }}
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {props.error && (
          <div
            className="p-2.5 rounded-[var(--ui-radius-sm)] text-xs ui-t-danger"
            style={{ background: 'var(--ui-danger-soft)', border: '1px solid var(--ui-danger)' }}
          >
            {props.error}
          </div>
        )}

        <div className="pt-1 flex gap-2">
          <button onClick={props.onBack} className="ui-btn ui-focusable text-xs">
            <ChevronLeft className="w-3.5 h-3.5" /> Retour
          </button>
          <button
            onClick={props.onRun}
            disabled={props.isLoading}
            className="ui-btn ui-btn-primary ui-focusable text-xs"
          >
            {props.isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calcul en cours…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Exécuter l&apos;analyse
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

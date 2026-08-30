import React from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { MODEL_DEFS } from './constants';
import type { PerModelConfig } from './usePerModelExploration';

interface PerModelConfigFormProps {
  activeModelTab: string;
  activeConfig: PerModelConfig;
  valueCols: string[];
  runningModel: string | null;
  onRunSingleModel: (modelKey: string) => void;
  onUpdateModelConfig: (
    model: string,
    field: keyof PerModelConfig,
    value: string | number
  ) => void;
}

export function PerModelConfigForm({
  activeModelTab,
  activeConfig,
  valueCols,
  runningModel,
  onRunSingleModel,
  onUpdateModelConfig,
}: PerModelConfigFormProps) {
  const modelDef = MODEL_DEFS.find(m => m.key === activeModelTab);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold">{modelDef?.label}</h4>
          <p className="text-xs text-surface-400">{modelDef?.desc}</p>
        </div>
        <button
          onClick={() => onRunSingleModel(activeModelTab)}
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
              onChange={e => onUpdateModelConfig(activeModelTab, 'data_mode', e.target.value)}
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
              onChange={e => onUpdateModelConfig('var', 'trend', e.target.value)}
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
              onChange={e => onUpdateModelConfig('ardl', 'target_col', e.target.value)}
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
                onChange={e =>
                  onUpdateModelConfig('bvar', 'lambda1', Number(e.target.value))
                }
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
                onChange={e =>
                  onUpdateModelConfig('bvar', 'lambda2', Number(e.target.value))
                }
                className="mt-1 w-full"
                title="Lambda 2"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

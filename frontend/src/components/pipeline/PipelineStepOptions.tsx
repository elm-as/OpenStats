import React from 'react';
import type { EditableStep } from './PipelineTypes';

interface PipelineStepOptionsProps {
  step: EditableStep;
  stepIdx: number;
  onUpdateStepParam: (idx: number, key: string, value: any) => void;
}

export function PipelineStepOptions({
  step,
  stepIdx,
  onUpdateStepParam,
}: PipelineStepOptionsProps) {
  return (
    <div className="mt-3.5 pt-3.5 border-t border-white/10 space-y-3 animate-fade-in bg-black/30 p-4 rounded-xl">
      {step.operation === 'model' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1.5">
              Algorithmes en compétition
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'linear_regression', label: 'Régression Linéaire' },
                { key: 'ridge', label: 'Ridge (L2)' },
                { key: 'lasso', label: 'Lasso (L1)' },
                { key: 'random_forest', label: 'Random Forest' },
                { key: 'gradient_boosting', label: 'Gradient Boosting' },
              ].map(m => {
                const currentKeys: string[] = Array.isArray(step.params.model_keys)
                  ? step.params.model_keys
                  : [];
                const isIncluded = currentKeys.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      const next = isIncluded
                        ? currentKeys.filter(k => k !== m.key)
                        : [...currentKeys, m.key];
                      onUpdateStepParam(stepIdx, 'model_keys', next.length > 0 ? next : [m.key]);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      isIncluded
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : 'bg-white/5 border-white/10 text-surface-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
                Stratégie de Validation
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateStepParam(stepIdx, 'cv_strategy', 'timeseries')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    (step.params.cv_strategy || 'timeseries') === 'timeseries'
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-white/5 border-white/10 text-surface-400'
                  }`}
                >
                  ⏱️ TimeSeriesSplit
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStepParam(stepIdx, 'cv_strategy', 'kfold')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    step.params.cv_strategy === 'kfold'
                      ? 'bg-accent-500/20 border-accent-500/40 text-accent-300'
                      : 'bg-white/5 border-white/10 text-surface-400'
                  }`}
                >
                  🎯 K-Fold
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
                Nombre de Folds
              </label>
              <div className="flex gap-2">
                {[3, 5, 10].map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onUpdateStepParam(stepIdx, 'cv_folds', f)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      (step.params.cv_folds || 5) === f
                        ? 'bg-accent-500/20 border-accent-500 text-accent-300'
                        : 'bg-white/5 border-white/10 text-surface-400'
                    }`}
                  >
                    {f} folds
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step.operation === 'timeseries' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
              Horizon de prévision futur
            </label>
            <div className="flex gap-2">
              {[3, 5, 10, 12, 24].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onUpdateStepParam(stepIdx, 'forecast_steps', h)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    (step.params.forecast_steps || 10) === h
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-white/5 border-white/10 text-surface-400'
                  }`}
                >
                  {h} pas
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step.operation === 'timeseries_multivariate' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
              Architecture du modèle multivarié
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'auto', label: '🤖 Auto-Sélection' },
                { key: 'var', label: 'VAR (Vecteur Auto-régressif)' },
                { key: 'vecm', label: 'VECM (Cointégration)' },
                { key: 'ardl', label: 'ARDL (Ordres Mixtes)' },
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() =>
                    onUpdateStepParam(stepIdx, 'forced_model', m.key === 'auto' ? undefined : m.key)
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    (step.params.forced_model || 'auto') === m.key
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-white/5 border-white/10 text-surface-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step.operation === 'correlation' && (
        <div>
          <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
            Type de coefficient
          </label>
          <div className="flex gap-2">
            {[
              { key: 'pearson', label: 'Pearson (Linéaire)' },
              { key: 'spearman', label: 'Spearman (Rangs)' },
              { key: 'kendall', label: 'Kendall (Tau)' },
            ].map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => onUpdateStepParam(stepIdx, 'method', m.key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  (step.params.method || 'pearson') === m.key
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'bg-white/5 border-white/10 text-surface-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step.operation === 'report' && (
        <div>
          <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
            Format du document
          </label>
          <div className="flex gap-2">
            {[
              { key: 'pdf', label: '📑 Document PDF Haute Définition' },
              { key: 'docx', label: '📝 Document Microsoft Word (.docx)' },
            ].map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => onUpdateStepParam(stepIdx, 'format', m.key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  (step.params.format || 'pdf') === m.key
                    ? 'bg-accent-500/20 border-accent-500 text-accent-300'
                    : 'bg-white/5 border-white/10 text-surface-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

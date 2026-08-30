import { NodeProps, Node } from '@xyflow/react';
import { Eraser } from 'lucide-react';
import { CanvasNodeData, NodeShell, NodeLabel, useNodeUpdate } from './_shared';

const CLEANING_ACTIONS = [
  { key: 'drop_duplicates', label: 'Supprimer les doublons' },
  { key: 'drop_high_missing', label: 'Supprimer colonnes >50% null' },
  { key: 'drop_near_constant', label: 'Supprimer quasi-constantes' },
] as const;

const NA_FILL_ACTIONS = [
  { key: 'none', label: 'Ignorer les NaN' },
  { key: 'drop_nulls', label: 'Supprimer lignes avec NaN' },
  { key: 'fill_mean', label: 'Imputer par la moyenne' },
  { key: 'fill_median', label: 'Imputer par la mediane' },
  { key: 'fill_knn', label: 'Imputer KNN' },
] as const;

const OUTLIER_ACTIONS = [
  { key: 'none_outliers', label: 'Ignorer les outliers' },
  { key: 'winsorize_1_99', label: 'Winsorisation (1% - 99%)' },
  { key: 'iqr_clipping', label: 'Ecretage IQR [Q1-1.5IQR, Q3+1.5IQR]' },
] as const;

export function CleaningNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';

  const rawActions = data.actions;
  const actionsList: string[] = Array.isArray(rawActions)
    ? rawActions
    : typeof rawActions === 'string'
    ? rawActions.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const selectedActions = new Set(actionsList);

  const toggleAction = (key: string) => {
    const next = new Set(selectedActions);
    if (next.has(key)) {
      if (key === 'drop_nulls' && selectedActions.has('fill_mean')) next.delete('fill_mean');
      if (key === 'drop_nulls' && selectedActions.has('fill_median')) next.delete('fill_median');
      if (key === 'drop_nulls' && selectedActions.has('fill_knn')) next.delete('fill_knn');
      if (key === 'winsorize_1_99' || key === 'iqr_clipping') {
        next.delete('winsorize_1_99');
        next.delete('iqr_clipping');
      }
      next.delete(key);
    } else {
      if (
        key === 'drop_nulls' ||
        key === 'fill_mean' ||
        key === 'fill_median' ||
        key === 'fill_knn'
      ) {
        next.delete('drop_nulls');
        next.delete('fill_mean');
        next.delete('fill_median');
        next.delete('fill_knn');
      }
      if (key === 'winsorize_1_99' || key === 'iqr_clipping') {
        next.delete('winsorize_1_99');
        next.delete('iqr_clipping');
      }
      next.add(key);
    }
    if (data.onChange) {
      data.onChange(id, 'actions', Array.from(next).join(','));
    }
  };

  const naFillActive = NA_FILL_ACTIONS.filter(
    a => a.key !== 'none' && selectedActions.has(a.key)
  )[0];
  const hasNaNHandling = !!naFillActive;

  const outlierActive = OUTLIER_ACTIONS.filter(
    a => a.key !== 'none_outliers' && selectedActions.has(a.key)
  )[0];
  const hasOutlierHandling = !!outlierActive;

  return (
    <NodeShell
      id={id}
      data={data}
      color="#f59e0b"
      icon={Eraser}
      title="Nettoyage"
      hasInput
    >
      <div className="flex items-center justify-between">
        <NodeLabel>Mode</NodeLabel>
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? selectedActions.size + ' action(s)' : 'Auto'}
        </span>
      </div>

      {!isAdvanced && (
        <p className="text-surface-400 text-[11px] leading-relaxed">
          Nettoyage automatique : doublons, imputation mediane & ecretage des outliers
          (1%-99%).
        </p>
      )}

      {isAdvanced && (
        <>
          <div className="space-y-1.5">
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">
              Operations
            </span>
            {CLEANING_ACTIONS.map(act => (
              <label key={act.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={selectedActions.has(act.key)}
                  onChange={() => toggleAction(act.key)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent-500"
                />
                <span className="text-[11px] text-surface-300">{act.label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">
              Valeurs manquantes
            </span>
            {NA_FILL_ACTIONS.map(act => (
              <label
                key={act.key}
                className={`flex items-center gap-2 cursor-pointer py-0.5 ${
                  act.key === 'none' && hasNaNHandling ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={
                    act.key === 'none' ? !hasNaNHandling : selectedActions.has(act.key)
                  }
                  onChange={() => {
                    if (act.key === 'none') {
                      if (hasNaNHandling) return;
                      if (data.onChange) {
                        const next = new Set(selectedActions);
                        ['drop_nulls', 'fill_mean', 'fill_median', 'fill_knn'].forEach(k =>
                          next.delete(k)
                        );
                        data.onChange(id, 'actions', Array.from(next).join(','));
                      }
                      return;
                    }
                    toggleAction(act.key);
                  }}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent-500"
                />
                <span className="text-[11px] text-surface-300">{act.label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">
              Outliers (Valeurs aberrantes)
            </span>
            {OUTLIER_ACTIONS.map(act => (
              <label
                key={act.key}
                className={`flex items-center gap-2 cursor-pointer py-0.5 ${
                  act.key === 'none_outliers' && hasOutlierHandling ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={
                    act.key === 'none_outliers'
                      ? !hasOutlierHandling
                      : selectedActions.has(act.key)
                  }
                  onChange={() => {
                    if (act.key === 'none_outliers') {
                      if (hasOutlierHandling) return;
                      if (data.onChange) {
                        const next = new Set(selectedActions);
                        ['winsorize_1_99', 'iqr_clipping'].forEach(k => next.delete(k));
                        data.onChange(id, 'actions', Array.from(next).join(','));
                      }
                      return;
                    }
                    toggleAction(act.key);
                  }}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent-500"
                />
                <span className="text-[11px] text-surface-300">{act.label}</span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-end">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only"
            checked={isAdvanced}
            onChange={e => {
              if (data.onChange) {
                data.onChange(id, 'mode', e.target.checked ? 'advanced' : 'auto');
                if (e.target.checked) {
                  data.onChange(
                    id,
                    'actions',
                    CLEANING_ACTIONS.map(a => a.key).join(',') +
                      ',fill_median,winsorize_1_99'
                  );
                }
              }
            }}
          />
          <div
            className={`w-8 h-4 rounded-full transition-colors ${
              isAdvanced ? 'bg-accent-500/60' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                isAdvanced ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </div>
          <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
            {isAdvanced ? 'Avance' : 'Auto'}
          </span>
        </label>
      </div>
    </NodeShell>
  );
}

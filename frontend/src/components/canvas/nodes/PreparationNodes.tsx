import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps, Node } from '@xyflow/react';
import { Type, Eraser, Wand2, Code2, Settings, X, AlertTriangle } from 'lucide-react';
import { 
  CanvasNodeData, NodeShell, NodeLabel, NodeSelect, NodeInput, 
  useNodeUpdate, useConnectedColumns, NodeMultiColumnInput 
} from './_shared';

export function TypingNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { dsId, dataset, columns } = useConnectedColumns(id);

  const rawOverrides = data.typeOverrides;
  const typeOverrides: Record<string, string> = (() => {
    if (!rawOverrides) return {};
    if (typeof rawOverrides === 'string') {
      try { return JSON.parse(rawOverrides); } catch { return {}; }
    }
    if (typeof rawOverrides === 'object') return rawOverrides as Record<string, string>;
    return {};
  })();

  const rawExcluded = data.excludedColumns;
  const excludedColumns: string[] = (() => {
    if (!rawExcluded) return [];
    if (typeof rawExcluded === 'string') {
      try { return JSON.parse(rawExcluded); } catch { return []; }
    }
    if (Array.isArray(rawExcluded)) return rawExcluded as string[];
    return [];
  })();

  const handleTypeChange = (col: string, newType: string) => {
    if (data.onChange) {
      data.onChange(id, 'typeOverrides', JSON.stringify({ ...typeOverrides, [col]: newType }));
    }
  };

  const handleToggleColumn = (col: string) => {
    if (!data.onChange) return;
    const newExcluded = excludedColumns.includes(col)
      ? excludedColumns.filter(c => c !== col)
      : [...excludedColumns, col];
    data.onChange(id, 'excludedColumns', JSON.stringify(newExcluded));
  };

  const activeCount = columns.length - excludedColumns.length;

  return (
    <NodeShell id={id} data={data} color="#6366f1" icon={Type} title="Detection de types" hasInput badge={dsId ? 'Connecte' : 'Auto'}>
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Detecte et corrige automatiquement les types statistiques des colonnes.
      </div>

      {dsId && columns.length > 0 && (
        <div className="mt-2 text-[10px] text-indigo-300/80 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/15">
          {activeCount}/{columns.length} colonnes actives — {Object.keys(typeOverrides).filter(k => typeOverrides[k] !== 'auto').length} override(s)
        </div>
      )}

      {excludedColumns.length > 0 && (
        <div className="mt-1 text-[9px] text-amber-400/80 bg-amber-500/10 p-2 rounded-lg border border-amber-500/15">
          {excludedColumns.length} colonne(s) exclue(s) : {excludedColumns.join(', ')}
        </div>
      )}

      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full mt-2 py-2 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-medium text-indigo-300 transition-colors flex items-center justify-center gap-2"
      >
        <Settings size={13} /> Configurer les types
      </button>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface-900 rounded-2xl shadow-2xl border border-white/[0.08] flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-surface-800/30 rounded-t-2xl shrink-0">
              <h3 className="text-sm font-bold text-surface-50 flex items-center gap-2">
                <Type size={16} className="text-indigo-400" /> Configuration des Types
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-surface-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-3">
              {!dsId ? (
                <div className="text-xs text-amber-400 bg-amber-400/10 p-4 rounded-xl border border-amber-400/20 flex items-center gap-3">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Connectez ce bloc a une <strong>Source de donnees</strong> (via une arete) pour voir les colonnes disponibles.</span>
                </div>
              ) : !dataset ? (
                <div className="flex items-center gap-3 text-xs text-surface-400 p-4">
                  <div className="w-4 h-4 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
                  Chargement du schema du dataset...
                </div>
              ) : columns.length === 0 ? (
                <div className="text-xs text-surface-400 p-4">Aucun dictionnaire disponible pour ce dataset.</div>
              ) : (
                <>
                  <p className="text-xs text-surface-400 mb-1">
                    Cliquez sur le toggle pour activer/desactiver une variable. Forcez un type si necessaire.
                  </p>
                  <p className="text-[10px] text-surface-500 mb-3">
                    {activeCount} active(s) / {excludedColumns.length} exclue(s)
                  </p>
                  <div className="space-y-1.5">
                    {columns.map((col: any) => {
                      const colName = typeof col === 'string' ? col : (col.nom_brut || col.name || '');
                      const detectedType = typeof col === 'string' ? '?' : (col.type_statistique || '?');
                      const overrideVal = typeOverrides[colName] || 'auto';
                      const isExcluded = excludedColumns.includes(colName);
                      return (
                        <div
                          key={colName}
                          className={`rounded-lg border transition-colors ${isExcluded ? 'bg-surface-800/20 border-white/[0.02] opacity-50' : 'bg-surface-800/40 border-white/[0.04] hover:border-white/[0.08]'}`}
                          style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', alignItems: 'center', gap: 10, padding: '8px 10px' }}
                        >
                          <button
                            onClick={() => handleToggleColumn(colName)}
                            className={`rounded-full relative transition-colors ${isExcluded ? 'bg-surface-700' : 'bg-emerald-500/70'}`}
                            title={isExcluded ? 'Activer cette variable' : 'Desactiver cette variable'}
                            style={{ width: 32, height: 18 }}
                          >
                            <div className={`absolute top-0.5 rounded-full bg-white shadow transition-transform ${isExcluded ? 'left-0.5' : 'left-[15px]'}`} style={{ width: 14, height: 14 }} />
                          </button>
                          <div style={{ overflow: 'hidden' }}>
                            <div className="text-xs font-bold text-surface-200" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {colName}
                            </div>
                            <div className="text-[9px] text-surface-500 mt-0.5">{detectedType}</div>
                          </div>
                          <select
                            value={overrideVal}
                            onChange={(e) => handleTypeChange(colName, e.target.value)}
                            disabled={isExcluded}
                            className="bg-surface-900 border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-surface-100 focus:outline-none focus:border-indigo-500/50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ width: 110 }}
                          >
                            <option value="auto">Auto</option>
                            <option value="continu">Continu</option>
                            <option value="discret">Discret</option>
                            <option value="binaire">Binaire</option>
                            <option value="catégoriel_nominal">Categoriel</option>
                            <option value="temporel">Temporel</option>
                            <option value="texte">Texte</option>
                            <option value="identifiant">Identifiant</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </NodeShell>
  );
}

const CLEANING_ACTIONS = [
  { key: 'drop_duplicates', label: 'Supprimer les doublons' },
  { key: 'drop_high_missing', label: 'Supprimer colonnes &gt;50% null' },
  { key: 'drop_near_constant', label: 'Supprimer quasi-constantes' },
] as const;

const NA_FILL_ACTIONS = [
  { key: 'none', label: 'Ignorer les NaN' },
  { key: 'drop_nulls', label: 'Supprimer lignes avec NaN' },
  { key: 'fill_mean', label: 'Imputer par la moyenne' },
  { key: 'fill_median', label: 'Imputer par la mediane' },
  { key: 'fill_knn', label: 'Imputer KNN' },
] as const;

export function CleaningNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';

  const rawActions = (data.actions as string) || '';
  const selectedActions = new Set(rawActions.split(',').map(s => s.trim()).filter(Boolean));

  const toggleAction = (key: string) => {
    const next = new Set(selectedActions);
    if (next.has(key)) {
      if (key === 'drop_nulls' && selectedActions.has('fill_mean')) next.delete('fill_mean');
      if (key === 'drop_nulls' && selectedActions.has('fill_median')) next.delete('fill_median');
      if (key === 'drop_nulls' && selectedActions.has('fill_knn')) next.delete('fill_knn');
      next.delete(key);
    } else {
      if (key === 'drop_nulls' || key === 'fill_mean' || key === 'fill_median' || key === 'fill_knn') {
        next.delete('drop_nulls');
        next.delete('fill_mean');
        next.delete('fill_median');
        next.delete('fill_knn');
      }
      next.add(key);
    }
    if (data.onChange) {
      data.onChange(id, 'actions', Array.from(next).join(','));
    }
  };

  const naFillActive = NA_FILL_ACTIONS.filter(a => a.key !== 'none' && selectedActions.has(a.key))[0];
  const hasNaNHandling = !!naFillActive;

  return (
    <NodeShell id={id} data={data} color="#f59e0b" icon={Eraser} title="Nettoyage" hasInput>
      <div className="flex items-center justify-between">
        <NodeLabel>Mode</NodeLabel>
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? selectedActions.size + ' action(s)' : 'Auto'}
        </span>
      </div>

      {!isAdvanced && (
        <p className="text-surface-400 text-[11px] leading-relaxed">
          Nettoyage automatique : doublons, colonnes &gt;50% null, quasi-constantes, imputation.
        </p>
      )}

      {isAdvanced && (
        <>
          <div className="space-y-1.5">
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">Operations</span>
            {CLEANING_ACTIONS.map((act) => (
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
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">Valeurs manquantes</span>
            {NA_FILL_ACTIONS.map((act) => (
              <label key={act.key} className={`flex items-center gap-2 cursor-pointer py-0.5 ${act.key === 'none' && hasNaNHandling ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={act.key === 'none' ? !hasNaNHandling : selectedActions.has(act.key)}
                  onChange={() => {
                    if (act.key === 'none') {
                      if (hasNaNHandling) return;
                      if (data.onChange) {
                        const next = new Set(selectedActions);
                        ['drop_nulls', 'fill_mean', 'fill_median', 'fill_knn'].forEach(k => next.delete(k));
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
            onChange={(e) => {
              if (data.onChange) {
                data.onChange(id, 'mode', e.target.checked ? 'advanced' : 'auto');
                if (e.target.checked) {
                  data.onChange(id, 'actions', CLEANING_ACTIONS.map(a => a.key).join(',') + ',fill_mean');
                }
              }
            }}
          />
          <div className={`w-8 h-4 rounded-full transition-colors ${isAdvanced ? 'bg-accent-500/60' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isAdvanced ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
            {isAdvanced ? 'Avance' : 'Auto'}
          </span>
        </label>
      </div>
    </NodeShell>
  );
}

const TRANSFORM_ACTIONS = [
  { key: 'standardize', label: 'Standardisation (Z-score)', group: 'Normalisation' },
  { key: 'normalize', label: 'Normalisation (Min-Max)', group: 'Normalisation' },
  { key: 'log', label: 'Transformation Logarithmique', group: 'Asymetrie' },
  { key: 'boxcox', label: 'Transformation Box-Cox', group: 'Asymetrie' },
  { key: 'sqrt', label: 'Racine carree', group: 'Asymetrie' },
  { key: 'winsorize', label: 'Winsorisation', group: 'Outliers' },
  { key: 'clip_iqr', label: 'Clip IQR', group: 'Outliers' },
  { key: 'diff', label: 'Differenciation (ordre 1)', group: 'Series temporelles' },
  { key: 'diff2', label: 'Differenciation (ordre 2)', group: 'Series temporelles' },
] as const;

const TRANSFORM_GROUPS = ['Normalisation', 'Asymetrie', 'Outliers', 'Series temporelles'] as const;

export function TransformNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';

  const rawActions = (data.actions as string) || '';
  const selectedActions = new Set(rawActions.split(',').map(s => s.trim()).filter(Boolean));

  const toggleAction = (key: string) => {
    const next = new Set(selectedActions);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    if (data.onChange) {
      data.onChange(id, 'actions', Array.from(next).join(','));
    }
  };

  const selectedCount = selectedActions.size;

  return (
    <NodeShell id={id} data={data} color="#ec4899" icon={Wand2} title="Transformation" hasInput>
      <div>
        <NodeLabel>Colonne(s) cible</NodeLabel>
        <NodeMultiColumnInput name="columns" placeholder="Toutes (auto)" value={(data.columns as string) || ''} onChange={handleChange} columns={columns} />
      </div>

      <div className="flex items-center justify-between">
        <NodeLabel>Operations</NodeLabel>
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? selectedCount + ' selectionnee(s)' : 'Auto'}
        </span>
      </div>

      {!isAdvanced && (
        <p className="text-surface-400 text-[11px] leading-relaxed">
          Recommandations automatiques selon le profil des colonnes selectionnees.
        </p>
      )}

      {isAdvanced && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {TRANSFORM_GROUPS.map((group) => {
            const groupActions = TRANSFORM_ACTIONS.filter(a => a.group === group);
            return (
              <div key={group}>
                <span className="text-[9px] text-surface-600 uppercase tracking-wider font-semibold">{group}</span>
                <div className="space-y-0.5 mt-1">
                  {groupActions.map((act) => (
                    <label key={act.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedActions.has(act.key)}
                        onChange={() => toggleAction(act.key)}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-pink-500"
                      />
                      <span className="text-[11px] text-surface-300">{act.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only"
            checked={isAdvanced}
            onChange={(e) => {
              if (data.onChange) {
                data.onChange(id, 'mode', e.target.checked ? 'advanced' : 'auto');
              }
            }}
          />
          <div className={`w-8 h-4 rounded-full transition-colors ${isAdvanced ? 'bg-accent-500/60' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isAdvanced ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
            {isAdvanced ? 'Avance' : 'Auto'}
          </span>
        </label>
      </div>
    </NodeShell>
  );
}

export function ComputeVariableNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell id={id} data={data} color="#a855f7" icon={Code2} title="Variable calculee" hasInput>
      <div>
        <NodeLabel>Nom de la colonne</NodeLabel>
        <NodeInput name="newColumn" placeholder="ex: ratio_prix" value={(data.newColumn as string) || ''} onChange={handleChange} />
      </div>
      <div>
        <NodeLabel>Formule Python</NodeLabel>
        <NodeInput name="formula" placeholder="col1 / col2 * 100" value={(data.formula as string) || ''} onChange={handleChange} />
      </div>
    </NodeShell>
  );
}

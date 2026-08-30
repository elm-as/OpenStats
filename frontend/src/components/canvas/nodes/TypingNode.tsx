import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps, Node } from '@xyflow/react';
import { Type, Settings, X, AlertTriangle } from 'lucide-react';
import { CanvasNodeData, NodeShell, useConnectedColumns } from './_shared';

export function TypingNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { dsId, dataset, columns, columnTypes } = useConnectedColumns(id);

  const rawOverrides = data.typeOverrides;
  const typeOverrides: Record<string, string> = (() => {
    if (!rawOverrides) return {};
    if (typeof rawOverrides === 'string') {
      try {
        return JSON.parse(rawOverrides);
      } catch {
        return {};
      }
    }
    if (typeof rawOverrides === 'object') return rawOverrides as Record<string, string>;
    return {};
  })();

  const rawExcluded = data.excludedColumns;
  const excludedColumns: string[] = (() => {
    if (!rawExcluded) return [];
    if (typeof rawExcluded === 'string') {
      try {
        return JSON.parse(rawExcluded);
      } catch {
        return [];
      }
    }
    if (Array.isArray(rawExcluded)) return rawExcluded as string[];
    return [];
  })();

  const handleTypeChange = (col: string, newType: string) => {
    if (data.onChange) {
      data.onChange(
        id,
        'typeOverrides',
        JSON.stringify({ ...typeOverrides, [col]: newType })
      );
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
    <NodeShell
      id={id}
      data={data}
      color="#6366f1"
      icon={Type}
      title="Detection de types"
      hasInput
      badge={dsId ? 'Connecte' : 'Auto'}
    >
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Detecte et corrige automatiquement les types statistiques des colonnes.
      </div>

      {dsId && columns.length > 0 && (
        <div className="mt-2 text-[10px] text-indigo-300/80 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/15">
          {activeCount}/{columns.length} colonnes actives —{' '}
          {Object.keys(typeOverrides).filter(k => typeOverrides[k] !== 'auto').length}{' '}
          override(s)
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

      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <div className="relative w-full max-w-lg bg-surface-900 rounded-2xl shadow-2xl border border-white/[0.08] flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-surface-800/30 rounded-t-2xl shrink-0">
                <h3 className="text-sm font-bold text-surface-50 flex items-center gap-2">
                  <Type size={16} className="text-indigo-400" /> Configuration des Types
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-surface-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-3">
                {!dsId ? (
                  <div className="text-xs text-amber-400 bg-amber-400/10 p-4 rounded-xl border border-amber-400/20 flex items-center gap-3">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>
                      Connectez ce bloc a une <strong>Source de donnees</strong> (via
                      une arete) pour voir les colonnes disponibles.
                    </span>
                  </div>
                ) : !dataset ? (
                  <div className="flex items-center gap-3 text-xs text-surface-400 p-4">
                    <div className="w-4 h-4 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
                    Chargement du schema du dataset...
                  </div>
                ) : columns.length === 0 ? (
                  <div className="text-xs text-surface-400 p-4">
                    Aucun dictionnaire disponible pour ce dataset.
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-surface-400 mb-1">
                      Cliquez sur le toggle pour activer/desactiver une variable. Forcez
                      un type si necessaire.
                    </p>
                    <p className="text-[10px] text-surface-500 mb-3">
                      {activeCount} active(s) / {excludedColumns.length} exclue(s)
                    </p>
                    <div className="space-y-1.5">
                      {columns.map((col: any) => {
                        const colName =
                          typeof col === 'string' ? col : col.nom_brut || col.name || '';
                        const detectedType = columnTypes?.[colName] || '?';
                        const overrideVal = typeOverrides[colName] || 'auto';
                        const isExcluded = excludedColumns.includes(colName);
                        return (
                          <div
                            key={colName}
                            className={`rounded-lg border transition-colors ${
                              isExcluded
                                ? 'bg-surface-800/20 border-white/[0.02] opacity-50'
                                : 'bg-surface-800/40 border-white/[0.04] hover:border-white/[0.08]'
                            }`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '36px 1fr auto',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 10px',
                            }}
                          >
                            <button
                              onClick={() => handleToggleColumn(colName)}
                              className={`rounded-full relative transition-colors ${
                                isExcluded ? 'bg-surface-700' : 'bg-emerald-500/70'
                              }`}
                              title={
                                isExcluded
                                  ? 'Activer cette variable'
                                  : 'Desactiver cette variable'
                              }
                              style={{ width: 32, height: 18 }}
                            >
                              <div
                                className={`absolute top-0.5 rounded-full bg-white shadow transition-transform ${
                                  isExcluded ? 'left-0.5' : 'left-[15px]'
                                }`}
                                style={{ width: 14, height: 14 }}
                              />
                            </button>
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                className="text-xs font-bold text-surface-200"
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {colName}
                              </div>
                              <div className="text-[9px] text-surface-500 mt-0.5">
                                {detectedType}
                              </div>
                            </div>
                            <select
                              value={overrideVal}
                              onChange={e => handleTypeChange(colName, e.target.value)}
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

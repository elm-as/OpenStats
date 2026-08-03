import React, { ChangeEvent, useState } from 'react';
import { Handle, Position, useNodes, useEdges } from '@xyflow/react';
import { useGetDatasetQuery } from '../../../store/api';
import { Trash2, Loader2, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';

export interface CanvasNodeData extends Record<string, unknown> {
  onChange?: (id: string, key: string, value: string) => void;
  onDelete?: (id: string) => void;
  [key: string]: unknown;
}

export function useNodeUpdate(id: string, data: CanvasNodeData) {
  return (e: ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
    if (data.onChange) {
      data.onChange(id, e.target.name, e.target.value);
    }
  };
}

function getNodeSummaryText(res: any): string | null {
  if (!res || typeof res !== 'object') return null;
  if (res.name && res.rows !== undefined) return `${res.name} (${res.rows.toLocaleString()} lg × ${res.columns} col)`;
  if (res.shape_after) return `${res.shape_after.rows.toLocaleString()} lg × ${res.shape_after.columns} col`;
  if (res.rows !== undefined && res.columns !== undefined) return `${res.rows.toLocaleString()} lg × ${res.columns} col`;
  if (res.best_model_name) return `Modèle : ${res.best_model_name}`;
  if (res.best_model_key) return `Modèle : ${res.best_model_key}`;
  if (res.model_selected) return `Modèle : ${res.model_selected}`;
  if (res.n_clusters !== undefined) return `${res.n_clusters} clusters (Silhouette : ${(res.silhouette ?? 0).toFixed(2)})`;
  if (res.p_value !== undefined) {
    const p = typeof res.p_value === 'number' ? (res.p_value < 0.001 ? '< 0.001' : res.p_value.toFixed(4)) : res.p_value;
    return `p-value : ${p} ${res.significant ? '(Significatif)' : ''}`;
  }
  if (res.statistic !== undefined) return `Statistique : ${typeof res.statistic === 'number' ? res.statistic.toFixed(2) : res.statistic}`;
  if (res.explained_variance_ratio) {
    const cum = res.cumulative_variance?.[1] ?? res.explained_variance_ratio[0] ?? 0;
    return `Variance cum. : ${(cum > 1 ? cum : cum * 100).toFixed(1)}%`;
  }
  if (res.chart_type) return `Graphique : ${res.chart_type}`;
  if (Array.isArray(res.insights)) return `${res.insights.length} insight(s)`;
  if (res.mean_outcome !== undefined) return `Moy. simulée : ${typeof res.mean_outcome === 'number' ? res.mean_outcome.toFixed(2) : res.mean_outcome}`;
  if (res.message && typeof res.message === 'string') return res.message;
  return null;
}

export function NodeShell({
  id,
  data,
  children,
  color,
  icon: Icon,
  title,
  hasInput = false,
  hasOutput = true,
  badge,
}: {
  id: string;
  data: CanvasNodeData;
  children: React.ReactNode;
  color: string;
  icon: React.ElementType;
  title: string;
  hasInput?: boolean;
  hasOutput?: boolean;
  badge?: string;
}) {
  const runStatus = data.runStatus as string | undefined;
  const runResult = data.runResult as any;
  const runError = data.runError as string | undefined;
  const onOpenResult = data.onOpenResult as ((id: string) => void) | undefined;
  
  let statusBorder = 'border-white/[0.08]';
  let shadowGlow = 'shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)] group-hover:shadow-[0_12px_50px_-8px_rgba(0,0,0,0.7)]';
  
  if (runStatus === 'processing') {
    statusBorder = 'border-accent-400 ring-1 ring-accent-400/50';
    shadowGlow = 'shadow-[0_0_20px_rgba(56,189,248,0.4)]';
  } else if (runStatus === 'success') {
    statusBorder = 'border-emerald-500 ring-1 ring-emerald-500/50';
    shadowGlow = 'shadow-[0_0_20px_rgba(16,185,129,0.3)]';
  } else if (runStatus === 'error') {
    statusBorder = 'border-red-500 ring-1 ring-red-500/50';
    shadowGlow = 'shadow-[0_0_20px_rgba(239,68,68,0.3)]';
  } else if (runStatus === 'skipped') {
    statusBorder = 'border-amber-500 ring-1 ring-amber-500/50';
  }

  const summaryText = runStatus === 'success' ? getNodeSummaryText(runResult) : null;

  return (
    <div
      className="relative group"
      style={{ minWidth: 260 }}
    >
      {hasInput && <Handle type="target" position={Position.Left} id="in" className="!w-3 !h-3 !bg-surface-300 !border-2 !border-surface-700 hover:!bg-accent-400 transition-colors" />}

      <div className={`rounded-2xl overflow-hidden bg-surface-900/90 backdrop-blur-2xl transition-all duration-300 border group-hover:border-white/[0.2] ${statusBorder} ${shadowGlow}`}>
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: `${color}20`, boxShadow: `0 0 20px ${color}15` }}
          >
            <Icon size={16} style={{ color }} />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-[13px] text-surface-100 tracking-wide truncate">{title}</span>
            {runStatus === 'processing' && <Loader2 size={14} className="text-accent-400 animate-spin shrink-0" />}
            {runStatus === 'success' && <CheckCircle2 size={14} className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] shrink-0" />}
            {runStatus === 'error' && <XCircle size={14} className="text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)] shrink-0" />}
            {runStatus === 'skipped' && <AlertCircle size={14} className="text-amber-400 shrink-0" />}
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {badge && (
              <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border" style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
                {badge}
              </span>
            )}
            {data?.onDelete && (
              <button
                onClick={() => data.onDelete!(id)}
                className="text-surface-400 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded-md transition-colors"
                title="Supprimer ce bloc"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3 text-[12px]">
          {children}

          {/* Banner de résultat dans le nœud */}
          {runStatus === 'success' && (
            <div className="mt-2 pt-2 border-t border-emerald-500/20 flex flex-col gap-1.5 bg-emerald-500/[0.04] -mx-4 -mb-3 px-4 py-2.5 rounded-b-2xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Résultat disponible
                </span>
                {onOpenResult && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenResult(id);
                    }}
                    className="text-[10px] font-bold text-accent-300 hover:text-white bg-accent-500/20 hover:bg-accent-500/40 px-2 py-0.5 rounded-md transition-colors border border-accent-500/30"
                  >
                    👁️ Voir détails
                  </button>
                )}
              </div>
              {summaryText && (
                <p className="text-[11px] font-medium text-surface-200 font-mono truncate">
                  {summaryText}
                </p>
              )}
            </div>
          )}

          {runStatus === 'error' && (
            <div className="mt-2 pt-2 border-t border-red-500/20 flex flex-col gap-1 bg-red-500/[0.04] -mx-4 -mb-3 px-4 py-2.5 rounded-b-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                <XCircle size={11} /> Erreur d'exécution
              </span>
              <p className="text-[11px] font-medium text-red-300/80 truncate">
                {runError || 'Une erreur est survenue lors de l\'exécution.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {hasOutput && <Handle type="source" position={Position.Right} id="out" className="!w-3 !h-3 !bg-surface-300 !border-2 !border-surface-700 hover:!bg-accent-400 transition-colors" />}
    </div>
  );
}

export function NodeLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-surface-400 text-[11px] font-semibold uppercase tracking-wider mb-1">{children}</label>;
}

export function NodeSelect({ name, value, onChange, children }: { name: string; value?: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) {
  return (
    <select
      name={name}
      defaultValue={value}
      onChange={onChange}
      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors appearance-none cursor-pointer"
    >
      {children}
    </select>
  );
}

export function NodeInput({ name, placeholder, value, onChange }: { name: string; placeholder: string; value?: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <input
      type="text"
      name={name}
      placeholder={placeholder}
      defaultValue={value}
      onChange={onChange}
      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium placeholder:text-surface-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors"
    />
  );
}

export function useConnectedColumns(id: string) {
  const allNodes = useNodes();
  const allEdges = useEdges();

  const walkBackwards = (): { dsId: string | null; excludedCols: Set<string>; typingNodeId: string | null } => {
    let currentId: string | null = id;
    const visited = new Set<string>();
    let dsId: string | null = null;
    let excludedCols: Set<string> = new Set();
    let typingNodeId: string | null = null;

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const node = allNodes.find(n => n.id === currentId);
      if (node) {
        if (node.type === 'typing') {
          typingNodeId = node.id;
          if (node.id !== id) {
            const raw = node.data?.excludedColumns;
            if (raw) {
              let parsed: string[] = [];
              if (typeof raw === 'string') {
                try { parsed = JSON.parse(raw); } catch { parsed = []; }
              } else if (Array.isArray(raw)) {
                parsed = raw as string[];
              }
              parsed.forEach(c => excludedCols.add(c));
            }
          }
        }
        if (node.type === 'dataset' && node.data?.file) {
          dsId = node.data.file as string;
          break;
        }
      }
      const parentEdge = allEdges.find(e => e.target === currentId);
      if (!parentEdge) break;
      currentId = parentEdge.source;
    }

    return { dsId, excludedCols, typingNodeId };
  };

  const { dsId, excludedCols, typingNodeId } = walkBackwards();
  const { data: dataset } = useGetDatasetQuery(dsId!, { skip: !dsId });

  const rawColumns: string[] = dataset?.profile?.dictionary?.map(
    (c: any) => typeof c === 'string' ? c : (c.nom_brut || '')
  ) || [];

  const columns = excludedCols.size > 0
    ? rawColumns.filter(c => !excludedCols.has(c))
    : rawColumns;

  const columnTypes: Record<string, string> = {};
  if (dataset?.profile?.dictionary) {
    const dtypes = dataset.profile?.dtypes || {};
    for (const entry of dataset.profile.dictionary) {
      const colName = typeof entry === 'string' ? entry : entry.nom_brut;
      if (typeof entry === 'string') {
        const dtype = dtypes[colName];
        columnTypes[colName] = dtype ? String(dtype).replace(/^(float|int)\d*$/, 'numerique').replace(/^(object|string|category)$/, 'categoriel').replace(/^(datetime|bool)$/, 'discret') : '?';
      } else {
        columnTypes[colName] = entry.type_statistique || (() => {
          const dtype = dtypes[colName];
          if (!dtype) return '?';
          const ds = String(dtype);
          if (/^(float|int)\d*$/.test(ds)) return 'numerique';
          if (/^(object|string|category)$/.test(ds)) return 'categoriel';
          if (/^datetime/.test(ds)) return 'temporel';
          if (/^bool/.test(ds)) return 'binaire';
          return ds;
        })();
      }
    }
  }

  return { dsId, dataset, columns, excludedCols, typingNodeId, columnTypes };
}

export function NodeColumnSelect({ name, value, onChange, columns, columnTypes, placeholder = "-- Sélectionner --" }: { name: string; value?: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; columns: string[], columnTypes?: Record<string, string>, placeholder?: string }) {
  const formatLabel = (col: string) => {
    const type = columnTypes?.[col];
    return type && type !== '?' ? `${col} (${type})` : col;
  };
  if (columns.length === 0) {
    return <NodeInput name={name} value={value} onChange={onChange as any} placeholder={placeholder} />;
  }
  return (
    <select
      name={name}
      value={value || ''}
      onChange={onChange}
      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors appearance-none cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {columns.map(c => <option key={c} value={c}>{formatLabel(c)}</option>)}
    </select>
  );
}

export function NodeMultiColumnInput({ name, value, onChange, columns, placeholder }: { name: string; value?: string; onChange: (e: any) => void; columns: string[], placeholder?: string }) {
  const currentValues = (value || '').split(',').map(s => s.trim()).filter(Boolean);
  
  const toggleColumn = (col: string) => {
    let newValues;
    if (currentValues.includes(col)) {
      newValues = currentValues.filter(c => c !== col);
    } else {
      newValues = [...currentValues, col];
    }
    onChange({ target: { name, value: newValues.join(', ') } });
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium placeholder:text-surface-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors"
      />
      {columns.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto custom-scrollbar p-1">
          {columns.map(col => (
             <button
               key={col}
               type="button"
               onClick={() => toggleColumn(col)}
               className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${currentValues.includes(col) ? 'bg-accent-500/20 border-accent-500/40 text-accent-300' : 'bg-white/5 border-white/10 text-surface-400 hover:bg-white/10 hover:text-surface-200'}`}
             >
               {col}
             </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NodeNumberInput({ name, value, onChange, placeholder, min, max, step = 1 }: { name: string; value?: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void; placeholder: string; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      name={name}
      placeholder={placeholder}
      defaultValue={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium placeholder:text-surface-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

export function NodeToggle({ value, onChange }: { value?: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  const isAdvanced = value === 'advanced';
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={isAdvanced}
          onChange={(e) => onChange({ target: { name: 'mode', value: e.target.checked ? 'advanced' : 'auto' } } as any)}
        />
        <div className={`w-8 h-4 rounded-full transition-colors ${isAdvanced ? 'bg-accent-500/60' : 'bg-white/10'}`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isAdvanced ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
        {isAdvanced ? 'Avancé' : 'Auto'}
      </span>
    </label>
  );
}

export function NodeCollapsible({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/[0.06] pt-2 mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-300 transition-colors py-1"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="space-y-3 mt-2">{children}</div>}
    </div>
  );
}

export function NodeSeedInput({ value, onChange }: { value?: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      <NodeLabel>Seed (reproductibilité)</NodeLabel>
      <div className="flex items-center gap-2">
        <NodeNumberInput name="seed" placeholder="Aléatoire" value={value} onChange={onChange} min={0} max={99999} />
        {!value && <span className="text-[9px] text-surface-600 shrink-0">aléatoire</span>}
        {value && <span className="text-[9px] text-accent-400 shrink-0">fixe</span>}
      </div>
    </div>
  );
}

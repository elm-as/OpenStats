import React, { ChangeEvent } from 'react';
import { Handle, Position, useNodes, useEdges } from '@xyflow/react';
import { useGetDatasetQuery } from '../../../store/api';
import {
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { resolveColumnTypes, resolveUpstreamContext } from './canvasColumnResolver';

export {
  NodeLabel,
  NodeSelect,
  NodeInput,
  NodeColumnSelect,
  NodeMultiColumnInput,
  NodeNumberInput,
  NodeToggle,
  NodeCollapsible,
  NodeSeedInput,
} from './NodeInputs';

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
  if (res.name && res.rows !== undefined) return `${res.name} (${res.rows.toLocaleString()} × ${res.columns})`;
  if (res.shape_after) return `${res.shape_after.rows.toLocaleString()} × ${res.shape_after.columns}`;
  if (res.rows !== undefined && res.columns !== undefined) return `${res.rows.toLocaleString()} × ${res.columns}`;
  if (res.best_model_name || res.best_model_key || res.model_selected) {
    return `Modèle : ${res.best_model_name || res.best_model_key || res.model_selected}`;
  }
  if (res.n_clusters !== undefined) return `${res.n_clusters} clusters (Silhouette ${(res.silhouette ?? 0).toFixed(2)})`;
  if (res.p_value !== undefined) {
    const p = typeof res.p_value === 'number' ? (res.p_value < 0.0001 ? '< 0.0001' : res.p_value.toFixed(4)) : res.p_value;
    return `p = ${p}${res.significant ? ' · significatif' : ''}`;
  }
  if (res.statistic !== undefined) return `Stat = ${typeof res.statistic === 'number' ? res.statistic.toFixed(2) : res.statistic}`;
  if (res.explained_variance_ratio) {
    const cum = res.cumulative_variance?.[1] ?? res.explained_variance_ratio[0] ?? 0;
    return `Variance : ${(cum > 1 ? cum : cum * 100).toFixed(1)}%`;
  }
  if (res.chart_type) return `Graphique : ${res.chart_type}`;
  if (Array.isArray(res.insights)) return `${res.insights.length} insight(s)`;
  if (res.mean_outcome !== undefined) return `Moy. : ${typeof res.mean_outcome === 'number' ? res.mean_outcome.toFixed(2) : res.mean_outcome}`;
  if (res.message && typeof res.message === 'string') return res.message;
  return null;
}

export interface NodeShellProps {
  id: string;
  data: CanvasNodeData;
  children: React.ReactNode;
  color: string;
  icon: React.ElementType;
  title: string;
  hasInput?: boolean;
  hasOutput?: boolean;
  badge?: string;
}

function getStatusAccent(status?: string): string {
  if (status === 'processing') return 'var(--ui-accent)';
  if (status === 'success') return 'var(--ui-success)';
  if (status === 'error') return 'var(--ui-danger)';
  if (status === 'skipped') return 'var(--ui-warning)';
  return 'var(--ui-border-strong)';
}

function StatusIcon({ status }: { status?: string }) {
  if (status === 'processing') return <Loader2 size={13} className="animate-spin shrink-0" style={{ color: 'var(--ui-accent)' }} />;
  if (status === 'success') return <CheckCircle2 size={13} className="shrink-0" style={{ color: 'var(--ui-success)' }} />;
  if (status === 'error') return <XCircle size={13} className="shrink-0" style={{ color: 'var(--ui-danger)' }} />;
  if (status === 'skipped') return <AlertCircle size={13} className="shrink-0" style={{ color: 'var(--ui-warning)' }} />;
  return null;
}

export function NodeShell(props: NodeShellProps) {
  const Icon = props.icon;
  const hasInput = props.hasInput ?? false;
  const hasOutput = props.hasOutput ?? true;
  const runStatus = props.data.runStatus as string | undefined;
  const runResult = props.data.runResult as any;
  const runError = props.data.runError as string | undefined;
  const onOpenResult = props.data.onOpenResult as ((id: string) => void) | undefined;
  const summaryText = runStatus === 'success' ? getNodeSummaryText(runResult) : null;

  return (
    <div className="relative group" style={{ minWidth: 248, maxWidth: 310 }}>
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="!w-2.5 !h-2.5 transition-colors"
          style={{ background: 'var(--ui-accent)', border: '2px solid var(--ui-bg-panel)' }}
        />
      )}

      <div
        className="ui-panel overflow-hidden transition-colors"
        style={{
          background: 'var(--ui-bg-panel)',
          borderColor: getStatusAccent(runStatus),
          color: 'var(--ui-text)',
        }}
      >
        <div className="h-[3px] w-full" style={{ background: props.color }} />

        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{
            background: 'var(--ui-bg-raised)',
            borderBottom: '1px solid var(--ui-border)',
          }}
        >
          <Icon size={14} className="shrink-0" style={{ color: props.color }} />
          <span
            className="font-semibold text-[12px] tracking-tight truncate"
            style={{ color: 'var(--ui-text)' }}
          >
            {props.title}
          </span>
          <StatusIcon status={runStatus} />
          {props.data?.onDelete && (
            <button
              type="button"
              onClick={() => props.data.onDelete!(props.id)}
              className="ml-auto p-1 rounded-[var(--ui-radius-sm)] transition-colors shrink-0 hover:text-red-500"
              style={{ color: 'var(--ui-text-faint)' }}
              title="Supprimer ce bloc"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        <div className="px-3 py-2.5 space-y-2.5 text-[12px]" style={{ color: 'var(--ui-text)' }}>
          {props.children}

          {runStatus === 'success' && (
            <div
              className="-mx-3 -mb-2.5 px-3 py-2 flex flex-col gap-1"
              style={{
                background: 'var(--ui-success-soft)',
                borderTop: '1px solid var(--ui-border)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                  style={{ color: 'var(--ui-success)' }}
                >
                  <CheckCircle2 size={11} /> Résultat prêt
                </span>
                {onOpenResult && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onOpenResult(props.id);
                    }}
                    className="ui-btn ui-btn-primary text-[10px]"
                    style={{ height: 22, padding: '0 8px' }}
                  >
                    Ouvrir
                  </button>
                )}
              </div>
              {summaryText && (
                <p className="text-[11px] ui-num truncate" style={{ color: 'var(--ui-text-secondary)' }}>
                  {summaryText}
                </p>
              )}
            </div>
          )}

          {runStatus === 'error' && (
            <div
              className="-mx-3 -mb-2.5 px-3 py-2 flex flex-col gap-1"
              style={{
                background: 'var(--ui-danger-soft)',
                borderTop: '1px solid var(--ui-border)',
              }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                style={{ color: 'var(--ui-danger)' }}
              >
                <XCircle size={11} /> Erreur
              </span>
              <p className="text-[11px] truncate" style={{ color: 'var(--ui-danger)' }}>
                {runError || "Une erreur est survenue lors de l'exécution."}
              </p>
            </div>
          )}
        </div>
      </div>

      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className="!w-2.5 !h-2.5 transition-colors"
          style={{ background: 'var(--ui-accent)', border: '2px solid var(--ui-bg-panel)' }}
        />
      )}
    </div>
  );
}

export function useConnectedColumns(id: string) {
  const allNodes = useNodes();
  const allEdges = useEdges();
  const { dsId, excludedCols, typingNodeId, dynamicCols } = resolveUpstreamContext(id, allNodes, allEdges);
  const { data: dataset } = useGetDatasetQuery(dsId!, { skip: !dsId });

  const rawColumns: string[] = [
    ...(dataset?.profile?.dictionary?.map((c: any) => (typeof c === 'string' ? c : c.nom_brut || '')) || []),
    ...Array.from(dynamicCols),
  ];
  const columns = excludedCols.size > 0 ? rawColumns.filter(c => !excludedCols.has(c)) : rawColumns;
  const columnTypes = resolveColumnTypes(dataset);

  return { dsId, dataset, columns, excludedCols, typingNodeId, columnTypes };
}

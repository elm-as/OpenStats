import React from 'react';
import type { Node } from '@xyflow/react';
import { CheckCircle2, XCircle, AlertCircle, Eye, X } from 'lucide-react';
import type { NodeResult } from './canvasGraphConfig';

interface CanvasPipelineResultsPanelProps {
  showResults: boolean;
  pipelineResults: Record<string, NodeResult> | null;
  nodes: Node[];
  summary: { total: number; success: number; error: number; skipped: number } | null;
  resolveNodeLabel: (nodeId: string) => string;
  onOpenGlobalReport: () => void;
  onOpenNodeResult: (nodeId: string, nodeType: string, nodeName: string, result: any) => void;
  onResetResults: () => void;
}

export function CanvasPipelineResultsPanel(props: CanvasPipelineResultsPanelProps) {
  const {
    showResults,
    pipelineResults,
    nodes,
    summary,
    resolveNodeLabel,
    onOpenGlobalReport,
    onOpenNodeResult,
    onResetResults,
  } = props;

  if (!showResults || !pipelineResults) return null;

  return (
    <div className="ui-panel absolute top-4 right-4 w-[380px] max-h-[calc(100vh-120px)] overflow-y-auto z-20 p-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center gap-2.5">
          {summary && summary.error > 0 ? (
            <XCircle size={16} className="text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          )}
          <div>
            <h3 className="text-xs font-bold text-[var(--ui-text)]">Résultats du Pipeline</h3>
            {summary && (
              <p className="text-[10px] ui-t-muted uppercase tracking-wider font-semibold mt-0.5 ui-num">
                {summary.success} OK · {summary.error > 0 ? `${summary.error} FAIL · ` : ''}
                {summary.skipped > 0 ? `${summary.skipped} SKIP` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onOpenGlobalReport} className="ui-btn text-[11px]">
            Rapport global
          </button>
          <button onClick={onResetResults} className="ui-btn ui-btn-ghost p-1" title="Fermer">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Global error */}
      {pipelineResults._global && (
        <div className="px-4 py-2.5 bg-red-500/10 border-b border-red-500/25">
          <p className="text-xs text-red-400 font-medium">{pipelineResults._global.error}</p>
        </div>
      )}

      {/* Per-node results */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto ui-scroll">
        {Object.entries(pipelineResults)
          .filter(([k]) => k !== '_global')
          .map(([nodeId, result]) => {
            const nodeName = resolveNodeLabel(nodeId);
            const nodeType = nodes.find(n => n.id === nodeId)?.type || '';
            const statusClass =
              result.status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25'
                : result.status === 'error'
                ? 'bg-red-500/10 border-red-500/25'
                : 'bg-amber-500/10 border-amber-500/25';

            return (
              <div
                key={nodeId}
                className={`px-3 py-2.5 rounded border flex items-start justify-between gap-2.5 ${statusClass}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {result.status === 'success' && (
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    )}
                    {result.status === 'error' && (
                      <XCircle size={13} className="text-red-400 shrink-0" />
                    )}
                    {result.status === 'skipped' && (
                      <AlertCircle size={13} className="text-amber-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-[var(--ui-text)] truncate">{nodeName}</span>
                  </div>
                  <p
                    className={`text-[11px] mt-1 ml-5 leading-snug ${
                      result.status === 'success'
                        ? 'ui-t-secondary'
                        : result.status === 'error'
                        ? 'text-red-400 font-medium'
                        : 'text-amber-400'
                    }`}
                  >
                    {result.message || result.error || 'Exécuté'}
                  </p>
                </div>

                {result.status === 'success' && result.result !== undefined && (
                  <button
                    onClick={() => onOpenNodeResult(nodeId, nodeType, nodeName, result.result)}
                    className="ui-btn ui-btn-ghost p-1 shrink-0"
                    title="Voir les résultats"
                  >
                    <Eye size={14} />
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

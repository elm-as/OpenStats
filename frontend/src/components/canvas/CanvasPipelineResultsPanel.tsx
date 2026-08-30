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

export function CanvasPipelineResultsPanel({
  showResults,
  pipelineResults,
  nodes,
  summary,
  resolveNodeLabel,
  onOpenGlobalReport,
  onOpenNodeResult,
  onResetResults,
}: CanvasPipelineResultsPanelProps) {
  if (!showResults || !pipelineResults) return null;

  return (
    <div className="absolute top-4 right-4 w-[380px] max-h-[calc(100vh-120px)] overflow-y-auto z-20 rounded-2xl card !p-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.01]">
        <div className="flex items-center gap-3">
          {summary && summary.error > 0 ? (
            <div className="w-8 h-8 rounded-xl bg-danger-50 flex items-center justify-center border border-danger/10">
              <XCircle size={16} className="text-danger" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center border border-green/10">
              <CheckCircle2 size={16} className="text-green-500" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-strong">Résultats du Pipeline</h3>
            {summary && (
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mt-0.5">
                {summary.success} OK · {summary.error > 0 ? `${summary.error} FAIL · ` : ''}
                {summary.skipped > 0 ? `${summary.skipped} SKIP` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenGlobalReport}
            className="text-accent-400 hover:text-accent-300 text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-accent-500/10 transition-colors border border-accent-500/10 shrink-0"
          >
            Rapport global
          </button>
          <button
            onClick={onResetResults}
            className="text-muted hover:text-strong text-xs font-semibold p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Global error */}
      {pipelineResults._global && (
        <div className="px-5 py-3 bg-danger-50 border-b border-danger/10">
          <p className="text-xs text-danger font-medium">{pipelineResults._global.error}</p>
        </div>
      )}

      {/* Per-node results */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {Object.entries(pipelineResults)
          .filter(([k]) => k !== '_global')
          .map(([nodeId, result]) => {
            const nodeName = resolveNodeLabel(nodeId);
            const nodeType = nodes.find(n => n.id === nodeId)?.type || '';

            return (
              <div
                key={nodeId}
                className={`px-4 py-3 rounded-xl border transition-all duration-200 flex items-start justify-between gap-3 ${
                  result.status === 'success'
                    ? 'bg-green-50/20 border-green/10 hover:border-green/20'
                    : result.status === 'error'
                    ? 'bg-danger-50/20 border-danger/10 hover:border-danger/20'
                    : 'bg-amber-50/20 border-amber/10 hover:border-amber/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {result.status === 'success' && (
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    )}
                    {result.status === 'error' && (
                      <XCircle size={14} className="text-danger shrink-0" />
                    )}
                    {result.status === 'skipped' && (
                      <AlertCircle size={14} className="text-amber shrink-0" />
                    )}
                    <span className="text-xs font-bold text-strong truncate">{nodeName}</span>
                  </div>
                  <p
                    className={`text-[11px] mt-1 ml-5 leading-relaxed ${
                      result.status === 'success'
                        ? 'text-default'
                        : result.status === 'error'
                        ? 'text-danger font-medium'
                        : 'text-amber'
                    }`}
                  >
                    {result.message || result.error || 'Exécuté avec succès'}
                  </p>
                </div>

                {result.status === 'success' && result.result !== undefined && (
                  <button
                    onClick={() =>
                      onOpenNodeResult(nodeId, nodeType, nodeName, result.result)
                    }
                    className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-muted hover:text-accent-400 hover:border-accent-500/30 transition-all shrink-0"
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

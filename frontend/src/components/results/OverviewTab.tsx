import React from 'react';
import { LayoutGrid, Target } from 'lucide-react';
import { StepStatusBadge } from './ResultAtoms';

export function OverviewTab({
  steps,
  execution,
}: {
  steps: Record<string, any>;
  stats: any;
  execution: any;
}) {
  const stepList = Object.entries(steps);

  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-cyan-400" />
          Pipeline exécuté
        </h3>

        <div className="space-y-2">
          {stepList.map(([key, step], index) => (
            <div
              key={key}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                step.status === 'success'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : step.status === 'error'
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-surface-500/5 border-gray-500/20'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-xs text-surface-300 font-mono">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-surface-200">{step.label || key}</span>
                  <StepStatusBadge status={step.status} />
                </div>
                <p className="text-xs text-surface-400 mt-0.5">{step.operation || step.rationale}</p>
              </div>
              {step.duration_ms ? (
                <span className="text-xs text-surface-400 font-mono">{step.duration_ms}ms</span>
              ) : (
                <span className="text-xs text-surface-500 font-mono">—</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {execution.target && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-xl p-4">
          <h4 className="text-sm font-medium text-cyan-300 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Configuration détectée
          </h4>
          <p className="text-sm text-surface-300 mt-2">
            Problème de{' '}
            <strong className="text-cyan-300">{execution.problem_type?.replace(/_/g, ' ')}</strong>{' '}
            sur la variable{' '}
            <code className="bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">
              {execution.target}
            </code>
          </p>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { LayoutGrid, Target } from 'lucide-react';
import { StepStatusBadge } from './ResultAtoms';

export function OverviewTab(props: {
  steps: Record<string, any>;
  stats: any;
  execution: any;
}) {
  const stepList = Object.entries(props.steps);

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
            <LayoutGrid className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
            Pipeline exécuté
          </span>
          {props.execution.target && (
            <span className="flex items-center gap-1.5 text-xs ui-t-muted">
              <Target className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
              {props.execution.problem_type?.replace(/_/g, ' ')} ·{' '}
              <strong style={{ color: 'var(--ui-text)' }}>{props.execution.target}</strong>
            </span>
          )}
        </header>

        <div className="overflow-x-auto">
          <table className="ui-table w-full text-xs">
            <thead>
              <tr>
                <th className="ui-th-num w-10">#</th>
                <th className="text-left">Étape</th>
                <th className="text-left">Détail</th>
                <th className="text-left">Statut</th>
                <th className="ui-th-num">Durée</th>
              </tr>
            </thead>
            <tbody>
              {stepList.map(([key, step], index) => (
                <tr key={key}>
                  <td className="ui-td-num ui-t-faint">{index + 1}</td>
                  <td className="font-semibold" style={{ color: 'var(--ui-text)' }}>
                    {step.label || key}
                  </td>
                  <td className="ui-t-muted">{step.operation || step.rationale || '—'}</td>
                  <td><StepStatusBadge status={step.status} /></td>
                  <td className="ui-td-num ui-t-muted">
                    {step.duration_ms ? `${step.duration_ms} ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

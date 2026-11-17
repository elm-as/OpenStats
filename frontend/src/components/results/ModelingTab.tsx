import React from 'react';
import { Brain, Trophy, BarChart3 } from 'lucide-react';
import { EmptyState } from './ResultAtoms';
import { LogitSummaryView, OlsSummaryView } from './RegressionSummaries';
import { ModelComparisonTable } from './ModelComparisonTable';

export function ModelingTab(props: {
  result?: any;
  problemType?: string;
  target?: string | null;
}) {
  const { result, problemType, target } = props;
  if (!result) return <EmptyState message="Pas de résultats de modélisation disponibles" />;

  const ranking = result.ranking || [];
  const bestModel = ranking[0] || {};
  const regSummary =
    bestModel.regression_summary ||
    result.regression_summary ||
    (bestModel.model_summary?.type === 'linear_regression' ? bestModel.model_summary : null);
  const logitSummary =
    bestModel.model_summary?.type === 'logistic_regression' ? bestModel.model_summary : null;
  const treeSummary =
    (bestModel.model_summary?.type === 'tree_ensemble' ? bestModel.model_summary : null) ||
    (bestModel.feature_importance ? { feature_importance_table: bestModel.feature_importance } : null);

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span className="flex items-center gap-2" style={{ color: 'var(--ui-text)' }}>
            <Brain className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
            Modélisation — {problemType?.replace(/_/g, ' ')}
            {target && <span className="ui-tag ui-tag-accent ui-mono">{target}</span>}
          </span>
          {result.best_model_key && (
            <span className="flex items-center gap-1.5 text-xs ui-num">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <strong style={{ color: 'var(--ui-text)' }}>{bestModel.model_name || result.best_model_key}</strong>
            </span>
          )}
        </header>

        {ranking.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-xs">
              <thead>
                <tr>
                  <th className="ui-th-num w-10">#</th>
                  <th className="text-left">Modèle</th>
                  <th className="ui-th-num">RMSE</th>
                  <th className="ui-th-num">MAE</th>
                  <th className="ui-th-num">CV</th>
                  <th className="ui-th-num">Score principal</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r: any) => {
                  const metrics = r.metrics || {};
                  const primary = metrics.r2 ?? metrics.roc_auc ?? metrics.f1_weighted ?? metrics.accuracy;
                  const label =
                    metrics.r2 !== undefined ? 'R²'
                      : metrics.roc_auc !== undefined ? 'AUC'
                      : metrics.f1_weighted !== undefined ? 'F1'
                      : 'Acc';

                  return (
                    <tr
                      key={r.model_key}
                      style={r.rank === 1 ? { background: 'var(--ui-accent-soft)' } : undefined}
                    >
                      <td className="ui-td-num ui-t-faint">{r.rank}</td>
                      <td className="font-semibold" style={{ color: 'var(--ui-text)' }}>
                        {r.model_name || r.model_key}
                      </td>
                      <td className="ui-td-num ui-t-muted">
                        {metrics.rmse !== undefined ? metrics.rmse.toFixed(3) : '—'}
                      </td>
                      <td className="ui-td-num ui-t-muted">
                        {metrics.mae !== undefined ? metrics.mae.toFixed(3) : '—'}
                      </td>
                      <td className="ui-td-num ui-t-muted">
                        {r.cv_scores?.mean !== undefined ? r.cv_scores.mean.toFixed(3) : '—'}
                      </td>
                      <td
                        className="ui-td-num font-bold"
                        style={{
                          color: primary > 0.5 ? 'var(--ui-success)' : primary >= 0 ? 'var(--ui-warning)' : 'var(--ui-danger)',
                        }}
                      >
                        {primary !== undefined
                          ? label === 'R²'
                            ? `R² ${primary.toFixed(3)}`
                            : `${label} ${(primary * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="Aucun modèle entraîné" />
        )}

        {result.failed && result.failed.length > 0 && (
          <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--ui-border)' }}>
            {result.failed.map((f: any) => (
              <div key={f.model_key} className="text-xs ui-t-danger">
                <strong>{f.model_name}</strong> : {f.error}
              </div>
            ))}
          </div>
        )}
      </section>

      <LogitSummaryView logitSummary={logitSummary} />

      {treeSummary &&
        treeSummary.feature_importance_table &&
        treeSummary.feature_importance_table.length > 0 && (
          <section className="ui-panel overflow-hidden">
            <header className="ui-panel-header">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
                <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--ui-success)' }} />
                Importance des variables ({bestModel.model_name || 'Ensemble'})
              </span>
            </header>
            <div className="p-3 space-y-1.5">
              {(() => {
                const table = treeSummary.feature_importance_table;
                const maxImp = Math.max(...table.map((t: any) => Math.abs(t.importance || 0)), 1e-6);
                const sumImp = table.reduce((acc: number, t: any) => acc + Math.abs(t.importance || 0), 0) || 1;

                return table.map((item: any, i: number) => {
                  const absVal = Math.abs(item.importance || 0);
                  const barWidth = Math.min(100, Math.max(2, (absVal / maxImp) * 100)).toFixed(1);
                  const relPct = ((absVal / sumImp) * 100).toFixed(1);

                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="font-medium w-44 truncate" title={item.feature}>{item.feature}</span>
                      <div className="flex-1 h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--ui-bg-sunken)' }}>
                        <div className="h-full" style={{ width: `${barWidth}%`, background: 'var(--ui-success)' }} />
                      </div>
                      <span className="ui-num ui-t-success w-14 text-right font-semibold">{relPct}%</span>
                    </div>
                  );
                });
              })()}
            </div>
          </section>
        )}

      <OlsSummaryView regSummary={regSummary} />
      <ModelComparisonTable ranking={ranking} />
    </div>
  );
}

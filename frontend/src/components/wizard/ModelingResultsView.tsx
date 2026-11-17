import React from 'react';
import { Trophy, Target, Zap } from 'lucide-react';
import type { ModelResults } from '../../types';
import { FeatureImportance } from '../viz';
import { fmtMetric } from './WizardTypes';

export function ModelingResults({ results }: { results: ModelResults }) {
  const isCriticalR2 =
    results.task_type === 'regression' &&
    results.ranking.length > 0 &&
    (results.ranking[0].metrics.r2 as number) < 0;

  return (
    <>
      <div className="ui-panel overflow-hidden mb-3">
        <header className="ui-panel-header">
          <span className="flex items-center gap-2" style={{ color: 'var(--ui-text)' }}>
            <Trophy className="w-4 h-4 text-amber-500" />
            Classement des modèles ({results.task_type})
          </span>
          {isCriticalR2 && (
            <span className="ui-tag ui-tag-warning">R² test négatif vs moyenne</span>
          )}
        </header>
        <div className="overflow-x-auto">
          <table className="ui-table w-full text-sm">
            <thead>
              <tr>
                <th className="ui-th-num text-right py-2 px-3 w-12">#</th>
                <th className="text-left py-2 px-3">Modèle</th>
                {results.task_type === 'regression' ? (
                  <>
                    <th className="ui-th-num text-right py-2 px-3">R²</th>
                    <th className="ui-th-num text-right py-2 px-3">RMSE</th>
                    <th className="ui-th-num text-right py-2 px-3">MAE</th>
                  </>
                ) : (
                  <>
                    <th className="ui-th-num text-right py-2 px-3">Accuracy</th>
                    <th className="ui-th-num text-right py-2 px-3">F1-Score</th>
                    <th className="ui-th-num text-right py-2 px-3">AUC-ROC</th>
                  </>
                )}
                <th className="ui-th-num text-right py-2 px-3">CV Score</th>
              </tr>
            </thead>
            <tbody>
              {results.ranking.map(r => (
                <tr
                  key={r.model_key}
                  style={r.rank === 1 ? { background: 'var(--ui-accent-soft)' } : undefined}
                >
                  <td className="py-2 px-3 ui-td-num">
                    {r.rank === 1 ? (
                      <Trophy className="w-3.5 h-3.5 text-amber-500 inline-block" />
                    ) : (
                      r.rank
                    )}
                  </td>
                  <td className="py-2 px-3 font-medium">{r.model_name}</td>
                  {results.task_type === 'regression' ? (
                    <>
                      <td className={`py-2 px-3 ui-td-num text-xs ${(r.metrics.r2 as number) < 0 ? 'ui-t-danger font-semibold' : ''}`}>
                        {fmtMetric(r.metrics.r2 as number)}
                      </td>
                      <td className="py-2 px-3 ui-td-num text-xs">
                        {fmtMetric(r.metrics.rmse as number)}
                      </td>
                      <td className="py-2 px-3 ui-td-num text-xs">
                        {fmtMetric(r.metrics.mae as number)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 ui-td-num text-xs">
                        {fmtMetric(r.metrics.accuracy as number)}
                      </td>
                      <td className="py-2 px-3 ui-td-num text-xs">
                        {fmtMetric(r.metrics.f1_weighted as number)}
                      </td>
                      <td className="py-2 px-3 ui-td-num text-xs">
                        {fmtMetric(r.metrics.auc_roc as number)}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-3 ui-td-num text-xs">
                    {r.cv_scores?.mean != null ? (
                      <span title={(r.cv_scores as any)?.rmse_mean ? `CV RMSE: ${(r.cv_scores as any).rmse_mean}` : undefined}>
                        {r.cv_scores.mean.toFixed(4)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {results.ranking[0]?.feature_importance?.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold" style={{ color: 'var(--ui-text)' }}>
              Importance des variables — {results.ranking[0].model_name}
            </h3>
          </div>
          <FeatureImportance
            features={results.ranking[0].feature_importance.map(f => ({
              feature: f.feature,
              importance: f.importance,
            }))}
            topN={15}
          />
        </div>
      )}

      {results.shap && results.shap.global_importance && (
        <div className="ui-panel p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-accent-400" />
            <h3 className="font-semibold" style={{ color: 'var(--ui-text)' }}>Explicabilité SHAP</h3>
          </div>
          <FeatureImportance
            features={results.shap.global_importance.map(s => ({
              feature: s.feature,
              importance: s.mean_shap,
            }))}
            topN={15}
            showSign
            xLabel="Impact SHAP moyen"
          />
        </div>
      )}

      {results.failed.length > 0 && (
        <div className="card" style={{ background: 'var(--ui-danger-soft)', borderColor: 'var(--ui-danger)' }}>
          <h3 className="font-semibold mb-2" style={{ color: 'var(--ui-danger)' }}>Modèles en échec</h3>
          {results.failed.map((f, i) => (
            <p key={i} className="text-sm" style={{ color: 'var(--ui-text-secondary)' }}>
              <span className="font-medium">{f.model_name}</span> : {f.error}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

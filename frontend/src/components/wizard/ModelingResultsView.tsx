import React from 'react';
import { Trophy, Target, Zap } from 'lucide-react';
import type { ModelResults } from '../../types';
import { FeatureImportance } from '../viz';
import { fmtMetric } from './WizardTypes';

export function ModelingResults({ results }: { results: ModelResults }) {
  return (
    <>
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">
            Classement des modèles ({results.task_type})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-900 border-b">
                <th className="text-center py-2 px-3 w-12">#</th>
                <th className="text-left py-2 px-3">Modèle</th>
                {results.task_type === 'regression' ? (
                  <>
                    <th className="text-right py-2 px-3">R²</th>
                    <th className="text-right py-2 px-3">RMSE</th>
                    <th className="text-right py-2 px-3">MAE</th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2 px-3">Accuracy</th>
                    <th className="text-right py-2 px-3">F1-Score</th>
                    <th className="text-right py-2 px-3">AUC-ROC</th>
                  </>
                )}
                <th className="text-right py-2 px-3">CV Score</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.ranking.map(r => (
                <tr
                  key={r.model_key}
                  className={`hover:bg-surface-900 ${r.rank === 1 ? 'bg-amber-50' : ''}`}
                >
                  <td className="py-2.5 px-3 text-center">
                    {r.rank === 1 ? (
                      <Trophy className="w-4 h-4 text-amber-500 mx-auto" />
                    ) : (
                      r.rank
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-medium">{r.model_name}</td>
                  {results.task_type === 'regression' ? (
                    <>
                      <td className={`py-2.5 px-3 text-right font-mono text-xs ${(r.metrics.r2 as number) < 0 ? 'text-rose-400 font-semibold' : ''}`}>
                        {fmtMetric(r.metrics.r2 as number)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                        {fmtMetric(r.metrics.rmse as number)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                        {fmtMetric(r.metrics.mae as number)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                        {fmtMetric(r.metrics.accuracy as number)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                        {fmtMetric(r.metrics.f1_weighted as number)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                        {fmtMetric(r.metrics.auc_roc as number)}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono text-xs">
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
            <h3 className="font-semibold text-gray-900">
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
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Explicabilité SHAP</h3>
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
        <div className="card bg-red-50 border-red-200">
          <h3 className="font-semibold text-red-800 mb-2">Modèles en échec</h3>
          {results.failed.map((f, i) => (
            <p key={i} className="text-sm text-red-600">
              <span className="font-medium">{f.model_name}</span> : {f.error}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

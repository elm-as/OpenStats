import React from 'react';
import { Brain, Trophy, BarChart3 } from 'lucide-react';
import { EmptyState } from './ResultAtoms';
import { LogitSummaryView, OlsSummaryView } from './RegressionSummaries';

export function ModelingTab({
  result,
  problemType,
  target,
}: {
  result?: any;
  problemType?: string;
  target?: string | null;
}) {
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
    <div className="space-y-4">
      {/* Modélisation — Présentation Générale */}
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          Modélisation — {problemType?.replace(/_/g, ' ')}
          {target && (
            <span className="text-sm text-surface-300">
              sur <code className="text-cyan-300 bg-cyan-500/20 px-1 rounded">{target}</code>
            </span>
          )}
        </h3>

        {result.best_model_key && (
          <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/20 to-transparent border border-purple-500/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-purple-300">Meilleur modèle:</span>
              <code className="text-white font-bold bg-purple-600/40 border border-purple-400/30 px-2.5 py-1 rounded-md shadow-sm">
                {bestModel.model_name || result.best_model_key}
              </code>
            </div>
            {bestModel.metrics?.r2 !== undefined && (
              <span
                className={`text-sm font-mono font-bold px-2.5 py-1 rounded ${
                  bestModel.metrics.r2 < 0
                    ? 'text-rose-300 bg-rose-500/20 border border-rose-500/30'
                    : bestModel.metrics.r2 > 0.5
                    ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30'
                    : 'text-amber-300 bg-amber-500/20 border border-amber-500/30'
                }`}
              >
                R² = {(bestModel.metrics.r2 * 100).toFixed(1)}%
              </span>
            )}

            {bestModel.metrics?.f1_weighted !== undefined && (
              <span className="text-sm font-mono text-purple-300 font-bold bg-purple-500/20 px-2.5 py-1 rounded">
                F1 Score = {(bestModel.metrics.f1_weighted * 100).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {/* Tableau comparatif des modèles */}
        {ranking.length > 0 ? (
          <div className="space-y-2">
            {ranking.map((r: any) => {
              const metrics = r.metrics || {};
              const primary = metrics.r2 ?? metrics.roc_auc ?? metrics.f1_weighted ?? metrics.accuracy;
              const label =
                metrics.r2 !== undefined
                  ? 'R²'
                  : metrics.roc_auc !== undefined
                  ? 'AUC'
                  : metrics.f1_weighted !== undefined
                  ? 'F1'
                  : 'Acc';

              return (
                <div key={r.model_key} className="flex items-center gap-3 p-3 bg-surface-700/50 rounded-lg">
                  <span className="text-sm text-surface-400 w-8">#{r.rank}</span>
                  <span className="text-sm text-surface-200 flex-1 font-medium">
                    {r.model_name || r.model_key}
                  </span>

                  {metrics.rmse !== undefined && (
                    <span className="text-xs font-mono text-surface-400">
                      RMSE: {metrics.rmse.toFixed(3)}
                    </span>
                  )}
                  {metrics.mae !== undefined && (
                    <span className="text-xs font-mono text-surface-400">
                      MAE: {metrics.mae.toFixed(3)}
                    </span>
                  )}
                  {metrics.accuracy !== undefined && (
                    <span className="text-xs font-mono text-surface-400">
                      Acc: {(metrics.accuracy * 100).toFixed(1)}%
                    </span>
                  )}

                  {primary !== undefined && (
                    <>
                      <div className="w-32 h-2 bg-surface-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            primary >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(Math.abs(primary) * 100, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-sm font-mono w-20 text-right font-semibold ${
                          primary >= 0 ? 'text-emerald-300' : 'text-red-400'
                        }`}
                      >
                        {label} {(primary * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message="Aucun modèle entraîné" />
        )}

        {result.failed && result.failed.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-red-300 mb-2">Modèles en échec</h4>
            <div className="space-y-1">
              {result.failed.map((f: any) => (
                <div key={f.model_key} className="text-xs text-red-200/70 p-2 bg-red-500/10 rounded">
                  {f.model_name}: {f.error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Résumé de Régression Logistique */}
      <LogitSummaryView logitSummary={logitSummary} />

      {/* Résumé d'Arbres & Boosting */}
      {treeSummary &&
        treeSummary.feature_importance_table &&
        treeSummary.feature_importance_table.length > 0 && (
          <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4 space-y-4">
            <h4 className="text-md font-semibold text-emerald-300 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Importance des Variables ({bestModel.model_name || 'Arbres / Ensemble'})
            </h4>

            <div className="space-y-2">
              {(() => {
                const table = treeSummary.feature_importance_table;
                const maxImp = Math.max(...table.map((t: any) => Math.abs(t.importance || 0)), 1e-6);
                const sumImp = table.reduce((acc: number, t: any) => acc + Math.abs(t.importance || 0), 0) || 1;

                return table.map((item: any, i: number) => {
                  const absVal = Math.abs(item.importance || 0);
                  const barWidth = Math.min(100, Math.max(2, (absVal / maxImp) * 100)).toFixed(1);
                  const relPct = ((absVal / sumImp) * 100).toFixed(1);

                  return (
                    <div key={i} className="flex items-center gap-3 p-2 bg-surface-700/40 rounded-lg">
                      <span className="text-sm font-medium text-surface-200 w-44 truncate" title={item.feature}>
                        {item.feature}
                      </span>
                      <div className="flex-1 h-2 bg-surface-600 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="text-xs font-mono text-emerald-300 w-16 text-right font-semibold">
                        {relPct}%
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

          </div>
        )}

      {/* Résumé de Régression OLS */}
      <OlsSummaryView regSummary={regSummary} />
    </div>
  );
}

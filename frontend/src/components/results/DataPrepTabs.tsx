import React from 'react';
import { Filter, BarChart3, ChevronRight, CheckCircle2, Zap } from 'lucide-react';
import { EmptyState, MetricBox, TypeBadge, formatNumber } from './ResultAtoms';

export function CleaningTab({ result }: { result?: any }) {
  if (!result) return <EmptyState message="Pas de résultats de nettoyage disponibles" />;

  const actions = result.actions || [];
  const duplicatesAction = actions.find((a: any) => a.action === 'remove_duplicates');
  const imputeAction = actions.find((a: any) => a.action === 'impute_missing');
  const dropMissingAction = actions.find((a: any) => a.action === 'drop_high_missing_cols');
  const dropConstantAction = actions.find((a: any) => a.action === 'drop_constant_cols');

  const duplicatesRemoved = duplicatesAction?.removed ?? result.duplicates_removed ?? 0;
  const missingImputed = imputeAction?.n_imputed ?? result.missing_imputed ?? 0;
  const columnsDropped =
    (dropMissingAction?.dropped?.length || 0) + (dropConstantAction?.dropped?.length || 0);

  const beforeRows = result.before_rows ?? result.shape_before?.rows;
  const afterRows = result.after_rows ?? result.shape_after?.rows;
  const beforeCols = result.before_cols ?? result.shape_before?.columns;
  const afterCols = result.after_cols ?? result.shape_after?.columns;

  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-400" />
          Nettoyage des données
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricBox label="Doublons supprimés" value={duplicatesRemoved} color="blue" />
          <MetricBox label="Valeurs imputées" value={missingImputed} color="amber" />
          <MetricBox label="Colonnes supprimées" value={columnsDropped} color="purple" />
          <MetricBox
            label="Lignes modifiées"
            value={(beforeRows || 0) - (afterRows || 0)}
            color="emerald"
          />
        </div>

        {(beforeRows !== undefined || beforeCols !== undefined) && (
          <div className="mt-4 p-3 bg-surface-700/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-300">Dimensions:</span>
              <span className="text-surface-200">
                <span className="text-surface-400">
                  {beforeRows}×{beforeCols}
                </span>
                <ChevronRight className="w-4 h-4 inline mx-2 text-surface-500" />
                <span className="text-emerald-300 font-semibold">
                  {afterRows}×{afterCols}
                </span>
              </span>
            </div>
          </div>
        )}

        {actions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-surface-300 mb-2">Actions effectuées</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {actions.map((action: any, i: number) => (
                <div
                  key={i}
                  className="text-xs text-surface-300 flex items-start gap-2 p-2 bg-surface-700/50 rounded"
                >
                  <span className="text-surface-400 font-mono">[{action.action}]</span>
                  <span>{JSON.stringify(action).slice(0, 100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DescriptiveTab({ result }: { result?: any }) {
  if (!result) return <EmptyState message="Pas de statistiques descriptives disponibles" />;

  const stats = (result.statistics || result.stats || result || {}) as Record<string, any>;
  const columns = Object.keys(stats);

  if (columns.length === 0) {
    return (
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <EmptyState message="Aucune statistique disponible" />
        <pre className="text-xs text-surface-500 mt-4 overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          Statistiques descriptives
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-surface-300 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left py-2 pr-4">Variable</th>
                <th className="text-right py-2 px-3">Type</th>
                <th className="text-right py-2 px-3">N</th>
                <th className="text-right py-2 px-3">Moyenne</th>
                <th className="text-right py-2 px-3">Médiane</th>
                <th className="text-right py-2 px-3">Écart-type</th>
                <th className="text-right py-2 px-3">Min</th>
                <th className="text-right py-2 px-3">Max</th>
                <th className="text-right py-2 px-3">Manquants</th>
              </tr>
            </thead>
            <tbody>
              {columns.map(col => {
                const s = stats[col] || {};
                return (
                  <tr key={col} className="border-t border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-4 text-surface-200 font-medium">{col}</td>
                    <td className="py-2 px-3 text-right">
                      <TypeBadge type={s.type || 'numeric'} />
                    </td>
                    <td className="py-2 px-3 text-right text-surface-300 font-mono">
                      {s.count ?? s.n ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-surface-200 font-mono">
                      {formatNumber(s.mean)}
                    </td>
                    <td className="py-2 px-3 text-right text-surface-200 font-mono">
                      {formatNumber(s.median)}
                    </td>
                    <td className="py-2 px-3 text-right text-surface-200 font-mono">
                      {formatNumber(s.std)}
                    </td>
                    <td className="py-2 px-3 text-right text-surface-300 font-mono">
                      {formatNumber(s.min)}
                    </td>
                    <td className="py-2 px-3 text-right text-surface-300 font-mono">
                      {formatNumber(s.max)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={
                          (s.null_rate || s.missing_rate || 0) > 0.1
                            ? 'text-red-300'
                            : 'text-surface-300'
                        }
                      >
                        {((s.null_rate || s.missing_rate || 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function TransformsTab({
  recommendations,
  applied,
}: {
  recommendations?: any;
  applied?: any;
}) {
  const recs = recommendations?.recommendations || recommendations || [];
  const logs = applied?.logs || (Array.isArray(applied) ? applied : []);

  return (
    <div className="space-y-4">
      {logs.length > 0 && (
        <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
          <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Transformations effectuées ({logs.length})
          </h3>
          <div className="space-y-2">
            {logs.map((log: any, i: number) => (
              <div
                key={i}
                className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 bg-surface-700/50 rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-surface-600 px-2 py-1 rounded text-surface-200">
                    {log.column}
                  </code>
                  <span className="text-emerald-400 text-sm">→</span>
                  <span className="text-sm font-medium text-emerald-300">
                    {log.label || log.transform}
                  </span>
                  {log.new_column && log.new_column !== log.column && (
                    <span className="text-xs text-surface-400">({log.new_column})</span>
                  )}
                </div>
                {log.before && log.after && (
                  <div className="flex items-center gap-3 text-xs text-surface-300 font-mono bg-surface-800/60 px-2 py-1 rounded">
                    <span>
                      Moyenne: {log.before.mean?.toFixed(2)} → {log.after.mean?.toFixed(2)}
                    </span>
                    <span>•</span>
                    <span>
                      Écart-type: {log.before.std?.toFixed(2)} → {log.after.std?.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Recommandations de transformation
        </h3>

        {recs.length > 0 ? (
          <div className="space-y-2">
            {recs.map((rec: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-surface-700/50 rounded-lg">
                <code className="text-xs bg-surface-600 px-2 py-1 rounded text-surface-200">
                  {rec.column}
                </code>
                <span className="text-amber-300 text-sm">→</span>
                <span className="text-sm text-surface-200">{rec.recommended_transform}</span>
                <span className="text-xs text-surface-400 flex-1">{rec.rationale}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message={
              logs.length > 0
                ? 'Aucune transformation supplémentaire recommandée'
                : 'Aucune recommandation de transformation'
            }
          />
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { BarChart3, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MODEL_DEFS } from './constants';
import type { PerModelRun } from './usePerModelExploration';

interface PerModelSummaryTableProps {
  perModelResults: Record<string, PerModelRun>;
  onSelectModelTab: (key: string) => void;
}

export function PerModelSummaryTable({
  perModelResults,
  onSelectModelTab,
}: PerModelSummaryTableProps) {
  const resultKeys = Object.keys(perModelResults);

  return (
    <div className="card">
      <h4 className="font-semibold mb-3 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-amber-500" />
        Comparaison des modèles
      </h4>
      {resultKeys.length === 0 ? (
        <p className="text-surface-400 text-sm">
          Lancez au moins un modèle pour voir la comparaison.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left">Modèle</th>
                  <th className="p-2 text-right">AIC</th>
                  <th className="p-2 text-right">BIC</th>
                  <th className="p-2 text-right">HQIC</th>
                  <th className="p-2 text-right">Lag</th>
                  <th className="p-2 text-center">Régime</th>
                  <th className="p-2 text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_DEFS.map(({ key, label }) => {
                  const run = perModelResults[key];
                  if (!run) {
                    return (
                      <tr key={key}>
                        <td className="p-2 font-medium text-surface-500">{label}</td>
                        <td colSpan={6} className="p-2 text-center text-surface-500 text-xs">
                          Non lancé
                        </td>
                      </tr>
                    );
                  }
                  const modelData = run.results?.models?.[key];
                  if (run.error && !modelData) {
                    return (
                      <tr key={key}>
                        <td className="p-2 font-medium text-red-400">{label}</td>
                        <td colSpan={6} className="p-2 text-red-400 text-xs truncate max-w-xs">
                          {run.error}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={key}
                      className="cursor-pointer hover:bg-surface-800/50"
                      onClick={() => onSelectModelTab(key)}
                    >
                      <td className="p-2 font-medium">{label}</td>
                      <td className="p-2 text-right font-mono">{modelData?.aic?.toFixed(1) ?? '—'}</td>
                      <td className="p-2 text-right font-mono">{modelData?.bic?.toFixed(1) ?? '—'}</td>
                      <td className="p-2 text-right font-mono">{modelData?.hqic?.toFixed(1) ?? '—'}</td>
                      <td className="p-2 text-right font-mono">{modelData?.lag_order ?? '—'}</td>
                      <td className="p-2 text-center text-xs">{modelData?.data_regime ?? '—'}</td>
                      <td className="p-2 text-center">
                        {modelData?.error ? (
                          <AlertTriangle className="w-4 h-4 text-red-400 inline" />
                        ) : modelData ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                        ) : (
                          <span className="text-surface-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(() => {
            const valid = MODEL_DEFS.filter(({ key }) => {
              const m = perModelResults[key]?.results?.models?.[key];
              return m && !m.error && m.aic != null;
            })
              .map(({ key, label }) => ({
                key,
                label,
                aic: perModelResults[key].results!.models[key]!.aic!,
              }))
              .sort((a, b) => a.aic - b.aic);

            if (valid.length >= 2) {
              return (
                <div className="mt-4 p-3 rounded-lg border border-green-500/20">
                  <p className="text-sm text-green-300">
                    <strong>Meilleur modèle (AIC) :</strong> {valid[0].label} — AIC ={' '}
                    {valid[0].aic.toFixed(1)}
                  </p>
                </div>
              );
            }
            return null;
          })()}
        </>
      )}
    </div>
  );
}

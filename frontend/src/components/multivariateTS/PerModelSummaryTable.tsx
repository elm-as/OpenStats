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
    <div className="ui-panel p-4">
      <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm text-[var(--ui-text)]">
        <BarChart3 className="w-4 h-4 text-amber-500" />
        Comparaison des modèles
      </h4>
      {resultKeys.length === 0 ? (
        <p className="ui-t-muted text-xs">
          Lancez au moins un modèle pour voir la comparaison.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="ui-table text-xs w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left">Modèle</th>
                  <th className="p-2 ui-th-num">AIC</th>
                  <th className="p-2 ui-th-num">BIC</th>
                  <th className="p-2 ui-th-num">HQIC</th>
                  <th className="p-2 ui-th-num">Lag</th>
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
                        <td className="p-2 font-medium ui-t-muted">{label}</td>
                        <td colSpan={6} className="p-2 text-center ui-t-muted">
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
                        <td colSpan={6} className="p-2 text-red-400">
                          {run.error}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={key}
                      className="cursor-pointer"
                      onClick={() => onSelectModelTab(key)}
                    >
                      <td className="p-2 font-medium">{label}</td>
                      <td className="p-2 ui-td-num">{modelData?.aic?.toFixed(1) ?? '—'}</td>
                      <td className="p-2 ui-td-num">{modelData?.bic?.toFixed(1) ?? '—'}</td>
                      <td className="p-2 ui-td-num">{modelData?.hqic?.toFixed(1) ?? '—'}</td>
                      <td className="p-2 ui-td-num">{modelData?.lag_order ?? '—'}</td>
                      <td className="p-2 text-center">{modelData?.data_regime ?? '—'}</td>
                      <td className="p-2 text-center">
                        {modelData?.error ? (
                          <AlertTriangle className="w-4 h-4 text-red-400 inline" />
                        ) : modelData ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                        ) : (
                          <span className="ui-t-muted">—</span>
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
                <div className="mt-3 p-2.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400 ui-num">
                  <strong>Meilleur modèle (AIC) :</strong> {valid[0].label} — AIC = {valid[0].aic.toFixed(1)}
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

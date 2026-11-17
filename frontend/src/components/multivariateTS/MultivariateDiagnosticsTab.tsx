import React from 'react';
import { TrendingUp, BarChart3, CheckCircle2 } from 'lucide-react';
import { IRFGrid, FEVDStacked } from '../viz';

interface MultivariateDiagnosticsTabProps {
  activeTab: 'irf' | 'fevd' | 'diagnostics';
  currentModel: any;
}

function FevdPanel({ currentModel }: { currentModel: any }) {
  if (!currentModel || !('fevd' in currentModel) || !currentModel.fevd || currentModel.fevd.error) {
    return (
      <div className="ui-panel p-6 text-center text-xs ui-t-muted">
        {(currentModel as any)?.fevd?.error ||
          "FEVD disponible uniquement pour le modèle VAR. Sélectionnez VAR dans l'onglet Modèles."}
      </div>
    );
  }

  const fevdData = currentModel.fevd.variables
    .map((targetVar: string) => {
      const decomp = currentModel.fevd.data[targetVar] || {};
      const contributions: Record<string, number[]> = {};
      for (const src of Object.keys(decomp)) {
        contributions[src] = decomp[src].map((v: any) => v ?? 0);
      }
      return { variable: targetVar, contributions };
    })
    .filter((r: any) => Object.keys(r.contributions).length > 0);

  return (
    <div className="ui-panel p-4">
      <h4 className="font-semibold text-[var(--ui-text)] mb-3 flex items-center gap-2 text-sm">
        <BarChart3 className="w-4 h-4 text-amber-400" />
        Décomposition de la variance (FEVD)
      </h4>
      <FEVDStacked fevd={fevdData} title="" />
    </div>
  );
}

export function MultivariateDiagnosticsTab(props: MultivariateDiagnosticsTabProps) {
  const { activeTab, currentModel } = props;

  if (activeTab === 'irf') {
    if (currentModel?.irf && !currentModel.irf.error) {
      const cells = currentModel.irf.variables
        .flatMap((impulse: string) =>
          currentModel.irf.variables.map((response: string) => {
            const values = currentModel.irf.data[impulse]?.[response];
            return values ? { shock: impulse, response, values: values.map((v: any) => v ?? 0) } : null;
          })
        )
        .filter((c: any): c is { shock: string; response: string; values: number[] } => c !== null);

      return (
        <div className="ui-panel p-4">
          <h4 className="font-semibold text-[var(--ui-text)] mb-3 flex items-center gap-2 text-sm ui-num">
            <TrendingUp className="w-4 h-4 text-accent-400" />
            Réponses impulsionnelles (IRF) — {currentModel.irf.periods} périodes
          </h4>
          <IRFGrid cells={cells} title="" />
        </div>
      );
    }

    return (
      <div className="ui-panel p-6 text-center text-xs ui-t-muted">
        {currentModel?.irf?.error ||
          "Sélectionnez un modèle dans l'onglet Modèles pour voir les IRF."}
      </div>
    );
  }

  if (activeTab === 'fevd') {
    return <FevdPanel currentModel={currentModel} />;
  }

  if (activeTab === 'diagnostics' && currentModel) {
    return (
      <div className="ui-panel p-4">
        <h4 className="font-semibold text-[var(--ui-text)] mb-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-accent-400" />
          Diagnostics des Résidus
        </h4>

        {!currentModel.diagnostics ? (
          <p className="ui-t-muted italic text-xs">
            Les diagnostics ne sont pas disponibles pour ce modèle.
          </p>
        ) : currentModel.diagnostics.error ? (
          <p className="text-red-400 text-xs">Erreur: {currentModel.diagnostics.error}</p>
        ) : (
          <div className="space-y-4">
            <div
              className={`p-3.5 border rounded text-xs ${
                currentModel.diagnostics.summary.model_adequate
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <h5
                className={`font-bold mb-1 ${
                  currentModel.diagnostics.summary.model_adequate
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                Verdict :{' '}
                {currentModel.diagnostics.summary.model_adequate
                  ? 'Modèle Adéquat'
                  : 'Modèle Inadéquat'}
              </h5>
              <p className="ui-t-secondary mb-2">
                {currentModel.diagnostics.summary.interpretation}
              </p>

              {currentModel.diagnostics.summary.issues.length > 0 && (
                <ul className="list-disc pl-5 text-red-400 space-y-0.5">
                  {currentModel.diagnostics.summary.issues.map((issue: string, idx: number) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h5 className="font-semibold text-xs uppercase tracking-wider ui-t-muted mb-2">
                Détails par variable
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(currentModel.diagnostics.per_variable).map(
                  ([varName, diag]: [string, any]) => (
                    <div
                      key={varName}
                      className="p-3 rounded border"
                      style={{ background: 'var(--ui-bg-sunken)', borderColor: 'var(--ui-border)' }}
                    >
                      <h6
                        className="font-semibold text-xs text-accent-400 border-b pb-1.5 mb-2.5"
                        style={{ borderColor: 'var(--ui-border)' }}
                      >
                        {varName}
                      </h6>

                      {diag.error ? (
                        <p className="text-red-400 text-xs">{diag.error}</p>
                      ) : (
                        <div className="space-y-2 text-xs ui-num">
                          <div className="flex justify-between items-center">
                            <span className="ui-t-secondary">Ljung-Box (p={diag.ljung_box?.p_value?.toFixed(4)})</span>
                            <span className={diag.ljung_box?.ok ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {diag.ljung_box?.ok ? 'OK' : 'ÉCHEC'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="ui-t-secondary">Jarque-Bera (p={diag.jarque_bera?.p_value?.toFixed(4)})</span>
                            <span className={diag.jarque_bera?.ok ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                              {diag.jarque_bera?.ok ? 'OK' : 'NON NORMAL'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="ui-t-secondary">Durbin-Watson ({diag.durbin_watson?.statistic?.toFixed(2)})</span>
                            <span className={diag.durbin_watson?.ok ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {diag.durbin_watson?.ok ? 'OK' : 'ÉCHEC'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

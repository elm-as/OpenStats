import React from 'react';
import { TrendingUp, BarChart3, CheckCircle2 } from 'lucide-react';
import { IRFGrid, FEVDStacked } from '../viz';

interface MultivariateDiagnosticsTabProps {
  activeTab: 'irf' | 'fevd' | 'diagnostics';
  currentModel: any;
}

export function MultivariateDiagnosticsTab({
  activeTab,
  currentModel,
}: MultivariateDiagnosticsTabProps) {
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
        <div className="space-y-4">
          <div className="card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-400" />
              Fonctions de réponse impulsionnelle (IRF) — {currentModel.irf.periods} périodes
            </h4>
            <p className="text-xs text-muted mb-4">
              Chaque cellule montre la réponse d'une variable à un choc unitaire d'une autre variable.
            </p>
            <IRFGrid cells={cells} title="" />
          </div>
        </div>
      );
    }

    return (
      <div className="card p-6 text-center text-gray-500">
        <p>
          {currentModel?.irf?.error ||
            "Sélectionnez un modèle dans l'onglet Modèles pour voir les IRF."}
        </p>
      </div>
    );
  }

  if (activeTab === 'fevd') {
    if (
      currentModel &&
      'fevd' in currentModel &&
      currentModel.fevd &&
      !currentModel.fevd.error
    ) {
      const fevdData = currentModel.fevd.variables
        .map((targetVar: string) => {
          const decomp = currentModel.fevd.data[targetVar];
          const contributions: Record<string, number[]> = {};
          if (decomp) {
            for (const src of Object.keys(decomp)) {
              contributions[src] = decomp[src].map((v: any) => v ?? 0);
            }
          }
          return { variable: targetVar, contributions };
        })
        .filter((r: any) => Object.keys(r.contributions).length > 0);

      return (
        <div className="space-y-4">
          <div className="card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              Décomposition de la variance de l'erreur de prévision (FEVD)
            </h4>
            <p className="text-xs text-muted mb-4">
              Proportion de la variance de chaque variable expliquée par les chocs de chaque source.
            </p>
            <FEVDStacked fevd={fevdData} title="" />
          </div>
        </div>
      );
    }

    return (
      <div className="card p-6 text-center text-gray-500">
        <p>
          {(currentModel as any)?.fevd?.error ||
            "FEVD disponible uniquement pour le modèle VAR. Sélectionnez VAR dans l'onglet Modèles."}
        </p>
      </div>
    );
  }

  if (activeTab === 'diagnostics' && currentModel) {
    return (
      <div className="space-y-4">
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-500" />
            Diagnostics des Résidus
          </h4>

          {!currentModel.diagnostics ? (
            <p className="text-gray-500 italic text-sm">
              Les diagnostics ne sont pas disponibles pour ce modèle.
            </p>
          ) : currentModel.diagnostics.error ? (
            <p className="text-red-500 text-sm">Erreur: {currentModel.diagnostics.error}</p>
          ) : (
            <div className="space-y-6">
              {/* Résumé Global */}
              <div
                className={`p-4 border rounded-lg ${
                  currentModel.diagnostics.summary.model_adequate
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <h5
                  className={`font-bold mb-2 ${
                    currentModel.diagnostics.summary.model_adequate
                      ? 'text-green-800'
                      : 'text-red-800'
                  }`}
                >
                  Verdict Global:{' '}
                  {currentModel.diagnostics.summary.model_adequate
                    ? 'Modèle Adéquat'
                    : 'Modèle Inadéquat'}
                </h5>
                <p className="text-sm text-gray-700 mb-3">
                  {currentModel.diagnostics.summary.interpretation}
                </p>

                {currentModel.diagnostics.summary.issues.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-red-700">
                    {currentModel.diagnostics.summary.issues.map((issue: string, idx: number) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Diagnostics par Variable */}
              <div>
                <h5 className="font-semibold text-gray-800 mb-3">Détails par variable</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(currentModel.diagnostics.per_variable).map(
                    ([varName, diag]: [string, any]) => (
                      <div
                        key={varName}
                        className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                      >
                        <h6 className="font-semibold text-primary-700 border-b pb-2 mb-3">
                          {varName}
                        </h6>

                        {diag.error ? (
                          <p className="text-red-500 text-xs">{diag.error}</p>
                        ) : (
                          <div className="space-y-3">
                            {/* Ljung-Box */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium text-gray-700">
                                  Autocorrélation (Ljung-Box)
                                </span>
                                <span
                                  className={
                                    diag.ljung_box?.ok
                                      ? 'text-green-600 font-bold text-xs'
                                      : 'text-red-600 font-bold text-xs'
                                  }
                                >
                                  {diag.ljung_box?.ok ? 'OK' : 'ÉCHEC'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                p-value: {diag.ljung_box?.p_value?.toFixed(4)}
                              </p>
                            </div>

                            {/* Jarque-Bera */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium text-gray-700">
                                  Normalité (Jarque-Bera)
                                </span>
                                <span
                                  className={
                                    diag.jarque_bera?.ok
                                      ? 'text-green-600 font-bold text-xs'
                                      : 'text-amber-600 font-bold text-xs'
                                  }
                                >
                                  {diag.jarque_bera?.ok ? 'OK' : 'ÉCHEC (Non-critique)'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                p-value: {diag.jarque_bera?.p_value?.toFixed(4)}
                              </p>
                            </div>

                            {/* Durbin-Watson */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium text-gray-700">
                                  Autocorrélation Lag-1 (Durbin-Watson)
                                </span>
                                <span
                                  className={
                                    diag.durbin_watson?.ok
                                      ? 'text-green-600 font-bold text-xs'
                                      : 'text-red-600 font-bold text-xs'
                                  }
                                >
                                  {diag.durbin_watson?.ok ? 'OK' : 'ÉCHEC'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                Statistique: {diag.durbin_watson?.statistic?.toFixed(2)}
                              </p>
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
      </div>
    );
  }

  return null;
}

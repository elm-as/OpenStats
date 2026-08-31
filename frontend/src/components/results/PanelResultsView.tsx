import React from 'react';
import { Layers, CheckCircle2, AlertCircle, TrendingUp, Cpu } from 'lucide-react';

interface PanelResultsViewProps {
  result: {
    entity_column: string;
    time_column: string;
    target_column: string;
    n_observations: number;
    n_entities: number;
    is_balanced: boolean;
    pooled_ols: {
      coefficients: Array<{
        variable: string;
        coefficient: number;
        std_error: number;
        t_statistic: number;
        p_value: number;
        significant: boolean;
      }>;
      r2: number;
      r2_adjusted: number;
      f_statistic: number;
      aic: number;
      bic: number;
    };
    fixed_effects: {
      coefficients: Array<{
        variable: string;
        coefficient: number;
        std_error: number;
        t_statistic: number;
        p_value: number;
        significant: boolean;
      }>;
      r2_within: number;
      df_residuals: number;
      sigma2_fe: number;
    };
    random_effects: {
      coefficients: Array<{
        variable: string;
        coefficient: number;
        std_error: number;
        t_statistic: number;
        p_value: number;
        significant: boolean;
      }>;
      r2_overall: number;
      theta_weight: number;
      sigma2_u: number;
    };
    hausman_test: {
      statistic: number;
      p_value: number;
      degrees_of_freedom: number;
      prefer_fixed_effects: boolean;
      conclusion: string;
    };
  };
}

export function PanelResultsView({ result }: PanelResultsViewProps) {
  if (!result) return null;

  const { hausman_test } = result;
  const isFE = hausman_test.prefer_fixed_effects;

  return (
    <div className="space-y-4">
      {/* En-tête du panel */}
      <div className="bg-surface-800/60 border border-white/10 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-surface-100">
                Économétrie des Données de Panel
              </h3>
              <p className="text-xs text-surface-400">
                Entité : <code className="text-cyan-300 bg-surface-700 px-1 py-0.5 rounded">{result.entity_column}</code> | Temps : <code className="text-cyan-300 bg-surface-700 px-1 py-0.5 rounded">{result.time_column}</code> | Cible : <code className="text-cyan-300 bg-surface-700 px-1 py-0.5 rounded">{result.target_column}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-md bg-surface-700 text-surface-200 font-mono">
              {result.n_observations} obs ({result.n_entities} entités)
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${
              result.is_balanced ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {result.is_balanced ? 'Panel cylindré (balanced)' : 'Panel non cylindré'}
            </span>
          </div>
        </div>

        {/* Verdict du Test de Hausman */}
        <div className={`p-3.5 rounded-lg border flex items-start gap-3 ${
          isFE
            ? 'bg-purple-950/30 border-purple-500/30 text-purple-200'
            : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
        }`}>
          {isFE ? (
            <AlertCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm">
                Test de Spécification de Hausman (Stat χ² = {hausman_test.statistic.toFixed(3)}, p = {hausman_test.p_value < 0.001 ? '< 0.001' : hausman_test.p_value.toFixed(4)})
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                isFE ? 'bg-purple-500/30 text-purple-200' : 'bg-emerald-500/30 text-emerald-200'
              }`}>
                {isFE ? 'Modèle recommandé : Fixed Effects (Within)' : 'Modèle recommandé : Random Effects (GLS)'}
              </span>
            </div>
            <p className="text-surface-300">{hausman_test.conclusion}</p>
          </div>
        </div>
      </div>

      {/* Tableau comparatif des 3 estimateurs de panel */}
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h4 className="text-sm font-semibold text-surface-200 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          Comparaison des Estimateurs : Pooled OLS vs Fixed Effects vs Random Effects
        </h4>

        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-700/60 text-surface-300 font-semibold border-b border-white/10">
              <tr>
                <th className="p-3">Variable</th>
                <th className="p-3 text-right">
                  (1) Pooled OLS <span className="text-[10px] text-surface-400 block font-normal">(Cluster SE)</span>
                </th>
                <th className={`p-3 text-right ${isFE ? 'bg-purple-900/20 text-purple-200 font-bold' : ''}`}>
                  (2) Fixed Effects <span className="text-[10px] text-surface-400 block font-normal">(Within OLS) {isFE ? '★ Optimal' : ''}</span>
                </th>
                <th className={`p-3 text-right ${!isFE ? 'bg-emerald-900/20 text-emerald-200 font-bold' : ''}`}>
                  (3) Random Effects <span className="text-[10px] text-surface-400 block font-normal">(GLS FGLS) {!isFE ? '★ Optimal' : ''}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-surface-200">
              {result.fixed_effects.coefficients.map(feCoef => {
                const pooled = result.pooled_ols.coefficients.find(c => c.variable === feCoef.variable);
                const re = result.random_effects.coefficients.find(c => c.variable === feCoef.variable);

                return (
                  <React.Fragment key={feCoef.variable}>
                    <tr className="hover:bg-white/5">
                      <td className="p-2.5 font-sans font-medium text-surface-100">{feCoef.variable}</td>
                      <td className="p-2.5 text-right">
                        {pooled ? (pooled.coefficient > 0 ? `+${pooled.coefficient.toFixed(4)}` : pooled.coefficient.toFixed(4)) : '—'}
                        {pooled?.significant && <span className="text-emerald-400 ml-1">***</span>}
                      </td>
                      <td className={`p-2.5 text-right font-bold ${isFE ? 'text-purple-300' : 'text-surface-200'}`}>
                        {feCoef.coefficient > 0 ? `+${feCoef.coefficient.toFixed(4)}` : feCoef.coefficient.toFixed(4)}
                        {feCoef.significant && <span className="text-emerald-400 ml-1">***</span>}
                      </td>
                      <td className={`p-2.5 text-right ${!isFE ? 'text-emerald-300 font-bold' : 'text-surface-200'}`}>
                        {re ? (re.coefficient > 0 ? `+${re.coefficient.toFixed(4)}` : re.coefficient.toFixed(4)) : '—'}
                        {re?.significant && <span className="text-emerald-400 ml-1">***</span>}
                      </td>
                    </tr>
                    <tr className="text-[11px] text-surface-400 bg-surface-900/30">
                      <td className="py-1 px-2.5 pl-6 font-sans text-surface-500 italic">Écart-type (SE)</td>
                      <td className="py-1 px-2.5 text-right">({pooled?.std_error?.toFixed(4) ?? '—'})</td>
                      <td className="py-1 px-2.5 text-right">({feCoef.std_error.toFixed(4)})</td>
                      <td className="py-1 px-2.5 text-right">({re?.std_error?.toFixed(4) ?? '—'})</td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Ligne R² et Diagnostics */}
              <tr className="border-t-2 border-white/20 bg-surface-700/40 font-sans">
                <td className="p-2.5 font-semibold text-surface-300">R² / R² Within</td>
                <td className="p-2.5 text-right font-mono font-bold text-surface-200">{result.pooled_ols.r2?.toFixed(4) ?? '—'}</td>
                <td className="p-2.5 text-right font-mono font-bold text-purple-300">{result.fixed_effects.r2_within?.toFixed(4) ?? '—'}</td>
                <td className="p-2.5 text-right font-mono font-bold text-emerald-300">{result.random_effects.r2_overall?.toFixed(4) ?? '—'}</td>
              </tr>
              <tr className="hover:bg-white/5 font-sans">
                <td className="p-2.5 font-semibold text-surface-300">Paramètre θ (Poids GLS)</td>
                <td className="p-2.5 text-right font-mono text-surface-500">—</td>
                <td className="p-2.5 text-right font-mono text-surface-500">—</td>
                <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">{result.random_effects.theta_weight?.toFixed(4) ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

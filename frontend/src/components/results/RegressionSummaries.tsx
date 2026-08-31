import React from 'react';
import { Sparkles, Activity } from 'lucide-react';

export function LogitSummaryView({ logitSummary }: { logitSummary: any }) {
  if (!logitSummary || !logitSummary.odds_ratios) return null;

  return (
    <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4 space-y-4">
      <h4 className="text-md font-semibold text-purple-300 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400" />
        Régression Logistique — Ratios de Cotes (Odds Ratios) & Significativités
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {logitSummary.pseudo_r2_mcfadden !== undefined && (
          <div className="p-3 bg-surface-700/40 rounded-lg border border-white/5">
            <span className="text-xs text-surface-400 block">Pseudo R² (McFadden)</span>
            <span className="text-base font-mono font-bold text-purple-300">
              {(logitSummary.pseudo_r2_mcfadden * 100).toFixed(1)}%
            </span>
          </div>
        )}
        {logitSummary.log_likelihood !== undefined && (
          <div className="p-3 bg-surface-700/40 rounded-lg border border-white/5">
            <span className="text-xs text-surface-400 block">Log-Vraisemblance</span>
            <span className="text-base font-mono font-bold text-surface-200">
              {logitSummary.log_likelihood}
            </span>
          </div>
        )}
        {logitSummary.n_observations !== undefined && (
          <div className="p-3 bg-surface-700/40 rounded-lg border border-white/5">
            <span className="text-xs text-surface-400 block">Échantillon (N)</span>
            <span className="text-base font-mono font-bold text-cyan-300">
              {logitSummary.n_observations}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-700/70 text-surface-300 text-xs uppercase font-semibold">
            <tr>
              <th className="p-2.5">Variable</th>
              <th className="p-2.5 text-right">Coeff (β)</th>
              <th className="p-2.5 text-right">Odds Ratio (e^β)</th>
              <th className="p-2.5 text-right">p-valeur</th>
              <th className="p-2.5 pl-4">Interprétation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-surface-200">
            {logitSummary.odds_ratios.map((or: any, i: number) => (
              <tr key={i} className={or.significant ? 'bg-purple-500/5' : ''}>
                <td className="p-2.5 font-medium text-surface-100">{or.variable}</td>
                <td className="p-2.5 text-right font-mono text-surface-300">
                  {or.coefficient > 0 ? `+${or.coefficient}` : or.coefficient}
                </td>
                <td className="p-2.5 text-right font-mono font-bold text-purple-300">
                  {or.odds_ratio}
                </td>
                <td
                  className={`p-2.5 text-right font-mono font-bold ${
                    or.p_value !== undefined && or.p_value < 0.05
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {or.p_value !== undefined
                    ? or.p_value < 0.001
                      ? '< 0.001'
                      : or.p_value.toFixed(4)
                    : '—'}
                </td>
                <td className="p-2.5 text-left pl-4 text-surface-300">{or.interpretation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OlsSummaryView({ regSummary }: { regSummary: any }) {
  if (!regSummary) return null;

  return (
    <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4 space-y-4">
      <h4 className="text-md font-semibold text-cyan-300 flex items-center gap-2">
        <Activity className="w-5 h-5 text-cyan-400" />
        Résumé de la Régression Linéaire (OLS / MCO)
      </h4>

      {regSummary.equation && (
        <div className="p-3 bg-surface-900/80 rounded-lg border border-cyan-500/30 overflow-x-auto">
          <span className="text-xs text-cyan-400 font-semibold block mb-1">
            Équation de Régression Estimée :
          </span>
          <code className="text-sm font-mono text-cyan-200 whitespace-nowrap">
            {regSummary.equation}
          </code>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-surface-700/40 rounded-lg border border-white/5">
          <span className="text-xs text-surface-400 block">R² Ajusté</span>
          <span className="text-base font-mono font-bold text-emerald-300">
            {regSummary.r2_adjusted !== undefined
              ? (regSummary.r2_adjusted * 100).toFixed(2) + '%'
              : 'N/A'}
          </span>
        </div>
        <div className="p-3 bg-surface-700/40 rounded-lg border border-white/5">
          <span className="text-xs text-surface-400 block">Statistique F (p-valeur)</span>
          <span className="text-base font-mono font-bold text-purple-300">
            {regSummary.f_statistic !== null && regSummary.f_statistic !== undefined
              ? regSummary.f_statistic.toFixed(2)
              : 'N/A'}
            {regSummary.f_pvalue !== undefined && (
              <span className="text-xs font-normal text-surface-400 block">
                p = {regSummary.f_pvalue < 0.001 ? '< 0.001' : regSummary.f_pvalue.toFixed(4)}
              </span>
            )}
          </span>
        </div>
        <div className="p-3 bg-surface-700/40 rounded-lg border border-white/5">
          <span className="text-xs text-surface-400 block">Durbin-Watson</span>
          <span className="text-base font-mono font-bold text-blue-300">
            {regSummary.durbin_watson !== undefined ? regSummary.durbin_watson.toFixed(2) : 'N/A'}
          </span>
        </div>
        <div className="p-3 bg-surface-700/40 rounded-lg border border-white/5">
          <span className="text-xs text-surface-400 block">AIC / BIC</span>
          <span className="text-base font-mono font-bold text-surface-200">
            {regSummary.aic !== undefined
              ? `${regSummary.aic.toFixed(1)} / ${regSummary.bic?.toFixed(1)}`
              : 'N/A'}
          </span>
        </div>
      </div>

      {regSummary.coefficients && regSummary.coefficients.length > 0 && (
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-700/70 text-surface-300 text-xs uppercase font-semibold">
              <tr>
                <th className="p-2.5">Variable</th>
                <th className="p-2.5 text-right">Coefficient (β)</th>
                <th className="p-2.5 text-right">Erreur Type</th>
                <th className="p-2.5 text-right text-cyan-300" title="Erreurs-types robustes à l'hétéroscédasticité (White / HC1 standard Stata)">SE Robuste (White)</th>
                <th className="p-2.5 text-right">Stat t</th>
                <th className="p-2.5 text-right">p-valeur</th>
                <th className="p-2.5 text-right text-cyan-300" title="p-valeur robuste HC1">p-robuste</th>
                <th className="p-2.5 text-right">IC (95%)</th>
                <th className="p-2.5 text-center">Sig.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs text-surface-200">
              {regSummary.coefficients.map((c: any, i: number) => {
                const isSig = c.robust_significant !== undefined ? c.robust_significant : c.significant;
                const pVal = c.robust_p_value !== undefined ? c.robust_p_value : c.p_value;
                return (
                  <tr key={i} className={isSig ? 'bg-emerald-500/5' : ''}>
                    <td className="p-2.5 font-sans font-medium text-surface-100">{c.variable}</td>
                    <td className="p-2.5 text-right font-bold text-cyan-300">
                      {c.coefficient > 0 ? `+${c.coefficient.toFixed(4)}` : c.coefficient.toFixed(4)}
                    </td>
                    <td className="p-2.5 text-right text-surface-400">{c.std_error?.toFixed(4) ?? '—'}</td>
                    <td className="p-2.5 text-right text-cyan-200 font-semibold" title="Robuste HC1">
                      {c.robust_std_error !== undefined ? c.robust_std_error.toFixed(4) : (c.std_error?.toFixed(4) ?? '—')}
                    </td>
                    <td className="p-2.5 text-right text-surface-300">
                      {c.robust_t_statistic !== undefined ? c.robust_t_statistic.toFixed(2) : c.t_statistic?.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right text-surface-400">
                      {c.p_value < 0.001 ? '< 0.001' : c.p_value?.toFixed(4)}
                    </td>
                    <td
                      className={`p-2.5 text-right font-bold ${
                        pVal < 0.05 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {pVal < 0.001 ? '< 0.001' : pVal?.toFixed(4)}
                    </td>
                    <td className="p-2.5 text-right text-surface-400">
                      [{c.ci_lower?.toFixed(3)}, {c.ci_upper?.toFixed(3)}]
                    </td>
                    <td className="p-2.5 text-center">
                      {pVal < 0.001 ? '***' : pVal < 0.01 ? '**' : pVal < 0.05 ? '*' : 'ns'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

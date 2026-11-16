import React from 'react';
import { Sparkles, Activity } from 'lucide-react';
import { PlotlyChart, useCurrentTheme } from '../viz/PlotlyBase';

function CoefficientForestPlot({
  coefficients,
  title,
}: {
  coefficients: any[];
  title: string;
}) {
  const isLight = useCurrentTheme() === 'light';
  const rows = coefficients
    .filter(c => c.variable && !String(c.variable).includes('Constante') && !String(c.variable).includes('β₀'))
    .slice(0, 20)
    .reverse();

  if (rows.length === 0) return null;

  const hasCi = rows.some(r => r.ci_lower !== undefined && r.ci_upper !== undefined);
  const colors = rows.map(c => {
    const isSig = c.robust_significant !== undefined ? c.robust_significant : c.significant;
    if (!isSig) return isLight ? '#64748b' : '#94a3b8';
    return c.coefficient >= 0 ? '#059669' : '#dc2626';
  });

  return (
    <PlotlyChart
      data={[
        {
          x: rows.map(r => r.coefficient),
          y: rows.map(r => r.variable),
          type: 'scatter',
          mode: 'markers',
          marker: { size: 9, color: colors },
          error_x: hasCi
            ? {
                type: 'data',
                symmetric: false,
                array: rows.map(r => (r.ci_upper !== undefined ? Math.max(0, r.ci_upper - r.coefficient) : 0)),
                arrayminus: rows.map(r => (r.ci_lower !== undefined ? Math.max(0, r.coefficient - r.ci_lower) : 0)),
                color: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(226,232,240,0.55)',
                thickness: 1.5,
                width: 4,
              }
            : undefined,
          showlegend: false,
          hovertemplate: hasCi
            ? '<b>%{y}</b><br>β = %{x:.4f}<extra></extra>'
            : '<b>%{y}</b><br>β = %{x:.4f}<extra></extra>',
        } as any,
      ]}
      layout={{
        title: { text: title, font: { size: 13 } },
        xaxis: { title: { text: hasCi ? 'Coefficient estimé (IC 95%)' : 'Coefficient estimé' }, zeroline: true },
        yaxis: { automargin: true },
        margin: { l: 150, r: 24, t: 36, b: 48 },
        showlegend: false,
        shapes: [
          {
            type: 'line',
            xref: 'x',
            yref: 'paper',
            x0: 0,
            x1: 0,
            y0: 0,
            y1: 1,
            line: { color: isLight ? 'rgba(15,23,42,0.4)' : 'rgba(255,255,255,0.4)', width: 1.2, dash: 'dot' },
          },
        ],
      }}
      height={Math.max(240, rows.length * 32 + 90)}
    />
  );
}

export function LogitSummaryView({ logitSummary }: { logitSummary: any }) {
  if (!logitSummary || !logitSummary.odds_ratios) return null;

  return (
    <div className="ui-panel p-4 space-y-4">
      <h4 className="text-md font-semibold text-accent-400 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent-400" />
        Régression Logistique — Ratios de Cotes (Odds Ratios) & Significativités
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 ui-num">
        {logitSummary.pseudo_r2_mcfadden !== undefined && (
          <div className="p-3 rounded-[var(--ui-radius-sm)]" style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}>
            <span className="text-xs ui-t-muted block">Pseudo R² (McFadden)</span>
            <span className="text-base font-mono font-bold text-accent-400">
              {(logitSummary.pseudo_r2_mcfadden * 100).toFixed(1)}%
            </span>
          </div>
        )}
        {logitSummary.log_likelihood !== undefined && (
          <div className="p-3 rounded-[var(--ui-radius-sm)]" style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}>
            <span className="text-xs ui-t-muted block">Log-Vraisemblance</span>
            <span className="text-base font-mono font-bold" style={{ color: 'var(--ui-text)' }}>
              {logitSummary.log_likelihood}
            </span>
          </div>
        )}
        {logitSummary.n_observations !== undefined && (
          <div className="p-3 rounded-[var(--ui-radius-sm)]" style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}>
            <span className="text-xs ui-t-muted block">Échantillon (N)</span>
            <span className="text-base font-mono font-bold text-accent-400">
              {logitSummary.n_observations}
            </span>
          </div>
        )}
      </div>

      <CoefficientForestPlot
        coefficients={logitSummary.odds_ratios}
        title="Effets logistiques estimés (β)"
      />

      <div className="overflow-x-auto rounded-[var(--ui-radius-sm)]" style={{ border: '1px solid var(--ui-border)' }}>
        <table className="ui-table w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-2.5">Variable</th>
              <th className="p-2.5 text-right">Coeff (β)</th>
              <th className="p-2.5 text-right">Odds Ratio (e^β)</th>
              <th className="p-2.5 text-right">p-valeur</th>
              <th className="p-2.5 pl-4">Interprétation</th>
            </tr>
          </thead>
          <tbody className="text-xs ui-num">
            {logitSummary.odds_ratios.map((or: any, i: number) => (
              <tr key={i} style={or.significant ? { background: 'var(--ui-accent-soft)' } : undefined}>
                <td className="p-2.5 font-medium" style={{ color: 'var(--ui-text)' }}>{or.variable}</td>
                <td className="p-2.5 text-right font-mono">
                  {or.coefficient > 0 ? `+${or.coefficient}` : or.coefficient}
                </td>
                <td className="p-2.5 text-right font-mono font-bold text-accent-400">
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
                <td className="p-2.5 text-left pl-4">{or.interpretation}</td>
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
    <div className="ui-panel p-4 space-y-4">
      <h4 className="text-md font-semibold flex items-center gap-2" style={{ color: 'var(--ui-accent-text)' }}>
        <Activity className="w-4 h-4" />
        Résumé de la Régression Linéaire (OLS / MCO)
      </h4>

      {regSummary.equation && (
        <div
          className="p-3 rounded-[var(--ui-radius-sm)] overflow-x-auto"
          style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border-strong)' }}
        >
          <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--ui-accent-text)' }}>
            Équation de Régression Estimée :
          </span>
          <code className="text-sm font-mono whitespace-nowrap" style={{ color: 'var(--ui-text)' }}>
            {regSummary.equation}
          </code>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ui-num">
        <div className="p-3 rounded-[var(--ui-radius-sm)]" style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}>
          <span className="text-xs ui-t-muted block">R² Ajusté</span>
          <span className="text-base font-mono font-bold text-emerald-400">
            {regSummary.r2_adjusted !== undefined
              ? (regSummary.r2_adjusted * 100).toFixed(2) + '%'
              : 'N/A'}
          </span>
        </div>
        <div className="p-3 rounded-[var(--ui-radius-sm)]" style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}>
          <span className="text-xs ui-t-muted block">Statistique F (p-valeur)</span>
          <span className="text-base font-mono font-bold text-sky-400">
            {regSummary.f_statistic !== null && regSummary.f_statistic !== undefined
              ? regSummary.f_statistic.toFixed(2)
              : 'N/A'}
            {regSummary.f_pvalue !== undefined && (
              <span className="text-xs font-normal ui-t-muted block">
                p = {regSummary.f_pvalue < 0.001 ? '< 0.001' : regSummary.f_pvalue.toFixed(4)}
              </span>
            )}
          </span>
        </div>
        <div className="p-3 rounded-[var(--ui-radius-sm)]" style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}>
          <span className="text-xs ui-t-muted block">Durbin-Watson</span>
          <span className="text-base font-mono font-bold text-blue-400">
            {regSummary.durbin_watson !== undefined ? regSummary.durbin_watson.toFixed(2) : 'N/A'}
          </span>
        </div>
        <div className="p-3 rounded-[var(--ui-radius-sm)]" style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}>
          <span className="text-xs ui-t-muted block">AIC / BIC</span>
          <span className="text-base font-mono font-bold" style={{ color: 'var(--ui-text)' }}>
            {regSummary.aic !== undefined
              ? `${regSummary.aic.toFixed(1)} / ${regSummary.bic?.toFixed(1)}`
              : 'N/A'}
          </span>
        </div>
      </div>

      {regSummary.coefficients && regSummary.coefficients.length > 0 && (
        <>
          <CoefficientForestPlot
            coefficients={regSummary.coefficients}
            title="Diagramme des coefficients (β ± IC 95%)"
          />
          <div className="overflow-x-auto rounded-[var(--ui-radius-sm)]" style={{ border: '1px solid var(--ui-border)' }}>
            <table className="ui-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2.5">Variable</th>
                  <th className="p-2.5 text-right">Coefficient (β)</th>
                  <th className="p-2.5 text-right">Erreur Type</th>
                  <th className="p-2.5 text-right text-accent-400" title="Erreurs-types robustes à l'hétéroscédasticité (White / HC1 standard Stata)">SE Robuste (White)</th>
                  <th className="p-2.5 text-right">Stat t</th>
                  <th className="p-2.5 text-right">p-valeur</th>
                  <th className="p-2.5 text-right text-accent-400" title="p-valeur robuste HC1">p-robuste</th>
                  <th className="p-2.5 text-right">IC (95%)</th>
                  <th className="p-2.5 text-center">Sig.</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs ui-num">
                {regSummary.coefficients.map((c: any, i: number) => {
                  const isSig = c.robust_significant !== undefined ? c.robust_significant : c.significant;
                  const pVal = c.robust_p_value !== undefined ? c.robust_p_value : c.p_value;
                  return (
                    <tr key={i} style={isSig ? { background: 'var(--ui-success-soft)' } : undefined}>
                      <td className="p-2.5 font-sans font-medium" style={{ color: 'var(--ui-text)' }}>{c.variable}</td>
                      <td className="p-2.5 text-right font-bold text-accent-400">
                        {c.coefficient > 0 ? `+${c.coefficient.toFixed(4)}` : c.coefficient.toFixed(4)}
                      </td>
                      <td className="p-2.5 text-right ui-t-muted">{c.std_error?.toFixed(4) ?? '—'}</td>
                      <td className="p-2.5 text-right font-semibold text-accent-400" title="Robuste HC1">
                        {c.robust_std_error !== undefined ? c.robust_std_error.toFixed(4) : (c.std_error?.toFixed(4) ?? '—')}
                      </td>
                      <td className="p-2.5 text-right">
                        {c.robust_t_statistic !== undefined ? c.robust_t_statistic.toFixed(2) : c.t_statistic?.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right ui-t-muted">
                        {c.p_value < 0.001 ? '< 0.001' : c.p_value?.toFixed(4)}
                      </td>
                      <td
                        className={`p-2.5 text-right font-bold ${
                          pVal < 0.05 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {pVal < 0.001 ? '< 0.001' : pVal?.toFixed(4)}
                      </td>
                      <td className="p-2.5 text-right ui-t-muted">
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
        </>
      )}
    </div>
  );
}

import React from 'react';
import { Activity } from 'lucide-react';
import { PlotlyChart, useCurrentTheme } from '../viz/PlotlyBase';

function CoefficientForestPlot(props: { coefficients: any[]; title: string }) {
  const isLight = useCurrentTheme() === 'light';
  const rows = props.coefficients
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
          hovertemplate: '<b>%{y}</b><br>β = %{x:.4f}<extra></extra>',
        } as any,
      ]}
      layout={{
        title: { text: props.title, font: { size: 13 } },
        xaxis: { title: { text: hasCi ? 'Coefficient estimé (IC 95%)' : 'Coefficient estimé' }, zeroline: true, automargin: true },
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
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <Activity className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          Régression logistique — Odds Ratios
        </span>
        <span className="flex items-center gap-3 text-xs ui-num ui-t-muted">
          {logitSummary.pseudo_r2_mcfadden !== undefined && (
            <span>Pseudo R² = <strong className="ui-t-accent">{(logitSummary.pseudo_r2_mcfadden * 100).toFixed(1)}%</strong></span>
          )}
          {logitSummary.log_likelihood !== undefined && <span>LL = {logitSummary.log_likelihood}</span>}
          {logitSummary.n_observations !== undefined && <span>N = {logitSummary.n_observations}</span>}
        </span>
      </header>

      <div className="p-3 space-y-3">
        <CoefficientForestPlot coefficients={logitSummary.odds_ratios} title="Effets logistiques estimés (β)" />

        <div className="overflow-x-auto rounded-[var(--ui-radius-sm)]" style={{ border: '1px solid var(--ui-border)' }}>
          <table className="ui-table w-full text-left text-xs">
            <thead>
              <tr>
                <th className="p-2.5 text-left">Variable</th>
                <th className="ui-th-num p-2.5 text-right">Coeff (β)</th>
                <th className="ui-th-num p-2.5 text-right">Odds Ratio</th>
                <th className="ui-th-num p-2.5 text-right">p-valeur</th>
                <th className="p-2.5 pl-4 text-left">Interprétation</th>
              </tr>
            </thead>
            <tbody className="ui-num">
              {logitSummary.odds_ratios.map((or: any, i: number) => (
                <tr key={i} style={or.significant ? { background: 'var(--ui-accent-soft)' } : undefined}>
                  <td className="p-2.5 font-medium" style={{ color: 'var(--ui-text)' }}>{or.variable}</td>
                  <td className="ui-td-num p-2.5">
                    {or.coefficient > 0 ? `+${or.coefficient}` : or.coefficient}
                  </td>
                  <td className="ui-td-num p-2.5 font-bold ui-t-accent">{or.odds_ratio}</td>
                  <td
                    className="ui-td-num p-2.5 font-bold"
                    style={{ color: or.p_value !== undefined && or.p_value < 0.05 ? 'var(--ui-success)' : 'var(--ui-warning)' }}
                  >
                    {or.p_value !== undefined ? (or.p_value < 0.0001 ? '< 0.0001' : or.p_value.toFixed(4)) : '—'}
                  </td>
                  <td className="p-2.5 text-left pl-4">{or.interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function OlsSummaryView({ regSummary }: { regSummary: any }) {
  if (!regSummary) return null;

  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <Activity className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          Résumé de la régression OLS
        </span>
        <span className="flex flex-wrap items-center gap-3 text-xs ui-num ui-t-muted">
          {regSummary.r2_adjusted !== undefined && (
            <span>R² aj. <strong className="ui-t-success">{(regSummary.r2_adjusted * 100).toFixed(2)}%</strong></span>
          )}
          {regSummary.f_statistic != null && (
            <span>
              F = <strong>{regSummary.f_statistic.toFixed(2)}</strong>
              {regSummary.f_pvalue !== undefined && ` (p=${regSummary.f_pvalue < 0.0001 ? '<0.0001' : regSummary.f_pvalue.toFixed(4)})`}
            </span>
          )}
          {regSummary.durbin_watson !== undefined && <span>DW = {regSummary.durbin_watson.toFixed(2)}</span>}
          {regSummary.aic !== undefined && (
            <span>AIC/BIC = {regSummary.aic.toFixed(1)}/{regSummary.bic?.toFixed(1)}</span>
          )}
        </span>
      </header>

      <div className="p-3 space-y-3">
        {regSummary.equation && (
          <div
            className="px-3 py-2 rounded-[var(--ui-radius-sm)] overflow-x-auto ui-mono text-xs whitespace-nowrap"
            style={{ background: 'var(--ui-bg-sunken)', border: '1px solid var(--ui-border)' }}
          >
            {regSummary.equation}
          </div>
        )}

        {regSummary.coefficients && regSummary.coefficients.length > 0 && (
          <>
            <CoefficientForestPlot
              coefficients={regSummary.coefficients}
              title="Diagramme des coefficients (β ± IC 95%)"
            />
            <div className="overflow-x-auto rounded-[var(--ui-radius-sm)]" style={{ border: '1px solid var(--ui-border)' }}>
              <table className="ui-table w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="p-2.5 text-left">Variable</th>
                    <th className="ui-th-num p-2.5 text-right">Coeff (β)</th>
                    <th className="ui-th-num p-2.5 text-right">SE</th>
                    <th className="ui-th-num p-2.5 text-right" title="Erreurs-types robustes White HC1">SE Robuste</th>
                    <th className="ui-th-num p-2.5 text-right">Stat t</th>
                    <th className="ui-th-num p-2.5 text-right">p-valeur</th>
                    <th className="ui-th-num p-2.5 text-right" title="p-valeur robuste HC1">p-robuste</th>
                    <th className="ui-th-num p-2.5 text-right">IC (95%)</th>
                    <th className="ui-th-num p-2.5 text-right">Sig.</th>
                  </tr>
                </thead>
                <tbody className="ui-num">
                  {regSummary.coefficients.map((c: any, i: number) => {
                    const isSig = c.robust_significant !== undefined ? c.robust_significant : c.significant;
                    const pVal = c.robust_p_value !== undefined ? c.robust_p_value : c.p_value;
                    return (
                      <tr key={i} style={isSig ? { background: 'var(--ui-success-soft)' } : undefined}>
                        <td className="p-2.5 font-medium" style={{ color: 'var(--ui-text)' }}>{c.variable}</td>
                        <td className="ui-td-num p-2.5 font-bold ui-t-accent">
                          {c.coefficient > 0 ? `+${c.coefficient.toFixed(4)}` : c.coefficient.toFixed(4)}
                        </td>
                        <td className="ui-td-num p-2.5 ui-t-muted">{c.std_error?.toFixed(4) ?? '—'}</td>
                        <td className="ui-td-num p-2.5 font-semibold ui-t-accent">
                          {c.robust_std_error !== undefined ? c.robust_std_error.toFixed(4) : (c.std_error?.toFixed(4) ?? '—')}
                        </td>
                        <td className="ui-td-num p-2.5">
                          {c.robust_t_statistic !== undefined ? c.robust_t_statistic.toFixed(2) : c.t_statistic?.toFixed(2)}
                        </td>
                        <td className="ui-td-num p-2.5 ui-t-muted">
                          {c.p_value < 0.0001 ? '< 0.0001' : c.p_value?.toFixed(4)}
                        </td>
                        <td
                          className="ui-td-num p-2.5 font-bold"
                          style={{ color: pVal < 0.05 ? 'var(--ui-success)' : 'var(--ui-warning)' }}
                        >
                          {pVal < 0.0001 ? '< 0.0001' : pVal?.toFixed(4)}
                        </td>
                        <td className="ui-td-num p-2.5 ui-t-muted">
                          [{c.ci_lower?.toFixed(3)}, {c.ci_upper?.toFixed(3)}]
                        </td>
                        <td className="ui-td-num p-2.5 font-bold">
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
    </section>
  );
}

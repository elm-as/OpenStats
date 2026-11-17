import React from 'react';
import { TrendingUp } from 'lucide-react';
import { EmptyState } from './ResultAtoms';
import { CorrelationHeatmap } from '../viz';

export function CorrelationsTab({ result }: { result?: any }) {
  if (!result) return <EmptyState message="Pas de résultats de corrélation disponibles" />;

  const matrix = result.matrix || result.correlations || {};
  const cols = Object.keys(matrix);

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
            Matrice de corrélation
          </span>
          <span className="ui-num text-xs ui-t-muted">{cols.length} var.</span>
        </header>

        {cols.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left">Variable</th>
                  {cols.map(c => (
                    <th key={c} className="ui-th-num" title={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cols.map(row => (
                  <tr key={row}>
                    <td className="font-semibold" style={{ color: 'var(--ui-text)' }}>{row}</td>
                    {cols.map(col => {
                      const val = matrix[row]?.[col];
                      const v = val !== undefined ? Number(val) : null;
                      const abs = v !== null ? Math.abs(v) : 0;
                      const isDiag = row === col;

                      return (
                        <td
                          key={col}
                          className={`ui-td-num ${abs > 0.7 && !isDiag ? 'font-bold' : ''}`}
                          style={{
                            backgroundColor: isDiag || v === null
                              ? undefined
                              : v > 0
                                ? `rgba(249,115,22,${abs * 0.22})`
                                : `rgba(37,99,235,${abs * 0.22})`,
                            color: isDiag ? 'var(--ui-text-faint)' : undefined,
                          }}
                        >
                          {v !== null ? v.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="Aucune variable numérique pour la corrélation" />
        )}
      </section>

      {result.significant_pairs && result.significant_pairs.length > 0 && (
        <section className="ui-panel overflow-hidden">
          <header className="ui-panel-header">
            <span style={{ color: 'var(--ui-text)' }}>Corrélations significatives</span>
          </header>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left">Variable A</th>
                  <th className="text-left">Variable B</th>
                  <th className="ui-th-num">r</th>
                  <th className="ui-th-num">p-value</th>
                  <th className="text-left">Intensité</th>
                </tr>
              </thead>
              <tbody>
                {result.significant_pairs.slice(0, 12).map((pair: any, i: number) => (
                  <tr key={i}>
                    <td className="ui-mono">{pair.var1}</td>
                    <td className="ui-mono">{pair.var2}</td>
                    <td className="ui-td-num font-bold" style={{ color: pair.coefficient > 0 ? 'var(--ui-success)' : 'var(--ui-danger)' }}>
                      {pair.coefficient > 0 ? `+${pair.coefficient.toFixed(3)}` : pair.coefficient.toFixed(3)}
                    </td>
                    <td className="ui-td-num">
                      {pair.p_value !== undefined
                        ? pair.p_value < 0.0001
                          ? '< 0.0001'
                          : pair.p_value.toFixed(4)
                        : '—'}
                    </td>
                    <td className="ui-t-muted">{pair.strength}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cols.length > 1 && (
        <div className="ui-panel p-3">
          <CorrelationHeatmap matrix={matrix} height={420} cluster={false} title="Matrice de corrélation (Heatmap)" />
        </div>
      )}
    </div>
  );
}
